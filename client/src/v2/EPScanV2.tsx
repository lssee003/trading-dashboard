import { useEffect, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import type { EpCandidate, EpIndex, EpScan } from "@shared/schema";
import { useV2, PageHead, Loading, Dot, HScroll, PIN_CELL } from "./ui";
import { SIG, MONO, SERIF, PANEL, KICKER, num, pct, big, type Sig } from "./tokens";

/** Scoring grid rows — labels live here so every day reads the same; the scan supplies status, score and rationale */
const CRITERIA: Record<string, [string, number | null]> = {
  C1: ["First profit / revenue acceleration", 1],
  C2: ["Guidance raise", 1],
  C3: ["Neglected 6+ months", 2],
  C4: ["Record volume", 1],
  C5: ["Float", 1],
  C6: ["Short % of float", 1.5],
  C7: ["Fund ownership", 1],
  C8: ["Hot theme", 0],
  C9: ["Close near EP-day high", null],
};

const TRAPS: Record<number, string> = {
  1: "Priced-in extension", 2: "Buyout target at deal price", 3: "Midnight leader", 4: "Overreaction gap on weak catalyst",
  5: "Minor beat", 6: "Quiet gap", 7: "Gap-and-fade history", 8: "Bearish market", 9: "Choppy personality",
};

const KILL_SIGNAL = "Kill signal: a close below the pre-market entry price carries a 62% historical reversal rate.";

/** How many recent days get a chip; older days move into the dropdown */
const CHIP_DAYS = 12;

const OUTCOME_SIG: Record<string, Sig> = { PASS: SIG.up, PARTIAL: SIG.mid, FAIL: SIG.down };
const STATUS: Record<string, [string, string]> = {
  pass: ["Met", SIG.up.c], partial: ["Partial", SIG.mid.c], fail: ["Not met", "#7f8ea3"], unverified: ["Unverified", SIG.mid.c], tbd: ["After open", SIG.blue.c],
};
const CATALYST: Record<string, [string, string]> = { verified: ["Verified", SIG.up.c], unverified: ["Unverified", SIG.mid.c], none: ["None", "#7f8ea3"] };

const TEXT = "#eef3fa", BODY = "#c0ccdb", SOFT = "#9fb0c6", MUTED = "#7f8ea3", LINE = "rgba(150,190,255,.09)";
const label: CSSProperties = { ...KICKER, fontSize: 10, color: SOFT };
const para: CSSProperties = { margin: 0, fontSize: 13.5, lineHeight: 1.6, color: BODY, textWrap: "pretty" } as CSSProperties;

const dayOf = (iso: string) => new Date(iso + "T12:00:00Z");
const dayShort = (iso: string) => dayOf(iso).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const dayLong = (iso: string) => dayOf(iso).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const score = (v: number | null | undefined) => (v == null ? "—" : String(+v.toFixed(2)));

export default function EPScanV2() {
  const { data: idx, isError } = useQuery<EpIndex>({ queryKey: ["/api/ep"] });
  const [picked, setPicked] = useState<string | null>(null);
  const days = idx?.scans ?? [];
  const date = picked && days.some((s) => s.date === picked) ? picked : days[0]?.date;
  const { data: scan, isError: scanError } = useQuery<EpScan>({ queryKey: ["/api/ep", date], enabled: !!date });

  if (isError || (idx && !days.length)) return <Empty />;
  if (!idx) return <div style={{ paddingTop: 10 }}><Loading>Reading the scan</Loading></div>;

  return (
    <div data-screen-label="EP scan" style={{ display: "flex", flexDirection: "column", gap: 24, paddingTop: 10 }}>
      {scan && scan.scan_date === date ? <Head scan={scan} /> : <PageHead meta={`Pre-market EP scan · ${date ? dayLong(date) : ""}`} italic="Episodic" after="pivots" />}
      <DayPicker days={days} date={date} onPick={setPicked} />
      {scanError ? (
        <p style={{ ...para, color: SIG.mid.c }}>The scan for {date} could not be loaded.</p>
      ) : !scan || scan.scan_date !== date ? (
        <Loading>Reading the scan</Loading>
      ) : (
        <Scan scan={scan} />
      )}
    </div>
  );
}

function Empty() {
  return (
    <div data-screen-label="EP scan" style={{ display: "flex", flexDirection: "column", gap: 24, paddingTop: 10 }}>
      <PageHead meta="Pre-market EP scan" italic="Episodic" after="pivots" />
      <div style={{ ...PANEL, padding: "22px 24px", maxWidth: 640 }}>
        <p style={para}>No scan has been published yet. The pre-market scan posts here each trading day before the US open.</p>
      </div>
    </div>
  );
}

function Head({ scan }: { scan: EpScan }) {
  const v = scan.verdict, n = scan.watchlist.length;
  const closed = scan.run.mode === "awareness";
  const [before, italic, after] = closed ? ["", "Market", "closed"]
    : v.status === "PASS" ? [String(n || v.strong_count), n === 1 ? "pivot" : "pivots", "to watch"]
    : v.status === "PARTIAL" ? ["", "Partial", "setups only"]
    : ["No", "pivots", "today"];
  const sig = OUTCOME_SIG[v.status];
  return (
    <PageHead meta={`Pre-market EP scan · ${dayLong(scan.scan_date)} · run ${scan.run.et_time} ET`} before={before} italic={italic} after={after}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 10 }}>
        <span style={{ ...KICKER, display: "flex", alignItems: "center", gap: 8, height: 34, padding: "0 14px", borderRadius: 17, background: "rgba(8,14,26,.6)", border: "1px solid rgba(150,190,255,.14)", color: sig.c, flexShrink: 0 }}>
          <Dot color={sig.c} glow={8} />
          {v.status} · {v.strong_count} strong
        </span>
        <p style={{ ...para, flex: "1 1 420px", maxWidth: 860, paddingTop: 6 }}>{v.regime}</p>
      </div>
    </PageHead>
  );
}

/** Recent days as chips (dot = that day's verdict); anything older sits in a dropdown */
function DayPicker({ days, date, onPick }: { days: EpIndex["scans"]; date: string | undefined; onPick: (d: string) => void }) {
  const recent = days.slice(0, CHIP_DAYS), older = days.slice(CHIP_DAYS);
  const olderOn = older.some((s) => s.date === date);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
      <div className="v2-noscroll" role="group" aria-label="Scan date" style={{ display: "flex", alignItems: "center", gap: 2, padding: 4, borderRadius: 999, background: "rgba(8,14,26,.62)", border: "1px solid rgba(150,190,255,.13)", maxWidth: "100%", overflowX: "auto" }}>
        {recent.map((s) => {
          const on = s.date === date;
          return (
            <button key={s.date} onClick={() => onPick(s.date)} aria-pressed={on} title={`${s.verdict} · ${s.watchlist.length ? "watch " + s.watchlist.join(", ") : "no watch list"}`}
              style={{ display: "flex", alignItems: "center", gap: 7, height: 32, padding: "0 13px", borderRadius: 16, border: 0, background: on ? "#eef4ff" : "transparent", color: on ? "#04070d" : "#8c9bb0", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap", transition: "background .35s, color .35s" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: OUTCOME_SIG[s.verdict].c, flexShrink: 0 }} />
              {dayShort(s.date)}
            </button>
          );
        })}
      </div>
      {older.length > 0 && (
        <select aria-label="Older scans" value={olderOn ? date : ""} onChange={(e) => e.target.value && onPick(e.target.value)}
          style={{ height: 40, padding: "0 14px", borderRadius: 20, background: "rgba(8,14,26,.62)", border: "1px solid rgba(150,190,255,.13)", color: olderOn ? TEXT : "#8c9bb0", fontFamily: "inherit", fontSize: 13, cursor: "pointer" }}>
          <option value="">Older scans ({older.length})</option>
          {older.map((s) => <option key={s.date} value={s.date}>{dayShort(s.date)} {dayOf(s.date).getUTCFullYear()} · {s.verdict}</option>)}
        </select>
      )}
      <span style={{ ...KICKER, fontSize: 10, color: MUTED }}>{days.length} {days.length === 1 ? "day" : "days"} on file</span>
    </div>
  );
}

function Scan({ scan }: { scan: EpScan }) {
  const { mobile, contentW, accent } = useV2();
  const m = scan.market;
  const dir = (v: number | null) => (v == null ? TEXT : v >= 0 ? SIG.up.c : SIG.down.c);
  const stats = [
    { label: "VIX", value: m.vix != null ? m.vix.toFixed(2) : "—", color: m.vix == null ? TEXT : m.vix > 25 ? SIG.down.c : m.vix > 20 ? SIG.mid.c : SIG.up.c, sub: "Trap #8 fires above 25" },
    { label: "S&P vs 50-day", value: pct(m.spx_vs_sma50_pct, 1), color: dir(m.spx_vs_sma50_pct), sub: m.spx != null ? "S&P 500 at " + num(m.spx, 2) : "S&P 500" },
    { label: "S&P vs 200-day", value: pct(m.spx_vs_sma200_pct, 1), color: dir(m.spx_vs_sma200_pct), sub: "Long-term trend" },
    { label: "S&P year to date", value: pct(m.spx_ytd_pct, 1), color: dir(m.spx_ytd_pct), sub: "Trap #8 fires below −3%" },
    { label: "Market trap", value: m.trap8 ? "Fires" : "Clear", color: m.trap8 ? SIG.down.c : SIG.up.c, sub: m.trap8 ? "Every candidate drops a tier" : "Trap #8, bearish market" },
    { label: "Gappers screened", value: String(scan.screener.length), color: TEXT, sub: `${scan.candidates.length} ranked below` },
  ];
  const ranked = [...scan.candidates].sort((a, b) => a.rank - b.rank);
  const company = (tk: string) => scan.screener.find((r) => r.ticker === tk)?.company;
  const wl = scan.watchlist;
  const twoCol = !mobile && contentW >= 900;
  const cols = "84px 84px 104px 84px 92px 104px minmax(280px,1.2fr) minmax(280px,1fr)";
  const head: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "#86868b", whiteSpace: "nowrap" };
  const cell: CSSProperties = { fontFamily: MONO, fontSize: 12.5, fontVariantNumeric: "tabular-nums", color: BODY };

  return (
    <>
      {/* Watch list — the answer first */}
      <div style={{ ...PANEL, padding: "18px 22px 20px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 28px" }}>
        <span style={label}>Watch list for the open</span>
        {wl.length ? (
          <span style={{ display: "flex", flexWrap: "wrap", gap: "4px 22px" }}>
            {wl.map((tk) => <span key={tk} style={{ fontFamily: SERIF, fontSize: 40, lineHeight: 1, color: accent.hex }}>{tk}</span>)}
          </span>
        ) : (
          <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 30, lineHeight: 1, color: MUTED }}>None</span>
        )}
        <span style={{ flex: "1 1 280px", fontSize: 12.5, lineHeight: 1.5, color: MUTED }}>{wl.length ? KILL_SIGNAL : "Nothing cleared the bar today. Names below are listed with the reason each one failed."}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: mobile ? "repeat(2, minmax(0,1fr))" : "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        {stats.map((x) => (
          <div key={x.label} style={{ ...PANEL, boxShadow: undefined, padding: "16px 18px 18px", display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
            <span style={label}>{x.label}</span>
            <span style={{ fontFamily: SERIF, fontSize: mobile ? 38 : 48, lineHeight: 1, color: x.color, fontVariantNumeric: "tabular-nums" }}>{x.value}</span>
            <span style={{ fontSize: 12, color: MUTED }}>{x.sub}</span>
          </div>
        ))}
      </div>
      {m.notes && <p style={{ ...para, fontSize: 12.5, color: SOFT, marginTop: -10 }}>{m.notes}</p>}

      {/* Ranked names: each with its score grid, or the hard trap that ended scoring */}
      <Section title="Ranked" italic="names" note={`${ranked.length} of ${scan.screener.length} gappers · max score ${scan.max_score}`}>
        {ranked.length ? (
          <div style={{ display: "grid", gridTemplateColumns: twoCol ? "repeat(2, minmax(0,1fr))" : "minmax(0,1fr)", gap: 12, alignItems: "start" }}>
            {ranked.map((c) => <Candidate key={c.ticker} c={c} company={company(c.ticker)} max={scan.max_score} />)}
          </div>
        ) : (
          <p style={para}>No name was ranked on this run.</p>
        )}
      </Section>

      {/* Every gapper, with its final-sweep sentence */}
      <Section title="The" italic="screen" note="Gap above 4% · pre-market volume above 50k · price above $5 · cap under $10B">
        <div style={{ borderRadius: 16, background: "rgba(4,8,16,.72)", border: "1px solid rgba(150,190,255,.12)", overflow: "hidden" }}>
          <HScroll>
            <div style={{ minWidth: 1180 }}>
              <div style={{ display: "grid", gridTemplateColumns: cols, gap: 14, alignItems: "center", padding: mobile ? "9px 12px" : "12px 20px", borderBottom: "1px solid rgba(150,190,255,.10)" }}>
                <span style={{ ...head, ...PIN_CELL }}>Ticker</span>
                <span style={{ ...head, textAlign: "right" }}>Gap</span>
                <span style={{ ...head, textAlign: "right" }}>PM volume</span>
                <span style={{ ...head, textAlign: "right" }}>PM price</span>
                <span style={{ ...head, textAlign: "right" }}>Mkt cap</span>
                <span style={head}>Last earnings</span>
                <span style={head}>Catalyst</span>
                <span style={head}>Final sweep</span>
              </div>
              {scan.screener.map((r) => {
                const [catLabel, catColor] = CATALYST[r.catalyst.status];
                return (
                  <div key={r.ticker} className="v2-row" style={{ display: "grid", gridTemplateColumns: cols, gap: 14, alignItems: "start", padding: mobile ? "10px 12px" : "13px 20px", borderTop: `1px solid ${LINE}`, transition: "background .2s" }}>
                    <span style={{ ...PIN_CELL, alignItems: "flex-start", flexDirection: "column", gap: 3 }}>
                      <span style={{ fontFamily: MONO, fontSize: 13.5, color: TEXT }}>{r.ticker}{r.e_flag && <span title="Reported earnings in the last 2 days" style={{ marginLeft: 6, color: SIG.blue.c, fontSize: 10 }}>E</span>}</span>
                      <span style={{ ...KICKER, fontSize: 9, color: r.disposition === "ranked" ? SOFT : MUTED }}>{r.disposition === "ranked" ? "Ranked" : "Excluded"}</span>
                    </span>
                    <span style={{ ...cell, textAlign: "right", color: SIG.up.c }}>{pct(r.gap_pct, 1)}</span>
                    <span style={{ ...cell, textAlign: "right" }}>{num(r.pm_volume)}</span>
                    <span style={{ ...cell, textAlign: "right" }}>${num(r.pm_price, 2)}</span>
                    <span style={{ ...cell, textAlign: "right" }}>${big(r.market_cap)}</span>
                    <span style={cell}>{r.last_er || "—"}</span>
                    <span style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                      <span style={{ ...KICKER, fontSize: 9.5, display: "flex", alignItems: "center", gap: 6, color: catColor }}><Dot color={catColor} size={5} glow={6} />{catLabel}{r.catalyst.source ? <span style={{ color: MUTED, letterSpacing: ".04em", textTransform: "none" }}>· {r.catalyst.source}</span> : null}</span>
                      <span style={{ fontSize: 12.5, lineHeight: 1.5, color: BODY }}>{r.catalyst.summary}</span>
                      {r.catalyst.status === "unverified" && (
                        <span style={{ fontSize: 11.5, lineHeight: 1.5, color: MUTED }}>
                          {(r.catalyst.attempts?.length ?? 0)} of 3 checks on file{r.catalyst.attempts?.length ? ": " + r.catalyst.attempts.join("; ") : ""}
                        </span>
                      )}
                    </span>
                    <span style={{ fontSize: 12.5, lineHeight: 1.5, color: SOFT }}>{r.reason}</span>
                  </div>
                );
              })}
            </div>
          </HScroll>
        </div>
        {scan.cross_check && <p style={{ ...para, fontSize: 12.5, color: SOFT }}><span style={{ ...label, marginRight: 8 }}>Cross-check</span>{scan.cross_check}</p>}
      </Section>

      {/* Narrative */}
      <div style={{ borderRadius: 16, padding: "20px 22px", background: "rgba(4,8,16,.7)", border: "1px solid rgba(150,190,255,.12)", display: "grid", gridTemplateColumns: twoCol ? "repeat(2, minmax(0,1fr))" : "minmax(0,1fr)", gap: "22px 36px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ ...label, paddingBottom: 6, borderBottom: `1px solid ${LINE}` }}>Regime</div>
          <p style={para}>{scan.narrative.regime}</p>
          {scan.narrative.lifecycle && (
            <>
              <div style={{ ...label, paddingBottom: 6, marginTop: 10, borderBottom: `1px solid ${LINE}` }}>Lifecycle</div>
              <p style={para}>{scan.narrative.lifecycle}</p>
            </>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ ...label, paddingBottom: 6, borderBottom: `1px solid ${LINE}` }}>Why names qualify or fail</div>
          <p style={para}>{scan.narrative.analysis}</p>
        </div>
      </div>

      {/* Run health + sources */}
      <div style={{ display: "grid", gridTemplateColumns: twoCol ? "minmax(0,1fr) minmax(0,1.3fr)" : "minmax(0,1fr)", gap: 12, alignItems: "start" }}>
        <div style={{ ...PANEL, padding: "16px 20px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={label}>Run health</span>
          {scan.warnings.length ? scan.warnings.map((w, i) => (
            <span key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 12.5, lineHeight: 1.5, color: BODY }}><Dot color={SIG.mid.c} glow={8} style={{ marginTop: 6 }} />{w}</span>
          )) : (
            <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: BODY }}><Dot color={SIG.up.c} glow={8} />All checks passed; no command failed.</span>
          )}
          {scan.run.note && <span style={{ fontSize: 12, lineHeight: 1.5, color: MUTED }}>{scan.run.note}</span>}
        </div>
        <details style={{ ...PANEL, padding: "16px 20px 18px" }}>
          <summary style={{ ...label, cursor: "pointer" }}>Sources · {scan.sources.length} commands · run {scan.run.et_time} ET</summary>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 10 }}>
            {scan.sources.map((s, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: mobile ? "minmax(0,1fr)" : "minmax(0,1fr) minmax(0,1.4fr)", gap: "2px 16px", padding: "8px 0", borderTop: `1px solid ${LINE}`, fontSize: 12, lineHeight: 1.5 }}>
                <span style={{ fontFamily: MONO, color: BODY, overflowWrap: "anywhere" }}>{s.command}</span>
                <span style={{ color: SOFT, overflowWrap: "anywhere" }}>{s.source}{s.fetched_utc ? ` · ${s.fetched_utc} UTC` : ""}{s.note ? ` · ${s.note}` : ""}</span>
              </div>
            ))}
          </div>
        </details>
      </div>
    </>
  );
}

function Section({ title, italic, note, children }: { title: string; italic: string; note: string; children: React.ReactNode }) {
  const { accent } = useV2();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: "4px 12px" }}>
        <span style={{ fontFamily: SERIF, fontSize: 30, color: TEXT }}>{title} <span style={{ fontStyle: "italic", color: accent.hex }}>{italic}</span></span>
        <span style={{ ...KICKER, fontSize: 10, color: MUTED }}>{note}</span>
      </div>
      {children}
    </div>
  );
}

function Candidate({ c, company, max }: { c: EpCandidate; company: string | undefined; max: number }) {
  const { mobile } = useV2();
  const sig = OUTCOME_SIG[c.outcome];
  // Names that didn't fail open with their grid showing; failed names keep it one click away
  const [open, setOpen] = useState(c.outcome !== "FAIL");
  useEffect(() => setOpen(c.outcome !== "FAIL"), [c.ticker, c.outcome]);
  const chip: CSSProperties = { ...KICKER, fontSize: 10, display: "inline-flex", alignItems: "center", gap: 6, height: 26, padding: "0 10px", borderRadius: 13, background: "rgba(8,14,26,.6)", border: "1px solid rgba(150,190,255,.14)", whiteSpace: "nowrap" };
  const rel = c.pm.avg_vol_90d ? c.pm.volume / c.pm.avg_vol_90d : null;

  return (
    <div style={{ ...PANEL, padding: mobile ? "16px 16px 14px" : "18px 22px 16px", display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "8px 16px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, minWidth: 0 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>{String(c.rank).padStart(2, "0")}</span>
          <span style={{ fontFamily: SERIF, fontSize: 42, lineHeight: 0.95, color: TEXT }}>{c.ticker}</span>
          {company && <span style={{ fontSize: 12.5, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{company}</span>}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
          <span style={{ ...chip, color: sig.c }}><Dot color={sig.c} size={5} glow={6} />{c.outcome}</span>
          <span style={{ ...chip, color: "#dfe7f2" }}>{c.strength}</span>
        </div>
      </div>

      {/* Score */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ fontFamily: SERIF, fontSize: 30, lineHeight: 1, color: c.score == null ? MUTED : sig.c, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
          {c.score == null ? "Not scored" : <>{score(c.score)}<span style={{ fontSize: 16, color: MUTED }}> / {max}</span></>}
        </span>
        <span style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(150,190,255,.10)", overflow: "hidden" }}>
          <span style={{ display: "block", height: "100%", width: `${Math.min(100, ((c.score ?? 0) / max) * 100)}%`, borderRadius: 2, background: sig.c, boxShadow: `0 0 8px ${sig.c}` }} />
        </span>
      </div>

      <p style={para}>{c.catalyst}</p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 18px", fontFamily: MONO, fontSize: 12, color: SOFT, fontVariantNumeric: "tabular-nums" }}>
        <span>PM <span style={{ color: TEXT }}>${num(c.pm.price, 2)}</span></span>
        <span>Gap <span style={{ color: SIG.up.c }}>{pct(c.pm.gap_pct, 1)}</span></span>
        <span>Vol <span style={{ color: TEXT }}>{num(c.pm.volume)}</span></span>
        {c.pm.avg_vol_90d != null && <span>90d avg <span style={{ color: TEXT }}>{num(c.pm.avg_vol_90d)}</span>{rel != null && <span style={{ color: MUTED }}> ({rel.toFixed(2)}x)</span>}</span>}
      </div>

      {c.traps.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {c.traps.map((t) => {
            const col = t.severity === "hard" ? SIG.down.c : SIG.mid.c;
            return (
              <div key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <Dot color={col} glow={8} style={{ marginTop: 6 }} />
                <span style={{ fontSize: 12.5, lineHeight: 1.5, color: SOFT, minWidth: 0 }}>
                  <span style={{ color: col, fontWeight: 500 }}>Trap #{t.id} · {TRAPS[t.id] ?? "Trap"}{t.severity === "hard" ? " (hard fail)" : ""}</span> — {t.note}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <p style={{ ...para, fontSize: 12.5, color: SOFT }}>{c.note}{c.lifecycle ? ` Lifecycle: ${c.lifecycle}.` : ""}</p>
      {c.outcome !== "FAIL" && <p style={{ ...para, fontSize: 12.5, color: SIG.mid.c }}>{KILL_SIGNAL}</p>}

      {c.criteria ? (
        <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 10 }}>
          <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="v2-hw" style={{ ...label, display: "flex", alignItems: "center", gap: 8, padding: 0, border: 0, background: "none", cursor: "pointer" }}>
            <span style={{ display: "inline-block", transform: open ? "rotate(90deg)" : "none", transition: "transform .25s" }}>›</span>
            Score grid · 9 criteria
          </button>
          {open && (
            <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
              {c.criteria.map((x) => {
                const [name, top] = CRITERIA[x.id] ?? [x.id, null];
                const [word, col] = STATUS[x.status];
                return (
                  <div key={x.id} style={{ display: "grid", gridTemplateColumns: mobile ? "30px minmax(0,1fr) 58px" : "30px minmax(0,190px) 92px 58px minmax(0,1fr)", gap: "2px 12px", alignItems: "baseline", padding: "7px 0", borderTop: `1px solid ${LINE}` }}>
                    <span style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>{x.id}</span>
                    <span style={{ fontSize: 12.5, color: TEXT }}>{name}{mobile && <span style={{ marginLeft: 8, fontSize: 11, color: col }}>{word}</span>}</span>
                    {!mobile && <span style={{ ...KICKER, fontSize: 9.5, color: col }}>{word}</span>}
                    <span style={{ fontFamily: MONO, fontSize: 12.5, textAlign: "right", color: x.score ? TEXT : MUTED, fontVariantNumeric: "tabular-nums" }}>{score(x.score)}{top ? <span style={{ color: MUTED }}>/{top}</span> : null}</span>
                    <span style={{ gridColumn: mobile ? "2 / -1" : undefined, fontSize: 12, lineHeight: 1.5, color: SOFT }}>{x.rationale}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <span style={{ ...label, color: MUTED, borderTop: `1px solid ${LINE}`, paddingTop: 10 }}>Scoring stopped at the hard trap</span>
      )}
    </div>
  );
}
