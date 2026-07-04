/**
 * Hand-tuned knobs for the obsidian liquid-glass backdrop.
 * Everything here is perceptual — tuned against the reference render,
 * not against physical units.
 */
export const OBSIDIAN = {
  render: {
    dprCap: 1.5,
    /** internal resolution as a fraction of canvas pixels */
    scale: 1.0,
    minScale: 0.55,
    /** bloom buffers at scene resolution / bloomDiv */
    bloomDiv: 4,
  },

  /** SDF base masses, object space. x right, y up. These are only the
   *  gross gestalt — the sculpt() deformation (bend/twist/pinch/taper)
   *  turns them into the flowing silhouette, so keep them simple. */
  lobes: [
    { c: [-0.9, 0.18, 0.0], r: [0.72, 0.54, 0.54] }, // big left mass
    { c: [-0.78, -0.36, 0.05], r: [0.5, 0.46, 0.46] }, // lower-left foot
    { c: [0.35, -0.12, -0.04], r: [0.64, 0.44, 0.44] }, // right mass
    { c: [1.2, 0.2, 0.02], r: [0.42, 0.3, 0.32] }, // right tip, lifted
  ],

  /** deformation base amounts (noise-animated on top). x bend, y twist,
   *  z waist pinch. */
  sculpt: {
    bend: 0.22,
    twist: 0.14,
    pinch: 0.16,
    speed: [0.021, 0.017, 0.013] as const,
    amp: [0.08, 0.11, 0.06] as const,
  },

  motion: {
    /** dev aid: >1 speeds all animation up to preview drift */
    timeScale: 1,
    rotAmp: [0.26, 0.38, 0.16] as const,
    rotSpeed: [0.038, 0.028, 0.045] as const,
    morphAmp: 0.06,
    morphSpeed: 0.1,
    radiusAmp: 0.045,
    breathAmp: 0.008,
    breathSpeed: 0.13,
    driftAmp: [0.09, 0.05] as const,
    driftSpeed: 0.022,
  },

  light: {
    /** base direction of the key light (wander is added on top) */
    azimuth: -0.5, // radians, negative = left of camera
    elevation: 1.0, // radians above horizon
    wanderAmp: 0.3,
    wanderSpeed: 0.01,
    color: [1.0, 0.95, 0.86] as const,
    intensity: 1.0,
    /** where the visible glow sits on screen for azimuth 0 */
    glowCenter: [0.5, 0.985] as const,
    glowSpread: 0.38,
  },

  material: {
    specInt: 1.15,
    iridInt: 1.0,
    filmBase: 300, // nm
    filmVar: 280, // nm
    absorb: 1.2,
    transInt: 0.05,
    backInt: 0.8,
  },

  post: {
    exposure: 1.15,
    bloomThreshold: 1.6,
    bloomStrength: 0.45,
    vignette: 0.32,
  },
};
