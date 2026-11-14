import { describe, expect, test } from "bun:test";
import { altAzAtLocalPoint, altAzAtLocalPointExact, bodyAltAz, bodyVectorRegionFromEphemeris, moonEphemeris } from "./ephemeris";
import { latLonToPolar } from "./frames";

/**
 * JPL Horizons fixtures (fetched 2026-11-14 from https://ssd.jpl.nasa.gov/api/horizons.api with
 * CENTER='coord@301', COORD_TYPE='GEODETIC', QUANTITIES='4', ANG_FORMAT='DEG', EXTRA_PREC='YES').
 * Apparent airless az/el, MEAN_ME frame, R = 1737.4 km. Site = E-longitude, latitude, alt 0.
 */
export const HORIZONS_FIXTURES = [
  { body: "sun", lonE: 0, lat: -89.5, utc: "2026-11-14T00:00:00Z", az: 126.627332945, el: 1.25833464 },
  { body: "earth", lonE: 225, lat: -89.45, utc: "2026-11-14T00:00:00Z", az: 133.740725833, el: -5.0285092 },
  { body: "sun", lonE: 359.7642, lat: -85.9948, utc: "2027-03-01T12:00:00Z", az: 259.723530559, el: -1.296969175 },
  { body: "earth", lonE: 359.7642, lat: -85.9948, utc: "2027-03-01T12:00:00Z", az: 3.668698597, el: -1.884230386 },
  { body: "sun", lonE: 30, lat: -45, utc: "2026-12-01T06:00:00Z", az: 252.281167901, el: -14.939850325 },
  { body: "earth", lonE: 30, lat: -45, utc: "2026-12-01T06:00:00Z", az: 329.541046219, el: 38.705744107 },
  { body: "sun", lonE: 222.84, lat: -89.4505, utc: "2027-06-15T18:00:00Z", az: 180.148769682, el: -1.736070621 },
  { body: "earth", lonE: 188.13, lat: -89.7668, utc: "2026-12-20T03:00:00Z", az: 164.715203241, el: 5.791895053 },
  { body: "sun", lonE: 160, lat: 20, utc: "2027-01-10T09:30:00Z", az: 209.376237114, el: 66.364233236 },
  { body: "earth", lonE: 275, lat: -10, utc: "2027-02-05T21:00:00Z", az: 87.318611565, el: 6.254877368 },
] as const;

const angDiff = (a: number, b: number) => ((((a - b) % 360) + 540) % 360) - 180;

describe("bodyAltAz vs JPL Horizons", () => {
  for (const f of HORIZONS_FIXTURES) {
    test(`${f.body} @ ${f.lonE}E ${f.lat} ${f.utc}`, () => {
      const r = bodyAltAz(f.body, new Date(f.utc), f.lat, f.lonE);
      expect(Math.abs(r.elevationDeg - f.el)).toBeLessThanOrEqual(0.01);
      expect(Math.abs(angDiff(r.azimuthDeg, f.az))).toBeLessThanOrEqual(0.01);
    });
  }
});

describe("altAzAtLocalPoint (GLSL approximation) vs exact", () => {
  for (const [name, lat, lon] of [
    ["shackleton", -89.6, -170],
    ["malapert", -85.9948, -0.2358],
  ] as const) {
    test(`${name}: |x|,|y| <= 30 km`, () => {
      const { X, Y } = latLonToPolar(lat, lon);
      const meta = { center: { lat, lon, X, Y } };
      let maxEl = 0;
      let maxAz = 0;
      for (let day = 0; day < 60; day += 1.7) {
        const eph = moonEphemeris(new Date(Date.UTC(2026, 10, 14) + day * 86_400_000));
        for (const body of ["sun", "earth"] as const) {
          const { v } = bodyVectorRegionFromEphemeris(eph, body, meta);
          for (const x of [-30_000, -12_000, 0, 17_000, 30_000])
            for (const y of [-30_000, -5_000, 0, 22_000, 30_000]) {
              const ex = altAzAtLocalPointExact(eph, body, x, y, meta);
              if (ex.elevationDeg < -10) continue;
              const ap = altAzAtLocalPoint(v, x, y, meta);
              maxEl = Math.max(maxEl, Math.abs(ap.elevationDeg - ex.elevationDeg));
              maxAz = Math.max(maxAz, Math.abs(angDiff(ap.gridAzimuthDeg, ex.gridAzimuthDeg)));
            }
        }
      }
      expect(maxEl).toBeLessThan(0.003);
      expect(maxAz).toBeLessThan(0.015);
    });
  }
});
