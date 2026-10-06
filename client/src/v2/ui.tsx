import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { KICKER, MONO, SERIF, prefersReducedMotion, type Accent } from "./tokens";

/* ── Shell context: layout metrics + accent shared by every page ── */

export interface V2Ctx {
  accent: Accent;
  mobile: boolean;
  /** Content column width (window minus shell + content padding) */
  contentW: number;
  /** Viewport height */
  h: number;
  mainRef: RefObject<HTMLElement>;
  gaugeRef: RefObject<HTMLDivElement>;
  /** Bumps on every page change — drives the score count-up */
  pulse: number;
}

export const V2Context = createContext<V2Ctx | null>(null);
export function useV2() {
  const c = useContext(V2Context);
  if (!c) throw new Error("useV2 outside V2Context");
  return c;
}

/** Height of the ticker tape pinned to the bottom of every page (the phone's safe area is added on top) */
export const TAPE_H = 34;

/* ── Primitives ── */

export function Dot({ color, size = 6, glow = 10, style }: { color: string; size?: number; glow?: number; style?: CSSProperties }) {
  return <span style={{ width: size, height: size, borderRadius: "50%", background: color, boxShadow: `0 0 ${glow}px ${color}`, flexShrink: 0, ...style }} />;
}

export function Spinner({ size = 20 }: { size?: number }) {
  return <div style={{ width: size, height: size, borderRadius: "50%", border: "1.5px solid rgba(150,190,255,.18)", borderTopColor: "#eef4ff", animation: "v2-spin 1s linear infinite" }} />;
}

export function Loading({ children }: { children: ReactNode }) {
  return (
    <div style={{ padding: "60px 0", display: "flex", alignItems: "center", gap: 14, fontFamily: MONO, fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "#8c9bb0" }}>
      <Spinner size={16} />
      {children}
    </div>
  );
}

/** Page header: mono kicker with accent dot + serif H1 whose `italic` word glows in the accent */
export function PageHead({ meta, before, italic, after, children }: { meta: ReactNode; before?: string; italic: string; after?: string; children?: ReactNode }) {
  const { accent } = useV2();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ ...KICKER, display: "flex", alignItems: "center", gap: 10, color: "#9fb0c6" }}>
        <Dot color={accent.hex} />
        {meta}
      </div>
      <h1 style={{ margin: 0, fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(48px, 6vw, 88px)", lineHeight: 0.95 }}>
        {before ? before + " " : ""}
        <span style={{ fontStyle: "italic", color: accent.hex, textShadow: `0 0 40px ${accent.glow}` }}>{italic}</span>
        {after ? " " + after : ""}
      </h1>
      {children}
    </div>
  );
}

export interface SegOpt<T> { value: T; label: string }

/** Pill segmented control — active segment is a solid light pill */
export function Seg<T extends string | number>({ opts, value, onChange, size = "md", padX }: { opts: SegOpt<T>[]; value: T; onChange: (v: T) => void; size?: "md" | "sm"; padX?: number }) {
  const h = size === "sm" ? 30 : 32;
  return (
    <div className="v2-noscroll" style={{ display: "flex", alignItems: "center", gap: 2, padding: 4, borderRadius: 999, background: "rgba(8,14,26,.62)", border: "1px solid rgba(150,190,255,.13)", WebkitBackdropFilter: "blur(12px)", backdropFilter: "blur(12px)", maxWidth: "100%", overflowX: "auto" }}>
      {opts.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            onClick={() => onChange(o.value)}
            aria-pressed={on}
            style={{ height: h, padding: `0 ${padX ?? (size === "sm" ? 12 : 14)}px`, borderRadius: h / 2, border: 0, background: on ? "#eef4ff" : "transparent", color: on ? "#04070d" : "#8c9bb0", fontSize: size === "sm" ? 12.5 : 13, cursor: "pointer", transition: "background .35s, color .35s", whiteSpace: "nowrap" }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Tiny in-row toggle (Burst 5D/10D, Breadth Month/Quarter) */
export function MiniSeg<T extends string>({ opts, value, onChange }: { opts: SegOpt<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <div style={{ display: "flex", gap: 1, padding: 2, borderRadius: 10, background: "rgba(150,190,255,.08)", flexShrink: 0 }}>
      {opts.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} onClick={() => onChange(o.value)} aria-pressed={on} style={{ height: 18, padding: "0 7px", borderRadius: 8, border: 0, background: on ? "#eef4ff" : "transparent", color: on ? "#04070d" : "#8c9bb0", fontFamily: MONO, fontSize: 9.5, cursor: "pointer" }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder, basis = 220 }: { value: string; onChange: (v: string) => void; placeholder: string; basis?: number }) {
  return (
    <label style={{ flex: `1 1 ${basis}px`, height: 42, display: "flex", alignItems: "center", gap: 10, padding: "0 18px", borderRadius: 21, background: "rgba(8,14,26,.62)", border: "1px solid rgba(150,190,255,.13)" }}>
      <span style={{ width: 11, height: 11, borderRadius: "50%", border: "1.5px solid #8c9bb0", flexShrink: 0 }} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        style={{ flex: 1, minWidth: 0, background: "none", border: 0, outline: "none", color: "#eef3fa", fontFamily: "inherit", fontSize: 14 }}
      />
    </label>
  );
}

/** Regime + stance chips (Monitor hero and Breadth header) */
export function RegimeChips({ regime, regimeColor, stanceHead, stanceTail }: { regime: string; regimeColor: string; stanceHead: string; stanceTail: string }) {
  const chip: CSSProperties = { display: "flex", alignItems: "center", gap: 8, borderRadius: 17, background: "rgba(8,14,26,.6)", border: "1px solid rgba(150,190,255,.14)" };
  const mono: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase" };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      <span style={{ ...chip, ...mono, height: 34, padding: "0 14px", color: "#dfe7f2" }}>
        <Dot color={regimeColor} glow={8} />
        {regime} regime
      </span>
      {(stanceHead || stanceTail) && (
        <span style={{ ...chip, minHeight: 34, padding: "6px 14px", fontSize: 13, color: "#a3b3c8" }}>
          <span style={{ ...mono, color: "#eef3fa" }}>{stanceHead}</span>
          {stanceTail}
        </span>
      )}
    </div>
  );
}

export function PrimaryButton({ onClick, children, style }: { onClick: () => void; children: ReactNode; style?: CSSProperties }) {
  return (
    <button onClick={onClick} style={{ alignSelf: "center", height: 42, padding: "0 24px", borderRadius: 21, border: 0, background: "#eef4ff", color: "#04070d", fontSize: 13.5, fontWeight: 500, cursor: "pointer", ...style }}>
      {children}
    </button>
  );
}

/** Sortable table header cell */
export function SortHead({ label, active, dir, align = "left", onClick, hidden }: { label: string; active: boolean; dir: "asc" | "desc"; align?: "left" | "right" | "center"; onClick?: () => void; hidden?: boolean }) {
  if (hidden) return null;
  return (
    <button
      onClick={onClick}
      style={{ display: "block", background: "none", border: 0, padding: 0, fontFamily: MONO, fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: active ? "#f2f1ed" : "#86868b", textAlign: align, cursor: onClick ? "pointer" : "default", whiteSpace: "nowrap" }}
    >
      {label}
      {active ? (dir === "asc" ? " ↑" : " ↓") : ""}
    </button>
  );
}

/** Mirrored RS histogram bars */
export function Spark({ posD, negD, style }: { posD: string; negD: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 132 32" preserveAspectRatio="none" style={style} aria-hidden="true">
      <path d={posD} fill="#3fe0a6" />
      <path d={negD} fill="#ff5c5c" />
    </svg>
  );
}

/** Style for a cell that stays pinned to the left edge of an HScroll */
export const PIN_CELL: CSSProperties = { position: "sticky", left: 0, zIndex: 1, background: "var(--pin-bg)", boxShadow: "var(--pin-shadow)", alignSelf: "stretch", display: "flex", alignItems: "center", paddingRight: 8, transition: "background .2s" };

/**
 * Sideways-scrolling area for tables wider than the screen. When it overflows it hints that
 * there's more to the right: a one-time "peek" (glides right and back when first seen), a soft
 * right-edge fade while more columns remain, and a small bouncing chevron until the user scrolls.
 */
export function HScroll({ children, onScrollX, style, chevronTop = 12 }: { children: ReactNode; onScrollX?: (x: number) => void; style?: CSSProperties; chevronTop?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [over, setOver] = useState(false);   // content wider than the box
  const [atEnd, setAtEnd] = useState(false); // scrolled to the right edge
  const [moved, setMoved] = useState(false); // user has scrolled sideways
  const [shifted, setShifted] = useState(false); // currently scrolled off the left edge
  const peeking = useRef(false);

  const measure = () => {
    const el = ref.current;
    if (!el) return;
    setOver(el.scrollWidth > el.clientWidth + 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    if (el.firstElementChild) ro?.observe(el.firstElementChild);
    return () => ro?.disconnect();
  }, []);

  // Peek once, the first time the area comes properly into view
  useEffect(() => {
    const el = ref.current;
    if (!el || !over || prefersReducedMotion() || typeof IntersectionObserver === "undefined") return;
    let raf = 0, timer = 0;
    const io = new IntersectionObserver((es) => {
      if (!es[0]?.isIntersecting || el.scrollLeft > 0) return;
      io.disconnect();
      timer = window.setTimeout(() => {
        const dist = Math.min(56, el.scrollWidth - el.clientWidth), t0 = performance.now(), D = 1100;
        peeking.current = true;
        const step = (t: number) => {
          const k = Math.min(1, (t - t0) / D);
          el.scrollLeft = dist * Math.sin(Math.PI * k) * (1 - 0.15 * k); // out and back, easing in and out
          if (k < 1) raf = requestAnimationFrame(step);
          else { el.scrollLeft = 0; peeking.current = false; }
        };
        raf = requestAnimationFrame(step);
      }, 450);
    }, { threshold: 0, rootMargin: "0px 0px -35% 0px" }); // tall tables: fire once the top enters the upper ~2/3 of the screen
    io.observe(el);
    return () => { io.disconnect(); clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [over]);

  const fade = over && !atEnd;
  return (
    <div style={{ position: "relative" }}>
      <div
        ref={ref}
        className="v2-scroll v2-noscroll"
        onScroll={(e) => {
          const el = e.currentTarget;
          onScrollX?.(el.scrollLeft);
          setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
          setShifted(el.scrollLeft > 1);
          if (!peeking.current && el.scrollLeft > 8) setMoved(true);
        }}
        style={{
          overflowX: "auto", overflowY: "hidden", WebkitOverflowScrolling: "touch",
          // Pinned cells (PIN_CELL) only get a solid backing while columns are sliding under them
          ["--pin-bg" as string]: shifted ? "#070c17" : "transparent",
          ["--pin-shadow" as string]: shifted ? "12px 0 14px -12px rgba(0,0,0,.9)" : "none",
          WebkitMaskImage: fade ? "linear-gradient(90deg, #000 calc(100% - 36px), transparent)" : undefined,
          maskImage: fade ? "linear-gradient(90deg, #000 calc(100% - 36px), transparent)" : undefined,
          ...style,
        } as CSSProperties}
      >
        {children}
      </div>
      {over && !moved && !atEnd && (
        <span aria-hidden="true" style={{ position: "absolute", top: chevronTop, right: 6, zIndex: 6, display: "grid", placeItems: "center", width: 24, height: 24, borderRadius: 12, background: "rgba(8,14,26,.85)", border: "1px solid rgba(150,190,255,.22)", color: "#cfe0f5", fontFamily: MONO, fontSize: 14, lineHeight: 1, pointerEvents: "none", animation: "v2-nudge 1.6s ease-in-out infinite" }}>›</span>
      )}
    </div>
  );
}
