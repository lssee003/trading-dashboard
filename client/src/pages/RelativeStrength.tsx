import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useCallback } from "react";
import type { RSResponse, RSTickerData } from "@shared/schema";
import { RSHistogram } from "../components/RSHistogram";
import { RRGChart } from "../components/RRGChart";
import { computeRRGData } from "@/lib/rrg";
import { useTheme } from "@/hooks/useTheme";
import { Link } from "wouter";
import {
  RefreshCw, Search, Sun, Moon, X, Plus, Download,
  ArrowUpDown, TrendingUp, TrendingDown, BarChart3, Activity, Table, Orbit,
} from "lucide-react";
import {
  LOOKBACK_OPTIONS,
  BENCHMARK_OPTIONS,
  CATEGORY_FILTERS,
  type CategoryFilter,
} from "@/lib/rsConstants";

const IS_STATIC = import.meta.env.VITE_DATA_MODE === "static";

type SortKey = "symbol" | "name" | "category" | "latestClose" | "returnPct" | "rsVsBenchmark" | "rsPulse";
type SortDir = "asc" | "desc";

/** RS Pulse: where today's RS sits within the lookback window's range. */
function computeRsPulse(histogram: number[]): number | null {
  if (!histogram || histogram.length < 3) return null;
  const lo = Math.min(...histogram);
  const hi = Math.max(...histogram);
  if (hi === lo) return 50; // flat range → neutral
  const today = histogram[histogram.length - 1];
  return ((today - lo) / (hi - lo)) * 100;
}

function pulseColor(pulse: number | null): string {
  if (pulse === null) return "var(--text-muted)";
  if (pulse >= 80) return "var(--terminal-green)";
  if (pulse >= 50) return "var(--terminal-amber)";
  return "var(--terminal-red)";
}

function formatPulse(pulse: number | null): string {
  if (pulse === null) return "—";
  return `${Math.round(pulse)}%`;
}

const RS_PULSE_TOOLTIP = "RS Pulse shows where today's RS ranks within the selected window's range. >80% = momentum still accelerating.";

export default function RelativeStrength() {
  const { theme, toggleTheme } = useTheme();

  // Controls
  const [benchmark, setBenchmark] = useState("SPY");
  const [lookback, setLookback] = useState(25);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [extraTickers, setExtraTickers] = useState<string[]>([]);
  const [tickerInput, setTickerInput] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("rsVsBenchmark");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [viewMode, setViewMode] = useState<"table" | "rrg">("table");

  // Build query string
  const extraParam = extraTickers.length > 0 ? extraTickers.join(",") : "";
  const queryKeyPath = `/api/relative-strength?benchmark=${benchmark}&lookback=${lookback}${extraParam ? `&extra=${extraParam}` : ""}`;

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<RSResponse>({
    queryKey: ["/api/relative-strength", `?benchmark=${benchmark}&lookback=${lookback}${extraParam ? `&extra=${extraParam}` : ""}`],
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  // Add ticker
  const handleAddTicker = useCallback(() => {
    const sym = tickerInput.trim().toUpperCase();
    if (sym && !extraTickers.includes(sym)) {
      setExtraTickers((prev) => [...prev, sym]);
    }
    setTickerInput("");
  }, [tickerInput, extraTickers]);

  const handleRemoveTicker = useCallback((sym: string) => {
    setExtraTickers((prev) => prev.filter((s) => s !== sym));
  }, []);

  // Sorting
  const handleSort = useCallback((key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "symbol" || key === "name" || key === "category" ? "asc" : "desc");
    }
  }, [sortKey]);

  // Pre-compute RS Pulse for every ticker
  const tickerPulseMap = useMemo(() => {
    const map = new Map<string, number | null>();
    if (data?.tickers) {
      for (const t of data.tickers) {
        map.set(t.symbol, computeRsPulse(t.histogram));
      }
    }
    return map;
  }, [data]);

  // RRG data (computed from tickers when in RRG view)
  const rrgData = useMemo(() => {
    if (!data?.tickers || viewMode !== "rrg") return [];
    const tickers = categoryFilter !== "All"
      ? data.tickers.filter((t) => t.category === categoryFilter)
      : data.tickers;
    return computeRRGData(tickers, lookback);
  }, [data, viewMode, categoryFilter, lookback]);

  // Filter + sort
  const filteredData = useMemo(() => {
    if (!data?.tickers) return [];

    let items = data.tickers;

    // Category filter
    if (categoryFilter !== "All") {
      items = items.filter((t) => t.category === categoryFilter);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (t) =>
          t.symbol.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q)
      );
    }

    // Sort
    const sorted = [...items].sort((a, b) => {
      if (sortKey === "rsPulse") {
        const ap = tickerPulseMap.get(a.symbol) ?? -1;
        const bp = tickerPulseMap.get(b.symbol) ?? -1;
        return sortDir === "asc" ? ap - bp : bp - ap;
      }
      const key = sortKey as keyof RSTickerData;
      let av: string | number = a[key] as string | number;
      let bv: string | number = b[key] as string | number;
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [data, categoryFilter, searchQuery, sortKey, sortDir, tickerPulseMap]);

  // Leaders / laggards (top 5 / bottom 5 by RS)
  const { leaders, laggards } = useMemo(() => {
    if (!data?.tickers || data.tickers.length === 0) return { leaders: [], laggards: [] };
    const sorted = [...data.tickers].sort((a, b) => b.rsVsBenchmark - a.rsVsBenchmark);
    return {
      leaders: sorted.slice(0, 5),
      laggards: sorted.slice(-5).reverse(),
    };
  }, [data]);

  // CSV export
  const handleExport = useCallback(() => {
    if (!filteredData.length) return;
    const headers = ["Symbol", "Name", "Category", "Close", `${lookback}D Return %`, `RS vs ${benchmark}`, "RS Pulse %"];
    const rows = filteredData.map((t) => {
      const pulse = tickerPulseMap.get(t.symbol);
      return [
        t.symbol,
        t.name,
        t.category,
        t.latestClose.toFixed(2),
        t.returnPct.toFixed(2),
        t.rsVsBenchmark.toFixed(4),
        pulse !== null && pulse !== undefined ? Math.round(pulse).toString() : "—",
      ];
    });
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relative-strength-${benchmark}-${lookback}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredData, benchmark, lookback]);

  // Column header helper
  const SortHeader = ({ label, sortKeyVal, className = "" }: { label: string; sortKeyVal: SortKey; className?: string }) => (
    <th
      className={`px-3 py-2 text-left text-[10px] tracking-wider uppercase cursor-pointer select-none whitespace-nowrap ${className}`}
      style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--terminal-border)" }}
      onClick={() => handleSort(sortKeyVal)}
      data-testid={`sort-${sortKeyVal}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === sortKeyVal && (
          <ArrowUpDown className="w-2.5 h-2.5" style={{ color: "var(--terminal-cyan)" }} />
        )}
      </span>
    </th>
  );

  // RS color helper
  const rsColor = (rs: number) =>
    rs >= 1.02 ? "var(--terminal-green)" : rs <= 0.98 ? "var(--terminal-red)" : "var(--text-secondary)";

  const returnColor = (ret: number) =>
    ret > 0.5 ? "var(--terminal-green)" : ret < -0.5 ? "var(--terminal-red)" : "var(--text-secondary)";

  // ─── Error state ───
  if (isError) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: "var(--terminal-bg)" }}>
        <div className="text-center p-8 rounded-lg border" style={{ borderColor: "var(--terminal-border)", background: "var(--terminal-surface)" }}>
          <Activity className="w-12 h-12 mx-auto mb-4 opacity-40" />
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--terminal-amber)" }}>DATA FEED ERROR</h2>
          <p className="text-sm opacity-60 mb-4 max-w-md">{(error as Error)?.message || "Failed to load RS data"}</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 rounded text-sm font-medium transition-colors"
            style={{ background: "var(--terminal-blue)", color: "#fff" }}
            data-testid="button-retry"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col" style={{ background: "var(--terminal-bg)" }}>
      {/* ─── Header ─── */}
      <header
        className="flex-shrink-0 border-b"
        style={{ borderColor: "var(--terminal-border)", background: "var(--terminal-surface)" }}
      >
        <div className="flex items-center justify-between px-4 py-2 text-xs gap-2">
          <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto flex-1 min-w-0" style={{ scrollbarWidth: "none" }}>
            {/* Logo */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-label="Trading Dashboard Logo">
              <rect x="2" y="2" width="20" height="20" rx="3" stroke="var(--terminal-cyan)" strokeWidth="1.5"/>
              <path d="M6 16 L10 10 L14 13 L18 6" stroke="var(--terminal-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="18" cy="6" r="1.5" fill="var(--terminal-green)"/>
            </svg>

            {/* Nav tabs */}
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-1 rounded transition-colors"
              style={{ color: "var(--terminal-dim)", background: "transparent", border: "1px solid var(--terminal-border)" }}
              data-testid="link-home"
            >
              <span className="font-bold tracking-wide">MARKET MONITOR</span>
            </Link>

            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded"
              style={{ color: "#fff", background: "var(--terminal-blue)" }}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="font-bold tracking-wide">RELATIVE STRENGTH</span>
            </div>

            <Link
              href="/market-breadth"
              className="flex items-center gap-1.5 px-3 py-1 rounded transition-colors"
              style={{ color: "var(--terminal-dim)", background: "transparent", border: "1px solid var(--terminal-border)" }}
              data-testid="link-market-breadth"
            >
              <Table className="w-3.5 h-3.5" />
              <span className="font-bold tracking-wide">MARKET BREADTH</span>
            </Link>

            {/* Status */}
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${IS_STATIC ? "" : "pulse-live"}`}
                style={{
                  background: IS_STATIC
                    ? "var(--terminal-cyan)"
                    : (isFetching ? "var(--terminal-amber)" : "var(--terminal-green)")
                }}
              />
              <span style={{
                color: IS_STATIC
                  ? "var(--terminal-cyan)"
                  : (isFetching ? "var(--terminal-amber)" : "var(--terminal-green)")
              }}>
                {IS_STATIC
                  ? "SNAPSHOT"
                  : (isFetching ? "LOADING" : "LIVE")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded transition-colors opacity-60 hover:opacity-100"
              data-testid="button-theme-toggle"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={() => refetch()}
              className="p-1.5 rounded transition-colors opacity-60 hover:opacity-100"
              data-testid="button-refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="flex-1 overflow-y-auto p-3 md:p-4">
        <div className="max-w-[1600px] mx-auto space-y-3">

          {/* ─── Controls Row ─── */}
          <div
            className="rounded-lg border p-3"
            style={{ background: "var(--terminal-surface)", borderColor: "var(--terminal-border)" }}
          >
            <div className="flex flex-wrap items-center gap-3">
              {/* View toggle — far left. RRG is a standalone button so box-shadow isn't clipped. */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>View</span>
                <div className="flex items-center gap-1">
                  {/* Table button */}
                  <button
                    onClick={() => setViewMode("table")}
                    className="px-2 py-1 text-[11px] font-medium transition-all flex items-center gap-1 rounded"
                    style={{
                      background: viewMode === "table" ? "var(--terminal-blue)" : "transparent",
                      color: viewMode === "table" ? "#fff" : "var(--terminal-dim)",
                      border: "1px solid var(--terminal-border)",
                    }}
                    data-testid="view-table"
                  >
                    <Table className="w-3 h-3" />
                    Table
                  </button>

                  {/* RRG button — standalone so glow box-shadow is never clipped */}
                  <button
                    onClick={() => { setViewMode("rrg"); setBenchmark("SPY"); setLookback(10); setCategoryFilter("Sector"); }}
                    title="View Relative Rotation Graph"
                    className="px-2 py-1 text-[11px] font-medium flex items-center gap-1 rounded"
                    style={{
                      background: viewMode === "rrg" ? "#0ea5e9" : "transparent",
                      color: viewMode === "rrg" ? "#fff" : "#38bdf8",
                      border: viewMode === "rrg" ? "1px solid #0ea5e9" : "1px solid #38bdf8",
                      boxShadow: viewMode === "table"
                        ? "0 0 12px 3px rgba(56,189,248,0.7), 0 0 4px 1px rgba(14,165,233,1)"
                        : "none",
                      transition: "box-shadow 0.2s, background 0.2s, filter 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      if (viewMode === "table") {
                        (e.currentTarget as HTMLElement).style.boxShadow = "0 0 20px 5px rgba(56,189,248,0.9), 0 0 6px 2px rgba(14,165,233,1)";
                        (e.currentTarget as HTMLElement).style.filter = "brightness(1.25)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.filter = "";
                      (e.currentTarget as HTMLElement).style.boxShadow = viewMode === "table"
                        ? "0 0 12px 3px rgba(56,189,248,0.7), 0 0 4px 1px rgba(14,165,233,1)"
                        : "none";
                    }}
                    data-testid="view-rrg"
                  >
                    <Orbit className="w-3 h-3" />
                    RRG
                  </button>
                </div>
              </div>

              {/* Benchmark selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Bench</span>
                <div className="flex rounded overflow-hidden" style={{ border: "1px solid var(--terminal-border)" }}>
                  {BENCHMARK_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setBenchmark(opt.value)}
                      className="px-2 py-1 text-[11px] font-medium transition-all"
                      style={{
                        background: benchmark === opt.value ? "var(--terminal-blue)" : "transparent",
                        color: benchmark === opt.value ? "#fff" : "var(--terminal-dim)",
                      }}
                      data-testid={`bench-${opt.value}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lookback selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Window</span>
                <div className="flex rounded overflow-hidden" style={{ border: "1px solid var(--terminal-border)" }}>
                  {LOOKBACK_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setLookback(opt.value)}
                      className="px-2 py-1 text-[11px] font-medium transition-all"
                      style={{
                        background: lookback === opt.value ? "var(--terminal-blue)" : "transparent",
                        color: lookback === opt.value ? "#fff" : "var(--terminal-dim)",
                      }}
                      data-testid={`lookback-${opt.value}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Filter</span>
                <div className="flex rounded overflow-hidden" style={{ border: "1px solid var(--terminal-border)" }}>
                  {CATEGORY_FILTERS.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className="px-2 py-1 text-[11px] font-medium transition-all"
                      style={{
                        background: categoryFilter === cat ? "var(--terminal-blue)" : "transparent",
                        color: categoryFilter === cat ? "#fff" : "var(--terminal-dim)",
                      }}
                      data-testid={`filter-${cat}`}
                    >
                      {cat === "Industry Group" ? "Industry" : cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search */}
              <div className="flex items-center gap-1.5 flex-1 min-w-[140px]">
                <div
                  className="flex items-center gap-1.5 px-2 py-1 rounded flex-1"
                  style={{ background: "var(--overlay-subtle)", border: "1px solid var(--terminal-border)" }}
                >
                  <Search className="w-3 h-3 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search symbol or name"
                    className="bg-transparent text-[11px] outline-none flex-1 min-w-0"
                    style={{ color: "var(--text-primary)" }}
                    data-testid="input-search"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="opacity-40 hover:opacity-100">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Add ticker */}
              <div className="flex items-center gap-1">
                <div
                  className="flex items-center gap-1 px-2 py-1 rounded"
                  style={{ background: "var(--overlay-subtle)", border: "1px solid var(--terminal-border)" }}
                >
                  <Plus className="w-3 h-3 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                  <input
                    type="text"
                    value={tickerInput}
                    onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && handleAddTicker()}
                    placeholder="Add ticker"
                    className="bg-transparent text-[11px] outline-none w-[70px]"
                    style={{ color: "var(--text-primary)" }}
                    data-testid="input-add-ticker"
                  />
                </div>
                <button
                  onClick={handleAddTicker}
                  className="px-2 py-1 rounded text-[11px] font-medium transition-colors"
                  style={{ background: "var(--terminal-blue)", color: "#fff" }}
                  data-testid="button-add-ticker"
                >
                  Add
                </button>
              </div>

              {/* Export */}
              <button
                onClick={handleExport}
                className="p-1.5 rounded transition-colors opacity-60 hover:opacity-100"
                title="Export to CSV"
                data-testid="button-export"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Extra tickers chips */}
            {extraTickers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2 pt-2" style={{ borderTop: "1px solid var(--terminal-border)" }}>
                <span className="text-[10px] uppercase tracking-wider self-center" style={{ color: "var(--text-muted)" }}>Added:</span>
                {extraTickers.map((sym) => (
                  <span
                    key={sym}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium"
                    style={{ background: "var(--chip-bg)", color: "var(--text-primary)" }}
                  >
                    {sym}
                    <button
                      onClick={() => handleRemoveTicker(sym)}
                      className="opacity-50 hover:opacity-100"
                      data-testid={`remove-${sym}`}
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ─── Leaders / Laggards Summary ─── */}
          {data && !isLoading && viewMode === "table" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Leaders */}
              <div
                className="rounded-lg border p-3"
                style={{ background: "var(--terminal-surface)", borderColor: "var(--terminal-border)" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-3.5 h-3.5" style={{ color: "var(--terminal-green)" }} />
                  <span className="text-[10px] font-bold tracking-wider uppercase" style={{ color: "var(--terminal-green)" }}>
                    RS LEADERS
                  </span>
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Top 5 vs {benchmark}</span>
                </div>
                <div className="space-y-1">
                  {leaders.map((t, i) => (
                    <div key={t.symbol} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="w-4 text-right" style={{ color: "var(--text-muted)" }}>{i + 1}</span>
                        <span className="font-bold" style={{ color: "var(--text-primary)" }}>{t.symbol}</span>
                        <span style={{ color: "var(--text-muted)" }}>{t.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span style={{ color: returnColor(t.returnPct) }}>
                          {t.returnPct > 0 ? "+" : ""}{t.returnPct.toFixed(2)}%
                        </span>
                        <span className="font-bold" style={{ color: "var(--terminal-green)" }}>
                          {t.rsVsBenchmark.toFixed(3)}
                        </span>
                        <span className="text-[10px]" style={{ color: pulseColor(tickerPulseMap.get(t.symbol) ?? null) }}>
                          {formatPulse(tickerPulseMap.get(t.symbol) ?? null)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Laggards */}
              <div
                className="rounded-lg border p-3"
                style={{ background: "var(--terminal-surface)", borderColor: "var(--terminal-border)" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="w-3.5 h-3.5" style={{ color: "var(--terminal-red)" }} />
                  <span className="text-[10px] font-bold tracking-wider uppercase" style={{ color: "var(--terminal-red)" }}>
                    RS LAGGARDS
                  </span>
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Bottom 5 vs {benchmark}</span>
                </div>
                <div className="space-y-1">
                  {laggards.map((t, i) => (
                    <div key={t.symbol} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="w-4 text-right" style={{ color: "var(--text-muted)" }}>{data.tickers.length - i}</span>
                        <span className="font-bold" style={{ color: "var(--text-primary)" }}>{t.symbol}</span>
                        <span style={{ color: "var(--text-muted)" }}>{t.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span style={{ color: returnColor(t.returnPct) }}>
                          {t.returnPct > 0 ? "+" : ""}{t.returnPct.toFixed(2)}%
                        </span>
                        <span className="font-bold" style={{ color: "var(--terminal-red)" }}>
                          {t.rsVsBenchmark.toFixed(3)}
                        </span>
                        <span className="text-[10px]" style={{ color: pulseColor(tickerPulseMap.get(t.symbol) ?? null) }}>
                          {formatPulse(tickerPulseMap.get(t.symbol) ?? null)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ─── Status bar ─── */}
          {data && (
            <div className="flex items-center justify-between text-[10px] px-1" style={{ color: "var(--text-muted)" }}>
              <span>
                {filteredData.length} of {data.tickers.length} symbols · {lookback}D window · vs {benchmark}
                {data.failedSymbols.length > 0 && (
                  <span style={{ color: "var(--terminal-amber)" }}>
                    {" "}· {data.failedSymbols.length} failed: {data.failedSymbols.slice(0, 5).join(", ")}
                    {data.failedSymbols.length > 5 && "…"}
                  </span>
                )}
              </span>
              <span>Updated {new Date(data.lastUpdated).toLocaleTimeString()}</span>
            </div>
          )}

          {/* ─── RRG Chart or Data Table ─── */}
          {viewMode === "rrg" && data && !isLoading ? (
            <RRGChart data={rrgData} benchmark={benchmark} lookback={lookback} />
          ) : (
          <div
            className="rounded-lg border overflow-hidden"
            style={{ background: "var(--terminal-surface)", borderColor: "var(--terminal-border)" }}
          >
            {isLoading ? (
              <div className="p-8 space-y-3">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="skeleton-terminal rounded h-6" />
                ))}
              </div>
            ) : filteredData.length === 0 ? (
              <div className="p-8 text-center">
                <BarChart3 className="w-8 h-8 mx-auto mb-3 opacity-20" />
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {searchQuery || categoryFilter !== "All" ? "No symbols match your filter" : "No data available"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]" data-testid="rs-table">
                  <thead>
                    <tr style={{ background: "var(--overlay-subtle)" }}>
                      <th
                        className="px-3 py-2 text-left text-[10px] tracking-wider uppercase w-6"
                        style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--terminal-border)" }}
                      >
                        #
                      </th>
                      <SortHeader label="Symbol" sortKeyVal="symbol" />
                      <SortHeader label="Name" sortKeyVal="name" className="hidden md:table-cell" />
                      <SortHeader label="Category" sortKeyVal="category" className="hidden lg:table-cell" />
                      <SortHeader label="Close" sortKeyVal="latestClose" />
                      <SortHeader label={`${lookback}D Ret`} sortKeyVal="returnPct" />
                      <SortHeader label={`RS vs ${benchmark}`} sortKeyVal="rsVsBenchmark" />
                      <th
                        className="px-3 py-2 text-left text-[10px] tracking-wider uppercase cursor-pointer select-none whitespace-nowrap"
                        style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--terminal-border)" }}
                        onClick={() => handleSort("rsPulse" as SortKey)}
                        title={RS_PULSE_TOOLTIP}
                        data-testid="sort-rsPulse"
                      >
                        <span className="inline-flex items-center gap-1">
                          RS Pulse
                          {sortKey === "rsPulse" && (
                            <ArrowUpDown className="w-2.5 h-2.5" style={{ color: "var(--terminal-cyan)" }} />
                          )}
                        </span>
                      </th>
                      <th
                        className="px-3 py-2 text-left text-[10px] tracking-wider uppercase"
                        style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--terminal-border)" }}
                      >
                        RS Histogram
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((t, idx) => (
                      <tr
                        key={t.symbol}
                        className="transition-colors"
                        style={{
                          borderBottom: "1px solid var(--terminal-border)",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.background = "var(--overlay-subtle)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background = "transparent";
                        }}
                        data-testid={`row-${t.symbol}`}
                      >
                        <td className="px-3 py-1.5" style={{ color: "var(--text-muted)" }}>
                          {idx + 1}
                        </td>
                        <td className="px-3 py-1.5">
                          <span className="font-bold" style={{ color: "var(--text-primary)" }}>
                            {t.symbol}
                          </span>
                          {/* Show name on mobile under symbol */}
                          <span className="md:hidden block text-[10px]" style={{ color: "var(--text-muted)" }}>
                            {t.name}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 hidden md:table-cell" style={{ color: "var(--text-secondary)" }}>
                          {t.name}
                        </td>
                        <td className="px-3 py-1.5 hidden lg:table-cell">
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px]"
                            style={{
                              background: "var(--chip-bg)",
                              color: "var(--text-secondary)",
                            }}
                          >
                            {t.category}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right" style={{ color: "var(--text-primary)" }}>
                          {t.latestClose.toFixed(2)}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <span style={{ color: returnColor(t.returnPct) }}>
                            {t.returnPct > 0 ? "+" : ""}{t.returnPct.toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <span className="font-bold" style={{ color: rsColor(t.rsVsBenchmark) }}>
                            {t.rsVsBenchmark.toFixed(3)}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right" title={RS_PULSE_TOOLTIP} data-testid={`pulse-${t.symbol}`}>
                          {(() => {
                            const pulse = tickerPulseMap.get(t.symbol) ?? null;
                            return (
                              <span className="font-bold" style={{ color: pulseColor(pulse) }}>
                                {formatPulse(pulse)}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-1.5">
                          <RSHistogram data={t.histogram} width={110} height={24} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          )}
        </div>
      </main>

      {/* ─── Footer ─── */}
      <footer
        className="flex-shrink-0 px-4 py-2 text-center text-xs opacity-30 border-t"
        style={{ borderColor: "var(--terminal-border)" }}
      >
        Relative Strength vs {benchmark} · {lookback}-day window · Yahoo Finance (delayed ~15min)
      </footer>
    </div>
  );
}
