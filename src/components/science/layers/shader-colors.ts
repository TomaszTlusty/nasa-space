/**
 * CSS colours for the overlay legends. The terrain shader (`src/components/scene/terrain-material.ts`)
 * mixes overlays after tone mapping and sRGB encoding, so its overlay constants are display sRGB and
 * are used here verbatim. Legends apply the shader's relief shade for flat ground so swatches match
 * the typical on-screen tone.
 */

export type RGB = readonly [number, number, number];

/** Instant-overlay constants (uOverlay == 1). */
export const INSTANT_SHADOW: RGB = [0.16, 0.17, 0.24];
export const INSTANT_SUN: RGB = [0.98, 0.72, 0.3];
export const INSTANT_EARTH: RGB = [0.45, 0.72, 1.0];
/** Earth hatching strength in the shader: stripe * 0.9 (screen-space stripes, no overlay opacity factor). */
export const EARTH_HATCH_MIX = 0.9;

/** Shader relief shade 0.6 + 0.4 * dot(n, normalize(-0.4, 0.5, 0.75)) evaluated for flat ground (n = up). */
export const FLAT_SHADE = 0.6 + (0.4 * 0.75) / Math.hypot(-0.4, 0.5, 0.75);

/**
 * Inferno colour map, polynomial fit by Matt Zucker (https://www.shadertoy.com/view/WlfXRN),
 * identical coefficients to the shader.
 */
const INFERNO_C: readonly RGB[] = [
  [0.0002189403691192265, 0.001651004631001012, -0.01948089843709184],
  [0.1065134194856116, 0.5639564367884091, 3.932712388889277],
  [11.60249308247187, -3.972853965665698, -15.9423941062914],
  [-41.70399613139459, 17.43639888205313, 44.35414519872813],
  [77.162935699427, -33.40235894210092, -81.80730925738993],
  [-71.31942824499214, 32.62606426397723, 73.20951985803202],
  [25.13112622477341, -12.24266895238567, -23.07032500287172],
];

/** Window-average heat colour for a mean sunlight fraction v (shader: inferno(0.08 + 0.92 * v)). */
export function averageColor(v: number): RGB {
  const x = Math.min(1, Math.max(0, 0.08 + 0.92 * v));
  const out = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    let acc = INFERNO_C[6][k];
    for (let i = 5; i >= 0; i--) acc = INFERNO_C[i][k] + x * acc;
    out[k] = acc;
  }
  return [out[0], out[1], out[2]];
}

const SLOPE_OK: RGB = [0.22, 0.62, 0.52];
const SLOPE_WARN: RGB = [0.95, 0.7, 0.28];
const SLOPE_BAD: RGB = [0.86, 0.3, 0.26];

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Slope colour for s degrees, same piecewise ramp as the shader. */
export function slopeColor(s: number): RGB {
  if (s < 5) return SLOPE_OK;
  if (s < 10) return mix(SLOPE_OK, SLOPE_WARN, (s - 5) / 5);
  return mix(SLOPE_WARN, SLOPE_BAD, Math.min(1, (s - 10) / 10));
}

/** CSS colour of a display-sRGB overlay constant, scaled by the shader's flat-ground relief shade. */
export function toCss(c: RGB, shade = FLAT_SHADE): string {
  const [r, g, b] = c.map((v) => Math.round(Math.min(1, Math.max(0, v * shade)) * 255));
  return `rgb(${r} ${g} ${b})`;
}
