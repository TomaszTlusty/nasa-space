import type { PointAnalysis, PointSeries } from "@/lib/analysis/types";

/** Placeholder shown while a number is not available yet; same width class as digits in the mono face. */
export const DASH = "—";

export function fmt(v: number | null | undefined, digits = 0): string {
  return v == null || !Number.isFinite(v) ? DASH : v.toFixed(digits);
}

export function pct(fraction: number | null | undefined, digits = 0): string {
  return fraction == null || !Number.isFinite(fraction) ? DASH : (fraction * 100).toFixed(digits);
}

/** Signed degrees, e.g. "+1.2°" / "−0.4°" (true minus sign so columns align). */
export function deg(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return DASH;
  const s = Math.abs(v).toFixed(digits);
  return `${v < 0 && Number(s) !== 0 ? "−" : ""}${s}°`;
}

export function distance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(m >= 10_000 ? 0 : 1)} km` : `${Math.round(m)} m`;
}

/** Index of the series step containing `t`, or null when `t` lies outside the analysed window. */
export function stepIndex(series: PointSeries, t: number): number | null {
  const i = Math.floor((t - series.start) / (series.stepMinutes * 60_000));
  return i >= 0 && i < series.sunElev.length ? i : null;
}

/** Landing criteria used by mission screening (NTRS 20240009596, https://ntrs.nasa.gov/citations/20240009596). */
export const CRITERIA = {
  maxSlopeDeg: 10,
  minEarth: 0.25,
  minSun: 0.05,
} as const;
export const CRITERIA_SOURCE = "https://ntrs.nasa.gov/citations/20240009596";

export interface Screening {
  slope: boolean;
  earth: boolean;
  sun: boolean;
  go: boolean;
}

export function screen(a: PointAnalysis): Screening {
  const slope = a.slopeDeg < CRITERIA.maxSlopeDeg;
  const earth = a.earthMean >= CRITERIA.minEarth;
  // Sun criterion is a share of time with the Sun in view, not the mean visible disc fraction.
  const sun = a.sunAny >= CRITERIA.minSun;
  return { slope, earth, sun, go: slope && earth && sun };
}
