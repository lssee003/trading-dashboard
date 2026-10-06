import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DashboardData } from "@shared/schema";
import { accentFor, EASE } from "./tokens";
import { LogoRing } from "./V2App";

/**
 * Pull-tab on the right edge that flips between the new and classic UI.
 * Collapsed only the accent ring peeks out; first click slides it open
 * (auto-collapses after 4.5s), a second click switches UI.
 */
export function UISwitch({ ui, onToggle }: { ui: "new" | "classic"; onToggle: () => void }) {
  const { data } = useQuery<DashboardData>({ queryKey: ["/api/dashboard"] });
  const accent = accentFor(data);
  const [open, setOpen] = useState(false);
  const [peek, setPeek] = useState(false);
  const [mobile, setMobile] = useState(() => window.innerWidth < 820);
  const t = useRef(0);

  useEffect(() => {
    const on = () => setMobile(window.innerWidth < 820);
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("resize", on); window.clearTimeout(t.current); };
  }, []);

  const classic = ui === "classic";
  const label = classic ? "New UI" : "Classic UI";
  const title = classic ? "Switch to the new UI" : "Switch to the classic UI";

  const onClick = () => {
    window.clearTimeout(t.current);
    if (open) { setOpen(false); onToggle(); return; }
    setOpen(true);
    t.current = window.setTimeout(() => setOpen(false), 4500);
  };

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setPeek(true)}
      onMouseLeave={() => setPeek(false)}
      onFocus={() => setPeek(true)}
      onBlur={() => setPeek(false)}
      title={open ? title : "Show UI switch"}
      aria-label={open ? title : "Show UI switch"}
      className="v2-uiswitch"
      style={{
        position: "fixed", right: 0, bottom: classic ? (mobile ? 18 : 34) : `calc(${mobile ? 50 : 48}px + env(safe-area-inset-bottom, 0px))`, zIndex: 100,
        display: "flex", alignItems: "center", gap: 10, height: 38, padding: "0 18px 0 10px",
        borderRadius: "19px 0 0 19px", border: "1px solid rgba(150,190,255,.18)", borderRight: 0,
        background: classic ? "rgba(6,11,22,.88)" : "rgba(6,11,22,.78)",
        WebkitBackdropFilter: "blur(18px) saturate(1.4)", backdropFilter: "blur(18px) saturate(1.4)",
        color: "#eef3fa", fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: ".14em", textTransform: "uppercase",
        whiteSpace: "nowrap", cursor: "pointer",
        boxShadow: open ? "0 0 30px rgba(89,216,255,.22), 0 10px 30px rgba(0,0,0,.45)" : "0 6px 18px rgba(0,0,0,.35)",
        transform: open ? "translateX(0)" : peek ? "translateX(calc(100% - 34px))" : "translateX(calc(100% - 22px))",
        transition: `transform .55s ${EASE}, background .4s, box-shadow .6s`,
      }}
    >
      <LogoRing color={accent.hex} glow={accent.glow} size={16} />
      <span style={{ opacity: open ? 1 : 0, transition: "opacity .35s" }}>{label}</span>
    </button>
  );
}
