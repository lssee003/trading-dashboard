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

  private su!: Record<"res" | "time" | "mouse" | "mood", WebGLUniformLocation | null>;
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
  // set once the engine gives up on a machine that can't keep up even at the
  // scale floor: the loop stops and the last frame is left frozen on screen
  private frozen = false;

  // adaptive-resolution / framerate bookkeeping
  private lastRenderTime = 0; // timestamp of the previous *rendered* frame
  private cadenceEma = 0;     // smoothed gap between rendered frames (~target when healthy)
  private costEma = 0;        // smoothed CPU cost of a render (headroom signal)
  private fc = 0;             // frames since the last adaptive check
  private struggleTicks = 0;  // consecutive bad windows while pinned at the floor

  private onResize = () => this.resize();
  private onMove = (e: PointerEvent) => {
    const w = window.innerWidth, h = window.innerHeight;
    this.tgt.x = (e.clientX / w) * 2 - 1;
    this.tgt.y = -((e.clientY / h) * 2 - 1);
  };
  private onVis = () => {
    if (document.hidden) {
      this.running = false;
    } else if (!this.reduced && !this.frozen) {
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
      // "default" lets the browser stay on the integrated GPU for a background
      // effect instead of waking a battery-hungry discrete GPU. No
      // preserveDrawingBuffer: we never read the canvas back, and dropping it
      // frees the driver from keeping an extra copy each frame.
      powerPreference: "default",
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
    // static states (reduced-motion, or frozen after giving up) don't loop, so
    // repaint a single frame here or the resized canvas would be left blank
    if (this.reduced) this.renderFrame(8.0);
    else if (this.frozen) this.renderFrame((performance.now() - this.startT) / 1000);
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
    const interval = 1000 / this.config.maxFps;
    const loop = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      // throttle to the target framerate — ambient drift needs no more, and
      // this halves the work on machines that could otherwise run at 60/120Hz.
      // (a few ms of slack so we land on 30fps from a 60Hz rAF, not 20fps)
      if (now - this.lastRenderTime < interval - 4) return;
      // cadence = real gap between rendered frames: ~interval when the GPU keeps
      // up, larger when it can't — this is the adaptive-resolution health signal
      const cadence = this.lastRenderTime ? now - this.lastRenderTime : interval;
      this.lastRenderTime = now;
      this.cadenceEma = this.cadenceEma ? this.cadenceEma * 0.9 + cadence * 0.1 : cadence;
      const t = (now - this.startT) / 1000;
      // slightly stronger pointer easing to keep the same feel at 30fps
      this.mouse.x += (this.tgt.x - this.mouse.x) * 0.09;
      this.mouse.y += (this.tgt.y - this.mouse.y) * 0.09;
      this.renderFrame(t);
      this.adapt();
    };
    this.raf = requestAnimationFrame(loop);
  }

  private renderFrame(t: number) {
    const gl = this.gl;
    if (!gl || !this.W) return;
    const t0 = performance.now();

    gl.bindVertexArray(this.vao);

    // scene -> HDR offscreen target
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.rW, this.rH);
    gl.useProgram(this.sceneProg);
    gl.uniform2f(this.su.res, this.rW, this.rH);
    gl.uniform1f(this.su.time, t);
    gl.uniform2f(this.su.mouse, this.mouse.x, this.mouse.y);
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

    // CPU-side cost of submitting the frame; rises under GPU backpressure, so it
    // doubles as the "is there headroom to scale back up?" signal
    const cost = performance.now() - t0;
    this.costEma = this.costEma ? this.costEma * 0.9 + cost * 0.1 : cost;
  }

  /** Every ~40 rendered frames, trade render scale for framerate — and if even
   *  the scale floor can't hold the target, freeze to a static frame so a weak
   *  machine never runs a sluggish loop under the dashboard. */
  private adapt() {
    this.fc += 1;
    if (this.fc <= 40 || !this.cadenceEma) return;
    this.fc = 0;

    const target = 1000 / this.config.maxFps;
    const floor = this.config.scaleFloor;

    let ns = this.scale;
    if (this.cadenceEma > target * 1.35 && this.scale > floor) {
      ns = Math.max(floor, this.scale - 0.1); // missing the target -> shed pixels
    } else if (this.cadenceEma < target * 1.12 && this.costEma < target * 0.45 && this.scale < 1.0) {
      ns = Math.min(1.0, this.scale + 0.1); // comfortable headroom -> sharpen
    }
    if (ns !== this.scale) {
      this.scale = ns;
      this.applyScale();
    }

    // still far behind while pinned at the floor across ~2 windows (~2-3s):
    // give up and freeze rather than grind
    if (this.scale <= floor + 1e-3 && this.cadenceEma > target * 1.7) {
      if (++this.struggleTicks >= 2) this.freeze();
    } else {
      this.struggleTicks = 0;
    }
  }

  /** Stop the loop and leave the last composited frame frozen on screen. */
  private freeze() {
    this.frozen = true;
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    console.info("Glass field: sustained low framerate — froze to a static frame.");
  }
}
