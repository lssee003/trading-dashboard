import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { useScrollHint } from "@/hooks/useScrollHint";
import type { SheetsData, SheetsCell } from "@shared/schema";
import { useTheme } from "@/hooks/useTheme";
import { RefreshCw, Table, Brain, ChevronDown } from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";
import { AppHeader } from "../components/AppHeader";

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
  /* Translucent tints so the glass shell (and wallpaper) reads through
     the heatmap; text runs brighter to hold AA over the open fills */
  glass: {
    brightGreen: { bg: "rgba(0, 230, 118, 0.13)", text: "#7ff0b0" },
    darkGreen: { bg: "rgba(0, 200, 100, 0.24)", text: "#66eda0" },
    red: { bg: "rgba(255, 23, 68, 0.20)", text: "#ffb0bc" },
    lightRed: { bg: "rgba(255, 23, 68, 0.10)", text: "#f4bcc4" },
    yellow: { bg: "rgba(255, 171, 0, 0.14)", text: "#fde68a" },
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
  const c = theme === "glass" ? THEME_COLORS.glass : theme !== "light" ? THEME_COLORS.dark : THEME_COLORS.light;

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
  primary: { up: number; down: number; bullish: boolean; label: string; trajectory: string };
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

  // ── T2108 ──────────────────────────────
  // Stockbee reads T2108 off its absolute extreme zones only (<20 oversold, >70 overbought).
  // He does NOT use a moving average of the T2108 value, nor treat the "turn" as a separate
  // signal — he acts AT the extreme, anticipatorily. (Confirmed against source methodology.)

  // ── Days since Primary Indicator last flipped bullish ──
  // recent[i] = i days ago; if today (i=0) is first day up25q > down25q → daysSinceFlip = 0 (Day 1)
  let daysSinceBullishFlip = -1;
  for (let i = 0; i < recent.length - 1; i++) {
    if (recent[i].up25q > recent[i].down25q && recent[i + 1].up25q <= recent[i + 1].down25q) {
      daysSinceBullishFlip = i; break;
    }
  }

  // ── Burst run detection ──
  // A burst is a discrete 3-5 day impulse, NOT a standing uptrend. Anchor on the most recent
  // thrust cluster (up4 >= 300 days) and count from its FIRST breakout day (Stockbee's rule),
  // not the peak. The peel signal only fires once momentum is cooling (today is no longer a
  // fresh thrust) — during continuous thrusting Stockbee presses, he doesn't peel.
  let lastThrustIdx = -1;
  for (let i = 0; i < recent.length; i++) { if (recent[i].up4 >= 300) { lastThrustIdx = i; break; } }
  let burstStartIdx = -1;
  if (lastThrustIdx >= 0 && lastThrustIdx <= 5) {
    burstStartIdx = lastThrustIdx; // walk back through the contiguous breakout cluster
    for (let i = lastThrustIdx + 1; i < Math.min(lastThrustIdx + 5, recent.length); i++) {
      if (recent[i].up4 >= 300) burstStartIdx = i; else break;
    }
  }
  // Which day of the burst is today (first breakout day = Day 1). 0 = no active burst.
  const burstDay = burstStartIdx >= 0 ? burstStartIdx + 1 : 0;
  // Late/exhausting: burst began 3+ sessions ago, breadth still positive, but today is no longer
  // a fresh thrust (momentum cooling) — the "peel into strength" window.
  const inLateBurstWindow = burstStartIdx >= 2 && ratio5d > 1 && up4 < 300;

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
  // Report not just the sign but the TRAJECTORY of the primary indicator — a positive reading
  // that is quietly deteriorating is the early warning the indicator exists for.
  let primaryTrend: string;
  let primaryTrajectory = "";
  let primaryLabel = "";
  // Stockbee reads trajectory as the roll-off from the current leg's participation PEAK
  // (high-water mark) — not a fixed-window % change. Meaningful deterioration = the count rolling
  // several hundred stocks (~15%+) off that peak; strength = sitting at/near a fresh high. Raw
  // counts, no smoothing. The down-count is read symmetrically (rolling off its high = selling
  // exhausting). Window ≈ current leg (his "few days to a couple of weeks").
  const legWindow = recent.slice(0, Math.min(15, recent.length));
  const peakUp = Math.max(...legWindow.map(r => r.up25q));
  const rollOffUp = peakUp - up25q;
  const rollPctUp = peakUp ? rollOffUp / peakUp : 0;
  const peakDown = Math.max(...legWindow.map(r => r.down25q));
  const rollOffDown = peakDown - down25q;
  const rollPctDown = peakDown ? rollOffDown / peakDown : 0;
  if (qtrBullish) {
    const margin = up25q - down25q;
    let trajectory: string;
    if (up25q <= 200) {
      trajectory = `Up-participation has collapsed to ${up25q.toLocaleString()} — the rally is out of gas. Be defensive; long breakouts are unlikely to work.`;
    } else if (rollPctUp >= 0.15) {
      trajectory = `The up-count is rolling off its recent high of ${peakUp.toLocaleString()} (down ${rollOffUp.toLocaleString()} stocks, ~${Math.round(rollPctUp * 100)}%). Participation is leaving the market — stop adding, tighten stops, and watch for a flip to bearish.`;
    } else if (rollPctUp <= 0.02) {
      trajectory = `The up-count is at a participation high (~${up25q.toLocaleString()}) — participation is broad and breakouts have follow-through.`;
    } else {
      trajectory = `The up-count is holding — ${rollOffUp.toLocaleString()} stocks off its recent high of ${peakUp.toLocaleString()}, not deteriorating. Long swing trades and breakouts have follow-through.`;
    }
    primaryTrend = `Bullish — quarterly breadth positive (${up25q.toLocaleString()} up vs ${down25q.toLocaleString()} down, net +${margin.toLocaleString()}). ${trajectory}`;
    primaryTrajectory = trajectory;
    primaryLabel = "Bullish";
  } else {
    const margin = down25q - up25q;
    let trajectory: string;
    if (down25q <= 200) {
      trajectory = `Down-participation has dried up to ${down25q.toLocaleString()} — downside pressure is exhausting. Watch for a breadth thrust to confirm a trend change before going long.`;
    } else if (rollPctDown >= 0.15) {
      trajectory = `The down-count is rolling off its recent high of ${peakDown.toLocaleString()} (down ${rollOffDown.toLocaleString()} stocks, ~${Math.round(rollPctDown * 100)}%) — selling is exhausting. Watch for the up-count to overtake (a primary flip), or a breadth thrust, before adding long exposure.`;
    } else if (rollPctDown <= 0.02) {
      trajectory = `The down-count is at a participation high (~${down25q.toLocaleString()}) — selling is intensifying. Stay defensive; breakouts are likely to fail.`;
    } else {
      trajectory = `The down-count is holding — ${rollOffDown.toLocaleString()} stocks off its recent high of ${peakDown.toLocaleString()}. Trading long is riskier, and breakouts are more likely to fail.`;
    }
    primaryTrend = `Bearish — quarterly breadth negative (${up25q.toLocaleString()} up vs ${down25q.toLocaleString()} down, net −${margin.toLocaleString()}). ${trajectory}`;
    primaryTrajectory = trajectory;
    primaryLabel = "Bearish";
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
      detail: up4 >= 1000
        ? "Breadth thrust — 1,000+ up 4% signals a major change in character. Back-to-back 1,000+ days are a definitive market-bottom signal (2009 precedent)."
        : up4 >= 600
        ? "Strong money flow — buyers coming in droves. Breakouts work consistently when days like this cluster."
        : "Above-average buying pressure — institutional accumulation day.",
    });
  }
  if (down4 > 299) {
    keySignals.push({
      type: "bearish",
      label: `${down4.toLocaleString()} stocks down 4%+ today`,
      detail: down4 >= 1000
        ? "Knockout punch — 1,000+ down 4% indicates overwhelming liquidation and institutional panic. Go defensive or short; expect bounces to fail until the primary indicator turns positive."
        : down4 >= 600
        ? "Heavy selling — a sustained stretch of distribution. Money is flowing out; long setups are unlikely to work here."
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
      label: `Red Hot indicator at ${up50m} (≥20)`,
      detail: "Red-hot momentum extreme — buying is exhausting. The correction comes within a couple of days to ~2 weeks (not necessarily the next day). Be proactively defensive: tighten stops, sell into strength, don't chase extended names.",
    });
  } else if (up50m < 2) {
    keySignals.push({
      type: "caution",
      label: `Red Hot indicator at ${up50m} (<2)`,
      detail: "Subdued market — almost no stocks are making explosive moves. Participation has dried up; momentum longs are unlikely to work until buying returns.",
    });
  }

  // Quarterly participation extremes (Primary Indicator collapse / exhaustion)
  if (up25q <= 200) {
    keySignals.push({
      type: "caution",
      label: `Quarterly up-participation collapsed to ${up25q.toLocaleString()} (≤200)`,
      detail: "Sustained bullish participation has collapsed — the rally is out of gas. Be proactively defensive; long breakouts are unlikely to work.",
    });
  }
  if (down25q <= 200) {
    keySignals.push({
      type: "bullish",
      label: `Quarterly down-participation dried up to ${down25q.toLocaleString()} (≤200)`,
      detail: "Selling pressure has exhausted on a durable basis — prepare for a trend change. Watch for a breadth thrust (back-to-back 1,000+ up 4%) to confirm before going aggressively long.",
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
      label: `T2108 at ${t2108.toFixed(1)}% — overbought (>70)`,
      detail: "T2108 above 70 is the overbought zone — buying has likely exhausted and a pullback is probable within days. Reduce exposure proactively: tighten stops, sell into strength, avoid new positions.",
    });
  }

  // Day N of recovery / burst — peel signal
  if (inLateBurstWindow) {
    const dayLabel = burstDay >= 5 ? `Day ${burstDay}+` : `Day ${burstDay}`;
    // up-4% counts across the burst, oldest → newest (first breakout day to today)
    const burstSeq = recent.slice(0, burstStartIdx + 1).map(r => r.up4).reverse();
    keySignals.push({
      type: "caution",
      label: `${dayLabel} of momentum burst — PEEL longs into strength`,
      detail: `Breakout days (stocks up 4%): ${burstSeq.map(v => v.toLocaleString()).join(" → ")}. The burst began ${burstStartIdx} session${burstStartIdx === 1 ? "" : "s"} ago, counted from the first 4% breakout day. Momentum typically runs 3-5 days, by which point many stocks have reached the 8-20% target. Take the bulk of profits, move stops to breakeven, and avoid new exposure here.`,
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

  // Participation trajectory — the roll-off from the recent peak is an early warning that
  // PRECEDES the binary flip. Stockbee acts on this before the up/down cross actually happens.
  if (qtrBullish && rollPctUp >= 0.15 && up25q > 200) {
    significantEvents.push({
      rowIndex: 0,
      date: getRowDate(validRows[0]),
      description: `Participation deteriorating — the quarterly up-count has rolled ${rollOffUp.toLocaleString()} stocks (~${Math.round(rollPctUp * 100)}%) off its recent high of ${peakUp.toLocaleString()}. Money is leaving the market ahead of any primary flip — be proactively defensive: tighten stops and stop adding new longs.`,
    });
  } else if (!qtrBullish && rollPctDown >= 0.15 && down25q > 200) {
    significantEvents.push({
      rowIndex: 0,
      date: getRowDate(validRows[0]),
      description: `Selling exhausting — the quarterly down-count has rolled ${rollOffDown.toLocaleString()} stocks (~${Math.round(rollPctDown * 100)}%) off its recent high of ${peakDown.toLocaleString()}. Downside pressure is fading; watch for a primary flip or a breadth thrust to confirm a turn before going long.`,
    });
  }

  // Detect breadth thrusts (300+ up 4% days)
  const thrustDays = recent
    .map((r, i) => ({ ...r, idx: i }))
    .filter((r) => r.up4 >= 300);
  if (thrustDays.length > 0) {
    const biggest = thrustDays.reduce((a, b) => (a.up4 > b.up4 ? a : b));
    if (biggest.up4 >= 1000) {
      significantEvents.push({
        rowIndex: biggest.idx,
        date: getRowDate(validRows[biggest.idx]),
        description: `Breadth thrust — ${biggest.up4.toLocaleString()} stocks up 4%+ in a single day. A 1,000+ day signals a major change in character; back-to-back 1,000+ days are a definitive market-bottom signal (the 2009 precedent: 1,700 followed by 1,300-1,500).`,
      });
    } else if (biggest.up4 >= 600) {
      significantEvents.push({
        rowIndex: biggest.idx,
        date: getRowDate(validRows[biggest.idx]),
        description: `Strong buying thrust — ${biggest.up4.toLocaleString()} stocks up 4%+. Money is flowing in; breakouts work consistently when days like this cluster.`,
      });
    } else if (biggest.up4 >= 300) {
      significantEvents.push({
        rowIndex: biggest.idx,
        date: getRowDate(validRows[biggest.idx]),
        description: `Buying thrust day — ${biggest.up4.toLocaleString()} stocks up 4%+. Above-average buying pressure indicates institutional accumulation.`,
      });
    }
    // Thrust clustering in the last 5 sessions — a TRUE breadth thrust is back-to-back 1,000+
    // days (Stockbee's major-bottom signal); smaller clusters are just above-average buying.
    const peelNote = inLateBurstWindow
      ? ` Day ${burstDay} of momentum burst — consider peeling 70-80% of longs. Bursts typically exhaust by Day 3-5; lock in profits and move stops to breakeven.`
      : "";
    const thrustDaysLast5 = thrustDays.filter((d) => d.idx <= 4);
    const bigThrustDaysLast5 = thrustDaysLast5.filter((d) => d.up4 >= 1000);
    if (bigThrustDaysLast5.length >= 2) {
      significantEvents.push({
        rowIndex: 0,
        date: getRowDate(validRows[0]),
        description: `Breadth thrust confirmed — ${bigThrustDaysLast5.length} days of 1,000+ stocks up 4% in the last 5 sessions. Back-to-back 1,000+ days are the definitive market-bottom / new-bull signal (2009 precedent) — duration bullish, be aggressively long.${peelNote}`,
      });
    } else if (thrustDaysLast5.length >= 2) {
      significantEvents.push({
        rowIndex: 0,
        date: getRowDate(validRows[0]),
        description: `${thrustDaysLast5.length} above-average buying days (300+ up 4%) in the last 5 sessions — repeated buying pressure, constructive for breakouts.${peelNote}`,
      });
    }
  }

  // "Knockout punch" — 1,000+ down 4% (Stockbee's threshold for overwhelming liquidation)
  const knockoutDays = recent
    .map((r, i) => ({ ...r, idx: i }))
    .filter((r) => r.down4 >= 1000);
  if (knockoutDays.length > 0) {
    const worst = knockoutDays.reduce((a, b) => (a.down4 > b.down4 ? a : b));
    significantEvents.push({
      rowIndex: worst.idx,
      date: getRowDate(validRows[worst.idx]),
      description: `Knockout punch — ${worst.down4.toLocaleString()} stocks down 4%+. Overwhelming liquidation and institutional panic. Go defensive or short; expect bounces to fail until the primary indicator turns positive.`,
    });
  }

  // Big selling — 600–999 down 4% (a continuous stretch of distribution, below the knockout level)
  const bigSellingDays = recent
    .map((r, i) => ({ ...r, idx: i }))
    .filter((r) => r.down4 >= 600 && r.down4 < 1000);
  if (bigSellingDays.length > 0) {
    const worst = bigSellingDays.reduce((a, b) => (a.down4 > b.down4 ? a : b));
    significantEvents.push({
      rowIndex: worst.idx,
      date: getRowDate(validRows[worst.idx]),
      description: `Heavy selling — ${worst.down4.toLocaleString()} stocks down 4%+, a sustained stretch of distribution. Money is flowing out; long setups are unlikely to work. Avoid new entries and tighten stops.`,
    });
  }

  // Continuous stretch of selling — N consecutive negative-breadth sessions (persistence, not
  // one bad day). Stockbee reads a run like 634 → 667 → 437 → 450 down as deterioration.
  let negStreak = 0;
  for (let i = 0; i < recent.length; i++) {
    if (recent[i].down4 > recent[i].up4) negStreak++; else break;
  }
  if (negStreak >= 3) {
    const negSeq = recent.slice(0, negStreak).map(r => r.down4).reverse();
    significantEvents.push({
      rowIndex: 0,
      date: getRowDate(validRows[0]),
      description: `Continuous stretch of selling — ${negStreak} straight sessions of negative breadth (down 4% by day: ${negSeq.map(v => v.toLocaleString()).join(" → ")}). Persistent distribution like this is how participation rolls over; treat rallies as exits until breadth turns positive.`,
    });
  }

  // Peak exuberance — Red Hot (up50m ≥ 20) AND T2108 overbought (>70): the blowout / peel signal.
  const exuberanceDays = recent
    .map((r, i) => ({ ...r, idx: i }))
    .filter((r) => r.up50m >= 20 && r.t2108 > 70);
  if (exuberanceDays.length > 0) {
    const peak = exuberanceDays.reduce((a, b) => (a.up50m > b.up50m ? a : b));
    significantEvents.push({
      rowIndex: peak.idx,
      date: getRowDate(validRows[peak.idx]),
      description: `Peak exuberance — ${peak.up50m} stocks up 50%+ in a month (Red Hot ≥20) while T2108 reached ${peak.t2108.toFixed(1)}%. This condition signals the market is severely overextended. Sell into strength (peel 70-80% of longs), as a sharp correction typically follows within 3-5 sessions.`,
    });
  }

  // Detect T2108 oversold — threshold matches CF (<20 = brightGreen)
  // T2108 sub-20 is a rare signal that has historically coincided with or closely preceded major market bottoms.
  const oversoldDays = recent.filter((r) => r.t2108 < 20);
  if (oversoldDays.length > 0) {
    const deepest = oversoldDays.reduce((a, b) => (a.t2108 < b.t2108 ? a : b));
    const deepestIdx = recent.indexOf(deepest);
    const intensity = deepest.t2108 < 10
      ? `Extreme oversold — T2108 at ${deepest.t2108.toFixed(1)}% is in rare territory seen only at major market bottoms (e.g. COVID crash, 2022 bear). Historically a high-confidence long-term buy signal when confirmed by a breadth thrust — the highest-conviction long-term entry zone.`
      : deepest.t2108 < 15
      ? `T2108 hit ${deepest.t2108.toFixed(1)}% — deep oversold zone that has historically marked or closely preceded significant market lows. Watch for a breadth thrust (300+ up 4%) to confirm the turn; when it comes, it is one of the most reliable entry signals in the market.`
      : `T2108 entered oversold territory at ${deepest.t2108.toFixed(1)}% — a rare reading that has frequently coincided with short to intermediate-term market bottoms. Combined with a breadth thrust, this sets up a high-probability bounce.`;
    significantEvents.push({
      rowIndex: deepestIdx,
      date: getRowDate(validRows[deepestIdx]),
      description: intensity,
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
  const hasBuyingThrust = up4 >= 600 || ratio5d > 2;
  const qtrDeteriorating = qtrBullish && rollPctUp >= 0.15 && up25q > 200;
  const qtrExpanding = qtrBullish && rollPctUp <= 0.02;

  // ── Bullish primary: decide from sign + trajectory first; Red Hot / overbought is an
  //    overlay caution, NOT a regime downgrade. ──
  if (hasBullishPrimary) {
    if (qtrDeteriorating) {
      // Topping risk wins even when Red Hot — narrowing participation under a holding index.
      assessParts.push(
        `Topping Risk — the Primary Indicator is still positive (quarterly up ${up25q.toLocaleString()} > down ${down25q.toLocaleString()}), but the up-count has rolled ${rollOffUp.toLocaleString()} stocks (~${Math.round(rollPctUp * 100)}%) off its recent high of ${peakUp.toLocaleString()}. Participation is narrowing while the index holds up — the classic late-stage divergence.`,
      );
      assessParts.push(
        `Stop adding new long exposure, tighten stops, and take profits into strength. Watch for the quarterly up-count to drop below down (a flip to bearish)${hasRedHot ? `; with ${up50m} stocks up 50%+ in a month, froth is already extreme` : ""}.`,
      );
    } else if (ratio10d < 1) {
      // Bullish primary but short-term momentum has faded — pullback within an uptrend.
      assessParts.push(
        `Pullback Within an Uptrend — the Primary Indicator is bullish (quarterly up ${up25q.toLocaleString()} > down ${down25q.toLocaleString()}) but the 10-day ratio at ${ratio10d.toFixed(2)}x shows short-term momentum has faded. This is more likely a pullback than a trend change.`,
      );
      assessParts.push(
        "Wait for the 5/10-day ratios to turn back above 1.0 before adding. Hold existing positions with trailing stops.",
      );
    } else {
      // Expanding / steady uptrend — be long.
      if (ratio10d >= 2 && (mthBullish || qtrExpanding)) {
        assessParts.push(
          `Strong Uptrend — the Primary Indicator is bullish${qtrExpanding ? " and expanding" : ""} (quarterly up ${up25q.toLocaleString()} > down ${down25q.toLocaleString()}) with the 10-day ratio at ${ratio10d.toFixed(2)}x. Buyers have clearly seized control — be aggressively long: press breakouts near highs and add to winners.`,
        );
      } else if (intBullish && mthBullish) {
        assessParts.push(
          `Bullish Regime — the Primary Indicator is positive (quarterly up ${up25q.toLocaleString()} > down ${down25q.toLocaleString()}) and monthly/intermediate breadth confirm broad participation. Be long: buy pullbacks to support and fresh breakouts from tight consolidations.`,
        );
      } else {
        assessParts.push(
          `Bullish Regime — the Primary Indicator is positive (quarterly up ${up25q.toLocaleString()} > down ${down25q.toLocaleString()}). Breakouts are working with follow-through — buy pullbacks on strength and fresh breakouts with disciplined risk.`,
        );
      }
      // Froth overlay — caution, not a downgrade.
      if (hasRedHot) {
        assessParts.push(
          `Caveat: the Red Hot indicator at ${up50m} (≥20) flags short-term froth. Don't chase names already up 3-4 days — take fresh breakouts from tight bases and keep stops close. The pullback typically arrives within days to ~2 weeks.`,
        );
      } else if (hasOverbought) {
        assessParts.push(
          `Caveat: T2108 at ${t2108.toFixed(1)}% is overbought — a pullback is likely before the next leg. Tighten stops and favor fresh setups over extended names.`,
        );
      }
    }
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
  // Choppy / mixed (bearish or neutral primary that didn't match the cases above)
  else {
    assessParts.push(
      `Mixed Signal Environment — Conflicting breadth signals across timeframes. Quarterly trend is ${qtrBullish ? "positive" : "negative"}, but short-term indicators diverge.`,
    );
    if (!qtrBullish && mthBullish) {
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
    // Red Hot / overbought is an overlay caveat, not a gate — decide sizing from burst/trajectory
    // first, then append the froth qualifier so the aggressive stance can still surface.
    const frothTag = hasRedHot
      ? " Froth high — don't chase extended names."
      : hasOverbought
      ? " Overbought — tighten stops, favor fresh setups."
      : "";
    if (inLateBurstWindow) {
      stance = `PEEL — Day ${burstDay} of burst. Take 70-80% of profits, move stops to breakeven, no new longs until momentum exhausts.`;
    } else if (qtrDeteriorating) {
      stance = "REDUCE — primary rolling off its high. Take profits into strength, tighten stops, no new longs.";
    } else if (ratio10d < 1) {
      stance = "HOLD — pullback within an uptrend. No new adds until the 5/10-day ratio turns back above 1.0.";
    } else if (ratio10d >= 2 && (mthBullish || qtrExpanding)) {
      stance = `FULL SIZE — press breakouts near highs, add to winners.${frothTag}`;
    } else {
      stance = `FULL SIZE — buy pullbacks on strength, disciplined risk.${frothTag}`;
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
    primary: { up: up25q, down: down25q, bullish: qtrBullish, label: primaryLabel, trajectory: primaryTrajectory },
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
  /* Group headers are sticky — dense-but-translucent base (Chromium
     won't paint backdrop-filter on table cells, so density does the
     legibility work); the tint floats on top */
  glass: {
    primary:   { bg: "linear-gradient(rgba(255, 171, 0, 0.14), rgba(255, 171, 0, 0.14)), rgba(15, 22, 42, 0.97)", text: "#fde68a" },
    secondary: { bg: "linear-gradient(rgba(0, 230, 118, 0.13), rgba(0, 230, 118, 0.13)), rgba(15, 22, 42, 0.97)", text: "#7ff0b0" },
  },
};

/* Regime-keyed verdict-bar tints (reuse the decision-panel token family) */
const REGIME_TINT: Record<string, { bg: string; border: string; color: string }> = {
  GREEN: { bg: "var(--decision-green-bg)", border: "var(--decision-green-border)", color: "var(--terminal-green)" },
  AMBER: { bg: "var(--decision-amber-bg)", border: "var(--decision-amber-border)", color: "var(--terminal-amber)" },
  RED:   { bg: "var(--decision-red-bg)",   border: "var(--decision-red-border)",   color: "var(--terminal-red)" },
};

const SIGNAL_COLOR: Record<SignalType, string> = {
  bullish: "var(--terminal-green)",
  bearish: "var(--terminal-red)",
  caution: "var(--terminal-amber)",
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/** Animate an integer from 0 → target with an ease-out-quint curve (long decelerating tail).
 *  Re-fires when `refresh` changes. Honors prefers-reduced-motion by snapping to the target. */
function useCountUp(target: number, refresh: string, durationMs = 700): number {
  const [val, setVal] = useState(() => (prefersReducedMotion() ? target : 0));
  useEffect(() => {
    if (prefersReducedMotion()) { setVal(target); return; }
    let raf = 0;
    let startTs = 0;
    const tick = (now: number) => {
      if (!startTs) startTs = now;
      const t = Math.min(1, (now - startTs) / durationMs);
      const eased = 1 - Math.pow(1 - t, 5);
      setVal(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, refresh, durationMs]);
  return val;
}

function CountUp({ value, refresh, duration }: { value: number; refresh: string; duration?: number }) {
  const v = useCountUp(value, refresh, duration);
  return <>{v.toLocaleString()}</>;
}

/** Zone header: label on the left, a hairline filling the row, optional trailing badge.
 *  Delineates the readout into clear sections instead of floating labels. */
function TaLabel({ children, trailing }: { children: React.ReactNode; trailing?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-2.5">
      <span className="ta-label flex-shrink-0">{children}</span>
      <div className="flex-1 h-px" style={{ background: "var(--terminal-border)" }} />
      {trailing}
    </div>
  );
}

export default function GoogleSheets() {
  const breadthTableRef = useScrollHint<HTMLDivElement>();
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [showAnalysis, setShowAnalysis] = useState(() => {
    try { return localStorage.getItem("breadth-analysis-open") === "true"; } catch { return false; }
  });
  const { theme } = useTheme();

  const toggleAnalysis = () => {
    setShowAnalysis(v => {
      try { localStorage.setItem("breadth-analysis-open", String(!v)); } catch {}
      return !v;
    });
  };

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

  /** Changes whenever the underlying data does — re-keys the panel so entrance
   *  animations and count-ups re-fire on a fresh read (and only then). */
  const dataKey = data?.lastUpdated ?? "static";

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
    const palette = theme === "glass" ? GROUP_COLORS.glass : theme !== "light" ? GROUP_COLORS.dark : GROUP_COLORS.light;
    if (l.includes("primary"))   return { background: palette.primary.bg, color: palette.primary.text };
    if (l.includes("secondary")) return { background: palette.secondary.bg, color: palette.secondary.text };
    return { background: "var(--terminal-bg)", color: "transparent" };
  };

  return (
    <div className="flex-1 flex flex-col" style={{ background: "var(--terminal-bg)" }}>
      <AppHeader
        activePage="breadth"
        statusContent={
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${IS_STATIC ? "" : "pulse-live"}`}
              style={{ background: IS_STATIC ? "var(--terminal-cyan)" : (isFetching ? "var(--terminal-amber)" : "var(--terminal-green)") }}
            />
            <span style={{ color: IS_STATIC ? "var(--terminal-cyan)" : (isFetching ? "var(--terminal-amber)" : "var(--terminal-green)") }}>
              {IS_STATIC ? "SNAPSHOT" : (isFetching ? "UPDATING" : "LIVE")}
            </span>
          </div>
        }
        updatedLabel={IS_STATIC && data?.lastUpdated ? `updated ${formatDataTimestamp(data.lastUpdated)}` : `updated ${secondsAgo}s ago`}
        actions={
          <>
            <ThemeToggle />
            {!IS_STATIC && (
              <button onClick={handleRefresh} className="p-1.5 rounded transition-colors opacity-60 hover:opacity-100">
                <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
              </button>
            )}
          </>
        }
      />

      {/* Terminal Analysis + Table */}
      <main className="flex-1 overflow-auto p-3 md:p-4">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin" style={{ color: "var(--text-faint)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading breadth data...</p>
            </div>
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center p-8 rounded-lg border glass-panel" style={{ borderColor: "var(--terminal-border)", background: "var(--terminal-surface)" }}>
              <Table className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--text-faint)" }} />
              <h2 className="text-lg font-bold mb-2" style={{ color: "var(--terminal-amber)" }}>DATA LOAD ERROR</h2>
              <p className="text-sm mb-4 max-w-md" style={{ color: "var(--text-secondary)" }}>{(error as Error)?.message || "Failed to load data"}</p>
              {!IS_STATIC && (
                <button onClick={handleRefresh} className="px-4 py-2 rounded text-sm font-medium" style={{ background: "var(--terminal-blue)", color: "#fff" }}>Retry</button>
              )}
            </div>
          </div>
        ) : null}

        {/* Breadth Terminal Analysis — always-on status line + expandable detail */}
        {breadthAnalysis && (() => {
          const a = breadthAnalysis;
          const tint = REGIME_TINT[a.regime.signal];
          const [stanceVerb, ...stanceRestArr] = a.stance.split(" — ");
          const stanceRest = stanceRestArr.join(" — ");
          const { up, down, bullish, label: primaryLabel, trajectory } = a.primary;
          const total = up + down;
          const upPct = total > 0 ? (up / total) * 100 : 50;
          const net = up - down;
          const Divider = ({ className = "" }: { className?: string }) => (
            <div className={`w-px h-7 flex-shrink-0 ${className}`} style={{ background: "var(--terminal-border)" }} />
          );
          return (
            <div
              className="rounded-lg border mb-3 max-w-[1600px] mx-auto overflow-hidden glass-panel"
              style={{ background: "var(--terminal-surface)", borderColor: "var(--terminal-border)" }}
            >
              {/* ── STATUS LINE — always visible, the decision in one dense strip ── */}
              <button
                type="button"
                onClick={toggleAnalysis}
                aria-expanded={showAnalysis}
                className="ta-strip w-full flex items-stretch text-left select-none transition-colors hover:brightness-[1.02]"
                style={{ background: tint.bg, borderBottom: showAnalysis ? "1px solid var(--terminal-border)" : "none" }}
              >
                {/* Identity + Regime */}
                <div className="flex items-center gap-2 pl-3.5 pr-3 py-2.5 flex-shrink-0">
                  <Brain className="w-3.5 h-3.5 hidden sm:block" style={{ color: "var(--terminal-cyan)" }} />
                  <span className="w-2 h-2 rounded-full pulse-live flex-shrink-0" style={{ background: tint.color }} />
                  <span className="text-[13px] font-black tracking-[0.03em]" style={{ color: tint.color }}>{a.regime.label}</span>
                </div>

                <Divider className="self-center" />

                {/* Stance — verb + truncated rationale */}
                <div className="flex items-baseline gap-2.5 px-3.5 py-2.5 min-w-0 flex-1">
                  <span className="text-[12px] font-black uppercase tracking-[0.03em] flex-shrink-0 self-center" style={{ color: tint.color }}>{stanceVerb}</span>
                  {stanceRest && (
                    <span className="text-[11px] truncate hidden md:block self-center" style={{ color: "var(--text-secondary)" }}>{stanceRest}</span>
                  )}
                </div>

                <Divider className="self-center hidden lg:block" />

                {/* Breadth — live meter: counts count up, halves draw out from a glowing seam (desktop only) */}
                <div className="hidden lg:flex items-center gap-2.5 px-3.5 py-2.5 flex-shrink-0 font-mono" style={{ fontVariantNumeric: "tabular-nums lining-nums" }}>
                  <span className="text-[11px] font-bold" style={{ color: "var(--terminal-green)" }}>
                    <CountUp value={up} refresh={dataKey} duration={1400} /><span className="text-[8px]" style={{ color: "var(--text-muted)" }}> ▲</span>
                  </span>
                  <div
                    key={dataKey}
                    className="ta-mini-meter relative w-[88px] h-1.5 rounded-full overflow-hidden flex flex-shrink-0"
                    style={{ background: "var(--bar-track)", boxShadow: "inset 0 1px 1.5px rgba(0,0,0,0.18)" }}
                  >
                    <div className="ta-mini-up glass-bar h-full" style={{ width: `${upPct}%`, background: "var(--terminal-green)", "--bar-color": "var(--terminal-green)", "--bar-span": upPct } as React.CSSProperties} />
                    <div className="ta-mini-down glass-bar h-full" style={{ width: `${100 - upPct}%`, background: "var(--terminal-red)", "--bar-color": "var(--terminal-red)", "--bar-tip-x": "0%", "--bar-base": "right", "--bar-span": 100 - upPct } as React.CSSProperties} />
                    <span className="ta-mini-seam" style={{ left: `${upPct}%` }} />
                  </div>
                  <span className="text-[11px] font-bold" style={{ color: "var(--terminal-red)" }}>
                    <span className="text-[8px]" style={{ color: "var(--text-muted)" }}>▼ </span><CountUp value={down} refresh={dataKey} duration={1400} />
                  </span>
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm"
                    style={{ color: net >= 0 ? "var(--terminal-green)" : "var(--terminal-red)", background: net >= 0 ? "var(--gain-chip-bg)" : "var(--loss-chip-bg)" }}
                  >
                    {net >= 0 ? "+" : "−"}<CountUp value={Math.abs(net)} refresh={dataKey} duration={1500} />
                  </span>
                </div>

                <Divider className="self-center" />

                {/* What expanding reveals + chevron */}
                <div className="flex items-center gap-3 pl-3.5 pr-3.5 py-2.5 flex-shrink-0">
                  <span className="hidden lg:flex items-baseline gap-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
                    <span className="font-bold" style={{ color: "var(--text-secondary)" }}>{a.keySignals.length}</span> signals
                    <span className="mx-0.5" style={{ color: "var(--text-faint)" }}>·</span>
                    <span className="font-bold" style={{ color: "var(--text-secondary)" }}>{a.significantEvents.length}</span> events
                  </span>
                  <span className="hidden sm:inline lg:hidden text-[10px] font-bold tracking-wide uppercase" style={{ color: "var(--text-muted)" }}>
                    {showAnalysis ? "Less" : "Details"}
                  </span>
                  <ChevronDown
                    className="w-4 h-4 transition-transform duration-300 flex-shrink-0"
                    style={{ color: "var(--text-faint)", transform: showAnalysis ? "rotate(180deg)" : "rotate(0deg)" }}
                  />
                </div>
              </button>

              {/* ── DETAIL — expandable reasoning ── */}
              {showAnalysis && (
                <div key={dataKey} className="grid grid-cols-1 xl:grid-cols-2 gap-0">
                  {/* LEFT: Primary Trend + Key Signals */}
                  <div className="px-4 py-3 xl:border-r" style={{ borderColor: "var(--terminal-border)" }}>
                    <div className="mb-3">
                      <TaLabel trailing={
                        <span className="text-[10px] font-bold tracking-wide uppercase" style={{ color: bullish ? "var(--terminal-green)" : "var(--terminal-red)" }}>
                          {primaryLabel}
                        </span>
                      }>Primary Trend</TaLabel>
                      <p className="ta-reveal text-[11px] leading-[1.5]" style={{ animationDelay: "40ms", color: "var(--text-secondary)" }}>{trajectory}</p>
                    </div>

                    <div>
                      <TaLabel>Key Signals</TaLabel>
                      {a.keySignals.length > 0 ? (
                        <div className="space-y-1.5">
                          {a.keySignals.map((sig, i) => {
                            const col = SIGNAL_COLOR[sig.type];
                            const delay = `${120 + i * 45}ms`;
                            return (
                              <div key={i} className="ta-reveal flex items-start gap-2.5" style={{ animationDelay: delay }}>
                                <span
                                  className="ta-dot mt-[5px] w-1.5 h-1.5 rounded-full flex-shrink-0"
                                  style={{ background: col, ["--ta-glow" as string]: col, animationDelay: delay }}
                                />
                                <div className="min-w-0">
                                  <div className="text-[10px] font-bold leading-[1.35]" style={{ color: col }}>{sig.label}</div>
                                  <div className="text-[10px] leading-[1.4]" style={{ color: "var(--text-secondary)" }}>{sig.detail}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>No notable signals on the latest read.</p>
                      )}
                    </div>
                  </div>

                  {/* RIGHT: Significant Events + Assessment */}
                  <div className="px-4 py-3 border-t xl:border-t-0" style={{ borderColor: "var(--terminal-border)" }}>
                    <div className="mb-3">
                      <TaLabel>Significant Events · Recent</TaLabel>
                      {a.significantEvents.length > 0 ? (
                        <div className="space-y-1.5">
                          {a.significantEvents.map((evt, i) => (
                            <div key={i} className="ta-reveal flex items-start gap-2" style={{ animationDelay: `${120 + i * 45}ms` }}>
                              <span className="text-[10px] font-mono flex-shrink-0 mt-px" style={{ color: "var(--text-faint)" }}>▸</span>
                              <p className="text-[10px] leading-[1.45]" style={{ color: "var(--text-secondary)" }}>
                                {evt.date && (
                                  <span className="evt-date-pill inline-block font-mono font-bold text-[9px] px-1 py-px rounded mr-1.5 align-middle" style={{ background: "var(--terminal-cyan)", color: "var(--terminal-bg)", opacity: 0.9 }}>{evt.date}</span>
                                )}
                                {evt.description}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>No threshold events in the recent window.</p>
                      )}
                    </div>

                    <div>
                      <TaLabel>Assessment</TaLabel>
                      <p className="text-[11px] leading-[1.55]" style={{ color: "var(--text-secondary)" }}>{a.assessment}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {data && data.rows.length > 0 ? (
          <div className="breadth-shell rounded-lg border overflow-hidden max-w-[1600px] mx-auto" style={{ borderColor: "var(--terminal-border)" }}>
            {/* overflow: auto on both axes in same container so sticky thead + sticky col-0 both work */}
            <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 220px)" }} ref={breadthTableRef}>
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
            <Table className="w-12 h-12 mb-4" style={{ color: "var(--text-faint)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No data available</p>
          </div>
        )}
      </main>
    </div>
  );
}
