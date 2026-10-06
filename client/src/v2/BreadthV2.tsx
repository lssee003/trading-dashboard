import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import type { SheetsCell, SheetsData } from "@shared/schema";
import { generateBreadthAnalysis, computeCellColor, COL } from "@/pages/GoogleSheets";
import { useV2, PageHead, Seg, RegimeChips, Loading, Dot, HScroll } from "./ui";
import { SIG, MONO, SERIF, PANEL, num, sentence, regimeSig } from "./tokens";

const PAIRS: [string, number, number, string, string, string][] = [
  ["4% today", COL.UP_4_TODAY, COL.DOWN_4_TODAY, "Up 4%+", "Down 4%+", "Stocks moving 4% or more in a day"],
  ["25% quarter", COL.UP_25_QTR, COL.DOWN_25_QTR, "Up 25%+", "Down 25%+", "Stocks moving 25% or more in a quarter"],
  ["25% month", COL.UP_25_MTH, COL.DOWN_25_MTH, "Up 25%+", "Down 25%+", "Stocks moving 25% or more in a month"],
  ["50% month", COL.UP_50_MTH, COL.DOWN_50_MTH, "Up 50%+", "Down 50%+", "Stocks moving 50% or more in a month"],
  ["13% / 34 days", COL.UP_13_34D, COL.DOWN_13_34D, "Up 13%+", "Down 13%+", "Stocks moving 13% or more in 34 days"],
];

/** Daily log: rows per infinite-scroll page, column widths (shared by the pinned header and the body), cell ground */
const LOG_PAGE = 60;
const colW = (i: number) => (i === 0 ? 112 : 104);
const LOG_BG = "#03070e";

const val = (r: SheetsCell[] | undefined, i: number) => (r && r[i] ? r[i].value : null);
const numAt = (r: SheetsCell[] | undefined, i: number) => { const v = val(r, i); return typeof v === "number" ? v : null; };

/** Calendar year of a row's date cell ("10/2/2026" or a Sheets serial number) */
function rowYear(r: SheetsCell[] | undefined): number | null {
  const v = val(r, COL.DATE);
  if (v == null || v === "") return null;
  const d = new Date(typeof v === "number" ? (v - 25569) * 86400000 : String(v));
  return isNaN(d.getTime()) ? null : d.getFullYear();
}

/** Skip any leading header / blank rows (same rule as the classic page) */
function dataRowsOf(rows: SheetsCell[][]): SheetsCell[][] {
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const first = rows[i]?.[0]?.value;
    if (typeof first === "string" && (first.toLowerCase().includes("date") || first === "")) continue;
    if (rows[i]?.every((c) => c.value === null)) continue;
    return rows.slice(i);
  }
  return rows;
}

export default function BreadthV2() {
  const { data: sh } = useQuery<SheetsData>({ queryKey: ["/api/sheets"] });
  if (!sh) return <div style={{ paddingTop: 10 }}><Loading>Reading the sheet</Loading></div>;
  return <Breadth sh={sh} />;
}

function Breadth({ sh }: { sh: SheetsData }) {
  const { mobile, contentW, accent, mainRef } = useV2();
  const [pair, setPair] = useState(0);
  const [limit, setLimit] = useState(LOG_PAGE);
  const headRef = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const pinMark = useRef<HTMLDivElement>(null);
  const pinWrap = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);
  const [view, setView] = useState<"chart" | "notes">("chart");
  const [hover, setHover] = useState<number | null>(null);

  const rows = useMemo(() => dataRowsOf(sh.rows || []), [sh]);
  const today = rows[0];
  const an = useMemo(() => generateBreadthAnalysis(rows), [rows]);
  const pr = PAIRS[pair];
  // Year to date; early in the year (under 60 sessions) fall back to the last 60
  const days = useMemo(() => {
    const yr = rowYear(rows[0]);
    let n = 0;
    while (n < rows.length && rowYear(rows[n]) === yr) n++;
    return yr == null ? 120 : Math.max(n, 60);
  }, [rows]);
  const ytd = days > 60 || rowYear(rows[days - 1]) === rowYear(rows[0]);

  const chart = useMemo(() => {
    const sl = rows.slice(0, days).reverse().filter((r) => typeof val(r, pr[1]) === "number");
    const up = sl.map((r) => numAt(r, pr[1]) ?? 0), dn = sl.map((r) => numAt(r, pr[2]) ?? 0);
    return { up, dn, sp: sl.map((r) => numAt(r, COL.SP500) || 0), dates: sl.map((r) => String(val(r, COL.DATE))), max: Math.max(1, ...up, ...dn), upLabel: pr[3], dnLabel: pr[4] };
  }, [rows, pr, days]);

  const sgc: Record<string, string> = { bullish: SIG.up.c, bearish: SIG.down.c, caution: SIG.mid.c };
  const rgc = regimeSig(an?.regime.signal).c;
  const [verb, ...rest] = String(an?.stance || "").split(" — ");
  const up = an?.primary.up ?? 0, down = an?.primary.down ?? 0, tot = up + down, net = up - down;

  const t2108 = numAt(today, COL.T2108), r5 = numAt(today, COL.RATIO_5D), r10 = numAt(today, COL.RATIO_10D);
  const rcol = (v: number | null) => (v == null ? "#f2f1ed" : v >= 1.5 ? SIG.up.c : v >= 0.8 ? SIG.mid.c : SIG.down.c);
  const stats = [
    { label: "Up 4%+ today", value: num(numAt(today, COL.UP_4_TODAY)), color: SIG.up.c, sub: "Breakouts" },
    { label: "Down 4%+ today", value: num(numAt(today, COL.DOWN_4_TODAY)), color: SIG.down.c, sub: "Breakdowns" },
    { label: "5-day ratio", value: r5 != null ? r5.toFixed(2) : "—", color: rcol(r5), sub: "Up ÷ down, 5 sessions" },
    { label: "10-day ratio", value: r10 != null ? r10.toFixed(2) : "—", color: rcol(r10), sub: "Up ÷ down, 10 sessions" },
    { label: "T2108", value: t2108 != null ? t2108.toFixed(1) : "—", color: t2108 == null ? "#f2f1ed" : t2108 < 20 ? SIG.up.c : t2108 > 79.99 ? SIG.down.c : "#f2f1ed", sub: "% above 40-day MA" },
  ];

  const notes = view === "notes";
  const gh = sh.groupHeaders || [];
  const hdr = sh.headers || [];
  const label: CSSProperties = { paddingBottom: 6, borderBottom: "1px solid rgba(150,190,255,.09)", fontFamily: MONO, fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: "#9fb0c6" };
  const groupTh: CSSProperties = { fontFamily: MONO, fontWeight: 400, fontSize: 10.5, letterSpacing: ".14em", textTransform: "uppercase", padding: 10, borderRadius: 8 };

  // Daily log: fixed column widths so the pinned header lines up with the body, and infinite scroll
  const logTable: CSSProperties = { tableLayout: "fixed", width: hdr.reduce((w, _, i) => w + colW(i) + 2, 2), borderCollapse: "separate", borderSpacing: 2, fontSize: 12.5, fontFamily: MONO, fontVariantNumeric: "tabular-nums" };
  const logCols = <colgroup>{hdr.map((_, i) => <col key={i} style={{ width: colW(i) }} />)}</colgroup>;
  const moreLog = rows.length > limit;
  useEffect(() => {
    const el = sentinel.current;
    if (!moreLog || !el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((es) => { if (es[0]?.isIntersecting) setLimit((l) => l + LOG_PAGE); }, { root: mainRef.current, rootMargin: "0px 0px 800px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [moreLog, limit, mainRef]);
  // Once the log header is pinned, back it with a solid strip so rows don't show through the app bar's fade.
  // A zero-height marker sits just above the header: when it scrolls away from the header, the header is pinned.
  useEffect(() => {
    const m = mainRef.current;
    if (!m) return;
    let raf = 0;
    const check = () => { raf = 0; const a = pinMark.current, b = pinWrap.current; if (a && b) setPinned(b.getBoundingClientRect().top - a.getBoundingClientRect().top > 30); };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(check); };
    m.addEventListener("scroll", onScroll, { passive: true });
    check();
    return () => { m.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, [mainRef]);

  return (
    <div data-screen-label="Breadth" style={{ display: "flex", flexDirection: "column", gap: 24, paddingTop: 10 }}>
      <PageHead meta={`${num(numAt(today, COL.WORDEN))} common stocks · latest ${val(today, COL.DATE) ?? "—"}`} italic="Market" after="breadth" />
      {an && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <RegimeChips regime={sentence(an.regime.label)} regimeColor={rgc} stanceHead={sentence(verb)} stanceTail={rest.join(" — ")} />
          {/* Quarterly breadth (stocks ±25% in a quarter) */}
          <span title="Stocks up / down 25%+ in a quarter" style={{ display: "flex", alignItems: "center", gap: 10, height: 34, padding: "0 16px", borderRadius: 17, background: "rgba(8,14,26,.6)", border: "1px solid rgba(150,190,255,.14)", fontFamily: MONO, fontSize: 12, whiteSpace: "nowrap" }}>
            <span style={{ fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#9fb0c6" }}>Qtr breadth</span>
            <span style={{ color: SIG.up.c }}>{num(up)}</span>
            <span style={{ display: "flex", gap: 2, width: 88, height: 3 }}>
              <span style={{ width: (tot ? (up / tot) * 100 : 50) + "%", borderRadius: 2, background: SIG.up.c, boxShadow: `0 0 8px ${SIG.up.c}` }} />
              <span style={{ flex: 1, borderRadius: 2, background: SIG.down.c, boxShadow: `0 0 8px ${SIG.down.c}` }} />
            </span>
            <span style={{ color: SIG.down.c }}>{num(down)}</span>
            <span style={{ paddingLeft: 10, borderLeft: "1px solid rgba(150,190,255,.14)", color: net >= 0 ? SIG.up.c : SIG.down.c }}>{(net >= 0 ? "+" : "−") + num(Math.abs(net))}</span>
          </span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        {stats.map((x) => (
          <div key={x.label} style={{ ...PANEL, boxShadow: undefined, padding: "16px 18px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "#9fb0c6" }}>{x.label}</span>
            <span style={{ fontFamily: SERIF, fontSize: 48, lineHeight: 1, color: x.color, fontVariantNumeric: "tabular-nums" }}>{x.value}</span>
            <span style={{ fontSize: 12, color: "#7f8ea3" }}>{x.sub}</span>
          </div>
        ))}
      </div>

      {/* Chart / Commentary card */}
      <div style={{ borderRadius: 16, padding: "20px 22px 16px", display: "flex", flexDirection: "column", gap: 18, background: "rgba(4,8,16,.7)", border: "1px solid rgba(150,190,255,.12)", WebkitBackdropFilter: "blur(16px)", backdropFilter: "blur(16px)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
            <span style={{ fontFamily: SERIF, fontSize: 26, lineHeight: 1.1, color: "#eef3fa" }}>{notes ? "Breadth commentary" : pr[5]}</span>
            <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "#7f8ea3" }}>
              {notes
                ? an ? `${an.keySignals.length} signals · ${an.significantEvents.length} events · latest ${val(today, COL.DATE)}` : "Reading the sheet"
                : `${ytd ? "Year to date · " : "Last "}${chart.up.length} sessions · up above, down below · S&P 500 traced`}
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, maxWidth: "100%" }}>
            {!notes && <Seg size="sm" opts={PAIRS.map((p, i) => ({ value: i, label: p[0] }))} value={pair} onChange={(v) => { setPair(v); setHover(null); }} />}
            <Seg size="sm" padX={14} opts={[{ value: "chart", label: "Chart" }, { value: "notes", label: "Commentary" }]} value={view} onChange={(v) => { setView(v); setHover(null); }} />
          </div>
        </div>

        {!notes && <BreadthChart data={chart} hover={hover} setHover={setHover} />}

        {notes && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18, minHeight: 320 }}>
            {an ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: mobile || contentW < 900 ? "minmax(0,1fr)" : "repeat(2, minmax(0,1fr))", gap: "24px 36px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ ...label, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                        <span>Primary trend</span>
                        <span style={{ letterSpacing: ".14em", color: an.primary.bullish ? SIG.up.c : SIG.down.c }}>{an.primary.label}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: "#c0ccdb", textWrap: "pretty" } as CSSProperties}>{an.primary.trajectory}</p>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={label}>Key signals</div>
                      {an.keySignals.map((g, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                          <Dot color={sgc[g.type]} glow={8} style={{ marginTop: 6 }} />
                          <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4, color: sgc[g.type] }}>{g.label}</span>
                            <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "#9fb0c6", textWrap: "pretty" } as CSSProperties}>{g.detail}</span>
                          </div>
                        </div>
                      ))}
                      {!an.keySignals.length && <span style={{ fontSize: 12.5, color: "#7f8ea3" }}>No notable signals on the latest read.</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={label}>Significant events · recent</div>
                      {an.significantEvents.map((ev, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                          {ev.date && <span style={{ flexShrink: 0, marginTop: 1, padding: "2px 7px", borderRadius: 6, background: "rgba(89,216,255,.14)", color: "#8fe6ff", fontFamily: MONO, fontSize: 10.5, whiteSpace: "nowrap" }}>{ev.date}</span>}
                          <span style={{ fontSize: 12.5, lineHeight: 1.55, color: "#b8c5d6", textWrap: "pretty" } as CSSProperties}>{ev.description}</span>
                        </div>
                      ))}
                      {!an.significantEvents.length && <span style={{ fontSize: 12.5, color: "#7f8ea3" }}>No threshold events in the recent window.</span>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={label}>Assessment</div>
                      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "#c0ccdb", textWrap: "pretty" } as CSSProperties}>{an.assessment}</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <span style={{ fontSize: 12.5, color: "#7f8ea3" }}>Not enough breadth history to read.</span>
            )}
          </div>
        )}
      </div>

      {/* Daily log */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontFamily: SERIF, fontSize: 30, color: "#eef3fa" }}>The daily <span style={{ fontStyle: "italic", color: accent.hex }}>log</span></span>
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "#7f8ea3" }}>{sh.sheetTitle || "Market Breadth"}</span>
        </div>
        {/* Header pinned under the app bar; it scrolls sideways in step with the body below */}
        <div ref={pinMark} aria-hidden="true" style={{ height: 0, marginBottom: -14 }} />
        <div ref={pinWrap} style={{ position: "sticky", top: 76, zIndex: 5 }}>
        <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, bottom: "100%", height: 90, background: LOG_BG, opacity: pinned ? 1 : 0, pointerEvents: "none" }} />
        <div ref={headRef} style={{ overflow: "hidden", background: LOG_BG, boxShadow: "0 14px 20px -16px rgba(0,0,0,.9)" }}>
          <table style={logTable}>
            {logCols}
            <thead>
              <tr>
                <th style={{ position: "sticky", left: 0, zIndex: 3, background: LOG_BG, boxShadow: `0 0 0 2px ${LOG_BG}` }} />
                <th colSpan={6} style={{ ...groupTh, background: "#1a1608", color: "#ffd88a" }}>{gh[1] || "Primary Breadth Indicators"}</th>
                <th colSpan={Math.max(1, hdr.length - 7)} style={{ ...groupTh, background: "#07181a", color: "#8ff0cc" }}>{gh[7] || "Secondary Breadth Indicators"}</th>
              </tr>
              <tr>
                {hdr.map((h, i) => (
                  <th key={i} style={{ position: i === 0 ? "sticky" : "static", left: 0, zIndex: i === 0 ? 3 : 1, background: LOG_BG, boxShadow: `0 0 0 2px ${LOG_BG}`, color: "#9fb0c6", fontFamily: "'Geist', sans-serif", fontWeight: 400, fontSize: 11.5, lineHeight: 1.3, textAlign: i === 0 ? "left" : "right", verticalAlign: "bottom", padding: "8px 10px" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
          </table>
        </div>
        </div>
        <div style={{ marginTop: -12 }}>
        <HScroll chevronTop={6} onScrollX={(x) => { if (headRef.current) headRef.current.scrollLeft = x; }}>
          <table style={logTable}>
            {logCols}
            <tbody>
              {rows.slice(0, limit).map((r, ri) => (
                <tr key={ri} data-reveal style={{ ["--rv-y" as string]: "10px", transition: "opacity .7s ease, transform .8s cubic-bezier(.16,1,.3,1)" }}>
                  {hdr.map((_, ci) => {
                    const v = val(r, ci);
                    const c = ci === 0 ? null : computeCellColor(r, ci, "v2");
                    const txt = typeof v === "number"
                      ? ci === COL.RATIO_5D || ci === COL.RATIO_10D || ci === COL.T2108 || ci === COL.SP500 ? v.toLocaleString("en-US", { maximumFractionDigits: 2 }) : num(v)
                      : v ?? "";
                    return (
                      <td key={ci} style={{
                        position: ci === 0 ? "sticky" : "static", left: 0, zIndex: ci === 0 ? 1 : 0,
                        background: ci === 0 ? LOG_BG : c ? c.bg : "rgba(140,180,255,.035)",
                        boxShadow: ci === 0 ? `0 0 0 2px ${LOG_BG}` : "none",
                        color: ci === 0 ? "#dfe7f2" : c ? c.text : "#aebbcc", fontWeight: c?.bold ? 600 : 400,
                        textAlign: ci === 0 ? "left" : "right", padding: "8px 10px", borderRadius: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        {txt}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </HScroll>
        </div>
        {moreLog && <div ref={sentinel} aria-hidden="true" style={{ height: 1 }} />}
      </div>
    </div>
  );
}

function BreadthChart({ data, hover, setHover }: { data: { up: number[]; dn: number[]; sp: number[]; dates: string[]; max: number; upLabel: string; dnLabel: string }; hover: number | null; setHover: (i: number | null) => void }) {
  const { up, dn, sp, dates, max, upLabel, dnLabel } = data, n = up.length;
  if (!n) return <div style={{ height: 300 }} />;
  const W = n * 10, H = 320, mid = 160, k = 138 / (max || 1);
  const spMin = Math.min(...sp), spMax = Math.max(...sp);
  const line = sp.map((v, i) => `${i * 10 + 5},${(300 - ((v - spMin) / (spMax - spMin || 1)) * 280).toFixed(1)}`).join(" ");
  const hi = hover != null && hover >= 0 && hover < n ? hover : null;
  return (
    <div
      style={{ position: "relative" }}
      onMouseMove={(ev) => { const r = ev.currentTarget.getBoundingClientRect(); const i = Math.floor(((ev.clientX - r.left) / r.width) * n); if (i !== hover) setHover(i); }}
      onMouseLeave={() => setHover(null)}
    >
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 300, display: "block" }} role="img" aria-label={`${upLabel} vs ${dnLabel}, last ${n} sessions`}>
        <line x1={0} y1={mid} x2={W} y2={mid} stroke="rgba(255,255,255,.12)" vectorEffect="non-scaling-stroke" />
        {up.map((v, i) => <rect key={"u" + i} x={i * 10 + 2} y={mid - 3 - v * k} width={6} height={Math.max(1, v * k)} rx={3} fill="#3fe0a6" opacity={hi == null || hi === i ? 0.9 : 0.35} />)}
        {dn.map((v, i) => <rect key={"d" + i} x={i * 10 + 2} y={mid + 3} width={6} height={Math.max(1, v * k)} rx={3} fill="#ff5c5c" opacity={hi == null || hi === i ? 0.9 : 0.35} />)}
        <polyline points={line} fill="none" stroke="rgba(255,255,255,.55)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      </svg>
      {hi != null && (
        <div style={{ position: "absolute", top: 6, left: `${((hi + 0.5) / n) * 100}%`, transform: `translateX(${hi / n > 0.6 ? "calc(-100% - 14px)" : "14px"})`, padding: "12px 16px", borderRadius: 18, background: "rgba(24,24,26,.92)", backdropFilter: "blur(12px)", boxShadow: "0 0 0 1px rgba(255,255,255,.08), 0 20px 40px rgba(0,0,0,.5)", fontSize: 13, whiteSpace: "nowrap", pointerEvents: "none", display: "flex", flexDirection: "column", gap: 4, fontFamily: MONO }}>
          <span style={{ color: "#a1a1a6", fontFamily: "Geist, sans-serif" }}>{dates[hi]}</span>
          <span style={{ color: "#3fe0a6" }}>{`${upLabel} ${up[hi].toLocaleString()}`}</span>
          <span style={{ color: "#ff5c5c" }}>{`${dnLabel} ${dn[hi].toLocaleString()}`}</span>
          <span style={{ color: "#dcdbd7" }}>{`S&P ${sp[hi].toLocaleString()}`}</span>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 12, color: "#808085", fontFamily: MONO }}>
        <span>{dates[0]}</span>
        <span>{dates[n - 1]}</span>
      </div>
    </div>
  );
}
