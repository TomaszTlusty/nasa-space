import { analyzeTimeline, bodyTransitions, discover, liveAt, pointTimeline, windowAverage } from "@/lib/analysis/compute";
import type { LoadedRegion } from "@/lib/moon/horizon";
import type { RegionMeta } from "@/lib/moon/types";
import { DEFAULT_POWER } from "@/lib/store";

async function load(id: string): Promise<LoadedRegion> {
  const root = `${import.meta.dir}/../public/regions/${id}`;
  const meta = (await Bun.file(`${root}/meta.json`).json()) as RegionMeta;
  return {
    meta,
    heights: new Float32Array(await Bun.file(`${root}/heights.bin`).arrayBuffer()),
    horizon: new Uint8Array(await Bun.file(`${root}/horizon.bin`).arrayBuffer()),
    slope: new Uint8Array(await Bun.file(`${root}/slope.bin`).arrayBuffer()),
  };
}

const r = await load("shackleton");
const start = Date.UTC(2027, 0, 1);
const t = (label: string, fn: () => unknown) => {
  const t0 = performance.now();
  const v = fn();
  console.log(label, (performance.now() - t0).toFixed(1), "ms");
  return v;
};
for (const site of r.meta.sites) {
  const q = { x: site.x, y: site.y, siteId: site.id, mastHeight: 2 };
  const tl = pointTimeline(r, q, start, 31);
  const a = analyzeTimeline(r, "A", q, tl, DEFAULT_POWER);
  console.log(
    site.id.padEnd(18),
    `sun ${(a.sunMean * 100).toFixed(1)}%`,
    `earth ${(a.earthMean * 100).toFixed(1)}%`,
    `dark ${a.longestDarkHours}h blackout ${a.longestBlackoutHours}h`,
    `elev ${a.elevationM.toFixed(0)} slope ${a.slopeDeg.toFixed(1)}`,
    `minSoc ${a.power.minSocPct.toFixed(0)} depleted ${a.power.depletedAt ? new Date(a.power.depletedAt).toISOString() : "-"} E ${(a.power.energyWh / 1000).toFixed(0)}kWh`,
  );
}
const floorGrid = { x: 8223, y: 3 };
const ridgeGrid = { x: -11030, y: -5618 };
for (const [name, q] of [["floor grid", floorGrid], ["C1 grid", ridgeGrid]] as const) {
  const a = analyzeTimeline(r, "A", q, pointTimeline(r, q, start, 31), DEFAULT_POWER);
  console.log(name, (a.sunMean * 100).toFixed(1), (a.earthMean * 100).toFixed(1), a.longestDarkHours);
}
for (let k = 0; k < 3; k++) t("timeline 30d grid", () => pointTimeline(r, ridgeGrid, start, 30));
for (let k = 0; k < 3; k++) t("timeline 30d site", () => pointTimeline(r, { x: 0, y: 0, siteId: "c1", mastHeight: 2 }, start, 30));
for (let k = 0; k < 3; k++)
  t("analysis 30d", () => analyzeTimeline(r, "A", ridgeGrid, pointTimeline(r, ridgeGrid, start, 30), DEFAULT_POWER));
for (let k = 0; k < 2; k++) t("transitions sun", () => bodyTransitions(r, { siteId: "c1", mastHeight: 2 }, start, "sun"));
for (let k = 0; k < 2; k++) t("transitions earth", () => bodyTransitions(r, { siteId: "c1", mastHeight: 2 }, start, "earth"));
console.log(bodyTransitions(r, { siteId: "c1", mastHeight: 2 }, start, "sun"));
for (let k = 0; k < 3; k++) {
  const w15 = windowAverage(r, start, 15);
  console.log("avg 15d", w15.computeMs.toFixed(0), "ms step", w15.stepHours);
}
for (let k = 0; k < 2; k++) {
  const w30 = windowAverage(r, start, 30);
  console.log("avg 30d", w30.computeMs.toFixed(0), "ms step", w30.stepHours);
}
const avg = windowAverage(r, start, 15);
const res = t("discovery 15d", () => discover(r, avg, { maxSlopeDeg: 10, minSun: 0.6, minEarth: 0.5 }, start, 15));
console.log(res);
for (let k = 0; k < 3; k++) t("liveAt", () => liveAt(r, start, -11030, -5618, { siteId: "c1", mastHeight: 2 }));
