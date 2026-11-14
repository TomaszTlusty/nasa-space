import type { PointAnalysis } from "@/lib/analysis/types";
import { DAY, HOUR } from "@/lib/store";

/** One decimated chart sample; B fields are absent when B has no analysis. */
export interface ChartRow {
  t: number;
  aSunElev?: number;
  aSunHorizon?: number;
  aEarthElev?: number;
  aEarthHorizon?: number;
  aWatts?: number;
  aSoc?: number;
  bSunElev?: number;
  bSunHorizon?: number;
  bEarthElev?: number;
  bEarthHorizon?: number;
  bWatts?: number;
  bSoc?: number;
}

export interface ChartData {
  rows: ChartRow[];
  domain: [number, number];
  ticks: number[];
}

export const MAX_POINTS = 720;

type Prefix = "a" | "b";

function fill(rows: ChartRow[], p: PointAnalysis, prefix: Prefix) {
  const { series, power } = p;
  const stepMs = series.stepMinutes * 60_000;
  const n = series.sunElev.length;
  for (let r = 0; r < rows.length; r++) {
    const lo = Math.max(0, Math.round((rows[r].t - series.start) / stepMs));
    const hi = Math.min(
      n,
      r + 1 < rows.length
        ? Math.round((rows[r + 1].t - series.start) / stepMs)
        : n,
    );
    if (lo >= n || hi <= lo) continue;
    // Elevation/horizon: point sample; power: bucket mean; battery: bucket minimum so the lowest
    // state of charge survives decimation.
    let watts = 0;
    let soc = Number.POSITIVE_INFINITY;
    for (let i = lo; i < hi; i++) {
      watts += power.watts[i];
      soc = Math.min(soc, power.socPct[i]);
    }
    const row = rows[r];
    row[`${prefix}SunElev`] = series.sunElev[lo];
    row[`${prefix}SunHorizon`] = series.sunHorizon[lo];
    row[`${prefix}EarthElev`] = series.earthElev[lo];
    row[`${prefix}EarthHorizon`] = series.earthHorizon[lo];
    row[`${prefix}Watts`] = watts / (hi - lo);
    row[`${prefix}Soc`] = soc;
  }
}

const TICK_STEPS = [
  3 * HOUR,
  6 * HOUR,
  12 * HOUR,
  DAY,
  2 * DAY,
  5 * DAY,
  10 * DAY,
];

/** Ticks on whole UTC hours/days, at most 8 across the domain. */
export function timeTicks([start, end]: [number, number]): number[] {
  const span = end - start;
  const step =
    TICK_STEPS.find((s) => span / s <= 8) ?? TICK_STEPS[TICK_STEPS.length - 1];
  const ticks: number[] = [];
  for (let t = Math.ceil(start / step) * step; t <= end; t += step)
    ticks.push(t);
  return ticks;
}

export function tickLabel(t: number, domain: [number, number]): string {
  const d = new Date(t);
  return domain[1] - domain[0] <= 2 * DAY
    ? d.toISOString().slice(11, 16)
    : d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      });
}

/**
 * Merges the A and B window series onto one decimated time axis (≤ MAX_POINTS rows). The axis comes
 * from A when present, otherwise from B; B samples are looked up by time so a stale B window still lines up.
 */
export function buildChartData(
  a: PointAnalysis | null,
  b: PointAnalysis | null,
): ChartData | null {
  const base = a ?? b;
  if (!base) return null;
  const { start, stepMinutes } = base.series;
  const n = base.series.sunElev.length;
  const stepMs = stepMinutes * 60_000;
  const stride = Math.max(1, Math.ceil(n / MAX_POINTS));
  const rows: ChartRow[] = [];
  for (let i = 0; i < n; i += stride) rows.push({ t: start + i * stepMs });
  if (a) fill(rows, a, "a");
  if (b) fill(rows, b, "b");
  const domain: [number, number] = [start, start + (n - 1) * stepMs];
  return { rows, domain, ticks: timeTicks(domain) };
}
