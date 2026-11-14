/**
 * Validation: `bun run data:validate` -> public/validation.json (ValidationReport)
 * (a) long-run Sun / Earth visibility vs Mazarico et al. AVGVISIB_85S_060M (Sun + Earth),
 * (b) topocentric Sun / Earth az/el vs JPL Horizons fixtures.
 */
import {
  bodyAltAz,
  bodyAltAzFromEphemeris,
  type MoonEphemeris,
  moonEphemeris,
} from "../../src/lib/moon/ephemeris";
import {
  normLon,
  polarToLatLon,
  trueToGridAz,
} from "../../src/lib/moon/frames";
import { discVisibleFraction, profileAt } from "../../src/lib/moon/horizon";
import type { RegionMeta, ValidationReport } from "../../src/lib/moon/types";
import { EXTENT, HORIZON_N } from "./build";
import { MultiDem, RAW_DIR } from "./dem";
import { HORIZONS_FIXTURES } from "./horizons-fixtures";
import { loadPolarRaster, rasterBilinear, rasterContains } from "./pds";
import { HorizonPool } from "./pool";
import { REGIONS } from "./regions";

const START = Date.UTC(2016, 7, 1); // 2016-08-01
const END = Date.UTC(2035, 2, 1); // 2035-03-01 (18.6-year lunar nodal cycle)
const STEP_H = 3;
const AZ_BINS = 720;
const NODES_PER_SIDE = 8; // 64 stratified nodes per region
const MASTS = [0, 2];
/** Mazarico et al. 2011 computed horizons at the DEM surface [inference: no extra height in the LBL]. */
const MAZARICO_MAST = 0;

const t0 = performance.now();
const dem = await MultiDem.load();
const maxHeight = dem.maxHeight();
const pool = await HorizonPool.create(dem, maxHeight);
const sunRef = await loadPolarRaster(
  RAW_DIR,
  "AVGVISIB_85S_060M_201608",
  false,
);
const earthRef = await loadPolarRaster(
  RAW_DIR,
  "AVGVISIB_85S_060M_201608_EARTH",
  false,
);

const ephs: MoonEphemeris[] = [];
for (let t = START; t < END; t += STEP_H * 3_600_000)
  ephs.push(moonEphemeris(new Date(t)));
console.log(
  `ephemeris: ${ephs.length} steps (${STEP_H} h) in ${((performance.now() - t0) / 1000).toFixed(1)} s`,
);

/** deterministic jittered stratified nodes on the region's horizon grid */
function sampleNodes(seed: number): { c: number; r: number }[] {
  let s = seed;
  const rand = () => {
    s = (s * 1_103_515_245 + 12_345) % 2 ** 31;
    return s / 2 ** 31;
  };
  const cell = (HORIZON_N - 1) / NODES_PER_SIDE;
  const out: { c: number; r: number }[] = [];
  for (let j = 0; j < NODES_PER_SIDE; j++)
    for (let i = 0; i < NODES_PER_SIDE; i++)
      out.push({
        c: Math.floor((i + rand()) * cell),
        r: Math.floor((j + rand()) * cell),
      });
  return out;
}

interface NodeResult {
  lat: number;
  lon: number;
  refSun: number;
  refEarth: number;
  sunAny: number[];
  sunFrac: number[];
  earthAny: number[];
}

function longRun(lat: number, lon: number, profile: Float32Array) {
  let sunAny = 0;
  let sunFrac = 0;
  let earthAny = 0;
  for (const eph of ephs) {
    const s = bodyAltAzFromEphemeris(eph, "sun", lat, lon);
    const hs = profileAt(profile, trueToGridAz(s.azimuthDeg, lon));
    const f = discVisibleFraction(s.elevationDeg, hs, s.angularRadiusDeg);
    sunFrac += f;
    if (f > 0) sunAny++;
    const e = bodyAltAzFromEphemeris(eph, "earth", lat, lon);
    const he = profileAt(profile, trueToGridAz(e.azimuthDeg, lon));
    if (e.elevationDeg + e.angularRadiusDeg > he) earthAny++;
  }
  const n = ephs.length;
  return { sunAny: sunAny / n, sunFrac: sunFrac / n, earthAny: earthAny / n };
}

const stats = (d: number[]) => ({
  mae: (d.reduce((a, b) => a + Math.abs(b), 0) / d.length) * 100,
  bias: (d.reduce((a, b) => a + b, 0) / d.length) * 100,
});

const mazarico: NonNullable<ValidationReport["mazarico"]> = [];
let seed = 1;
for (const def of Object.values(REGIONS)) {
  const step = EXTENT / (HORIZON_N - 1);
  const nodes = sampleNodes(seed++)
    .map(({ c, r }) => ({
      X: def.X - EXTENT / 2 + c * step,
      Y: def.Y - EXTENT / 2 + r * step,
    }))
    .filter(
      (p) =>
        rasterContains(sunRef, p.X, p.Y) && rasterContains(earthRef, p.X, p.Y),
    );
  const pts = Float64Array.from(nodes.flatMap((p) => [p.X, p.Y]));
  const profiles = await Promise.all(
    MASTS.map((m) => pool.run(pts, m, AZ_BINS)),
  );
  const results: NodeResult[] = nodes.map((p, i) => {
    const { lat, lon } = polarToLatLon(p.X, p.Y);
    const runs = MASTS.map((_, m) =>
      longRun(lat, lon, profiles[m].subarray(i * AZ_BINS, (i + 1) * AZ_BINS)),
    );
    return {
      lat,
      lon,
      refSun: rasterBilinear(sunRef, p.X, p.Y),
      refEarth: rasterBilinear(earthRef, p.X, p.Y),
      sunAny: runs.map((r) => r.sunAny),
      sunFrac: runs.map((r) => r.sunFrac),
      earthAny: runs.map((r) => r.earthAny),
    };
  });
  for (const [m, mast] of MASTS.entries()) {
    const sAny = stats(results.map((r) => r.sunAny[m] - r.refSun));
    const sFrac = stats(results.map((r) => r.sunFrac[m] - r.refSun));
    const e = stats(results.map((r) => r.earthAny[m] - r.refEarth));
    const lit = results.filter((r) => r.refEarth > 0);
    const eLit = stats(lit.map((r) => r.earthAny[m] - r.refEarth));
    console.log(
      `${def.id} mast ${mast} m, ${results.length} nodes: Sun(any part) MAE ${sAny.mae.toFixed(2)} pp bias ${sAny.bias.toFixed(2)}; ` +
        `Sun(mean disc fraction) MAE ${sFrac.mae.toFixed(2)} bias ${sFrac.bias.toFixed(2)}; Earth(any part) MAE ${e.mae.toFixed(2)} bias ${e.bias.toFixed(2)}` +
        ` (on the ${lit.length} nodes where NASA Earth > 0: MAE ${eLit.mae.toFixed(2)} bias ${eLit.bias.toFixed(2)})`,
    );
    if (mast === MAZARICO_MAST)
      mazarico.push({
        region: def.id,
        samples: results.length,
        sunMaePp: +sAny.mae.toFixed(2),
        earthMaePp: +e.mae.toFixed(2),
        sunBiasPp: +sAny.bias.toFixed(2),
        earthBiasPp: +e.bias.toFixed(2),
        method:
          `${results.length} stratified horizon-grid nodes (${lit.length} with NASA Earth visibility > 0); horizons ` +
          `recomputed at ${mast} m above the LOLA surface (${AZ_BINS} azimuths, great-circle march to 320 km over ` +
          `LDEM 20/40/80/240 m); Sun and Earth from astronomy-engine every ${STEP_H} h, 2016-08-01 to 2035-03-01 ` +
          `(18.6 yr). Visible = any part of the disc above the horizon (AVGVISIB label definition); compared with ` +
          `AVGVISIB_85S_060M_201608 (Sun) and _EARTH, bilinear at the same point. Percentage points; bias = ours - NASA.`,
      });
  }
  for (const r of results.slice(0, 3))
    console.log(
      `  e.g. ${r.lat.toFixed(4)}, ${r.lon.toFixed(3)}: sun ${(r.sunAny[0] * 100).toFixed(1)} vs ${(r.refSun * 100).toFixed(1)}, earth ${(r.earthAny[0] * 100).toFixed(1)} vs ${(r.refEarth * 100).toFixed(1)}`,
    );

  // named sites: exact per-site horizons from meta.json (built by data:build)
  const meta: RegionMeta = await Bun.file(
    `${import.meta.dir}/../../public/regions/${def.id}/meta.json`,
  ).json();
  for (const s of meta.sites) {
    const line = s.horizons
      .filter((h) => h.mastHeight <= 2)
      .map((h) => {
        const lr = longRun(s.lat, s.lon, Float32Array.from(h.values));
        return `${h.mastHeight} m: sun disc ${(lr.sunFrac * 100).toFixed(1)} % (any ${(lr.sunAny * 100).toFixed(1)} %), earth any ${(lr.earthAny * 100).toFixed(1)} %`;
      })
      .join(" | ");
    const X = meta.center.X + s.x;
    const Y = meta.center.Y + s.y;
    const ref = rasterContains(sunRef, X, Y)
      ? ` | NASA 60 m: sun ${(rasterBilinear(sunRef, X, Y) * 100).toFixed(1)} %, earth ${(rasterBilinear(earthRef, X, Y) * 100).toFixed(1)} %`
      : "";
    console.log(`  site ${s.id}: ${line}${ref}`);
  }
}
pool.terminate();

const horizons: ValidationReport["horizons"] = HORIZONS_FIXTURES.map((f) => {
  const ours = bodyAltAz(f.body, new Date(f.utc), f.lat, f.lonE);
  return {
    body: f.body,
    lat: f.lat,
    lon: normLon(f.lonE),
    utc: f.utc,
    jplAzimuth: f.az,
    jplElevation: f.el,
    oursAzimuth: +ours.azimuthDeg.toFixed(4),
    oursElevation: +ours.elevationDeg.toFixed(4),
  };
});
const maxErr = Math.max(
  ...horizons.map((h) => Math.abs(h.oursElevation - h.jplElevation)),
);
console.log(
  `Horizons fixtures: ${horizons.length}, max |d el| ${maxErr.toFixed(4)} deg`,
);

const report: ValidationReport = {
  generatedAt: new Date().toISOString(),
  horizons,
  mazarico,
};
await Bun.write(
  `${import.meta.dir}/../../public/validation.json`,
  JSON.stringify(report, null, 1),
);
console.log(`done in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
