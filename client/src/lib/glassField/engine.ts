/**
 * GlassFieldEngine — the runtime behind the Glass Field backdrop, ported from
 * the Claude Design file "Glass Field.dc.html" (its DCLogic class) into a
 * plain, framework-agnostic controller so React only has to hand it a <canvas>
 * and later dispose it.
 *
 * Pipeline: a full-screen triangle renders the scene shader into an HDR
 * (RGBA16F when available) offscreen target, then the composite shader tonemaps
 * it to the canvas. Render scale adapts from a frame-time EMA to hold framerate;
 * the loop lerps a smoothed pointer, pauses on hidden tabs, and honours
 * prefers-reduced-motion by drawing a single settled frame instead of animating.
 */
import { GLSL_COMP_FS, GLSL_SCENE_FS, GLSL_VS } from "./shaders";
import { GlassFieldConfig, moodIndex } from "./config";

export class GlassFieldEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly config: GlassFieldConfig;
  private readonly reduced: boolean;

  private gl!: WebGL2RenderingContext;
  private hasFloat = false;
  private hasFloatLinear = false;

  private vs!: WebGLShader;
  private sceneProg!: WebGLProgram;
  private compProg!: WebGLProgram;
  private vao!: WebGLVertexArrayObject;
  private fbo!: WebGLFramebuffer;
  private tex!: WebGLTexture;

  private su!: Record<"res" | "time" | "mouse" | "sep" | "drift" | "irid" | "mood", WebGLUniformLocation | null>;
  private cu!: Record<"res" | "time" | "scene", WebGLUniformLocation | null>;

  // full-window backing store size (device px) and render-target size (scaled)
  private W = 0;
  private H = 0;
  private rW = 0;
  private rH = 0;
  private scale = 1.0;

  // pointer easing + timing
  private mouse = { x: 0, y: 0 };
  private tgt = { x: 0, y: 0 };
  private startT = 0;
  private running = false;
  private raf = 0;

  // adaptive-resolution frame-time bookkeeping
  private lastT = 0;
  private ema = 0;
  private fc = 0;

  private onResize = () => this.resize();
  private onMove = (e: PointerEvent) => {
    const w = window.innerWidth, h = window.innerHeight;
    this.tgt.x = (e.clientX / w) * 2 - 1;
    this.tgt.y = -((e.clientY / h) * 2 - 1);
  };
  private onVis = () => {
    if (document.hidden) {
      this.running = false;
    } else if (!this.reduced) {
      this.running = true;
      this.startLoop();
    }
  };

  constructor(canvas: HTMLCanvasElement, config: GlassFieldConfig) {
    this.canvas = canvas;
    this.config = config;
    this.reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /** Boot WebGL, wire listeners, draw the first frame, and (unless reduced) loop. */
  start() {
    this.startT = performance.now();
    this.running = true;
    this.initGL();

    window.addEventListener("resize", this.onResize);
    window.addEventListener("pointermove", this.onMove, { passive: true });
    document.addEventListener("visibilitychange", this.onVis);

    this.resize();
    this.renderFrame(this.reduced ? 8.0 : 0.6);
    if (!this.reduced) this.startLoop();
  }

  /** Stop the loop and detach every listener. The GL context is left to GC. */
  dispose() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("pointermove", this.onMove);
    document.removeEventListener("visibilitychange", this.onVis);
  }

  private compile(type: number, src: string): WebGLShader {
    const gl = this.gl;
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(s);
      console.error("Glass field shader compile error", info);
      throw new Error(info ?? "shader compile error");
    }
    return s;
  }

  private program(fs: string): WebGLProgram {
    const gl = this.gl;
    const p = gl.createProgram()!;
    gl.attachShader(p, this.vs);
    gl.attachShader(p, this.compile(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, "a");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(p) ?? "program link error");
    }
    return p;
  }

  private initGL() {
    const gl = this.canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      depth: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    if (!gl) throw new Error("WebGL2 unavailable");
    this.gl = gl;
    this.hasFloat = !!gl.getExtension("EXT_color_buffer_float");
    this.hasFloatLinear = !!gl.getExtension("OES_texture_float_linear");

    this.vs = this.compile(gl.VERTEX_SHADER, GLSL_VS);
    this.sceneProg = this.program(GLSL_SCENE_FS);
    this.compProg = this.program(GLSL_COMP_FS);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this.su = {
      res: gl.getUniformLocation(this.sceneProg, "uRes"),
      time: gl.getUniformLocation(this.sceneProg, "uTime"),
      mouse: gl.getUniformLocation(this.sceneProg, "uMouse"),
      sep: gl.getUniformLocation(this.sceneProg, "uSep"),
      drift: gl.getUniformLocation(this.sceneProg, "uDrift"),
      irid: gl.getUniformLocation(this.sceneProg, "uIrid"),
      mood: gl.getUniformLocation(this.sceneProg, "uMood"),
    };
    this.cu = {
      res: gl.getUniformLocation(this.compProg, "uRes"),
      time: gl.getUniformLocation(this.compProg, "uTime"),
      scene: gl.getUniformLocation(this.compProg, "uScene"),
    };

    this.fbo = gl.createFramebuffer()!;
    this.tex = gl.createTexture()!;
  }

  private resize() {
    const gl = this.gl;
    if (!gl) return;
    const dpr = Math.min(window.devicePixelRatio || 1, this.config.dprCap);
    const w = Math.max(2, Math.floor(window.innerWidth * dpr));
    const h = Math.max(2, Math.floor(window.innerHeight * dpr));
    this.canvas.width = w;
    this.canvas.height = h;
    this.W = w;
    this.H = h;
    this.applyScale();
    if (this.reduced) this.renderFrame(8.0);
  }

  private applyScale() {
    const gl = this.gl;
    if (!gl) return;
    this.rW = Math.max(2, Math.floor(this.W * this.scale));
    this.rH = Math.max(2, Math.floor(this.H * this.scale));
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    if (this.hasFloat) {
      const f = this.hasFloatLinear ? gl.LINEAR : gl.NEAREST;
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, this.rW, this.rH, 0, gl.RGBA, gl.HALF_FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.rW, this.rH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private startLoop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    const loop = () => {
      if (!this.running) return;
      const t = (performance.now() - this.startT) / 1000;
      this.mouse.x += (this.tgt.x - this.mouse.x) * 0.04;
      this.mouse.y += (this.tgt.y - this.mouse.y) * 0.04;
      this.renderFrame(t);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private renderFrame(t: number) {
    const gl = this.gl;
    if (!gl || !this.W) return;

    // adaptive resolution: nudge render scale from a frame-time EMA
    const now = performance.now();
    if (this.lastT) {
      const dt = now - this.lastT;
      this.ema = this.ema ? this.ema * 0.9 + dt * 0.1 : dt;
    }
    this.lastT = now;
    this.fc += 1;
    if (this.fc > 40 && this.ema) {
      this.fc = 0;
      let ns = this.scale;
      if (this.ema > 30 && this.scale > 0.8) ns = Math.max(0.8, this.scale - 0.1);
      else if (this.ema < 15 && this.scale < 1.0) ns = Math.min(1.0, this.scale + 0.1);
      if (ns !== this.scale) {
        this.scale = ns;
        this.applyScale();
      }
    }

    gl.bindVertexArray(this.vao);

    // scene -> HDR offscreen target
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.rW, this.rH);
    gl.useProgram(this.sceneProg);
    gl.uniform2f(this.su.res, this.rW, this.rH);
    gl.uniform1f(this.su.time, t);
    gl.uniform2f(this.su.mouse, this.mouse.x, this.mouse.y);
    gl.uniform1f(this.su.sep, this.config.separation);
    gl.uniform1f(this.su.drift, this.config.drift);
    gl.uniform1f(this.su.irid, this.config.iridescence);
    gl.uniform1f(this.su.mood, moodIndex(this.config.mood));
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // composite -> canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.W, this.H);
    gl.useProgram(this.compProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(this.cu.scene, 0);
    gl.uniform2f(this.cu.res, this.W, this.H);
    gl.uniform1f(this.cu.time, t);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
