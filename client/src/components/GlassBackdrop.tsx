import { useEffect, useRef } from "react";
import { useTheme } from "@/hooks/useTheme";
import { useLocation } from "wouter";
import { GlassFieldEngine } from "@/lib/glassField/engine";
import { GLASS_FIELD_CONFIG } from "@/lib/glassField/config";

/**
 * Backdrop for the glass theme: the "Glass Field" — a WebGL2 starfield with
 * drifting aurora and a warm sun-star. Adapted from the Claude Design file
 * "Glass Field.dc.html" (see lib/glassField/). Rendered into a fixed canvas
 * that covers the viewport behind all content. `?bg=solo` raises the layer
 * above the UI for visual tuning.
 */
export function GlassBackdrop() {
  const { theme } = useTheme();
  const [location] = useLocation();
  const isAiStack = location === "/ai-stack";
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (theme !== "glass" || isAiStack) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let engine: GlassFieldEngine | null = null;
    try {
      engine = new GlassFieldEngine(canvas, GLASS_FIELD_CONFIG);
      engine.start();
    } catch (e) {
      // WebGL2 unavailable / context lost: the field is decoration, so the
      // dark body wallpaper simply shows through — no fallback needed.
      console.error("Glass field init failed", e);
    }
    return () => engine?.dispose();
  }, [theme, isAiStack]);

  if (theme !== "glass" || isAiStack) return null;

  const solo =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("bg") === "solo";

  return (
    <div
      className="liquid-field"
      style={solo ? { zIndex: 60 } : undefined}
      aria-hidden="true"
      data-testid="glass-backdrop"
    >
      <canvas ref={canvasRef} className="liquid-canvas" />
    </div>
  );
}
