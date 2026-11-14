/**
 * Pure analysis kernels (isomorphic: used by the Web Worker, the main thread for `liveAt`, and tests).
 * All visibility numbers come from `@/lib/moon/horizon`, i.e. the same horizon data the shader uses.
 */

import { simulatePower } from "@/lib/analysis/power";
import type {
  LiveVisibility,
  PointAnalysis,
  Transitions,
} from "@/lib/analysis/types";
import type { CelestialBody } from "@/lib/moon/ephemeris";
import { fromLocal } from "@/lib/moon/frames";
import {
  averageGrid,
  type LoadedRegion,
  nextTransition,
  type Timeline,
  type TimelinePoint,
  timeline,
  visibilityAt,
  windows,
} from "@/lib/moon/horizon";
import type { RegionGrid } from "@/lib/moon/types";
import type {
  DiscoveryCriteria,
  DiscoveryResult,
  LanderId,
  PowerPreset,
} from "@/lib/store";
import { heightAt } from "@/lib/terrain";

/** Search span for sunset / sunrise / Earthset / Earthrise. */
export const TRANSITION_SEARCH_DAYS = 30;

export interface PointQuery {
  x: number;
  y: number;
  /** curated site: its exact horizon profile (interpolated to `mastHeight`) replaces the grid horizon */
  siteId?: string;
  /** observer height above ground; only used with `siteId` (the grid horizon is fixed at meta.horizon.mastHeight) */
  mastHeight?: number;
}

/** Observer for the horizon library: the exact site profile when available, else the grid horizon. */
export function timelinePoint(
  region: LoadedRegion,
  q: PointQuery,
): TimelinePoint {
  if (q.siteId && region.meta.sites.some((s) => s.id === q.siteId)) {
    return {
      siteId: q.siteId,
      mastHeight: q.mastHeight ?? region.meta.horizon.mastHeight,
    };
  }
  return { x: q.x, y: q.y };
}

/** Local position actually observed (a site's own coordinates when `siteId` resolves). */
function resolvedXY(
  region: LoadedRegion,
  q: PointQuery,
): { x: number; y: number; lat: number; lon: number } {
  const site = q.siteId
    ? region.meta.sites.find((s) => s.id === q.siteId)
    : undefined;
  if (site) return { x: site.x, y: site.y, lat: site.lat, lon: site.lon };
  return { x: q.x, y: q.y, ...fromLocal(q.x, q.y, region.meta) };
}

/** Longest run of consecutive samples with value <= 0, in hours (each sample stands for one step). */
export function longestZeroRunHours(
  values: ArrayLike<number>,
  stepMinutes: number,
): number {
  let best = 0;
  let run = 0;
  for (let i = 0; i < values.length; i++) {
    if (values[i] <= 0) {
      run++;
      if (run > best) best = run;
    } else run = 0;
  }
  return (best * stepMinutes) / 60;
}

/** Bilinear sample of a row-major grid (row 0 = min y), clamped to the grid. */
export function sampleGrid(
  grid: RegionGrid,
  data: ArrayLike<number>,
  x: number,
  y: number,
): number {
  const { width: W, height: H } = grid;
  const cf = Math.min(Math.max((x - grid.x0) / grid.step, 0), W - 1);
  const rf = Math.min(Math.max((y - grid.y0) / grid.step, 0), H - 1);
  const c0 = Math.min(Math.floor(cf), W - 2);
  const r0 = Math.min(Math.floor(rf), H - 2);
  const fc = cf - c0;
  const fr = rf - r0;
  const i = r0 * W + c0;
  const a = data[i] + (data[i + 1] - data[i]) * fc;
  const b = data[i + W] + (data[i + W + 1] - data[i + W]) * fc;
  return a + (b - a) * fr;
}

/** Hourly visibility timeline of a point over [start, start + days]. */
export function pointTimeline(
  region: LoadedRegion,
  q: PointQuery,
  start: number,
  days: number,
): Timeline {
  return timeline(
    region,
    timelinePoint(region, q),
    new Date(start),
    days * 24,
    60,
  );
}

/** Full analysis of one point from its (cacheable) timeline; power is cheap and recomputed per call. */
export function analyzeTimeline(
  region: LoadedRegion,
  id: LanderId,
  q: PointQuery,
  tl: Timeline,
  power: PowerPreset,
): PointAnalysis {
  const { x, y, lat, lon } = resolvedXY(region, q);
  const n = tl.times.length;
  const start = n > 0 ? tl.times[0] : 0;
  const stepMinutes =
    n > 1 ? Math.round((tl.times[1] - tl.times[0]) / 60_000) : 60;
  let sunSum = 0;
  let earthSteps = 0;
  for (let i = 0; i < n; i++) {
    sunSum += tl.sunFraction[i];
    if (tl.earthFraction[i] > 0) earthSteps++;
  }
  return {
    id,
    x,
    y,
    lat,
    lon,
    elevationM: heightAt(region.meta, region.heights, x, y),
    slopeDeg: sampleGrid(region.meta.horizon, region.slope, x, y),
    siteId: q.siteId,
    series: {
      start,
      stepMinutes,
      sunElev: tl.sunElev,
      sunHorizon: tl.sunHorizon,
      sunFraction: tl.sunFraction,
      earthElev: tl.earthElev,
      earthHorizon: tl.earthHorizon,
      earthFraction: tl.earthFraction,
    },
    sunMean: n > 0 ? sunSum / n : 0,
    earthMean: n > 0 ? earthSteps / n : 0,
    longestDarkHours: longestZeroRunHours(tl.sunFraction, stepMinutes),
    longestBlackoutHours: longestZeroRunHours(tl.earthFraction, stepMinutes),
    sunWindows: windows(tl.times, tl.sunFraction).map((w) => ({
      start: w.startMs,
      end: w.endMs,
    })),
    earthWindows: windows(tl.times, tl.earthFraction).map((w) => ({
      start: w.startMs,
      end: w.endMs,
    })),
    power: simulatePower(tl.sunElev, tl.sunFraction, start, stepMinutes, power),
  };
}

/**
 * Visibility state of one body at `from` plus its next two changes: for a visible body the next set
 * and the rise after it, for a hidden one the next rise and the set after it (each searched 30 days).
 */
export interface BodyTransitions {
  from: number;
  up: boolean;
  first: number | null;
  second: number | null;
}

export function bodyTransitions(
  region: LoadedRegion,
  point: TimelinePoint,
  from: number,
  body: CelestialBody,
): BodyTransitions {
  const t1 = nextTransition(
    region,
    point,
    new Date(from),
    body,
    0,
    TRANSITION_SEARCH_DAYS,
  );
  const up = t1
    ? t1.kind === "set"
    : visibilityAt(region, point, new Date(from), body).fraction > 0;
  const t2 = t1
    ? nextTransition(region, point, t1.date, body, 0, TRANSITION_SEARCH_DAYS)
    : null;
  return {
    from,
    up,
    first: t1 ? t1.date.getTime() : null,
    second: t2 ? t2.date.getTime() : null,
  };
}

/**
 * A cached BodyTransitions is still exact at `t` when no change happens in [from, t]. A "no change
 * within 30 days" result is reused for up to one day of playhead motion (the claim then covers ≥ 29 days).
 */
export function stillValid(b: BodyTransitions, t: number): boolean {
  if (t < b.from) return false;
  return b.first === null ? t - b.from < 86_400_000 : t < b.first;
}

export function toTransitions(
  sun: BodyTransitions,
  earth: BodyTransitions,
  from: number,
): Transitions {
  return {
    from,
    sunUp: sun.up,
    earthUp: earth.up,
    sunset: sun.up ? sun.first : sun.second,
    sunrise: sun.up ? sun.second : sun.first,
    earthset: earth.up ? earth.first : earth.second,
    earthrise: earth.up ? earth.second : earth.first,
  };
}

export interface WindowAverage {
  /** mean visible Sun disc fraction per horizon-grid node (row-major, row 0 = min y) */
  sun: Float32Array;
  /** share of steps with any part of Earth visible per node */
  earthAny: Float32Array;
  stepHours: number;
  computeMs: number;
}

/** Measured cost of one averageGrid step (ms), smoothed over runs; decides the 30-day step. */
let msPerStep = 0.65;
/** Windows longer than 15 days use 2-hour steps when hourly is predicted to exceed this budget. */
const AVERAGE_BUDGET_MS = 300;

export function windowAverage(
  region: LoadedRegion,
  start: number,
  days: number,
): WindowAverage {
  const hours = days * 24;
  const stepHours = days > 15 && hours * msPerStep > AVERAGE_BUDGET_MS ? 2 : 1;
  const t0 = performance.now();
  const g = averageGrid(region, new Date(start), hours, stepHours);
  const computeMs = performance.now() - t0;
  msPerStep = 0.5 * msPerStep + (0.5 * computeMs) / Math.max(1, g.steps);
  return { sun: g.sun, earthAny: g.earthAny, stepHours, computeMs };
}

/** RGBA8 per node for the heatmap shader: R = mean Sun, G = share of time with Earth, B = 0, A = 255. */
export function encodeAverage(
  sun: Float32Array,
  earthAny: Float32Array,
): Uint8Array {
  const out = new Uint8Array(sun.length * 4);
  for (let i = 0; i < sun.length; i++) {
    const o = i * 4;
    out[o] = Math.round(Math.min(1, Math.max(0, sun[i])) * 255);
    out[o + 1] = Math.round(Math.min(1, Math.max(0, earthAny[i])) * 255);
    out[o + 3] = 255;
  }
  return out;
}

export const DISCOVERY_TOP_N = 5;
/** Non-maximum suppression radius: picks are at least this far apart (m). */
export const DISCOVERY_MIN_SEPARATION_M = 1200;

/** Weighted site score, 0..1. */
export function discoveryScore(
  sun: number,
  earth: number,
  slopeDeg: number,
  maxSlopeDeg: number,
): number {
  const flat = maxSlopeDeg > 0 ? 1 - Math.min(1, slopeDeg / maxSlopeDeg) : 1;
  return 0.5 * sun + 0.35 * earth + 0.15 * flat;
}

export interface Candidate {
  i: number;
  x: number;
  y: number;
  score: number;
}

/**
 * Grid nodes meeting the criteria, best first, at most `topN`, each at least `minSeparation` metres
 * from every better pick.
 */
export function pickCandidates(
  grid: RegionGrid,
  sun: ArrayLike<number>,
  earth: ArrayLike<number>,
  slope: ArrayLike<number>,
  criteria: DiscoveryCriteria,
  topN = DISCOVERY_TOP_N,
  minSeparation = DISCOVERY_MIN_SEPARATION_M,
): Candidate[] {
  const all: Candidate[] = [];
  for (let r = 0; r < grid.height; r++) {
    for (let c = 0; c < grid.width; c++) {
      const i = r * grid.width + c;
      if (
        slope[i] > criteria.maxSlopeDeg ||
        sun[i] < criteria.minSun ||
        earth[i] < criteria.minEarth
      )
        continue;
      all.push({
        i,
        x: grid.x0 + c * grid.step,
        y: grid.y0 + r * grid.step,
        score: discoveryScore(sun[i], earth[i], slope[i], criteria.maxSlopeDeg),
      });
    }
  }
  all.sort((a, b) => b.score - a.score);
  const picked: Candidate[] = [];
  const min2 = minSeparation * minSeparation;
  for (const c of all) {
    if (picked.every((p) => (p.x - c.x) ** 2 + (p.y - c.y) ** 2 >= min2)) {
      picked.push(c);
      if (picked.length === topN) break;
    }
  }
  return picked;
}

export function discover(
  region: LoadedRegion,
  avg: WindowAverage,
  criteria: DiscoveryCriteria,
  start: number,
  days: number,
): DiscoveryResult[] {
  const grid = region.meta.horizon;
  return pickCandidates(
    grid,
    avg.sun,
    avg.earthAny,
    region.slope,
    criteria,
  ).map((c, k) => {
    const tl = pointTimeline(region, { x: c.x, y: c.y }, start, days);
    return {
      rank: k + 1,
      x: c.x,
      y: c.y,
      ...fromLocal(c.x, c.y, region.meta),
      score: c.score,
      sun: avg.sun[c.i],
      earth: avg.earthAny[c.i],
      slopeDeg: region.slope[c.i],
      longestDarkHours: longestZeroRunHours(tl.sunFraction, 60),
    };
  });
}

/**
 * Sun and Earth state at one instant for a point (main-thread cheap: two ephemeris evaluations).
 * Azimuths are GRID azimuths (deg from local grid north +y, clockwise) — the scene's convention.
 */
export function liveAt(
  region: LoadedRegion,
  timeMs: number,
  x: number,
  y: number,
  opts?: { siteId?: string; mastHeight?: number },
): LiveVisibility {
  const point = timelinePoint(region, {
    x,
    y,
    siteId: opts?.siteId,
    mastHeight: opts?.mastHeight,
  });
  const date = new Date(timeMs);
  const s = visibilityAt(region, point, date, "sun");
  const e = visibilityAt(region, point, date, "earth");
  return {
    sunVis: s.fraction,
    earthVis: e.fraction,
    sunElev: s.elevationDeg,
    earthElev: e.elevationDeg,
    sunAz: s.gridAzimuthDeg,
    earthAz: e.gridAzimuthDeg,
    sunHorizon: s.horizonDeg,
    earthHorizon: e.horizonDeg,
  };
}
