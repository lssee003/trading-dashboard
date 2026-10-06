import { useEffect, useRef, type RefObject } from "react";
import { prefersReducedMotion } from "./tokens";

interface AuraProps {
  rgb: [number, number, number];
  /** Element the ring wraps (the Monitor gauge); null → centred on the window */
  anchor: RefObject<HTMLElement> | null;
  phase: "out" | "pre" | "in";
  /** Changes on every page swap → ring re-grows from small */
  pulse: number;
  dim: number;
}

const CELL = 5;

/**
 * Pixel-dotted aura ring behind the content. Drawn at 1/5 resolution into an
 * ImageData (one pixel per 5px cell), then a blurred copy is screen-blended on
 * top; a 5px dot-grid mask gives the dotted look. ~30fps, paused when hidden.
 */
export function AuraRing(props: AuraProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const bl = useRef<HTMLCanvasElement>(null);
  const live = useRef(props);
  live.current = props;

  const st = useRef({
    scale: 0.06, from: 0.06, t0: 0, col: props.rgb.slice() as number[], dim: props.dim,
    g: null as null | { cx: number; cy: number; rx: number; ry: number },
    W: 0, H: 0, bw: 0, bh: 0,
    ctx: null as CanvasRenderingContext2D | null, bctx: null as CanvasRenderingContext2D | null, img: null as ImageData | null,
  });

  // Page change: shrink-then-grow from wherever the ring currently is
  useEffect(() => {
    const s = st.current;
    s.from = Math.min(s.scale, 0.2);
    s.t0 = performance.now();
  }, [props.pulse]);

  useEffect(() => {
    const s = st.current;
    s.t0 = performance.now();
    const reduced = prefersReducedMotion();

    const resize = () => {
      const el = wrap.current, c1 = cv.current, c2 = bl.current;
      if (!el || !c1 || !c2) return;
      const W = el.offsetWidth, H = el.offsetHeight;
      if (!W || !H) return;
      s.W = W; s.H = H; s.bw = Math.ceil(W / CELL); s.bh = Math.ceil(H / CELL);
      for (const c of [c1, c2]) {
        c.width = s.bw; c.height = s.bh;
        c.style.width = s.bw * CELL + "px"; c.style.height = s.bh * CELL + "px";
      }
      s.ctx = c1.getContext("2d");
      s.bctx = c2.getContext("2d");
      s.img = s.ctx ? s.ctx.createImageData(s.bw, s.bh) : null;
      if (reduced) draw(performance.now());
    };

    const draw = (now: number) => {
      const el = wrap.current;
      if (!s.img || !s.ctx || !s.bctx || !el || !cv.current) return;
      const p = live.current, t = reduced ? 0 : now / 1000;

      if (reduced) s.scale = 1;
      else if (p.phase === "out") { s.scale += (0.12 - s.scale) * 0.35; s.from = s.scale; s.t0 = now; }
      else { const k = Math.min(1, (now - s.t0) / 1000), e = 1 - Math.pow(1 - k, 3); s.scale = s.from + (1 - s.from) * e; }
      const lerp = reduced ? 1 : 0.08;
      for (let i = 0; i < 3; i++) s.col[i] += (p.rgb[i] - s.col[i]) * lerp;
      s.dim += (p.dim - s.dim) * lerp;

      const wr = el.getBoundingClientRect();
      let cx = s.W * 0.5, cy = s.H * 0.52, rx = s.W * 0.5, ry = s.H * 0.56;
      const an = p.anchor && p.anchor.current;
      if (an) {
        const r = an.getBoundingClientRect();
        const z = wr.width / s.W || 1;
        if (r.width) { cx = (r.left + r.width / 2 - wr.left) / z; cy = (r.top + r.height / 2 - wr.top) / z; rx = (r.width / z) * 1.12; ry = (r.height / z) * 0.86; }
      }
      if (!s.g || reduced) s.g = { cx, cy, rx, ry };
      else { const g = s.g, k = 0.14; g.cx += (cx - g.cx) * k; g.cy += (cy - g.cy) * k; g.rx += (rx - g.rx) * k; g.ry += (ry - g.ry) * k; }

      const g = s.g, sc = s.scale, RX = g.rx * sc, RY = g.ry * sc, D = s.img.data, bw = s.bw, bh = s.bh, H = s.H;
      const cr = s.col[0], cg = s.col[1], cb = s.col[2], dim = s.dim * Math.min(1, sc * 1.6);
      for (let j = 0; j < bh; j++) {
        const y = (j + 0.5) * CELL, dy = (y - g.cy) / RY, hz = Math.max(0, y / H - 0.78) / 0.22, hz2 = hz * hz * 0.16;
        for (let i = 0; i < bw; i++) {
          const dx = ((i + 0.5) * CELL - g.cx) / RX, d = Math.sqrt(dx * dx + dy * dy), th = Math.atan2(dy, dx);
          const wob = 1 + 0.075 * Math.sin(3 * th + t * 0.5) + 0.05 * Math.sin(5 * th - t * 0.37 + 1.7) + 0.03 * Math.sin(7 * th + t * 0.9);
          const q = d - wob, w = q < 0 ? 0.24 : 0.13;
          let I = Math.exp(-(q * q) / (w * w)) * (0.8 + 0.2 * Math.sin(11 * th - t * 1.3 + d * 5)) + 0.08 * Math.exp(-(q * q) / 0.6);
          I *= dim * 0.78;
          const hot = I > 0.7 ? (I - 0.7) * 1.1 : 0, k = (j * bw + i) * 4;
          D[k] = Math.min(255, 2 + cr * I + 255 * hot + 255 * hz2);
          D[k + 1] = Math.min(255, 5 + cg * I + 255 * hot + 120 * hz2);
          D[k + 2] = Math.min(255, 11 + cb * I + 255 * hot + 70 * hz2);
          D[k + 3] = 255;
        }
      }
      s.ctx.putImageData(s.img, 0, 0);
      s.bctx.clearRect(0, 0, bw, bh);
      s.bctx.drawImage(cv.current, 0, 0);
    };

    resize();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    if (ro && wrap.current) ro.observe(wrap.current);

    let raf = 0, last = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden || t - last < 33) return;
      last = t;
      draw(t);
    };
    // Reduced motion: no animation loop — redraw only when inputs change (below)
    if (!reduced) raf = requestAnimationFrame(loop);
    redraw.current = reduced ? () => draw(performance.now()) : null;

    return () => { cancelAnimationFrame(raf); ro?.disconnect(); };
  }, []);

  const redraw = useRef<null | (() => void)>(null);
  useEffect(() => { redraw.current?.(); });

  return (
    <div ref={wrap} aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", background: "#02050b" }}>
      <canvas ref={cv} style={{ position: "absolute", left: 0, top: 0, imageRendering: "pixelated" }} />
      <canvas ref={bl} style={{ position: "absolute", left: 0, top: 0, filter: "blur(30px)", opacity: 0.5, mixBlendMode: "screen" }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(2,5,11,.8) 1.2px, transparent 1.2px), linear-gradient(90deg, rgba(2,5,11,.8) 1.2px, transparent 1.2px)", backgroundSize: "5px 5px" }} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(2,5,11,.55) 100%)" }} />
    </div>
  );
}
