/**
 * Region precompute: `bun run data:build shackleton|malapert|all [--terrain-only]`
 * Writes public/regions/<id>/{meta.json, heights.bin, normal.png, horizon.bin, slope.bin}.
 */
import { mkdir } from "node:fs/promises";
import { MOON_RADIUS_M, RAD, polarToLatLon, toLocal } from "../../src/lib/moon/frames";
import type { RegionMeta, RegionSite } from "../../src/lib/moon/types";
import { MultiDem } from "./dem";
import { HorizonMarcher } from "./horizon-core";
import { encodePngRgb } from "./png";
import { HorizonPool } from "./pool";
import { DATA_BOOK_URL, GLASER_2018_URL, LOLA_GDR_URL, MAZARICO_URL, REGIONS, type RegionDef, type SiteDef } from "./regions";

const OUT_DIR = `${import.meta.dir}/../../public/regions`;
export const EXTENT = 40_960;
const TERRAIN_N = 513;
const NORMAL_N = 2048;
export const HORIZON_N = 257;
export const AZ_BINS = 180;
export const GRID_MAST = 2;
const QUANT = 0.1;
const OFFSET = -5;
const SITE_BINS = 720;
const SITE_MASTS = [0, 2, 5, 10];

class RegionSampler {
  /** finest raster index used for the whole region (finest covering all four corners) */
  readonly ri: number;
  readonly scale: number;
  constructor(
    readonly dem: MultiDem,
    readonly def: RegionDef,
  ) {
    const h = EXTENT / 2 + 200;
    const idx = [
      [-h, -h],
      [h, -h],
      [-h, h],
      [h, h],
    ].map(([x, y]) => dem.pick(def.X + x, def.Y + y));
    if (idx.some((i) => i < 0)) throw new Error(`${def.id}: region not covered by DEMs`);
    this.ri = Math.max(...idx);
    this.scale = dem.rasters[this.ri].scale;
  }
  /** height at local (x, y) from the region's finest DEM */
  h(x: number, y: number): number {
    return this.dem.heightFrom(this.ri, this.def.X + x, this.def.Y + y);
  }
}

function buildHeights(s: RegionSampler): Float32Array {
  const out = new Float32Array(TERRAIN_N * TERRAIN_N);
  const step = EXTENT / (TERRAIN_N - 1);
  // box pre-filter over one grid cell (4 x 4 bilinear sub-samples) to avoid aliasing the finer DEM
  const sub = [-0.375, -0.125, 0.125, 0.375].map((f) => f * step);
  for (let r = 0; r < TERRAIN_N; r++)
    for (let c = 0; c < TERRAIN_N; c++) {
      const x = -EXTENT / 2 + c * step;
      const y = -EXTENT / 2 + r * step;
      let acc = 0;
      for (const dy of sub) for (const dx of sub) acc += s.h(x + dx, y + dy);
      out[r * TERRAIN_N + c] = acc / 16;
    }
  return out;
}

/**
 * Normal map: region-frame unit normal of the curved surface z = h(x, y) - (x^2 + y^2) / 2R
 * (the same curvature drop the scene applies), central differences over +-1 DEM pixel.
 * RGB = round((n + 1) / 2 * 255) for (nx, ny, nz); pixel centres at x0 + (i + 0.5) * pix;
 * image row 0 = max y.
 */
function buildNormals(s: RegionSampler): Uint8Array {
  const pix = EXTENT / NORMAL_N;
  const d = s.scale;
  const rgb = new Uint8Array(NORMAL_N * NORMAL_N * 3);
  for (let j = 0; j < NORMAL_N; j++) {
    const y = EXTENT / 2 - (j + 0.5) * pix;
    for (let i = 0; i < NORMAL_N; i++) {
      const x = -EXTENT / 2 + (i + 0.5) * pix;
      const gx = (s.h(x + d, y) - s.h(x - d, y)) / (2 * d) - x / MOON_RADIUS_M;
      const gy = (s.h(x, y + d) - s.h(x, y - d)) / (2 * d) - y / MOON_RADIUS_M;
      const inv = 1 / Math.sqrt(gx * gx + gy * gy + 1);
      const o = (j * NORMAL_N + i) * 3;
      rgb[o] = Math.round((-gx * inv + 1) * 127.5);
      rgb[o + 1] = Math.round((-gy * inv + 1) * 127.5);
      rgb[o + 2] = Math.round((inv + 1) * 127.5);
    }
  }
  return encodePngRgb(NORMAL_N, NORMAL_N, rgb);
}

/** Local slope (deg, relative to the local vertical) on the horizon grid, +-1 DEM pixel baseline. */
function buildSlope(s: RegionSampler): Uint8Array {
  const step = EXTENT / (HORIZON_N - 1);
  const d = s.scale;
  const out = new Uint8Array(HORIZON_N * HORIZON_N);
  for (let r = 0; r < HORIZON_N; r++)
    for (let c = 0; c < HORIZON_N; c++) {
      const x = -EXTENT / 2 + c * step;
      const y = -EXTENT / 2 + r * step;
      const gx = (s.h(x + d, y) - s.h(x - d, y)) / (2 * d);
      const gy = (s.h(x, y + d) - s.h(x, y - d)) / (2 * d);
      out[r * HORIZON_N + c] = Math.min(90, Math.round(Math.atan(Math.hypot(gx, gy)) * RAD));
    }
  return out;
}

async function buildHorizonGrid(pool: HorizonPool, def: RegionDef): Promise<Uint8Array> {
  const step = EXTENT / (HORIZON_N - 1);
  const plane = HORIZON_N * HORIZON_N;
  const out = new Uint8Array(AZ_BINS * plane);
  await Promise.all(
    Array.from({ length: HORIZON_N }, async (_, r) => {
      const pts = new Float64Array(HORIZON_N * 2);
      for (let c = 0; c < HORIZON_N; c++) {
        pts[2 * c] = def.X - EXTENT / 2 + c * step;
        pts[2 * c + 1] = def.Y - EXTENT / 2 + r * step;
      }
      const res = await pool.run(pts, GRID_MAST, AZ_BINS);
      for (let c = 0; c < HORIZON_N; c++)
        for (let k = 0; k < AZ_BINS; k++) {
          const q = Math.round((res[c * AZ_BINS + k] - OFFSET) / QUANT);
          out[k * plane + r * HORIZON_N + c] = q < 0 ? 0 : q > 255 ? 255 : q;
        }
    }),
  );
  return out;
}

/** Malapert reference points picked from the DEM to contrast with the summit. */
function malapertReferences(s: RegionSampler, summit: { x: number; y: number }): SiteDef[] {
  let low = { x: 0, y: 0, h: Infinity };
  for (let a = 0; a < 360; a += 1) {
    const x = summit.x + 3000 * Math.sin(a / RAD);
    const y = summit.y + 3000 * Math.cos(a / RAD);
    const h = s.h(x, y);
    if (h < low.h) low = { x, y, h };
  }
  // crater floor: lowest terrain within 12 km of the summit (kept 2 km inside the region)
  let floor = { x: 0, y: 0, h: Infinity };
  for (let y = -EXTENT / 2 + 2000; y <= EXTENT / 2 - 2000; y += 100)
    for (let x = -EXTENT / 2 + 2000; x <= EXTENT / 2 - 2000; x += 100) {
      if (Math.hypot(x - summit.x, y - summit.y) > 12_000) continue;
      const h = s.h(x, y);
      if (h < floor.h) floor = { x, y, h };
    }
  const ll = (p: { x: number; y: number }) => {
    const g = polarToLatLon(s.def.X + p.x, s.def.Y + p.y);
    return { lat: Math.round(g.lat * 1e5) / 1e5, lon: Math.round(g.lon * 1e5) / 1e5 };
  };
  return [
    {
      id: "malapert-slope",
      name: "Malapert lower slope",
      kind: "reference",
      ...ll(low),
      source: LOLA_GDR_URL,
      note: `Reference point picked from LOLA LDEM_85S_40M: lowest terrain 3 km from Site 23 (${Math.round(low.h)} m).`,
    },
    {
      id: "malapert-floor",
      name: "Crater floor near Malapert",
      kind: "reference",
      ...ll(floor),
      source: LOLA_GDR_URL,
      note: `Reference point picked from LOLA LDEM_85S_40M: lowest terrain within 12 km of Site 23 (${Math.round(floor.h)} m).`,
    },
  ];
}

async function buildRegion(id: string, dem: MultiDem, marcher: HorizonMarcher | null, pool: HorizonPool | null) {
  const def = REGIONS[id];
  if (!def) throw new Error(`unknown region ${id}`);
  const t0 = performance.now();
  const s = new RegionSampler(dem, def);
  const dir = `${OUT_DIR}/${id}`;
  await mkdir(dir, { recursive: true });
  const center = polarToLatLon(def.X, def.Y);
  const metaCenter = { lat: center.lat, lon: center.lon, X: def.X, Y: def.Y };

  const heights = buildHeights(s);
  let minH = Infinity;
  let maxH = -Infinity;
  for (const v of heights) {
    if (v < minH) minH = v;
    if (v > maxH) maxH = v;
  }
  await Bun.write(`${dir}/heights.bin`, heights);
  await Bun.write(`${dir}/normal.png`, buildNormals(s));
  await Bun.write(`${dir}/slope.bin`, buildSlope(s));
  const tTerrain = performance.now();

  let siteDefs = def.sites;
  if (id === "malapert") siteDefs = [...siteDefs, ...malapertReferences(s, toLocal(def.sites[0].lat, def.sites[0].lon, { center: metaCenter }))];
  const sites: RegionSite[] = siteDefs.map((sd) => {
    const { x, y } = toLocal(sd.lat, sd.lon, { center: metaCenter });
    if (Math.abs(x) > EXTENT / 2 - 500 || Math.abs(y) > EXTENT / 2 - 500) throw new Error(`${sd.id} outside ${id}`);
    const horizons = marcher
      ? SITE_MASTS.map((mast) => {
          const v = new Float64Array(SITE_BINS);
          marcher.horizon(def.X + x, def.Y + y, mast, SITE_BINS, v);
          return { mastHeight: mast, values: Array.from(v, (e) => Math.round(e * 1e4) / 1e4) };
        })
      : [];
    return { ...sd, x, y, elevation: dem.heightFrom(s.ri, def.X + x, def.Y + y), horizons } as RegionSite;
  });

  if (pool) await Bun.write(`${dir}/horizon.bin`, await buildHorizonGrid(pool, def));
  const tEnd = performance.now();

  const hstep = EXTENT / (HORIZON_N - 1);
  const meta: RegionMeta = {
    id,
    name: def.name,
    description: def.description,
    center: metaCenter,
    extent: EXTENT,
    terrain: {
      file: "heights.bin",
      width: TERRAIN_N,
      height: TERRAIN_N,
      x0: -EXTENT / 2,
      y0: -EXTENT / 2,
      step: EXTENT / (TERRAIN_N - 1),
      minHeight: minH,
      maxHeight: maxH,
    },
    normalMap: { file: "normal.png", size: NORMAL_N },
    horizon: {
      file: "horizon.bin",
      width: HORIZON_N,
      height: HORIZON_N,
      x0: -EXTENT / 2,
      y0: -EXTENT / 2,
      step: hstep,
      azBins: AZ_BINS,
      mastHeight: GRID_MAST,
      quantDeg: QUANT,
      offsetDeg: OFFSET,
      layout: "az-row-col",
    },
    slope: { file: "slope.bin" },
    sites,
    sources: [
      { label: `LOLA polar DEMs (${dem.rasters.map((r) => r.name).join(", ")}), NASA PDS`, url: LOLA_GDR_URL },
      { label: "Mazarico et al. 2011 average Sun/Earth visibility (PGDA)", url: MAZARICO_URL },
      { label: "NASA Lunar Surface Data Book ACD-50044 Rev A (site coordinates)", url: DATA_BOOK_URL },
      { label: "Glaser et al. 2018, illumination near Shackleton (site coordinates)", url: GLASER_2018_URL },
      { label: "JPL Horizons (ephemeris validation)", url: "https://ssd.jpl.nasa.gov/horizons/" },
      { label: "Astronomy Engine (IAU 2015 lunar rotation, ephemeris)", url: "https://github.com/cosinekitty/astronomy" },
    ],
  };
  await Bun.write(`${dir}/meta.json`, JSON.stringify(meta, null, 1));
  console.log(
    `${id}: DEM ${dem.rasters[s.ri].name}, terrain ${((tTerrain - t0) / 1000).toFixed(1)} s, total ${((tEnd - t0) / 1000).toFixed(1)} s`,
  );
}

if (import.meta.main) {
  const arg = process.argv[2] ?? "all";
  const terrainOnly = process.argv.includes("--terrain-only");
  const ids = arg === "all" ? Object.keys(REGIONS) : [arg];
  const dem = await MultiDem.load();
  const maxHeight = dem.maxHeight();
  const marcher = terrainOnly ? null : new HorizonMarcher(dem.rasters, maxHeight);
  const pool = terrainOnly ? null : await HorizonPool.create(dem, maxHeight);
  for (const id of ids) await buildRegion(id, dem, marcher, pool);
  pool?.terminate();
}
