import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { RSStock, RSStocksResponse } from "@shared/schema";
import { useV2, PageHead, Seg, SearchBox, Loading, SortHead, PrimaryButton } from "./ui";
import { SIG, MONO, PANEL, num, big, rsPctSig } from "./tokens";

type SortKey = "rank" | "rsPercentile" | "ticker" | "rs1M" | "rs3M" | "rs6M" | "price" | "marketCap" | "pctFrom52WkHigh" | "avgVol30";

const PAGE = 60;
const rc = (p: number) => rsPctSig(p)?.c ?? "#b9b8b4";

export function useStocks() {
  return useQuery<RSStocksResponse>({ queryKey: ["/api/rs-stocks"], staleTime: 5 * 60_000 });
}

export default function StockRSV2() {
  const { mobile: m0, contentW } = useV2();
  const mobile = m0 || contentW < 940;
  const { data } = useStocks();

  const [view, setView] = useState<"stocks" | "industries">("stocks");
  const [sector, setSector] = useState("All");
  const [minRS, setMinRS] = useState(0);
  const [minCap, setMinCap] = useState(2e8);
  const [minVol, setMinVol] = useState(5e5);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("rsPercentile");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [limit, setLimit] = useState(PAGE);
  const [openInd, setOpenInd] = useState<string | null>(null);

  const resetLimit = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setLimit(PAGE); };

  const sectors = useMemo(() => (data ? Array.from(new Set(data.stocks.map((x) => x.sector).filter(Boolean))).sort() : []), [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const items = data.stocks.filter((x) =>
      (sector === "All" || x.sector === sector) &&
      (!minRS || x.rsPercentile >= minRS) &&
      (!minCap || (x.marketCap != null && x.marketCap >= minCap)) &&
      (!minVol || (x.avgVol30 != null && x.avgVol30 >= minVol)) &&
      (!q || x.ticker.toLowerCase().includes(q) || (x.industry || "").toLowerCase().includes(q)));
    const d = dir === "asc" ? 1 : -1;
    return [...items].sort((a, b) => {
      const x = a[sort as keyof RSStock], y = b[sort as keyof RSStock];
      if (x == null) return 1;
      if (y == null) return -1;
      return (typeof x === "string" ? x.localeCompare(y as string) : (x as number) - (y as number)) * d;
    });
  }, [data, sector, minRS, minCap, minVol, query, sort, dir]);

  const industries = useMemo(() => {
    if (!data || view !== "industries") return [];
    const q = query.trim().toLowerCase();
    return (data.industries || [])
      .filter((g) => (sector === "All" || g.sector === sector) && (!q || g.industry.toLowerCase().includes(q) || g.tickers.some((t) => t.toLowerCase().includes(q))))
      .sort((a, b) => a.rank - b.rank);
  }, [data, view, sector, query]);
  const rsMap = useMemo(() => new Map((data?.stocks ?? []).map((x) => [x.ticker, x.rsPercentile])), [data]);

  const onSort = (k: SortKey) => {
    setLimit(PAGE);
    if (k === sort) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSort(k); setDir(k === "ticker" || k === "rank" ? "asc" : "desc"); }
  };

  const meta = data ? `${num(data.stocks.length)} US stocks · IBD-style RS percentile · ${num(filtered.length)} match` : "IBD-style RS percentile across the US market";
  const cols = mobile ? "38px minmax(0,1fr) auto" : "30px 38px minmax(0,1.6fr) 48px 48px 48px 76px 72px 88px 64px";
  const rows = filtered.slice(0, limit);

  return (
    <div data-screen-label="Stocks" style={{ display: "flex", flexDirection: "column", gap: 24, paddingTop: 10 }}>
      <PageHead meta={meta} italic="Stock" after="relative strength" />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <Seg padX={13} opts={[{ value: "stocks", label: "Stocks" }, { value: "industries", label: "Industries" }]} value={view} onChange={setView} />
        <Seg padX={13} opts={[[0, "Any RS"], [70, "70+"], [80, "80+"], [90, "90+"]].map(([v, l]) => ({ value: v as number, label: l as string }))} value={minRS} onChange={resetLimit(setMinRS)} />
        <Seg padX={13} opts={[[0, "Any cap"], [2e8, "200M+"], [1e9, "1B+"], [1e10, "10B+"]].map(([v, l]) => ({ value: v as number, label: l as string }))} value={minCap} onChange={resetLimit(setMinCap)} />
        <Seg padX={13} opts={[[0, "Any volume"], [5e5, "500K+"], [1e6, "1M+"], [5e6, "5M+"]].map(([v, l]) => ({ value: v as number, label: l as string }))} value={minVol} onChange={resetLimit(setMinVol)} />
        <SearchBox value={query} onChange={resetLimit(setQuery)} placeholder="Search ticker or industry" />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: -8 }}>
        {["All", ...sectors].map((x) => {
          const on = x === sector;
          return (
            <button key={x} onClick={() => { setSector(x); setLimit(PAGE); setOpenInd(null); }} aria-pressed={on}
              style={{ flexShrink: 0, height: 30, padding: "0 13px", borderRadius: 15, border: `1px solid ${on ? "rgba(239,238,233,.5)" : "rgba(255,255,255,.1)"}`, background: on ? "rgba(239,238,233,.1)" : "transparent", color: on ? "#f2f1ed" : "#a1a1a6", fontFamily: MONO, fontSize: 11, letterSpacing: ".04em", cursor: "pointer", whiteSpace: "nowrap", transition: "background .3s, color .3s, border-color .3s" }}>
              {x === "All" ? "All sectors" : x}
            </button>
          );
        })}
      </div>

      {!data && <Loading>Loading ~5,900 stock ratings</Loading>}

      {data && view === "stocks" && (
        <>
          <div style={{ ...PANEL, boxShadow: undefined, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: cols, gap: 14, alignItems: "center", padding: "12px 20px", borderBottom: "1px solid rgba(150,190,255,.10)" }}>
              {!mobile && <SortHead label="#" align="right" active={sort === "rank"} dir={dir} onClick={() => onSort("rank")} />}
              <SortHead label="RS" align="center" active={sort === "rsPercentile"} dir={dir} onClick={() => onSort("rsPercentile")} />
              <SortHead label="Ticker" active={sort === "ticker"} dir={dir} onClick={() => onSort("ticker")} />
              {!mobile ? (
                ([["rs1M", "1M"], ["rs3M", "3M"], ["rs6M", "6M"], ["price", "Price"], ["marketCap", "Mkt cap"], ["pctFrom52WkHigh", "% 52W high"], ["avgVol30", "Avg vol"]] as [SortKey, string][]).map(([k, l]) => (
                  <SortHead key={k} label={l} align="right" active={sort === k} dir={dir} onClick={() => onSort(k)} />
                ))
              ) : (
                <SortHead label="Price" align="right" active={sort === "price"} dir={dir} onClick={() => onSort("price")} />
              )}
            </div>
            {rows.map((x) => {
              const c = rc(x.rsPercentile);
              const mono = (color: string) => ({ fontFamily: MONO, fontSize: 13, color, textAlign: "right" as const });
              const hiC = x.pctFrom52WkHigh != null && x.pctFrom52WkHigh >= -5 ? SIG.up.c : "#b9b8b4";
              return (
                <div key={x.ticker} data-reveal className="v2-row" style={{ display: "grid", gridTemplateColumns: cols, gap: 14, alignItems: "center", minHeight: 54, padding: "6px 20px", borderTop: "1px solid rgba(150,190,255,.06)", transition: "background .2s, opacity .8s ease, transform .9s cubic-bezier(.16,1,.3,1)" }}>
                  {!mobile && <span style={{ ...mono("#7f8ea3"), fontSize: 11 }}>{x.rank}</span>}
                  <div style={{ position: "relative", width: 38, height: 38, borderRadius: "50%", background: `conic-gradient(${c} ${x.rsPercentile * 3.6}deg, rgba(140,180,255,.12) 0)` }}>
                    <div style={{ position: "absolute", inset: 3, borderRadius: "50%", background: "#050a14", display: "grid", placeItems: "center", fontFamily: MONO, fontSize: 12, color: c }}>{x.rsPercentile}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <span style={{ fontFamily: MONO, fontSize: 13.5, color: "#eef3fa" }}>{x.ticker}</span>
                    <span style={{ fontSize: 12.5, color: "#8c9bb0", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{x.industry || x.sector}</span>
                  </div>
                  {!mobile ? (
                    <>
                      <span style={mono("#aebbcc")}>{num(x.rs1M)}</span>
                      <span style={mono("#aebbcc")}>{num(x.rs3M)}</span>
                      <span style={mono("#aebbcc")}>{num(x.rs6M)}</span>
                      <span style={mono("#d7e0ec")}>{x.price != null ? num(x.price, 2) : "—"}</span>
                      <span style={mono("#d7e0ec")}>{big(x.marketCap)}</span>
                      <span style={mono(hiC)}>{x.pctFrom52WkHigh == null ? "—" : `${x.pctFrom52WkHigh > 0 ? "+" : ""}${x.pctFrom52WkHigh.toFixed(1)}%`}</span>
                      <span style={mono("#aebbcc")}>{big(x.avgVol30)}</span>
                    </>
                  ) : (
                    <div style={{ textAlign: "right", fontFamily: MONO }}>
                      <div style={{ fontSize: 13.5, color: "#d7e0ec" }}>{x.price != null ? num(x.price, 2) : "—"}</div>
                      <div style={{ fontSize: 11.5, color: "#8c9bb0", marginTop: 2 }}>{big(x.marketCap)}</div>
                    </div>
                  )}
                </div>
              );
            })}
            {rows.length === 0 && <div style={{ padding: "36px 20px", color: "#8c9bb0", fontSize: 14 }}>No stocks match these filters.</div>}
          </div>
          {filtered.length > limit && <PrimaryButton onClick={() => setLimit((l) => l + PAGE)}>Show more · {num(filtered.length - limit)} left</PrimaryButton>}
        </>
      )}

      {data && view === "industries" && (
        <div style={{ ...PANEL, boxShadow: undefined, overflow: "hidden" }}>
          {industries.map((g) => {
            const open = openInd === g.industry, c = rc(g.rsPercentile);
            const members = open
              ? g.tickers.map((t) => ({ t, r: rsMap.get(t) })).sort((a, b) => (b.r ?? -1) - (a.r ?? -1))
              : [];
            return (
              <div key={g.industry} data-reveal style={{ borderTop: "1px solid rgba(150,190,255,.06)", background: open ? "rgba(120,170,255,.05)" : "transparent", ["--rv-y" as string]: "0px", transition: "background .3s, opacity .8s ease" }}>
                <div role="button" tabIndex={0} aria-expanded={open} data-click onClick={() => setOpenInd(open ? null : g.industry)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenInd(open ? null : g.industry); } }}
                  style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 18px", minHeight: 56, padding: "8px 20px", cursor: "pointer" }}>
                  <span style={{ width: 28, fontFamily: MONO, fontSize: 11, color: "#7f8ea3" }}>{g.rank}</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: "1 1 220px", minWidth: 0 }}>
                    <span style={{ fontSize: 14.5, color: "#eef3fa" }}>{g.industry}</span>
                    <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: ".06em", color: "#7f8ea3" }}>{g.sector} · {g.tickers.length} stocks</span>
                  </div>
                  <div style={{ flex: "0 1 220px", minWidth: 120, height: 4, borderRadius: 2, background: "rgba(150,190,255,.10)" }}>
                    <div style={{ width: g.rsPercentile + "%", height: "100%", borderRadius: 2, background: c, boxShadow: `0 0 10px ${c}` }} />
                  </div>
                  <span style={{ width: 30, textAlign: "right", fontFamily: MONO, fontSize: 13, color: c }}>{g.rsPercentile}</span>
                </div>
                {open && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: mobile ? "0 20px 18px" : "0 20px 18px 66px" }}>
                    {members.map((m) => (
                      <span key={m.t} style={{ display: "flex", alignItems: "center", gap: 7, height: 28, padding: "0 11px", borderRadius: 14, border: "1px solid rgba(150,190,255,.12)", fontFamily: MONO, fontSize: 11.5 }}>
                        <span style={{ color: "#eef3fa" }}>{m.t}</span>
                        <span style={{ color: m.r != null ? rc(m.r) : "#8b8b90" }}>{m.r ?? "—"}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {industries.length === 0 && <div style={{ padding: "36px 20px", color: "#8c9bb0", fontSize: 14 }}>No industries match.</div>}
        </div>
      )}
    </div>
  );
}
