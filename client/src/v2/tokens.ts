import type { CSSProperties } from "react";
import type { DashboardData } from "@shared/schema";

/* ── Design tokens for the v2 "financial" UI ── */

export const SIG = {
  up: { c: "#3fe0a6", glow: "rgba(63,224,166,.32)" },
  mid: { c: "#ffc24a", glow: "rgba(255,194,74,.32)" },
  down: { c: "#ff5c5c", glow: "rgba(255,92,92,.34)" },
  blue: { c: "#59d8ff", glow: "rgba(89,216,255,.32)" },
} as const;
export type Sig = (typeof SIG)[keyof typeof SIG];

export const SERIF = "'Instrument Serif', Georgia, serif";
export const MONO = "'JetBrains Mono', monospace";
export const SANS = "'Geist', ui-sans-serif, system-ui, sans-serif";

export const EASE = "cubic-bezier(.16,1,.3,1)";

export const PANEL: CSSProperties = {
  borderRadius: 16,
  background: "rgba(6,11,22,.55)",
  border: "1px solid rgba(150,190,255,.12)",
  WebkitBackdropFilter: "blur(16px) saturate(1.3)",
  backdropFilter: "blur(16px) saturate(1.3)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.05)",
};

export const KICKER: CSSProperties = {
  fontFamily: MONO,
  fontSize: 10.5,
  letterSpacing: ".16em",
  textTransform: "uppercase",
};

/* ── Aura / accent colour ── */

const AURA_STOPS: [number, [number, number, number]][] = [
  [0, [255, 59, 79]], [45, [255, 84, 60]], [60, [255, 160, 48]],
  [75, [255, 206, 74]], [80, [63, 224, 166]], [100, [58, 215, 255]],
];

export interface Accent { rgb: [number, number, number]; hex: string; glow: string }

export function auraColor(v: number): Accent {
  const st = AURA_STOPS;
  let i = 0;
  while (i < st.length - 2 && v > st[i + 1][0]) i++;
  const [a0, ca] = st[i], [b0, cb] = st[i + 1];
  const t = Math.max(0, Math.min(1, (v - a0) / (b0 - a0)));
  const c = ca.map((x, k) => Math.round(x + (cb[k] - x) * t)) as [number, number, number];
  return { rgb: c, hex: "#" + c.map((x) => x.toString(16).padStart(2, "0")).join(""), glow: `rgba(${c.join(",")},.5)` };
}

/** Accent clamped by decision so the hue always agrees with the verdict */
export function accentFor(d: DashboardData | undefined): Accent {
  if (!d) return auraColor(60);
  const sc = Math.round(d.marketQualityScore);
  if (d.decision === "NO") return auraColor(Math.min(sc, 40));
  if (d.decision === "CAUTION") return auraColor(Math.max(60, Math.min(75, sc)));
  if (d.decision === "YES") return auraColor(Math.max(80, sc));
  return auraColor(sc);
}

export const regimeSig = (signal?: string) => (signal === "GREEN" ? SIG.up : signal === "RED" ? SIG.down : SIG.mid);

/* ── Formatting ── */

export function pct(v: number | null | undefined, d = 2): string {
  if (v == null || isNaN(v)) return "—";
  return (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(d) + "%";
}

export function num(v: number | string | null | undefined, d = 0): string {
  if (v == null || v === "") return "—";
  if (typeof v !== "number") return String(v);
  return v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function big(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1e12) return (v / 1e12).toFixed(2) + "T";
  if (v >= 1e9) return (v / 1e9).toFixed(1) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(v >= 1e8 ? 0 : 1) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(0) + "K";
  return String(Math.round(v));
}

export function sentence(x: string | null | undefined): string {
  if (!x) return "";
  const t = String(x).toLowerCase().replace(/\bai\b/g, "AI").replace(/\bpcbs\b/g, "PCBs").replace(/\betf\b/g, "ETF");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function ago(ts: string): string {
  const ms = Date.now() - new Date(ts).getTime();
  const h = Math.floor(ms / 3.6e6);
  if (h < 1) {
    const mi = Math.floor(ms / 6e4);
    return mi < 1 ? "just now" : mi + "m ago";
  }
  if (h < 24) return h + "h ago";
  return Math.floor(h / 24) + "d ago";
}

export function fmtDate(ts: string): string {
  return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** RS histogram mini-bars around 1.0 → two SVG path strings (viewBox 0 0 132 32) */
export function spark(hist: number[] | undefined): { posD: string; negD: string } {
  if (!hist || hist.length < 2) return { posD: "", negD: "" };
  const n = hist.length, W = 132, mid = 16, bw = W / n, w = Math.max(0.8, bw * 0.62);
  const m = Math.max(0.004, ...hist.map((v) => Math.abs(v - 1)));
  let p = "", q = "";
  hist.forEach((v, i) => {
    const hh = Math.max(0.6, (Math.abs(v - 1) / m) * 15);
    const x = (i * bw + (bw - w) / 2).toFixed(2);
    if (v >= 1) p += `M${x} ${(mid - hh).toFixed(2)}h${w.toFixed(2)}v${hh.toFixed(2)}h-${w.toFixed(2)}Z`;
    else q += `M${x} ${mid}h${w.toFixed(2)}v${hh.toFixed(2)}h-${w.toFixed(2)}Z`;
  });
  return { posD: p, negD: q };
}

/** Where today's RS sits within the window's range, 0–100 */
export function rsPulse(h: number[] | undefined): number | null {
  if (!h || h.length < 3) return null;
  const lo = Math.min(...h), hi = Math.max(...h);
  if (hi === lo) return 50;
  return ((h[h.length - 1] - lo) / (hi - lo)) * 100;
}

/** Stock RS percentile colour */
export const rsPctSig = (p: number): Sig | null => (p >= 90 ? SIG.up : p >= 70 ? SIG.mid : p < 40 ? SIG.down : null);

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function lsGet(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}
export function lsSet(k: string, v: string) {
  try { localStorage.setItem(k, v); } catch { /* storage blocked */ }
}
