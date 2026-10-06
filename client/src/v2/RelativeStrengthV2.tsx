import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { RSResponse, RSTickerData } from "@shared/schema";
import { getSymbolColor } from "@/lib/rrg";
import { useV2, PageHead, Seg, SearchBox, Loading, SortHead, Spark, Dot } from "./ui";
import { SIG, MONO, SERIF, PANEL, num, pct, spark, rsPulse } from "./tokens";

type Bench = "SPY" | "RSP" | "IWM";
type Filter = "Sector" | "Industry Group" | "Index" | "All";
type SortKey = "rank" | "sym" | "cat" | "close" | "ret" | "rs" | "pulse";
type Quad = "leading" | "weakening" | "lagging" | "improving";

interface Row extends RSTickerData { hist: number[]; rsv: number; pulseV: number | null }

const QUADS: Record<Quad, { label: string; color: string }> = {
  leading: { label: "Leading", color: SIG.up.c },
  weakening: { label: "Weakening", color: SIG.mid.c },
  lagging: { label: "Lagging", color: SIG.down.c },
  improving: { label: "Improving", color: SIG.blue.c },
};

export function useRS(win: number) {
  return useQuery<RSResponse>({ queryKey: ["/api/relative-strength", `?benchmark=SPY&lookback=${win}`], staleTime: 60_000 });
}

export default function RelativeStrengthV2() {
  const { mobile: m0, contentW, h } = useV2();
  const mobile = m0 || contentW < 900;
  const [view, setView] = useState<"list" | "rot">("list");
  const [bench, setBench] = useState<Bench>("SPY");
  const [win, setWin] = useState(25);
  const [filter, setFilter] = useState<Filter>("All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("rs");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [hover, setHover] = useState<string | null>(null);
  const [pins, setPins] = useState<Record<string, boolean>>({});
  const [exp, setExp] = useState<Record<string, boolean>>({});

  const { data } = useRS(win);

  // Benchmarks other than SPY: divide each histogram by the benchmark's own SPY-relative histogram
  const all = useMemo<Row[] | null>(() => {
    if (!data) return null;
    const list = data.tickers.filter((t) => !t.failed && t.histogram?.length);
    const hB = bench !== "SPY" ? list.find((t) => t.symbol === bench)?.histogram ?? null : null;
    return list.map((t) => {
      const hist = hB ? t.histogram.map((v, i) => v / (hB[i] || 1)) : t.histogram;
      return { ...t, hist, rsv: hist[hist.length - 1], pulseV: rsPulse(hist) };
    });
  }, [data, bench]);

  const base = useMemo(() => {
    if (!all) return null;
    const list = all.filter((t) => filter === "All" || t.category === filter);
    const ranked = [...list].sort((a, b) => b.rsv - a.rsv);
    const rank = new Map(ranked.map((t, i) => [t.symbol, i + 1]));
    const q = query.trim().toLowerCase();
    let shown = q ? ranked.filter((t) => t.symbol.toLowerCase().includes(q) || (t.name || "").toLowerCase().includes(q)) : ranked;
    const keyf: Record<SortKey, (t: Row) => number | string> = {
      rs: (t) => t.rsv, ret: (t) => t.returnPct, close: (t) => t.latestClose, pulse: (t) => t.pulseV ?? -1,
      sym: (t) => t.symbol, cat: (t) => t.category, rank: (t) => rank.get(t.symbol)!,
    };
    if (sort !== "rs" || dir !== "desc") {
      const f = keyf[sort];
      shown = [...shown].sort((a, b) => {
        const x = f(a), y = f(b);
        const c = typeof x === "string" ? x.localeCompare(y as string) : (x as number) - (y as number);
        return dir === "asc" ? c : -c;
      });
    }
    return { list, ranked, rank, shown };
  }, [all, filter, query, sort, dir]);

  const onSort = (k: SortKey) => {
    if (k === sort) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSort(k); setDir(k === "sym" || k === "cat" || k === "rank" ? "asc" : "desc"); }
  };

  const chartW = contentW >= 900 ? contentW - 332 : contentW - 20;
  const rrg = useMemo(
    () => (view === "rot" && base ? computeRRG(base.list, win, mobile, chartW, h) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view, base?.list, win, mobile, Math.round(chartW / 40), Math.round(h / 40)],
  );

  const controls = (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <Seg
        opts={[{ value: "list", label: "List" }, { value: "rot", label: "Rotation" }]}
        value={view}
        onChange={(v) => { setHover(null); setView(v); if (v === "rot") { setWin(10); setFilter("Sector"); } }}
      />
      <Seg opts={[{ value: "SPY", label: "vs SPY" }, { value: "RSP", label: "vs RSP" }, { value: "IWM", label: "vs IWM" }]} value={bench} onChange={setBench} />
      {view === "list" && <Seg opts={[10, 25, 50, 90].map((v) => ({ value: v, label: v + "D" }))} value={win} onChange={setWin} />}
      <Seg
        opts={[{ value: "Sector", label: "Sectors" }, { value: "Industry Group", label: "Industries" }, { value: "Index", label: "Indexes" }, { value: "All", label: "All" }]}
        value={filter}
        onChange={(v) => { setFilter(v); setHover(null); }}
      />
      <SearchBox value={query} onChange={setQuery} placeholder="Search symbol or name" />
    </div>
  );

  const meta = base ? `${base.list.length} ETFs · ${win}-day window · vs ${bench}` : `${win}-day window · vs ${bench}`;

  const cols = mobile ? "16px minmax(0,1fr) auto" : "28px 12px minmax(0,1.3fr) minmax(0,1fr) 78px 92px 66px 56px minmax(90px,140px)";
  const rsColor = (v: number) => (v >= 1 ? SIG.up.c : SIG.down.c);
  const pulseColor = (p: number | null) => (p == null ? "#8b8b90" : p >= 80 ? SIG.up.c : p >= 50 ? SIG.mid.c : SIG.down.c);

  return (
    <div data-screen-label="Sectors" style={{ display: "flex", flexDirection: "column", gap: 26, paddingTop: 10 }}>
      <PageHead meta={meta} italic="Sector" after="relative strength" />
      {controls}

      {!base && <Loading>Loading {win}-day window</Loading>}

      {base && view === "list" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 400px), 1fr))", gap: 10 }}>
            {[
              { title: "Leaders", color: SIG.up.c, sub: `Top 5 vs ${bench}`, rows: base.ranked.slice(0, 5) },
              { title: "Laggards", color: SIG.down.c, sub: `Bottom 5 vs ${bench}`, rows: base.ranked.slice(-5).reverse() },
            ].map((b) => (
              <div key={b.title} data-reveal style={{ ...PANEL, padding: "16px 20px 8px", ["--rv-y" as string]: "24px", transition: "opacity 1s ease, transform 1s cubic-bezier(.16,1,.3,1)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
                  <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 26, color: b.color }}>{b.title}</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "#7f8ea3" }}>{b.sub}</span>
                </div>
                {b.rows.map((r) => (
                  <div key={r.symbol} style={{ display: "flex", alignItems: "center", gap: 14, padding: "9px 0", borderTop: "1px solid rgba(150,190,255,.07)" }}>
                    <span style={{ width: 22, fontFamily: MONO, fontSize: 11, color: "#7f8ea3" }}>{base.rank.get(r.symbol)}</span>
                    <span style={{ width: 54, fontFamily: MONO, fontSize: 13, color: "#eef3fa" }}>{r.symbol}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: "#9fb0c6", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{r.name}</span>
                    <span style={{ fontFamily: MONO, fontSize: 12.5, color: r.returnPct >= 0 ? SIG.up.c : SIG.down.c }}>{pct(r.returnPct)}</span>
                    <span style={{ width: 52, textAlign: "right", fontFamily: MONO, fontSize: 12.5, color: rsColor(r.rsv) }}>{r.rsv.toFixed(3)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div style={{ ...PANEL, boxShadow: undefined, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: cols, gap: 14, alignItems: "center", padding: "12px 20px", borderBottom: "1px solid rgba(150,190,255,.10)" }}>
              {!mobile && <SortHead label="#" align="right" active={sort === "rank"} dir={dir} onClick={() => onSort("rank")} />}
              <span />
              <SortHead label="Symbol" active={sort === "sym"} dir={dir} onClick={() => onSort("sym")} />
              {!mobile && (
                <>
                  <SortHead label="Category" active={sort === "cat"} dir={dir} onClick={() => onSort("cat")} />
                  <SortHead label="Close" align="right" active={sort === "close"} dir={dir} onClick={() => onSort("close")} />
                  <SortHead label={win + "D return"} align="right" active={sort === "ret"} dir={dir} onClick={() => onSort("ret")} />
                  <SortHead label="RS" align="right" active={sort === "rs"} dir={dir} onClick={() => onSort("rs")} />
                  <SortHead label="Pulse" align="right" active={sort === "pulse"} dir={dir} onClick={() => onSort("pulse")} />
                  <SortHead label="RS histogram" active={false} dir={dir} />
                </>
              )}
              {mobile && <SortHead label="RS" align="right" active={sort === "rs"} dir={dir} onClick={() => onSort("rs")} />}
            </div>
            {base.shown.map((r) => {
              const sp = spark(r.hist), rc = rsColor(r.rsv), retC = r.returnPct >= 0 ? SIG.up.c : SIG.down.c;
              const mono = (size: number, color: string) => ({ fontFamily: MONO, fontSize: size, color, textAlign: "right" as const });
              return (
                <div key={r.symbol} data-reveal className="v2-row" style={{ display: "grid", gridTemplateColumns: cols, gap: 14, alignItems: "center", minHeight: 54, padding: "6px 20px", borderTop: "1px solid rgba(150,190,255,.06)", transition: "background .2s, opacity .8s ease, transform .9s cubic-bezier(.16,1,.3,1)" }}>
                  {!mobile && <span style={mono(11, "#7f8ea3")}>{base.rank.get(r.symbol)}</span>}
                  <div style={{ display: "grid", placeItems: "center" }}><Dot color={rc} size={8} /></div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <span style={{ fontFamily: MONO, fontSize: 13.5, color: "#eef3fa" }}>{r.symbol}</span>
                    <span style={{ fontSize: 12.5, color: "#8c9bb0", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{r.name}</span>
                  </div>
                  {!mobile ? (
                    <>
                      <span style={{ fontSize: 12.5, color: "#8c9bb0", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{r.category}</span>
                      <span style={mono(13, "#d7e0ec")}>{num(r.latestClose, 2)}</span>
                      <span style={mono(13, retC)}>{pct(r.returnPct)}</span>
                      <span style={mono(13, rc)}>{r.rsv.toFixed(3)}</span>
                      <span style={mono(13, pulseColor(r.pulseV))}>{r.pulseV == null ? "—" : Math.round(r.pulseV) + "%"}</span>
                      <Spark {...sp} style={{ width: "100%", height: 26 }} />
                    </>
                  ) : (
                    <div style={{ textAlign: "right", fontFamily: MONO }}>
                      <div style={{ fontSize: 13.5, color: rc }}>{r.rsv.toFixed(3)}</div>
                      <div style={{ fontSize: 11.5, color: retC, marginTop: 2 }}>{pct(r.returnPct)}</div>
                    </div>
                  )}
                </div>
              );
            })}
            {base.shown.length === 0 && <div style={{ padding: "36px 20px", color: "#8c9bb0", fontSize: 14 }}>No symbols match.</div>}
          </div>
        </>
      )}

      {base && view === "rot" && rrg && (
        <Rotation rrg={rrg} filter={filter} bench={bench} mobile={mobile} wide={contentW >= 900} hover={hover} setHover={setHover} pins={pins} setPins={setPins} exp={exp} setExp={setExp} />
      )}
    </div>
  );
}

/* ── Rotation (RRG) ── */

interface RRGPt {
  sym: string; name: string; cat: string; color: string; q: Quad; rx: number; ry: number;
  x: number; y: number; lx: number; ly: number; la: "start" | "end" | "middle";
  segs: string[]; dots: [number, number][];
}
interface RRGData { W: number; H: number; cx: number; cy: number; k: number; pts: RRGPt[] }

function computeRRG(list: Row[], win: number, mobile: boolean, chartW: number, vh: number): RRGData {
  // [smaWindow, momentum, trailStep, points] — 10D is smoother than lib/rrg (same span)
  const P = win <= 10 ? [4, 3, 1, 7] : win <= 25 ? [10, 5, 5, 5] : win <= 50 ? [10, 5, 5, 9] : [10, 5, 5, 17];
  const sma = (a: number[], end: number, w: number) => { const sl = a.slice(Math.max(0, end - w + 1), end + 1); return sl.reduce((x, y) => x + y, 0) / sl.length; };
  const raw: { sym: string; name: string; cat: string; trail: [number, number][]; rx: number; ry: number; q: Quad; color: string }[] = [];
  list.forEach((t, ti) => {
    const h = t.hist;
    if (!h || h.length < 8) return;
    const ratio = h.map((v, i) => { const a = sma(h, i, P[0]); return a ? (v / a) * 100 : 100; });
    const mom = ratio.map((v, i) => (i < P[1] ? 100 : ratio[i - P[1]] ? (v / ratio[i - P[1]]) * 100 : 100));
    if (ratio.length < P[0] + P[1]) return;
    const idx: number[] = [];
    for (let i = ratio.length - 1; idx.length < P[3] && i >= 0; i -= P[2]) idx.push(i);
    idx.reverse();
    const trail = idx.map((i) => [ratio[i], mom[i]] as [number, number]);
    const cur = trail[trail.length - 1];
    const q: Quad = cur[0] > 100 ? (cur[1] > 100 ? "leading" : "weakening") : cur[1] > 100 ? "improving" : "lagging";
    raw.push({ sym: t.symbol, name: t.name, cat: t.category, trail, rx: cur[0], ry: cur[1], q, color: getSymbolColor(ti) });
  });

  const W = 1000;
  const H = mobile ? 1000 : Math.round(W * Math.max(0.46, Math.min(0.68, (vh - 400) / Math.max(320, chartW || 700))));
  const qt = (arr: number[], p: number) => { const a = [...arr].sort((u, v) => u - v); return a.length ? a[Math.min(a.length - 1, Math.floor(p * (a.length - 1)))] : 0.5; };
  const allP = raw.flatMap((r) => r.trail);
  const qa = raw.length > 20 ? 0.97 : 1;
  const dx = Math.max(0.4, qt(allP.map((p) => Math.abs(p[0] - 100)), qa) * 1.1);
  const dy = Math.max(0.4, qt(allP.map((p) => Math.abs(p[1] - 100)), qa) * 1.1);
  // Catmull-Rom → one cubic Bézier per segment (each gets its own opacity)
  const curve = (A: [number, number][]) => {
    const out: string[] = [];
    for (let i = 0; i < A.length - 1; i++) {
      const p0 = A[i - 1] || A[i], p1 = A[i], p2 = A[i + 1], p3 = A[i + 2] || p2;
      out.push(`M${p1[0]},${p1[1]}C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0]},${p2[1]}`);
    }
    return out;
  };
  const cl = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const cx = W / 2, cy = H / 2;
  const X = (x: number) => cx + ((x - 100) / dx) * (W / 2 - 40), Y = (y: number) => cy - ((y - 100) / dy) * (H / 2 - 40);
  const k = W / Math.max(320, chartW || 700);
  const pts: RRGPt[] = raw.map((r) => {
    const tr = r.trail.map(([x, y]) => [+X(x).toFixed(1), +Y(y).toFixed(1)] as [number, number]);
    const hx = cl(tr[tr.length - 1][0], 12, W - 12), hy = cl(tr[tr.length - 1][1], 12, H - 12);
    const a = tr[Math.max(0, tr.length - 3)], b = tr[tr.length - 1];
    let ux = b[0] - a[0], uy = b[1] - a[1];
    const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
    const la = ux > 0.35 ? "start" : ux < -0.35 ? "end" : "middle";
    const lx = ux * 14, ly = la === "middle" ? (uy > 0 ? 24 : -14) : uy * 14 + 4.5;
    return { sym: r.sym, name: r.name, cat: r.cat, color: r.color, q: r.q, rx: r.rx, ry: r.ry, x: hx, y: hy, lx, ly, la, segs: curve(tr), dots: tr.slice(0, -1) };
  });
  return { W, H, cx, cy, k, pts };
}

function Rotation({ rrg, filter, bench, mobile, wide, hover, setHover, pins, setPins, exp, setExp }: {
  rrg: RRGData; filter: Filter; bench: Bench; mobile: boolean; wide: boolean;
  hover: string | null; setHover: (s: string | null) => void;
  pins: Record<string, boolean>; setPins: (f: (p: Record<string, boolean>) => Record<string, boolean>) => void;
  exp: Record<string, boolean>; setExp: (f: (p: Record<string, boolean>) => Record<string, boolean>) => void;
}) {
  const enter = (s: string) => setHover(s);
  const leave = (s: string) => { if (hover === s) setHover(null); };
  const pin = (s: string) => setPins((p) => ({ ...p, [s]: !p[s] }));

  const p = rrg.pts.find((x) => x.sym === hover);
  const groupName = ({ Sector: "sectors", "Industry Group": "industry ETFs", Index: "index ETFs" } as Record<string, string>)[filter] || "ETFs";
  const hv = p
    ? { kicker: QUADS[p.q].label, title: `${p.sym} · ${p.name}`, body: p.cat, stat: `RS-Ratio ${p.rx.toFixed(2)}  ·  RS-Momentum ${p.ry.toFixed(2)}`, color: QUADS[p.q].color }
    : { kicker: "Rotation", title: `${rrg.pts.length} ${groupName}`, body: "Each curve traces the last 7 sessions; the bright end is today. Hover a symbol to isolate it, click to pin it.", stat: `10-day window · vs ${bench}`, color: "#a1a1a6" };

  const cap = rrg.pts.length > 16 ? 3 : 99;

  return (
    <div style={{ display: "grid", gridTemplateColumns: wide ? "minmax(0,1fr) 300px" : "minmax(0,1fr)", gap: 10, alignItems: "start" }}>
      <div data-reveal style={{ borderRadius: 16, background: "rgba(4,8,16,.72)", border: "1px solid rgba(150,190,255,.12)", padding: mobile ? 10 : 18, overflow: "hidden", ["--rv-y" as string]: "0px", transition: "opacity 1s ease" }}>
        <RRGChart data={rrg} hover={hover} pins={pins} enter={enter} leave={leave} pin={pin} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ borderRadius: 16, padding: "18px 20px", height: 172, overflow: "hidden", display: "flex", flexDirection: "column", gap: 8, background: "rgba(6,11,22,.55)", border: "1px solid rgba(150,190,255,.12)", WebkitBackdropFilter: "blur(16px)", backdropFilter: "blur(16px)" }}>
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: "#7f8ea3" }}>{hv.kicker}</span>
          <span style={{ fontFamily: SERIF, fontSize: 28, lineHeight: 1.05, color: "#eef3fa", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{hv.title}</span>
          <span style={{ fontSize: 13.5, color: "#9fb0c6", lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", flexShrink: 0 }}>{hv.body}</span>
          <span style={{ marginTop: "auto", fontFamily: MONO, fontSize: 12, color: hv.color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{hv.stat}</span>
        </div>
        {(["leading", "improving", "weakening", "lagging"] as Quad[]).map((qk) => {
          const ps = rrg.pts.filter((x) => x.q === qk), ex = !!exp[qk], vis = ex ? ps : ps.slice(0, cap);
          return (
            <div key={qk} style={{ borderRadius: 16, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 8, background: "rgba(6,11,22,.55)", border: "1px solid rgba(150,190,255,.12)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Dot color={QUADS[qk].color} size={7} />
                <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: ".16em", textTransform: "uppercase", color: "#eef3fa" }}>{QUADS[qk].label}</span>
                <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 12, color: "#8c9bb0" }}>{ps.length}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {vis.map((it) => {
                  const on = hover === it.sym || !!pins[it.sym];
                  return (
                    <button key={it.sym} onMouseEnter={() => enter(it.sym)} onMouseLeave={() => leave(it.sym)} onClick={() => pin(it.sym)} aria-pressed={!!pins[it.sym]}
                      style={{ display: "flex", alignItems: "center", gap: 7, height: 26, padding: "0 10px", borderRadius: 13, border: `1px solid ${on ? it.color : "rgba(150,190,255,.14)"}`, background: on ? "rgba(150,190,255,.12)" : "transparent", color: "#eef3fa", fontFamily: MONO, fontSize: 11.5, cursor: "pointer", transition: "background .25s, border-color .25s" }}>
                      <Dot color={it.color} size={8} glow={8} />
                      {it.sym}
                    </button>
                  );
                })}
                {!ps.length && <span style={{ fontFamily: MONO, fontSize: 11.5, color: "#7f8ea3" }}>None</span>}
                {ps.length > cap && (
                  <button className="v2-hw" onClick={() => setExp((e) => ({ ...e, [qk]: !e[qk] }))} style={{ height: 26, padding: "0 11px", borderRadius: 13, border: "1px dashed rgba(150,190,255,.22)", background: "transparent", color: "#9fb0c6", fontFamily: MONO, fontSize: 11, cursor: "pointer" }}>
                    {ex ? "Less" : `+${ps.length - cap}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RRGChart({ data, hover, pins, enter, leave, pin }: { data: RRGData; hover: string | null; pins: Record<string, boolean>; enter: (s: string) => void; leave: (s: string) => void; pin: (s: string) => void }) {
  const { W, H, cx, cy, k } = data;
  const anyF = !!hover || Object.values(pins).some(Boolean);
  const pts = data.pts.map((p) => ({
    ...p,
    f: hover === p.sym || !!pins[p.sym],
    fade: p.segs.map((_, i) => +(0.12 + 0.88 * Math.pow((i + 1) / p.segs.length, 1.3)).toFixed(3)),
  }));
  const Q = QUADS;
  const quads: [string, number, number, number, number, string, string, string][] = [
    ["lead", cx, 0, W - cx, cy, Q.leading.color, "100%", "0%"],
    ["weak", cx, cy, W - cx, H - cy, Q.weakening.color, "100%", "100%"],
    ["lag", 0, cy, cx, H - cy, Q.lagging.color, "0%", "100%"],
    ["imp", 0, 0, cx, cy, Q.improving.color, "0%", "0%"],
  ];
  const lbl: [string, number, number, "start" | "end", string][] = [
    ["Leading", W - 18, 26 * k, "end", Q.leading.color], ["Weakening", W - 18, H - 18, "end", Q.weakening.color],
    ["Lagging", 18, H - 18, "start", Q.lagging.color], ["Improving", 18, 26 * k, "start", Q.improving.color],
  ];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Relative rotation graph">
      <defs>
        <clipPath id="v2-rrg-clip"><rect x={0} y={0} width={W} height={H} rx={24} /></clipPath>
        {quads.map((q) => (
          <radialGradient key={q[0]} id={"v2-rrg-" + q[0]} cx={q[6]} cy={q[7]} r="110%">
            <stop offset="0%" stopColor={q[5]} stopOpacity={0.22} />
            <stop offset="75%" stopColor={q[5]} stopOpacity={0} />
          </radialGradient>
        ))}
      </defs>
      {quads.map((q) => <rect key={q[0]} x={q[1]} y={q[2]} width={Math.max(0, q[3])} height={Math.max(0, q[4])} fill={`url(#v2-rrg-${q[0]})`} />)}
      <line x1={cx} y1={0} x2={cx} y2={H} stroke="rgba(255,255,255,.22)" strokeWidth={k} />
      <line x1={0} y1={cy} x2={W} y2={cy} stroke="rgba(255,255,255,.22)" strokeWidth={k} />
      {lbl.map((l) => <text key={l[0]} x={l[1]} y={l[2]} textAnchor={l[3]} fill={l[4]} fontSize={15 * k} fontFamily="Geist, sans-serif">{l[0]}</text>)}
      <text x={W - 18} y={cy - 10 * k} textAnchor="end" fill="#76767b" fontSize={11 * k} fontFamily="JetBrains Mono, monospace">RS-Ratio →</text>
      <text x={cx + 10 * k} y={52 * k} fill="#76767b" fontSize={11 * k} fontFamily="JetBrains Mono, monospace">↑ RS-Momentum</text>
      <g clipPath="url(#v2-rrg-clip)">
        {pts.map((p) => (
          <g key={"t" + p.sym} opacity={anyF ? (p.f ? 1 : 0.1) : 0.85} style={{ transition: "opacity .35s", pointerEvents: "none" }}>
            {p.f && p.segs.map((sg, i) => <path key={"w" + i} d={sg} fill="none" stroke={p.color} strokeOpacity={0.22 * p.fade[i]} strokeWidth={11 * k} strokeLinecap="round" />)}
            {p.segs.map((sg, i) => <path key={"s" + i} d={sg} fill="none" stroke={p.color} strokeOpacity={p.fade[i]} strokeWidth={(p.f ? 4 : 2.4) * k} strokeLinecap="round" />)}
            {p.dots.map((dd, i) => <circle key={i} cx={dd[0]} cy={dd[1]} r={2.4 * k} fill={p.color} opacity={0.2 + 0.6 * (i / Math.max(1, p.dots.length))} />)}
          </g>
        ))}
      </g>
      {pts.map((p) => (
        <g key={p.sym} onMouseEnter={() => enter(p.sym)} onMouseLeave={() => leave(p.sym)} onClick={() => pin(p.sym)} data-click style={{ cursor: "pointer", transition: "opacity .35s" }} opacity={anyF && !p.f ? 0.3 : 1}>
          <circle cx={p.x} cy={p.y} r={16 * k} fill={p.color} opacity={p.f ? 0.32 : 0.14} />
          <circle cx={p.x} cy={p.y} r={(p.f ? 7 : 6) * k} fill={p.color} stroke={pins[p.sym] ? "#ffffff" : "#02050b"} strokeWidth={2 * k} />
          <text x={p.x + p.lx * k} y={p.y + p.ly * k} textAnchor={p.la} fill={p.f ? "#ffffff" : p.color} fontSize={(p.f ? 15 : 12.5) * k} fontWeight={500} fontFamily="JetBrains Mono, monospace" stroke="#02050b" strokeWidth={4 * k} strokeLinejoin="round" paintOrder="stroke">
            {p.sym}
          </text>
        </g>
      ))}
    </svg>
  );
}
