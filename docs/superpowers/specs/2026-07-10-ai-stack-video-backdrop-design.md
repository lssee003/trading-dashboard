# AI Stack scroll-scrubbed video backdrop

## Goal

Replace the Glass Field WebGL backdrop with a scroll-scrubbed video, specifically on the `/ai-stack` page, when the glass theme is active. Other pages and other themes are unaffected.

## Source asset

`kling_20260710_VIDEO_make_a_sho_5749_0 (1).mp4` (repo root, ~14MB, no audio) moves to `client/public/assets/ai-stack-scroll.mp4`.

## Architecture

- **Route-aware `GlassBackdrop.tsx`**: uses wouter's `useLocation()` (paired with the app's `useHashLocation` hook) to detect `/ai-stack`. When on that route, it returns `null` / skips mounting `GlassFieldEngine` — no WebGL context is created there, avoiding two GPU-driven backdrops competing.
- **New `client/src/components/AIStackVideoBackdrop.tsx`**: a fixed, full-viewport `<video>` layer, reusing the `.liquid-field` positioning pattern (`position: fixed; inset: 0; z-index: -1; pointer-events: none`) so it sits in the same stacking slot as the Glass Field. New CSS classes `.ai-stack-video-field` / `.ai-stack-video` (mirroring `.liquid-field` / `.liquid-canvas`) added to `index.css`.
- Rendered from `AIStack.tsx`, gated on `theme === "glass"` (via the existing `useTheme` hook), so it only exists in the DOM when relevant.
- Video attributes: `muted`, `playsInline`, `preload="auto"`, no `loop`, no `autoplay` — position is fully scroll-driven, never plays on its own.

## Scroll scrubbing

- `AIStack.tsx` already has a scrollable `<main className="overflow-y-auto">` — this element (not `window`) is the scroll source; a ref is added to it.
- `AIStackVideoBackdrop` accepts that scroll container ref as a prop.
- On the video's `loadedmetadata` event: pause the video, record `duration`.
- A `scroll` listener on the container, throttled via `requestAnimationFrame` (one pending frame at a time), computes:
  ```
  progress = scrollTop / (scrollHeight - clientHeight)   // clamped [0, 1]
  video.currentTime = progress * duration
  ```
- Before `loadedmetadata` fires, the video shows its first frame (native browser behavior with `preload="auto"`); no manual poster needed.
- If `scrollHeight === clientHeight` (nothing to scroll), progress is treated as 0 — no division by zero.

## Legibility overlay

A fixed dark gradient sits between the video canvas and page content, same visual technique as `.glass body`'s existing wallpaper gradients (soft radial darkening + linear falloff), tuned so the translucent `glass-panel` cards read clearly over moving footage. Implemented as a pseudo-element or sibling div inside `.ai-stack-video-field`, above the `<video>` but still `z-index: -1` relative to page content.

## Edge cases / fallbacks

- **Video load failure**: fails silent — the `.glass body` wallpaper (existing solid gradient) shows through, consistent with `GlassBackdrop`'s existing WebGL-failure fallback.
- **`prefers-reduced-motion`**: scrubbing stays active since it is scroll-driven (user-initiated), not ambient/autoplaying motion — consistent with how scroll-linked effects are generally treated distinctly from idle animation. (The Glass Field's own idle drift does pause under this preference; this video has no idle drift to pause.)
- **Theme/route switch away**: scroll listener and video element are cleaned up on unmount (component unmounts when `theme !== "glass"` or route changes away from `/ai-stack`).
- **File size**: ships at ~14MB as-is; no `ffmpeg` available locally to compress. Only fetched when a user is actually on `/ai-stack` in glass theme.

## Out of scope

- No compression/transcoding of the source video.
- No changes to non-glass themes or any other page.
- No changes to the Glass Field engine itself (still used everywhere except `/ai-stack`).
