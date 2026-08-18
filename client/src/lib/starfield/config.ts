/** Tunable knobs for the Starfield backdrop layer (Canvas2D, no WebGL). */
export interface StarfieldConfig {
  /** Star count at a ~1080p viewport; scales down for smaller ones. */
  baseCount: number;
  /** Device-pixel-ratio cap for the canvas backing store. */
  dprCap: number;
  /** Frame-rate cap — twinkle is a slow sine wave, doesn't need 60fps. */
  maxFps: number;
}

export const STARFIELD_CONFIG: StarfieldConfig = {
  baseCount: 220,
  dprCap: 1.5,
  maxFps: 20,
};
