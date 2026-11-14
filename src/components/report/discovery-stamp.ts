"use client";

import { type DiscoveryCriteria, type RegionId, useApp, type WindowDays } from "@/lib/store";

/** Region, mission window and criteria a set of discovery results was computed for. */
export interface DiscoveryStamp {
  regionId: RegionId;
  windowStart: number;
  windowDays: WindowDays;
  criteria: DiscoveryCriteria;
}

interface StampSource {
  regionId: RegionId;
  windowStart: number;
  windowDays: WindowDays;
  discovery: { criteria: DiscoveryCriteria };
}

const stampOf = (s: StampSource): DiscoveryStamp => ({
  regionId: s.regionId,
  windowStart: s.windowStart,
  windowDays: s.windowDays,
  criteria: s.discovery.criteria,
});

let pending: DiscoveryStamp | null = null;
let current: DiscoveryStamp | null = null;

/*
 * `runDiscovery` reads the window when it starts (running -> true) and writes results when it ends, so
 * the stamp is captured at the start and attached to the next results array. The store has no stamp of
 * its own; this module is imported by the top-bar ReportButton, so it subscribes before any search runs.
 */
if (typeof window !== "undefined") {
  useApp.subscribe((s, prev) => {
    if (s.discovery.running && !prev.discovery.running) pending = stampOf(s);
    if (s.discovery.results !== prev.discovery.results) {
      current = s.discovery.results.length > 0 ? (pending ?? stampOf(s)) : null;
      pending = null;
    }
  });
}

/** Stamp of the results now in the store, or null if they are not from the current region/window/criteria. */
export function freshDiscoveryStamp(s: StampSource): DiscoveryStamp | null {
  if (!current) return null;
  const c = current.criteria;
  const n = s.discovery.criteria;
  const fresh =
    current.regionId === s.regionId &&
    current.windowStart === s.windowStart &&
    current.windowDays === s.windowDays &&
    c.maxSlopeDeg === n.maxSlopeDeg &&
    c.minSun === n.minSun &&
    c.minEarth === n.minEarth;
  return fresh ? current : null;
}
