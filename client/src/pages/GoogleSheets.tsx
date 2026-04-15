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
interface BreadthAnalysis {
  regime: { signal: "GREEN" | "AMBER" | "RED"; label: string };
  narrative: string;
  stance: string;
}

function generateBreadthAnalysis(dataRows: SheetsCell[][]): BreadthAnalysis | null {
  // Find the first valid data row (most recent)
  const latest = dataRows.find(
    (row) => row.length > COL.SP500 && typeof row[COL.UP_4_TODAY]?.value === "number",
  );
  if (!latest) return null;

  // Also get a few recent rows for trend context
  const recentRows = dataRows
    .filter((row) => row.length > COL.SP500 && typeof row[COL.UP_4_TODAY]?.value === "number")
    .slice(0, 5);

  const g = (ci: number) => getNumVal(latest, ci);
  const up4 = g(COL.UP_4_TODAY) ?? 0;
  const down4 = g(COL.DOWN_4_TODAY) ?? 0;
  const ratio5d = g(COL.RATIO_5D) ?? 1;
  const ratio10d = g(COL.RATIO_10D) ?? 1;
  const up25q = g(COL.UP_25_QTR) ?? 0;
  const down25q = g(COL.DOWN_25_QTR) ?? 0;
  const up25m = g(COL.UP_25_MTH) ?? 0;
  const down25m = g(COL.DOWN_25_MTH) ?? 0;
  const up50m = g(COL.UP_50_MTH) ?? 0;
  const down50m = g(COL.DOWN_50_MTH) ?? 0;
  const up13 = g(COL.UP_13_34D) ?? 0;
  const down13 = g(COL.DOWN_13_34D) ?? 0;
  const t2108 = g(COL.T2108) ?? 50;
  const sp = g(COL.SP500) ?? 0;

  // Compute quarterly net and monthly net
  const qtrBullish = up25q > down25q;
  const mthBullish = up25m > down25m;
  const intBullish = up13 > down13;

  // ── Regime ──
  let regimeSignal: "GREEN" | "AMBER" | "RED";
  let regimeLabel: string;

  if (qtrBullish && ratio10d >= 1 && t2108 > 20) {
    regimeSignal = "GREEN";
    regimeLabel = "UPTREND";
  } else if (!qtrBullish && ratio10d < 0.5) {
    regimeSignal = "RED";
    regimeLabel = "CORRECTION";
  } else if (!qtrBullish && !mthBullish && !intBullish) {
    regimeSignal = "RED";
    regimeLabel = "RISK-OFF";
  } else if (qtrBullish && ratio10d >= 0.5) {
    regimeSignal = "GREEN";
    regimeLabel = "TRENDING";
  } else {
    regimeSignal = "AMBER";
    regimeLabel = "CHOPPY";
  }

  // ── Narrative (max 3 sentences) ──
  const parts: string[] = [];

  if (regimeSignal === "GREEN") {
    // Sentence 1: primary trend
    if (qtrBullish && mthBullish) {
      parts.push(
        `Primary trend is bullish with quarterly breadth positive (${up25q.toLocaleString()} up vs ${down25q.toLocaleString()} down) and monthly breadth confirming.`,
      );
    } else {
      parts.push(
        `Quarterly breadth is positive (${up25q.toLocaleString()} up vs ${down25q.toLocaleString()} down) — primary trend supports longs.`,
      );
    }

    // Sentence 2: strongest supporting signal
    if (ratio10d >= 2) {
      parts.push(
        `10-day ratio at ${ratio10d.toFixed(2)}x shows strong buying dominance — breakouts have follow-through.`,
      );
    } else if (up4 >= 300) {
      parts.push(
        `${up4.toLocaleString()} stocks up 4%+ today signals a buying thrust — institutional accumulation is underway.`,
      );
    } else if (intBullish) {
      parts.push(
        `Intermediate breadth (13%/34d) is positive at ${up13.toLocaleString()} vs ${down13.toLocaleString()} — broad participation supports the rally.`,
      );
    } else if (t2108 > 60) {
      parts.push(
        `T2108 at ${t2108.toFixed(1)}% shows healthy participation above the 40-day MA.`,
      );
    }

    // Sentence 3: caution if frothy
    if (up50m >= 20) {
      parts.push(
        `Red Hot indicator at ${up50m} (${up50m >= 20 ? "≥20" : ""}) warns of overextension — scale into pullbacks rather than chasing.`,
      );
    } else if (t2108 > 79.99) {
      parts.push(
        `T2108 above 80% is overbought — expect mean reversion, tighten stops.`,
      );
    }
  } else if (regimeSignal === "RED") {
    // Sentence 1: bearish primary
    parts.push(
      `Primary trend is bearish with quarterly breadth negative (${up25q.toLocaleString()} up vs ${down25q.toLocaleString()} down) — breakouts are unreliable.`,
    );

    // Sentence 2: strongest bearish signal
    if (ratio10d < 0.5) {
      parts.push(
        `10-day ratio at ${ratio10d.toFixed(2)}x confirms selling dominance — breakdowns are accelerating.`,
      );
    } else if (down4 > 299) {
      parts.push(
        `${down4.toLocaleString()} stocks down 4%+ today signals capitulation selling — institutional distribution is heavy.`,
      );
    } else if (!intBullish) {
      parts.push(
        `Intermediate breadth (13%/34d) is negative at ${up13.toLocaleString()} vs ${down13.toLocaleString()} — damage is broad-based.`,
      );
    }

    // Sentence 3: bounce potential
    if (t2108 < 20) {
      parts.push(
        `T2108 at ${t2108.toFixed(1)}% is deeply oversold — watch for a 3-5 day reflex bounce but don't change bias.`,
      );
    } else if (down50m > 19) {
      parts.push(
        `${down50m} stocks down 50%+ in a month signals capitulation — a bounce is likely but the trend remains down.`,
      );
    }
  } else {
    // AMBER
    parts.push(
      `Market breadth is mixed — quarterly trend ${qtrBullish ? "positive" : "negative"} but short-term signals are conflicting.`,
    );

    if (ratio5d > 2 && !qtrBullish) {
      parts.push(
        `5-day ratio at ${ratio5d.toFixed(2)}x shows a short-term buying burst against a negative primary trend — potential trend reversal forming.`,
      );
    } else if (mthBullish && !qtrBullish) {
      parts.push(
        `Monthly breadth turning positive ahead of quarterly — watch for the primary flip to confirm a regime change.`,
      );
    } else if (qtrBullish && ratio10d < 1) {
      parts.push(
        `Short-term momentum fading despite positive quarterly breadth — pullback in progress, not a trend change.`,
      );
    }

    if (up50m >= 20) {
      parts.push(`Red Hot indicator at ${up50m} warns of near-term overextension.`);
    } else if (t2108 < 20) {
      parts.push(`T2108 at ${t2108.toFixed(1)}% is oversold — bounce conditions forming.`);
    }
  }

  // ── Stance ──
  let stance: string;
  const isOversold = t2108 < 20 || down50m > 19;

  if (regimeSignal === "GREEN") {
    if (up50m >= 20) {
      stance = "FULL SIZE — scale into pullbacks, don't chase";
    } else if (ratio10d >= 2 && qtrBullish && mthBullish) {
      stance = "FULL SIZE — press breakouts near highs";
    } else {
      stance = "FULL SIZE — buy pullbacks on strength";
    }
  } else if (regimeSignal === "AMBER") {
    stance = isOversold
      ? "TACTICAL BOUNCE — half size, 3-5 day swings"
      : "HALF SIZE — A+ setups only, tight stops";
  } else {
    stance = isOversold
      ? "DEFENSIVE + BOUNCE WATCH — bounce setups valid, cash otherwise"
      : "CASH / SHORT BIAS — wait for breadth improvement";
  }

  return {
    regime: { signal: regimeSignal, label: regimeLabel },
    narrative: parts.join(" "),
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
        <div className="flex items-center justify-between px-4 py-2 text-xs">
          <div className="flex items-center gap-4">
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

          <div className="flex items-center gap-3">
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
            className="rounded-lg p-3 border mb-3 max-w-[1600px] mx-auto"
            style={{ background: "var(--terminal-surface)", borderColor: "var(--terminal-border)" }}
          >
            <div className="flex items-center justify-between mb-2.5">
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
            <p className="text-[11px] leading-[1.6] opacity-80 mb-2.5">{breadthAnalysis.narrative}</p>
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
        )}

        {data && data.rows.length > 0 ? (
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--terminal-border)" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 z-10">
                  {groupSpans.length > 0 && (
                    <tr>
                      {groupSpans.map((span, idx) => (
                        <th key={idx} colSpan={span.colSpan}
                          className="px-3 py-2.5 text-center font-bold font-mono text-xs tracking-wider border-b border-r"
                          style={{ borderColor: "var(--terminal-border)", ...groupStyle(span.label) }}>
                          {span.label || "\u00a0"}
                        </th>
                      ))}
                    </tr>
                  )}
                  <tr style={{ background: "var(--terminal-surface)" }}>
                    {data.headers.map((h, idx) => (
                      <th key={idx}
                        className="px-3 py-2 text-left font-semibold font-mono text-[10px] tracking-wider border-b-2 border-r"
                        style={{ color: "var(--terminal-cyan)", borderColor: "var(--terminal-border)", maxWidth: 130, whiteSpace: "normal", lineHeight: "1.3" }}>
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
                          return (
                            <td key={ci}
                              className="px-3 py-1.5 font-mono text-xs border-r whitespace-nowrap"
                              style={{
                                ...computed,
                                borderColor: "var(--terminal-border)",
                                textAlign: typeof cell.value === "number" ? "right" : "left",
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
