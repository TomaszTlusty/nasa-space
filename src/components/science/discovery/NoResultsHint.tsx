"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useWindowAverage } from "@/lib/analysis";
import type { DiscoveryCriteria, RegionId } from "@/lib/store";
import { useRegion } from "@/lib/use-region";

type Criterion = keyof DiscoveryCriteria;

const NAMES: Record<Criterion, string> = {
  maxSlopeDeg: "max slope",
  minSun: "min average sunlight",
  minEarth: "min Earth contact",
};

interface Diagnosis {
  /** best single relaxation: the criterion whose removal lets the most grid points through */
  relax: { criterion: Criterion; passing: number; value: number } | null;
  /** grid points passing each criterion on its own */
  alone: Record<Criterion, number>;
}

/**
 * Same per-node tests as the discovery worker (`pickCandidates` in src/lib/analysis/compute.ts) on the
 * same window-average grids, so the suggested value is guaranteed to return at least one site.
 */
function diagnose(sun: Float32Array, earth: Float32Array, slope: Uint8Array, c: DiscoveryCriteria): Diagnosis {
  const alone = { maxSlopeDeg: 0, minSun: 0, minEarth: 0 };
  const without = { maxSlopeDeg: 0, minSun: 0, minEarth: 0 };
  let minSlope = Number.POSITIVE_INFINITY;
  let maxSun = 0;
  let maxEarth = 0;
  for (let i = 0; i < sun.length; i++) {
    const okSlope = slope[i] <= c.maxSlopeDeg;
    const okSun = sun[i] >= c.minSun;
    const okEarth = earth[i] >= c.minEarth;
    if (okSlope) alone.maxSlopeDeg++;
    if (okSun) alone.minSun++;
    if (okEarth) alone.minEarth++;
    if (okSun && okEarth) {
      without.maxSlopeDeg++;
      minSlope = Math.min(minSlope, slope[i]);
    }
    if (okSlope && okEarth) {
      without.minSun++;
      maxSun = Math.max(maxSun, sun[i]);
    }
    if (okSlope && okSun) {
      without.minEarth++;
      maxEarth = Math.max(maxEarth, earth[i]);
    }
  }
  // Slider-step values that admit the best node: slope 1° steps (max 20°), percentages 5% steps.
  const options: { criterion: Criterion; passing: number; value: number }[] = [
    { criterion: "maxSlopeDeg", passing: without.maxSlopeDeg, value: Math.ceil(minSlope) },
    { criterion: "minSun", passing: without.minSun, value: Math.floor(maxSun * 20) / 20 },
    { criterion: "minEarth", passing: without.minEarth, value: Math.floor(maxEarth * 20) / 20 },
  ];
  const feasible = options.filter((o) => o.passing > 0 && (o.criterion !== "maxSlopeDeg" || o.value <= 20));
  feasible.sort((a, b) => b.passing - a.passing);
  return { relax: feasible[0] ?? null, alone };
}

const fmt = (criterion: Criterion, v: number) => (criterion === "maxSlopeDeg" ? `${v}°` : `${Math.round(v * 100)}%`);

/** Explains an empty discovery search: which filter blocks it and the value that would return a site. */
export function NoResultsHint({
  regionId,
  criteria,
  onApply,
}: {
  regionId: RegionId;
  criteria: DiscoveryCriteria;
  onApply: (next: DiscoveryCriteria) => void;
}) {
  const stats = useWindowAverage(true);
  const { region } = useRegion(regionId);
  const diagnosis = useMemo(
    () => (stats && region ? diagnose(stats.sun, stats.earth, region.slope, criteria) : null),
    [stats, region, criteria],
  );

  if (!diagnosis) {
    return <p className="text-fg-muted text-xs">No spot meets all three. Checking which filter blocks it…</p>;
  }

  const { relax, alone } = diagnosis;
  if (!relax) {
    const tightest = (Object.keys(alone) as Criterion[]).reduce((a, b) => (alone[b] < alone[a] ? b : a));
    return (
      <p className="text-fg-muted text-xs">
        No spot meets even two of them. On its own,{" "}
        <span className="tabular">
          {alone.maxSlopeDeg.toLocaleString("en-US")} / {alone.minSun.toLocaleString("en-US")} /{" "}
          {alone.minEarth.toLocaleString("en-US")}
        </span>{" "}
        grid points pass slope / sunlight / Earth. Relax {NAMES[tightest]} first.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-fg-muted text-xs">
        No spot meets all three. The <span className="text-fg">{NAMES[relax.criterion]}</span> filter blocks the most:{" "}
        <span className="tabular">{relax.passing.toLocaleString("en-US")}</span> grid points pass the other two. Setting
        it to <span className="tabular text-fg">{fmt(relax.criterion, relax.value)}</span> finds at least one site.
      </p>
      <Button
        variant="secondary"
        size="sm"
        className="self-start"
        onClick={() => onApply({ ...criteria, [relax.criterion]: relax.value })}
      >
        Use {fmt(relax.criterion, relax.value)} and search
      </Button>
    </div>
  );
}
