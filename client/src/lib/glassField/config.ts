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
  /** 0..1 — how much the blob breaks apart and rejoins over time. */
  separation: number;
  /** 0..1 — how much it floats and slowly tumbles through space. */
  drift: number;
  /** 0..1.6 — strength of the soap-film colour on the edges. */
  iridescence: number;
  /** Device-pixel-ratio cap; the render target is sized at min(dpr, cap). */
  dprCap: number;
}

export const GLASS_FIELD_CONFIG: GlassFieldConfig = {
  mood: "Ember",
  separation: 0.3,
  drift: 0.3,
  iridescence: 1.6,
  dprCap: 1.6,
};

/** Shader encodes mood as a float: 0 Cosmic, 1 Ember, 2 Ice. */
export function moodIndex(mood: GlassMood): number {
  return mood === "Ember" ? 1 : mood === "Ice" ? 2 : 0;
}
