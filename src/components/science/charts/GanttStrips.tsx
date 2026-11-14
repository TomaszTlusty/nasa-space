"use client";

import type { KeyboardEvent, PointerEvent } from "react";
import type { Interval, PointAnalysis } from "@/lib/analysis/types";
import { cn } from "@/lib/cn";
import { HOUR, useApp } from "@/lib/store";
import { tickLabel } from "./series";

interface Strip {
  key: string;
  label: string;
  windows: Interval[];
  tone: "sun" | "earth";
  thin: boolean;
}

function strips(a: PointAnalysis | null, b: PointAnalysis | null): Strip[] {
  const out: Strip[] = [];
  for (const [id, p] of [
    ["A", a],
    ["B", b],
  ] as const) {
    if (!p) continue;
    out.push({
      key: `${id}-sun`,
      label: `${id} · Sun`,
      windows: p.sunWindows,
      tone: "sun",
      thin: id === "B",
    });
    out.push({
      key: `${id}-earth`,
      label: `${id} · Earth link`,
      windows: p.earthWindows,
      tone: "earth",
      thin: id === "B",
    });
  }
  return out;
}

/**
 * Gantt view of when the Sun is in view (power) and when Earth is in view (direct-to-Earth radio).
 * Click or drag on the strips to move the playhead; arrow keys step 1 h (Shift: 1 day).
 */
export function GanttStrips({
  a,
  b,
  domain,
  ticks,
}: {
  a: PointAnalysis | null;
  b: PointAnalysis | null;
  domain: [number, number];
  ticks: number[];
}) {
  const time = useApp((s) => s.time);
  const setTime = useApp((s) => s.setTime);
  const span = domain[1] - domain[0];
  const x = (t: number) => ((Math.min(domain[1], Math.max(domain[0], t)) - domain[0]) / span) * 100;
  const playheadIn = time >= domain[0] && time <= domain[1];
  const rows = strips(a, b);

  const seek = (e: PointerEvent<HTMLDivElement>) => {
    if (e.type === "pointermove" && e.buttons !== 1) return;
    const r = e.currentTarget.getBoundingClientRect();
    setTime(domain[0] + Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * span);
  };

  const nudge = (e: KeyboardEvent<HTMLDivElement>) => {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    setTime(time + dir * (e.shiftKey ? 24 : 1) * HOUR);
  };

  return (
    <div className="flex h-full flex-col gap-1.5 px-1 pb-1">
      <div className="flex min-h-0 flex-1 gap-3">
        <div className="flex w-24 shrink-0 flex-col justify-around">
          {rows.map((s) => (
            <span key={s.key} className="truncate text-2xs text-fg-muted">
              {s.label}
            </span>
          ))}
        </div>
        <div
          role="slider"
          tabIndex={0}
          aria-label="Playhead time (arrow keys: 1 hour, Shift: 1 day)"
          aria-valuemin={domain[0]}
          aria-valuemax={domain[1]}
          aria-valuenow={time}
          aria-valuetext={new Date(time).toISOString().slice(0, 16).replace("T", " ")}
          className="relative min-w-0 flex-1 cursor-crosshair touch-none rounded-xs"
          onPointerDown={seek}
          onPointerMove={seek}
          onKeyDown={nudge}
        >
          {ticks.map((t) => (
            <div key={t} className="absolute inset-y-0 w-px bg-line" style={{ left: `${x(t)}%` }} />
          ))}
          <div className="absolute inset-0 flex flex-col justify-around">
            {rows.map((s) => (
              <div key={s.key} className={cn("relative rounded-full bg-night-soft", s.thin ? "h-2" : "h-3")}>
                {s.windows.map((w) =>
                  w.end <= domain[0] || w.start >= domain[1] ? null : (
                    <div
                      key={w.start}
                      className={cn(
                        "absolute inset-y-0 rounded-full",
                        s.tone === "sun" ? "bg-sun" : "bg-earth",
                        s.thin && "opacity-70",
                      )}
                      style={{
                        left: `${x(w.start)}%`,
                        width: `${Math.max(0.15, x(w.end) - x(w.start))}%`,
                      }}
                    />
                  ),
                )}
              </div>
            ))}
          </div>
          {playheadIn && <div className="absolute inset-y-0 w-px bg-beacon" style={{ left: `${x(time)}%` }} />}
        </div>
      </div>
      <div className="flex gap-3">
        <div className="w-24 shrink-0" />
        <div className="relative h-4 min-w-0 flex-1">
          {ticks.map((t) => (
            <span
              key={t}
              className="tabular absolute -translate-x-1/2 whitespace-nowrap text-[10px] text-fg-faint"
              style={{ left: `${x(t)}%` }}
            >
              {tickLabel(t, domain)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
