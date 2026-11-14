import { describe, expect, test } from "bun:test";
import { HORIZONS_FIXTURES } from "../../../scripts/data/horizons-fixtures";
import {
  altAzAtLocalPoint,
  altAzAtLocalPointExact,
  bodyAltAz,
  bodyVectorRegionFromEphemeris,
  moonEphemeris,
} from "./ephemeris";
import { latLonToPolar } from "./frames";

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
