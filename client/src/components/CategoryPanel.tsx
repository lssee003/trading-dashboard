import { useState, useRef, useLayoutEffect } from "react";
import type { CategoryScore, DashboardData } from "@shared/schema";
import { Shield, TrendingUp, BarChart3, Rocket, Landmark } from "lucide-react";
import { Tooltip } from "./Tooltip";
import { tooltipContent } from "../data/tooltipContent";

const CATEGORY_DELAY: Record<string, number> = {
  Volatility: 1,
  Trend: 2,
  Breadth: 3,
  Momentum: 4,
  Macro: 5,
};

const CATEGORY_ICONS: Record<string, typeof Shield> = {
  Volatility: Shield,
  Trend: TrendingUp,
  Breadth: BarChart3,
  Momentum: Rocket,
  Macro: Landmark,
};

const SIGNAL_COLORS: Record<string, string> = {
  bullish: "var(--terminal-green)",
  bearish: "var(--terminal-red)",
  neutral: "var(--terminal-amber)",
};

const DIRECTION_ARROWS: Record<string, string> = {
  up: "↑",
  down: "↓",
  flat: "→",
};

function getScoreColor(score: number): string {
  if (score >= 70) return "var(--terminal-green)";
  if (score >= 50) return "var(--terminal-amber)";
  return "var(--terminal-red)";
}

function getScoreLabel(score: number): string {
  if (score >= 70) return "HEALTHY";
  if (score >= 50) return "NEUTRAL";
  if (score >= 35) return "WEAKENING";
  return "RISK-OFF";
}

const OVERSOLD_TOOLTIP = "Extreme oversold. Historically signals a sharp 3–5 day reflex bounce as selling exhausts. Not a trend reversal signal on its own — watch for follow-through before changing bias.";

function OversoldDot() {
  const [visible, setVisible] = useState(false);

  return (
    <span className="relative inline-flex items-center" style={{ marginLeft: "3px" }}>
      <span
        className="pulse-live inline-block w-1.5 h-1.5 rounded-full cursor-help"
        style={{ background: "var(--terminal-amber)" }}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        data-testid="oversold-alert"
      />
      {visible && (
        <span
          className="absolute z-50 rounded-md text-left pointer-events-none"
          style={{
            bottom: "calc(100% + 10px)",
            left: "50%",
            transform: "translateX(-50%)",
            width: "240px",
            padding: "10px 12px",
            fontSize: "10.5px",
            lineHeight: "1.55",
            fontFamily: "inherit",
            letterSpacing: "0.01em",
            background: "var(--terminal-surface)",
            border: "1px solid var(--alert-amber-border)",
            color: "var(--text-primary)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.9)",
          }}
        >
          <span style={{ display: "block", fontWeight: 700, color: "var(--terminal-amber)", marginBottom: "4px", fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Extreme Oversold
          </span>
          {OVERSOLD_TOOLTIP.replace("Extreme oversold. ", "")}
        </span>
      )}
    </span>
  );
}

function getBurstSignal(ratio: number): "bullish" | "neutral" | "bearish" {
  if (ratio >= 1.5) return "bullish";
  if (ratio >= 0.8) return "neutral";
  return "bearish";
}

type BurstData = NonNullable<DashboardData["burst"]>;
type Momentum20dData = NonNullable<DashboardData["momentum20d"]>;
type BreadthToggleData = NonNullable<DashboardData["breadthToggle"]>;

const STATE_COLORS: Record<string, string> = {
  FROTHY: "var(--terminal-red)",
  CAPITULATION: "var(--terminal-green)",
  LOW_ACTIVITY: "var(--terminal-dim)",
  NORMAL: "var(--terminal-amber)",
};

const STATE_LABELS: Record<string, string> = {
  FROTHY: "Frothy",
  CAPITULATION: "Capitulation",
  LOW_ACTIVITY: "Low Activity",
  NORMAL: "Normal",
};

function PillToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderStyle, setSliderStyle] = useState<React.CSSProperties>({ opacity: 0 });
  const activeIndex = options.findIndex((o) => o.value === value);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const buttons = container.querySelectorAll<HTMLButtonElement>("button");
    const activeBtn = buttons[activeIndex];
    if (!activeBtn) return;
    setSliderStyle({
      transform: `translateX(${activeBtn.offsetLeft}px)`,
      width: activeBtn.offsetWidth,
      height: activeBtn.offsetHeight,
      opacity: 1,
    });
  }, [activeIndex]);

  return (
    <div
      ref={containerRef}
      className="relative flex rounded overflow-hidden"
      style={{ border: "1px solid var(--terminal-border)" }}
    >
      <div
        className="pill-toggle-slider absolute top-0 left-0 rounded"
        style={{
          background: "var(--terminal-surface-2)",
          ...sliderStyle,
          transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), width 0.25s ease, opacity 0.2s ease",
        }}
      />
      {options.map((opt) => (
        <button
          key={opt.label}
          onClick={() => onChange(opt.value)}
          className="relative z-10 px-1.5 py-0 font-bold transition-colors duration-200"
          style={{
            fontSize: "9px",
            lineHeight: "18px",
            background: "transparent",
            color: opt.value === value ? "var(--text-primary)" : "var(--terminal-dim)",
            cursor: "pointer",
            border: "none",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function BurstRow({ burst }: { burst: BurstData }) {
  const [view, setView] = useState<"5d" | "10d">("10d");
  const d = burst.data[view];
  const signal = getBurstSignal(d.ratio);
  const color = SIGNAL_COLORS[signal];

  return (
    <div className="text-xs min-w-0">
      <div className="flex items-center justify-between gap-1 min-w-0">
        {/* Left: Label + Toggle */}
        <span className="flex items-center gap-1.5 flex-shrink-0 min-w-0" style={{ color: 'var(--text-muted)' }}>
          <span
            className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: color }}
          />
          {tooltipContent["4% Burst (10d)"] ? (
            <Tooltip text={tooltipContent["4% Burst (10d)"].text} title={tooltipContent["4% Burst (10d)"].title}>
              <span className="truncate">4% Burst</span>
            </Tooltip>
          ) : (
            <span className="truncate">4% Burst</span>
          )}
          <PillToggle
            options={[
              { label: "5D", value: "5d" as const },
              { label: "10D", value: "10d" as const },
            ]}
            value={view}
            onChange={setView}
          />
        </span>

        {/* Right: Rolling counts + Ratio + Arrow (flush right) */}
        <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
          <span
            className="font-medium whitespace-nowrap transition-all duration-300"
            style={{ color, opacity: 0.65, fontSize: "10px" }}
          >
            ↑{d.breakouts}/↓{d.breakdowns}
          </span>
          <span
            className="font-medium whitespace-nowrap transition-all duration-300"
            style={{ color }}
          >
            {d.ratio.toFixed(2)}x
          </span>
          <span className="flex-shrink-0" style={{ color }}>
            {d.ratio >= 1.0 ? "↑" : "↓"}
          </span>
        </div>
      </div>
    </div>
  );
}

function Momentum20dRow({ data }: { data: Momentum20dData }) {
  const color = STATE_COLORS[data.state] || "var(--terminal-dim)";
  const label = STATE_LABELS[data.state] || "Normal";
  const arrow = data.state === "FROTHY" ? "↑" : data.state === "CAPITULATION" ? "↓" : "→";

  return (
    <div className="text-xs min-w-0">
      <div className="flex items-center justify-between gap-1 min-w-0">
        {/* Left: Label */}
        <span className="flex items-center gap-1 flex-shrink-0 min-w-0" style={{ color: 'var(--text-muted)' }}>
          <span
            className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: color }}
          />
          {tooltipContent["10% Study"] ? (
            <Tooltip text={tooltipContent["10% Study"].text} title={tooltipContent["10% Study"].title}>
              <span className="truncate">10% Study</span>
            </Tooltip>
          ) : (
            <span className="truncate">10% Study</span>
          )}
        </span>

        {/* Right: Descriptive + Number + Arrow (flush right) */}
        <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
          <span
            className="font-medium whitespace-nowrap"
            style={{ color, opacity: 0.65, fontSize: "10px" }}
          >
            {label}
          </span>
          <span
            className="font-medium whitespace-nowrap"
            style={{ color }}
          >
            {data.percentUp.toFixed(1)}%↑/{data.percentDown.toFixed(1)}%↓
          </span>
          <span className="flex-shrink-0" style={{ color }}>
            {arrow}
          </span>
        </div>
      </div>
    </div>
  );
}

function BreadthToggleRow({ data }: { data: BreadthToggleData }) {
  const [view, setView] = useState<"mth" | "qtr">("qtr");
  const d = data.data[view];
  const signal: "bullish" | "neutral" | "bearish" =
    d.net > 0 ? "bullish" : d.net > -30 ? "neutral" : "bearish";
  const color = SIGNAL_COLORS[signal];
  const label = d.net > 50 ? "Healthy" : d.net > 0 ? "Positive" : d.net > -50 ? "Caution" : "High-risk";

  return (
    <div className="text-xs min-w-0">
      <div className="flex items-center justify-between gap-1 min-w-0">
        {/* Left: Label + Toggle */}
        <span className="flex items-center gap-1.5 flex-shrink-0 min-w-0" style={{ color: 'var(--text-muted)' }}>
          <span
            className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: color }}
          />
          {tooltipContent["Qtrly Breadth"] ? (
            <Tooltip text={tooltipContent["Qtrly Breadth"].text} title={tooltipContent["Qtrly Breadth"].title}>
              <span className="truncate">Breadth</span>
            </Tooltip>
          ) : (
            <span className="truncate">Breadth</span>
          )}
          <PillToggle
            options={[
              { label: "MTH", value: "mth" as const },
              { label: "QTR", value: "qtr" as const },
            ]}
            value={view}
            onChange={setView}
          />
        </span>

        {/* Right: Up/Down + Net + Arrow (flush right) */}
        <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
          <span
            className="font-medium whitespace-nowrap transition-all duration-300"
            style={{ color, opacity: 0.65, fontSize: "10px" }}
          >
            ↑{d.up}/↓{d.down}
          </span>
          <span
            className="font-medium whitespace-nowrap transition-all duration-300"
            style={{ color }}
          >
            {d.net > 0 ? "+" : ""}{d.net}
          </span>
          <span className="flex-shrink-0" style={{ color }}>
            {d.net > 0 ? "↑" : "↓"}
          </span>
        </div>
      </div>
    </div>
  );
}

interface CategoryPanelProps {
  category: CategoryScore;
  burst?: BurstData;
  momentum20d?: Momentum20dData;
  breadthToggle?: BreadthToggleData;
}

export function CategoryPanel({ category, burst, momentum20d, breadthToggle }: CategoryPanelProps) {
  const Icon = CATEGORY_ICONS[category.name] || Shield;
  const scoreColor = getScoreColor(category.score);
  const scoreLabel = getScoreLabel(category.score);

  return (
    <div
      className="category-panel rounded-lg p-3 flex flex-col"
      data-testid={`panel-${category.name.toLowerCase()}`}
    >
      {/* Header — scan-line + signal glow */}
      <div
        className="flex items-center justify-between mb-2 rounded-sm px-1.5 py-1 -mx-1.5 -mt-1 category-header-glow section-header-scan"
        style={{ "--signal-glow": scoreColor, "--scan-color": `${scoreColor}18` } as React.CSSProperties}
      >
        <div className="flex items-center gap-2">
          <Icon
            className={`w-3.5 h-3.5 icon-power-on icon-power-on-d${CATEGORY_DELAY[category.name] || 1}`}
            style={{ color: scoreColor, "--icon-glow": scoreColor } as React.CSSProperties}
          />
          <span className="text-xs font-bold tracking-wider uppercase" style={{ color: 'var(--text-secondary)' }}>{category.name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold" style={{ color: scoreColor }}>
            {category.score}
          </span>
          <span
            className="text-xs px-1.5 py-0.5 rounded font-medium"
            style={{ background: `${scoreColor}15`, color: scoreColor, fontSize: "10px" }}
          >
            {scoreLabel}
          </span>
        </div>
      </div>

      {/* Score bar */}
      <div className="h-1 rounded-full mb-2" style={{ background: "var(--bar-track)" }}>
        <div
          className="glass-bar h-full rounded-full transition-all duration-700"
          style={{ width: `${category.score}%`, background: scoreColor, "--bar-color": scoreColor, "--bar-span": category.score } as React.CSSProperties}
        />
      </div>

      {/* Details — flex-1 + justify-between fills vertical space evenly */}
      <div className="flex flex-col justify-between flex-1 gap-0.5">
        {category.details.map((detail, idx) => {
          // Render interactive burst row if flagged and burst data available
          if (detail.burstToggle && burst) {
            return <BurstRow key={idx} burst={burst} />;
          }

          // Render 20% Study row with state badge
          if (detail.momentum20dToggle && momentum20d) {
            return <Momentum20dRow key={idx} data={momentum20d} />;
          }

          // Render Monthly/Quarterly breadth toggle row
          if (detail.breadthToggleFlag && breadthToggle) {
            return <BreadthToggleRow key={idx} data={breadthToggle} />;
          }

          const parts = detail.value.split("  ");
          const mainVal = parts[0];
          const qualifier = parts[1] || null;

          return (
            <div key={idx} className="flex items-center justify-between text-xs gap-1 min-w-0">
              {/* Left: Label */}
              <span className="flex items-center gap-1 flex-shrink-0 min-w-0" style={{ color: 'var(--text-muted)' }}>
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: SIGNAL_COLORS[detail.signal] || "var(--terminal-dim)" }}
                />
                {tooltipContent[detail.label] ? (
                  <Tooltip text={tooltipContent[detail.label].text} title={tooltipContent[detail.label].title}>
                    <span className="truncate">{detail.label}</span>
                  </Tooltip>
                ) : (
                  <span className="truncate">{detail.label}</span>
                )}
                {detail.oversoldAlert && <OversoldDot />}
              </span>

              {/* Right: Qualifier + Number + Arrow (flush right) */}
              <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
                {qualifier && (
                  <span
                    className="font-medium truncate"
                    style={{
                      color: SIGNAL_COLORS[detail.signal] || "inherit",
                      opacity: 0.65,
                      fontSize: "10px",
                      maxWidth: "80px",
                    }}
                  >
                    {qualifier}
                  </span>
                )}
                <span
                  className="font-medium whitespace-nowrap"
                  style={{ color: SIGNAL_COLORS[detail.signal] || "inherit" }}
                >
                  {mainVal}
                </span>
                <span
                  className="flex-shrink-0"
                  style={{ color: SIGNAL_COLORS[detail.signal] || "var(--terminal-dim)" }}
                >
                  {DIRECTION_ARROWS[detail.direction] || ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Weight indicator */}
      <div className="mt-2 pt-2 flex items-center justify-between text-xs" style={{ borderTop: "1px solid var(--terminal-border)" }}>
        <span style={{ color: 'var(--text-faint)' }}>Weight</span>
        <span className="font-medium" style={{ color: 'var(--text-muted)' }}>{category.weight}%</span>
      </div>
    </div>
  );
}
