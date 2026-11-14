"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { AnalysisCancelled, memoRequest, request } from "@/lib/analysis/client";
import { liveAt } from "@/lib/analysis/compute";
import type {
  LiveVisibility,
  PointAnalysis,
  Transitions,
  WindowAverageStats,
} from "@/lib/analysis/types";
import {
  type DiscoveryCriteria,
  type DiscoveryResult,
  type LanderId,
  type RegionId,
  useApp,
} from "@/lib/store";
import { useRegion } from "@/lib/use-region";

/** Playhead-driven transition searches are sent at most this often (latest wins). */
const TRANSITIONS_THROTTLE_MS = 100;

function reportFailure(error: unknown): void {
  if (!(error instanceof AnalysisCancelled)) console.error("[analysis]", error);
}

/**
 * Analysis of a lander over [windowStart, windowStart + windowDays], hourly, computed in the worker.
 * Keeps returning the previous result while a new one is computed; null when the lander is not placed.
 */
export function usePointAnalysis(id: LanderId): PointAnalysis | null {
  const { regionId, lander, windowStart, windowDays, power, mastHeight } =
    useApp(
      useShallow((s) => ({
        regionId: s.regionId,
        lander: s.landers[id],
        windowStart: s.windowStart,
        windowDays: s.windowDays,
        power: s.power,
        mastHeight: s.mastHeight,
      })),
    );
  const [result, setResult] = useState<{
    regionId: RegionId;
    analysis: PointAnalysis;
  } | null>(null);

  useEffect(() => {
    if (!lander) return;
    let alive = true;
    const { x, y, siteId } = lander;
    memoRequest(`point:${id}`, regionId, {
      kind: "point",
      id,
      query: { x, y, siteId, mastHeight },
      start: windowStart,
      days: windowDays,
      power,
    }).then(
      (analysis) => alive && setResult({ regionId, analysis }),
      reportFailure,
    );
    return () => {
      alive = false;
    };
  }, [id, regionId, lander, windowStart, windowDays, power, mastHeight]);

  return lander && result?.regionId === regionId ? result.analysis : null;
}

/** Next sunset / sunrise / Earthset / Earthrise after the playhead (searched 30 days ahead, ≤ 10 searches/s). */
export function useTransitions(id: LanderId): Transitions | null {
  const { regionId, lander, time, mastHeight } = useApp(
    useShallow((s) => ({
      regionId: s.regionId,
      lander: s.landers[id],
      time: s.time,
      mastHeight: s.mastHeight,
    })),
  );
  const [result, setResult] = useState<{
    point: string;
    transitions: Transitions;
  } | null>(null);
  const lastSent = useRef(0);
  const pointKey = lander
    ? `${regionId}|${lander.x}|${lander.y}|${lander.siteId ?? ""}|${mastHeight}`
    : null;
  const currentPoint = useRef(pointKey);

  useEffect(() => {
    currentPoint.current = pointKey;
  }, [pointKey]);

  useEffect(() => {
    if (!lander || pointKey === null) return;
    const send = () => {
      lastSent.current = performance.now();
      const query = {
        x: lander.x,
        y: lander.y,
        siteId: lander.siteId,
        mastHeight,
      };
      request(`transitions:${id}`, regionId, {
        kind: "transitions",
        query,
        from: time,
      }).then((transitions) => {
        // latest-wins already rejected older requests; only drop results for a lander that moved since
        if (currentPoint.current === pointKey)
          setResult({ point: pointKey, transitions });
      }, reportFailure);
    };
    const wait =
      TRANSITIONS_THROTTLE_MS - (performance.now() - lastSent.current);
    if (wait <= 0) {
      send();
      return;
    }
    const timer = setTimeout(send, wait);
    return () => clearTimeout(timer);
  }, [id, regionId, lander, time, mastHeight, pointKey]);

  return result && result.point === pointKey ? result.transitions : null;
}

/** Sun / Earth state at the playhead for a lander, on the main thread (≈ 0.1 ms). */
export function useLiveVisibility(id: LanderId): LiveVisibility | null {
  const { regionId, lander, time, mastHeight } = useApp(
    useShallow((s) => ({
      regionId: s.regionId,
      lander: s.landers[id],
      time: s.time,
      mastHeight: s.mastHeight,
    })),
  );
  const { region } = useRegion(regionId);
  return useMemo(
    () =>
      region && lander
        ? liveAt(region, time, lander.x, lander.y, {
            siteId: lander.siteId,
            mastHeight,
          })
        : null,
    [region, lander, time, mastHeight],
  );
}

/**
 * Window-average Sun / Earth visibility on the horizon grid for the heatmap (worker; ~0.2–0.4 s).
 * While enabled it also writes the RGBA8 texture data to the store (`averageData`).
 */
export function useWindowAverage(enabled: boolean): WindowAverageStats | null {
  const { regionId, windowStart, windowDays } = useApp(
    useShallow((s) => ({
      regionId: s.regionId,
      windowStart: s.windowStart,
      windowDays: s.windowDays,
    })),
  );
  const [result, setResult] = useState<{
    regionId: RegionId;
    stats: WindowAverageStats;
  } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    memoRequest("average", regionId, {
      kind: "average",
      start: windowStart,
      days: windowDays,
    }).then(({ stats, rgba }) => {
      if (!alive) return;
      const s = useApp.getState();
      if (s.regionId === regionId && s.averageData !== rgba)
        s.setAverageData(rgba);
      setResult({ regionId, stats });
    }, reportFailure);
    return () => {
      alive = false;
    };
  }, [enabled, regionId, windowStart, windowDays]);

  return enabled && result?.regionId === regionId ? result.stats : null;
}

/**
 * Finds the best grid nodes for the current region and window (top 5, ≥ 1.2 km apart). Sets
 * `discovery.running` while working and writes the results to the store. A newer call supersedes an
 * older one, which then rejects with an AbortError.
 */
export async function runDiscovery(
  criteria: DiscoveryCriteria,
): Promise<DiscoveryResult[]> {
  const s = useApp.getState();
  s.setDiscoveryRunning(true);
  try {
    const results = await request("discovery", s.regionId, {
      kind: "discovery",
      criteria,
      start: s.windowStart,
      days: s.windowDays,
    });
    const now = useApp.getState();
    if (now.regionId === s.regionId) now.setDiscoveryResults(results);
    now.setDiscoveryRunning(false);
    return results;
  } catch (e) {
    if (!(e instanceof AnalysisCancelled))
      useApp.getState().setDiscoveryRunning(false);
    throw e;
  }
}

let analyzeSeq = 0;

/**
 * One-off analysis of any point in the current region (AI tools, game). Uses the store's power preset
 * and mast height unless given. Never cancelled by other calls.
 */
export function analyzePoint(
  args: {
    x: number;
    y: number;
    siteId?: string;
    mastHeight?: number;
    id?: LanderId;
  },
  start: number,
  days: number,
): Promise<PointAnalysis> {
  const s = useApp.getState();
  return request(`analyze:${analyzeSeq++}`, s.regionId, {
    kind: "point",
    id: args.id ?? s.activeLander,
    query: {
      x: args.x,
      y: args.y,
      siteId: args.siteId,
      mastHeight: args.mastHeight ?? s.mastHeight,
    },
    start,
    days,
    power: s.power,
  });
}
