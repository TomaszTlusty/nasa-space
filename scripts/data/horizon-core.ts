/**
 * Terrain horizon by great-circle ray marching over the multi-resolution LOLA DEMs.
 *
 * Observer at projected (X, Y), radius ro = R + h(X, Y) + mast. For grid azimuth A the initial
 * bearing is t = sin(A) ex + cos(A) ey (exact stereographic grid basis at the observer, so the
 * azimuth is measured from local grid north). Points along the great circle at central angle th:
 *   q(th) = q0 cos(th) + t sin(th)   ->  X = 2R qy / (1 - qz), Y = 2R qx / (1 - qz)
 * Elevation of a target of radius rt = R + h(q) (exact on the sphere):
 *   tan(e) = (rt cos(th) - ro) / (rt sin(th)).  Horizon = max over the ray.
 * Step length grows with distance: ds = max(dsMin, growth * s), out to maxDist (or the DEM edge).
 * The ray stops early once even the highest terrain in the DEMs could not beat the current maximum.
 */
import { MOON_RADIUS_M, RAD, gridBasis, polarToUnit } from "../../src/lib/moon/frames";
import type { PolarRaster } from "./pds";

const R = MOON_RADIUS_M;

export interface MarchOptions {
  maxDistM: number;
  dsMinM: number;
  growth: number;
}

export const DEFAULT_MARCH: MarchOptions = { maxDistM: 320_000, dsMinM: 10, growth: 0.004 };

interface FastRaster {
  data: Int16Array;
  samples: number;
  invScale: number;
  sOff: number;
  lOff: number;
  k: number;
  rho2: number;
}

export class HorizonMarcher {
  private readonly fr: FastRaster[];
  private readonly cosT: Float64Array;
  private readonly sinT: Float64Array;
  /** highest terrain radius over all rasters (m) */
  private readonly rMax: number;

  constructor(rasters: PolarRaster[], maxHeight: number, opts: MarchOptions = DEFAULT_MARCH) {
    this.fr = rasters.map((r) => {
      const half = Math.min(r.sampleOffset, r.lineOffset, r.samples - 1 - r.sampleOffset, r.lines - 1 - r.lineOffset);
      const lim = Math.min(r.rhoMax, half * r.scale) - 2 * r.scale;
      return {
        data: r.data,
        samples: r.samples,
        invScale: 1 / r.scale,
        sOff: r.sampleOffset,
        lOff: r.lineOffset,
        k: r.scalingFactor,
        rho2: lim * lim,
      };
    });
    const th: number[] = [];
    for (let s = opts.dsMinM; s <= opts.maxDistM; s += Math.max(opts.dsMinM, opts.growth * s)) th.push(s / R);
    this.cosT = Float64Array.from(th, Math.cos);
    this.sinT = Float64Array.from(th, Math.sin);
    this.rMax = R + maxHeight;
  }

  /** Height (m) at projected X, Y from the finest covering raster, NaN outside. */
  height(X: number, Y: number): number {
    const rho2 = X * X + Y * Y;
    for (const f of this.fr) {
      if (rho2 >= f.rho2) continue;
      const c = f.sOff + X * f.invScale;
      const l = f.lOff - Y * f.invScale;
      const c0 = Math.floor(c);
      const l0 = Math.floor(l);
      const fc = c - c0;
      const fl = l - l0;
      const i = l0 * f.samples + c0;
      const d = f.data;
      const a = d[i] + (d[i + 1] - d[i]) * fc;
      const b = d[i + f.samples] + (d[i + f.samples + 1] - d[i + f.samples]) * fc;
      return (a + (b - a) * fl) * f.k;
    }
    return Number.NaN;
  }

  /**
   * Horizon elevations (deg) at `azBins` equally spaced grid azimuths (bin k = k * 360 / azBins),
   * written to out[outOffset + k * stride].
   */
  horizon(
    X: number,
    Y: number,
    mast: number,
    azBins: number,
    out: Float32Array | Float64Array,
    outOffset = 0,
    stride = 1,
  ): void {
    const h0 = this.height(X, Y);
    const ro = R + h0 + mast;
    const q0 = polarToUnit(X, Y);
    const { ex, ey } = gridBasis(X, Y);
    const { cosT, sinT, rMax, fr } = this;
    const n = cosT.length;
    const nf = fr.length;
    for (let k = 0; k < azBins; k++) {
      const A = (2 * Math.PI * k) / azBins;
      const sa = Math.sin(A);
      const ca = Math.cos(A);
      const tx = sa * ex[0] + ca * ey[0];
      const ty = sa * ex[1] + ca * ey[1];
      const tz = sa * ex[2] + ca * ey[2];
      let best = -Infinity;
      for (let j = 0; j < n; j++) {
        const c = cosT[j];
        const s = sinT[j];
        // upper bound for any terrain at this distance; tan is monotone in rt for fixed th
        if ((rMax * c - ro) / (rMax * s) <= best) break;
        const qx = q0[0] * c + tx * s;
        const qy = q0[1] * c + ty * s;
        const qz = q0[2] * c + tz * s;
        const kk = (2 * R) / (1 - qz);
        const PX = kk * qy;
        const PY = kk * qx;
        const rho2 = PX * PX + PY * PY;
        let h = Number.NaN;
        for (let m = 0; m < nf; m++) {
          const f = fr[m];
          if (rho2 >= f.rho2) continue;
          const cc = f.sOff + PX * f.invScale;
          const ll = f.lOff - PY * f.invScale;
          const c0 = Math.floor(cc);
          const l0 = Math.floor(ll);
          const fc = cc - c0;
          const fl = ll - l0;
          const i = l0 * f.samples + c0;
          const d = f.data;
          const a = d[i] + (d[i + 1] - d[i]) * fc;
          const b = d[i + f.samples] + (d[i + f.samples + 1] - d[i + f.samples]) * fc;
          h = (a + (b - a) * fl) * f.k;
          break;
        }
        if (h !== h) break; // left every DEM
        const rt = R + h;
        const tn = (rt * c - ro) / (rt * s);
        if (tn > best) best = tn;
      }
      out[outOffset + k * stride] = Math.atan(best) * RAD;
    }
  }
}
