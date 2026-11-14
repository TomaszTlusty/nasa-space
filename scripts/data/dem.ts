/** Multi-resolution LOLA DEM sampler: finest product covering the point, bilinear. */
import { loadPolarRaster, type PolarRaster, rasterBilinear, rasterContains } from "./pds";

export const RAW_DIR = `${import.meta.dir}/../../data/raw`;
/** finest -> coarsest */
export const DEM_NAMES = ["LDEM_875S_20M", "LDEM_85S_40M", "LDEM_80S_80M", "LDEM_75S_240M"] as const;

export class MultiDem {
  constructor(readonly rasters: PolarRaster[]) {}

  static async load(names: readonly string[] = DEM_NAMES): Promise<MultiDem> {
    return new MultiDem(await Promise.all(names.map((n) => loadPolarRaster(RAW_DIR, n))));
  }

  /** index of the finest raster covering (X, Y), or -1 */
  pick(X: number, Y: number): number {
    for (let i = 0; i < this.rasters.length; i++) if (rasterContains(this.rasters[i], X, Y)) return i;
    return -1;
  }

  /** height (m, relative to R) or NaN outside all products */
  height(X: number, Y: number): number {
    const i = this.pick(X, Y);
    return i < 0 ? Number.NaN : rasterBilinear(this.rasters[i], X, Y);
  }

  /** Height from a specific raster (used to keep a region on one resolution). */
  heightFrom(i: number, X: number, Y: number): number {
    return rasterBilinear(this.rasters[i], X, Y);
  }

  /** Highest height (m) present in any product (bounds the horizon march). */
  maxHeight(): number {
    let best = -Infinity;
    for (const r of this.rasters) {
      const d = r.data;
      let m = -32768;
      for (let i = 0; i < d.length; i++) if (d[i] > m) m = d[i];
      best = Math.max(best, m * r.scalingFactor + r.offset);
    }
    return best;
  }
}
