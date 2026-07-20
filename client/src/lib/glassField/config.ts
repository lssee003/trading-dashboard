/**
 * Tunable knobs for the Glass Field backdrop (ported from the Claude Design
 * file "Glass Field.dc.html"). The defaults below are the design's own
 * data-props defaults — the exact look the Design Composer preview renders —
 * so the mounted backdrop matches the reference out of the box. Adjust here to
 * re-tune; every value maps to a shader uniform in engine.ts.
 */

/** Palette temperament — Cosmic (balanced), Ember (warm), Ice (cool). */
export type GlassMood = "Cosmic" | "Ember" | "Ice";

export interface GlassFieldConfig {
  /** Palette temperament. Wire to a market verdict for a data-aware field. */
  mood: GlassMood;
  /** Device-pixel-ratio cap; the render target is sized at min(dpr, cap). */
  dprCap: number;
  /** Lowest adaptive render scale — a weak GPU sheds pixels down to this
   *  fraction of the canvas before the engine gives up and freezes. */
  scaleFloor: number;
  /** Frame-rate cap. The motion is slow ambient drift, so 30 looks identical
   *  to 60/120 while roughly halving GPU/battery cost. */
  maxFps: number;
}

export const GLASS_FIELD_CONFIG: GlassFieldConfig = {
  mood: "Ember",
  dprCap: 1.6,
  scaleFloor: 0.5,
  maxFps: 30,
};

/** Shader encodes mood as a float: 0 Cosmic, 1 Ember, 2 Ice. */
export function moodIndex(mood: GlassMood): number {
  return mood === "Ember" ? 1 : mood === "Ice" ? 2 : 0;
}
