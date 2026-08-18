import { useEffect, useRef } from "react";
import { useTheme } from "@/hooks/useTheme";
import { useLocation } from "wouter";
import { StarfieldEngine } from "@/lib/starfield/engine";
import { STARFIELD_CONFIG } from "@/lib/starfield/config";

/**
 * Backdrop for the glass theme: a static nebula (pure CSS, `.glass body` in
 * index.css — it doesn't move, so there's no reason to paint it in JS) with
 * a field of stars on top that only twinkle in place (`lib/starfield/`,
 * Canvas2D, no WebGL, no shader). Star positions are fixed at generation
 * time; the only motion is per-star opacity.
 */
export function GlassBackdrop() {
  const { theme } = useTheme();
  const [location] = useLocation();
  const isAiStack = location === "/ai-stack";
  const active = theme === "glass" && !isAiStack;

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let engine: StarfieldEngine | null = null;
    try {
      engine = new StarfieldEngine(canvas, STARFIELD_CONFIG);
      engine.start();
    } catch (e) {
      // Canvas2D is universally available, but guard anyway: the CSS
      // nebula wallpaper underneath reads fine on its own regardless.
      console.error("Starfield init failed", e);
    }
    return () => engine?.dispose();
  }, [active]);

  if (!active) return null;

  return (
    <div className="liquid-field" aria-hidden="true" data-testid="glass-backdrop">
      <canvas ref={canvasRef} className="liquid-canvas" />
    </div>
  );
}
