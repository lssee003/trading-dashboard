/**
 * StockRSTab — IBD-style per-stock RS percentile rankings (0-99).
 *
 * Data: daily CSVs computed by github.com/lssee003/relative-strength,
 * served via /api/rs-stocks (or the rs-stocks.json snapshot in static mode).
 *
 * Two presentations:
 *  - Stocks: flat ranked table, windowed rendering (all ~5,900 rows scroll
 *    inside a sticky-header viewport without a row cap).
 *  - Industries: master-detail split — left rail ranks all industry groups
 *    with RS micro-bars; right panel shows the selected group's members.
 */
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useCallback, useRef, useEffect, type ReactNode } from "react";
import type { RSStocksResponse, RSStock, RSIndustry } from "@shared/schema";
import { Search, X, Download, ArrowUpDown, BarChart3, Activity, List, Layers } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type StockSortKey = "rank" | "ticker" | "industry" | "rsPercentile" | "rs1M" | "rs3M" | "rs6M" | "price" | "marketCap" | "pctFrom52WkHigh" | "avgVol30";
type SortDir = "asc" | "desc";

const RS_MIN_OPTIONS = [0, 70, 80, 90] as const;
const MKT_CAP_OPTIONS = [
  { value: 0, label: "Any" },
  { value: 200e6, label: "200M" },
  { value: 500e6, label: "500M" },
  { value: 1e9, label: "1B" },
  { value: 10e9, label: "10B" },
] as const;
const ROW_H = 30; // fixed data-row height (px) — required for windowed rendering
const OVERSCAN = 12;

function rsRatingColor(p: number): string {
  if (p >= 90) return "var(--terminal-green)";
  if (p >= 70) return "var(--terminal-amber)";
  if (p < 40) return "var(--terminal-red)";
  return "var(--text-secondary)";
}

function formatMarketCap(v: number | null): string {
  if (v === null) return "—";
  if (v >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
  return v.toFixed(0);
}

function formatVolume(v: number | null): string {
  if (v === null) return "—";
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toFixed(0);
}

function formatNullable(v: number | null, digits = 0): string {
  return v === null ? "—" : v.toFixed(digits);
}

const selectTriggerStyle = {
  background: "var(--overlay-subtle)",
  border: "1px solid var(--terminal-border)",
  color: "var(--text-primary)",
} as const;

const thStyle = { color: "var(--text-muted)", borderBottom: "1px solid var(--terminal-border)" } as const;

export function StockRSTab({ universeSwitch }: { universeSwitch?: ReactNode }) {
  const [view, setView] = useState<"stocks" | "industries">("stocks");
  const [sector, setSector] = useState<string>("All");
  const [industry, setIndustry] = useState<string>("All");
  const [minRS, setMinRS] = useState<number>(0);
  const [minMktCap, setMinMktCap] = useState<number>(200e6);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<StockSortKey>("rsPercentile");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery<RSStocksResponse>({
    queryKey: ["/api/rs-stocks"],
    staleTime: 60 * 60 * 1000, // ratings change once per trading day
    refetchInterval: false,
  });

  // Sector list from the data itself (11 Yahoo sectors)
  const sectors = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.stocks.map(s => s.sector))).sort();
  }, [data]);

  // Industries for the picked sector, ordered by industry RS rank (strongest first)
  const industries = useMemo(() => {
    if (!data) return [];
    const inSector = sector === "All"
      ? data.industries
      : data.industries.filter(i => i.sector === sector);
    return [...inSector].sort((a, b) => a.rank - b.rank);
  }, [data, sector]);

  const handleSectorChange = useCallback((value: string) => {
    setSector(value);
    setIndustry("All");
  }, []);

  const handleSort = useCallback((key: StockSortKey) => {
    if (key === sortKey) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "ticker" || key === "industry" || key === "rank" ? "asc" : "desc");
    }
  }, [sortKey]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let items = data.stocks;
    if (sector !== "All") items = items.filter(s => s.sector === sector);
    if (industry !== "All") items = items.filter(s => s.industry === industry);
    if (minRS > 0) items = items.filter(s => s.rsPercentile >= minRS);
    if (minMktCap > 0) items = items.filter(s => s.marketCap !== null && s.marketCap >= minMktCap);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toUpperCase();
      items = items.filter(s => s.ticker.includes(q));
    }
    const sorted = [...items].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = (av ?? -Infinity) as number;
      const bn = (bv ?? -Infinity) as number;
      return sortDir === "asc" ? an - bn : bn - an;
    });
    return sorted;
  }, [data, sector, industry, minRS, minMktCap, searchQuery, sortKey, sortDir]);

  // Industry percentile chip for the selected industry (flat view)
  const selectedIndustryMeta = useMemo(() => {
    if (!data || industry === "All") return null;
    return data.industries.find(i => i.industry === industry) ?? null;
  }, [data, industry]);

  // ─── Industries master-detail ───
  const tickerMap = useMemo(() => {
    const map = new Map<string, RSStock>();
    if (data) for (const s of data.stocks) map.set(s.ticker, s);
    return map;
  }, [data]);

  // Rail list: sector filter + search (matches industry name or a member ticker)
  const railIndustries = useMemo(() => {
    if (!data) return [];
    let items = data.industries;
    if (sector !== "All") items = items.filter(i => i.sector === sector);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toUpperCase();
      items = items.filter(i =>
        i.industry.toUpperCase().includes(q) || i.tickers.some(t => t.includes(q))
      );
    }
    return [...items].sort((a, b) => a.rank - b.rank);
  }, [data, sector, searchQuery]);

  // Keep a valid selection as filters change
  useEffect(() => {
    if (view !== "industries" || railIndustries.length === 0) return;
    if (!selectedIndustry || !railIndustries.some(i => i.industry === selectedIndustry)) {
      setSelectedIndustry(railIndustries[0].industry);
    }
  }, [view, railIndustries, selectedIndustry]);

  const detailIndustry = useMemo(() => {
    if (!selectedIndustry || !data) return null;
    return data.industries.find(i => i.industry === selectedIndustry) ?? null;
  }, [data, selectedIndustry]);

  const detailMembers = useMemo(() => {
    if (!detailIndustry) return [];
    const members: RSStock[] = [];
    for (const t of detailIndustry.tickers) {
      const s = tickerMap.get(t);
      if (!s) continue;
      if (minRS > 0 && s.rsPercentile < minRS) continue;
      if (minMktCap > 0 && (s.marketCap === null || s.marketCap < minMktCap)) continue;
      members.push(s);
    }
    return members;
  }, [detailIndustry, tickerMap, minRS, minMktCap]);

  // Keyboard navigation on the rail
  const railRef = useRef<HTMLDivElement>(null);
  const handleRailKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const idx = railIndustries.findIndex(i => i.industry === selectedIndustry);
    const next = e.key === "ArrowDown" ? Math.min(idx + 1, railIndustries.length - 1) : Math.max(idx - 1, 0);
    if (next !== idx && railIndustries[next]) {
      setSelectedIndustry(railIndustries[next].industry);
      railRef.current
        ?.querySelector(`[data-industry="${CSS.escape(railIndustries[next].industry)}"]`)
        ?.scrollIntoView({ block: "nearest" });
    }
  }, [railIndustries, selectedIndustry]);

  const handleExport = useCallback(() => {
    const rowsSource = view === "industries" ? detailMembers : filtered;
    if (!rowsSource.length) return;
    const headers = ["Rank", "Ticker", "Sector", "Industry", "RS", "1M", "3M", "6M", "Price", "MarketCap", "PctFrom52WkHigh", "AvgVol30"];
    const rows = rowsSource.map(s => [
      s.rank, s.ticker, s.sector, `"${s.industry}"`, s.rsPercentile,
      s.rs1M ?? "", s.rs3M ?? "", s.rs6M ?? "",
      s.price ?? "", s.marketCap ?? "", s.pctFrom52WkHigh ?? "", s.avgVol30 ?? "",
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const scope = view === "industries" ? selectedIndustry : [sector !== "All" && sector, industry !== "All" && industry].filter(Boolean).join("-");
    a.download = `stock-rs${scope ? `-${scope}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [view, detailMembers, filtered, sector, industry, selectedIndustry]);

  const SortHeader = ({ label, sortKeyVal, className = "", align = "left" }: { label: string; sortKeyVal: StockSortKey; className?: string; align?: "left" | "right" }) => (
    <th
      className={`px-3 py-2 text-${align} text-[10px] tracking-wider uppercase cursor-pointer select-none whitespace-nowrap ${className}`}
      style={thStyle}
      onClick={() => handleSort(sortKeyVal)}
      data-testid={`stock-sort-${sortKeyVal}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === sortKeyVal && (
          <ArrowUpDown className="w-2.5 h-2.5" style={{ color: "var(--terminal-cyan)" }} />
        )}
      </span>
    </th>
  );

  if (isError) {
    return (
      <div
        className="rounded-lg border p-8 text-center glass-panel"
        style={{ background: "var(--terminal-surface)", borderColor: "var(--terminal-border)" }}
      >
        <Activity className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--text-faint)" }} />
        <p className="text-sm font-bold mb-1" style={{ color: "var(--terminal-amber)" }}>STOCK RS FEED ERROR</p>
        <p className="text-[11px] mb-3" style={{ color: "var(--text-secondary)" }}>{(error as Error)?.message || "Failed to load stock RS data"}</p>
        <button
          onClick={() => refetch()}
          className="seg-active px-3 py-1.5 rounded text-[11px] font-medium"
          style={{ background: "var(--terminal-blue)", color: "#fff" }}
          data-testid="stock-rs-retry"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      {/* ─── Controls ─── */}
      <div
        className="rounded-lg border p-3 glass-panel"
        style={{ background: "var(--terminal-surface)", borderColor: "var(--terminal-border)" }}
      >
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 min-h-[1.75rem]">
          {universeSwitch}

          {/* View: flat stock list vs industry groups */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>View</span>
            <div className="flex rounded overflow-hidden" style={{ border: "1px solid var(--terminal-border)" }}>
              {([
                { id: "stocks" as const, label: "Stocks", Icon: List },
                { id: "industries" as const, label: "Industries", Icon: Layers },
              ]).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setView(id)}
                  className={`px-2 py-1 text-[11px] font-medium transition-all flex items-center gap-1${view === id ? " seg-active" : ""}`}
                  style={{
                    background: view === id ? "var(--terminal-blue)" : "transparent",
                    color: view === id ? "#fff" : "var(--terminal-dim)",
                  }}
                  data-testid={`stock-view-${id}`}
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Sector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Sector</span>
            <Select value={sector} onValueChange={handleSectorChange}>
              <SelectTrigger className="h-7 w-[140px] rounded text-[11px] px-2 py-1" style={selectTriggerStyle} data-testid="select-sector">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All" className="text-[11px]">All Sectors</SelectItem>
                {sectors.map(s => (
                  <SelectItem key={s} value={s} className="text-[11px]">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Industry — ordered by industry RS rank (flat stock view only; the rail replaces it in industry view) */}
          {view === "stocks" && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Industry</span>
            <Select value={industry} onValueChange={setIndustry}>
              <SelectTrigger className="h-7 w-[190px] rounded text-[11px] px-2 py-1" style={selectTriggerStyle} data-testid="select-industry">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All" className="text-[11px]">All Industries</SelectItem>
                {industries.map(i => (
                  <SelectItem key={i.industry} value={i.industry} className="text-[11px]">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="font-bold tabular-nums" style={{ color: rsRatingColor(i.rsPercentile) }}>{i.rsPercentile}</span>
                      {i.industry}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          )}

          {/* Min RS */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>RS ≥</span>
            <div className="flex rounded overflow-hidden" style={{ border: "1px solid var(--terminal-border)" }}>
              {RS_MIN_OPTIONS.map(v => (
                <button
                  key={v}
                  onClick={() => setMinRS(v)}
                  className={`px-2 py-1 text-[11px] font-medium transition-all${minRS === v ? " seg-active" : ""}`}
                  style={{
                    background: minRS === v ? "var(--terminal-blue)" : "transparent",
                    color: minRS === v ? "#fff" : "var(--terminal-dim)",
                  }}
                  data-testid={`min-rs-${v}`}
                >
                  {v === 0 ? "All" : v}
                </button>
              ))}
            </div>
          </div>

          {/* Min market cap */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Mkt Cap ≥</span>
            <div className="flex rounded overflow-hidden" style={{ border: "1px solid var(--terminal-border)" }}>
              {MKT_CAP_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setMinMktCap(value)}
                  className={`px-2 py-1 text-[11px] font-medium transition-all${minMktCap === value ? " seg-active" : ""}`}
                  style={{
                    background: minMktCap === value ? "var(--terminal-blue)" : "transparent",
                    color: minMktCap === value ? "#fff" : "var(--terminal-dim)",
                  }}
                  data-testid={`min-mktcap-${value}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="flex items-center gap-1.5 basis-full md:basis-auto md:flex-1 md:min-w-[90px]">
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded flex-1"
              style={{ background: "var(--overlay-subtle)", border: "1px solid var(--terminal-border)" }}
            >
              <Search className="w-3 h-3 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={view === "stocks" ? "Search ticker" : "Search industry or ticker"}
                className="bg-transparent text-[11px] outline-none flex-1 min-w-0"
                style={{ color: "var(--text-primary)" }}
                data-testid="stock-input-search"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="opacity-40 hover:opacity-100">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Selected industry summary (flat view only) */}
        {view === "stocks" && selectedIndustryMeta && (
          <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 text-[10px]" style={{ borderTop: "1px solid var(--terminal-border)", color: "var(--text-muted)" }}>
            <span className="uppercase tracking-wider">Industry group:</span>
            <span className="font-bold" style={{ color: "var(--text-primary)" }}>{selectedIndustryMeta.industry}</span>
            <span>rank #{selectedIndustryMeta.rank} of {data?.industries.length}</span>
            <span className="font-bold" style={{ color: rsRatingColor(selectedIndustryMeta.rsPercentile) }}>
              RS {selectedIndustryMeta.rsPercentile}
            </span>
            <span>{selectedIndustryMeta.tickers.length} members</span>
          </div>
        )}
      </div>

      {/* ─── Status line ─── */}
      {data && (
        <div className="flex items-center justify-between gap-3 text-[10px] px-1" style={{ color: "var(--text-muted)" }}>
          <span className="min-w-0 truncate">
            {view === "stocks"
              ? `${filtered.length.toLocaleString()} of ${data.stocks.length.toLocaleString()} stocks`
              : `${railIndustries.length} of ${data.industries.length} industry groups`}
            {" "}· IBD-style RS percentile vs SPY
          </span>
          <span className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={handleExport}
              className="p-1 rounded transition-colors opacity-60 hover:opacity-100"
              title={view === "industries" ? "Export selected industry to CSV" : "Export filtered rows to CSV"}
              data-testid="stock-button-export"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <span>Updated {new Date(data.lastUpdated).toLocaleDateString()}</span>
          </span>
        </div>
      )}

      {/* ─── Body ─── */}
      {isLoading ? (
        <div
          className="rounded-lg border p-8 space-y-3 glass-panel"
          style={{ background: "var(--terminal-surface)", borderColor: "var(--terminal-border)" }}
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton-terminal rounded h-6" />
          ))}
        </div>
      ) : view === "industries" ? (
        <IndustriesMasterDetail
          rail={railIndustries}
          railRef={railRef}
          onRailKeyDown={handleRailKeyDown}
          selected={selectedIndustry}
          onSelect={setSelectedIndustry}
          detail={detailIndustry}
          members={detailMembers}
          totalIndustries={data?.industries.length ?? 0}
          filtersActive={minRS > 0 || minMktCap > 0}
        />
      ) : (
        <StocksTable rows={filtered} SortHeader={SortHeader} />
      )}
    </>
  );
}

/* ─────────────────────────── Flat stocks table ─────────────────────────── */

/**
 * Windowed table: only the rows near the viewport render; spacer rows keep
 * scroll geometry. Handles the full ~5,900-row universe without a cap.
 */
function StocksTable({ rows, SortHeader }: {
  rows: RSStock[];
  SortHeader: (p: { label: string; sortKeyVal: StockSortKey; className?: string; align?: "left" | "right" }) => JSX.Element;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<[number, number]>([0, 60]);

  const recompute = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const start = Math.max(0, Math.floor(el.scrollTop / ROW_H) - OVERSCAN);
    const end = Math.min(rows.length, Math.ceil((el.scrollTop + el.clientHeight) / ROW_H) + OVERSCAN);
    setRange(prev => (prev[0] === start && prev[1] === end ? prev : [start, end]));
  }, [rows.length]);

  useEffect(() => { recompute(); }, [recompute]);

  const [start, end] = range;
  const slice = rows.slice(start, end);

  if (rows.length === 0) {
    return (
      <div
        className="rounded-lg border p-8 text-center glass-panel"
        style={{ background: "var(--terminal-surface)", borderColor: "var(--terminal-border)" }}
      >
        <BarChart3 className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--text-faint)" }} />
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>No stocks match your filter</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border overflow-hidden glass-panel"
      style={{ background: "var(--terminal-surface)", borderColor: "var(--terminal-border)" }}
    >
      <div
        ref={scrollRef}
        onScroll={recompute}
        className="overflow-auto rs-table-viewport"
        style={{ maxHeight: "calc(100vh - 210px)", minHeight: "360px" }}
        data-testid="stock-rs-table"
      >
        <table className="w-full text-[11px]">
          <thead className="rs-sticky-head">
            <tr>
              <SortHeader label="Rank" sortKeyVal="rank" />
              <SortHeader label="Ticker" sortKeyVal="ticker" />
              <SortHeader label="Industry" sortKeyVal="industry" className="hidden md:table-cell" />
              <SortHeader label="RS" sortKeyVal="rsPercentile" align="right" />
              <SortHeader label="1M" sortKeyVal="rs1M" align="right" className="hidden lg:table-cell" />
              <SortHeader label="3M" sortKeyVal="rs3M" align="right" className="hidden lg:table-cell" />
              <SortHeader label="6M" sortKeyVal="rs6M" align="right" className="hidden lg:table-cell" />
              <SortHeader label="Price" sortKeyVal="price" align="right" />
              <SortHeader label="% 52WH" sortKeyVal="pctFrom52WkHigh" align="right" className="hidden md:table-cell" />
              <SortHeader label="Mkt Cap" sortKeyVal="marketCap" align="right" className="hidden md:table-cell" />
              <SortHeader label="Vol 30D" sortKeyVal="avgVol30" align="right" className="hidden lg:table-cell" />
            </tr>
          </thead>
          <tbody>
            {start > 0 && <tr style={{ height: start * ROW_H }} aria-hidden="true" />}
            {slice.map((s) => <StockRow key={s.ticker} s={s} />)}
            {end < rows.length && <tr style={{ height: (rows.length - end) * ROW_H }} aria-hidden="true" />}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StockRow({ s }: { s: RSStock }) {
  return (
    <tr
      className="rs-data-row transition-colors"
      style={{ height: ROW_H, borderBottom: "1px solid var(--terminal-border)" }}
      data-testid={`stock-row-${s.ticker}`}
    >
      <td className="px-3 tabular-nums" style={{ color: "var(--text-muted)" }}>{s.rank}</td>
      <td className="px-3">
        <span className="font-bold" style={{ color: "var(--text-primary)" }}>{s.ticker}</span>
      </td>
      <td className="px-3 hidden md:table-cell truncate max-w-[220px]" style={{ color: "var(--text-secondary)" }}>{s.industry}</td>
      <td className="px-3 text-right">
        <span className="font-bold tabular-nums" style={{ color: rsRatingColor(s.rsPercentile) }}>{s.rsPercentile}</span>
      </td>
      <td className="px-3 text-right tabular-nums hidden lg:table-cell" style={{ color: "var(--text-secondary)" }}>{formatNullable(s.rs1M)}</td>
      <td className="px-3 text-right tabular-nums hidden lg:table-cell" style={{ color: "var(--text-secondary)" }}>{formatNullable(s.rs3M)}</td>
      <td className="px-3 text-right tabular-nums hidden lg:table-cell" style={{ color: "var(--text-secondary)" }}>{formatNullable(s.rs6M)}</td>
      <td className="px-3 text-right tabular-nums" style={{ color: "var(--text-primary)" }}>{formatNullable(s.price, 2)}</td>
      <td className="px-3 text-right tabular-nums hidden md:table-cell">
        <span style={{ color: s.pctFrom52WkHigh !== null && s.pctFrom52WkHigh >= -5 ? "var(--terminal-green)" : "var(--text-secondary)" }}>
          {s.pctFrom52WkHigh === null ? "—" : `${s.pctFrom52WkHigh > 0 ? "+" : ""}${s.pctFrom52WkHigh.toFixed(1)}%`}
        </span>
      </td>
      <td className="px-3 text-right tabular-nums hidden md:table-cell" style={{ color: "var(--text-secondary)" }}>{formatMarketCap(s.marketCap)}</td>
      <td className="px-3 text-right tabular-nums hidden lg:table-cell" style={{ color: "var(--text-secondary)" }}>{formatVolume(s.avgVol30)}</td>
    </tr>
  );
}

/* ──────────────────────── Industries master-detail ─────────────────────── */

function IndustriesMasterDetail({ rail, railRef, onRailKeyDown, selected, onSelect, detail, members, totalIndustries, filtersActive }: {
  rail: RSIndustry[];
  railRef: React.RefObject<HTMLDivElement>;
  onRailKeyDown: (e: React.KeyboardEvent) => void;
  selected: string | null;
  onSelect: (name: string) => void;
  detail: RSIndustry | null;
  members: RSStock[];
  totalIndustries: number;
  filtersActive: boolean;
}) {
  if (rail.length === 0) {
    return (
      <div
        className="rounded-lg border p-8 text-center glass-panel"
        style={{ background: "var(--terminal-surface)", borderColor: "var(--terminal-border)" }}
      >
        <BarChart3 className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--text-faint)" }} />
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>No industries match your filter</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border overflow-hidden glass-panel grid grid-cols-1 md:grid-cols-[290px_1fr]"
      style={{ background: "var(--terminal-surface)", borderColor: "var(--terminal-border)" }}
    >
      {/* Rail: ranked industry groups */}
      <div
        ref={railRef}
        role="listbox"
        aria-label="Industry groups ranked by relative strength"
        tabIndex={0}
        onKeyDown={onRailKeyDown}
        className="overflow-y-auto outline-none rs-rail max-h-[280px] md:max-h-none"
        style={{ borderRight: "1px solid var(--terminal-border)", maxHeight: "calc(100vh - 210px)" }}
      >
        {rail.map((ind) => {
          const isSel = ind.industry === selected;
          return (
            <button
              key={ind.industry}
              role="option"
              aria-selected={isSel}
              data-industry={ind.industry}
              onClick={() => onSelect(ind.industry)}
              className={`rs-rail-row w-full text-left flex items-center gap-2 px-2.5 text-[11px]${isSel ? " rs-rail-row-selected" : ""}`}
              title={`${ind.industry} · ${ind.sector}`}
              data-testid={`rail-${ind.industry}`}
            >
              <span className="w-6 flex-shrink-0 text-right tabular-nums" style={{ color: "var(--text-faint)" }}>{ind.rank}</span>
              <span className="flex-1 truncate" style={{ color: isSel ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: isSel ? 700 : 400 }}>
                {ind.industry}
              </span>
              <span className="w-9 flex-shrink-0 rs-rail-bar" aria-hidden="true">
                <span style={{ width: `${ind.rsPercentile}%`, background: rsRatingColor(ind.rsPercentile) }} />
              </span>
              <span className="w-5 flex-shrink-0 text-right font-bold tabular-nums" style={{ color: rsRatingColor(ind.rsPercentile) }}>
                {ind.rsPercentile}
              </span>
            </button>
          );
        })}
      </div>

      {/* Detail: members of the selected group */}
      {detail && (
        <div key={detail.industry} className="rs-detail min-w-0 flex flex-col">
          <div
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2.5 flex-shrink-0"
            style={{ borderBottom: "1px solid var(--terminal-border)" }}
          >
            <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
              {detail.industry}
            </span>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{detail.sector}</span>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>rank #{detail.rank} of {totalIndustries}</span>
            <span className="text-[12px] font-bold tabular-nums" style={{ color: rsRatingColor(detail.rsPercentile) }}>
              RS {detail.rsPercentile}
            </span>
            <span className="text-[10px] ml-auto" style={{ color: "var(--text-muted)" }}>
              {members.length}{filtersActive ? ` of ${detail.tickers.length}` : ""} members
            </span>
          </div>

          {members.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                No members{filtersActive ? " match the active filters" : " in today's dataset"}
              </p>
            </div>
          ) : (
            <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 256px)" }}>
              <table className="w-full text-[11px]">
                <thead className="rs-sticky-head">
                  <tr>
                    <th className="px-3 py-1.5 text-left text-[10px] tracking-wider uppercase" style={thStyle}>Ticker</th>
                    <th className="px-3 py-1.5 text-right text-[10px] tracking-wider uppercase" style={thStyle}>RS</th>
                    <th className="px-3 py-1.5 text-right text-[10px] tracking-wider uppercase hidden lg:table-cell" style={thStyle}>1M</th>
                    <th className="px-3 py-1.5 text-right text-[10px] tracking-wider uppercase hidden lg:table-cell" style={thStyle}>6M</th>
                    <th className="px-3 py-1.5 text-right text-[10px] tracking-wider uppercase" style={thStyle}>Price</th>
                    <th className="px-3 py-1.5 text-right text-[10px] tracking-wider uppercase hidden md:table-cell" style={thStyle}>% 52WH</th>
                    <th className="px-3 py-1.5 text-right text-[10px] tracking-wider uppercase hidden md:table-cell" style={thStyle}>Mkt Cap</th>
                    <th className="px-3 py-1.5 text-right text-[10px] tracking-wider uppercase hidden lg:table-cell" style={thStyle}>Vol 30D</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((s) => (
                    <tr
                      key={s.ticker}
                      className="rs-data-row transition-colors"
                      style={{ height: ROW_H, borderBottom: "1px solid var(--terminal-border)" }}
                      data-testid={`member-row-${s.ticker}`}
                    >
                      <td className="px-3"><span className="font-bold" style={{ color: "var(--text-primary)" }}>{s.ticker}</span></td>
                      <td className="px-3 text-right"><span className="font-bold tabular-nums" style={{ color: rsRatingColor(s.rsPercentile) }}>{s.rsPercentile}</span></td>
                      <td className="px-3 text-right tabular-nums hidden lg:table-cell" style={{ color: "var(--text-secondary)" }}>{formatNullable(s.rs1M)}</td>
                      <td className="px-3 text-right tabular-nums hidden lg:table-cell" style={{ color: "var(--text-secondary)" }}>{formatNullable(s.rs6M)}</td>
                      <td className="px-3 text-right tabular-nums" style={{ color: "var(--text-primary)" }}>{formatNullable(s.price, 2)}</td>
                      <td className="px-3 text-right tabular-nums hidden md:table-cell">
                        <span style={{ color: s.pctFrom52WkHigh !== null && s.pctFrom52WkHigh >= -5 ? "var(--terminal-green)" : "var(--text-secondary)" }}>
                          {s.pctFrom52WkHigh === null ? "—" : `${s.pctFrom52WkHigh > 0 ? "+" : ""}${s.pctFrom52WkHigh.toFixed(1)}%`}
                        </span>
                      </td>
                      <td className="px-3 text-right tabular-nums hidden md:table-cell" style={{ color: "var(--text-secondary)" }}>{formatMarketCap(s.marketCap)}</td>
                      <td className="px-3 text-right tabular-nums hidden lg:table-cell" style={{ color: "var(--text-secondary)" }}>{formatVolume(s.avgVol30)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
