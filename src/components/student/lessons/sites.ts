import type { PointAnalysis } from "@/lib/analysis/types";
import type { LoadedRegion } from "@/lib/moon/horizon";
import type { RegionMeta, RegionSite } from "@/lib/moon/types";
import { HOUR, type LanderId, useApp } from "@/lib/store";
import { heightAt, inTile } from "@/lib/terrain";

/**
 * Site lookup that never depends on one exact id: lessons try preferred ids first, then fall back to
 * matching by kind and name, so a renamed or missing site degrades to "skip this part" instead of a crash.
 */
function findSite(meta: RegionMeta, ids: string[], match: (s: RegionSite) => boolean): RegionSite | null {
  for (const id of ids) {
    const site = meta.sites.find((s) => s.id === id);
    if (site) return site;
  }
  return meta.sites.find(match) ?? null;
}

/** Sunniest ridge: Gläser 2018 point C1 (76 % surface illumination) if present. */
export function findRidge(meta: RegionMeta): RegionSite | null {
  return findSite(
    meta,
    ["c1", "site01", "cr1"],
    (s) => /connecting ridge/i.test(s.name) || s.kind === "high-illumination",
  );
}

export function findCraterFloor(meta: RegionMeta): RegionSite | null {
  return findSite(meta, ["shackleton-floor"], (s) => /floor/i.test(s.name));
}

export function findCraterRim(meta: RegionMeta): RegionSite | null {
  return findSite(meta, ["rim-s", "site04"], (s) => /rim/i.test(s.name));
}

export function placeAtSite(id: LanderId, site: RegionSite): void {
  useApp.getState().placeLander(id, { x: site.x, y: site.y, siteId: site.id });
}

/**
 * Flies the orbit camera so one point, or two points together, fill the view. The camera distance grows with
 * the gap between the points (1.3 × gap keeps both comfortably on screen) but never gets closer than `minKm`.
 */
export function frame(p: { x: number; y: number }, q?: { x: number; y: number }, minKm = 6): void {
  const other = q ?? p;
  const gapKm = Math.hypot(p.x - other.x, p.y - other.y) / 1000;
  useApp.getState().focusOn((p.x + other.x) / 2, (p.y + other.y) / 2, Math.max(minKm, gapKm * 1.3));
}

/** Lowest terrain point `distanceM` away from (x, y), sampled every 15° of direction. */
export function downslopePoint(
  region: LoadedRegion,
  x: number,
  y: number,
  distanceM: number,
): { x: number; y: number; heightM: number } | null {
  let best: { x: number; y: number; heightM: number } | null = null;
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * 2 * Math.PI;
    const px = x + Math.sin(a) * distanceM;
    const py = y + Math.cos(a) * distanceM;
    if (!inTile(region.meta, px, py)) continue;
    const h = heightAt(region.meta, region.heights, px, py);
    if (!best || h < best.heightM) best = { x: px, y: py, heightM: h };
  }
  return best;
}

/** Moment with the Sun fully up and highest above the real horizon: the crater rim is lit, the inside is black. */
export function brightestMoment(analysis: PointAnalysis): number | null {
  const s = analysis.series;
  let bestIdx = -1;
  for (let i = 0; i < s.sunElev.length; i++) {
    if (s.sunFraction[i] < 0.999) continue;
    if (bestIdx < 0 || s.sunElev[i] > s.sunElev[bestIdx]) bestIdx = i;
  }
  return bestIdx < 0 ? null : s.start + bestIdx * s.stepMinutes * 60_000;
}

/** Just after Earth rises at the start of the longest Earth-visible window. */
export function earthriseMoment(analysis: PointAnalysis): number | null {
  let best: { start: number; end: number } | null = null;
  for (const w of analysis.earthWindows) {
    if (!best || w.end - w.start > best.end - best.start) best = w;
  }
  return best ? Math.min(best.start + 2 * HOUR, best.end) : null;
}
