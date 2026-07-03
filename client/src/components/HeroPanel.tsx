import { useEffect, useState, useRef } from "react";

interface HeroPanelProps {
  decision: "YES" | "CAUTION" | "NO";
  marketQualityScore: number;
  stance?: string;
}

const DECISION_CONFIG = {
  YES: {
    color: "var(--terminal-green)",
    bg: "var(--decision-green-bg)",
    border: "var(--decision-green-border)",
    glow: "var(--decision-green-glow)",
    label: "TRADE",
    sublabel: "Full position sizing, press risk",
  },
  CAUTION: {
    color: "var(--terminal-amber)",
    bg: "var(--decision-amber-bg)",
    border: "var(--decision-amber-border)",
    glow: "var(--decision-amber-glow)",
    label: "CAUTION",
    sublabel: "Half size, A+ setups only",
  },
  NO: {
    color: "var(--terminal-red)",
    bg: "var(--decision-red-bg)",
    border: "var(--decision-red-border)",
    glow: "var(--decision-red-glow)",
    label: "AVOID",
    sublabel: "Preserve capital, stay patient",
  },
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
}

function CircularScore({ score, color, size = 90 }: { score: number; color: string; size?: number }) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scoreRef = useRef(0);
  const colorRGBRef = useRef<number[]>([255, 255, 255]);
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedScore / 100) * circumference;

  scoreRef.current = animatedScore;

  // Resolve CSS variable to RGB for canvas drawing
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.style.color = color;
    // Wait a frame for the style to compute
    requestAnimationFrame(() => {
      const resolved = getComputedStyle(el).color;
      const match = resolved.match(/\d+/g);
      if (match) colorRGBRef.current = match.slice(0, 3).map(Number);
    });
  }, [color]);

  // Score count-up animation
  useEffect(() => {
    let frame: number;
    let start: number;
    const animate = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 1200, 1);
      setAnimatedScore(Math.round((1 - Math.pow(1 - p, 3)) * score));
      if (p < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  // Particle system + arc tip spark
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const center = size / 2;
    const particles: Particle[] = [];
    let frameId: number;

    const animate = () => {
      ctx.clearRect(0, 0, size, size);
      const currentScore = scoreRef.current;
      const [r, g, b] = colorRGBRef.current;
      const arcSpan = (currentScore / 100) * Math.PI * 2;

      // Spawn particles along the filled arc, biased toward the tip
      if (currentScore > 5 && particles.length < 25 && Math.random() < 0.25) {
        const t = Math.pow(Math.random(), 0.5); // bias toward 1 (tip)
        const angle = -Math.PI / 2 + t * arcSpan;
        const speed = 0.1 + Math.random() * 0.2;
        const drift = angle + (Math.random() - 0.5) * 0.5;
        particles.push({
          x: center + radius * Math.cos(angle),
          y: center + radius * Math.sin(angle),
          vx: Math.cos(drift) * speed,
          vy: Math.sin(drift) * speed,
          life: 1,
          size: 0.4 + Math.random() * 1.2,
        });
      }

      // Update and draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.012 + Math.random() * 0.005;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = p.life * 0.55;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.4 + p.life * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }

      // Arc tip spark (glowing dot at the leading edge)
      if (currentScore > 5) {
        const tipAngle = -Math.PI / 2 + arcSpan;
        const tipX = center + radius * Math.cos(tipAngle);
        const tipY = center + radius * Math.sin(tipAngle);
        const pulse = Math.sin(Date.now() / 400) * 0.5 + 0.5;

        // Outer halo
        ctx.globalAlpha = 0.06 + pulse * 0.06;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.beginPath();
        ctx.arc(tipX, tipY, 9, 0, Math.PI * 2);
        ctx.fill();

        // Mid glow
        ctx.globalAlpha = 0.18 + pulse * 0.12;
        ctx.beginPath();
        ctx.arc(tipX, tipY, 4.5, 0, Math.PI * 2);
        ctx.fill();

        // Bright core
        ctx.globalAlpha = 0.7 + pulse * 0.3;
        ctx.beginPath();
        ctx.arc(tipX, tipY, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [size, radius]);

  return (
    <div
      className="hero-gauge relative flex-shrink-0"
      style={{ width: size, height: size, "--gauge-color": color } as React.CSSProperties}
    >
      <div className="hero-gauge-lights" aria-hidden="true">
        <span className="hero-blob hero-gauge-blob-a" />
        <span className="hero-blob hero-gauge-blob-b" />
      </div>
      <svg viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
        <defs>
          <filter id="arc-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--circle-track)" strokeWidth="4" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="4"
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          filter="url(#arc-glow)"
          style={{ transition: "stroke-dashoffset 0.3s ease" }}
        />
      </svg>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ width: size, height: size }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="hero-score-num text-xl font-black leading-none" style={{ color }}>{animatedScore}</span>
        <span className="hero-score-den text-[8px]" style={{ color: "var(--text-faint)" }}>/ 100</span>
      </div>
    </div>
  );
}

export function HeroPanel({ decision, marketQualityScore, stance }: HeroPanelProps) {
  const config = DECISION_CONFIG[decision];
  const sublabel = stance
    ? stance.replace(/^[^—]+—\s*/, "")
    : config.sublabel;

  return (
    <div
      className="rounded-lg border p-4 h-full flex items-center relative overflow-hidden glass-panel glass-tint"
      style={{ background: config.bg, borderColor: config.border }}
      data-testid="hero-panel"
    >
      {/* Heatmap glow centered on the score gauge (light/dark only) */}
      <div
        className="absolute inset-0 pointer-events-none hero-glow"
        style={{
          background: `radial-gradient(ellipse at 78% 50%, ${config.glow} 0%, transparent 60%)`,
        }}
      />

      {/* Verdict light field (glass only): the hue drifts as blurred
          plus-lighter blobs inside the neutral glass slab */}
      <div
        className="hero-lights"
        aria-hidden="true"
        style={{ "--blob-color": config.color } as React.CSSProperties}
      >
        <span className="hero-blob hero-blob-a" />
        <span className="hero-blob hero-blob-b" />
        <span className="hero-blob hero-blob-c" />
      </div>

      <div className="flex items-center gap-4 w-full relative z-10">
        <div className="flex-1">
          <p className="text-[10px] font-medium tracking-widest uppercase mb-1" style={{ color: "var(--text-muted)" }}>
            Should I Be Trading?
          </p>
          <span
            className="hero-verdict text-3xl md:text-4xl font-black tracking-tight leading-none block"
            style={{ color: config.color }}
            data-testid="decision-badge"
          >
            {config.label}
          </span>
          <p className="text-[11px] mt-1.5" style={{ color: "var(--text-muted)" }}>{sublabel}</p>
        </div>

        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <CircularScore score={marketQualityScore} color={config.color} size={88} />
          <span className="text-[9px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Market Quality</span>
        </div>
      </div>
    </div>
  );
}
