/**
 * Runtime terrain-horizon visibility library (isomorphic; meant for a Web Worker).
 *
 * Elevations of the Sun / Earth at a local point use exactly the shader formula
 * (`altAzAtLocalPoint`), horizons come from the precomputed grid (`horizon.bin`) or the exact
 * per-site horizons in `meta.json`, so numbers and GPU visuals share the same data.
 * All azimuths here are GRID azimuths (from local grid north +y, clockwise); convert with
 * `gridToTrueAz(gridAz, lon)` from `frames.ts` for display.
 */
import {
  altAzAtLocalPoint,
  bodyVectorRegionFromEphemeris,
  type CelestialBody,
  type MoonEphemeris,
  moonEphemeris,
} from "./ephemeris";
import type { RegionMeta, RegionSite } from "./types";

export interface LoadedRegion {
  meta: RegionMeta;
  heights: Float32Array;
  horizon: Uint8Array;
  slope: Uint8Array;
}

/** Fetches `${baseUrl}/regions/${id}/…` (baseUrl may be "" for same-origin). */
export async function loadRegion(
  baseUrl: string,
  id: string,
): Promise<LoadedRegion> {
  const root = `${baseUrl.replace(/\/$/, "")}/regions/${id}`;
  const get = async (file: string) => {
    const r = await fetch(`${root}/${file}`);
    if (!r.ok) throw new Error(`${root}/${file}: HTTP ${r.status}`);
    return r;
  };
  const meta = (await (await get("meta.json")).json()) as RegionMeta;
  const [h, hz, sl] = await Promise.all([
    get(meta.terrain.file).then((r) => r.arrayBuffer()),
    get(meta.horizon.file).then((r) => r.arrayBuffer()),
    get(meta.slope.file).then((r) => r.arrayBuffer()),
  ]);
  const t = meta.terrain;
  const g = meta.horizon;
  const heights = new Float32Array(h);
  const horizon = new Uint8Array(hz);
  const slope = new Uint8Array(sl);
  if (heights.length !== t.width * t.height)
    throw new Error(`${id}: heights.bin size mismatch`);
  if (horizon.length !== g.width * g.height * g.azBins)
    throw new Error(`${id}: horizon.bin size mismatch`);
  if (slope.length !== g.width * g.height)
    throw new Error(`${id}: slope.bin size mismatch`);
  return { meta, heights, horizon, slope };
}

/** Horizon elevation (deg) at local (x, y): bilinear in x, y (clamped to the grid), linear in azimuth (wrapping). */
export function horizonAt(
  region: LoadedRegion,
  x: number,
  y: number,
  gridAzDeg: number,
): number {
  const g = region.meta.horizon;
  const W = g.width;
  const H = g.height;
  const plane = W * H;
  const cf = Math.min(Math.max((x - g.x0) / g.step, 0), W - 1);
  const rf = Math.min(Math.max((y - g.y0) / g.step, 0), H - 1);
  const c0 = Math.min(Math.floor(cf), W - 2);
  const r0 = Math.min(Math.floor(rf), H - 2);
  const fc = cf - c0;
  const fr = rf - r0;
  const af = ((((gridAzDeg % 360) + 360) % 360) / 360) * g.azBins;
  const k0 = Math.floor(af) % g.azBins;
  const k1 = (k0 + 1) % g.azBins;
  const fa = af - Math.floor(af);
  const hz = region.horizon;
  const i = r0 * W + c0;
  const bil = (k: number) => {
    const o = k * plane + i;
    const a = hz[o] + (hz[o + 1] - hz[o]) * fc;
    const b = hz[o + W] + (hz[o + W + 1] - hz[o + W]) * fc;
    return a + (b - a) * fr;
  };
  const q = bil(k0) + (bil(k1) - bil(k0)) * fa;
  return q * g.quantDeg + g.offsetDeg;
}

/** Linear-in-azimuth (wrapping) lookup of a full-circle horizon profile. */
export function profileAt(
  values: ArrayLike<number>,
  gridAzDeg: number,
): number {
  const n = values.length;
  const af = ((((gridAzDeg % 360) + 360) % 360) / 360) * n;
  const k0 = Math.floor(af) % n;
  const fa = af - Math.floor(af);
  return values[k0] + (values[(k0 + 1) % n] - values[k0]) * fa;
}

/**
 * Exact fraction of a circular disc (angular radius r) above a locally straight horizon line.
 * With d = (bodyElev - horizonElev) / r clamped to [-1, 1]:  f = 1 - (acos(d) - d sqrt(1 - d^2)) / pi.
 */
export function discVisibleFraction(
  bodyElevDeg: number,
  horizonElevDeg: number,
  angularRadiusDeg: number,
): number {
  const d = (bodyElevDeg - horizonElevDeg) / angularRadiusDeg;
  if (d >= 1) return 1;
  if (d <= -1) return 0;
  return 1 - (Math.acos(d) - d * Math.sqrt(1 - d * d)) / Math.PI;
}

export type TimelinePoint =
  | { x: number; y: number }
  | { siteId: string; mastHeight: number };

/** Resolved observer: local position + horizon function of grid azimuth. */
interface Observer {
  x: number;
  y: number;
  horizon: (gridAzDeg: number) => number;
}

/**
 * Site horizons are exact per-site profiles; a mast height between two stored profiles is
 * interpolated linearly between them (clamped to the stored range).
 */
function siteHorizon(site: RegionSite, mast: number): (az: number) => number {
  const hs = [...site.horizons].sort((a, b) => a.mastHeight - b.mastHeight);
  if (hs.length === 0) throw new Error(`site ${site.id} has no horizons`);
  if (mast <= hs[0].mastHeight) return (az) => profileAt(hs[0].values, az);
  const last = hs[hs.length - 1];
  if (mast >= last.mastHeight) return (az) => profileAt(last.values, az);
  const j = hs.findIndex((h) => h.mastHeight >= mast);
  const lo = hs[j - 1];
  const hi = hs[j];
  const f = (mast - lo.mastHeight) / (hi.mastHeight - lo.mastHeight);
  return (az) =>
    profileAt(lo.values, az) * (1 - f) + profileAt(hi.values, az) * f;
}

function resolveObserver(region: LoadedRegion, point: TimelinePoint): Observer {
  if ("siteId" in point) {
    const site = region.meta.sites.find((s) => s.id === point.siteId);
    if (!site) throw new Error(`unknown site ${point.siteId}`);
    return {
      x: site.x,
      y: site.y,
      horizon: siteHorizon(site, point.mastHeight),
    };
  }
  const { x, y } = point;
  return { x, y, horizon: (az) => horizonAt(region, x, y, az) };
}

export interface BodySample {
  elevationDeg: number;
  gridAzimuthDeg: number;
  horizonDeg: number;
  fraction: number;
}

function sampleBody(
  region: LoadedRegion,
  obs: Observer,
  eph: MoonEphemeris,
  body: CelestialBody,
): BodySample {
  const { v, angularRadiusDeg } = bodyVectorRegionFromEphemeris(
    eph,
    body,
    region.meta,
  );
  const aa = altAzAtLocalPoint(v, obs.x, obs.y, region.meta);
  const horizonDeg = obs.horizon(aa.gridAzimuthDeg);
  return {
    elevationDeg: aa.elevationDeg,
    gridAzimuthDeg: aa.gridAzimuthDeg,
    horizonDeg,
    fraction: discVisibleFraction(
      aa.elevationDeg,
      horizonDeg,
      angularRadiusDeg,
    ),
  };
}

/** Sun or Earth state for one point and instant. */
export function visibilityAt(
  region: LoadedRegion,
  point: TimelinePoint,
  date: Date,
  body: CelestialBody,
): BodySample {
  return sampleBody(
    region,
    resolveObserver(region, point),
    moonEphemeris(date),
    body,
  );
}

export interface Timeline {
  /** UTC epoch milliseconds of each sample */
  times: Float64Array;
  sunElev: Float32Array;
  /** grid azimuth (deg) */
  sunAz: Float32Array;
  sunHorizon: Float32Array;
  /** visible fraction of the solar disc (0..1) */
  sunFraction: Float32Array;
  earthElev: Float32Array;
  earthAz: Float32Array;
  earthHorizon: Float32Array;
  earthFraction: Float32Array;
}

/** Samples from startDate to startDate + hours inclusive, every stepMinutes. */
export function timeline(
  region: LoadedRegion,
  point: TimelinePoint,
  startDate: Date,
  hours: number,
  stepMinutes = 60,
): Timeline {
  const obs = resolveObserver(region, point);
  const n = Math.floor((hours * 60) / stepMinutes) + 1;
  const out: Timeline = {
    times: new Float64Array(n),
    sunElev: new Float32Array(n),
    sunAz: new Float32Array(n),
    sunHorizon: new Float32Array(n),
    sunFraction: new Float32Array(n),
    earthElev: new Float32Array(n),
    earthAz: new Float32Array(n),
    earthHorizon: new Float32Array(n),
    earthFraction: new Float32Array(n),
  };
  const t0 = startDate.getTime();
  for (let i = 0; i < n; i++) {
    const t = t0 + i * stepMinutes * 60_000;
    out.times[i] = t;
    const eph = moonEphemeris(new Date(t));
    const s = sampleBody(region, obs, eph, "sun");
    out.sunElev[i] = s.elevationDeg;
    out.sunAz[i] = s.gridAzimuthDeg;
    out.sunHorizon[i] = s.horizonDeg;
    out.sunFraction[i] = s.fraction;
    const e = sampleBody(region, obs, eph, "earth");
    out.earthElev[i] = e.elevationDeg;
    out.earthAz[i] = e.gridAzimuthDeg;
    out.earthHorizon[i] = e.horizonDeg;
    out.earthFraction[i] = e.fraction;
  }
  return out;
}

export interface VisibilityWindow {
  startMs: number;
  endMs: number;
  /** true when the window is already open at the first sample / still open at the last sample */
  openStart: boolean;
  openEnd: boolean;
}

/**
 * Contiguous intervals where values > threshold. Edges are placed by linear interpolation between
 * the bracketing samples (use `nextTransition` for minute-accurate edges).
 */
export function windows(
  times: ArrayLike<number>,
  values: ArrayLike<number>,
  threshold = 0,
): VisibilityWindow[] {
  const out: VisibilityWindow[] = [];
  const n = Math.min(times.length, values.length);
  const cross = (i: number) => {
    const a = values[i - 1] - threshold;
    const b = values[i] - threshold;
    const f = a === b ? 0.5 : a / (a - b);
    return times[i - 1] + (times[i] - times[i - 1]) * f;
  };
  let start: number | null = null;
  let openStart = false;
  for (let i = 0; i < n; i++) {
    const on = values[i] > threshold;
    if (on && start === null) {
      openStart = i === 0;
      start = i === 0 ? times[0] : cross(i);
    } else if (!on && start !== null) {
      out.push({ startMs: start, endMs: cross(i), openStart, openEnd: false });
      start = null;
    }
  }
  if (start !== null)
    out.push({ startMs: start, endMs: times[n - 1], openStart, openEnd: true });
  return out;
}

export interface Transition {
  date: Date;
  /** "set": visible -> hidden (sunset / Earthset); "rise": hidden -> visible */
  kind: "set" | "rise";
}

/**
 * Next change of visibility (visible = disc fraction > threshold, default: any part of the disc)
 * after `date`, searching up to `maxDays` (30) with a 10-minute scan and bisection to 1 minute.
 * Events shorter than the scan step can be missed. Returns null if none is found.
 */
export function nextTransition(
  region: LoadedRegion,
  point: TimelinePoint,
  date: Date,
  body: CelestialBody,
  threshold = 0,
  maxDays = 30,
): Transition | null {
  const obs = resolveObserver(region, point);
  const visible = (t: number) =>
    sampleBody(region, obs, moonEphemeris(new Date(t)), body).fraction >
    threshold;
  const scan = 10 * 60_000;
  const t0 = date.getTime();
  const v0 = visible(t0);
  let prev = t0;
  for (let t = t0 + scan; t <= t0 + maxDays * 86_400_000; t += scan) {
    if (visible(t) !== v0) {
      let lo = prev;
      let hi = t;
      while (hi - lo > 60_000) {
        const mid = (lo + hi) / 2;
        if (visible(mid) === v0) lo = mid;
        else hi = mid;
      }
      return {
        date: new Date(Math.round(hi / 60_000) * 60_000),
        kind: v0 ? "set" : "rise",
      };
    }
    prev = t;
  }
  return null;
}

/** Per-node min / max over azimuth of the quantised horizon (for fast accept / reject). */
const nodeBounds = new WeakMap<
  LoadedRegion,
  { min: Float32Array; max: Float32Array }
>();

function getNodeBounds(region: LoadedRegion): {
  min: Float32Array;
  max: Float32Array;
} {
  const cached = nodeBounds.get(region);
  if (cached) return cached;
  const g = region.meta.horizon;
  const plane = g.width * g.height;
  const lo = new Uint8Array(plane).fill(255);
  const hi = new Uint8Array(plane);
  for (let k = 0; k < g.azBins; k++) {
    const o = k * plane;
    for (let i = 0; i < plane; i++) {
      const v = region.horizon[o + i];
      if (v < lo[i]) lo[i] = v;
      if (v > hi[i]) hi[i] = v;
    }
  }
  const b = {
    min: Float32Array.from(lo, (v) => v * g.quantDeg + g.offsetDeg),
    max: Float32Array.from(hi, (v) => v * g.quantDeg + g.offsetDeg),
  };
  nodeBounds.set(region, b);
  return b;
}

/** Disc-fraction lookup over d = (elev - horizon) / radius in [-1, 1] (linear interp, error < 1e-6). */
const FRACTION_LUT_N = 2048;
const FRACTION_LUT = Float64Array.from(
  { length: FRACTION_LUT_N + 2 },
  (_, i) => {
    const d = Math.min(1, -1 + (2 * i) / FRACTION_LUT_N);
    return 1 - (Math.acos(d) - d * Math.sqrt(1 - d * d)) / Math.PI;
  },
);

interface PassGrid {
  W: number;
  H: number;
  plane: number;
  nBins: number;
  hz: Uint8Array;
  min: Float32Array;
  max: Float32Array;
  qd: number;
  off: number;
}

/**
 * One body, one time step over every node. el / af (azimuth in bins) are linear in (col, row):
 * value(c, r) = base + c * dC + r * dR. Adds the visible disc fraction to `out` and, when `anyOut`
 * is given, 1 for every node where any part of the disc is above the horizon.
 */
function accumulatePass(
  p: PassGrid,
  el0: number,
  dElC: number,
  dElR: number,
  af0: number,
  dAfC: number,
  dAfR: number,
  rad: number,
  out: Float64Array,
  anyOut: Float64Array | null,
): void {
  const { W, H, plane, nBins, hz, min, max, qd, off } = p;
  const invRad = 1 / rad;
  const lutScale = FRACTION_LUT_N / 2;
  const lut = FRACTION_LUT;
  for (let r = 0; r < H; r++) {
    const row = r * W;
    const elRow = el0 + r * dElR;
    const afRow = af0 + r * dAfR;
    for (let c = 0; c < W; c++) {
      const i = row + c;
      const el = elRow + c * dElC;
      if (el - rad >= max[i]) {
        out[i] += 1;
        if (anyOut !== null) anyOut[i] += 1;
        continue;
      }
      if (el + rad <= min[i]) continue;
      let a = afRow + c * dAfC;
      if (a < 0) a += nBins;
      else if (a >= nBins) a -= nBins;
      const k0 = Math.floor(a);
      const fa = a - k0;
      const k1 = k0 + 1 === nBins ? 0 : k0 + 1;
      const q = hz[k0 * plane + i] * (1 - fa) + hz[k1 * plane + i] * fa;
      const d = (el - (q * qd + off)) * invRad;
      if (d <= -1) continue;
      if (anyOut !== null) anyOut[i] += 1;
      if (d >= 1) out[i] += 1;
      else {
        const u = (d + 1) * lutScale;
        const j = Math.floor(u);
        out[i] += lut[j] + (lut[j + 1] - lut[j]) * (u - j);
      }
    }
  }
}

export interface AverageGrid {
  /** mean visible fraction of the solar disc per node (row * width + col) */
  sun: Float32Array;
  /** mean visible fraction of the Earth disc per node */
  earth: Float32Array;
  /** share of steps with any part of the Earth disc above the horizon (Mazarico's definition) */
  earthAny: Float32Array;
  steps: number;
}

/**
 * Mean visible disc fraction of the Sun and the Earth at every horizon-grid node (layout
 * row * width + col, row 0 = min y) over [startDate, startDate + hours), sampled every stepHours.
 *
 * Body vectors are computed once per step. `altAzAtLocalPoint` is evaluated at the grid centre and
 * +-half an extent away; elevation and grid azimuth are then linear in (col, row) (their curvature
 * over a 41 km region is < 0.001 deg), so the per-node work is two adds, a min/max accept/reject and,
 * only for nodes where the disc may straddle the horizon, one azimuth-interpolated horizon lookup.
 */
export function averageGrid(
  region: LoadedRegion,
  startDate: Date,
  hours: number,
  stepHours: number,
): AverageGrid {
  const g = region.meta.horizon;
  const W = g.width;
  const H = g.height;
  const plane = W * H;
  const { min, max } = getNodeBounds(region);
  const pass: PassGrid = {
    W,
    H,
    plane,
    nBins: g.azBins,
    hz: region.horizon,
    min,
    max,
    qd: g.quantDeg,
    off: g.offsetDeg,
  };
  const binsPerDeg = g.azBins / 360;
  // centre node coordinates and the half-span used for the linear fits
  const cc = (W - 1) / 2;
  const rc = (H - 1) / 2;
  const xc = g.x0 + cc * g.step;
  const yc = g.y0 + rc * g.step;
  const span = cc * g.step;
  const sun = new Float64Array(plane);
  const earth = new Float64Array(plane);
  const earthAny = new Float64Array(plane);
  const steps = Math.max(1, Math.floor(hours / stepHours));
  const t0 = startDate.getTime();
  let globalMin = Infinity;
  for (const m of min) if (m < globalMin) globalMin = m;
  const angDiff = (a: number, b: number) =>
    ((((a - b) % 360) + 540) % 360) - 180;
  for (let s = 0; s < steps; s++) {
    const eph = moonEphemeris(new Date(t0 + s * stepHours * 3_600_000));
    for (const body of ["sun", "earth"] as const) {
      const { v, angularRadiusDeg: rad } = bodyVectorRegionFromEphemeris(
        eph,
        body,
        region.meta,
      );
      const c0 = altAzAtLocalPoint(v, xc, yc, region.meta);
      // whole region below every horizon (tilt across the region < 0.7 deg)
      if (c0.elevationDeg + rad + 1 < globalMin) continue;
      const px = altAzAtLocalPoint(v, xc + span, yc, region.meta);
      const mx = altAzAtLocalPoint(v, xc - span, yc, region.meta);
      const py = altAzAtLocalPoint(v, xc, yc + span, region.meta);
      const my = altAzAtLocalPoint(v, xc, yc - span, region.meta);
      const dElC = (px.elevationDeg - mx.elevationDeg) / (2 * cc);
      const dElR = (py.elevationDeg - my.elevationDeg) / (2 * rc);
      const dAzC = angDiff(px.gridAzimuthDeg, mx.gridAzimuthDeg) / (2 * cc);
      const dAzR = angDiff(py.gridAzimuthDeg, my.gridAzimuthDeg) / (2 * rc);
      accumulatePass(
        pass,
        c0.elevationDeg - cc * dElC - rc * dElR,
        dElC,
        dElR,
        (c0.gridAzimuthDeg - cc * dAzC - rc * dAzR) * binsPerDeg,
        dAzC * binsPerDeg,
        dAzR * binsPerDeg,
        rad,
        body === "sun" ? sun : earth,
        body === "sun" ? null : earthAny,
      );
    }
  }
  return {
    sun: Float32Array.from(sun, (x) => x / steps),
    earth: Float32Array.from(earth, (x) => x / steps),
    earthAny: Float32Array.from(earthAny, (x) => x / steps),
    steps,
  };
}
