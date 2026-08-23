import { useTheme } from "@/hooks/useTheme";
import { useLocation } from "wouter";

/**
 * Backdrop for the glass theme: soft, diffuse light blooms drifting in
 * near-black — a warm terracotta glow upper-right, a cool violet lower-left,
 * a faint amber dust lane below (the palette of the reference the wallpaper
 * was modeled on). Pure CSS: the base gradient lives in `.glass body`
 * (index.css) and the drifting blooms are the `.glass-bloom` divs below,
 * animated with transform + opacity only (GPU-composited, no JS loop, no
 * canvas, no WebGL). Motion is deliberately barely perceptible — each bloom
 * drifts on a long, offset cycle so the field never visibly repeats.
 */
export function GlassBackdrop() {
  const { theme } = useTheme();
  const [location] = useLocation();
  const isAiStack = location === "/ai-stack";
  const active = theme === "glass" && !isAiStack;

  if (!active) return null;

  return (
    <div className="liquid-field" aria-hidden="true" data-testid="glass-backdrop">
      <div className="glass-bloom glass-bloom--warm" />
      <div className="glass-bloom glass-bloom--cool" />
      <div className="glass-bloom glass-bloom--amber" />
    </div>
  );
}
