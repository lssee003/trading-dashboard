import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import type { RSStock, RSStocksResponse } from "@shared/schema";
import { useV2, PageHead, Seg, SearchBox, Loading, SortHead, HScroll, PIN_CELL } from "./ui";
import { SIG, MONO, PANEL, num, big, rsPctSig } from "./tokens";

type SortKey = "rank" | "rsPercentile" | "ticker" | "rs1M" | "rs3M" | "rs6M" | "price" | "marketCap" | "pctFrom52WkHigh" | "avgVol30";

const PAGE = 60;
const rc = (p: number) => rsPctSig(p)?.c ?? "#b9b8b4";

export function useStocks() {
  return useQuery<RSStocksResponse>({ queryKey: ["/api/rs-stocks"], staleTime: 5 * 60_000 });
}

export default function StockRSV2() {
  const { mobile: m0, contentW, mainRef } = useV2();
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
  // Mobile keeps every column at a fixed width and scrolls sideways; the RS ring + ticker cell stays pinned left
  const cols = mobile ? "20px 112px 34px 34px 34px 58px 50px 54px 46px" : "30px 38px minmax(0,1.6fr) 48px 48px 48px 76px 72px 88px 64px";
  const pin: CSSProperties = mobile ? { ...PIN_CELL, gap: 8 } : {};
  // Mobile is a dense terminal-style table (like the classic UI) so more rows and columns fit on screen
  const gap = mobile ? 8 : 14, padX = mobile ? 12 : 20, fs = mobile ? 11.5 : 13, ringD = mobile ? 26 : 38;
  const rows = filtered.slice(0, limit);
  const tickers = useMemo(() => filtered.map((x) => x.ticker), [filtered]);

  // Infinite scroll: load the next page as the end of the list nears the bottom of <main>.
  // Re-observing after every page re-checks, so tall screens keep filling until the sentinel is out of range.
  const sentinel = useRef<HTMLDivElement>(null);
  const more = view === "stocks" && filtered.length > limit;
  useEffect(() => {
    const el = sentinel.current;
    if (!more || !el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((es) => { if (es[0]?.isIntersecting) setLimit((l) => l + PAGE); }, { root: mainRef.current, rootMargin: "0px 0px 800px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [more, limit, mainRef]);

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
           <HScroll chevronTop={10}>
           <div style={{ width: mobile ? "max-content" : undefined, minWidth: "100%" }}>
            <div style={{ display: "grid", gridTemplateColumns: cols, gap, alignItems: "center", padding: mobile ? `9px ${padX}px` : "12px 20px", borderBottom: "1px solid rgba(150,190,255,.10)" }}>
              <SortHead label="#" align="right" active={sort === "rank"} dir={dir} onClick={() => onSort("rank")} />
              {mobile ? (
                <div style={pin}>
                  <SortHead label="RS" active={sort === "rsPercentile"} dir={dir} onClick={() => onSort("rsPercentile")} />
                  <SortHead label="Ticker" active={sort === "ticker"} dir={dir} onClick={() => onSort("ticker")} />
                  <ExportMenu tickers={tickers} sheet />
                </div>
              ) : (
                <>
                  <SortHead label="RS" align="center" active={sort === "rsPercentile"} dir={dir} onClick={() => onSort("rsPercentile")} />
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <SortHead label="Ticker" active={sort === "ticker"} dir={dir} onClick={() => onSort("ticker")} />
                    <ExportMenu tickers={tickers} />
                  </div>
                </>
              )}
              {([["rs1M", "1M"], ["rs3M", "3M"], ["rs6M", "6M"], ["price", "Price"], ["marketCap", mobile ? "Cap" : "Mkt cap"], ["pctFrom52WkHigh", mobile ? "52WH" : "% 52W high"], ["avgVol30", mobile ? "Vol" : "Avg vol"]] as [SortKey, string][]).map(([k, l]) => (
                <SortHead key={k} label={l} align="right" active={sort === k} dir={dir} onClick={() => onSort(k)} />
              ))}
            </div>
            {rows.map((x) => {
              const c = rc(x.rsPercentile);
              const mono = (color: string) => ({ fontFamily: MONO, fontSize: fs, color, textAlign: "right" as const });
              const hiC = x.pctFrom52WkHigh != null && x.pctFrom52WkHigh >= -5 ? SIG.up.c : "#b9b8b4";
              const ring = (
                <div style={{ position: "relative", flexShrink: 0, width: ringD, height: ringD, borderRadius: "50%", background: `conic-gradient(${c} ${x.rsPercentile * 3.6}deg, rgba(140,180,255,.12) 0)` }}>
                  <div style={{ position: "absolute", inset: mobile ? 2 : 3, borderRadius: "50%", background: "#050a14", display: "grid", placeItems: "center", fontFamily: MONO, fontSize: mobile ? 9.5 : 12, color: c }}>{x.rsPercentile}</div>
                </div>
              );
              const ident = (
                <div style={{ display: "flex", flexDirection: "column", gap: mobile ? 0 : 2, minWidth: 0 }}>
                  <span style={{ fontFamily: MONO, fontSize: mobile ? 12 : 13.5, color: "#eef3fa" }}>{x.ticker}</span>
                  <span style={{ fontSize: mobile ? 10.5 : 12.5, color: "#8c9bb0", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{x.industry || x.sector}</span>
                </div>
              );
              return (
                <div key={x.ticker} data-reveal className="v2-row" style={{ display: "grid", gridTemplateColumns: cols, gap, alignItems: "center", minHeight: mobile ? 38 : 54, padding: mobile ? `3px ${padX}px` : "6px 20px", borderTop: "1px solid rgba(150,190,255,.06)", transition: "background .2s, opacity .8s ease, transform .9s cubic-bezier(.16,1,.3,1)" }}>
                  <span style={{ ...mono("#7f8ea3"), fontSize: mobile ? 10 : 11 }}>{x.rank}</span>
                  {mobile ? <div style={pin}>{ring}{ident}</div> : <>{ring}{ident}</>}
                  <span style={mono("#aebbcc")}>{num(x.rs1M)}</span>
                  <span style={mono("#aebbcc")}>{num(x.rs3M)}</span>
                  <span style={mono("#aebbcc")}>{num(x.rs6M)}</span>
                  <span style={mono("#d7e0ec")}>{x.price != null ? num(x.price, 2) : "—"}</span>
                  <span style={mono("#d7e0ec")}>{big(x.marketCap)}</span>
                  <span style={mono(hiC)}>{x.pctFrom52WkHigh == null ? "—" : `${x.pctFrom52WkHigh > 0 ? "+" : ""}${x.pctFrom52WkHigh.toFixed(1)}%`}</span>
                  <span style={mono("#aebbcc")}>{big(x.avgVol30)}</span>
                </div>
              );
            })}
            {rows.length === 0 && <div style={{ padding: "36px 20px", color: "#8c9bb0", fontSize: 14 }}>No stocks match these filters.</div>}
           </div>
           </HScroll>
          </div>
          {more && <div ref={sentinel} aria-hidden="true" style={{ height: 1 }} />}
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

/**
 * Export icon beside the Ticker header: opens a dropdown that copies or downloads the top N of the
 * filtered + sorted tickers as a comma-separated list. Portalled to <body> so the table's overflow
 * can't clip it; on phones (`sheet`) it becomes a bottom sheet with large touch targets.
 */
function ExportMenu({ tickers, sheet = false }: { tickers: string[]; sheet?: boolean }) {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<50 | 100 | 0>(50);
  const [custom, setCustom] = useState("250");
  const [flash, setFlash] = useState("");
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const n = preset || Math.max(1, Math.floor(Number(custom)) || 1);
  const out = tickers.slice(0, n);
  const text = out.join(",");

  // Anchor the dropdown under the icon, kept inside the viewport
  useLayoutEffect(() => {
    if (!open || sheet || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect(), W = 280;
    setPos({ top: r.bottom + 8, left: Math.max(12, Math.min(r.left - 12, window.innerWidth - W - 12)) });
  }, [open, sheet]);

  // Close on outside tap, Escape, or (desktop) scroll/resize, since the anchor would move away
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!popRef.current?.contains(t) && !btnRef.current?.contains(t)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const shut = () => setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    if (!sheet) { window.addEventListener("resize", shut); document.addEventListener("scroll", shut, true); }
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("resize", shut);
      document.removeEventListener("scroll", shut, true);
    };
  }, [open, sheet]);

  const note = (msg: string) => { setFlash(msg); window.setTimeout(() => setFlash(""), 1800); };
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); note(`Copied ${out.length}`); }
    catch { note("Copy blocked"); }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `stocks-top${out.length}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    note(`Saved ${out.length}`);
  };

  const h = sheet ? 44 : 34;
  const field: CSSProperties = { height: h, borderRadius: h / 2, border: "1px solid rgba(150,190,255,.18)", background: "rgba(8,14,26,.8)", color: "#eef3fa", fontFamily: MONO, fontSize: sheet ? 13 : 11.5 };
  const action: CSSProperties = { ...field, flex: 1, letterSpacing: ".04em", cursor: out.length ? "pointer" : "not-allowed", opacity: out.length ? 1 : 0.45 };
  const label: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "#7f8ea3" };
  const panel: CSSProperties = sheet
    ? { position: "fixed", left: 0, right: 0, bottom: 0, padding: "18px 16px calc(18px + env(safe-area-inset-bottom))", borderRadius: "18px 18px 0 0", borderTop: "1px solid rgba(150,190,255,.18)" }
    : { position: "fixed", top: pos.top, left: pos.left, width: 280, padding: 14, borderRadius: 14, border: "1px solid rgba(150,190,255,.18)" };

  return (
    <>
      <button ref={btnRef} onClick={() => setOpen((o) => !o)} aria-label="Export tickers" aria-haspopup="dialog" aria-expanded={open} title="Export tickers"
        style={{ flexShrink: 0, display: "grid", placeItems: "center", width: sheet ? 28 : 24, height: sheet ? 28 : 24, margin: sheet ? "-4px 0" : "-6px 0", padding: 0, borderRadius: 7, border: `1px solid ${open ? "rgba(239,238,233,.4)" : "transparent"}`, background: open ? "rgba(239,238,233,.1)" : "transparent", color: open ? "#f2f1ed" : "#86868b", cursor: "pointer", transition: "color .2s, background .2s, border-color .2s" }}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M8 10V2M5 5l3-3 3 3M3 9v4a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9" />
        </svg>
      </button>
      {open && createPortal(
        <>
          {sheet && <div aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,.5)" }} />}
          <div ref={popRef} role="dialog" aria-label="Export tickers"
            style={{ ...panel, zIndex: 1000, display: "flex", flexDirection: "column", gap: 12, background: "rgba(7,12,23,.96)", WebkitBackdropFilter: "blur(16px)", backdropFilter: "blur(16px)", boxShadow: "0 18px 50px rgba(0,0,0,.6)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={label}>Export top</span>
              <span aria-live="polite" style={{ fontFamily: MONO, fontSize: 11, color: flash ? SIG.up.c : "#7f8ea3" }}>
                {flash || `${num(out.length)} of ${num(tickers.length)} filtered`}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Seg size={sheet ? "md" : "sm"} padX={sheet ? 16 : 12} opts={[{ value: 50 as const, label: "50" }, { value: 100 as const, label: "100" }, { value: 0 as const, label: "Custom" }]} value={preset} onChange={setPreset} />
              {preset === 0 && (
                <input type="number" inputMode="numeric" min={1} value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="Custom export count" autoFocus={!sheet}
                  style={{ ...field, width: 0, flex: 1, minWidth: 60, padding: "0 12px", fontSize: sheet ? 16 : 12, outline: "none" }} />
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={copy} disabled={!out.length} style={action}>Copy</button>
              <button onClick={download} disabled={!out.length} style={action}>Download .txt</button>
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
