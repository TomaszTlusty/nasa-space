import { MOON_RADIUS_M } from "@/lib/moon/frames";
import type { RegionMeta } from "@/lib/moon/types";

/** Bilinear DEM height (m) at local (x, y). Clamped to the tile. */
export function heightAt(meta: RegionMeta, heights: Float32Array, x: number, y: number): number {
  const t = meta.terrain;
  const fx = Math.min(t.width - 1.0001, Math.max(0, (x - t.x0) / t.step));
  const fy = Math.min(t.height - 1.0001, Math.max(0, (y - t.y0) / t.step));
  const c = Math.floor(fx);
  const r = Math.floor(fy);
  const ax = fx - c;
  const ay = fy - r;
  const i = r * t.width + c;
  const h00 = heights[i];
  const h10 = heights[i + 1];
  const h01 = heights[i + t.width];
  const h11 = heights[i + t.width + 1];
  return (h00 * (1 - ax) + h10 * ax) * (1 - ay) + (h01 * (1 - ax) + h11 * ax) * ay;
}

/**
 * Scene units are kilometres. Scene height of local point (x, y) relative to the region-centre
 * surface, including the curvature drop d^2 / 2R (the tile is drawn in the centre's tangent plane).
 */
export function sceneY(heightM: number, x: number, y: number, centerHeightM: number): number {
  return (heightM - centerHeightM - (x * x + y * y) / (2 * MOON_RADIUS_M)) / 1000;
}

export function inTile(meta: RegionMeta, x: number, y: number): boolean {
  const t = meta.terrain;
  return x >= t.x0 && y >= t.y0 && x <= t.x0 + (t.width - 1) * t.step && y <= t.y0 + (t.height - 1) * t.step;
}
