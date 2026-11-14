import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "bun";
import {
  analyzeTimeline,
  type BodyTransitions,
  discoveryScore,
  encodeAverage,
  liveAt,
  longestZeroRunHours,
  pickCandidates,
  pointTimeline,
  stillValid,
  toTransitions,
  transitionsAt,
} from "@/lib/analysis/compute";
import { SOLAR_CONSTANT_W_M2, simulatePower } from "@/lib/analysis/power";
import { type LoadedRegion, loadRegion } from "@/lib/moon/horizon";
import type { PowerPreset } from "@/lib/store";

const HOUR = 3_600_000;
const T0 = Date.UTC(2027, 0, 1);
const preset = (p: Partial<PowerPreset> = {}): PowerPreset => ({
  panelAreaM2: 1,
  efficiency: 1,
  batteryWh: 1000,
  loadW: 100,
  ...p,
});
const filled = (n: number, v: number) => new Float32Array(n).fill(v);

describe("simulatePower", () => {
  test("watts follow S0 · eff · area · fraction · cos(elev)", () => {
    const p = simulatePower([0, 60, 1.5], [1, 0.5, 0], T0, 60, preset({ panelAreaM2: 2, efficiency: 0.25 }));
    expect(p.watts[0]).toBeCloseTo(SOLAR_CONSTANT_W_M2 * 0.5, 3);
    expect(p.watts[1]).toBeCloseTo(SOLAR_CONSTANT_W_M2 * 0.5 * 0.5 * 0.5, 3);
    expect(p.watts[2]).toBe(0);
  });

  test("permanent sun surplus stays clamped at 100 %", () => {
    const p = simulatePower(filled(49, 0), filled(49, 1), T0, 60, preset());
    expect(p.socPct.every((v) => v === 100)).toBe(true);
    expect(p.minSocPct).toBe(100);
    expect(p.depletedAt).toBeNull();
    expect(p.energyWh).toBeCloseTo(SOLAR_CONSTANT_W_M2 * 48, 2);
  });

  test("darkness drains linearly and depletes exactly at battery / load", () => {
    // 1000 Wh at 100 W: empty after 10 h, i.e. at sample 10
    const p = simulatePower(filled(25, 0), filled(25, 0), T0, 60, preset());
    expect(p.socPct[0]).toBe(100);
    expect(p.socPct[5]).toBeCloseTo(50, 4);
    expect(p.socPct[10]).toBeCloseTo(0, 4);
    expect(p.socPct[24]).toBe(0);
    expect(p.minSocPct).toBe(0);
    expect(p.depletedAt).toBe(T0 + 10 * HOUR);
    expect(p.energyWh).toBe(0);
  });

  test("depletion time is interpolated inside a step", () => {
    // 2-hour steps, 250 Wh battery, 100 W load: empty after 2.5 h
    const p = simulatePower(filled(4, 0), filled(4, 0), T0, 120, preset({ batteryWh: 250 }));
    expect(p.depletedAt).toBeCloseTo(T0 + 2.5 * HOUR, -1);
  });

  test("recharges after a blackout; depletedAt keeps the first empty instant", () => {
    const n = 30;
    const frac = new Float32Array(n);
    for (let i = 15; i < n; i++) frac[i] = 1; // dark 0..14 h, lit afterwards (1361 W vs 100 W load)
    const p = simulatePower(filled(n, 0), frac, T0, 60, preset());
    expect(p.depletedAt).toBe(T0 + 10 * HOUR);
    expect(p.socPct[14]).toBe(0);
    expect(p.socPct[15]).toBeGreaterThan(0);
    expect(p.socPct[n - 1]).toBe(100);
    expect(p.minSocPct).toBe(0);
  });

  test("degenerate inputs: empty series, zero battery, zero load", () => {
    const empty = simulatePower([], [], T0, 60, preset());
    expect(empty.watts.length).toBe(0);
    expect(empty.depletedAt).toBeNull();
    expect(empty.energyWh).toBe(0);
    const noBattery = simulatePower(filled(3, 0), filled(3, 0), T0, 60, preset({ batteryWh: 0 }));
    expect(noBattery.socPct[1]).toBe(0);
    expect(noBattery.depletedAt).toBeGreaterThanOrEqual(T0);
    expect(noBattery.depletedAt).toBeLessThanOrEqual(T0 + HOUR);
    const noLoad = simulatePower(filled(5, 0), filled(5, 0), T0, 60, preset({ loadW: 0 }));
    expect(noLoad.minSocPct).toBe(100);
    expect(noLoad.depletedAt).toBeNull();
  });
});

describe("longestZeroRunHours", () => {
  // samples are step intervals [t, t + step); the last sample is the window's closing endpoint
  test("runs at the start, middle and end", () => {
    expect(longestZeroRunHours([0, 0, 0, 1, 0, 1], 60)).toBe(3);
    expect(longestZeroRunHours([1, 0, 0, 0, 0, 1, 0], 60)).toBe(4);
    expect(longestZeroRunHours([1, 0, 1, 0, 0, 0], 60)).toBe(2);
  });
  test("all lit, all dark, empty, and non-hourly steps", () => {
    expect(longestZeroRunHours([0.1, 1, 0.01], 60)).toBe(0);
    // a 9-hour window has 10 samples: never more darkness than the window itself
    expect(longestZeroRunHours(new Float32Array(10), 60)).toBe(9);
    expect(longestZeroRunHours([], 60)).toBe(0);
    expect(longestZeroRunHours([0, 0, 0], 120)).toBe(4);
  });
  test("a partially visible disc counts as light", () => {
    expect(longestZeroRunHours([0, 1e-6, 0, 0, 1], 60)).toBe(2);
  });
});

describe("transitions bookkeeping", () => {
  const up: BodyTransitions = {
    from: T0,
    up: true,
    first: T0 + 5 * HOUR,
    second: T0 + 50 * HOUR,
  };
  const down: BodyTransitions = {
    from: T0,
    up: false,
    first: T0 + 3 * HOUR,
    second: T0 + 40 * HOUR,
  };
  test("maps first/second to set/rise by state", () => {
    const t = toTransitions(up, down, T0);
    expect(t).toEqual({
      from: T0,
      sunUp: true,
      earthUp: false,
      sunset: T0 + 5 * HOUR,
      sunrise: T0 + 50 * HOUR,
      earthset: T0 + 40 * HOUR,
      earthrise: T0 + 3 * HOUR,
    });
  });
  test("cache validity", () => {
    expect(stillValid(up, T0 + 4 * HOUR)).toBe(true);
    expect(stillValid(up, T0 + 5 * HOUR)).toBe(false);
    expect(stillValid(up, T0 - 1)).toBe(false);
    const none: BodyTransitions = {
      from: T0,
      up: true,
      first: null,
      second: null,
    };
    expect(stillValid(none, T0 + 23 * HOUR)).toBe(true);
    expect(stillValid(none, T0 + 25 * HOUR)).toBe(false);
  });
  test("re-basing onto the playhead", () => {
    const t = toTransitions(up, down, T0);
    expect(transitionsAt(t, T0 + 2 * HOUR, true, false)).toEqual({ ...t, from: T0 + 2 * HOUR });
    // playhead before the search start, past an event, or live state disagreeing: stale
    expect(transitionsAt(t, T0 - HOUR, true, false)).toBeNull();
    expect(transitionsAt(t, T0 + 3 * HOUR, true, false)).toBeNull();
    expect(transitionsAt(t, T0 + 2 * HOUR, false, false)).toBeNull();
    expect(transitionsAt(t, T0 + 2 * HOUR, true, true)).toBeNull();
    const none = toTransitions({ from: T0, up: true, first: null, second: null }, up, T0);
    expect(transitionsAt(none, T0 + 4 * HOUR, true, true)).not.toBeNull();
    expect(transitionsAt(none, T0 + 4 * HOUR + 86_400_000, true, true)).toBeNull();
  });
});

describe("discovery picking", () => {
  const grid = { width: 4, height: 1, x0: 0, y0: 0, step: 500 };
  test("criteria filter, score order and non-maximum suppression", () => {
    const sun = [0.9, 0.95, 0.5, 0.8];
    const earth = [0.6, 0.6, 0.9, 0.6];
    const slope = [2, 2, 2, 20];
    const picks = pickCandidates(grid, sun, earth, slope, { maxSlopeDeg: 10, minSun: 0.6, minEarth: 0.5 }, 5, 1200);
    // node 2 fails minSun, node 3 fails slope, node 0 is 500 m from the better node 1
    expect(picks.map((p) => p.i)).toEqual([1]);
    expect(picks[0].score).toBeCloseTo(discoveryScore(0.95, 0.6, 2, 10), 12);
    expect(
      pickCandidates(grid, sun, earth, slope, { maxSlopeDeg: 10, minSun: 0.6, minEarth: 0.5 }, 5, 400).length,
    ).toBe(2);
  });
  test("score weights", () => {
    expect(discoveryScore(1, 1, 0, 10)).toBeCloseTo(1, 12);
    expect(discoveryScore(0, 0, 10, 10)).toBe(0);
    expect(discoveryScore(0.6, 0.4, 5, 10)).toBeCloseTo(0.3 + 0.14 + 0.075, 12);
  });
  test("RGBA8 encoding", () => {
    const rgba = encodeAverage(Float32Array.of(0, 0.5, 1), Float32Array.of(1, 0.25, 0));
    expect([...rgba]).toEqual([0, 255, 0, 255, 128, 64, 0, 255, 255, 0, 0, 255]);
  });
});

describe("Shackleton point analysis (real data)", () => {
  const PUBLIC = `${import.meta.dir}/../../../public`;
  let server: Server<undefined>;
  let shackleton: LoadedRegion;
  beforeAll(async () => {
    server = Bun.serve({
      port: 0,
      fetch: (req) => new Response(Bun.file(PUBLIC + new URL(req.url).pathname)),
    });
    shackleton = await loadRegion(`http://localhost:${server.port}`, "shackleton");
  });
  afterAll(() => server.stop(true));

  test("Connecting Ridge C1 is lit, the crater floor is dark (Jan 2027)", () => {
    const sites = shackleton.meta.sites;
    const c1 = sites.find((s) => s.id === "c1");
    const floor = sites.find((s) => s.id === "shackleton-floor");
    if (!c1 || !floor) throw new Error("Shackleton sites missing");
    const power = preset({
      panelAreaM2: 4,
      efficiency: 0.28,
      batteryWh: 3000,
      loadW: 150,
    });
    const ridgeQ = { x: c1.x, y: c1.y, siteId: "c1", mastHeight: 2 };
    const floorQ = { x: floor.x, y: floor.y };
    const ridge = analyzeTimeline(shackleton, "A", ridgeQ, pointTimeline(shackleton, ridgeQ, T0, 30), power);
    const crater = analyzeTimeline(shackleton, "B", floorQ, pointTimeline(shackleton, floorQ, T0, 30), power);
    expect(ridge.sunMean).toBeGreaterThan(0.8);
    expect(ridge.sunAny).toBeGreaterThanOrEqual(ridge.sunMean);
    expect(ridge.power.depletedAt).toBeNull();
    expect(crater.sunMean).toBeLessThan(0.02);
    expect(crater.sunAny).toBeLessThan(0.05);
    expect(crater.longestDarkHours).toBeGreaterThan(700);
    expect(crater.longestDarkHours).toBeLessThanOrEqual(30 * 24);
    expect(crater.longestBlackoutHours).toBeLessThanOrEqual(30 * 24);
    expect(crater.power.depletedAt).toBe(T0 + 20 * HOUR);
    expect(ridge.series.sunFraction.length).toBe(30 * 24 + 1);
    expect(ridge.lat).toBeLessThan(-89);
  });

  test("liveAt agrees with the timeline", () => {
    const tl = pointTimeline(shackleton, { x: -11030, y: -5618 }, T0, 1);
    const live = liveAt(shackleton, T0 + 6 * HOUR, -11030, -5618);
    expect(live.sunVis).toBeCloseTo(tl.sunFraction[6], 5);
    expect(live.earthElev).toBeCloseTo(tl.earthElev[6], 3);
    expect(live.sunAz).toBeCloseTo(tl.sunAz[6], 3);
  });
});
