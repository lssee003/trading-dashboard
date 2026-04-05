import { useMemo } from "react";

interface RSHistogramProps {
  data: number[];       // RS ratio series (1.0 = parity with benchmark)
  width?: number;
  height?: number;
}

/**
 * Mini histogram / sparkline showing daily relative strength vs benchmark.
 * Values above 1.0 = outperforming (green), below 1.0 = underperforming (red).
 * Renders as an inline SVG bar chart with a parity baseline.
 */
export function RSHistogram({ data, width = 120, height = 28 }: RSHistogramProps) {
  const bars = useMemo(() => {
    if (data.length < 2) return [];

    // Normalize around 1.0 baseline
    const deviations = data.map((v) => v - 1);
    const maxAbs = Math.max(...deviations.map(Math.abs), 0.001);

    const barW = Math.max(1, (width - 2) / data.length - 0.5);
    const gap = 0.5;
    const midY = height / 2;
    const amplitude = midY - 2; // leave 2px padding

    return deviations.map((dev, i) => {
      const x = 1 + i * (barW + gap);
      const barH = Math.abs(dev / maxAbs) * amplitude;
      const isPositive = dev >= 0;
      return {
        x,
        y: isPositive ? midY - barH : midY,
        w: barW,
        h: Math.max(0.5, barH),
        positive: isPositive,
      };
    });
  }, [data, width, height]);

  if (bars.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-xs"
        style={{ width, height, color: "var(--text-muted)" }}
      >
        —
      </div>
    );
  }

  return (
    <svg width={width} height={height} className="block">
      {/* Baseline at 1.0 */}
      <line
        x1={0}
        y1={height / 2}
        x2={width}
        y2={height / 2}
        stroke="var(--terminal-border)"
        strokeWidth={0.5}
        strokeDasharray="2,2"
      />
      {bars.map((bar, i) => (
        <rect
          key={i}
          x={bar.x}
          y={bar.y}
          width={bar.w}
          height={bar.h}
          rx={0.5}
          fill={bar.positive ? "var(--terminal-green)" : "var(--terminal-red)"}
          opacity={0.75 + 0.25 * (i / bars.length)}
        />
      ))}
    </svg>
  );
}
