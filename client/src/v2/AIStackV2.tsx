import { useMemo, useState } from "react";
import { AI_STACK_DATA } from "@/data/aiStack";
import { useV2, PageHead, SearchBox, Spark } from "./ui";
import { SIG, MONO, PANEL, sentence, spark, rsPctSig } from "./tokens";
import { useRS } from "./RelativeStrengthV2";
import { useStocks } from "./StockRSV2";

const ALSO_RE = /\s*\(also\s+([^)]+)\)\s*$/i;

export default function AIStackV2() {
  const { mobile } = useV2();
  const { data: rs25 } = useRS(25);
  const { data: stocks } = useStocks();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [all, setAll] = useState(false);

  const etfMap = useMemo(() => new Map((rs25?.tickers ?? []).filter((t) => !t.failed).map((t) => [t.symbol, t])), [rs25]);
  const stMap = useMemo(() => new Map((stocks?.stocks ?? []).map((x) => [x.ticker, x.rsPercentile])), [stocks]);

  const n = AI_STACK_DATA.length;
  const total = AI_STACK_DATA.reduce((a, l) => a + l.companies.length, 0);
  const q = query.trim().toLowerCase();

  // Top of the stack (applications) first, raw materials last
  const layers = [...AI_STACK_DATA].reverse().flatMap((l) => {
    const li = parseInt(String(l.layer).slice(1), 10);
    const layerHit = !q || l.label.toLowerCase().includes(q) || l.sublabel.toLowerCase().includes(q) || (l.etf || "").toLowerCase().includes(q);
    const cos = l.companies.filter((c) => layerHit || c.ticker.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.role.toLowerCase().includes(q));
    if (q && !cos.length) return [];
    return [{ l, li, cos, depth: 1 - li / (n - 1), isOpen: !!(open[l.layer] ?? (q ? true : all)) }];
  });

  return (
    <div data-screen-label="AI stack" style={{ display: "flex", flexDirection: "column", gap: 24, paddingTop: 10 }}>
      <PageHead meta={`${n} layers · ${total} positions · raw materials to applications`} before="The" italic="AI" after="stack">
        <p style={{ margin: "4px 0 0", maxWidth: 600, fontSize: 15, lineHeight: 1.55, color: "#a3b3c8", textWrap: "pretty" } as React.CSSProperties}>
          From the minerals in the ground to the software on top. Each layer carries its closest ETF proxy; each company its stock RS rating.
        </p>
      </PageHead>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <SearchBox value={query} onChange={(v) => { setQuery(v); setOpen({}); }} placeholder="Search ticker, company or role" basis={260} />
        <button className="v2-ghost" onClick={() => { setAll((a) => !a); setOpen({}); }} style={{ height: 42, padding: "0 20px", borderRadius: 21, border: "1px solid rgba(150,190,255,.16)", background: "rgba(8,14,26,.62)", color: "#e8eef6", fontSize: 13.5, cursor: "pointer" }}>
          {all ? "Collapse all" : "Expand all"}
        </button>
      </div>

      <div style={{ ...PANEL, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 47, top: 30, bottom: 30, width: 1, background: "linear-gradient(180deg, rgba(89,216,255,.6), rgba(63,224,166,.5) 35%, rgba(255,194,74,.55) 65%, rgba(255,92,92,.6))" }} />
        {layers.map(({ l, cos, depth, isOpen }) => {
          const t = l.etf ? etfMap.get(l.etf) : undefined;
          const sp = t ? spark(t.histogram) : { posD: "", negD: "" };
          const tone = depth > 0.55 ? "255,92,92" : depth > 0.3 ? "255,194,74" : "89,216,255";
          const toggle = () => setOpen((o) => ({ ...o, [l.layer]: !isOpen }));
          return (
            <div key={l.layer} data-reveal style={{ position: "relative", borderTop: "1px solid rgba(150,190,255,.06)", background: isOpen ? "rgba(120,170,255,.05)" : "transparent", ["--rv-y" as string]: "0px", transition: "background .3s, opacity .8s ease" }}>
              <div role="button" tabIndex={0} aria-expanded={isOpen} data-click onClick={toggle} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}
                style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 18px", minHeight: 68, padding: "10px 20px", cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16, flex: "1 1 260px", minWidth: 0 }}>
                  <span style={{ width: 54, height: 28, borderRadius: 14, flexShrink: 0, display: "grid", placeItems: "center", background: "#050a14", border: `1px solid rgba(${tone},.6)`, boxShadow: `0 0 12px rgba(${tone},.25)`, fontFamily: MONO, fontSize: 11, color: "#eef3fa" }}>{l.layer}</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                    <span style={{ fontSize: 15.5, color: "#eef3fa" }}>{sentence(l.label)}</span>
                    <span style={{ fontSize: 12.5, color: "#8c9bb0", lineHeight: 1.35 }}>{l.sublabel}</span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginLeft: "auto" }}>
                  {l.etf && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, height: 32, padding: "0 13px", borderRadius: 16, border: "1px solid rgba(150,190,255,.12)" }}>
                      <span style={{ fontFamily: MONO, fontSize: 11.5, color: "#eef3fa" }}>{l.etf}</span>
                      <Spark {...sp} style={{ width: 60, height: 18 }} />
                      <span style={{ fontFamily: MONO, fontSize: 11.5, color: t ? (t.rsVsBenchmark >= 1 ? SIG.up.c : SIG.down.c) : "#8b8b90" }}>{t ? t.rsVsBenchmark.toFixed(3) : ""}</span>
                    </div>
                  )}
                  <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: ".06em", color: "#7f8ea3", whiteSpace: "nowrap" }}>{cos.length + (cos.length === 1 ? " company" : " companies")}</span>
                  <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center", border: "1px solid rgba(150,190,255,.16)", color: "#dfe7f2", fontSize: 16, fontWeight: 300, lineHeight: 1, transform: isOpen ? "rotate(45deg)" : "none", transition: "transform .5s cubic-bezier(.16,1,.3,1)" }}>+</span>
                </div>
              </div>
              {isOpen && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))", gap: 8, padding: mobile ? "0 12px 14px" : "0 20px 18px 90px" }}>
                  {cos.map((c) => {
                    const m = c.role.match(ALSO_RE);
                    const also = m ? Array.from(new Set(m[1].split(/[,/\s]+/).map((x) => x.trim().toUpperCase()).filter((x) => /^L\d+$/.test(x)))) : [];
                    const r = stMap.get(c.ticker), g = r != null ? rsPctSig(r) : null;
                    return (
                      <div key={c.ticker + c.name} style={{ borderRadius: 12, padding: "13px 15px", display: "flex", flexDirection: "column", gap: 7, background: "rgba(2,5,11,.55)", border: "1px solid rgba(150,190,255,.09)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontFamily: MONO, fontSize: 13, color: "#eef3fa" }}>{c.ticker === "PRIVATE" ? "Private" : c.ticker}</span>
                          <span style={{ fontSize: 12.5, color: "#9fb0c6", flex: 1, minWidth: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{c.name}</span>
                          {r != null && (
                            <span title="Stock RS percentile" style={{ height: 22, minWidth: 34, padding: "0 8px", borderRadius: 11, display: "grid", placeItems: "center", background: g ? g.glow.replace(/[\d.]+\)$/, ".16)") : "rgba(255,255,255,.07)", color: g ? g.c : "#d6d5d1", fontSize: 11, fontFamily: MONO }}>{r}</span>
                          )}
                        </div>
                        <span style={{ fontSize: 12.5, lineHeight: 1.45, color: "#b8c5d6", textWrap: "pretty" } as React.CSSProperties}>{m ? c.role.replace(m[0], "").trim() : c.role}</span>
                        {also.length > 0 && (
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                            {also.map((code) => <span key={code} style={{ height: 20, padding: "0 8px", borderRadius: 10, display: "grid", placeItems: "center", border: "1px solid rgba(150,190,255,.14)", color: "#9fb0c6", fontSize: 10, fontFamily: MONO }}>ALSO {code}</span>)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {layers.length === 0 && <div style={{ padding: "36px 20px", color: "#8c9bb0", fontSize: 14 }}>Nothing in the stack matches.</div>}
      </div>
    </div>
  );
}
