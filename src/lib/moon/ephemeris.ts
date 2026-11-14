/**
 * Sun / Earth topocentric geometry for a lunar surface point (isomorphic; astronomy-engine only).
 *
 * Moon body-fixed frame: IAU 2015 rotation model via `RotationAxis(Body.Moon, t)`:
 *   n = pole (EQJ), node Q = normalize(z_EQJ x n), prime meridian x_b = Q cos W + (n x Q) sin W,
 *   y_b = n x x_b, z_b = n. The IAU model approximates the Mean Earth/Polar Axis frame used by LOLA
 *   and JPL Horizons' MEAN_ME; it reproduces Horizons to < 0.005 deg (see ephemeris.test.ts).
 * Positions: `BackdatePosition(t, Moon, body, aberration=true)` = apparent vector from the Moon's
 * centre (light-time + stellar aberration for the Moon's barycentric velocity), then the observer's
 * surface offset is subtracted (topocentric parallax: ~0.26 deg for Earth, negligible for the Sun).
 */
import { AstroTime, BackdatePosition, Body, KM_PER_AU, RotationAxis } from "astronomy-engine";
import {
  DEG,
  MOON_RADIUS_M,
  RAD,
  bodyToRegion,
  gridBasis,
  latLonToUnit,
  normalize,
  regionBasis,
  wrap360,
  type Vec3,
} from "./frames";
import type { RegionMeta } from "./types";

export type CelestialBody = "sun" | "earth";

/** Radii used for apparent disc size (km): IAU nominal solar radius, Earth equatorial radius. */
export const BODY_RADIUS_KM: Record<CelestialBody, number> = { sun: 695_700, earth: 6_378.137 };

/** Sun and Earth apparent positions (km) from the Moon's centre, in the Moon body-fixed frame. */
export interface MoonEphemeris {
  sun: Vec3;
  earth: Vec3;
}

function toBodyFixed(v: { x: number; y: number; z: number }, t: AstroTime): Vec3 {
  const axis = RotationAxis(Body.Moon, t);
  const n: Vec3 = [axis.north.x, axis.north.y, axis.north.z];
  const q = normalize([-n[1], n[0], 0]); // z_EQJ x n
  const nq: Vec3 = [n[1] * q[2] - n[2] * q[1], n[2] * q[0] - n[0] * q[2], n[0] * q[1] - n[1] * q[0]];
  const w = axis.spin * DEG;
  const cw = Math.cos(w);
  const sw = Math.sin(w);
  const xb: Vec3 = [q[0] * cw + nq[0] * sw, q[1] * cw + nq[1] * sw, q[2] * cw + nq[2] * sw];
  const yb: Vec3 = [n[1] * xb[2] - n[2] * xb[1], n[2] * xb[0] - n[0] * xb[2], n[0] * xb[1] - n[1] * xb[0]];
  return [
    (v.x * xb[0] + v.y * xb[1] + v.z * xb[2]) * KM_PER_AU,
    (v.x * yb[0] + v.y * yb[1] + v.z * yb[2]) * KM_PER_AU,
    (v.x * n[0] + v.y * n[1] + v.z * n[2]) * KM_PER_AU,
  ];
}

/** Body-fixed apparent Sun and Earth positions at `date` (one call per time step; reuse it). */
export function moonEphemeris(date: Date): MoonEphemeris {
  const t = new AstroTime(date);
  return {
    sun: toBodyFixed(BackdatePosition(t, Body.Moon, Body.Sun, true), t),
    earth: toBodyFixed(BackdatePosition(t, Body.Moon, Body.Earth, true), t),
  };
}

/** Topocentric vector (km) from a surface point (body-fixed unit `up`, radius in km). */
function topocentric(eph: MoonEphemeris, body: CelestialBody, up: Vec3, radiusKm: number): Vec3 {
  const p = eph[body];
  return [p[0] - up[0] * radiusKm, p[1] - up[1] * radiusKm, p[2] - up[2] * radiusKm];
}

export interface AltAz {
  elevationDeg: number;
  /** true azimuth, from north clockwise (deg, [0, 360)) */
  azimuthDeg: number;
  distanceKm: number;
  angularRadiusDeg: number;
}

/** Airless topocentric alt/az of the Sun or Earth from a point on the sphere (no terrain). */
export function bodyAltAzFromEphemeris(
  eph: MoonEphemeris,
  body: CelestialBody,
  latDeg: number,
  lonDeg: number,
  heightM = 0,
): AltAz {
  const up = latLonToUnit(latDeg, lonDeg);
  const v = topocentric(eph, body, up, (MOON_RADIUS_M + heightM) / 1000);
  const lo = lonDeg * DEG;
  const la = latDeg * DEG;
  const east = -v[0] * Math.sin(lo) + v[1] * Math.cos(lo);
  const north = -v[0] * Math.sin(la) * Math.cos(lo) - v[1] * Math.sin(la) * Math.sin(lo) + v[2] * Math.cos(la);
  const u = v[0] * up[0] + v[1] * up[1] + v[2] * up[2];
  const d = Math.hypot(v[0], v[1], v[2]);
  return {
    elevationDeg: Math.asin(u / d) * RAD,
    azimuthDeg: wrap360(Math.atan2(east, north) * RAD),
    distanceKm: d,
    angularRadiusDeg: Math.asin(BODY_RADIUS_KM[body] / d) * RAD,
  };
}

export function bodyAltAz(body: CelestialBody, date: Date, latDeg: number, lonDeg: number, heightM = 0): AltAz {
  return bodyAltAzFromEphemeris(moonEphemeris(date), body, latDeg, lonDeg, heightM);
}

export interface RegionBodyVector {
  /** unit vector in the region frame (x = grid east, y = grid north, z = up at region centre) */
  v: Vec3;
  distanceKm: number;
  angularRadiusDeg: number;
}

/** Topocentric body direction from the region centre surface point, in the region frame. */
export function bodyVectorRegionFromEphemeris(
  eph: MoonEphemeris,
  body: CelestialBody,
  meta: Pick<RegionMeta, "center">,
): RegionBodyVector {
  const basis = regionBasis(meta);
  const t = topocentric(eph, body, basis.ez, MOON_RADIUS_M / 1000);
  const d = Math.hypot(t[0], t[1], t[2]);
  const v = bodyToRegion([t[0] / d, t[1] / d, t[2] / d], basis);
  return { v, distanceKm: d, angularRadiusDeg: Math.asin(BODY_RADIUS_KM[body] / d) * RAD };
}

export function bodyVectorRegion(body: CelestialBody, date: Date, meta: Pick<RegionMeta, "center">): Vec3 {
  return bodyVectorRegionFromEphemeris(moonEphemeris(date), body, meta).v;
}

/**
 * Elevation and grid azimuth of a region-frame direction `v` (from `bodyVectorRegion`) seen from the
 * local point (x, y) metres. GLSL-portable; R = 1737400, (X0, Y0) = meta.center.X/Y:
 *
 *   ax = x / R,  ay = y / R
 *   sinEl  = (v.x * ax + v.y * ay + v.z) / sqrt(1 + ax*ax + ay*ay)   -> elevation = asin(sinEl)
 *   east   = v.x - ax * v.z,   north = v.y - ay * v.z
 *   gamma  = (Y0 * x - X0 * y) / (2 R^2)                             (radians)
 *   gridAz = atan2(east, north) + gamma                              (GLSL: atan(east, north))
 *
 * i.e. up_p = normalize(x/R, y/R, 1), grid east/north tilted by the same small rotation, plus the
 * stereographic grid convergence gamma (the projection's metric scale k = 1 + rho^2/4R^2 rotates the
 * grid by up to 0.035 deg over 30 km at Malapert; ~0.003 deg near the pole). Neglected: second-order
 * tilt terms and the Earth parallax of the offset (30 km / 384400 km). Measured against the exact
 * per-point computation for |x|, |y| <= 30 km (ephemeris.test.ts): elevation error < 0.003 deg,
 * azimuth error < 0.015 deg for bodies above -10 deg (worst at the corners, Earth parallax + 2nd order).
 */
export function altAzAtLocalPoint(
  v: Vec3,
  x: number,
  y: number,
  meta: Pick<RegionMeta, "center">,
): { elevationDeg: number; gridAzimuthDeg: number } {
  const ax = x / MOON_RADIUS_M;
  const ay = y / MOON_RADIUS_M;
  const sinEl = (v[0] * ax + v[1] * ay + v[2]) / Math.sqrt(1 + ax * ax + ay * ay);
  const gamma = (meta.center.Y * x - meta.center.X * y) / (2 * MOON_RADIUS_M * MOON_RADIUS_M);
  return {
    elevationDeg: Math.asin(Math.max(-1, Math.min(1, sinEl))) * RAD,
    gridAzimuthDeg: wrap360((Math.atan2(v[0] - ax * v[2], v[1] - ay * v[2]) + gamma) * RAD),
  };
}

/**
 * Exact elevation and grid azimuth of `body` from the local point (x, y) (topocentric at that point,
 * exact vertical and exact stereographic grid directions). Used by tests and the offline precompute.
 */
export function altAzAtLocalPointExact(
  eph: MoonEphemeris,
  body: CelestialBody,
  x: number,
  y: number,
  meta: Pick<RegionMeta, "center">,
  heightM = 0,
): { elevationDeg: number; gridAzimuthDeg: number } {
  const b = gridBasis(meta.center.X + x, meta.center.Y + y);
  const t = topocentric(eph, body, b.up, (MOON_RADIUS_M + heightM) / 1000);
  const e = t[0] * b.ex[0] + t[1] * b.ex[1] + t[2] * b.ex[2];
  const n = t[0] * b.ey[0] + t[1] * b.ey[1] + t[2] * b.ey[2];
  const u = t[0] * b.up[0] + t[1] * b.up[1] + t[2] * b.up[2];
  return {
    elevationDeg: Math.atan2(u, Math.hypot(e, n)) * RAD,
    gridAzimuthDeg: wrap360(Math.atan2(e, n) * RAD),
  };
}
