/**
 * StarfieldEngine — a genuinely static field of stars on a plain Canvas2D
 * context (no WebGL, no shader). Positions are fixed at generation time and
 * never move; the only motion is per-star opacity twinkle. No drift, no
 * parallax, no sweeping highlight, no colored light fields — those all read
 * as "glowing blob" no matter how softened. This is meant to read as an
 * actual night sky: still, with stars blinking.
 *
 * The nebula haze lives entirely in CSS (`.glass body`, index.css) since it
 * doesn't move either — painting it in JS would just be a slower way to
 * draw something static.
 */
import { StarfieldConfig } from "./config";

interface Star {
  x: number; // device px, fixed
  y: number;
  r: number; // radius, device px
  baseAlpha: number;
  speed: number; // twinkle speed
  phase: number;
  warm: boolean; // faint color variation, like real starlight
  flare: number; // 0 = never flares, >0 = occasional brighter pulse
  flareSeed: number;
}

export class StarfieldEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly config: StarfieldConfig;
  private readonly reduced: boolean;
  private ctx!: CanvasRenderingContext2D;

  private stars: Star[] = [];
  private dpr = 1;

  private running = false;
  private raf = 0;
  private lastFrameT = 0;
  private startT = 0;

  private onResize = () => this.resize();
  private onVis = () => {
    if (document.hidden) {
      this.running = false;
    } else if (!this.reduced) {
      this.running = true;
      this.startLoop();
    }
  };

  constructor(canvas: HTMLCanvasElement, config: StarfieldConfig) {
    this.canvas = canvas;
    this.config = config;
    this.reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  start() {
    const ctx = this.canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("Canvas2D unavailable");
    this.ctx = ctx;
    this.startT = performance.now();

    window.addEventListener("resize", this.onResize);
    document.addEventListener("visibilitychange", this.onVis);

    this.resize();

    if (this.reduced) {
      this.draw(0);
      return;
    }
    this.running = true;
    this.startLoop();
  }

  dispose() {
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("visibilitychange", this.onVis);
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
  }

  private resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, this.config.dprCap);
    const w = window.innerWidth, h = window.innerHeight;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.seed();
    if (this.reduced || !this.running) this.draw(performance.now() - this.startT);
  }

  private seed() {
    const w = this.canvas.width, h = this.canvas.height;
    const area = (w / this.dpr) * (h / this.dpr);
    const count = Math.round(Math.min(340, Math.max(90, (area / (1920 * 1080)) * this.config.baseCount)));
    this.stars = Array.from({ length: count }, () => {
      // size distribution skewed toward small/dim, a few larger "hero" stars
      const sizeRoll = Math.random();
      const r = (sizeRoll > 0.94 ? 2.1 + Math.random() * 1.4 : sizeRoll > 0.75 ? 1.2 + Math.random() * 0.8 : 0.6 + Math.random() * 0.5) * this.dpr;
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        r,
        baseAlpha: 0.55 + Math.random() * 0.45,
        speed: 0.2 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
        warm: Math.random() < 0.18,
        flare: Math.random() < 0.14 ? 1 : 0,
        flareSeed: Math.random() * 1000,
      };
    });
  }

  private startLoop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    const step = (t: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(step);
      const frameBudget = 1000 / this.config.maxFps;
      if (t - this.lastFrameT < frameBudget) return;
      this.lastFrameT = t;
      this.draw(t - this.startT);
    };
    this.raf = requestAnimationFrame(step);
  }

  private draw(elapsedMs: number) {
    const ctx = this.ctx;
    const w = this.canvas.width, h = this.canvas.height;
    const t = elapsedMs * 0.001;
    ctx.clearRect(0, 0, w, h);

    for (const s of this.stars) {
      let a = s.baseAlpha;
      if (!this.reduced) {
        a *= 0.5 + 0.5 * Math.sin(t * s.speed + s.phase);
        if (s.flare) {
          const cyc = ((t * 0.16 + s.flareSeed) % 1 + 1) % 1;
          const spark = Math.exp(-Math.pow((cyc - 0.5) * 8.0, 2));
          a = Math.min(1, a + spark * 0.85);
        }
      } else {
        a *= 0.85; // settled mid-brightness frame
      }
      a = Math.max(0, Math.min(1, a));
      const fill = s.warm ? "255, 236, 214" : "226, 232, 245";
      ctx.fillStyle = `rgba(${fill}, 1)`;

      // crisp point, not a blurred disc — a soft radial fill is what reads
      // as a glowing orb. Real bright stars read as a tight core plus thin
      // diffraction spikes, not a bigger blob, so that's what the ~4% of
      // "hero" stars get instead of scaling the fill radius up.
      const isHero = s.r > 1.9 * this.dpr;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(s.x, s.y, isHero ? s.r * 0.55 : s.r, 0, Math.PI * 2);
      ctx.fill();

      if (isHero) {
        const spike = s.r * 2.6;
        ctx.globalAlpha = a * 0.5;
        ctx.strokeStyle = `rgba(${fill}, 1)`;
        ctx.lineWidth = Math.max(1, this.dpr * 0.6);
        ctx.beginPath();
        ctx.moveTo(s.x - spike, s.y);
        ctx.lineTo(s.x + spike, s.y);
        ctx.moveTo(s.x, s.y - spike);
        ctx.lineTo(s.x, s.y + spike);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
}
