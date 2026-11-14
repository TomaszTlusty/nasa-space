import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "bun";
import {
  averageGrid,
  discVisibleFraction,
  horizonAt,
  type LoadedRegion,
  loadRegion,
  nextTransition,
  timeline,
  windows,
} from "./horizon";

const PUBLIC = `${import.meta.dir}/../../../public`;
let server: Server<undefined>;
let shackleton: LoadedRegion;

beforeAll(async () => {
  server = Bun.serve({
    port: 0,
    fetch: (req) => new Response(Bun.file(PUBLIC + new URL(req.url).pathname)),
  });
  shackleton = await loadRegion(
    `http://localhost:${server.port}`,
    "shackleton",
  );
});
afterAll(() => server.stop(true));

const mean = (a: Float32Array) => a.reduce((x, y) => x + y, 0) / a.length;

describe("discVisibleFraction", () => {
  test("limits and symmetry", () => {
    expect(discVisibleFraction(1, 0, 0.25)).toBe(1);
    expect(discVisibleFraction(-1, 0, 0.25)).toBe(0);
    expect(discVisibleFraction(0, 0, 0.25)).toBeCloseTo(0.5, 12);
    expect(
      discVisibleFraction(0.1, 0, 0.25) + discVisibleFraction(-0.1, 0, 0.25),
    ).toBeCloseTo(1, 12);
  });
  test("matches numerical integration", () => {
    const d = 0.3;
    const N = 4000;
    let above = 0;
    let total = 0;
    for (let i = 0; i < N; i++) {
      const y = -1 + ((i + 0.5) / N) * 2; // height on the unit disc relative to its centre
      const w = Math.sqrt(1 - y * y);
      total += w;
      if (y > -d) above += w;
    }
    expect(discVisibleFraction(d, 0, 1)).toBeCloseTo(above / total, 3);
  });
});

describe("region runtime", () => {
  test("horizonAt follows the exact site profile at low-slope sites", () => {
    // The 160 m grid smooths sharp rims / crests (sites sit on local optima), so only the smooth
    // crater floor and the ridge top C1 (~20 m from a node) are expected to agree closely.
    for (const id of ["shackleton-floor", "c1"]) {
      const site = shackleton.meta.sites.find((s) => s.id === id)!;
      const prof = site.horizons.find((h) => h.mastHeight === 2)!.values;
      let err = 0;
      for (let k = 0; k < 720; k += 4)
        err += Math.abs(horizonAt(shackleton, site.x, site.y, k / 2) - prof[k]);
      expect(err / 180).toBeLessThan(1.0);
    }
  });

  test("Shackleton floor: no sunlight over a year", () => {
    const tl = timeline(
      shackleton,
      { siteId: "shackleton-floor", mastHeight: 2 },
      new Date("2027-01-01T00:00:00Z"),
      24 * 365,
      360,
    );
    expect(Math.max(...tl.sunFraction)).toBe(0);
  });

  test("Connecting Ridge C1 at 2 m: long-run illumination near Glaser 2018 (88 %)", () => {
    const tl = timeline(
      shackleton,
      { siteId: "c1", mastHeight: 2 },
      new Date("2017-01-01T00:00:00Z"),
      24 * 365 * 4,
      360,
    );
    const m = mean(tl.sunFraction);
    console.log(
      `C1 2 m mean solar disc visibility 2017-2021: ${(m * 100).toFixed(1)} %`,
    );
    expect(Math.abs(m - 0.88)).toBeLessThan(0.08);
  });

  test("windows and nextTransition agree", () => {
    const point = { siteId: "c1", mastHeight: 2 };
    const start = new Date("2027-01-01T00:00:00Z");
    const tl = timeline(shackleton, point, start, 24 * 30, 10);
    const ws = windows(tl.times, tl.earthFraction, 0);
    const tr = nextTransition(shackleton, point, start, "earth");
    expect(ws.length).toBeGreaterThan(0);
    expect(tr).not.toBeNull();
    const firstEdge = ws[0].openStart ? ws[0].endMs : ws[0].startMs;
    expect(Math.abs(tr!.date.getTime() - firstEdge)).toBeLessThan(15 * 60_000);
    expect(tr!.kind).toBe(ws[0].openStart ? "set" : "rise");
  });

  test("averageGrid equals the per-node timeline mean", () => {
    const start = new Date("2027-03-01T00:00:00Z");
    const avg = averageGrid(shackleton, start, 24 * 20, 4);
    const g = shackleton.meta.horizon;
    for (const [c, r] of [
      [10, 20],
      [128, 128],
      [200, 60],
      [250, 240],
      [90, 170],
    ]) {
      const tl = timeline(
        shackleton,
        { x: g.x0 + c * g.step, y: g.y0 + r * g.step },
        start,
        24 * 20 - 4,
        240,
      );
      expect(
        Math.abs(avg.sun[r * g.width + c] - mean(tl.sunFraction)),
      ).toBeLessThan(0.002);
      expect(
        Math.abs(avg.earth[r * g.width + c] - mean(tl.earthFraction)),
      ).toBeLessThan(0.002);
    }
  });

  test("averageGrid speed (360 steps)", () => {
    averageGrid(shackleton, new Date("2027-01-01T00:00:00Z"), 24, 2); // warm-up (JIT)
    const t = performance.now();
    const avg = averageGrid(
      shackleton,
      new Date("2027-01-01T00:00:00Z"),
      360 * 2,
      2,
    );
    const ms = performance.now() - t;
    console.log(
      `averageGrid 360 steps x ${avg.sun.length} nodes: ${ms.toFixed(0)} ms`,
    );
    expect(avg.steps).toBe(360);
    expect(ms).toBeLessThan(600);
  });
});
