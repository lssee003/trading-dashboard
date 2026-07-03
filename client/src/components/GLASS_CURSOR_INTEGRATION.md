# Liquid-glass cursor — integration

A normal pointer arrow that tracks the mouse 1:1, rendered as glass. Glass theme
only, mouse (fine pointer) only; light/dark and touch keep the native cursor.

`GlassCursor.tsx` is the component. Two small edits wire it in. They live in
`index.css` and `App.tsx`, whose glass-theme versions are only in your working
tree (the whole glass theme is uncommitted), so apply these there.

## 1. `App.tsx` — mount it once, next to `<GlassBackdrop />`

```tsx
import { GlassCursor } from "@/components/GlassCursor";
```

```tsx
{/* Procedural liquid-glass scene behind everything (glass theme only) */}
<GlassBackdrop />
{/* Liquid-glass cursor in front of everything (glass theme, mouse only) */}
<GlassCursor />
```

## 2. `index.css` — add this block (glass-theme section)

```css
/* ======================================================================
   Liquid-glass cursor (glass theme, fine pointer only). See GlassCursor.tsx.
   A normal pointer arrow rendered as glass: the arrow silhouette refracts the
   scene beneath it, a white rim lights it on dark surfaces, a dark contour
   holds it on light ones, and it thins to a glass I-beam over editable text.
   ====================================================================== */

/* Hide the native cursor only while the glass cursor is actually active
   (class set by GlassCursor on <html>, on a fine pointer only). */
.glass.glass-cursor-active,
.glass.glass-cursor-active * { cursor: none !important; }

.glass-cursor {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 2147483000; /* cursor layer — above every overlay, incl. portaled tooltips */
  width: 19px;
  height: 27px;
  pointer-events: none;
  opacity: 0;
  transform: translate3d(-100px, -100px, 0);
  will-change: transform;
  transition: opacity 140ms ease;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45));
}
.glass-cursor.is-visible { opacity: 1; }

/* refractive body, clipped to the arrow silhouette */
.glass-cursor__body {
  position: absolute;
  inset: 0;
  -webkit-clip-path: path("M2 1.4 L2 22.3 L7.05 17.5 L10.35 24.9 L13.2 23.6 L9.95 16.45 L17 16.2 Z");
  clip-path: path("M2 1.4 L2 22.3 L7.05 17.5 L10.35 24.9 L13.2 23.6 L9.95 16.45 L17 16.2 Z");
  -webkit-backdrop-filter: blur(2px) saturate(1.7) brightness(1.12);
  backdrop-filter: blur(2px) saturate(1.7) brightness(1.12);
  background: linear-gradient(140deg,
    rgba(255, 255, 255, 0.55) 0%,
    rgba(255, 255, 255, 0.14) 45%,
    rgba(255, 255, 255, 0.36) 100%);
}
/* specular streak — a catch of light down the leading edge */
.glass-cursor__body::before {
  content: "";
  position: absolute;
  top: 2.5px;
  left: 3px;
  width: 2.4px;
  height: 11px;
  border-radius: 2px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0));
  transform: rotate(23deg);
  transform-origin: top left;
  filter: blur(0.3px);
}

/* crisp rim: dark contour under a white glass highlight, so the shape reads
   on both light and dark surfaces */
.glass-cursor__rim { position: absolute; inset: 0; overflow: visible; }
.glass-cursor__rim path { fill: none; stroke-linejoin: round; }
.glass-cursor__rim .rim-shadow { stroke: rgba(6, 10, 20, 0.55); stroke-width: 2.6; }
.glass-cursor__rim .rim-light  { stroke: rgba(255, 255, 255, 0.95); stroke-width: 1; }

/* glass I-beam over editable text */
.glass-cursor__ibeam { display: none; }
.glass-cursor.is-text .glass-cursor__body,
.glass-cursor.is-text .glass-cursor__rim { display: none; }
.glass-cursor.is-text .glass-cursor__ibeam {
  display: block;
  position: absolute;
  left: 7.5px;
  top: 2px;
  width: 4px;
  height: 22px;
  border-radius: 2px;
  -webkit-backdrop-filter: blur(2px) saturate(1.6) brightness(1.1);
  backdrop-filter: blur(2px) saturate(1.6) brightness(1.1);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.22));
  box-shadow: inset 0 0 0 0.6px rgba(255, 255, 255, 0.85), 0 1px 2px rgba(0, 0, 0, 0.4);
}

/* No backdrop-filter (rare): brighter frosted fill so it stays glassy. */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .glass-cursor__body {
    background: linear-gradient(140deg,
      rgba(255, 255, 255, 0.82), rgba(214, 226, 245, 0.42) 45%, rgba(255, 255, 255, 0.66));
  }
}

@media (prefers-reduced-motion: reduce) {
  .glass-cursor { transition: none; }
}
```

## Notes

- **Scope.** Only mounts when `theme === "glass"` and `matchMedia("(pointer: fine)")`
  matches. The native cursor is hidden only once the component is live (via the
  `glass-cursor-active` class on `<html>`), so if it never mounts the OS cursor
  is left intact — no cursorless dead-ends.
- **Precision.** Tracks 1:1 with no smoothing — it behaves exactly like a native
  cursor, so dense-table targeting is unchanged. The hotspot is the arrow tip.
- **Tuning knobs.** Arrow size: `width/height` on `.glass-cursor` (+ the `path()`
  box). Frost: `backdrop-filter` blur on `__body`. Rim weight:
  `.rim-light` / `.rim-shadow` stroke-width.
