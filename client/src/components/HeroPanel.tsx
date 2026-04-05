import { useEffect, useState } from "react";

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
    label: "TRADE",
    sublabel: "Full position sizing, press risk",
  },
  CAUTION: {
    color: "var(--terminal-amber)",
    bg: "var(--decision-amber-bg)",
    border: "var(--decision-amber-border)",
    label: "CAUTION",
    sublabel: "Half size, A+ setups only",
  },
  NO: {
    color: "var(--terminal-red)",
    bg: "var(--decision-red-bg)",
    border: "var(--decision-red-border)",
    label: "AVOID",
    sublabel: "Preserve capital, stay patient",
  },
};

function CircularScore({ score, color, size = 90 }: { score: number; color: string; size?: number }) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedScore / 100) * circumference;

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

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--circle-track)" strokeWidth="4" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="4"
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.3s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-black leading-none" style={{ color }}>{animatedScore}</span>
        <span className="text-[8px] opacity-30">/ 100</span>
      </div>
    </div>
  );
}

export function HeroPanel({ decision, marketQualityScore, stance }: HeroPanelProps) {
  const config = DECISION_CONFIG[decision];
  // Extract the readable part after the em dash, or fall back to hardcoded sublabel
  const sublabel = stance
    ? stance.replace(/^[^—]+—\s*/, "")
    : config.sublabel;

  return (
    <div
      className="rounded-lg border p-4 h-full flex items-center"
      style={{ background: config.bg, borderColor: config.border }}
      data-testid="hero-panel"
    >
      <div className="flex items-center gap-4 w-full">
        <div className="flex-1">
          <p className="text-[10px] font-medium opacity-40 tracking-widest uppercase mb-1">
            Should I Be Trading?
          </p>
          <span
            className="text-3xl md:text-4xl font-black tracking-tight leading-none block"
            style={{ color: config.color }}
            data-testid="decision-badge"
          >
            {config.label}
          </span>
          <p className="text-[11px] opacity-40 mt-1.5">{sublabel}</p>
        </div>

        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <CircularScore score={marketQualityScore} color={config.color} size={88} />
          <span className="text-[9px] opacity-30 uppercase tracking-wider">Market Quality</span>
        </div>
      </div>
    </div>
  );
}
