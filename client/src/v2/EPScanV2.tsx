import { Fragment, useState, type CSSProperties, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { EpCandidate, EpScan, EpScreenerRow } from "@shared/schema";
import { useV2, PageHead, Loading, Dot, HScroll } from "./ui";
import { SIG, MONO, SERIF, PANEL, KICKER, num, pct, big, type Sig } from "./tokens";

/*
 * EP scan page. Reading order follows the method:
 *   1. Environment: is the tape conducive to episodic pivots at all (the three Trap #8 conditions)
 *   2. Verdict: what the day produced, and the watch list
 *   3. Board: every gapper on one grid, one column per criterion, so names compare at a glance
 */

/** Scored criteria, in grid order: id, column label, full name, max points (null = confirmed after the open). C1 and C2 are read by catalyst type (earnings or non-earnings); C8 scores only for a group-confirmed theme. */
const CRIT: [string, string, string, number | null][] = [
  ["C1", "Catalyst", "Catalyst magnitude", 1],
  ["C2", "Forward", "Forward visibility", 1],
  ["C3", "Neglect", "Neglected 6+ months", 2],
  ["C4", "Volume", "Record volume", 1],
  ["C5", "Float", "Float", 1],
  ["C6", "Short", "Short interest", 1.5],
  ["C7", "Funds", "Fund ownership", 1],
  ["C8", "Theme", "Hot theme (group-confirmed)", 0.5],
  ["C9", "Close", "Close near EP-day high", null],
];
const CRIT_NAME: Record<string, string> = Object.fromEntries(CRIT.map((c) => [c[0], c[2]]));
const CRIT_MAX: Record<string, number | null> = Object.fromEntries(CRIT.map((c) => [c[0], c[3]]));

const TRAPS: Record<number, string> = {
  1: "Priced-in extension", 2: "Buyout target at deal price", 3: "Midnight leader", 4: "Overreaction gap on weak catalyst",
  5: "Minor beat", 6: "Quiet gap", 7: "Gap-and-fade history", 8: "Bearish market", 9: "Choppy personality",
};

const KILL_SIGNAL = "Kill signal: a close below the pre-market entry price carries a 62% historical reversal rate.";

const OUTCOME_SIG: Record<string, Sig> = { PASS: SIG.up, PARTIAL: SIG.mid, FAIL: SIG.down };
const STATUS_WORD: Record<string, string> = { pass: "Met", partial: "Partial", fail: "Not met", unverified: "Unverified", tbd: "After the open" };
const CATALYST: Record<string, [string, string]> = { verified: ["Verified", SIG.up.c], unverified: ["Unverified", SIG.mid.c], none: ["None", "#8c9bb0"] };

const TEXT = "#eef3fa", BODY = "#c0ccdb", SOFT = "#9fb0c6", MUTED = "#8c9bb0", LINE = "rgba(150,190,255,.09)", RULE = "rgba(150,190,255,.14)";
const cap: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: SOFT };
const para: CSSProperties = { margin: 0, fontSize: 13.5, lineHeight: 1.6, color: BODY, maxWidth: "72ch", textWrap: "pretty" } as CSSProperties;
const mono: CSSProperties = { fontFamily: MONO, fontVariantNumeric: "tabular-nums" };

const dayOf = (iso: string) => new Date(iso + "T12:00:00Z");
const dayLong = (iso: string) => dayOf(iso).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const pts = (v: number | null | undefined) => (v == null ? "" : String(+v.toFixed(2)));
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export default function EPScanV2() {
  // One file, overwritten by each scan: the page always shows the latest run
  const { data: scan, isError } = useQuery<EpScan>({ queryKey: ["/api/ep"] });

  if (isError) {
    return (
      <div data-screen-label="EP scan" style={{ display: "flex", flexDirection: "column", gap: 24, paddingTop: 10 }}>
        <PageHead meta="Pre-market EP scan" italic="Episodic" after="pivots" />
        <p style={para}>No scan has been published yet. The pre-market scan posts here each trading day before the US open: the market environment first, then every gapper scored against the nine EP criteria.</p>
      </div>
    );
  }
  if (!scan) return <div style={{ paddingTop: 10 }}><Loading>Reading the scan</Loading></div>;

  const env = environment(scan);
  return (
    <div data-screen-label="EP scan" style={{ display: "flex", flexDirection: "column", gap: 28, paddingTop: 10 }}>
      <PageHead
        meta={<span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 10px" }}>
          <span>Pre-market EP scan</span>
          <span>· {dayLong(scan.scan_date)}</span>
          <span>· run {scan.run.et_time} ET</span>
        </span>}
        italic={env.word} after="EP environment"
      />
      <Scan scan={scan} env={env} />
    </div>
  );
}

/* ── 1. Environment ── */

interface Check { label: string; reading: string; rule: string; state: "clear" | "close" | "fires" | "unknown"; marks: number[]; threshold: number; dangerLeft: boolean }
interface Env { word: string; sig: Sig | null; line: string; checks: Check[] }

/**
 * The three Trap #8 conditions, each on its own scale. "Hostile" is the scan's own Trap #8 verdict.
 * "Mixed" is a softer read added here: no condition fires, but VIX is above 20 or the S&P is under one of its averages.
 */
function environment(scan: EpScan): Env {
  const m = scan.market;
  const pos = (v: number | null, lo: number, hi: number) => (v == null ? [] : [clamp01((v - lo) / (hi - lo))]);
  const s50 = m.spx_vs_sma50_pct, s200 = m.spx_vs_sma200_pct;
  const below = [s50, s200].filter((v) => v != null && v < 0).length;
  const checks: Check[] = [
    { label: "VIX", reading: m.vix != null ? m.vix.toFixed(2) : "n/a", rule: "Fires above 25",
      state: m.vix == null ? "unknown" : m.vix > 25 ? "fires" : m.vix > 20 ? "close" : "clear", marks: pos(m.vix, 10, 40), threshold: (25 - 10) / 30, dangerLeft: false },
    { label: "S&P 500, year to date", reading: pct(m.spx_ytd_pct, 1), rule: "Fires below −3%",
      state: m.spx_ytd_pct == null ? "unknown" : m.spx_ytd_pct < -3 ? "fires" : m.spx_ytd_pct < 0 ? "close" : "clear", marks: pos(m.spx_ytd_pct, -15, 25), threshold: 12 / 40, dangerLeft: true },
    { label: "S&P 500 vs 50-day / 200-day", reading: `${pct(s50, 1)} / ${pct(s200, 1)}`, rule: "Fires below both",
      state: s50 == null || s200 == null ? "unknown" : below === 2 ? "fires" : below === 1 ? "close" : "clear", marks: [...pos(s50, -10, 10), ...pos(s200, -10, 10)], threshold: 0.5, dangerLeft: true },
  ];
  const unknown = checks.some((c) => c.state === "unknown");
  const [word, sig, line] = m.trap8 ? ["Hostile", SIG.down, "Trap #8 fires. Every candidate drops one tier."]
    : unknown ? ["Unverified", null, "A market reading is missing, so the environment could not be judged."]
    : checks.some((c) => c.state === "close") ? ["Mixed", SIG.mid, "Trap #8 is clear, but at least one condition is close to firing."]
    : ["Conducive", SIG.up, "Trap #8 is clear on all three conditions."];
  return { word, sig, line, checks };
}

const STATE: Record<Check["state"], [string, string]> = { clear: ["Clear", SIG.up.c], close: ["Close", SIG.mid.c], fires: ["Fires", SIG.down.c], unknown: ["Unverified", MUTED] };

function Meter({ c }: { c: Check }) {
  const col = STATE[c.state][1];
  return (
    <span aria-hidden="true" style={{ position: "relative", display: "block", height: 14 }}>
      <span style={{ position: "absolute", left: 0, right: 0, top: 6, height: 2, borderRadius: 1, background: "rgba(150,190,255,.14)" }} />
      {/* the side of the scale where the condition fires */}
      <span style={{ position: "absolute", top: 6, height: 2, borderRadius: 1, background: "rgba(255,92,92,.55)", left: c.dangerLeft ? 0 : `${c.threshold * 100}%`, right: c.dangerLeft ? `${(1 - c.threshold) * 100}%` : 0 }} />
      <span style={{ position: "absolute", top: 1, bottom: 1, left: `${c.threshold * 100}%`, width: 1, background: "rgba(255,255,255,.5)" }} />
      {c.marks.map((p, i) => (
        <span key={i} style={{ position: "absolute", top: 3, left: `calc(${p * 100}% - 4px)`, width: 8, height: 8, borderRadius: "50%", background: col, boxShadow: `0 0 8px ${col}`, opacity: i ? 0.6 : 1 }} />
      ))}
    </span>
  );
}

function Environment({ scan, env }: { scan: EpScan; env: Env }) {
  const { mobile, contentW } = useV2();
  const wide = !mobile && contentW >= 1000;
  const col = env.sig?.c ?? MUTED;
  return (
    <section aria-label="Market environment" style={{ ...PANEL, padding: mobile ? "16px 16px 14px" : "20px 24px", display: "grid", gridTemplateColumns: wide ? "minmax(0,1fr) minmax(0,1.25fr)" : "minmax(0,1fr)", gap: wide ? 44 : 20, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 500, color: col }}><Dot color={col} glow={8} />{env.line}</span>
        <p style={para}>{scan.narrative.regime}</p>
        {scan.market.notes && <p style={{ ...para, fontSize: 12.5, color: SOFT }}>{scan.market.notes}</p>}
      </div>
      <div role="table" aria-label="Trap 8 conditions" style={{ display: "flex", flexDirection: "column" }}>
        {env.checks.map((c, i) => {
          const [word, sc] = STATE[c.state];
          return (
            <div role="row" key={c.label} style={{ display: "grid", gridTemplateColumns: mobile ? "minmax(0,1fr) auto" : "minmax(0,220px) 124px minmax(80px,1fr) 118px 64px", gap: mobile ? "4px 12px" : 16, alignItems: "center", padding: "10px 0", borderTop: i ? `1px solid ${LINE}` : undefined }}>
              <span role="cell" style={{ fontSize: 13, color: TEXT }}>{c.label}</span>
              <span role="cell" style={{ ...mono, fontSize: 13.5, color: TEXT, textAlign: mobile ? "right" : "left", whiteSpace: "nowrap" }}>{c.reading}</span>
              <span role="cell" style={{ gridColumn: mobile ? "1 / -1" : undefined }}><Meter c={c} /></span>
              <span role="cell" style={{ fontSize: 12, color: MUTED, whiteSpace: "nowrap" }}>{c.rule}</span>
              <span role="cell" style={{ ...cap, color: sc, textAlign: "right" }}>{word}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ── 2. Verdict ── */

function Verdict({ scan }: { scan: EpScan }) {
  const { mobile, accent } = useV2();
  const v = scan.verdict, wl = scan.watchlist, sig = OUTCOME_SIG[v.status];
  const closed = scan.run.mode === "awareness";
  const headline = closed ? "Market closed" : v.status === "PASS" ? `${wl.length || v.strong_count} to watch at the open` : v.status === "PARTIAL" ? "Partial setups only" : "No pivots today";
  const funnel: [number, string][] = [
    [scan.screener.length, "gapped"],
    [scan.screener.filter((r) => r.catalyst.status === "verified").length, "catalyst verified"],
    [scan.candidates.filter((c) => c.criteria).length, "scored"],
    [scan.candidates.filter((c) => c.outcome !== "FAIL").length, "cleared"],
  ];
  return (
    <section aria-label="Verdict" style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 4 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: "10px 32px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "6px 16px" }}>
          <h2 style={{ margin: 0, fontFamily: SERIF, fontWeight: 400, fontSize: mobile ? 32 : 40, lineHeight: 1, color: TEXT }}>{headline}</h2>
          <span style={{ ...cap, fontSize: 11, color: sig.c }}>{v.status}, {v.strong_count} strong</span>
        </div>
        {/* gapped → verified → scored → cleared: where the day's names fell away */}
        <ol aria-label="Screening funnel" style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "4px 14px", margin: 0, padding: 0, listStyle: "none" }}>
          {funnel.map(([n, label], i) => (
            <li key={label} style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
              {i > 0 && <span aria-hidden="true" style={{ color: MUTED, marginRight: 7 }}>›</span>}
              <span style={{ ...mono, fontSize: 20, color: i === funnel.length - 1 ? (n ? SIG.up.c : SIG.down.c) : TEXT }}>{n}</span>
              <span style={{ fontSize: 12.5, color: SOFT }}>{label}</span>
            </li>
          ))}
        </ol>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "6px 16px", paddingTop: 12, borderTop: `1px solid ${RULE}` }}>
        <span style={cap}>Watch list for the open</span>
        {wl.length ? wl.map((tk) => <span key={tk} style={{ ...mono, fontSize: 18, fontWeight: 500, color: accent.hex }}>{tk}</span>) : <span style={{ ...mono, fontSize: 15, color: MUTED }}>None</span>}
        <span style={{ fontSize: 12.5, color: wl.length ? SIG.mid.c : MUTED }}>{wl.length ? KILL_SIGNAL : "Each name on the board shows what ruled it out."}</span>
      </div>
    </section>
  );
}

/* ── 3. Board ── */

interface Row { ticker: string; s?: EpScreenerRow; c?: EpCandidate; gap: number; vol: number; price: number }

/** One criterion's score as a cell: fill = share of its points earned, number = points */
function Cell({ x, w }: { x: NonNullable<EpCandidate["criteria"]>[number] | undefined; w: number }) {
  const max = x ? CRIT_MAX[x.id] : null;
  const base: CSSProperties = { ...mono, width: w, height: 26, borderRadius: 4, display: "grid", placeItems: "center", fontSize: 12 };
  if (!x) return <span style={{ ...base, border: `1px solid ${LINE}` }} />;
  const title = `${CRIT_NAME[x.id]}: ${STATUS_WORD[x.status]}${max ? `, ${pts(x.score)} of ${max}` : ""}`;
  if (x.status === "tbd") return <span title={title} style={{ ...base, border: `1px dashed rgba(89,216,255,.5)`, color: SIG.blue.c, fontSize: 9.5, letterSpacing: ".06em" }}>TBD</span>;
  if (x.status === "unverified") return <span title={title} style={{ ...base, border: `1px dashed rgba(255,194,74,.6)`, color: SIG.mid.c }}>?</span>;
  const f = max ? clamp01((x.score ?? 0) / max) : 0;
  if (!f) return <span title={title} style={{ ...base, background: "rgba(150,190,255,.05)", color: MUTED }}>0</span>;
  const full = f >= 1, rgb = full ? "63,224,166" : "255,194,74";
  return <span title={title} style={{ ...base, background: `rgba(${rgb},${0.14 + 0.2 * f})`, border: `1px solid rgba(${rgb},.55)`, color: full ? "#b8f5de" : "#ffe1a3", fontWeight: 500 }}>{pts(x.score)}</span>;
}

function Board({ scan }: { scan: EpScan }) {
  const { mobile } = useV2();
  const byTicker = new Map(scan.screener.map((r) => [r.ticker, r]));
  const ranked: Row[] = [...scan.candidates].sort((a, b) => a.rank - b.rank).map((c) => ({ ticker: c.ticker, c, s: byTicker.get(c.ticker), gap: c.pm.gap_pct, vol: c.pm.volume, price: c.pm.price }));
  const rest: Row[] = scan.screener.filter((r) => !scan.candidates.some((c) => c.ticker === r.ticker)).sort((a, b) => b.gap_pct - a.gap_pct).map((s) => ({ ticker: s.ticker, s, gap: s.gap_pct, vol: s.pm_volume, price: s.pm_price }));
  const [open, setOpen] = useState<Set<string>>(() => new Set(ranked.filter((r) => r.c!.outcome !== "FAIL").map((r) => r.ticker)));
  const toggle = (tk: string) => setOpen((o) => { const n = new Set(o); n.has(tk) ? n.delete(tk) : n.add(tk); return n; });

  const CW = mobile ? 32 : 44, CG = 4, critW = CRIT.length * CW + (CRIT.length - 1) * CG;
  const cols = `28px 132px 74px 96px 76px minmax(170px,1fr) ${critW}px 70px 82px 16px`;
  const head: CSSProperties = { ...cap, color: MUTED, whiteSpace: "nowrap" };
  const pad = mobile ? "0 12px" : "0 20px";

  const result = (r: Row) => {
    const out = r.c?.outcome;
    return <span style={{ ...cap, fontSize: 10.5, color: out ? OUTCOME_SIG[out].c : MUTED }}>{out ?? "Excluded"}</span>;
  };
  const total = (r: Row) => r.c?.score == null
    ? <span style={{ ...mono, fontSize: 13, color: MUTED }}>n/a</span>
    : <span style={{ ...mono, fontSize: 17, color: OUTCOME_SIG[r.c.outcome].c }}>{pts(r.c.score)}<span style={{ fontSize: 11, color: MUTED }}>/{scan.max_score}</span></span>;
  /** The criteria band: nine score cells, or the reason there are none */
  const band = (r: Row) => {
    const hard = r.c?.traps.find((t) => t.severity === "hard");
    if (r.c?.criteria) return <span style={{ display: "flex", gap: CG }}>{CRIT.map(([id]) => <Cell key={id} w={CW} x={r.c!.criteria!.find((x) => x.id === id)} />)}</span>;
    const txt = hard ? `Trap #${hard.id}: ${TRAPS[hard.id] ?? "hard trap"}. Not scored.` : r.s?.reason || "Excluded at the screen.";
    return <span title={txt} style={{ display: "block", lineHeight: "24px", height: 26, width: critW, maxWidth: "100%", padding: "0 10px", borderRadius: 4, background: hard ? "rgba(255,92,92,.10)" : "rgba(150,190,255,.05)", border: `1px solid ${hard ? "rgba(255,92,92,.4)" : LINE}`, fontSize: 12, color: hard ? "#ffb3b3" : MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{txt}</span>;
  };
  const critHead = <span style={{ display: "flex", gap: CG }}>{CRIT.map(([id, short, name, max]) => <span key={id} title={`${id}: ${name}${max ? `, up to ${max}` : ", confirmed after the open"}`} style={{ ...head, width: CW, textAlign: "center", fontSize: mobile ? 8 : 9, letterSpacing: ".04em" }}>{short}</span>)}</span>;

  const rowEl = (r: Row, i: number, first: boolean) => {
    const isOpen = open.has(r.ticker);
    const cat = r.s?.catalyst;
    const [catWord, catCol] = cat ? CATALYST[cat.status] : ["", MUTED];
    const dim = !r.c;
    const press = { role: "button" as const, tabIndex: 0, "aria-expanded": isOpen, onClick: () => toggle(r.ticker), onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(r.ticker); } } };
    const chev = <span aria-hidden="true" style={{ color: MUTED, fontSize: 14, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .2s", justifySelf: "end" }}>›</span>;
    return (
      <Fragment key={r.ticker}>
        {mobile ? (
          <div {...press} data-click className="v2-row" style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 12px", borderTop: first ? undefined : `1px solid ${LINE}`, cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ ...mono, fontSize: 15, fontWeight: 500, color: dim ? SOFT : TEXT }}>{r.ticker}</span>
              <span style={{ ...mono, fontSize: 12.5, color: SIG.up.c }}>{pct(r.gap, 1)}</span>
              <span style={{ flex: 1 }} />
              {total(r)}{result(r)}{chev}
            </div>
            {r.c?.criteria && critHead}
            {band(r)}
          </div>
        ) : (
          <div {...press} data-click className="v2-row" style={{ display: "grid", gridTemplateColumns: cols, gap: 14, alignItems: "center", minHeight: 50, padding: pad, borderTop: first ? undefined : `1px solid ${LINE}`, cursor: "pointer", transition: "background .2s" }}>
            <span style={{ ...mono, fontSize: 11, color: MUTED }}>{r.c ? String(r.c.rank).padStart(2, "0") : ""}</span>
            <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <span style={{ ...mono, fontSize: 14.5, fontWeight: 500, color: dim ? SOFT : TEXT }}>{r.ticker}{r.s?.e_flag && <span title="Reported earnings in the last 2 days" style={{ marginLeft: 6, fontSize: 10, color: SIG.blue.c }}>E</span>}</span>
              {r.s?.company && <span style={{ fontSize: 11.5, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.s.company}</span>}
            </span>
            <span style={{ ...mono, fontSize: 13, textAlign: "right", color: SIG.up.c }}>{pct(r.gap, 1)}</span>
            <span style={{ ...mono, fontSize: 12.5, textAlign: "right", color: BODY }}>{num(r.vol)}</span>
            <span style={{ ...mono, fontSize: 12.5, textAlign: "right", color: BODY }}>{r.s ? "$" + big(r.s.market_cap) : ""}</span>
            <span style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
              {cat && <span style={{ ...cap, fontSize: 9.5, color: catCol, flexShrink: 0 }}>{catWord}</span>}
              <span style={{ fontSize: 12.5, color: dim ? MUTED : BODY, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cat?.summary ?? r.c?.catalyst}</span>
            </span>
            {band(r)}
            <span style={{ textAlign: "right" }}>{total(r)}</span>
            {result(r)}
            {chev}
          </div>
        )}
        {isOpen && <Detail r={r} i={i} />}
      </Fragment>
    );
  };

  const table = (
    <div style={{ minWidth: mobile ? undefined : 1180 }}>
      {!mobile && (
        <div style={{ display: "grid", gridTemplateColumns: cols, gap: 14, alignItems: "end", padding: mobile ? "10px 12px" : "12px 20px 10px", borderBottom: `1px solid ${RULE}` }}>
          <span style={head}>#</span>
          <span style={head}>Ticker</span>
          <span style={{ ...head, textAlign: "right" }}>Gap</span>
          <span style={{ ...head, textAlign: "right" }}>PM volume</span>
          <span style={{ ...head, textAlign: "right" }}>Mkt cap</span>
          <span style={head}>Catalyst</span>
          {critHead}
          <span style={{ ...head, textAlign: "right" }}>Score</span>
          <span style={head}>Result</span>
          <span />
        </div>
      )}
      {ranked.map((r, i) => rowEl(r, i, i === 0))}
      {rest.length > 0 && (
        <div style={{ padding: mobile ? "9px 12px" : "9px 20px", borderTop: `1px solid ${RULE}`, borderBottom: `1px solid ${LINE}`, background: "rgba(150,190,255,.04)", fontSize: 12, color: SOFT }}>
          Excluded at the screen, not scored ({rest.length})
        </div>
      )}
      {rest.map((r, i) => rowEl(r, ranked.length + i, i === 0))}
      {!ranked.length && !rest.length && <p style={{ ...para, padding: 20 }}>No stock passed the screen on this run.</p>}
    </div>
  );

  return (
    <section aria-label="Board" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: "4px 16px" }}>
        <h2 style={{ margin: 0, fontFamily: SERIF, fontWeight: 400, fontSize: 30, color: TEXT }}>The board</h2>
        <span style={{ fontSize: 12.5, color: MUTED }}>Screen: gap above 4%, pre-market volume above 50k, price above $5 (or $2 to $5 with $1M of pre-market dollar volume), cap under $10B. Select a row for the reasoning.</span>
      </div>
      <div style={{ borderRadius: 12, background: "rgba(4,8,16,.72)", border: "1px solid rgba(150,190,255,.12)", overflow: "hidden" }}>
        {mobile ? table : <HScroll>{table}</HScroll>}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", fontSize: 12, color: MUTED }}>
        <Key swatch={{ background: "rgba(63,224,166,.34)", border: "1px solid rgba(63,224,166,.55)" }}>Full points</Key>
        <Key swatch={{ background: "rgba(255,194,74,.24)", border: "1px solid rgba(255,194,74,.55)" }}>Partial</Key>
        <Key swatch={{ background: "rgba(150,190,255,.05)" }}>0, not met</Key>
        <Key swatch={{ border: "1px dashed rgba(255,194,74,.6)" }}>? unverified, scores 0</Key>
        <Key swatch={{ border: "1px dashed rgba(89,216,255,.5)" }}>TBD, confirmed after the open</Key>
        <span>Neglect scores up to 2, Short up to 1.5, Theme up to 0.5, the rest up to 1. Pass needs 6.3 of {scan.max_score}.</span>
      </div>
      {scan.cross_check && <p style={{ ...para, fontSize: 12.5, color: SOFT, maxWidth: "110ch" }}><span style={{ color: TEXT }}>Screen cross-check. </span>{scan.cross_check}</p>}
    </section>
  );
}

function Key({ swatch, children }: { swatch: CSSProperties; children: ReactNode }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><span aria-hidden="true" style={{ width: 16, height: 12, borderRadius: 3, ...swatch }} />{children}</span>;
}

/** The reasoning behind one row: each criterion's numbers on the left; catalyst, traps and the entry note on the right */
function Detail({ r }: { r: Row; i: number }) {
  const { mobile, contentW } = useV2();
  const two = !mobile && contentW >= 1000;
  const c = r.c, s = r.s;
  const h: CSSProperties = { fontSize: 12, fontWeight: 500, color: TEXT, margin: 0 };
  const txt: CSSProperties = { margin: 0, fontSize: 12.5, lineHeight: 1.55, color: BODY, maxWidth: "75ch" };
  const rel = c?.pm.avg_vol_90d ? c.pm.volume / c.pm.avg_vol_90d : null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: two && c?.criteria ? "minmax(0,1.15fr) minmax(0,1fr)" : "minmax(0,1fr)", gap: two ? 40 : 18, padding: mobile ? "4px 12px 18px" : "6px 20px 22px 62px", background: "rgba(120,170,255,.035)", borderTop: `1px solid ${LINE}` }}>
      {c?.criteria && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {c.criteria.map((x, k) => {
            const max = CRIT_MAX[x.id];
            const colr = x.status === "pass" ? SIG.up.c : x.status === "partial" || x.status === "unverified" ? SIG.mid.c : x.status === "tbd" ? SIG.blue.c : MUTED;
            return (
              <div key={x.id} style={{ display: "grid", gridTemplateColumns: "26px minmax(0,1fr) 52px", gap: "1px 10px", padding: "8px 0", borderTop: k ? `1px solid ${LINE}` : undefined }}>
                <span style={{ ...mono, fontSize: 11, color: MUTED, paddingTop: 1 }}>{x.id}</span>
                <span style={{ fontSize: 12.5, color: TEXT }}>{CRIT_NAME[x.id] ?? x.id}<span style={{ marginLeft: 8, fontSize: 11.5, color: colr }}>{STATUS_WORD[x.status]}</span></span>
                <span style={{ ...mono, fontSize: 12.5, textAlign: "right", color: x.score ? TEXT : MUTED }}>{x.status === "tbd" ? "TBD" : pts(x.score ?? 0)}{max ? <span style={{ color: MUTED }}>/{max}</span> : null}</span>
                <span style={{ gridColumn: "2 / -1", fontSize: 12, lineHeight: 1.5, color: SOFT }}>{x.rationale}</span>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h3 style={h}>Catalyst{s ? <span style={{ marginLeft: 8, fontWeight: 400, color: CATALYST[s.catalyst.status][1] }}>{CATALYST[s.catalyst.status][0]}{s.catalyst.source ? `, ${s.catalyst.source}` : ""}</span> : null}</h3>
          <p style={txt}>{c?.catalyst ?? s?.catalyst.summary}</p>
          {s?.catalyst.status === "unverified" && (
            <p style={{ ...txt, fontSize: 12, color: SOFT }}>{s.catalyst.attempts?.length ?? 0} of 3 required checks on file{s.catalyst.attempts?.length ? ": " + s.catalyst.attempts.join("; ") + "." : "."}</p>
          )}
        </div>
        {c && c.traps.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <h3 style={h}>Traps</h3>
            {c.traps.map((t) => {
              const col = t.severity === "hard" ? SIG.down.c : SIG.mid.c;
              return (
                <p key={t.id} style={{ ...txt, display: "flex", alignItems: "flex-start", gap: 9 }}>
                  <Dot color={col} glow={6} size={5} style={{ marginTop: 7 }} />
                  <span><span style={{ color: col }}>#{t.id} {TRAPS[t.id] ?? "Trap"}, {t.severity === "hard" ? "hard fail" : "cautionary"}.</span> {t.note}</span>
                </p>
              );
            })}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h3 style={h}>{c ? "Read" : "Why it was excluded"}</h3>
          <p style={txt}>{c ? c.note : s?.reason}{c?.lifecycle ? ` Lifecycle: ${c.lifecycle}.` : ""}</p>
          {c && c.outcome !== "FAIL" && <p style={{ ...txt, color: SIG.mid.c }}>{KILL_SIGNAL}</p>}
        </div>
        <p style={{ ...mono, margin: 0, fontSize: 12, color: SOFT }}>
          PM ${num(r.price, 2)}, {pct(r.gap, 1)}, volume {num(r.vol)}{c?.pm.avg_vol_90d != null ? `, 90-day average ${num(c.pm.avg_vol_90d)}${rel != null ? ` (${rel.toFixed(2)}x)` : ""}` : ""}{s?.last_er ? `, last earnings ${s.last_er}` : ""}
        </p>
      </div>
    </div>
  );
}

/* ── Page body ── */

function Scan({ scan, env }: { scan: EpScan; env: Env }) {
  const { mobile, contentW } = useV2();
  const two = !mobile && contentW >= 1000;
  const h: CSSProperties = { margin: 0, fontSize: 13, fontWeight: 500, color: TEXT };
  return (
    <>
      <Environment scan={scan} env={env} />
      <Verdict scan={scan} />
      <Board scan={scan} />

      <section aria-label="Analysis" style={{ display: "grid", gridTemplateColumns: two ? "minmax(0,1.3fr) minmax(0,1fr)" : "minmax(0,1fr)", gap: two ? 48 : 22, paddingTop: 20, borderTop: `1px solid ${RULE}` }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h3 style={h}>Why names qualified or failed</h3>
          <p style={para}>{scan.narrative.analysis}</p>
          {scan.narrative.lifecycle && <p style={{ ...para, fontSize: 12.5, color: SOFT }}>{scan.narrative.lifecycle}</p>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h3 style={h}>Run health</h3>
          {scan.warnings.length ? scan.warnings.map((w, i) => (
            <span key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 12.5, lineHeight: 1.5, color: BODY }}><Dot color={SIG.mid.c} glow={6} size={5} style={{ marginTop: 7 }} />{w}</span>
          )) : (
            <span style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, color: BODY }}><Dot color={SIG.up.c} glow={6} size={5} />All checks passed and no command failed.</span>
          )}
          {scan.run.note && <span style={{ fontSize: 12, lineHeight: 1.5, color: MUTED }}>{scan.run.note}</span>}
          <details style={{ marginTop: 6 }}>
            <summary style={{ fontSize: 12.5, color: SOFT, cursor: "pointer" }}>Sources: {scan.sources.length} commands, run {scan.run.et_time} ET</summary>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
              {scan.sources.map((s, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 1, padding: "7px 0", borderTop: `1px solid ${LINE}`, fontSize: 12, lineHeight: 1.5 }}>
                  <span style={{ ...mono, color: BODY, overflowWrap: "anywhere" }}>{s.command}</span>
                  <span style={{ color: SOFT, overflowWrap: "anywhere" }}>{s.source}{s.fetched_utc ? `, ${s.fetched_utc} UTC` : ""}{s.note ? `, ${s.note}` : ""}</span>
                </div>
              ))}
            </div>
          </details>
        </div>
      </section>
    </>
  );
}
