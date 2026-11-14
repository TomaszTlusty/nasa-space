import type { LanderId } from "@/lib/store";

/**
 * Contract of the analysis layer (`src/lib/analysis/*`). All heavy work runs in a Web Worker on the
 * same precomputed horizon data the shader uses, so numbers and visuals cannot disagree.
 * Times are ms since epoch UTC.
 */

export interface Interval {
  start: number;
  end: number;
}

/** Hourly (or `stepMinutes`) series over the mission window for one point. */
export interface PointSeries {
  start: number;
  stepMinutes: number;
  /** degrees */
  sunElev: Float32Array;
  sunHorizon: Float32Array;
  /** visible fraction of the solar disc 0..1 */
  sunFraction: Float32Array;
  earthElev: Float32Array;
  earthHorizon: Float32Array;
  /** visible fraction of Earth's disc 0..1 */
  earthFraction: Float32Array;
}

export interface PowerSeries {
  /** electrical power from a vertical sun-tracking array, W */
  watts: Float32Array;
  /** battery state of charge 0..100 (starts full at window start) */
  socPct: Float32Array;
  minSocPct: number;
  /** first time the battery hits 0, or null if it survives the window */
  depletedAt: number | null;
  /** energy generated over the window, Wh */
  energyWh: number;
}

export interface Transitions {
  /** next time the Sun's disc fully disappears / first reappears after `from` (null = not within search span) */
  sunset: number | null;
  sunrise: number | null;
  /** next time Earth fully disappears / first reappears */
  earthset: number | null;
  earthrise: number | null;
  /** state at `from` */
  sunUp: boolean;
  earthUp: boolean;
  from: number;
}

export interface PointAnalysis {
  id: LanderId;
  x: number;
  y: number;
  lat: number;
  lon: number;
  elevationM: number;
  slopeDeg: number;
  siteId?: string;
  series: PointSeries;
  /** mean visible Sun disc fraction over the window, 0..1 */
  sunMean: number;
  /** fraction of steps with any part of Earth visible, 0..1 */
  earthMean: number;
  longestDarkHours: number;
  longestBlackoutHours: number;
  sunWindows: Interval[];
  earthWindows: Interval[];
  power: PowerSeries;
}

export interface WindowAverageStats {
  /** grid of mean sun fraction per horizon-grid node (row-major, row 0 = min y) */
  sun: Float32Array;
  /** share of steps with any part of Earth visible per node (same layout) */
  earth: Float32Array;
  computeMs: number;
  /** sampling step used for the average (1 h, or 2 h when hourly would exceed the time budget) */
  stepHours: number;
}

/** Sun and Earth state at the playhead. Azimuths are GRID azimuths (deg from local grid north +y, clockwise). */
export interface LiveVisibility {
  /** visible disc fractions 0..1 */
  sunVis: number;
  earthVis: number;
  /** degrees above the mathematical (airless, smooth-Moon) horizon */
  sunElev: number;
  earthElev: number;
  sunAz: number;
  earthAz: number;
  /** terrain horizon elevation in the body's direction, degrees */
  sunHorizon: number;
  earthHorizon: number;
}
