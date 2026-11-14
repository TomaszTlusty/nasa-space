"use client";

import { usePointAnalysis } from "@/lib/analysis";
import type { PointAnalysis } from "@/lib/analysis/types";
import { HOUR, type LanderId, useApp } from "@/lib/store";

/**
 * Point analysis for a lander, but only once it describes the lander's CURRENT placement and window.
 * While the worker is still recomputing after a move, the previous result is hidden instead of shown
 * with the wrong numbers.
 */
export function useLanderAnalysis(id: LanderId): PointAnalysis | null {
  const analysis = usePointAnalysis(id);
  const placement = useApp((s) => s.landers[id]);
  const windowStart = useApp((s) => s.windowStart);
  if (!analysis || !placement) return null;
  if (Math.hypot(analysis.x - placement.x, analysis.y - placement.y) > 50) return null;
  if (Math.abs(analysis.series.start - windowStart) > HOUR) return null;
  return analysis;
}

/** 0..1 fraction -> whole percent string */
export function pct(fraction: number): string {
  return String(Math.round(fraction * 100));
}

export function deg(value: number): string {
  return value.toFixed(1);
}
