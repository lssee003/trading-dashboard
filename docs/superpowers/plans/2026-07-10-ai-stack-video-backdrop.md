# AI Stack Video Backdrop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On `/ai-stack`, when the glass theme is active, replace the Glass Field WebGL backdrop with a video whose playback position is driven by the page's own scroll position.

**Architecture:** `GlassBackdrop.tsx` becomes route-aware and skips mounting its WebGL engine on `/ai-stack`. A new `AIStackVideoBackdrop.tsx` renders a fixed `<video>` in the same backdrop stacking slot, mounted from `AIStack.tsx` only when `theme === "glass"`. A scroll listener on the page's existing `<main>` scroll container sets `video.currentTime` proportionally to scroll progress.

**Tech Stack:** React 18 + TypeScript, wouter (hash routing), existing `useTheme` hook, plain CSS (`client/src/index.css`), native HTML5 `<video>`. No test framework exists in this repo (`npm run check` runs `tsc` only) — verification is via typecheck + manual browser check using the `run` skill, not unit tests.

## Global Constraints

- Video only appears on `/ai-stack`, only in glass theme (`theme === "glass"`) — every other page/theme combination is byte-for-byte unaffected.
- No `loop`, no `autoplay` on the video — position is 100% scroll-driven.
- Video is `muted` and `playsInline` (no sound, per source request).
- Source asset: `kling_20260710_VIDEO_make_a_sho_5749_0 (1).mp4` in the repo root → `client/public/assets/ai-stack-scroll.mp4`. No transcoding/compression (no `ffmpeg` available).
- Reuse the `.liquid-field` positioning convention (`position: fixed; inset: 0; z-index: -1; pointer-events: none`) for the new backdrop's outer wrapper.
- Scroll listener must be `requestAnimationFrame`-throttled (max one pending frame).
- Guard `scrollHeight === clientHeight` (nothing to scroll) so `progress` is `0`, never `NaN`/`Infinity`.
- Clean up all listeners and the video element on unmount.

---

### Task 1: Move the video asset into `client/public/assets/`

**Files:**
- Move: `kling_20260710_VIDEO_make_a_sho_5749_0 (1).mp4` → `client/public/assets/ai-stack-scroll.mp4`

**Interfaces:**
- Produces: a static asset reachable at `/assets/ai-stack-scroll.mp4` at runtime (same convention as the existing `/assets/glass-liquid-blob.png`).

- [ ] **Step 1: Move and rename the file**

```bash
cd "/Users/seeliansheng/Documents/trading-dashboard"
git mv "kling_20260710_VIDEO_make_a_sho_5749_0 (1).mp4" "client/public/assets/ai-stack-scroll.mp4"
```

- [ ] **Step 2: Verify it moved correctly**

```bash
ls -la client/public/assets/ai-stack-scroll.mp4
git status
```

Expected: file listed under `client/public/assets/`, `git status` shows a rename (not a delete + untracked add) for the tracked copy, and the original path is gone. (If the root `.mp4` was untracked, `git status` will instead show the new path as untracked — that's fine, `git add` picks it up in the commit step.)

- [ ] **Step 3: Commit**

```bash
git add -A -- "kling_20260710_VIDEO_make_a_sho_5749_0 (1).mp4" client/public/assets/ai-stack-scroll.mp4
git commit -m "chore: move AI Stack backdrop video into public assets"
```

---

### Task 2: Add CSS for the video backdrop layer

**Files:**
- Modify: `client/src/index.css` (add after the existing `.liquid-field` / `.liquid-canvas` block, i.e. after line ~382 where the `@media (prefers-reduced-motion: reduce)` rule for `.liquid-field` ends)

**Interfaces:**
- Produces: CSS classes `.ai-stack-video-field` (outer fixed wrapper), `.ai-stack-video` (the `<video>` element), `.ai-stack-video-overlay` (legibility gradient) — consumed by `AIStackVideoBackdrop.tsx` in Task 3.

- [ ] **Step 1: Add the CSS block**

Insert this immediately after the existing reduced-motion block for `.liquid-field` (the `@media (prefers-reduced-motion: reduce) { .liquid-field { animation: none; } }` rule):

```css
/* ── AI Stack video backdrop ─────────────────────────────────────────
   Fixed layer behind AI Stack page content (same stacking slot as
   .liquid-field: above the body wallpaper, below every panel). Video
   position is driven entirely by scroll (see AIStackVideoBackdrop.tsx);
   it never plays on its own. */
.ai-stack-video-field {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
  animation: liquid-fade-in 1600ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.ai-stack-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  background: #000000;
}

/* Darkens the footage so translucent .glass-panel cards stay legible */
.ai-stack-video-overlay {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(1200px 800px at 12% -10%, rgba(56, 130, 246, 0.10), transparent 62%),
    radial-gradient(1000px 700px at 88% 8%, rgba(124, 88, 250, 0.10), transparent 58%),
    linear-gradient(180deg, rgba(5, 7, 15, 0.55) 0%, rgba(5, 7, 15, 0.72) 100%);
}

@media (prefers-reduced-motion: reduce) {
  .ai-stack-video-field { animation: none; }
}
```

- [ ] **Step 2: Verify CSS compiles**

```bash
cd "/Users/seeliansheng/Documents/trading-dashboard"
npm run check
```

Expected: no errors (this is a CSS-only change; `tsc` should pass same as before — this step just confirms the change didn't break anything else).

- [ ] **Step 3: Commit**

```bash
git add client/src/index.css
git commit -m "feat: add CSS for the AI Stack video backdrop layer"
```

---

### Task 3: Create `AIStackVideoBackdrop.tsx`

**Files:**
- Create: `client/src/components/AIStackVideoBackdrop.tsx`

**Interfaces:**
- Consumes: CSS classes from Task 2 (`.ai-stack-video-field`, `.ai-stack-video`, `.ai-stack-video-overlay`); the static asset `/assets/ai-stack-scroll.mp4` from Task 1.
- Produces: `AIStackVideoBackdrop({ scrollContainerRef }: { scrollContainerRef: React.RefObject<HTMLElement> })` — a component that renders `null`-safe (works even if `scrollContainerRef.current` is momentarily `null` on first paint) and requires no other props. Consumed by `AIStack.tsx` in Task 4.

- [ ] **Step 1: Write the component**

```tsx
import { useEffect, useRef } from "react";

/**
 * Backdrop for the AI Stack page (glass theme only): a fixed video whose
 * playback position is driven entirely by the page's own scroll position —
 * it never plays on its own. Replaces the Glass Field WebGL backdrop on
 * this page (see GlassBackdrop.tsx, which skips mounting on /ai-stack).
 */
export function AIStackVideoBackdrop({
  scrollContainerRef,
}: {
  scrollContainerRef: React.RefObject<HTMLElement>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const container = scrollContainerRef.current;
    if (!video || !container) return;

    let duration = 0;
    let rafPending = false;

    const applyProgress = () => {
      rafPending = false;
      if (!duration) return;
      const scrollRange = container.scrollHeight - container.clientHeight;
      const progress = scrollRange > 0 ? container.scrollTop / scrollRange : 0;
      const clamped = Math.min(1, Math.max(0, progress));
      video.currentTime = clamped * duration;
    };

    const onScroll = () => {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(applyProgress);
    };

    const onLoadedMetadata = () => {
      duration = video.duration || 0;
      video.pause();
      applyProgress();
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    container.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      container.removeEventListener("scroll", onScroll);
    };
  }, [scrollContainerRef]);

  return (
    <div className="ai-stack-video-field" aria-hidden="true" data-testid="ai-stack-video-backdrop">
      <video
        ref={videoRef}
        className="ai-stack-video"
        src="/assets/ai-stack-scroll.mp4"
        muted
        playsInline
        preload="auto"
      />
      <div className="ai-stack-video-overlay" />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd "/Users/seeliansheng/Documents/trading-dashboard"
npm run check
```

Expected: no errors. If `RefObject<HTMLElement>` complains about possible `null` given the strictness settings, confirm `client/src/pages/AIStack.tsx`'s ref (added in Task 4) is created with `useRef<HTMLElement>(null)` so the types line up.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/AIStackVideoBackdrop.tsx
git commit -m "feat: add scroll-scrubbed video backdrop component for AI Stack"
```

---

### Task 4: Wire the video backdrop into `AIStack.tsx`

**Files:**
- Modify: `client/src/pages/AIStack.tsx`
  - Add `useRef` import (already imports `useRef` at line 1 — reuse it)
  - Add import for `AIStackVideoBackdrop` and `useTheme`
  - Add a ref on the `<main>` element (currently line 151: `<main className="flex-1 overflow-y-auto p-3 md:p-4">`)
  - Render `<AIStackVideoBackdrop>` when `theme === "glass"`

**Interfaces:**
- Consumes: `AIStackVideoBackdrop` from Task 3 (`{ scrollContainerRef }` prop), `useTheme` from `client/src/hooks/useTheme.tsx` (returns `{ theme, toggleTheme, isAutoMode }`).

- [ ] **Step 1: Update imports**

In `client/src/pages/AIStack.tsx`, change line 1 and add two new imports after line 8 (`import { AI_STACK_DATA } from "@/data/aiStack";`):

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
```
(unchanged — `useRef` is already imported)

Add after the `AI_STACK_DATA` import:

```tsx
import { AIStackVideoBackdrop } from "@/components/AIStackVideoBackdrop";
import { useTheme } from "@/hooks/useTheme";
```

- [ ] **Step 2: Add theme and scroll container ref inside the component**

In the `AIStack()` function body, right after the existing `const navigateWithTransition = useViewTransitionNavigate();` (line 28), add:

```tsx
  const { theme } = useTheme();
  const mainRef = useRef<HTMLElement>(null);
```

- [ ] **Step 3: Attach the ref to `<main>` and render the backdrop**

Change the `<main>` opening tag (currently line 151):

```tsx
      <main className="flex-1 overflow-y-auto p-3 md:p-4">
```

to:

```tsx
      <main ref={mainRef} className="flex-1 overflow-y-auto p-3 md:p-4">
```

Then, immediately before the `<main ...>` tag, add the conditional backdrop render:

```tsx
      {theme === "glass" && <AIStackVideoBackdrop scrollContainerRef={mainRef} />}
      <main ref={mainRef} className="flex-1 overflow-y-auto p-3 md:p-4">
```

- [ ] **Step 4: Typecheck**

```bash
cd "/Users/seeliansheng/Documents/trading-dashboard"
npm run check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/AIStack.tsx
git commit -m "feat: mount video backdrop on AI Stack page in glass theme"
```

---

### Task 5: Make `GlassBackdrop.tsx` skip mounting on `/ai-stack`

**Files:**
- Modify: `client/src/components/GlassBackdrop.tsx`

**Interfaces:**
- Consumes: `useLocation` from `wouter` (already used elsewhere in the codebase, e.g. `client/src/lib/viewTransition.ts:2`) — returns `[location, setLocation]`; `location` is a string path like `/ai-stack` (matches route paths registered in `client/src/App.tsx`, since the app uses `useHashLocation`).

- [ ] **Step 1: Add the route check**

In `client/src/components/GlassBackdrop.tsx`, add the import after line 2 (`import { useTheme } from "@/hooks/useTheme";`):

```tsx
import { useLocation } from "wouter";
```

Update the component body — change:

```tsx
export function GlassBackdrop() {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (theme !== "glass") return;
```

to:

```tsx
export function GlassBackdrop() {
  const { theme } = useTheme();
  const [location] = useLocation();
  const isAiStack = location === "/ai-stack";
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (theme !== "glass" || isAiStack) return;
```

And update the dependency array and early-return render check. Change:

```tsx
    return () => engine?.dispose();
  }, [theme]);

  if (theme !== "glass") return null;
```

to:

```tsx
    return () => engine?.dispose();
  }, [theme, isAiStack]);

  if (theme !== "glass" || isAiStack) return null;
```

- [ ] **Step 2: Typecheck**

```bash
cd "/Users/seeliansheng/Documents/trading-dashboard"
npm run check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/GlassBackdrop.tsx
git commit -m "fix: skip mounting the Glass Field WebGL engine on /ai-stack"
```

---

### Task 6: Manual browser verification

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Use the `run` skill (or, if unavailable, `npm run dev`) to launch the app and confirm it's serving on its usual port.

- [ ] **Step 2: Verify glass theme on AI Stack shows the video, not the Glass Field**

Navigate to `http://localhost:3000/#/ai-stack?theme=glass`. Confirm:
- A dark video-textured background renders behind the page content (not the WebGL blob/starfield).
- The page content (`glass-panel` cards) remains legible over it.

- [ ] **Step 3: Verify scroll scrubbing**

Expand several layers via "Expand All" so the page has enough height to scroll. Scroll down slowly and confirm the video's visible frame changes in step with scroll position (not autoplaying on its own — pausing the scroll should freeze the frame). Scroll back up and confirm it reverses.

- [ ] **Step 4: Verify other pages/themes are untouched**

- `http://localhost:3000/#/relative-strength?theme=glass` — Glass Field WebGL backdrop still renders as before (not the video).
- `http://localhost:3000/#/ai-stack?theme=dark` and `?theme=light` — plain solid `--terminal-bg` background, no video, no Glass Field.

- [ ] **Step 5: Check the console for errors**

Open devtools console while performing steps 2–4. Expected: no errors related to the video element, scroll listener, or `GlassBackdrop`.

- [ ] **Step 6: Report results**

Summarize what was checked and any issues found. If everything matches expectations, no further commit is needed for this task (it's verification-only).
