import type { PointAnalysis } from "@/lib/analysis/types";

const COLUMNS = [
  "sun_elev_deg",
  "sun_horizon_deg",
  "sun_visible_fraction",
  "earth_elev_deg",
  "earth_horizon_deg",
  "earth_visible_fraction",
  "power_w",
  "battery_soc_pct",
] as const;

function rowValues(a: PointAnalysis, i: number): string[] {
  const s = a.series;
  const f = (v: number, d: number) => (Number.isFinite(v) ? v.toFixed(d) : "");
  return [
    f(s.sunElev[i], 3),
    f(s.sunHorizon[i], 3),
    f(s.sunFraction[i], 3),
    f(s.earthElev[i], 3),
    f(s.earthHorizon[i], 3),
    f(s.earthFraction[i], 3),
    f(a.power.watts[i], 1),
    f(a.power.socPct[i], 1),
  ];
}

/**
 * Hourly series of every placed lander, one row per time step (UTC ISO), columns prefixed `A_` / `B_`.
 * Rows are keyed by timestamp so landers stay aligned even if their series differ in length.
 */
export function buildHourlyCsv(analyses: PointAnalysis[]): string {
  const rows = new Map<number, string[][]>();
  analyses.forEach((a, k) => {
    const stepMs = a.series.stepMinutes * 60_000;
    for (let i = 0; i < a.series.sunElev.length; i++) {
      const t = a.series.start + i * stepMs;
      let row = rows.get(t);
      if (!row) {
        row = analyses.map(() => COLUMNS.map(() => ""));
        rows.set(t, row);
      }
      row[k] = rowValues(a, i);
    }
  });

  const header = ["utc", ...analyses.flatMap((a) => COLUMNS.map((c) => `${a.id}_${c}`))].join(",");
  const lines = [...rows.entries()]
    .sort(([t1], [t2]) => t1 - t2)
    .map(([t, cells]) => [new Date(t).toISOString(), ...cells.flat()].join(","));
  return `${header}\n${lines.join("\n")}\n`;
}
