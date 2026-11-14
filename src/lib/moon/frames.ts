/**
 * Coordinate frames and projections (isomorphic, no Node APIs). Conventions: see `types.ts` header.
 *
 * Body-fixed frame (Mean Earth / Polar Axis): +x toward (lat 0, lon 0), +y toward (lat 0, lon 90E),
 * +z toward the north pole. Unit vectors on the sphere are written `q`.
 *
 * LOLA south polar stereographic (centre lon 0, true scale at the pole):
 *   rho = 2R tan(pi/4 + lat/2),  X = rho sin(lon),  Y = rho cos(lon)
 * which, for a unit vector q, reduces to the cheap closed form
 *   X = 2R qy / (1 - qz),  Y = 2R qx / (1 - qz)
 * and its inverse (u = Y / 2R, v = X / 2R, r2 = u^2 + v^2)
 *   qx = 2u / (1 + r2),  qy = 2v / (1 + r2),  qz = (r2 - 1) / (1 + r2).
 *
 * Region frame: x = X - X0, y = Y - Y0, z = up at the region centre. Its 3D basis (body-fixed) is
 *   ex = normalize(dq/dX), ey = normalize(dq/dY), ez = q0  (right-handed: ex x ey = ez).
 *
 * Grid azimuth vs true azimuth at a point of longitude lon: true north points away from the pole,
 * i.e. along (sin lon, cos lon) in (X, Y), so  gridAz = trueAz + lon  (mod 360).
 */
import type { RegionMeta } from "./types";

export const MOON_RADIUS_M = 1_737_400;
export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

export type Vec3 = [number, number, number];

export function normLon(lon: number): number {
  let l = ((lon % 360) + 360) % 360; // [0, 360)
  if (l > 180) l -= 360; // (-180, 180]
  return l;
}

export function wrap360(a: number): number {
  return ((a % 360) + 360) % 360;
}

/** Polar stereographic forward: lat/lon (deg) -> X, Y (m). */
export function latLonToPolar(
  latDeg: number,
  lonDeg: number,
  R = MOON_RADIUS_M,
): { X: number; Y: number } {
  const rho = 2 * R * Math.tan(Math.PI / 4 + (latDeg * DEG) / 2);
  return { X: rho * Math.sin(lonDeg * DEG), Y: rho * Math.cos(lonDeg * DEG) };
}

/** Polar stereographic inverse: X, Y (m) -> lat/lon (deg, lon normalised to (-180, 180]). */
export function polarToLatLon(
  X: number,
  Y: number,
  R = MOON_RADIUS_M,
): { lat: number; lon: number } {
  const rho = Math.hypot(X, Y);
  const lat = (2 * Math.atan(rho / (2 * R)) - Math.PI / 2) * RAD;
  const lon = rho === 0 ? 0 : normLon(Math.atan2(X, Y) * RAD);
  return { lat, lon };
}

/** Unit body-fixed vector of lat/lon (deg). */
export function latLonToUnit(latDeg: number, lonDeg: number): Vec3 {
  const la = latDeg * DEG;
  const lo = lonDeg * DEG;
  const c = Math.cos(la);
  return [c * Math.cos(lo), c * Math.sin(lo), Math.sin(la)];
}

/** Body-fixed XYZ (m) of lat/lon/height (height relative to R). */
export function latLonToXYZ(
  latDeg: number,
  lonDeg: number,
  heightM = 0,
  R = MOON_RADIUS_M,
): Vec3 {
  const u = latLonToUnit(latDeg, lonDeg);
  const r = R + heightM;
  return [u[0] * r, u[1] * r, u[2] * r];
}

export function xyzToLatLon(v: Vec3): {
  lat: number;
  lon: number;
  radius: number;
} {
  const r = Math.hypot(v[0], v[1], v[2]);
  return {
    lat: Math.asin(v[2] / r) * RAD,
    lon: normLon(Math.atan2(v[1], v[0]) * RAD),
    radius: r,
  };
}

/** Unit vector -> polar stereographic X, Y (m). */
export function unitToPolar(
  q: Vec3,
  R = MOON_RADIUS_M,
): { X: number; Y: number } {
  const k = (2 * R) / (1 - q[2]);
  return { X: k * q[1], Y: k * q[0] };
}

/** Polar stereographic X, Y (m) -> unit vector. */
export function polarToUnit(X: number, Y: number, R = MOON_RADIUS_M): Vec3 {
  const u = Y / (2 * R);
  const v = X / (2 * R);
  const r2 = u * u + v * v;
  const d = 1 / (1 + r2);
  return [2 * u * d, 2 * v * d, (r2 - 1) * d];
}

/**
 * Orthonormal grid-aligned tangent basis at a projected point: east-of-grid (dq/dX), north-of-grid
 * (dq/dY), up (q). Exact derivatives of `polarToUnit`.
 */
export function gridBasis(
  X: number,
  Y: number,
  R = MOON_RADIUS_M,
): { ex: Vec3; ey: Vec3; up: Vec3 } {
  const u = Y / (2 * R);
  const v = X / (2 * R);
  const r2 = u * u + v * v;
  const d = 1 / (1 + r2);
  // q = (2u d, 2v d, (r2-1) d); d' wrt u = -2u d^2
  // dq/du = (2d - 4u^2 d^2, -4uv d^2, 2u d - (r2-1) 2u d^2) = (.., .., 4u d^2)
  const dqu: Vec3 = [
    2 * d - 4 * u * u * d * d,
    -4 * u * v * d * d,
    4 * u * d * d,
  ];
  const dqv: Vec3 = [
    -4 * u * v * d * d,
    2 * d - 4 * v * v * d * d,
    4 * v * d * d,
  ];
  return {
    ex: normalize(dqv),
    ey: normalize(dqu),
    up: [2 * u * d, 2 * v * d, (r2 - 1) * d],
  };
}

/** Local stereographic scale factor (projected metres per surface metre) at (X, Y). */
export function polarScale(X: number, Y: number, R = MOON_RADIUS_M): number {
  return 1 + (X * X + Y * Y) / (4 * R * R);
}

export function normalize(v: Vec3): Vec3 {
  const n = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / n, v[1] / n, v[2] / n];
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

type CenterLike = Pick<RegionMeta, "center">;

/** lat/lon -> region local (x, y) metres. */
export function toLocal(
  latDeg: number,
  lonDeg: number,
  meta: CenterLike,
): { x: number; y: number } {
  const { X, Y } = latLonToPolar(latDeg, lonDeg);
  return { x: X - meta.center.X, y: Y - meta.center.Y };
}

/** Region local (x, y) metres -> lat/lon. */
export function fromLocal(
  x: number,
  y: number,
  meta: CenterLike,
): { lat: number; lon: number } {
  return polarToLatLon(x + meta.center.X, y + meta.center.Y);
}

/** Region frame basis (body-fixed unit vectors of local +x, +y, +z at the region centre). */
export function regionBasis(meta: CenterLike): {
  ex: Vec3;
  ey: Vec3;
  ez: Vec3;
} {
  const b = gridBasis(meta.center.X, meta.center.Y);
  return { ex: b.ex, ey: b.ey, ez: b.up };
}

/** Body-fixed vector -> region frame components. */
export function bodyToRegion(
  v: Vec3,
  basis: { ex: Vec3; ey: Vec3; ez: Vec3 },
): Vec3 {
  return [dot(v, basis.ex), dot(v, basis.ey), dot(v, basis.ez)];
}

/** True azimuth (from north, clockwise) -> grid azimuth at longitude lon. */
export function trueToGridAz(trueAzDeg: number, lonDeg: number): number {
  return wrap360(trueAzDeg + lonDeg);
}

/** Grid azimuth -> true azimuth at longitude lon. */
export function gridToTrueAz(gridAzDeg: number, lonDeg: number): number {
  return wrap360(gridAzDeg - lonDeg);
}

/** Grid azimuth (deg) of a direction vector (dx, dy) in the region / projection plane. */
export function gridAzimuthOf(dx: number, dy: number): number {
  return wrap360(Math.atan2(dx, dy) * RAD);
}

/** Unit direction (dx, dy) in the projection plane for a grid azimuth (deg). */
export function gridDirection(gridAzDeg: number): { dx: number; dy: number } {
  return { dx: Math.sin(gridAzDeg * DEG), dy: Math.cos(gridAzDeg * DEG) };
}
