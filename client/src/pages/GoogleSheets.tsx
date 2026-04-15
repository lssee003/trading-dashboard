import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import type { SheetsData, SheetsCell } from "@shared/schema";
import { useTheme } from "@/hooks/useTheme";
import { Link } from "wouter";
import { RefreshCw, Sun, Moon, BarChart3, Table, Brain } from "lucide-react";

const IS_STATIC = import.meta.env.VITE_DATA_MODE === "static";

/* ── Column indices for the breadth table ── */
const COL = {
  DATE: 0,
  UP_4_TODAY: 1,
  DOWN_4_TODAY: 2,
  RATIO_5D: 3,
  RATIO_10D: 4,
  UP_25_QTR: 5,
  DOWN_25_QTR: 6,
  UP_25_MTH: 7,
  DOWN_25_MTH: 8,
  UP_50_MTH: 9,
  DOWN_50_MTH: 10,
  UP_13_34D: 11,
  DOWN_13_34D: 12,
  WORDEN: 13,
  T2108: 14,
  SP500: 15,
};

type CellColorResult = { bg: string; text: string; bold?: boolean } | null;

const THEME_COLORS = {
  dark: {
    brightGreen: { bg: "#0b3d1a", text: "#6ee7a0" },
    darkGreen: { bg: "#0a2e15", text: "#4ade80" },
    red: { bg: "#3d0f0f", text: "#fca5a5" },
    lightRed: { bg: "#2d1a1a", text: "#e8a0a0" },
    yellow: { bg: "#3d3510", text: "#fde68a" },
  },
  light: {
    brightGreen: { bg: "#d1fae5", text: "#065f46" },
    darkGreen: { bg: "#a7f3d0", text: "#064e3b" },
    red: { bg: "#fee2e2", text: "#991b1b" },
    lightRed: { bg: "#fef2f2", text: "#7f1d1d" },
    yellow: { bg: "#fef3c7", text: "#92400e" },
  },
};

function getNumVal(row: SheetsCell[], ci: number): number | null {
  const cv = row[ci]?.value;
  return typeof cv === "number" ? cv : null;
}

/** Compute conditional formatting color for a cell based on the rules */
function computeCellColor(row: SheetsCell[], colIdx: number, theme: string): CellColorResult {
  const val = row[colIdx]?.value;
  if (val === null || val === undefined || typeof val === "string") return null;
  const v = val as number;
  const c = theme === "dark" ? THEME_COLORS.dark : THEME_COLORS.light;

  const up4 = getNumVal(row, COL.UP_4_TODAY);
  const down4 = getNumVal(row, COL.DOWN_4_TODAY);
  const up25q = getNumVal(row, COL.UP_25_QTR);
  const down25q = getNumVal(row, COL.DOWN_25_QTR);
  const up25m = getNumVal(row, COL.UP_25_MTH);
  const down25m = getNumVal(row, COL.DOWN_25_MTH);
  const up13 = getNumVal(row, COL.UP_13_34D);
  const down13 = getNumVal(row, COL.DOWN_13_34D);

  switch (colIdx) {
    case COL.UP_4_TODAY:
      if (down4 !== null && down4 > v) return c.lightRed;
      if (v >= 300) return c.darkGreen;
      if (up4 !== null && down4 !== null && up4 > down4) return c.brightGreen;
      return null;

    case COL.DOWN_4_TODAY:
      if (v > 299) return c.red;
      if (up4 !== null && down4 !== null && up4 > down4) return c.brightGreen;
      if (up4 !== null && down4 !== null && down4 > up4) return c.lightRed;
      return null;

    case COL.RATIO_5D:
      if (v > 2) return c.brightGreen;
      if (v < 0.5) return c.red;
      return null;

    case COL.RATIO_10D:
      if (v >= 2) return c.brightGreen;
      if (v < 0.5) return c.red;
      return null;

    case COL.UP_25_QTR:
      if (v <= 200) return c.darkGreen;
      if (up25q !== null && down25q !== null && up25q < down25q) return c.red;
      if (up25q !== null && down25q !== null && up25q > down25q) return c.brightGreen;
      return null;

    case COL.DOWN_25_QTR:
      if (v <= 200) return c.yellow;
      if (up25q !== null && down25q !== null && up25q < down25q) return c.red;
      if (up25q !== null && down25q !== null && up25q > down25q) return c.brightGreen;
      return null;

    case COL.UP_25_MTH:
      if (up25m !== null && down25m !== null && up25m < down25m) return c.red;
      if (up25m !== null && down25m !== null && up25m > down25m) return c.brightGreen;
      return null;

    case COL.DOWN_25_MTH:
      if (up25m !== null && down25m !== null && up25m < down25m) return c.red;
      if (up25m !== null && down25m !== null && up25m > down25m) return c.brightGreen;
      return null;

    case COL.UP_50_MTH:
      if (v >= 20) return c.red;
      if (v < 2) return { ...c.brightGreen, bold: true };
      return null;

    case COL.DOWN_50_MTH:
      if (v > 19) return c.brightGreen;
      return null;

    case COL.UP_13_34D:
      if (up13 !== null && down13 !== null && up13 < down13) return c.red;
      if (up13 !== null && down13 !== null && up13 > down13) return c.brightGreen;
      return null;

    case COL.DOWN_13_34D:
      if (up13 !== null && down13 !== null && down13 > up13) return c.red;
      if (up13 !== null && down13 !== null && down13 < up13) return c.brightGreen;
      return null;

    case COL.T2108:
      if (v < 20) return c.brightGreen;
      if (v > 79.99) return c.red;
      return null;

    default:
      return null;
  }
}

/* ── Breadth Terminal Analysis ── */
type SignalType = "bullish" | "bearish" | "caution";
interface KeySignal {
  type: SignalType;
  label: string;
  detail: string;
}

interface SignificantEvent {
  rowIndex: number;
  date?: string;
  description: string;
}

interface BreadthAnalysis {
  regime: { signal: "GREEN" | "AMBER" | "RED"; label: string };
  primaryTrend: string;
  keySignals: KeySignal[];
  significantEvents: SignificantEvent[];
  assessment: string;
  stance: string;
}

/** Extract validated data rows (numeric up4 in col 1, enough columns) */
function getValidRows(dataRows: SheetsCell[][]): SheetsCell[][] {
  return dataRows.filter(
    (row) => row.length > COL.SP500 && typeof row[COL.UP_4_TODAY]?.value === "number",
  );
}

/** Helper: get row values as a simple object */
function rowVals(row: SheetsCell[]) {
  const g = (ci: number) => getNumVal(row, ci);
  return {
    up4: g(COL.UP_4_TODAY) ?? 0,
    down4: g(COL.DOWN_4_TODAY) ?? 0,
    ratio5d: g(COL.RATIO_5D) ?? 1,
    ratio10d: g(COL.RATIO_10D) ?? 1,
    up25q: g(COL.UP_25_QTR) ?? 0,
    down25q: g(COL.DOWN_25_QTR) ?? 0,
    up25m: g(COL.UP_25_MTH) ?? 0,
    down25m: g(COL.DOWN_25_MTH) ?? 0,
    up50m: g(COL.UP_50_MTH) ?? 0,
    down50m: g(COL.DOWN_50_MTH) ?? 0,
    up13: g(COL.UP_13_34D) ?? 0,
    down13: g(COL.DOWN_13_34D) ?? 0,
    worden: g(COL.WORDEN) ?? 0,
    t2108: g(COL.T2108) ?? 50,
    sp: g(COL.SP500) ?? 0,
  };
}

/** Format a row's date cell (string like "4/14/2026") into "Apr 14" */
function getRowDate(row: SheetsCell[]): string | undefined {
  const v = row[COL.DATE]?.value;
  if (!v && v !== 0) return undefined;
  const d = new Date(typeof v === "number" ? (v - 25569) * 86400000 : String(v));
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function generateBreadthAnalysis(dataRows: SheetsCell[][]): BreadthAnalysis | null {
  const validRows = getValidRows(dataRows);
  if (validRows.length === 0) return null;

  // Sheet is ordered newest-first: validRows[0] = most recent trading day
  const latest = rowVals(validRows[0]);
  // Scan up to 20 most recent rows — already in newest-first order
  const recent = validRows.slice(0, 20).map(rowVals);

  const {
    up4, down4, ratio5d, ratio10d, up25q, down25q, up25m, down25m,
    up50m, down50m, up13, down13, worden, t2108, sp,
  } = latest;

  const qtrBullish = up25q > down25q;
  const mthBullish = up25m > down25m;
  const intBullish = up13 > down13;

  // ── T2108 analytics ──────────────────────────────
  // Use up to 40 rows for the 40MA (user specified); keep other signals within 20-day recent window
  const t2108Rows40 = validRows.slice(0, 40).map(r => getNumVal(r, COL.T2108) ?? 50);
  const t2108Values = t2108Rows40.slice(0, 20); // first 20 = same as recent window
  const t2108_3dAgo = t2108Values[3] ?? t2108;
  const t2108Peak5d = Math.max(...t2108Values.slice(1, 6));   // peak over last 5 days (excl. today)
  const t2108Trough5d = Math.min(...t2108Values.slice(1, 6)); // trough over last 5 days
  // 40MA of T2108 — use however many rows are available up to 40
  const t2108MA40 = t2108Rows40.reduce((a, b) => a + b, 0) / t2108Rows40.length;
  const t2108AboveMA40 = t2108 > t2108MA40;
  // Yesterday's T2108 vs 40MA (for breach detection — was below, now above, or vice versa)
  const t2108YesterdayAboveMA40 = t2108Values[1] !== undefined ? t2108Values[1] > t2108MA40 : t2108AboveMA40;
  const t2108CrossedAboveMA40 = t2108AboveMA40 && !t2108YesterdayAboveMA40;
  const t2108CrossedBelowMA40 = !t2108AboveMA40 && t2108YesterdayAboveMA40;
  // "Peeling" = T2108 was at an extreme recently and is now reversing away from it
  const t2108PeelingDown = t2108Peak5d > 60 && t2108 < t2108Peak5d - 3 && t2108 < t2108_3dAgo;
  const t2108PeelingUp   = t2108Trough5d < 20 && t2108 > t2108Trough5d + 3 && t2108 > t2108_3dAgo;

  // ── Days since Primary Indicator last flipped bullish ──
  // recent[i] = i days ago; if today (i=0) is first day up25q > down25q → daysSinceFlip = 0 (Day 1)
  let daysSinceBullishFlip = -1;
  for (let i = 0; i < recent.length - 1; i++) {
    if (recent[i].up25q > recent[i].down25q && recent[i + 1].up25q <= recent[i + 1].down25q) {
      daysSinceBullishFlip = i; break;
    }
  }

  // ── Burst run detection ──
  // Count thrust days in the last 7 sessions (non-consecutive — rallies have mixed days)
  const last7 = recent.slice(0, 7);
  const thrustDaysInLast7 = last7.filter(r => r.up4 >= 300).length;
  // Find the peak thrust day (highest up4) in last 7 and how many days ago it was
  const peakThrustEntry = last7
    .map((r, i) => ({ up4: r.up4, idx: i }))
    .reduce((a, b) => a.up4 > b.up4 ? a : b, { up4: 0, idx: -1 });
  const daysSincePeakThrust = peakThrustEntry.up4 >= 300 ? peakThrustEntry.idx : -1;
  // "In late burst window": 2+ thrust days in last 7 sessions, peak thrust was 3+ days ago
  const inLateBurstWindow = thrustDaysInLast7 >= 2 && daysSincePeakThrust >= 3 && ratio5d > 1.5;

  // ══════════════════════════════════════════════════
  // 1. REGIME
  // ══════════════════════════════════════════════════
  let regimeSignal: "GREEN" | "AMBER" | "RED";
  let regimeLabel: string;

  if (qtrBullish && ratio10d >= 1 && t2108 > 20) {
    regimeSignal = "GREEN"; regimeLabel = "UPTREND";
  } else if (!qtrBullish && ratio10d < 0.5) {
    regimeSignal = "RED"; regimeLabel = "CORRECTION";
  } else if (!qtrBullish && !mthBullish && !intBullish) {
    regimeSignal = "RED"; regimeLabel = "RISK-OFF";
  } else if (qtrBullish && ratio10d >= 0.5) {
    regimeSignal = "GREEN"; regimeLabel = "TRENDING";
  } else {
    regimeSignal = "AMBER"; regimeLabel = "CHOPPY";
  }

  // ══════════════════════════════════════════════════
  // 2. PRIMARY TREND DESCRIPTION
  // ══════════════════════════════════════════════════
  let primaryTrend: string;
  if (qtrBullish) {
    const margin = up25q - down25q;
    primaryTrend = `Bullish — quarterly breadth positive (${up25q.toLocaleString()} up vs ${down25q.toLocaleString()} down, net +${margin.toLocaleString()}). Long swing trades and breakouts are more likely to have follow-through.`;
  } else {
    const margin = down25q - up25q;
    primaryTrend = `Bearish — quarterly breadth negative (${up25q.toLocaleString()} up vs ${down25q.toLocaleString()} down, net −${margin.toLocaleString()}). Trading long is riskier; breakouts are more likely to fail.`;
  }

  // ══════════════════════════════════════════════════
  // 3. KEY SIGNALS
  // ══════════════════════════════════════════════════
  const keySignals: KeySignal[] = [];

  // Daily pressure
  if (up4 >= 300) {
    keySignals.push({
      type: "bullish",
      label: `${up4.toLocaleString()} stocks up 4%+ today`,
      detail: "Above-average buying pressure — institutional accumulation day.",
    });
  }
  if (down4 > 299) {
    keySignals.push({
      type: "bearish",
      label: `${down4.toLocaleString()} stocks down 4%+ today`,
      detail: down4 >= 600
        ? "Extreme selling / \"knockout punch\" — capitulation day, paradoxically often precedes a turn."
        : "Above-average selling pressure — institutional distribution day.",
    });
  }

  // Ratios
  if (ratio10d >= 2) {
    keySignals.push({
      type: "bullish",
      label: `10-day ratio at ${ratio10d.toFixed(2)}x`,
      detail: "Buyers have clearly seized control — breakouts have follow-through.",
    });
  } else if (ratio10d < 0.5) {
    keySignals.push({
      type: "bearish",
      label: `10-day ratio at ${ratio10d.toFixed(2)}x`,
      detail: "Sellers dominating — breakdowns accelerating, avoid long entries.",
    });
  }
  if (ratio5d > 2) {
    keySignals.push({
      type: "bullish",
      label: `5-day ratio at ${ratio5d.toFixed(2)}x`,
      detail: "Short-term buying burst — likely to continue higher for 2-5 days.",
    });
  } else if (ratio5d < 0.5) {
    keySignals.push({
      type: "bearish",
      label: `5-day ratio at ${ratio5d.toFixed(2)}x`,
      detail: "Short-term selling dominant — avoid catching falling knives.",
    });
  }

  // Monthly breadth
  if (mthBullish) {
    keySignals.push({
      type: "bullish",
      label: `Monthly breadth positive (${up25m} up vs ${down25m} down)`,
      detail: "Medium-term participation expanding — rally has legs.",
    });
  } else if (up25m < down25m) {
    keySignals.push({
      type: "bearish",
      label: `Monthly breadth negative (${up25m} up vs ${down25m} down)`,
      detail: "Medium-term selling pressure — rallies lack follow-through.",
    });
  }

  // Intermediate breadth
  if (intBullish) {
    keySignals.push({
      type: "bullish",
      label: `Intermediate breadth positive (${up13.toLocaleString()} vs ${down13.toLocaleString()})`,
      detail: "Broad participation across 34-day window supports the move.",
    });
  } else if (up13 < down13) {
    keySignals.push({
      type: "bearish",
      label: `Intermediate breadth negative (${up13.toLocaleString()} vs ${down13.toLocaleString()})`,
      detail: "Damage is broad-based across the intermediate timeframe.",
    });
  }

  // Red Hot / exhaustion
  if (up50m >= 20) {
    keySignals.push({
      type: "caution",
      label: `Red Hot indicator at ${up50m} (≥20 threshold)`,
      detail: "Market is overextended — a short-term correction or pullback is likely within 2-5 days. Do not chase extended moves.",
    });
  } else if (up50m < 2) {
    keySignals.push({
      type: "bullish",
      label: `Red Hot indicator at ${up50m} (<2)`,
      detail: "Extreme low reading — froth has been washed out, fresh setups are safer.",
    });
  }

  // Capitulation (down 50% month)
  if (down50m > 19) {
    keySignals.push({
      type: "bullish",
      label: `${down50m} stocks down 50%+ in a month`,
      detail: "Capitulation selling — extreme bearishness often precedes a reflex bounce.",
    });
  }

  // T2108
  if (t2108 < 20) {
    keySignals.push({
      type: "bullish",
      label: `T2108 at ${t2108.toFixed(1)}% — rare oversold signal flashing`,
      detail: t2108 < 10
        ? "Extreme oversold — T2108 sub-10 is seen only at major generational lows. Historically a very high-confidence long entry when confirmed by a breadth thrust."
        : t2108 < 15
        ? "Deeply oversold — T2108 sub-15 has historically marked significant market bottoms. Watch for a breadth thrust to confirm the turn before entering aggressively."
        : "T2108 entered the rare oversold zone (<20%) — has historically coincided with short to intermediate-term market lows. A reflex bounce is probable; breadth thrust confirms.",
    });
  } else if (t2108 > 70) {
    keySignals.push({
      type: "caution",
      label: `T2108 at ${t2108.toFixed(1)}% (overbought >70)`,
      detail: t2108 > 80
        ? "Extremely overbought — pullback is likely, scale back long positions and tighten stops."
        : "Reaching overbought zone — become cautious, a pullback is approaching.",
    });
  }

  // T2108 peeling signals
  if (t2108PeelingDown) {
    keySignals.push({
      type: "caution",
      label: `T2108 peeling down — was ${t2108Peak5d.toFixed(1)}%, now ${t2108.toFixed(1)}%`,
      detail: `T2108 peaked at ${t2108Peak5d.toFixed(1)}% in the last 5 days and is now rolling over. This is a "peel longs" signal — sell into strength, tighten stops, and avoid chasing extended names. Momentum bursts typically reverse within 3-5 days of peaking.`,
    });
  } else if (t2108PeelingUp) {
    keySignals.push({
      type: "bullish",
      label: `T2108 peeling up — was ${t2108Trough5d.toFixed(1)}%, now ${t2108.toFixed(1)}%`,
      detail: `T2108 troughed at ${t2108Trough5d.toFixed(1)}% in the last 5 days and is now turning up from oversold. This confirms the bounce is underway — initiate positions with confirmation, tight stops below the recent low.`,
    });
  }

  // T2108 vs its 40-day MA (structural breadth context)
  if (!t2108PeelingDown && !t2108PeelingUp && t2108 > 20 && t2108 < 70) {
    keySignals.push({
      type: t2108AboveMA40 ? "bullish" : "caution",
      label: `T2108 at ${t2108.toFixed(1)}% — ${t2108AboveMA40 ? "above" : "below"} its 40MA (${t2108MA40.toFixed(1)}%)`,
      detail: t2108AboveMA40
        ? "T2108 is above its 40-day MA — structural breadth is healthy, the majority of stocks are in uptrends. Breakouts have follow-through."
        : "T2108 is below its 40-day MA — structural breadth is impaired, most stocks are in downtrends. Treat rallies as opportunities to reduce exposure.",
    });
  }

  // Day N of recovery / burst — peel signal
  if (inLateBurstWindow) {
    const dayLabel = daysSincePeakThrust >= 5 ? `Day ${daysSincePeakThrust + 1}+` : `Day ${daysSincePeakThrust + 1}`;
    keySignals.push({
      type: "caution",
      label: `${dayLabel} of momentum burst — PEEL longs into strength`,
      detail: `The peak thrust day was ${daysSincePeakThrust} sessions ago. Momentum bursts typically last 3-5 days; many stocks have likely reached the 8-20% profit target. Take the bulk of profits now, move stops aggressively to breakeven, and avoid adding new exposure at these levels.`,
    });
  } else if (daysSinceBullishFlip >= 3 && daysSinceBullishFlip <= 7) {
    const sessionLabel = `Session ${daysSinceBullishFlip + 1}`;
    keySignals.push({
      type: "caution",
      label: `${sessionLabel} of bullish flip — lock in gains`,
      detail: `The Primary Indicator flipped bullish ${daysSinceBullishFlip + 1} sessions ago. By session 3-5 of a recovery, stocks that led the initial thrust have typically met profit targets (8-20%). Take the bulk of profit and move stops very aggressively.`,
    });
  }

  // Worden universe
  if (worden > 7000) {
    keySignals.push({
      type: "caution",
      label: `Worden universe at ${worden.toLocaleString()} (elevated)`,
      detail: "High stock universe count indicates elevated supply — long-term bearish headwind from excess listings/IPOs.",
    });
  }

  // ══════════════════════════════════════════════════
  // 4. SIGNIFICANT EVENTS (scan recent rows)
  // ══════════════════════════════════════════════════
  const significantEvents: SignificantEvent[] = [];

  // Detect primary indicator flip (quarterly up crosses above/below quarterly down)
  for (let i = 0; i < recent.length - 1; i++) {
    const cur = recent[i];
    const prev = recent[i + 1];
    // Flip to bullish
    if (cur.up25q > cur.down25q && prev.up25q <= prev.down25q) {
      significantEvents.push({
        rowIndex: i,
        date: getRowDate(validRows[i]),
        description: `Primary Indicator Flip to BULLISH — quarterly up (${cur.up25q.toLocaleString()}) exceeded down (${cur.down25q.toLocaleString()}) for the first time. This signals the start of a bullish regime where breakouts and long swing trades have follow-through.`,
      });
    }
    // Flip to bearish
    if (cur.up25q <= cur.down25q && prev.up25q > prev.down25q) {
      significantEvents.push({
        rowIndex: i,
        date: getRowDate(validRows[i]),
        description: `Primary Indicator Flip to BEARISH — quarterly down (${cur.down25q.toLocaleString()}) overtook up (${cur.up25q.toLocaleString()}). Long setups are now higher risk; shorting becomes the more profitable strategy.`,
      });
    }
  }

  // Detect breadth thrusts (300+ up 4% days)
  const thrustDays = recent
    .map((r, i) => ({ ...r, idx: i }))
    .filter((r) => r.up4 >= 300);
  if (thrustDays.length > 0) {
    const biggest = thrustDays.reduce((a, b) => (a.up4 > b.up4 ? a : b));
    if (biggest.up4 >= 800) {
      significantEvents.push({
        rowIndex: biggest.idx,
        date: getRowDate(validRows[biggest.idx]),
        description: `Massive breadth thrust — ${biggest.up4.toLocaleString()} stocks up 4%+ in a single day. This is a major "market break thrust" signaling institutional buying. Market likely continues higher for 2-5 days.`,
      });
    } else if (biggest.up4 >= 300) {
      significantEvents.push({
        rowIndex: biggest.idx,
        date: getRowDate(validRows[biggest.idx]),
        description: `Buying thrust day — ${biggest.up4.toLocaleString()} stocks up 4%+. Above-average buying pressure indicates institutional accumulation.`,
      });
    }
    // Back-to-back thrusts
    const consecutiveThrusts = thrustDays.filter(
      (d) => d.idx <= 4,
    ).length;
    if (consecutiveThrusts >= 2) {
      const peelNote = inLateBurstWindow
        ? ` We are now in Day ${daysSincePeakThrust + 1} of this burst — momentum bursts typically last 3-5 days. Consider peeling 70-80% of longs into this strength and moving stops aggressively to lock in gains.`
        : " Continue holding; watch for exhaustion signals (ratio peaking, T2108 rolling over) before peeling.";
      significantEvents.push({
        rowIndex: 0,
        date: getRowDate(validRows[0]),
        description: `${consecutiveThrusts} buying thrust days (300+ up 4%) in the last 5 sessions — sustained breadth thrust confirms a sustainable rally, not just a dead-cat bounce.${peelNote}`,
      });
    }
  }

  // Detect capitulation days (600+ down 4%)
  // Capitulation days (600+ down 4%) — "knockout punch"
  const capitulationDays = recent
    .map((r, i) => ({ ...r, idx: i }))
    .filter((r) => r.down4 >= 600);
  if (capitulationDays.length > 0) {
    const worst = capitulationDays.reduce((a, b) => (a.down4 > b.down4 ? a : b));
    significantEvents.push({
      rowIndex: worst.idx,
      date: getRowDate(validRows[worst.idx]),
      description: `Capitulation day — ${worst.down4.toLocaleString()} stocks down 4%+ ("knockout punch"). Extreme selling like this paradoxically often precedes a market turn. Watch for breadth thrust to confirm a bottom.`,
    });
  }

  // Distribution days (500–599 down 4% + ratio deteriorating) — below "knockout" but still significant
  const distributionDays = recent
    .map((r, i) => ({ ...r, idx: i }))
    .filter((r) => r.down4 >= 500 && r.down4 < 600 && r.ratio10d < 1);
  if (distributionDays.length > 0) {
    const worst = distributionDays.reduce((a, b) => (a.down4 > b.down4 ? a : b));
    significantEvents.push({
      rowIndex: worst.idx,
      date: getRowDate(validRows[worst.idx]),
      description: `Distribution day — ${worst.down4.toLocaleString()} stocks down 4%+ with the 10-day ratio at ${worst.ratio10d.toFixed(2)}x (sellers dominating). Institutional supply is overwhelming demand. Avoid new long entries; tighten stops on existing positions.`,
    });
  }

  // Peak exuberance — up50m >= 20 AND T2108 near recent peak (≥60)
  // This is the "peel longs" signal from January 15-type scenarios
  const exuberanceDays = recent
    .map((r, i) => ({ ...r, idx: i }))
    .filter((r) => r.up50m >= 20 && r.t2108 >= 60);
  if (exuberanceDays.length > 0) {
    const peak = exuberanceDays.reduce((a, b) => (a.up50m > b.up50m ? a : b));
    significantEvents.push({
      rowIndex: peak.idx,
      date: getRowDate(validRows[peak.idx]),
      description: `Peak exuberance — ${peak.up50m} stocks up 50%+ in a month (Red Hot ≥20) while T2108 reached ${peak.t2108.toFixed(1)}%. This "blowout" condition signals the market is severely overextended. Sell into strength (peel 70-80% of longs), as a sharp correction typically follows within 3-5 sessions.`,
    });
  }

  // Detect T2108 oversold — threshold matches CF (<20 = brightGreen)
  // T2108 sub-20 is a rare signal that has historically coincided with or closely preceded major market bottoms.
  const oversoldDays = recent.filter((r) => r.t2108 < 20);
  if (oversoldDays.length > 0) {
    const deepest = oversoldDays.reduce((a, b) => (a.t2108 < b.t2108 ? a : b));
    const deepestIdx = recent.indexOf(deepest);
    const intensity = deepest.t2108 < 10
      ? `Extreme oversold — T2108 at ${deepest.t2108.toFixed(1)}% is in rare territory seen only at major market bottoms (e.g. COVID crash, 2022 bear). Historically a high-confidence long-term buy signal when confirmed by a breadth thrust. This is the "back up the truck" zone.`
      : deepest.t2108 < 15
      ? `T2108 hit ${deepest.t2108.toFixed(1)}% — deep oversold zone that has historically marked or closely preceded significant market lows. Watch for a breadth thrust (300+ up 4%) to confirm the turn; when it comes, it is one of the most reliable entry signals in the market.`
      : `T2108 entered oversold territory at ${deepest.t2108.toFixed(1)}% — a rare reading that has frequently coincided with short to intermediate-term market bottoms. Combined with a breadth thrust, this sets up a high-probability bounce.`;
    significantEvents.push({
      rowIndex: deepestIdx,
      date: getRowDate(validRows[deepestIdx]),
      description: intensity,
    });
  }

  // T2108 breach of its 40MA — a structural regime change signal
  if (t2108CrossedAboveMA40) {
    significantEvents.push({
      rowIndex: 0,
      date: getRowDate(validRows[0]),
      description: `T2108 crossed above its 40-day MA (now ${t2108.toFixed(1)}% vs 40MA at ${t2108MA40.toFixed(1)}%) — a structural breadth regime change to bullish. The majority of stocks are reclaiming their 40-day MAs. This is a reliable medium-term buy signal; initiate or add to long positions on breakouts.`,
    });
  } else if (t2108CrossedBelowMA40) {
    significantEvents.push({
      rowIndex: 0,
      date: getRowDate(validRows[0]),
      description: `T2108 crossed below its 40-day MA (now ${t2108.toFixed(1)}% vs 40MA at ${t2108MA40.toFixed(1)}%) — a structural breadth regime change to bearish. Most stocks are losing their 40-day MAs. Reduce long exposure, avoid new breakout entries, and consider raising cash.`,
    });
  }

  // ══════════════════════════════════════════════════
  // 5. ASSESSMENT (the narrative paragraph)
  // ══════════════════════════════════════════════════
  const assessParts: string[] = [];

  // Detect conflicting signals
  const hasBullishPrimary = qtrBullish;
  const hasRedHot = up50m >= 20;
  const hasOverbought = t2108 > 70;
  const hasOversold = t2108 < 20;
  const hasCapitulation = down50m > 19;
  const hasBearishPrimary = !qtrBullish;
  const hasBuyingThrust = up4 >= 300 || ratio5d > 2;

  // Green Light / Yellow Light scenario (bullish primary + short-term exhaustion)
  if (hasBullishPrimary && hasRedHot) {
    assessParts.push(
      `Green Light / Yellow Light — The Primary Indicator is bullish (quarterly up ${up25q.toLocaleString()} > down ${down25q.toLocaleString()}), confirming a regime where breakouts work. However, the Red Hot indicator at ${up50m} (≥20) warns the market is short-term overextended.`,
    );
    assessParts.push(
      "Do not chase stocks already up 3-4 days in a row. The safest approach is to wait for a 2-3 day pullback to clear the froth, then enter fresh breakouts from tight consolidations with closer stops.",
    );
  }
  // Green Light / Yellow Light (bullish primary + overbought)
  else if (hasBullishPrimary && hasOverbought && !hasRedHot) {
    assessParts.push(
      `Green Light / Yellow Light — Primary trend is bullish but T2108 at ${t2108.toFixed(1)}% signals an overbought market. A pullback is likely before the next leg higher.`,
    );
    assessParts.push(
      "Tighten stops on existing positions. Wait for a 2-3 day pullback before adding new exposure. Buy fresh setups only — avoid extended names.",
    );
  }
  // Bearish primary + strong buying thrust (potential bottom/reversal)
  else if (hasBearishPrimary && hasBuyingThrust) {
    assessParts.push(
      `Bear Market Rally Signal — The Primary Indicator remains bearish (quarterly down ${down25q.toLocaleString()} > up ${up25q.toLocaleString()}), but a strong buying thrust is underway${ratio5d > 2 ? ` with 5-day ratio at ${ratio5d.toFixed(2)}x` : ""}${up4 >= 300 ? ` and ${up4.toLocaleString()} stocks up 4%+ today` : ""}.`,
    );
    if (mthBullish || intBullish) {
      assessParts.push(
        "Monthly or intermediate breadth is turning positive ahead of quarterly — watch for the Primary Flip (quarterly up > down) to confirm a full regime change. Until then, treat this as a bear market rally: half-size positions with tight stops.",
      );
    } else {
      assessParts.push(
        "This buying pressure could be a reflex bounce in a bearish environment. Without a Primary Flip, breakouts are still likely to fail. Trade with reduced size and short duration (3-5 days).",
      );
    }
  }
  // Bearish primary + oversold (bottom fishing)
  else if (hasBearishPrimary && (hasOversold || hasCapitulation)) {
    assessParts.push(
      `Bottom Zone Alert — The Primary Indicator is bearish, but${hasOversold ? ` T2108 at ${t2108.toFixed(1)}% is in oversold territory` : ""}${hasOversold && hasCapitulation ? " and" : ""}${hasCapitulation ? ` ${down50m} stocks down 50%+ in a month signals capitulation` : ""}. Extreme pessimism like this often precedes a reflex bounce.`,
    );
    assessParts.push(
      "Watch for a breadth thrust (300+ stocks up 4%+ on back-to-back days) to confirm a bottom. A 3-5 day reflex bounce is likely, but the primary trend remains down — trade the bounce with tight stops and short duration only.",
    );
  }
  // Pure bearish
  else if (regimeSignal === "RED") {
    assessParts.push(
      `Bearish Regime — The Primary Indicator is negative with quarterly down (${down25q.toLocaleString()}) exceeding up (${up25q.toLocaleString()}). This is the environment where long setups fail and shorting is the more profitable strategy.`,
    );
    if (ratio10d < 0.5) {
      assessParts.push(
        `The 10-day ratio at ${ratio10d.toFixed(2)}x confirms sustained selling dominance. Preserve capital and wait for breadth improvement before considering long entries.`,
      );
    } else {
      assessParts.push(
        "Avoid buying breakouts in this regime — they are far more likely to fail. Focus on cash preservation or short setups.",
      );
    }
  }
  // Pure bullish
  else if (regimeSignal === "GREEN" && !hasRedHot && !hasOverbought) {
    assessParts.push(
      `Bullish Regime — The Primary Indicator is positive (quarterly up ${up25q.toLocaleString()} > down ${down25q.toLocaleString()}) and the market is not overextended. This is the environment to be aggressively long.`,
    );
    if (ratio10d >= 2) {
      assessParts.push(
        `The 10-day ratio at ${ratio10d.toFixed(2)}x shows buyers have clearly seized control. Press breakouts near highs and add to winning positions.`,
      );
    } else if (intBullish && mthBullish) {
      assessParts.push(
        "Both monthly and intermediate breadth confirm broad participation. Buy pullbacks to support and fresh breakouts from tight consolidations.",
      );
    } else {
      assessParts.push(
        "Breakouts are working with follow-through. Buy pullbacks on strength and fresh breakouts with disciplined risk management.",
      );
    }
  }
  // Choppy
  else {
    assessParts.push(
      `Mixed Signal Environment — Conflicting breadth signals across timeframes. Quarterly trend is ${qtrBullish ? "positive" : "negative"}, but short-term indicators diverge.`,
    );
    if (qtrBullish && ratio10d < 1) {
      assessParts.push(
        "Short-term momentum is fading despite positive quarterly breadth — this is likely a pullback within an uptrend, not a trend change. Wait for the 5/10-day ratios to turn back above 1.0 before adding new positions.",
      );
    } else if (!qtrBullish && mthBullish) {
      assessParts.push(
        "Monthly breadth is turning positive ahead of quarterly — a potential regime change is forming. Watch for the quarterly up to cross above down (the Primary Flip) for confirmation. Until then, trade selectively with half positions.",
      );
    } else {
      assessParts.push(
        "Focus on A+ setups only with tight risk. Reduce position sizes and avoid forcing trades in choppy tape.",
      );
    }
  }

  // ══════════════════════════════════════════════════
  // 6. STANCE
  // ══════════════════════════════════════════════════
  let stance: string;
  const isOversold = t2108 < 20 || down50m > 19;

  if (regimeSignal === "GREEN") {
    if (hasRedHot) {
      stance = "FULL SIZE — scale into pullbacks, don't chase. Wait for 2-3 day pullback for fresh entries.";
    } else if (hasOverbought) {
      stance = "FULL SIZE — tighten stops, wait for pullback before adding. Buy fresh setups only.";
    } else if (ratio10d >= 2 && mthBullish) {
      stance = "FULL SIZE — press breakouts near highs, add to winners.";
    } else {
      stance = "FULL SIZE — buy pullbacks on strength, disciplined risk management.";
    }
  } else if (regimeSignal === "AMBER") {
    if (isOversold) {
      stance = "TACTICAL BOUNCE — half size, 3-5 day duration, tight stops.";
    } else if (hasBuyingThrust && hasBearishPrimary) {
      stance = "HALF SIZE — trade the thrust but respect the bearish primary. Short duration only.";
    } else {
      stance = "HALF SIZE — A+ setups only, tight stops, no forced trades.";
    }
  } else {
    if (isOversold) {
      stance = "DEFENSIVE + BOUNCE WATCH — bounce setups valid with tight stops, cash otherwise. Watch for breadth thrust to confirm bottom.";
    } else {
      stance = "CASH / SHORT BIAS — preserve capital, wait for Primary Flip or breadth thrust before going long.";
    }
  }

  // Sort newest-first, then merge multiple events on the same date into one entry
  significantEvents.sort((a, b) => a.rowIndex - b.rowIndex);
  const mergedEvents: SignificantEvent[] = [];
  for (const evt of significantEvents) {
    const prev = mergedEvents[mergedEvents.length - 1];
    if (prev && prev.rowIndex === evt.rowIndex) {
      prev.description += " Additionally, " + evt.description.charAt(0).toLowerCase() + evt.description.slice(1);
    } else {
      mergedEvents.push({ ...evt });
    }
  }
  const deduplicatedEvents = mergedEvents;

  return {
    regime: { signal: regimeSignal, label: regimeLabel },
    primaryTrend,
    keySignals,
    significantEvents: deduplicatedEvents,
    assessment: assessParts.join(" "),
    stance,
  };
}

/* Group header theme colors */
const GROUP_COLORS: Record<string, Record<string, { bg: string; text: string }>> = {
  dark: {
    primary:   { bg: "#3d3510", text: "#fde68a" },
    secondary: { bg: "#0b3d1a", text: "#6ee7a0" },
  },
  light: {
    primary:   { bg: "#fef3c7", text: "#92400e" },
    secondary: { bg: "#d1fae5", text: "#065f46" },
  },
};

const REGIME_COLORS: Record<string, string> = {
  GREEN: "var(--terminal-green)",
  AMBER: "var(--terminal-amber)",
  RED: "var(--terminal-red)",
};

export default function GoogleSheets() {
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [secondsAgo, setSecondsAgo] = useState(0);
  const { theme, toggleTheme } = useTheme();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<SheetsData>({
    queryKey: ["/api/sheets"],
    staleTime: 300_000,
    refetchInterval: false,
  });

  useEffect(() => { if (data) setLastRefresh(new Date()); }, [data?.lastUpdated]);
  useEffect(() => {
    if (IS_STATIC) return;
    const id = setInterval(() => setSecondsAgo(Math.floor((Date.now() - lastRefresh.getTime()) / 1000)), 1000);
    return () => clearInterval(id);
  }, [lastRefresh]);

  const formatDataTimestamp = (ts: string) => {
    const diffMs = Date.now() - new Date(ts).getTime();
    const h = Math.floor(diffMs / 3_600_000);
    if (h < 1) { const m = Math.floor(diffMs / 60_000); return m < 1 ? "just now" : `${m}m ago`; }
    return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
  };

  const handleRefresh = () => { if (!IS_STATIC) refetch(); };

  const groupSpans = useMemo(() => {
    if (!data?.groupHeaders) return [];
    const spans: { label: string; colSpan: number }[] = [];
    let cur = data.groupHeaders[0]?.trim() || "";
    let count = 1;
    for (let i = 1; i < data.groupHeaders.length; i++) {
      const g = data.groupHeaders[i]?.trim() || "";
      if (g === "" || g === cur) { count++; }
      else { spans.push({ label: cur, colSpan: count }); cur = g; count = 1; }
    }
    spans.push({ label: cur, colSpan: count });
    return spans;
  }, [data?.groupHeaders]);

  /** Determine the first data row index (skip header/empty rows) */
  const dataStartIdx = useMemo(() => {
    if (!data?.rows) return 0;
    for (let i = 0; i < Math.min(5, data.rows.length); i++) {
      const first = data.rows[i]?.[0]?.value;
      if (typeof first === "string" && (first.toLowerCase().includes("date") || first === "")) continue;
      if (data.rows[i]?.every((c) => c.value === null)) continue;
      return i;
    }
    return 2; // fallback
  }, [data?.rows]);

  /** Generate breadth terminal analysis from latest data */
  const breadthAnalysis = useMemo(() => {
    if (!data?.rows) return null;
    const dataRows = data.rows.slice(dataStartIdx);
    return generateBreadthAnalysis(dataRows);
  }, [data?.rows, dataStartIdx]);

  const cellStyleComputed = (row: SheetsCell[], colIdx: number): React.CSSProperties => {
    const color = computeCellColor(row, colIdx, theme);
    if (!color) return {};
    return {
      backgroundColor: color.bg,
      color: color.text,
      ...(color.bold ? { fontWeight: 700 } : {}),
    };
  };

  const groupStyle = (label: string): React.CSSProperties => {
    const l = label.toLowerCase();
    const palette = theme === "dark" ? GROUP_COLORS.dark : GROUP_COLORS.light;
    if (l.includes("primary"))   return { backgroundColor: palette.primary.bg, color: palette.primary.text };
    if (l.includes("secondary")) return { backgroundColor: palette.secondary.bg, color: palette.secondary.text };
    return { background: "var(--terminal-bg)", color: "transparent" };
  };

  if (isError) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: "var(--terminal-bg)" }}>
        <div className="text-center p-8 rounded-lg border" style={{ borderColor: "var(--terminal-border)", background: "var(--terminal-surface)" }}>
          <Table className="w-12 h-12 mx-auto mb-4 opacity-40" />
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--terminal-amber)" }}>DATA LOAD ERROR</h2>
          <p className="text-sm opacity-60 mb-4 max-w-md">{(error as Error)?.message || "Failed to load data"}</p>
          {!IS_STATIC && (
            <button onClick={handleRefresh} className="px-4 py-2 rounded text-sm font-medium" style={{ background: "var(--terminal-blue)", color: "#fff" }}>Retry</button>
          )}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: "var(--terminal-bg)" }}>
        <div className="text-center">
          <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin opacity-40" />
          <p className="text-sm opacity-60">Loading breadth data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col" style={{ background: "var(--terminal-bg)" }}>
      {/* Header — matches Dashboard / RS exactly */}
      <header className="flex-shrink-0 border-b" style={{ borderColor: "var(--terminal-border)", background: "var(--terminal-surface)" }}>
        <div className="flex items-center justify-between px-4 py-2 text-xs gap-2">
          <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto flex-1 min-w-0" style={{ scrollbarWidth: "none" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-label="Trading Dashboard Logo">
              <rect x="2" y="2" width="20" height="20" rx="3" stroke="var(--terminal-cyan)" strokeWidth="1.5"/>
              <path d="M6 16 L10 10 L14 13 L18 6" stroke="var(--terminal-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="18" cy="6" r="1.5" fill="var(--terminal-green)"/>
            </svg>

            <Link href="/" className="flex items-center gap-1.5 px-3 py-1 rounded transition-colors"
              style={{ color: "var(--terminal-dim)", background: "transparent", border: "1px solid var(--terminal-border)" }}>
              <span className="font-bold tracking-wide">MARKET MONITOR</span>
            </Link>
            <Link href="/relative-strength" className="flex items-center gap-1.5 px-3 py-1 rounded transition-colors"
              style={{ color: "var(--terminal-dim)", background: "transparent", border: "1px solid var(--terminal-border)" }}>
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="font-bold tracking-wide">RELATIVE STRENGTH</span>
            </Link>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded"
              style={{ color: "#fff", background: "var(--terminal-blue)" }}>
              <Table className="w-3.5 h-3.5" />
              <span className="font-bold tracking-wide">MARKET BREADTH</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${IS_STATIC ? "" : "pulse-live"}`}
                style={{ background: IS_STATIC ? "var(--terminal-cyan)" : (isFetching ? "var(--terminal-amber)" : "var(--terminal-green)") }} />
              <span style={{ color: IS_STATIC ? "var(--terminal-cyan)" : (isFetching ? "var(--terminal-amber)" : "var(--terminal-green)") }}>
                {IS_STATIC ? "SNAPSHOT" : (isFetching ? "UPDATING" : "LIVE")}
              </span>
            </div>
            <span className="opacity-40">
              {IS_STATIC && data?.lastUpdated ? `updated ${formatDataTimestamp(data.lastUpdated)}` : `updated ${secondsAgo}s ago`}
            </span>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <button onClick={toggleTheme} className="p-1.5 rounded transition-colors opacity-60 hover:opacity-100"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
              {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            {!IS_STATIC && (
              <button onClick={handleRefresh} className="p-1.5 rounded transition-colors opacity-60 hover:opacity-100">
                <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Terminal Analysis + Table */}
      <main className="flex-1 overflow-auto p-3 md:p-4">
        {/* Breadth Terminal Analysis */}
        {breadthAnalysis && (
          <div
            className="rounded-lg border mb-3 max-w-[1600px] mx-auto overflow-hidden"
            style={{ background: "var(--terminal-surface)", borderColor: "var(--terminal-border)" }}
          >
            {/* Header + Regime */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: "var(--terminal-border)" }}>
              <div className="flex items-center gap-2">
                <Brain className="w-3.5 h-3.5" style={{ color: "var(--terminal-cyan)" }} />
                <span className="text-[10px] font-bold tracking-[0.12em] uppercase" style={{ color: "var(--terminal-cyan)" }}>
                  Terminal Analysis
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full pulse-live"
                  style={{ background: REGIME_COLORS[breadthAnalysis.regime.signal] }}
                />
                <span className="text-xs font-black tracking-wide" style={{ color: REGIME_COLORS[breadthAnalysis.regime.signal] }}>
                  {breadthAnalysis.regime.label}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-0">
              {/* Left column: Primary Trend + Key Signals */}
              <div className="px-4 py-3 xl:border-r" style={{ borderColor: "var(--terminal-border)" }}>
                {/* Primary Trend */}
                <div className="mb-3">
                  <span className="text-[9px] font-bold tracking-wider uppercase opacity-40">Primary Trend</span>
                  <p className="text-[11px] leading-[1.5] mt-1 opacity-85">{breadthAnalysis.primaryTrend}</p>
                </div>

                {/* Key Signals */}
                {breadthAnalysis.keySignals.length > 0 && (
                  <div>
                    <span className="text-[9px] font-bold tracking-wider uppercase opacity-40">Key Signals</span>
                    <div className="mt-1.5 space-y-1.5">
                      {breadthAnalysis.keySignals.map((sig, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span
                            className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{
                              background:
                                sig.type === "bullish" ? "var(--terminal-green)"
                                : sig.type === "bearish" ? "var(--terminal-red)"
                                : "var(--terminal-amber)",
                            }}
                          />
                          <div className="min-w-0">
                            <span
                              className="text-[10px] font-bold"
                              style={{
                                color:
                                  sig.type === "bullish" ? "var(--terminal-green)"
                                  : sig.type === "bearish" ? "var(--terminal-red)"
                                  : "var(--terminal-amber)",
                              }}
                            >
                              {sig.label}
                            </span>
                            <span className="text-[10px] opacity-60 ml-1.5">{sig.detail}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right column: Significant Events + Assessment + Stance */}
              <div className="px-4 py-3 border-t xl:border-t-0" style={{ borderColor: "var(--terminal-border)" }}>
                {/* Significant Events */}
                {breadthAnalysis.significantEvents.length > 0 && (
                  <div className="mb-3">
                    <span className="text-[9px] font-bold tracking-wider uppercase opacity-40">Significant Events (Recent)</span>
                    <div className="mt-1.5 space-y-1.5">
                      {breadthAnalysis.significantEvents.map((evt, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-[10px] font-mono opacity-40 flex-shrink-0 mt-px">▸</span>
                          <p className="text-[10px] leading-[1.5] opacity-75">
                            {evt.date && (
                              <span className="inline-block font-mono font-bold text-[9px] px-1 py-px rounded mr-1.5 align-middle" style={{ background: "var(--terminal-cyan)", color: "var(--terminal-bg)", opacity: 0.9 }}>{evt.date}</span>
                            )}
                            {evt.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Assessment */}
                <div className="mb-3">
                  <span className="text-[9px] font-bold tracking-wider uppercase opacity-40">Assessment</span>
                  <p className="text-[11px] leading-[1.6] mt-1 opacity-85">{breadthAnalysis.assessment}</p>
                </div>

                {/* Stance */}
                <div
                  className="flex items-center gap-2 pt-2"
                  style={{ borderTop: "1px solid var(--terminal-border)" }}
                >
                  <span className="text-[9px] font-bold tracking-wider opacity-40">STANCE</span>
                  <span className="text-[10px] font-bold" style={{ color: REGIME_COLORS[breadthAnalysis.regime.signal] }}>
                    {breadthAnalysis.stance}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {data && data.rows.length > 0 ? (
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--terminal-border)" }}>
            {/* overflow: auto on both axes in same container so sticky thead + sticky col-0 both work */}
            <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 260px)" }}>
              <table className="text-sm border-collapse" style={{ minWidth: "100%" }}>
                <thead className="sticky top-0 z-20">
                  {groupSpans.length > 0 && (
                    <tr>
                      {groupSpans.map((span, idx) => (
                        <th key={idx} colSpan={span.colSpan}
                          className={`px-3 py-2.5 text-center font-bold font-mono text-xs tracking-wider border-b border-r${idx === 0 ? " sticky left-0 z-30" : ""}`}
                          style={{ borderColor: "var(--terminal-border)", ...groupStyle(span.label) }}>
                          {span.label || "\u00a0"}
                        </th>
                      ))}
                    </tr>
                  )}
                  <tr style={{ background: "var(--terminal-surface)" }}>
                    {data.headers.map((h, idx) => (
                      <th key={idx}
                        className={`px-3 py-2 text-left font-semibold font-mono text-[10px] tracking-wider border-b-2 border-r${idx === 0 ? " sticky left-0 z-30" : ""}`}
                        style={{ color: "var(--terminal-cyan)", borderColor: "var(--terminal-border)", background: "var(--terminal-surface)", maxWidth: 130, whiteSpace: "normal", lineHeight: "1.3" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, ri) => {
                    const isDataRow = ri >= dataStartIdx;
                    return (
                      <tr key={ri} className="border-b" style={{ borderColor: "var(--terminal-border)" }}>
                        {row.map((cell, ci) => {
                          const computed = isDataRow ? cellStyleComputed(row, ci) : {};
                          const isFirstCol = ci === 0;
                          return (
                            <td key={ci}
                              className={`px-3 py-1.5 font-mono text-xs border-r whitespace-nowrap${isFirstCol ? " sticky left-0 z-10" : ""}`}
                              style={{
                                ...computed,
                                borderColor: "var(--terminal-border)",
                                textAlign: typeof cell.value === "number" ? "right" : "left",
                                ...(isFirstCol ? { background: computed.backgroundColor ?? "var(--terminal-surface)" } : {}),
                              }}>
                              {cell.value !== null
                                ? (typeof cell.value === "number" ? cell.value.toLocaleString() : String(cell.value))
                                : ""}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12">
            <Table className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm opacity-60">No data available</p>
          </div>
        )}
      </main>
    </div>
  );
}
