import { useTheme } from "@/hooks/useTheme";

/**
 * Backdrop for the glass theme — currently a blank canvas.
 * The previous procedural liquid-glass renderer lives on the
 * `background/liquid-glass` branch; a new background will be
 * built here in its place.
 */
export function GlassBackdrop() {
  const { theme } = useTheme();

  if (theme !== "glass") return null;

  return (
    <div className="liquid-field" aria-hidden="true" data-testid="glass-backdrop">
      <canvas style={{ width: "100%", height: "100%", display: "block" }} />
    </div>
  );
}
