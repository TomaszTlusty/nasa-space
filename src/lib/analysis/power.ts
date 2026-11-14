import type { PowerSeries } from "@/lib/analysis/types";
import type { PowerPreset } from "@/lib/store";

/**
 * Solar constant at 1 au, W/m^2 (Kopp & Lean 2011, https://doi.org/10.1029/2010GL045777).
 * The Moon–Sun distance varies by ~±1.7 % over a year; ignored here.
 */
export const SOLAR_CONSTANT_W_M2 = 1361;

/**
 * Battery model for a lander with a VERTICAL sun-tracking array (polar landers; a flat panel sees only
 * sin(1.5°) ≈ 2.6 % of the light at the pole — Gläser et al. 2018, https://ntrs.nasa.gov/citations/20170007365).
 *
 *   watts = S0 · efficiency · area · sunFraction · cos(sunElevation)
 *
 * The state of charge starts full (100 %) at the first sample and is integrated with the trapezoid
 * rule between samples against a constant load, clamped to [0, 100]. `depletedAt` is the first instant
 * the battery reaches 0 (linearly interpolated inside the step), or null if it never does.
 */
export function simulatePower(
  sunElevDeg: ArrayLike<number>,
  sunFraction: ArrayLike<number>,
  start: number,
  stepMinutes: number,
  preset: PowerPreset,
): PowerSeries {
  const n = Math.min(sunElevDeg.length, sunFraction.length);
  const watts = new Float32Array(n);
  const socPct = new Float32Array(n);
  const peak = SOLAR_CONSTANT_W_M2 * preset.efficiency * preset.panelAreaM2;
  for (let i = 0; i < n; i++) {
    watts[i] = Math.max(0, peak * sunFraction[i] * Math.cos((sunElevDeg[i] * Math.PI) / 180));
  }
  const dtH = stepMinutes / 60;
  const capacity = Math.max(preset.batteryWh, 1e-9);
  let soc = 100;
  let minSoc = n > 0 ? 100 : 0;
  let depletedAt: number | null = null;
  let energyWh = 0;
  if (n > 0) socPct[0] = 100;
  for (let i = 1; i < n; i++) {
    const gen = ((watts[i - 1] + watts[i]) / 2) * dtH;
    energyWh += gen;
    const deltaPct = ((gen - preset.loadW * dtH) / capacity) * 100;
    const next = soc + deltaPct;
    if (next <= 0 && depletedAt === null && soc > 0) {
      depletedAt = start + ((i - 1) + soc / -deltaPct) * stepMinutes * 60_000;
    }
    soc = Math.min(100, Math.max(0, next));
    socPct[i] = soc;
    if (soc < minSoc) minSoc = soc;
  }
  return { watts, socPct, minSocPct: minSoc, depletedAt, energyWh };
}
