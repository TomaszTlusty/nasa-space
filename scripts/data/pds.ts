/**
 * Minimal PDS3 label parser + polar-stereographic IMG raster (LSB int16) used by the precompute.
 * Every projection parameter is read from the .LBL; nothing is hardcoded.
 */
import { MOON_RADIUS_M } from "../../src/lib/moon/frames";

export interface PolarRaster {
  name: string;
  lines: number;
  samples: number;
  /** metres per pixel */
  scale: number;
  /** 0-based fractional pixel index of the projection origin (the pole) */
  lineOffset: number;
  sampleOffset: number;
  scalingFactor: number;
  offset: number;
  /** sphere radius from the label (m) */
  radius: number;
  /** max |rho| (m) where the product is defined (from MAXIMUM_LATITUDE) */
  rhoMax: number;
  data: Int16Array;
}

/** Flat key -> value map of a PDS3 label (later keys win; units and quotes stripped). */
export function parseLbl(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const noComments = text.replace(/\/\*[\s\S]*?\*\//g, "");
  const re = /^\s*\^?([A-Z0-9_]+)\s*=\s*([\s\S]*?)(?=^\s*\^?[A-Z0-9_]+\s*=|^\s*END\s*$|(?![\s\S]))/gm;
  for (let m = re.exec(noComments); m; m = re.exec(noComments)) {
    const v = m[2]
      .trim()
      .replace(/<[^>]*>/g, "")
      .trim()
      .replace(/^["']|["']$/g, "");
    out[m[1]] = v;
  }
  return out;
}

function num(lbl: Record<string, string>, key: string): number {
  const v = Number.parseFloat(lbl[key]);
  if (!Number.isFinite(v)) throw new Error(`LBL key ${key} missing or not numeric: ${lbl[key]}`);
  return v;
}

/**
 * Loads `<dir>/<name>.LBL` + `.IMG`. When `shared` is set the pixels live in a SharedArrayBuffer so
 * worker threads can read them without copying.
 */
export async function loadPolarRaster(dir: string, name: string, shared = true): Promise<PolarRaster> {
  const lbl = parseLbl(await Bun.file(`${dir}/${name}.LBL`).text());
  if (!/POLAR STEREOGRAPHIC/.test(lbl.MAP_PROJECTION_TYPE)) throw new Error(`${name}: not polar stereographic`);
  if (num(lbl, "CENTER_LATITUDE") !== -90) throw new Error(`${name}: not south polar`);
  if (num(lbl, "CENTER_LONGITUDE") !== 0) throw new Error(`${name}: centre lon != 0`);
  if (lbl.SAMPLE_TYPE !== "LSB_INTEGER" || num(lbl, "SAMPLE_BITS") !== 16) throw new Error(`${name}: not LSB int16`);
  if (num(lbl, "MAP_PROJECTION_ROTATION") !== 0) throw new Error(`${name}: rotated projection`);
  const lines = num(lbl, "LINES");
  const samples = num(lbl, "LINE_SAMPLES");
  const scale = num(lbl, "MAP_SCALE");
  const radius = num(lbl, "A_AXIS_RADIUS") * 1000;
  if (radius !== MOON_RADIUS_M) throw new Error(`${name}: radius ${radius} != ${MOON_RADIUS_M}`);
  // The labels' MINIMUM/MAXIMUM_LATITUDE are not reliable (one AVGVISIB label says +90); the
  // boundary nearest the equator is the one with the smaller |lat|.
  const latEdge = Math.min(Math.abs(num(lbl, "MAXIMUM_LATITUDE")), Math.abs(num(lbl, "MINIMUM_LATITUDE")));
  const rhoMax = 2 * radius * Math.tan(Math.PI / 4 - (latEdge * Math.PI) / 360);
  const buf = await Bun.file(`${dir}/${name}.IMG`).arrayBuffer();
  if (buf.byteLength !== lines * samples * 2) throw new Error(`${name}: size ${buf.byteLength} mismatch`);
  let data: Int16Array;
  if (shared) {
    const sab = new SharedArrayBuffer(buf.byteLength);
    new Int16Array(sab).set(new Int16Array(buf));
    data = new Int16Array(sab);
  } else data = new Int16Array(buf);
  return {
    name,
    lines,
    samples,
    scale,
    lineOffset: num(lbl, "LINE_PROJECTION_OFFSET"),
    sampleOffset: num(lbl, "SAMPLE_PROJECTION_OFFSET"),
    scalingFactor: num(lbl, "SCALING_FACTOR"),
    // LDEM labels put the reference radius in OFFSET (height = DN * scale); other products a real offset.
    offset: Math.abs(num(lbl, "OFFSET") - radius) < 1 ? 0 : num(lbl, "OFFSET"),
    radius,
    rhoMax,
    data,
  };
}

/**
 * Pixel registration: 0-based column c, row r has its centre at
 *   X = (c - sampleOffset) * scale,  Y = (lineOffset - r) * scale
 * (row 0 is the top = max Y). For even-sized LOLA products the offset is N/2 - 0.5, i.e. the pole
 * sits exactly between the four central pixels.
 */
export function rasterContains(r: PolarRaster, X: number, Y: number, marginPx = 2): boolean {
  if (Math.hypot(X, Y) > r.rhoMax - marginPx * r.scale) return false;
  const c = r.sampleOffset + X / r.scale;
  const l = r.lineOffset - Y / r.scale;
  return c >= marginPx && l >= marginPx && c <= r.samples - 1 - marginPx && l <= r.lines - 1 - marginPx;
}

/** Bilinear sample in physical units (DN * scalingFactor + offset). Caller guarantees containment. */
export function rasterBilinear(r: PolarRaster, X: number, Y: number): number {
  const c = r.sampleOffset + X / r.scale;
  const l = r.lineOffset - Y / r.scale;
  const c0 = Math.floor(c);
  const l0 = Math.floor(l);
  const fc = c - c0;
  const fl = l - l0;
  const i = l0 * r.samples + c0;
  const d = r.data;
  const top = d[i] + (d[i + 1] - d[i]) * fc;
  const bot = d[i + r.samples] + (d[i + r.samples + 1] - d[i + r.samples]) * fc;
  return (top + (bot - top) * fl) * r.scalingFactor + r.offset;
}
