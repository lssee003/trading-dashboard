import { useEffect, useRef } from "react";
import { useTheme } from "@/hooks/useTheme";
import { createObsidianScene } from "@/lib/obsidian/engine";

/**
 * Backdrop for the glass theme: a raymarched black liquid-glass sculpture
 * floating in dark space (see lib/obsidian/). `?bg=solo` raises the canvas
 * above the UI for visual tuning.
 */
export function GlassBackdrop() {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (theme !== "glass") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = createObsidianScene(canvas);
    return () => scene?.dispose();
  }, [theme]);

  if (theme !== "glass") return null;

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
