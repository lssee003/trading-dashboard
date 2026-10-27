import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { RSStock } from "@shared/schema";
import { useV2, TAPE_H } from "./ui";
import { MONO, prefersReducedMotion } from "./tokens";
import { createFlowSwarm } from "./flowSwarm";

/** Desktop content padding in V2App — the stage bleeds through it to the window edges */
const BLEED = 28;

/**
 * Stocks → Flow: mounts the WebGL capital-flow view (flowSwarm.ts) and tears it down on leave.
 * `viewSwitch` (the Stocks / Industries / Flow control) floats in the stage's top-left on wide
 * screens and sits above the stage on narrow ones.
 */
export default function FlowSwarmV2({ stocks, viewSwitch }: { stocks: RSStock[]; viewSwitch?: ReactNode }) {
  const { mobile, contentW, h, mainRef } = useV2();
  const wrap = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  // Distance from the top of the scroll area to the stage, in layout px (the shell may be CSS-zoomed)
  const [top, setTop] = useState(80);
  const narrow = mobile || contentW < 860;

  useLayoutEffect(() => {
    const measure = () => {
      const el = wrap.current, m = mainRef.current;
      if (!el || !m) return;
      const mr = m.getBoundingClientRect(), zf = mr.height / m.offsetHeight || 1;
      setTop(Math.round((el.getBoundingClientRect().top - mr.top) / zf + m.scrollTop));
    };
    measure();
    // Re-measure once fonts and the page reveal (a 1s scale-in) have settled
    document.fonts?.ready.then(measure);
    const t = window.setTimeout(measure, 1100);
    return () => window.clearTimeout(t);
  }, [mainRef, contentW, h, mobile]);

  useEffect(() => {
    if (!host.current) return;
    try {
      const fs = createFlowSwarm(host.current, stocks, prefersReducedMotion());
      return () => fs.dispose();
    } catch {
      setFailed(true);
    }
  }, [stocks]);

  if (failed) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {viewSwitch}
        <div style={{ padding: "40px 0", fontFamily: MONO, fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "#8c9bb0" }}>Flow needs WebGL — turn on hardware acceleration and reload</div>
      </div>
    );
  }
  // Children keep their slots in both layouts so the host element (and the WebGL scene in it) survives a resize.
  // Wide: the stage runs edge to edge from under the app header down to the ticker tape.
  return (
    <div ref={wrap} style={narrow ? { display: "flex", flexDirection: "column", gap: 12 } : { position: "relative", height: Math.max(540, h - top - TAPE_H - 12), margin: `0 -${BLEED}px` }}>
      {narrow && viewSwitch}
      <div ref={host} style={narrow ? undefined : { position: "absolute", inset: 0 }} />
      {!narrow && viewSwitch && <div style={{ position: "absolute", left: BLEED, top: 16, zIndex: 2 }}>{viewSwitch}</div>}
    </div>
  );
}
