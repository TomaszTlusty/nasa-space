"use client";

import { useEffect, useRef, useState } from "react";
import type { PointSeries } from "@/lib/analysis/types";
import { cn } from "@/lib/cn";
import { HOUR } from "@/lib/store";

/** strip geometry in px: Sun row on top, Earth row below */
const ROW = 5;
const GAP = 3;
export const STRIPS_HEIGHT = ROW * 2 + GAP;
const FADE_MS = 180;

interface Run {
  x: number;
  w: number;
  opacity: number;
}

/**
 * Merge hourly samples into runs of equal (ceil to 10 %) visible fraction. x/w are hours from the
 * window start, so the SVG viewBox maps time linearly onto the track width.
 */
function toRuns(values: Float32Array, offsetH: number, stepH: number): Run[] {
  const runs: Run[] = [];
  let current: Run | null = null;
  for (let i = 0; i < values.length; i++) {
    const q = values[i] > 0 ? Math.ceil(values[i] * 10) / 10 : 0;
    if (current && current.opacity === q) {
      current.w += stepH;
      continue;
    }
    current = { x: offsetH + i * stepH, w: stepH, opacity: q };
    if (q > 0) runs.push(current);
  }
  return runs;
}

function StripLayer({
  series,
  windowStart,
  spanH,
  current,
}: {
  series: PointSeries;
  windowStart: number;
  spanH: number;
  current: boolean;
}) {
  const offsetH = (series.start - windowStart) / HOUR;
  const stepH = series.stepMinutes / 60;
  const sun = toRuns(series.sunFraction, offsetH, stepH);
  const earth = toRuns(series.earthFraction, offsetH, stepH);
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${spanH} ${STRIPS_HEIGHT}`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      className={cn(
        "absolute inset-0 size-full transition-opacity ease-(--ease-out)",
        current ? "opacity-100 starting:opacity-0" : "opacity-0",
      )}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      {sun.map((r) => (
        <rect
          key={`s${r.x}`}
          x={r.x}
          y={0}
          width={r.w}
          height={ROW}
          fill="var(--color-sun)"
          opacity={r.opacity}
        />
      ))}
      {earth.map((r) => (
        <rect
          key={`e${r.x}`}
          x={r.x}
          y={ROW + GAP}
          width={r.w}
          height={ROW}
          fill="var(--color-earth)"
          opacity={r.opacity}
        />
      ))}
    </svg>
  );
}

/**
 * Sun (amber) and Earth (blue) visibility under the scrubber for the active lander; slate = shadow /
 * no direct link. A new analysis (launch slip, window change, moved lander) crossfades in.
 */
export function VisibilityStrips({
  series,
  windowStart,
  windowDays,
}: {
  series: PointSeries | null;
  windowStart: number;
  windowDays: number;
}) {
  const [layers, setLayers] = useState<{ key: number; series: PointSeries }[]>(
    [],
  );
  const nextKey = useRef(0);

  useEffect(() => {
    if (!series) {
      setLayers([]);
      return;
    }
    const key = nextKey.current++;
    setLayers((prev) => [...prev.slice(-1), { key, series }]);
    const id = window.setTimeout(
      () => setLayers((prev) => prev.filter((l) => l.key >= key)),
      FADE_MS + 40,
    );
    return () => window.clearTimeout(id);
  }, [series]);

  const spanH = windowDays * 24;
  return (
    <div className="relative w-full" style={{ height: STRIPS_HEIGHT }}>
      <div
        className="absolute inset-x-0 top-0 rounded-[1px] bg-night-soft"
        style={{ height: ROW }}
      />
      <div
        className="absolute inset-x-0 rounded-[1px] bg-night-soft"
        style={{ top: ROW + GAP, height: ROW }}
      />
      {layers.map((l, i) => (
        <StripLayer
          key={l.key}
          series={l.series}
          windowStart={windowStart}
          spanH={spanH}
          current={i === layers.length - 1}
        />
      ))}
    </div>
  );
}
