import type { RSTickerData } from "@shared/schema";

// ─── Types ───

export interface RRGPoint {
  x: number; // RS-Ratio (centered on 100)
  y: number; // RS-Momentum (centered on 100)
}

export type Quadrant = "leading" | "weakening" | "lagging" | "improving";

export interface RRGTicker {
  symbol: string;
  name: string;
  category: string;
  color: string;
  trail: RRGPoint[]; // trail[last] = current position
  quadrant: Quadrant;
  rsRatio: number;
  rsMomentum: number;
}

// ─── Color Palette ───
// 15 distinct colors for sector/ETF differentiation

const RRG_COLORS = [
  "#f97316", // orange
  "#3b82f6", // blue
  "#22c55e", // green
  "#eab308", // yellow
  "#ef4444", // red
  "#a855f7", // purple
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#84cc16", // lime
  "#f59e0b", // amber
  "#6366f1", // indigo
  "#14b8a6", // teal
  "#e879f9", // fuchsia
  "#fb923c", // light orange
  "#818cf8", // light indigo
];

/** Deterministic color for a symbol based on its index in the data set */
export function getSymbolColor(index: number): string {
  return RRG_COLORS[index % RRG_COLORS.length];
}

// ─── Math Helpers ───

/** Simple moving average of arr ending at index `end` (inclusive) over `window` periods */
function sma(arr: number[], end: number, window: number): number {
  const start = Math.max(0, end - window + 1);
  const slice = arr.slice(start, end + 1);
  return slice.reduce((s, v) => s + v, 0) / slice.length;
}

/** Classify quadrant from RS-Ratio and RS-Momentum */
function classifyQuadrant(rsRatio: number, rsMomentum: number): Quadrant {
  if (rsRatio > 100 && rsMomentum > 100) return "leading";
  if (rsRatio > 100 && rsMomentum <= 100) return "weakening";
  if (rsRatio <= 100 && rsMomentum > 100) return "improving";
  return "lagging";
}

// ─── Core Computation ───

interface RRGParams {
  smaWindow: number;
  momentumPeriod: number;
  trailStep: number;   // sample every N days (5 = weekly)
  maxTrailPoints: number;
}

function getParams(lookback: number): RRGParams {
  if (lookback <= 10) return { smaWindow: 4, momentumPeriod: 3, trailStep: 2, maxTrailPoints: 4 };
  if (lookback <= 25) return { smaWindow: 10, momentumPeriod: 5, trailStep: 5, maxTrailPoints: 5 };
  if (lookback <= 50) return { smaWindow: 10, momentumPeriod: 5, trailStep: 5, maxTrailPoints: 9 };
  return { smaWindow: 10, momentumPeriod: 5, trailStep: 5, maxTrailPoints: 17 };
}

/**
 * Compute RS-Ratio time series from a histogram (daily cumulative RS ratios).
 * RS-Ratio[i] = (histogram[i] / SMA(histogram, i, window)) * 100
 */
function computeRSRatioSeries(histogram: number[], smaWindow: number): number[] {
  const series: number[] = [];
  for (let i = 0; i < histogram.length; i++) {
    const avg = sma(histogram, i, smaWindow);
    series.push(avg !== 0 ? (histogram[i] / avg) * 100 : 100);
  }
  return series;
}

/**
 * Compute RS-Momentum time series from an RS-Ratio series.
 * RS-Momentum[i] = (rsRatio[i] / rsRatio[i - period]) * 100
 */
function computeRSMomentumSeries(rsRatioSeries: number[], period: number): number[] {
  const series: number[] = [];
  for (let i = 0; i < rsRatioSeries.length; i++) {
    if (i < period) {
      series.push(100); // not enough data, default to neutral
    } else {
      const prev = rsRatioSeries[i - period];
      series.push(prev !== 0 ? (rsRatioSeries[i] / prev) * 100 : 100);
    }
  }
  return series;
}

/**
 * Compute trail points by sampling at weekly (or configured) intervals.
 * Returns array of { x: RS-Ratio, y: RS-Momentum } from oldest to newest.
 */
function computeTrail(
  rsRatioSeries: number[],
  rsMomentumSeries: number[],
  params: RRGParams,
): RRGPoint[] {
  const len = rsRatioSeries.length;
  if (len < params.smaWindow + params.momentumPeriod) return [];

  // Start from the end, step backwards by trailStep
  const indices: number[] = [];
  for (let i = len - 1; indices.length < params.maxTrailPoints && i >= 0; i -= params.trailStep) {
    indices.push(i);
  }
  indices.reverse(); // oldest first

  return indices.map((i) => ({
    x: rsRatioSeries[i],
    y: rsMomentumSeries[i],
  }));
}

/**
 * Transform RSTickerData[] into RRGTicker[] for chart rendering.
 * All math is client-side using the existing histogram arrays.
 */
export function computeRRGData(
  tickers: RSTickerData[],
  lookback: number,
): RRGTicker[] {
  const params = getParams(lookback);
  const results: RRGTicker[] = [];

  for (let idx = 0; idx < tickers.length; idx++) {
    const t = tickers[idx];
    if (!t.histogram || t.histogram.length < 8) continue;

    const rsRatioSeries = computeRSRatioSeries(t.histogram, params.smaWindow);
    const rsMomentumSeries = computeRSMomentumSeries(rsRatioSeries, params.momentumPeriod);

    const trail = computeTrail(rsRatioSeries, rsMomentumSeries, params);
    if (trail.length === 0) continue;

    const current = trail[trail.length - 1];

    results.push({
      symbol: t.symbol,
      name: t.name,
      category: t.category,
      color: getSymbolColor(idx),
      trail,
      quadrant: classifyQuadrant(current.x, current.y),
      rsRatio: current.x,
      rsMomentum: current.y,
    });
  }

  return results;
}

// ─── Quadrant metadata ───

export const QUADRANT_META: Record<Quadrant, { label: string; color: string; bgOpacity: number }> = {
  leading:   { label: "LEADING",   color: "var(--terminal-green)", bgOpacity: 0.06 },
  weakening: { label: "WEAKENING", color: "var(--terminal-amber)", bgOpacity: 0.06 },
  lagging:   { label: "LAGGING",   color: "var(--terminal-red)",   bgOpacity: 0.06 },
  improving: { label: "IMPROVING", color: "var(--terminal-blue)",  bgOpacity: 0.06 },
};
