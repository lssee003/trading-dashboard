/**
 * Backdrop for the glass theme. The wallpaper is now a single static
 * nebula photograph painted on `.glass body` (index.css) — a fixed image
 * costs nothing to render, so the theme stays smooth on weak GPUs where the
 * old animated CSS blooms stuttered. Nothing to mount here anymore; the
 * component is kept as a no-op so callers don't have to change.
 */
export function GlassBackdrop() {
  return null;
}
