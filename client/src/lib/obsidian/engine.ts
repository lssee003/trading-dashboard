/**
 * Obsidian liquid-glass backdrop engine.
 *
 * Raw WebGL2, four passes: raymarched scene (HDR) → brightpass at 1/4 res
 * → separable gaussian blur → composite with ACES + vignette + dither.
 *
 * All animation (rotation, morph, breathing, drift, light wander) is
 * CPU-side 1D fbm noise fed in as uniforms — slow, irregular, loop-free.
 */
import { OBSIDIAN as C } from "./config";
import { VERT, SCENE_FRAG, BRIGHT_FRAG, BLUR_FRAG, COMPOSITE_FRAG } from "./shaders";

/* ---------- CPU noise (1D value-noise fbm, -1..1) ---------- */
function hashN(n: number): number {
  const x = Math.sin(n) * 43758.5453123;
  return x - Math.floor(x);
}
function vnoise1(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hashN(i) * (1 - u) + hashN(i + 1) * u;
}
function fbm1(x: number, seed: number): number {
  let s = 0;
  let a = 0.5;
  let fr = 1;
  for (let o = 0; o < 3; o++) {
    s += a * (vnoise1(x * fr + seed * 91.7) * 2 - 1);
    a *= 0.5;
    fr *= 2.03;
  }
  return s / 0.875;
}

/* ---------- GL helpers ---------- */
function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`shader compile: ${log}`);
  }
  return sh;
}
function link(gl: WebGL2RenderingContext, fs: string): WebGLProgram {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`program link: ${gl.getProgramInfoLog(p)}`);
  }
  return p;
}

interface Target {
  fbo: WebGLFramebuffer;
  tex: WebGLTexture;
  w: number;
  h: number;
}

export interface ObsidianScene {
  dispose(): void;
}

export function createObsidianScene(canvas: HTMLCanvasElement): ObsidianScene | null {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "low-power",
  });
  if (!gl) return null;

  const floatOk = !!gl.getExtension("EXT_color_buffer_float");
  const linearOk = floatOk ? !!gl.getExtension("OES_texture_float_linear") : false;
  // fall back to RGBA8 when we can't filter float textures
  const useFloat = floatOk && linearOk;
  const internalFormat = useFloat ? gl.RGBA16F : gl.RGBA8;
  const texType = useFloat ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;

  let progs: WebGLProgram[];
  try {
    progs = [SCENE_FRAG, BRIGHT_FRAG, BLUR_FRAG, COMPOSITE_FRAG].map((f) => link(gl, f));
  } catch (e) {
    if (import.meta.env.DEV) console.error("[obsidian]", e);
    return null;
  }
  const [pScene, pBright, pBlur, pComposite] = progs;

  const uni = new Map<string, WebGLUniformLocation | null>();
  const U = (p: WebGLProgram, name: string) => {
    const key = `${progs.indexOf(p)}:${name}`;
    if (!uni.has(key)) uni.set(key, gl.getUniformLocation(p, name));
    return uni.get(key)!;
  };

  // fullscreen triangle-pair
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  function makeTarget(w: number, h: number): Target {
    const tex = gl!.createTexture()!;
    gl!.bindTexture(gl!.TEXTURE_2D, tex);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, internalFormat, w, h, 0, gl!.RGBA, texType, null);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    const fbo = gl!.createFramebuffer()!;
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, fbo);
    gl!.framebufferTexture2D(gl!.FRAMEBUFFER, gl!.COLOR_ATTACHMENT0, gl!.TEXTURE_2D, tex, 0);
    return { fbo, tex, w, h };
  }
  function freeTarget(t: Target) {
    gl!.deleteFramebuffer(t.fbo);
    gl!.deleteTexture(t.tex);
  }

  let scene: Target | null = null;
  let bloomA: Target | null = null;
  let bloomB: Target | null = null;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, C.render.dprCap);
    const w = Math.max(2, Math.round(canvas.clientWidth * dpr * C.render.scale));
    const h = Math.max(2, Math.round(canvas.clientHeight * dpr * C.render.scale));
    if (canvas.width === w && canvas.height === h && scene) return;
    canvas.width = w;
    canvas.height = h;
    if (scene) freeTarget(scene);
    if (bloomA) freeTarget(bloomA);
    if (bloomB) freeTarget(bloomB);
    scene = makeTarget(w, h);
    const bw = Math.max(2, Math.round(w / C.render.bloomDiv));
    const bh = Math.max(2, Math.round(h / C.render.bloomDiv));
    bloomA = makeTarget(bw, bh);
    bloomB = makeTarget(bw, bh);
  }

  /* ---------- per-frame animation state ---------- */
  const lobeC = new Float32Array(12);
  const lobeR = new Float32Array(12);
  const rot = new Float32Array(9);

  function rotationMatrix(ax: number, ay: number, az: number, out: Float32Array) {
    const cx = Math.cos(ax), sx = Math.sin(ax);
    const cy = Math.cos(ay), sy = Math.sin(ay);
    const cz = Math.cos(az), sz = Math.sin(az);
    // R = Rz*Ry*Rx (object→world); we upload the transpose (world→object)
    const m00 = cz * cy, m01 = cz * sy * sx - sz * cx, m02 = cz * sy * cx + sz * sx;
    const m10 = sz * cy, m11 = sz * sy * sx + cz * cx, m12 = sz * sy * cx - cz * sx;
    const m20 = -sy, m21 = cy * sx, m22 = cy * cx;
    // column-major transpose = rows written as columns
    out[0] = m00; out[1] = m01; out[2] = m02;
    out[3] = m10; out[4] = m11; out[5] = m12;
    out[6] = m20; out[7] = m21; out[8] = m22;
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let raf = 0;
  let disposed = false;
  let last = performance.now();
  let t = 60; // start mid-noise so the first frame isn't a lattice point

  function frame(now: number) {
    if (disposed) return;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    t += dt * C.motion.timeScale;
    draw(t);
    if (!reduceMotion) raf = requestAnimationFrame(frame);
  }

  function draw(time: number) {
    if (!scene || !bloomA || !bloomB || !gl) return;
    const m = C.motion;

    /* scene pass */
    gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fbo);
    gl.viewport(0, 0, scene.w, scene.h);
    gl.useProgram(pScene);
    gl.uniform2f(U(pScene, "uRes"), scene.w, scene.h);
    gl.uniform1f(U(pScene, "uTime"), time);

    rotationMatrix(
      m.rotAmp[0] * fbm1(time * m.rotSpeed[0], 11),
      m.rotAmp[1] * fbm1(time * m.rotSpeed[1], 23),
      m.rotAmp[2] * fbm1(time * m.rotSpeed[2], 37),
      rot,
    );
    gl.uniformMatrix3fv(U(pScene, "uRot"), false, rot);
    gl.uniform3f(
      U(pScene, "uPos"),
      C.motion.driftAmp[0] * fbm1(time * m.driftSpeed, 53),
      C.motion.driftAmp[1] * fbm1(time * m.driftSpeed, 67),
      0,
    );
    gl.uniform1f(U(pScene, "uScale"), 1 + m.breathAmp * fbm1(time * m.breathSpeed, 71));

    const s = C.sculpt;
    gl.uniform3f(
      U(pScene, "uSculpt"),
      s.bend + s.amp[0] * fbm1(time * s.speed[0], 401),
      s.twist + s.amp[1] * fbm1(time * s.speed[1], 419),
      s.pinch + s.amp[2] * fbm1(time * s.speed[2], 433),
    );

    for (let i = 0; i < 4; i++) {
      const L = C.lobes[i];
      const ph = time * m.morphSpeed;
      lobeC[i * 3 + 0] = L.c[0] + m.morphAmp * fbm1(ph, 100 + i * 3);
      lobeC[i * 3 + 1] = L.c[1] + m.morphAmp * fbm1(ph, 101 + i * 3);
      lobeC[i * 3 + 2] = L.c[2] + m.morphAmp * fbm1(ph, 102 + i * 3);
      const rk = 1 + m.radiusAmp * fbm1(ph, 200 + i * 7);
      lobeR[i * 3 + 0] = L.r[0] * rk;
      lobeR[i * 3 + 1] = L.r[1] * rk;
      lobeR[i * 3 + 2] = L.r[2] * rk;
    }
    gl.uniform3fv(U(pScene, "uLobeC"), lobeC);
    gl.uniform3fv(U(pScene, "uLobeR"), lobeR);

    const az = C.light.azimuth + C.light.wanderAmp * fbm1(time * C.light.wanderSpeed, 301);
    const el = C.light.elevation + 0.12 * fbm1(time * C.light.wanderSpeed, 307);
    const kx = Math.cos(el) * Math.sin(az);
    const ky = Math.sin(el);
    const kz = Math.cos(el) * Math.cos(az);
    gl.uniform3f(U(pScene, "uKeyDir"), kx, ky, kz);
    gl.uniform3f(U(pScene, "uKeyCol"), C.light.color[0], C.light.color[1], C.light.color[2]);
    gl.uniform1f(U(pScene, "uKeyInt"), C.light.intensity);
    gl.uniform2f(
      U(pScene, "uGlowUV"),
      C.light.glowCenter[0] + az * C.light.glowSpread,
      C.light.glowCenter[1] + (el - C.light.elevation) * 0.3,
    );
    gl.uniform1f(U(pScene, "uWarpPhase"), time * 0.02);

    const mat = C.material;
    gl.uniform1f(U(pScene, "uSpecInt"), mat.specInt);
    gl.uniform1f(U(pScene, "uIridInt"), mat.iridInt);
    gl.uniform1f(U(pScene, "uFilmBase"), mat.filmBase);
    gl.uniform1f(U(pScene, "uFilmVar"), mat.filmVar);
    gl.uniform1f(U(pScene, "uAbsorb"), mat.absorb);
    gl.uniform1f(U(pScene, "uTransInt"), mat.transInt);
    gl.uniform1f(U(pScene, "uBackInt"), mat.backInt);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    /* brightpass ↓ */
    gl.bindFramebuffer(gl.FRAMEBUFFER, bloomA.fbo);
    gl.viewport(0, 0, bloomA.w, bloomA.h);
    gl.useProgram(pBright);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, scene.tex);
    gl.uniform1i(U(pBright, "uTex"), 0);
    gl.uniform1f(U(pBright, "uThreshold"), C.post.bloomThreshold);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    /* blur H → B, V → A (two rounds for a wide soft halo) */
    for (let round = 0; round < 2; round++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, bloomB.fbo);
      gl.useProgram(pBlur);
      gl.bindTexture(gl.TEXTURE_2D, bloomA.tex);
      gl.uniform1i(U(pBlur, "uTex"), 0);
      gl.uniform2f(U(pBlur, "uDir"), (1 + round) / bloomA.w, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, bloomA.fbo);
      gl.bindTexture(gl.TEXTURE_2D, bloomB.tex);
      gl.uniform2f(U(pBlur, "uDir"), 0, (1 + round) / bloomA.h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    /* composite → screen */
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(pComposite);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, scene.tex);
    gl.uniform1i(U(pComposite, "uScene"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, bloomA.tex);
    gl.uniform1i(U(pComposite, "uBloom"), 1);
    gl.uniform1f(U(pComposite, "uBloomStrength"), C.post.bloomStrength);
    gl.uniform1f(U(pComposite, "uExposure"), C.post.exposure);
    gl.uniform1f(U(pComposite, "uVignette"), C.post.vignette);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  const ro = new ResizeObserver(() => {
    resize();
    if (reduceMotion) draw(t);
  });
  ro.observe(canvas);
  resize();
  raf = requestAnimationFrame(frame);

  function onVisibility() {
    if (document.hidden) {
      cancelAnimationFrame(raf);
    } else if (!disposed && !reduceMotion) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }
  document.addEventListener("visibilitychange", onVisibility);

  return {
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      if (scene) freeTarget(scene);
      if (bloomA) freeTarget(bloomA);
      if (bloomB) freeTarget(bloomB);
      progs.forEach((p) => gl!.deleteProgram(p));
      gl!.deleteBuffer(vbo);
      gl!.deleteVertexArray(vao);
    },
  };
}
