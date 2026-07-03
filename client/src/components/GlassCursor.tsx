import { useEffect, useRef } from "react";
import { useTheme } from "@/hooks/useTheme";

/** The classic arrow silhouette, tip at (2, 1.4) in a 19×27 box. */
const ARROW_PATH =
  "M2 1.4 L2 22.3 L7.05 17.5 L10.35 24.9 L13.2 23.6 L9.95 16.45 L17 16.2 Z";

/** Editable surfaces that should show the glass I-beam instead of the arrow. */
const TEXT_SELECTOR =
  'input:not([type=button]):not([type=submit]):not([type=reset]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]),textarea,[contenteditable=""],[contenteditable="true"]';

/**
 * Liquid-glass cursor for the glass theme.
 *
 * A normal pointer arrow that tracks the mouse 1:1 like any OS cursor — the
 * only difference is that it is made of glass. The arrow silhouette refracts
 * the scene beneath it (backdrop-filter clipped to the shape), carries a lit
 * white rim on dark surfaces and a dark contour on light ones so it survives
 * every background, and thins to a glass I-beam over editable text.
 *
 * Mounts only in the glass theme on a fine pointer (mouse). Touch inputs and
 * the light / dark terminal themes keep the native cursor — precision on the
 * dense data surface is never traded away there. Follows GlassBackdrop's
 * pattern: render nothing unless `theme === "glass"`.
 */
export function GlassCursor() {
  const { theme } = useTheme();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (theme !== "glass") return;
    if (typeof window === "undefined") return;
    // Mouse only. Touch / stylus keep the native (absent) cursor.
    if (!window.matchMedia("(pointer: fine)").matches) return;

    const el = ref.current;
    if (!el) return;

    // Only now hide the native cursor — if this effect never runs (coarse
    // pointer, or the component unmounts), the OS cursor is left intact.
    const root = document.documentElement;
    root.classList.add("glass-cursor-active");

    let px = -100;
    let py = -100;
    let mode: "arrow" | "text" = "arrow";
    let rafPending = false;
    let visible = false;

    const place = () => {
      rafPending = false;
      // arrow: align the tip (2, 1.4) to the pointer; i-beam: center on it.
      const ox = mode === "text" ? px - 9.5 : px - 2;
      const oy = mode === "text" ? py - 13 : py - 1.4;
      el.style.transform = `translate3d(${ox}px, ${oy}px, 0)`;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType && e.pointerType !== "mouse") return;
      px = e.clientX;
      py = e.clientY;

      const target = e.target as Element | null;
      const nextMode =
        target && target.closest && target.closest(TEXT_SELECTOR) ? "text" : "arrow";
      if (nextMode !== mode) {
        mode = nextMode;
        el.classList.toggle("is-text", mode === "text");
      }
      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(place);
      }
      if (!visible) {
        visible = true;
        el.classList.add("is-visible");
      }
    };

    const hide = () => {
      visible = false;
      el.classList.remove("is-visible");
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("mouseleave", hide);
    window.addEventListener("blur", hide);

    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("mouseleave", hide);
      window.removeEventListener("blur", hide);
      root.classList.remove("glass-cursor-active");
    };
  }, [theme]);

  if (theme !== "glass") return null;

  return (
    <div ref={ref} className="glass-cursor" aria-hidden="true">
      <div className="glass-cursor__body" />
      <svg className="glass-cursor__rim" viewBox="0 0 19 27" width="19" height="27">
        <path className="rim-shadow" d={ARROW_PATH} />
        <path className="rim-light" d={ARROW_PATH} />
      </svg>
      <div className="glass-cursor__ibeam" />
    </div>
  );
}
