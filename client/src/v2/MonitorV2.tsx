import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CategoryScore, DashboardData } from "@shared/schema";
import { useV2, Dot, MiniSeg, RegimeChips, TAPE_H } from "./ui";
import { SIG, MONO, SERIF, PANEL, KICKER, num, pct, accentFor, regimeSig, prefersReducedMotion, sentence, type Sig } from "./tokens";

const VERDICT: Record<string, [string, string]> = {
  YES: ["Trade.", "Full position sizing, press risk."],
  CAUTION: ["Caution.", "Half size, A+ setups only."],
  NO: ["Avoid.", "Preserve capital, stay patient."],
};

const scoreSig = (v: number): Sig => (v >= 70 ? SIG.up : v >= 50 ? SIG.mid : SIG.down);
const statusLabel = (v: number) => (v >= 70 ? "Healthy" : v >= 50 ? "Neutral" : v >= 35 ? "Weakening" : "Risk-off");
const sigOf = (k: string) => (k === "bullish" ? SIG.up : k === "bearish" ? SIG.down : SIG.mid);
const arrowOf = (dir: string) => (dir === "up" ? "↑" : dir === "down" ? "↓" : "→");

/** 100 gauge tick segments (index = score unit); 60/80 are threshold ticks drawn separately */
const TICKS = Array.from({ length: 100 }, (_, i) => {
  const P = (r: number, a: number) => (100 + r * Math.cos(a)).toFixed(2) + " " + (100 + r * Math.sin(a)).toFixed(2);
  const a = ((-90 + i * 3.6) * Math.PI) / 180, thr = i === 60 || i === 80, major = i % 10 === 0;
  const r1 = thr ? 99 : 94, r2 = thr ? 80 : major ? 84 : 88;
  return { d: "M" + P(r1, a) + "L" + P(r2, a), thr };
});
const TH_PATH = TICKS.filter((t) => t.thr).map((t) => t.d).join("");
const labelPos = (i: number) => { const a = ((-90 + i * 3.6) * Math.PI) / 180; return [+(100 + 107 * Math.cos(a)).toFixed(1), +(100 + 107 * Math.sin(a)).toFixed(1)]; };
const L60 = labelPos(60), L80 = labelPos(80);

/** Filled (accent) and unfilled tick paths for a score */
function gaugePaths(score: number) {
  let on = "", off = "";
  for (let i = 0; i < 100; i++) {
    if (TICKS[i].thr) continue;
    if (i < score) on += TICKS[i].d; else off += TICKS[i].d;
  }
  return { on, off };
}

export default function MonitorV2() {
  const { data: d } = useQuery<DashboardData>({ queryKey: ["/api/dashboard"] });
  if (!d) return null;
  return <Monitor d={d} />;
}

function Monitor({ d }: { d: DashboardData }) {
  const { mobile, contentW, h, gaugeRef, pulse } = useV2();
  const [burstView, setBurstView] = useState<"5d" | "10d" | null>(null);
  const [breadthView, setBreadthView] = useState<"mth" | "qtr" | null>(null);
  const [osTip, setOsTip] = useState(false);

  const score = Math.round(d.marketQualityScore);
  const ac = accentFor(d);
  const color = ac.hex, glow = `rgba(${ac.rgb.join(",")},.55)`;
  const [line1, line2] = VERDICT[d.decision] || [d.decision, ""];
  const ta = d.terminalAnalysis;
  const reg = ta?.regime;
  const parts = String(ta?.stance || "").split(/\s*—\s*/);

  // ── Layout ──
  const availH = h - 76 - 24 - TAPE_H;
  const dense = !mobile && availH < 820;
  // Mobile keeps the dial compact so the verdict, chips and market row still land on the first screen
  const g = mobile ? Math.min(contentW - 40, 228) : Math.round(Math.max(220, Math.min(contentW * 0.22, availH * 0.42, 330)));
  const heroCols = mobile ? "minmax(0,1fr)" : contentW < 1080 ? "minmax(0,1fr) auto" : "minmax(0,1.05fr) auto minmax(0,1fr)";
  const catCols = mobile ? "minmax(0,1fr)" : contentW < 1080 ? "repeat(3, minmax(0,1fr))" : "repeat(5, minmax(0,1fr))";
  const rowPad = dense ? "4px 0" : "6px 0", rowFs = dense ? 12 : 12.5;
  // Verdict size from the layout width (vw units drift under the laptop zoom), then
  // shrunk in 6% steps until the Monitor fits one screen — a 3-line verdict is the usual overflow
  const layoutW = contentW + 56;
  const baseHead = mobile ? 52 : dense ? Math.max(42, Math.min(layoutW * 0.04, 62)) : Math.max(46, Math.min(layoutW * 0.046, 78));
  const [fit, setFit] = useState(1);
  const monRef = useRef<HTMLDivElement>(null);
  const minH = h - 76 - 10 - TAPE_H;
  useEffect(() => setFit(1), [contentW, h, d.decision]);
  useLayoutEffect(() => {
    const el = monRef.current;
    if (!el || mobile || fit <= 0.64) return;
    if (el.offsetHeight > minH + 1) setFit((f) => +(f - 0.06).toFixed(2));
  });
  const headFs = Math.round(baseHead * fit) + "px";

  const gp = useMemo(() => gaugePaths(score), [score]);

  // ── Score count-up 0 → score over 1.7s on every arrival at Monitor; the dial ticks fill in step ──
  // Layout effect so the 0 / empty-dial state is set before first paint (no flash of the final value)
  const scoreRef = useRef<HTMLSpanElement>(null);
  const onRef = useRef<SVGPathElement>(null);
  const offRef = useRef<SVGPathElement>(null);
  useLayoutEffect(() => {
    const el = scoreRef.current, on = onRef.current, off = offRef.current;
    if (!el || !on || !off) return;
    let shown = -1;
    const draw = (v: number) => {
      if (v === shown) return;
      shown = v;
      el.textContent = String(v);
      const p = gaugePaths(v);
      on.setAttribute("d", p.on);
      off.setAttribute("d", p.off);
    };
    if (prefersReducedMotion()) { draw(score); return; }
    draw(0);
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 1700);
      draw(Math.round((1 - Math.pow(1 - p, 3)) * score));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); draw(score); };
  }, [score, pulse]);

  const tk = (sym: string) => d.tickers.find((t) => t.symbol === sym);
  const notes = [["SPY", "SPY"], ["VIX", "VIX"], ["TNX", "10Y"], ["DXY", "DXY"]].map(([sym, label]) => {
    const t = tk(sym);
    return t ? { label, v: num(t.price, 2), c: pct(t.changePercent), color: t.changePercent >= 0 ? SIG.up.c : SIG.down.c } : { label, v: "—", c: "", color: "#7f8ea3" };
  });

  const secs = [...(d.sectors || [])].sort((a, b) => b.changePercent - a.changePercent);
  const mx = Math.max(0.3, ...secs.map((x) => Math.abs(x.changePercent)));

  const bv = burstView || d.burst?.view || "10d";
  const brv = breadthView || d.breadthToggle?.view || "qtr";

  type Row = { label: string; main: string; qual: string; color: string; arrow: string; opts?: JSX.Element; oversold?: boolean };
  const detail = (dt: CategoryScore["details"][number]): Row => {
    if (dt.burstToggle && d.burst) {
      const b = d.burst.data[bv];
      const s = b.ratio >= 1.5 ? SIG.up : b.ratio >= 0.8 ? SIG.mid : SIG.down;
      return { label: "4% Burst", main: (b.ratio != null ? b.ratio.toFixed(2) : "—") + "x", qual: `↑${num(b.breakouts)} / ↓${num(b.breakdowns)}`, color: s.c, arrow: b.ratio >= 1 ? "↑" : "↓",
        opts: <MiniSeg opts={[{ value: "5d", label: "5D" }, { value: "10d", label: "10D" }]} value={bv} onChange={setBurstView} /> };
    }
    if (dt.breadthToggleFlag && d.breadthToggle) {
      const b = d.breadthToggle.data[brv];
      const s = b.net > 0 ? SIG.up : b.net > -30 ? SIG.mid : SIG.down;
      const ql = b.net > 50 ? "Healthy" : b.net > 0 ? "Positive" : b.net > -50 ? "Caution" : "High-risk";
      return { label: "Breadth", main: (b.net > 0 ? "+" : "") + num(b.net), qual: `${ql} · ↑${num(b.up)} / ↓${num(b.down)}`, color: s.c, arrow: b.net >= 0 ? "↑" : "↓",
        opts: <MiniSeg opts={[{ value: "mth", label: "Month" }, { value: "qtr", label: "Quarter" }]} value={brv} onChange={setBreadthView} /> };
    }
    const sp = String(dt.value).split(/\s{2,}/);
    return { label: dt.label, main: sp[0], qual: sp.slice(1).join(" "), color: sigOf(dt.signal).c, arrow: arrowOf(dt.direction), oversold: !!dt.oversoldAlert };
  };

  const cats = d.categories.map((c) => ({ c, sc: Math.round(c.score), s: scoreSig(Math.round(c.score)), rows: c.details.map(detail) }));

  return (
    <div ref={monRef} data-screen-label="Monitor" style={{ minHeight: mobile ? "auto" : minH, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: heroCols, gap: "24px 40px", alignItems: "center" }}>
        {/* Verdict */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0, maxWidth: 560 }}>
          <div style={{ ...KICKER, display: "flex", alignItems: "center", gap: 10, color: "#9fb0c6" }}>
            <Dot color={color} />
            Should I be trading?
          </div>
          <h1 style={{ margin: 0, fontFamily: SERIF, fontWeight: 400, fontSize: headFs, lineHeight: 0.98, letterSpacing: "-0.01em" }}>
            <span style={{ display: "block", fontStyle: "italic", color, textShadow: `0 0 42px ${glow}` }}>{line1}</span>
            <span style={{ display: "block", fontStyle: "italic", color: "#eef3fa" }}>{line2}</span>
          </h1>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: "#a3b3c8", maxWidth: 480, textWrap: "pretty", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>
            {ta?.narrative || d.summary}
          </p>
          <RegimeChips regime={sentence(reg?.label)} regimeColor={regimeSig(reg?.signal).c} stanceHead={parts[0] || ""} stanceTail={parts[1] || ""} />
          {ta?.bounceAlert && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, lineHeight: 1.45, color: "#ffd88a", maxWidth: 480 }}>
              <Dot color="#ffc24a" glow={8} style={{ marginTop: 6 }} />
              <span>{ta.bounceAlert}</span>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", borderTop: "1px solid rgba(150,190,255,.10)", paddingTop: 12, maxWidth: 480 }}>
            {notes.map((nt) => (
              <div key={nt.label} style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, fontFamily: MONO }}>
                <span style={{ fontSize: 10, letterSpacing: ".14em", color: "#7f8ea3" }}>{nt.label}</span>
                <span style={{ fontSize: 13.5, color: "#eef3fa" }}>{nt.v}</span>
                <span style={{ fontSize: 11, color: nt.color }}>{nt.c}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Gauge */}
        <div style={{ justifySelf: "center", position: "relative", order: mobile ? -1 : undefined, marginBottom: mobile ? 24 : undefined }}>
          <div ref={gaugeRef} role="img" aria-label={`Market quality ${score} of 100, decision ${d.decision}`} style={{ position: "relative", width: g, height: g }}>
            <svg viewBox="0 0 200 200" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }} aria-hidden="true">
              <circle cx="100" cy="100" r="98" fill="rgba(2,5,11,.62)" />
              <path ref={offRef} d={gp.off} stroke="rgba(150,190,255,.22)" strokeWidth="0.9" fill="none" />
              <path ref={onRef} d={gp.on} stroke={color} strokeWidth="1.3" fill="none" />
              <path d={TH_PATH} stroke="#eef3fa" strokeWidth="1.3" fill="none" />
              <circle cx="100" cy="100" r="74" fill="none" stroke="rgba(150,190,255,.10)" strokeWidth="0.6" />
              <text x={L60[0]} y={L60[1]} fill="#9fb0c6" fontSize="7" fontFamily="JetBrains Mono, monospace" textAnchor="middle" dominantBaseline="middle">60</text>
              <text x={L80[0]} y={L80[1]} fill="#9fb0c6" fontSize="7" fontFamily="JetBrains Mono, monospace" textAnchor="middle" dominantBaseline="middle">80</text>
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, textAlign: "center" }}>
              <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", color: "#9fb0c6" }}>Market quality</span>
              <span ref={scoreRef} style={{ fontFamily: SERIF, fontSize: Math.round(g * 0.4), lineHeight: 0.9, color: "#f4f7fb", textShadow: `0 0 40px ${glow}`, fontVariantNumeric: "tabular-nums" }}>{score}</span>
              <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: ".16em", textTransform: "uppercase", color }}>Decision · {d.decision}</span>
            </div>
          </div>
        </div>

        {/* Sectors */}
        <div style={{ ...PANEL, minWidth: 0, padding: "16px 18px 10px", gridColumn: !mobile && contentW < 1080 ? "1 / -1" : undefined }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, fontFamily: MONO }}>
            <span style={{ fontSize: 10.5, letterSpacing: ".16em", textTransform: "uppercase", color: "#c9d5e4" }}>Sectors · today</span>
            <span style={{ fontSize: 10, letterSpacing: ".12em", color: "#7f8ea3" }}>SPDR ETFs</span>
          </div>
          {secs.map((x) => {
            const v = x.changePercent, w = (Math.abs(v) / mx) * 50, c = v >= 0 ? SIG.up.c : SIG.down.c;
            return (
              <div key={x.symbol} style={{ display: "grid", gridTemplateColumns: "42px minmax(0,1.1fr) minmax(50px,1fr) 56px", gap: 10, alignItems: "center", padding: rowPad, borderTop: "1px solid rgba(150,190,255,.07)" }}>
                <span style={{ fontFamily: MONO, fontSize: 12, color: "#e8eef6" }}>{x.symbol}</span>
                <span style={{ fontSize: 12.5, color: "#9fb0c6", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{x.name}</span>
                <div style={{ position: "relative", height: 6, borderRadius: 3, background: "rgba(150,190,255,.07)" }}>
                  <div style={{ position: "absolute", top: 0, bottom: 0, left: (v >= 0 ? 50 : 50 - w) + "%", width: w + "%", borderRadius: 3, background: c, boxShadow: `0 0 10px ${c}` }} />
                  <div style={{ position: "absolute", left: "50%", top: -3, bottom: -3, width: 1, background: "rgba(150,190,255,.3)" }} />
                </div>
                <span style={{ fontFamily: MONO, fontSize: 12, color: c, textAlign: "right" }}>{pct(v)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category panels */}
      <div style={{ display: "grid", gridTemplateColumns: catCols, gap: 10 }}>
        {cats.map(({ c, sc, s, rows }) => (
          <div key={c.name} style={{ ...PANEL, minWidth: 0, display: "flex", flexDirection: "column", padding: "14px 16px 8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, fontFamily: MONO }}>
              <span style={{ fontSize: 10.5, letterSpacing: ".16em", textTransform: "uppercase", color: "#c9d5e4" }}>{c.name}</span>
              <span style={{ fontSize: 10, letterSpacing: ".1em", color: "#7f8ea3" }}>{c.weight}% WT</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 6 }}>
              <span style={{ fontFamily: SERIF, fontSize: 40, lineHeight: 1, color: s.c, textShadow: `0 0 24px ${s.glow}` }}>{sc}</span>
              <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: s.c }}>{statusLabel(sc)}</span>
              <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 11, color: "#9fb0c6", whiteSpace: "nowrap" }}>+{((c.weight * c.score) / 100).toFixed(1)} pts</span>
            </div>
            <div style={{ height: 3, borderRadius: 2, background: "rgba(150,190,255,.10)", margin: "10px 0 4px" }}>
              <div style={{ width: sc + "%", height: "100%", borderRadius: 2, background: s.c, boxShadow: `0 0 10px ${s.c}` }} />
            </div>
            {rows.map((x, i) => (
              <div key={i} style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, padding: rowPad, borderTop: "1px solid rgba(150,190,255,.06)", minWidth: 0 }}>
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: x.color, flexShrink: 0 }} />
                <span title={x.qual} style={{ fontSize: rowFs, color: "#c0ccdb", flex: "0 1 auto", minWidth: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{x.label}</span>
                {x.oversold && (
                  <span
                    data-help
                    role="button"
                    tabIndex={0}
                    aria-label="Extreme oversold — details"
                    onMouseEnter={() => setOsTip(true)}
                    onMouseLeave={() => setOsTip(false)}
                    onFocus={() => setOsTip(true)}
                    onBlur={() => setOsTip(false)}
                    onClick={() => setOsTip(true)}
                    style={{ width: 7, height: 7, borderRadius: "50%", background: "#ffc24a", flexShrink: 0, cursor: "help", animation: "v2-os-pulse 1.6s ease-out infinite, v2-blink 1.6s ease-in-out infinite" }}
                  />
                )}
                <span style={{ flex: "1 1 0", minWidth: 0 }} />
                {x.oversold && osTip && (
                  <div role="tooltip" style={{ position: "absolute", left: -4, right: -4, bottom: "calc(100% + 6px)", zIndex: 30, display: "flex", flexDirection: "column", gap: 5, padding: "11px 13px", borderRadius: 12, background: "rgba(8,12,22,.97)", border: "1px solid rgba(255,194,74,.45)", boxShadow: "0 14px 34px rgba(0,0,0,.65)", pointerEvents: "none" }}>
                    <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: ".14em", textTransform: "uppercase", color: "#ffc24a" }}>Extreme oversold</span>
                    <span style={{ fontSize: 11.5, lineHeight: 1.5, color: "#c9d5e4", textWrap: "pretty" } as React.CSSProperties}>
                      Historically signals a sharp 3–5 day reflex bounce as selling exhausts. Not a trend reversal signal on its own — watch for follow-through before changing bias.
                    </span>
                  </div>
                )}
                {x.opts}
                {!x.opts && x.qual && <span style={{ fontSize: 10.5, color: "#7f8ea3", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "34%" }}>{x.qual}</span>}
                <span style={{ fontFamily: MONO, fontSize: rowFs, color: x.color, whiteSpace: "nowrap", flexShrink: 0 }}>{x.main} {x.arrow}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

    </div>
  );
}

/** Scrolling ticker tape; rendered by the shell as a bar pinned to the bottom of every page */
export function Tape({ d }: { d: DashboardData }) {
  const row = (k: string) => (
    <div key={k} aria-hidden={k === "b" ? true : undefined} style={{ display: "flex", flexShrink: 0 }}>
      {d.tickers.map((t) => (
        <span key={t.symbol} style={{ display: "inline-flex", alignItems: "baseline", gap: 8, marginRight: 34, whiteSpace: "nowrap", fontSize: 14 }}>
          <span style={{ color: "#dcdbd7" }}>{t.symbol}</span>
          <span style={{ color: "#8e8e93", fontFamily: MONO, fontSize: 13 }}>{num(t.price, 2)}</span>
          <span style={{ color: t.changePercent >= 0 ? SIG.up.c : SIG.down.c, fontFamily: MONO, fontSize: 13 }}>{pct(t.changePercent)}</span>
        </span>
      ))}
    </div>
  );
  return <div style={{ display: "flex", width: "max-content", animation: "v2-marquee 80s linear infinite" }}>{row("a")}{row("b")}</div>;
}
