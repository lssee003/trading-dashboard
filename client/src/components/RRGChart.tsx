import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import type { RRGTicker, Quadrant } from "@/lib/rrg";
import { QUADRANT_META } from "@/lib/rrg";

interface RRGChartProps {
  data: RRGTicker[];
  benchmark: string;
  lookback: number;
}

const PADDING = { top: 44, right: 268, bottom: 52, left: 58 };
const SIDEBAR_WIDTH = PADDING.right - 10; // 258px
const RIGHT_PAD_COLLAPSED = 20;
const MIN_CHART_HEIGHT = 560;

// ─── Strict 10% buffer, pure data-driven bounds ───
function fitRange(min: number, max: number): [number, number] {
  const span = max - min || 2;
  const pad = span * 0.1;
  return [min - pad, max + pad];
}

function generateTicks(min: number, max: number, step: number): number[] {
  const ticks: number[] = [];
  const start = Math.ceil(min / step) * step;
  for (let v = start; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 10) / 10);
  return ticks;
}

function pickStep(span: number): number {
  if (span <= 4) return 0.5;
  if (span <= 8) return 1;
  return 2;
}

const QUADRANT_BG_COLOR: Record<Quadrant, string> = {
  leading:   "#22c55e",
  weakening: "#eab308",
  lagging:   "#ef4444",
  improving: "#3b82f6",
};

const QUADRANT_LABEL_COLOR: Record<Quadrant, string> = {
  leading:   "#86efac",
  weakening: "#fde68a",
  lagging:   "#fca5a5",
  improving: "#93c5fd",
};

interface TooltipState {
  ticker: RRGTicker;
  x: number;
  y: number;
}

export function RRGChart({ data, benchmark, lookback }: RRGChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hiddenSymbols, setHiddenSymbols] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isMobile = width < 640;
  // On mobile, sidebar floats as overlay so chart always uses full width.
  // On desktop, sidebar pushes chart when open.
  const sidebarAsOverlay = isMobile && sidebarOpen;
  const rightPad = sidebarOpen && !sidebarAsOverlay ? PADDING.right : RIGHT_PAD_COLLAPSED;
  const svgWidth = sidebarOpen && !sidebarAsOverlay ? width - (SIDEBAR_WIDTH - 10) : width;

  const chartW = Math.max(width - PADDING.left - rightPad, 100);
  const chartH = MIN_CHART_HEIGHT - PADDING.top - PADDING.bottom;

  const visibleData = useMemo(
    () => data.filter((t) => !hiddenSymbols.has(t.symbol)),
    [data, hiddenSymbols],
  );

  // ─── Best-fit axis domain from visible data ───
  const { xDomain, yDomain, xTicks, yTicks } = useMemo(() => {
    const source = visibleData.length > 0 ? visibleData : data;
    if (source.length === 0) {
      return {
        xDomain: [97, 103] as [number, number],
        yDomain: [97, 103] as [number, number],
        xTicks: generateTicks(97, 103, 1),
        yTicks: generateTicks(97, 103, 1),
      };
    }

    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    for (const t of source) {
      for (const p of t.trail) {
        if (p.x < xMin) xMin = p.x;
        if (p.x > xMax) xMax = p.x;
        if (p.y < yMin) yMin = p.y;
        if (p.y > yMax) yMax = p.y;
      }
    }

    const xd = fitRange(xMin, xMax);
    const yd = fitRange(yMin, yMax);
    const xStep = pickStep(xd[1] - xd[0]);
    const yStep = pickStep(yd[1] - yd[0]);

    return {
      xDomain: xd,
      yDomain: yd,
      xTicks: generateTicks(xd[0], xd[1], xStep),
      yTicks: generateTicks(yd[0], yd[1], yStep),
    };
  }, [visibleData, data]);

  const scaleX = useCallback(
    (v: number) => PADDING.left + ((v - xDomain[0]) / (xDomain[1] - xDomain[0])) * chartW,
    [xDomain, chartW],
  );
  const scaleY = useCallback(
    (v: number) => PADDING.top + ((yDomain[1] - v) / (yDomain[1] - yDomain[0])) * chartH,
    [yDomain, chartH],
  );

  // 100/100 crosshair — may be off-screen if data doesn't include it
  const cx = scaleX(100);
  const cy = scaleY(100);
  const crosshairVisible = {
    x: cx >= PADDING.left && cx <= PADDING.left + chartW,
    y: cy >= PADDING.top && cy <= PADDING.top + chartH,
  };

  const handleDotEnter = useCallback((ticker: RRGTicker, screenX: number, screenY: number) => {
    setHoveredSymbol(ticker.symbol);
    setTooltip({ ticker, x: screenX, y: screenY });
  }, []);

  const handleDotLeave = useCallback(() => {
    setHoveredSymbol(null);
    setTooltip(null);
  }, []);

  const toggleSymbol = useCallback((symbol: string) => {
    setHiddenSymbols((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  }, []);

  const allChecked = hiddenSymbols.size === 0;
  const toggleAll = useCallback(() => {
    setHiddenSymbols(allChecked ? new Set(data.map((t) => t.symbol)) : new Set());
  }, [allChecked, data]);

  // ─── Compute quadrant rect bounds in screen coords ───
  const chartLeft = PADDING.left;
  const chartRight = PADDING.left + chartW;
  const chartTop = PADDING.top;
  const chartBottom = PADDING.top + chartH;

  // Clamp crosshair for splitting quadrant backgrounds
  const splitX = Math.max(chartLeft, Math.min(chartRight, cx));
  const splitY = Math.max(chartTop, Math.min(chartBottom, cy));

  return (
    <div
      ref={containerRef}
      className="rounded-lg border overflow-hidden"
      style={{ background: "var(--terminal-surface)", borderColor: "var(--terminal-border)" }}
    >
      {/* Title Bar */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{ borderColor: "var(--terminal-border)", background: "var(--overlay-subtle)" }}
      >
        <div>
          <span className="text-[12px] font-bold tracking-wider" style={{ color: "var(--text-primary)" }}>
            Relative Rotation Graph
          </span>
          <span className="text-[12px] font-bold ml-1.5" style={{ color: "var(--terminal-cyan)" }}>(RRG)</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            vs {benchmark} · {lookback}D window
          </span>
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="flex items-center justify-center rounded"
            style={{
              width: 22, height: 22,
              background: "var(--overlay-subtle)",
              border: "1px solid var(--terminal-border)",
              color: "var(--text-muted)",
              cursor: "pointer",
              flexShrink: 0,
            }}
            title={sidebarOpen ? "Hide sectors panel" : "Show sectors panel"}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              {sidebarOpen ? (
                <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      <div className="flex relative">
        {/* ─── Chart ─── */}
        <div className="flex-1 relative" style={{ minHeight: MIN_CHART_HEIGHT }}>
          <svg width={svgWidth} height={MIN_CHART_HEIGHT} style={{ display: "block" }}>
            <defs>
              {/* Radial gradients for each quadrant — origin at 100/100 crosshair */}
              {(["improving", "leading", "lagging", "weakening"] as Quadrant[]).map((q) => (
                <radialGradient
                  key={`rg-${q}`}
                  id={`rg-${q}`}
                  gradientUnits="userSpaceOnUse"
                  cx={cx}
                  cy={cy}
                  r={Math.max(chartW, chartH) * 0.9}
                >
                  <stop offset="0%" stopColor={QUADRANT_BG_COLOR[q]} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={QUADRANT_BG_COLOR[q]} stopOpacity={0.03} />
                </radialGradient>
              ))}

              {/* Per-ticker trail gradient IDs are built inline */}
              <clipPath id="chart-clip">
                <rect x={PADDING.left} y={PADDING.top} width={chartW} height={chartH} />
              </clipPath>
            </defs>

            {/* ─── Quadrant Backgrounds (radial gradient) ─── */}
            {/* Improving: top-left */}
            <rect x={chartLeft} y={chartTop} width={splitX - chartLeft} height={splitY - chartTop}
              fill="url(#rg-improving)" />
            {/* Leading: top-right */}
            <rect x={splitX} y={chartTop} width={chartRight - splitX} height={splitY - chartTop}
              fill="url(#rg-leading)" />
            {/* Lagging: bottom-left */}
            <rect x={chartLeft} y={splitY} width={splitX - chartLeft} height={chartBottom - splitY}
              fill="url(#rg-lagging)" />
            {/* Weakening: bottom-right */}
            <rect x={splitX} y={splitY} width={chartRight - splitX} height={chartBottom - splitY}
              fill="url(#rg-weakening)" />

            {/* ─── Quadrant Labels ─── */}
            <text x={chartLeft + 14} y={chartTop + 22} fontSize={12}
              fill={QUADRANT_LABEL_COLOR.improving} opacity={0.9} fontWeight={800} letterSpacing={1.8}>IMPROVING</text>
            <text x={chartRight - 14} y={chartTop + 22} fontSize={12}
              fill={QUADRANT_LABEL_COLOR.leading} opacity={0.9} fontWeight={800} letterSpacing={1.8} textAnchor="end">LEADING</text>
            <text x={chartLeft + 14} y={chartBottom - 10} fontSize={12}
              fill={QUADRANT_LABEL_COLOR.lagging} opacity={0.9} fontWeight={800} letterSpacing={1.8}>LAGGING</text>
            <text x={chartRight - 14} y={chartBottom - 10} fontSize={12}
              fill={QUADRANT_LABEL_COLOR.weakening} opacity={0.9} fontWeight={800} letterSpacing={1.8} textAnchor="end">WEAKENING</text>

            {/* ─── Gridlines (theme-aware) ─── */}
            {xTicks.filter((v) => v !== 100).map((v) => (
              <line key={`xg-${v}`}
                x1={scaleX(v)} y1={chartTop} x2={scaleX(v)} y2={chartBottom}
                style={{ stroke: "var(--terminal-border)" }} strokeWidth={0.75} opacity={0.6} />
            ))}
            {yTicks.filter((v) => v !== 100).map((v) => (
              <line key={`yg-${v}`}
                x1={chartLeft} y1={scaleY(v)} x2={chartRight} y2={scaleY(v)}
                style={{ stroke: "var(--terminal-border)" }} strokeWidth={0.75} opacity={0.6} />
            ))}

            {/* ─── 100-mark crosshairs (brighter, solid) ─── */}
            {crosshairVisible.x && (
              <line x1={cx} y1={chartTop} x2={cx} y2={chartBottom}
                style={{ stroke: "var(--text-muted)" }} strokeWidth={1.2} opacity={0.7} />
            )}
            {crosshairVisible.y && (
              <line x1={chartLeft} y1={cy} x2={chartRight} y2={cy}
                style={{ stroke: "var(--text-muted)" }} strokeWidth={1.2} opacity={0.7} />
            )}

            {/* ─── X Axis ─── */}
            {xTicks.map((v) => (
              <g key={`xt-${v}`}>
                <line x1={scaleX(v)} y1={chartBottom} x2={scaleX(v)} y2={chartBottom + 5}
                  style={{ stroke: "var(--text-muted)" }} strokeWidth={0.75} />
                <text x={scaleX(v)} y={chartBottom + 17} textAnchor="middle" fontSize={10}
                  style={{ fill: v === 100 ? "var(--text-primary)" : "var(--text-muted)" }}
                  fontWeight={v === 100 ? 700 : 400}>
                  {v}
                </text>
              </g>
            ))}
            <text x={chartLeft + chartW / 2} y={MIN_CHART_HEIGHT - 6} textAnchor="middle"
              fontSize={11} style={{ fill: "var(--text-muted)" }} fontWeight={500} letterSpacing={0.5}>
              RS-Ratio →
            </text>

            {/* ─── Y Axis ─── */}
            {yTicks.map((v) => (
              <g key={`yt-${v}`}>
                <line x1={chartLeft - 5} y1={scaleY(v)} x2={chartLeft} y2={scaleY(v)}
                  style={{ stroke: "var(--text-muted)" }} strokeWidth={0.75} />
                <text x={chartLeft - 9} y={scaleY(v) + 3.5} textAnchor="end" fontSize={10}
                  style={{ fill: v === 100 ? "var(--text-primary)" : "var(--text-muted)" }}
                  fontWeight={v === 100 ? 700 : 400}>
                  {v}
                </text>
              </g>
            ))}
            <text x={16} y={chartTop + chartH / 2} textAnchor="middle" fontSize={11}
              style={{ fill: "var(--text-muted)" }} fontWeight={500} letterSpacing={0.5}
              transform={`rotate(-90, 16, ${chartTop + chartH / 2})`}>
              RS-Momentum →
            </text>

            {/* ─── Chart Border ─── */}
            <rect x={chartLeft} y={chartTop} width={chartW} height={chartH}
              fill="none" style={{ stroke: "var(--terminal-border)" }} strokeWidth={1.5} />

            {/* ─── Trails (tapering opacity via segments) ─── */}
            <g clipPath="url(#chart-clip)">
              {visibleData.map((ticker) => {
                const isHovered = hoveredSymbol === ticker.symbol;
                const isDimmed = hoveredSymbol !== null && !isHovered;
                const masterOpacity = isDimmed ? 0.1 : 1;
                if (ticker.trail.length < 2) return null;
                const current = ticker.trail[ticker.trail.length - 1];
                const n = ticker.trail.length;

                return (
                  <g key={ticker.symbol} opacity={masterOpacity}>
                    {/* Tapering trail segments: oldest ~0.15 opacity → newest ~0.85, curved via catmull-rom */}
                    {ticker.trail.slice(0, -1).map((p, i) => {
                      const next = ticker.trail[i + 1];
                      // catmull-rom control points using neighbours
                      const prev = ticker.trail[i - 1] ?? p;
                      const afterNext = ticker.trail[i + 2] ?? next;
                      const tension = 0.4;
                      const cp1x = scaleX(p.x) + tension * (scaleX(next.x) - scaleX(prev.x)) / 2;
                      const cp1y = scaleY(p.y) + tension * (scaleY(next.y) - scaleY(prev.y)) / 2;
                      const cp2x = scaleX(next.x) - tension * (scaleX(afterNext.x) - scaleX(p.x)) / 2;
                      const cp2y = scaleY(next.y) - tension * (scaleY(afterNext.y) - scaleY(p.y)) / 2;
                      // opacity ramps from ~0.15 at oldest to ~0.85 just before head
                      const t = (i + 1) / (n - 1);
                      const segOpacity = 0.15 + 0.7 * t;
                      const sw = isHovered ? 2.8 : 1.8 + t * 0.6; // also tapers width
                      return (
                        <path key={i}
                          d={`M${scaleX(p.x)},${scaleY(p.y)} C${cp1x},${cp1y} ${cp2x},${cp2y} ${scaleX(next.x)},${scaleY(next.y)}`}
                          fill="none" stroke={ticker.color} strokeWidth={sw}
                          strokeLinecap="round" opacity={segOpacity}
                        />
                      );
                    })}

                    {/* Trail dots: progressively smaller + more transparent toward oldest */}
                    {ticker.trail.slice(0, -1).map((p, i) => {
                      const t = i / (n - 1); // 0 = oldest, approaches 1 toward head
                      const dotOpacity = 0.12 + 0.55 * t;
                      const r = 0.8 + 2.2 * t; // pinprick at oldest, ~3px just before head
                      return (
                        <circle key={i}
                          cx={scaleX(p.x)} cy={scaleY(p.y)} r={r}
                          fill={ticker.color} opacity={dotOpacity}
                        />
                      );
                    })}

                    {/* Current head dot — largest, fully opaque, no border */}
                    <circle
                      cx={scaleX(current.x)} cy={scaleY(current.y)}
                      r={isHovered ? 7.5 : 6}
                      fill={ticker.color}
                      style={{ cursor: "pointer", filter: isHovered ? `drop-shadow(0 0 6px ${ticker.color})` : undefined }}
                      onMouseEnter={(e) => handleDotEnter(ticker, e.clientX, e.clientY)}
                      onMouseLeave={handleDotLeave}
                    />

                    {/* Symbol label */}
                    <text
                      x={scaleX(current.x) + 10} y={scaleY(current.y) - 7}
                      fontSize={11} fontWeight={isHovered ? 800 : 600}
                      fill={ticker.color}
                      style={{
                        pointerEvents: "none",
                        filter: isHovered ? `drop-shadow(0 0 4px ${ticker.color})` : undefined,
                      }}
                    >
                      {ticker.symbol}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>

          {/* ─── Tooltip ─── */}
          {tooltip && (
            <div
              className="fixed z-50 pointer-events-none px-3 py-2 rounded-lg border text-[11px]"
              style={{
                left: tooltip.x + 14,
                top: tooltip.y - 12,
                background: "var(--terminal-surface)",
                borderColor: "var(--terminal-border)",
                boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
              }}
            >
              <div className="font-bold mb-1" style={{ color: tooltip.ticker.color }}>
                {tooltip.ticker.symbol}
                <span className="font-normal ml-1.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {tooltip.ticker.name}
                </span>
              </div>
              <div className="space-y-0.5" style={{ color: "var(--text-primary)" }}>
                <div><span style={{ color: "var(--text-muted)" }}>RS-Ratio </span>{tooltip.ticker.rsRatio.toFixed(2)}</div>
                <div><span style={{ color: "var(--text-muted)" }}>RS-Momentum </span>{tooltip.ticker.rsMomentum.toFixed(2)}</div>
                <div>
                  <span style={{ color: "#6b7280" }}>Quadrant </span>
                  <span style={{ color: QUADRANT_LABEL_COLOR[tooltip.ticker.quadrant], fontWeight: 700 }}>
                    {QUADRANT_META[tooltip.ticker.quadrant].label}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── Right Sidebar ─── */}
        {sidebarOpen && (
        <div
          className="flex-shrink-0 border-l overflow-y-auto"
          style={{
            width: SIDEBAR_WIDTH,
            borderColor: "var(--terminal-border)",
            maxHeight: MIN_CHART_HEIGHT + 44,
            ...(sidebarAsOverlay ? {
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 0,
              zIndex: 20,
              background: "var(--terminal-surface)",
              boxShadow: "-4px 0 16px rgba(0,0,0,0.4)",
              maxHeight: "100%",
            } : {}),
          }}
        >
          {/* Sidebar header */}
          <div
            className="px-3 py-2 border-b sticky top-0 z-10"
            style={{ background: "var(--terminal-surface)", borderColor: "var(--terminal-border)" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold tracking-wider" style={{ color: "var(--text-primary)" }}>
                  SECTORS
                </div>
                <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {data.length - hiddenSymbols.size}/{data.length} visible
                </div>
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  className="w-3 h-3 cursor-pointer"
                  style={{ accentColor: "var(--terminal-cyan)" }}
                />
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>All</span>
              </label>
            </div>
          </div>

          {/* Sector rows */}
          <div className="divide-y" style={{ borderColor: "var(--terminal-border)" }}>
            {data.map((ticker) => {
              const isHidden = hiddenSymbols.has(ticker.symbol);
              const isHov = hoveredSymbol === ticker.symbol;
              return (
                <div
                  key={ticker.symbol}
                  className="px-3 py-2 transition-colors cursor-pointer"
                  style={{
                    background: isHov ? "var(--overlay-subtle)" : "transparent",
                    opacity: isHidden ? 0.35 : 1,
                    transition: "opacity 0.15s, background 0.1s",
                  }}
                  onMouseEnter={() => !isHidden && setHoveredSymbol(ticker.symbol)}
                  onMouseLeave={() => setHoveredSymbol(null)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Theme-colored checkbox (no per-ticker color) */}
                      <input
                        type="checkbox"
                        checked={!isHidden}
                        onChange={() => toggleSymbol(ticker.symbol)}
                        className="w-3 h-3 cursor-pointer flex-shrink-0"
                        style={{ accentColor: "var(--terminal-cyan)" }}
                      />
                      <span
                        className="rounded-full flex-shrink-0"
                        style={{
                          width: 10, height: 10,
                          background: ticker.color,
                          boxShadow: isHov ? `0 0 6px ${ticker.color}` : undefined,
                        }}
                      />
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold truncate" style={{ color: "var(--text-primary)" }}>
                          {ticker.symbol}
                        </div>
                        <div className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
                          {ticker.name}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-[10px] font-bold" style={{ color: QUADRANT_LABEL_COLOR[ticker.quadrant] }}>
                        {QUADRANT_META[ticker.quadrant].label}
                      </div>
                      <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {ticker.rsRatio.toFixed(2)} / {ticker.rsMomentum.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
