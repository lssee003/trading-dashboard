import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { DashboardData } from "@shared/schema";
import { AuraRing } from "./AuraRing";
import { V2Context, Spinner, TAPE_H, type V2Ctx } from "./ui";
import { SIG, MONO, SERIF, EASE, accentFor, ago, fmtDate, lsGet, lsSet } from "./tokens";
import MonitorV2, { Tape } from "./MonitorV2";
import RelativeStrengthV2 from "./RelativeStrengthV2";
import StockRSV2 from "./StockRSV2";
import BreadthV2 from "./BreadthV2";
import AIStackV2 from "./AIStackV2";
import "./v2.css";

export type V2Page = "monitor" | "rs" | "stocks" | "breadth" | "stack";

export const NAV: [V2Page, string][] = [["monitor", "Monitor"], ["rs", "Sectors"], ["stocks", "Stocks"], ["breadth", "Breadth"], ["stack", "AI stack"]];

/** Classic-UI hash route for each v2 page (Stock RS lives inside the classic RS page) */
export const CLASSIC_ROUTE: Record<V2Page, string> = { monitor: "/", rs: "/relative-strength", stocks: "/relative-strength", breadth: "/market-breadth", stack: "/ai-stack" };

const PAGES: Record<V2Page, () => JSX.Element | null> = { monitor: MonitorV2, rs: RelativeStrengthV2, stocks: StockRSV2, breadth: BreadthV2, stack: AIStackV2 };

const isPage = (p: string | null): p is V2Page => !!p && NAV.some((n) => n[0] === p);

/**
 * Starting page. The hash is kept in sync with the v2 page, so it wins
 * (it also carries over the route last visited in the classic UI); the saved
 * page only breaks the Relative strength / Stock RS tie, which share a route.
 */
export function initialPage(): V2Page {
  const saved = lsGet("5ss-page");
  const hash = window.location.hash.replace(/^#/, "") || "/";
  if (isPage(saved) && CLASSIC_ROUTE[saved] === hash) return saved;
  return NAV.find(([p]) => CLASSIC_ROUTE[p] === hash)?.[0] ?? "monitor";
}

type Phase = "pre" | "out" | "in";

const PHASE: Record<Phase, CSSProperties> = {
  out: { opacity: 0, transform: "scale(0.985)", filter: "blur(10px)", transition: "opacity .3s ease, transform .3s ease, filter .3s ease" },
  pre: { opacity: 0, transform: "scale(1.02)", filter: "blur(16px)", transition: "none" },
  in: { opacity: 1, transform: "none", filter: "none", transition: `opacity 1s ease, transform 1s ${EASE}, filter 1s ease` },
};

/**
 * Laptop displays (screen narrower than an external 1080p+ monitor) render the
 * whole dashboard at 90% so it fills them the way it fills the big screen.
 * Keyed off the display, not the window, so a narrow window on a monitor stays 100%.
 */
const LAPTOP_MAX_SCREEN_W = 1800;
const LAPTOP_ZOOM = 0.9;
const zoomFor = () => (window.screen.width < LAPTOP_MAX_SCREEN_W && window.innerWidth >= 820 ? LAPTOP_ZOOM : 1);

export function V2App({ onPageChange }: { onPageChange?: (p: V2Page) => void }) {
  const qc = useQueryClient();
  const { data: dash, isError } = useQuery<DashboardData>({ queryKey: ["/api/dashboard"] });

  const rootRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const gaugeRef = useRef<HTMLDivElement>(null);
  const navRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const [zoom, setZoom] = useState(zoomFor);
  const [size, setSize] = useState(() => ({ w: window.innerWidth / zoomFor(), h: window.innerHeight / zoomFor() }));
  const [page, setPage] = useState<V2Page>(initialPage);
  const [navTarget, setNavTarget] = useState<V2Page | null>(null);
  const [phase, setPhase] = useState<Phase>("pre");
  const [pulse, setPulse] = useState(1);
  const [menu, setMenu] = useState(false);
  const [navInd, setNavInd] = useState<{ l: number; w: number } | null>(null);

  const mobile = size.w < 820;
  const contentW = mobile ? size.w - 32 : size.w - 56;
  const accent = accentFor(dash);

  // ── Size tracking ──
  useEffect(() => {
    const on = () => {
      setZoom(zoomFor());
      const el = rootRef.current;
      const w = el ? el.offsetWidth : window.innerWidth, h = el ? el.offsetHeight : window.innerHeight;
      setSize((s) => (w && h && (w !== s.w || h !== s.h) ? { w, h } : s));
    };
    on();
    window.addEventListener("resize", on);
    const ro = typeof ResizeObserver !== "undefined" && rootRef.current ? new ResizeObserver(on) : null;
    if (ro && rootRef.current) ro.observe(rootRef.current);
    return () => { window.removeEventListener("resize", on); ro?.disconnect(); };
  }, []);

  // ── First reveal ──
  useEffect(() => {
    let r2 = 0;
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setPhase("in")); });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, []);

  useEffect(() => { onPageChange?.(page); }, [page, onPageChange]);

  // ── Sliding nav indicator — measured from the active (or target) button ──
  const measureNav = useCallback(() => {
    const i = NAV.findIndex((n) => n[0] === (navTarget || page));
    const el = navRefs.current[i];
    if (!el) return;
    const l = el.offsetLeft, w = el.offsetWidth;
    setNavInd((c) => (c && c.l === l && c.w === w ? c : { l, w }));
  }, [navTarget, page]);
  useLayoutEffect(measureNav, [measureNav, size.w, mobile]);
  useEffect(() => { document.fonts?.ready.then(measureNav); }, [measureNav]);

  // ── Navigation: fade out → swap → fade in (1s) ──
  const swapT = useRef(0);
  const go = useCallback((p: V2Page) => {
    lsSet("5ss-page", p);
    setMenu(false);
    if (p === page && !navTarget) return;
    window.clearTimeout(swapT.current);
    setNavTarget(p);
    setPhase("out");
    swapT.current = window.setTimeout(() => {
      setPage(p);
      setNavTarget(null);
      setPhase("pre");
      setPulse((x) => x + 1);
      if (mainRef.current) mainRef.current.scrollTop = 0;
      requestAnimationFrame(() => requestAnimationFrame(() => setPhase("in")));
    }, 320);
  }, [page, navTarget]);
  useEffect(() => () => window.clearTimeout(swapT.current), []);

  // ── Reveal-on-scroll: watch for new [data-reveal] nodes inside <main> ──
  useEffect(() => {
    const m = mainRef.current;
    if (!m || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (es) => es.forEach((en) => { if (en.isIntersecting) { (en.target as HTMLElement).style.setProperty("--rv", "1"); io.unobserve(en.target); } }),
      { root: m, rootMargin: "0px 0px -4% 0px", threshold: 0.01 },
    );
    let raf = 0;
    const scan = () => {
      raf = 0;
      const mb = m.getBoundingClientRect().bottom;
      m.querySelectorAll<HTMLElement>("[data-reveal]:not([data-rv])").forEach((el) => {
        el.setAttribute("data-rv", "1");
        if (el.getBoundingClientRect().top < mb) el.style.setProperty("--rv", "1");
        else { el.style.setProperty("--rv", "0"); io.observe(el); }
      });
    };
    scan();
    const mo = new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(scan); });
    mo.observe(m, { childList: true, subtree: true });
    return () => { mo.disconnect(); io.disconnect(); cancelAnimationFrame(raf); };
  }, []);

  const refresh = () => { qc.invalidateQueries(); };

  const ctx: V2Ctx = useMemo(() => ({ accent, mobile, contentW, h: size.h, mainRef, gaugeRef, pulse }), [accent.hex, mobile, contentW, size.h, pulse]); // eslint-disable-line react-hooks/exhaustive-deps

  const Page = PAGES[page];
  const needsDash = page === "monitor";
  const pageLabel = NAV.find((n) => n[0] === page)?.[1];
  const updatedLabel = dash ? "Live snapshot · " + ago(dash.lastUpdated) : isError ? "Feed unreachable" : "Connecting";
  const dataStamp = dash ? `Live snapshot · ${fmtDate(dash.lastUpdated)}` : "Connecting to data…";
  const statusColor = dash ? SIG.up.c : SIG.mid.c;

  return (
    <V2Context.Provider value={ctx}>
      <div ref={rootRef} className="v2-root" style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#05070c", zoom }}>
        <div style={{ position: "absolute", inset: 0, display: "flex" }}>
          <div style={{ flex: 1, minWidth: 0, position: "relative", background: "#02050b", overflow: "hidden" }}>
            <AuraRing rgb={accent.rgb} anchor={page === "monitor" && dash ? gaugeRef : null} phase={phase} pulse={pulse} dim={page === "monitor" ? 1 : 0.55} />
            <main ref={mainRef} className="v2-scroll" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: page === "monitor" ? `calc(${TAPE_H}px + env(safe-area-inset-bottom, 0px))` : 0, overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain" }}>
              <header style={{ position: "sticky", top: 0, zIndex: 20, height: 76, display: "grid", gridTemplateColumns: mobile ? "minmax(0,1fr) auto" : "minmax(0,1fr) auto minmax(0,1fr)", alignItems: "center", gap: 16, padding: mobile ? "0 16px" : "0 28px", background: "linear-gradient(180deg, rgba(2,5,11,.92) 30%, rgba(2,5,11,0))" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                  <Logo onClick={() => go("monitor")} />
                  {mobile && <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#7f8ea3", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>/ {pageLabel}</span>}
                </div>
                {!mobile ? (
                  <>
                    <nav aria-label="Pages" style={{ position: "relative", display: "flex", alignItems: "center", gap: 2, padding: 5, borderRadius: 999, background: "rgba(8,14,26,.62)", border: "1px solid rgba(150,190,255,.14)", WebkitBackdropFilter: "blur(14px)", backdropFilter: "blur(14px)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.05)" }}>
                      <span aria-hidden="true" style={{ position: "absolute", top: 5, height: 32, left: navInd ? navInd.l : 5, width: navInd ? navInd.w : 0, opacity: navInd ? 1 : 0, borderRadius: 16, background: "rgba(150,190,255,.10)", border: "1px solid rgba(150,190,255,.18)", WebkitBackdropFilter: "blur(16px) saturate(1.3)", backdropFilter: "blur(16px) saturate(1.3)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.08)", transition: `left .55s ${EASE}, width .55s ${EASE}, opacity .3s`, pointerEvents: "none" }} />
                      {NAV.map(([id, label], i) => {
                        const on = (navTarget || page) === id;
                        return (
                          <button key={id} ref={(el) => (navRefs.current[i] = el)} onClick={() => go(id)} aria-current={on ? "page" : undefined} className="v2-hw"
                            style={{ position: "relative", display: "flex", alignItems: "center", gap: 7, height: 32, padding: "0 14px", borderRadius: 16, border: 0, background: "transparent", color: on ? "#ffffff" : "#8c9bb0", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap", transition: "color .35s" }}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: accent.hex, boxShadow: `0 0 8px ${accent.hex}`, opacity: on ? 1 : 0, transform: `scale(${on ? 1 : 0})`, transition: "opacity .4s, transform .5s cubic-bezier(.34,1.56,.64,1)" }} />
                            {label}
                          </button>
                        );
                      })}
                    </nav>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 18, minWidth: 0, overflow: "hidden" }}>
                      {contentW >= 1100 && (
                        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", fontFamily: MONO, fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#8c9bb0", whiteSpace: "nowrap" }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor, boxShadow: `0 0 10px ${statusColor}`, animation: "v2-blink 2.4s ease-in-out infinite", flexShrink: 0 }} />
                          {updatedLabel}
                        </span>
                      )}
                      <button onClick={refresh} style={{ display: "flex", alignItems: "center", gap: 8, height: 34, padding: "0 16px", borderRadius: 17, border: 0, background: "#eef4ff", color: "#04070d", fontSize: 13, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}>
                        Refresh <span style={{ fontSize: 9 }}>▶</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <button onClick={() => setMenu(true)} style={{ justifySelf: "end", height: 40, padding: "0 18px", borderRadius: 20, border: "1px solid rgba(150,190,255,.16)", background: "rgba(8,14,26,.7)", color: "#e8eef6", fontSize: 14, cursor: "pointer" }}>Menu</button>
                )}
              </header>

              {/* Off the Monitor, pages scroll under the frosted tape, so leave room for it at the end */}
              <div style={{ padding: mobile ? "4px 16px 56px" : `0 28px ${page === "monitor" ? 10 : 24}px`, paddingBottom: page === "monitor" ? undefined : `calc(${mobile ? 56 : 24}px + ${TAPE_H}px + env(safe-area-inset-bottom, 0px))`, position: "relative" }}>
                <div style={PHASE[phase]}>
                  {needsDash && !dash ? (
                    <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, fontFamily: MONO, fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "#8c9bb0" }}>
                      <Spinner />
                      <span>{isError ? "Data feed unreachable" : "Reading the tape"}</span>
                    </div>
                  ) : (
                    <Page />
                  )}
                  {dash && page !== "monitor" && (
                    <div style={{ marginTop: 80, paddingTop: 20, borderTop: "1px solid rgba(150,190,255,.09)", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, fontFamily: MONO, fontSize: 10.5, letterSpacing: ".08em", color: "#7f8ea3" }}>
                      <span>{dash.dataSource} · For informational purposes only · Not financial advice</span>
                      <span>{dataStamp}</span>
                    </div>
                  )}
                </div>
              </div>
            </main>

            {/* Ticker tape: pinned to the bottom of the screen on every page (see-through on the Monitor) */}
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 25, height: `calc(${TAPE_H}px + env(safe-area-inset-bottom, 0px))`, paddingBottom: "env(safe-area-inset-bottom, 0px)", display: "flex", alignItems: "center", gap: 18, paddingLeft: mobile ? 0 : 28, paddingRight: mobile ? 0 : 28,
              // Monitor: the tape sits straight on the aura, as part of the dashboard; elsewhere it sits on frosted glass (same tint as PANEL)
              background: page === "monitor" ? "rgba(6,11,22,0)" : "rgba(6,11,22,.5)", WebkitBackdropFilter: page === "monitor" ? "none" : "blur(18px) saturate(1.3)", backdropFilter: page === "monitor" ? "none" : "blur(18px) saturate(1.3)",
              borderTop: `1px solid rgba(150,190,255,${page === "monitor" ? 0.09 : 0.1})`, transition: "background .5s ease" }}>
              <div style={{ flex: 1, minWidth: 0, overflow: "hidden", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent)", maskImage: "linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent)" }}>
                {dash ? <Tape d={dash} /> : <span style={{ paddingLeft: 16, fontFamily: MONO, fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "#7f8ea3" }}>{isError ? "Data feed unreachable" : "Connecting to the tape…"}</span>}
              </div>
              {!mobile && dash && <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".1em", color: "#7f8ea3", flexShrink: 0, whiteSpace: "nowrap" }}>{dash.dataSource} · NOT FINANCIAL ADVICE</span>}
            </div>
          </div>
        </div>

        {menu && mobile && (
          <div role="dialog" aria-modal="true" aria-label="Pages" style={{ position: "absolute", inset: 0, zIndex: 60, background: "rgba(2,5,11,.94)", WebkitBackdropFilter: "blur(24px)", backdropFilter: "blur(24px)", display: "flex", flexDirection: "column", padding: "20px 24px 32px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
              <Logo onClick={() => go("monitor")} />
              <button onClick={() => setMenu(false)} style={{ height: 40, padding: "0 18px", borderRadius: 20, border: "1px solid rgba(150,190,255,.16)", background: "rgba(8,14,26,.7)", color: "#e8eef6", fontSize: 14, cursor: "pointer" }}>Close</button>
            </div>
            <nav style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, marginTop: 44 }}>
              {NAV.map(([id, label]) => {
                const on = (navTarget || page) === id;
                return (
                  <button key={id} onClick={() => go(id)} aria-current={on ? "page" : undefined} style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 0", background: "none", border: 0, color: on ? "#ffffff" : "#8c9bb0", fontFamily: SERIF, fontStyle: "italic", fontSize: 44, textAlign: "right", cursor: "pointer" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: accent.hex, boxShadow: `0 0 10px ${accent.hex}`, opacity: on ? 1 : 0 }} />
                    {label}
                  </button>
                );
              })}
            </nav>
            <div style={{ flex: 1 }} />
            <p style={{ margin: 0, fontFamily: MONO, fontSize: 10.5, letterSpacing: ".1em", color: "#7f8ea3", textAlign: "right" }}>{dataStamp}</p>
          </div>
        )}
      </div>
    </V2Context.Provider>
  );
}

/** 5stars.setup header logo (mark + wordmark); hover animation lives in v2.css (.fs-logo) */
export function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <a className="fs-logo" href="#/" aria-label="5stars.setup home" onClick={(e) => { e.preventDefault(); onClick?.(); }}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <g className="fs-body">
          <path className="fs-leg l" d="M43 60 L38 88 L29 88" stroke="#eef3fa" strokeWidth="6.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path className="fs-leg r" d="M57 60 L62 88 L71 88" stroke="#eef3fa" strokeWidth="6.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="50" cy="37" r="28" fill="#eef3fa" />
          <g className="fs-iris">
            <circle cx="50" cy="37" r="13" fill="var(--accent)" />
            <circle cx="50" cy="37" r="5.5" fill="#05070c" />
            <circle cx="54" cy="33" r="2.2" fill="#eef3fa" />
          </g>
          <path className="fs-lid" d="M22 37 A28 28 0 0 1 78 37 Z" fill="#05070c" />
        </g>
      </svg>
      <span className="fs-word">5stars<b>.</b>setup</span>
    </a>
  );
}

export function LogoRing({ color, glow, size }: { color: string; glow: string; size: number }) {
  const inner = size === 22 ? 6 : 3.5;
  return (
    <span style={{ position: "relative", display: "block", width: size, height: size, borderRadius: "50%", border: `1.5px solid ${color}`, boxShadow: size === 22 ? `0 0 14px ${glow}, inset 0 0 8px ${glow}` : `0 0 10px ${glow}`, flexShrink: 0 }}>
      <span style={{ position: "absolute", inset: inner, borderRadius: "50%", background: color }} />
    </span>
  );
}
