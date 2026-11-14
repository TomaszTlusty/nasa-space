"use client";

import { type KeyboardEvent, type PointerEvent, useLayoutEffect, useRef, useState } from "react";
import type { PointSeries } from "@/lib/analysis/types";
import { cn } from "@/lib/cn";
import { DAY, HOUR, useApp } from "@/lib/store";
import { formatClock, formatDayMonth, formatUtc } from "./format";
import { STRIPS_HEIGHT, VisibilityStrips } from "./VisibilityStrips";

interface Tick {
  t: number;
  label: string | null;
}

/** minimum px between tick labels ("15 Jan" is ~36 px in the 2xs mono face) */
const LABEL_GAP = 52;
/** px a label needs to the right of its tick before it would run past the track end */
const LABEL_W = 40;

/**
 * Ticks for the window: every 3 h on a 1-day window, else daily. Label density follows the track
 * width so labels never overlap (every day on desktop, every 2nd / 5th day on phones).
 */
function buildTicks(windowStart: number, windowDays: number, widthPx: number): Tick[] {
  const end = windowStart + windowDays * DAY;
  const ticks: Tick[] = [];
  if (windowDays === 1) {
    const pxPerHour = widthPx / 24;
    const labelHours = [3, 6, 12].find((h) => h * pxPerHour >= LABEL_GAP) ?? 24;
    for (let t = Math.ceil(windowStart / (3 * HOUR)) * 3 * HOUR; t <= end; t += 3 * HOUR) {
      ticks.push({ t, label: new Date(t).getUTCHours() % labelHours === 0 ? formatClock(t) : null });
    }
    return ticks;
  }
  const pxPerDay = widthPx / windowDays;
  const labelEvery = [1, 2, 3, 5, 7, 10, 15].find((d) => d * pxPerDay >= LABEL_GAP) ?? 30;
  let n = 0;
  for (let t = Math.ceil(windowStart / DAY) * DAY; t <= end; t += DAY, n++) {
    ticks.push({ t, label: n % labelEvery === 0 ? formatDayMonth(t) : null });
  }
  return ticks;
}

/** what the active lander sees at time t, from the hourly series */
function describe(series: PointSeries | null, t: number): { sun: string; earth: string } | null {
  if (!series) return null;
  const i = Math.floor((t - series.start) / (series.stepMinutes * 60_000));
  if (i < 0 || i >= series.sunFraction.length) return null;
  const sun = series.sunFraction[i];
  const earth = series.earthFraction[i];
  return {
    sun: sun <= 0 ? "Sun below horizon" : sun >= 1 ? "Sun fully up" : `Sun ${Math.round(sun * 100)}% visible`,
    earth: earth <= 0 ? "Earth hidden" : earth >= 1 ? "Earth in view" : `Earth ${Math.round(earth * 100)}% visible`,
  };
}

/** px the hover tooltip keeps from the track ends so it never clips (half its stacked width) */
const TOOLTIP_EDGE = 90;
/** px from the top of the scrubber to the centre line of the track */
const LABELS_H = 16;
const TRACK_Y = LABELS_H + 6;
const STRIPS_Y = TRACK_Y + 7;

/**
 * Playhead scrubber over [windowStart, windowStart + windowDays]. Drag tracks the pointer 1:1 and
 * snaps to the hour on release; arrows step 1 h (Shift: 1 d), PageUp/PageDown 1 d, Home/End ends.
 */
export function Scrubber({
  series,
  hasLander,
  className,
}: {
  series: PointSeries | null;
  hasLander: boolean;
  className?: string;
}) {
  const time = useApp((s) => s.time);
  const windowStart = useApp((s) => s.windowStart);
  const windowDays = useApp((s) => s.windowDays);
  const setTime = useApp((s) => s.setTime);
  const setPlaying = useApp((s) => s.setPlaying);

  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const pending = useRef<number | null>(null);
  const raf = useRef(0);
  /** hover position as a fraction of the track, so it stays correct when the window changes */
  const [hover, setHover] = useState<number | null>(null);
  /** track width in px; drives tick-label density and hover placement */
  const [width, setWidth] = useState(1000);

  useLayoutEffect(() => {
    const el = ref.current as HTMLDivElement;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const span = windowDays * DAY;
  const end = windowStart + span;
  const frac = Math.min(1, Math.max(0, (time - windowStart) / span));
  const ticks = buildTicks(windowStart, windowDays, width);

  const fracAt = (clientX: number) => {
    const rect = (ref.current as HTMLDivElement).getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };

  const scheduleTime = (t: number) => {
    pending.current = t;
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      if (pending.current !== null) setTime(pending.current);
    });
  };

  const endDrag = (snap: boolean) => {
    if (!dragging.current) return;
    dragging.current = false;
    setIsDragging(false);
    cancelAnimationFrame(raf.current);
    raf.current = 0;
    const t = pending.current ?? time;
    pending.current = null;
    setTime(snap ? Math.min(end, Math.max(windowStart, Math.round(t / HOUR) * HOUR)) : t);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || dragging.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus({ preventScroll: true });
    dragging.current = true;
    setIsDragging(true);
    setPlaying(false);
    scheduleTime(windowStart + fracAt(e.clientX) * span);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const f = fracAt(e.clientX);
    if (dragging.current) scheduleTime(windowStart + f * span);
    if (e.pointerType === "mouse") setHover(f);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? DAY : HOUR;
    const base = Math.round(time / HOUR) * HOUR;
    let next: number;
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowDown":
        next = base - step;
        break;
      case "ArrowRight":
      case "ArrowUp":
        next = base + step;
        break;
      case "PageDown":
        next = base - DAY;
        break;
      case "PageUp":
        next = base + DAY;
        break;
      case "Home":
        next = windowStart;
        break;
      case "End":
        next = end;
        break;
      default:
        return;
    }
    e.preventDefault();
    setTime(Math.min(end, Math.max(windowStart, next)));
  };

  const hoverT = windowStart + (hover ?? 0) * span;
  const hoverX = (hover ?? 0) * width;
  const hoverInfo = hover !== null && describe(series, hoverT);
  const hourOffset = Math.round((time - windowStart) / HOUR);

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="Mission time"
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={windowDays * 24}
      aria-valuenow={hourOffset}
      aria-valuetext={`${formatUtc(time)}, hour ${hourOffset} of ${windowDays * 24}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => endDrag(true)}
      onPointerCancel={() => endDrag(false)}
      onLostPointerCapture={() => endDrag(true)}
      onPointerLeave={() => setHover(null)}
      onKeyDown={onKeyDown}
      className={cn("relative w-full cursor-ew-resize touch-none select-none rounded-xs outline-offset-4", className)}
      style={{ height: STRIPS_Y + STRIPS_HEIGHT + 2 }}
    >
      {/* day / hour ticks */}
      {ticks.map(({ t, label }) => {
        const f = (t - windowStart) / span;
        return (
          <div key={t} aria-hidden className="pointer-events-none absolute top-0" style={{ left: `${f * 100}%` }}>
            {label && f * width + LABEL_W <= width && (
              <span className="tabular absolute top-0 left-1 whitespace-nowrap text-2xs text-fg-faint leading-none">
                {label}
              </span>
            )}
            <span
              className={cn("absolute w-px bg-line-strong", label ? "top-0" : "top-2.5")}
              style={{ height: TRACK_Y + 3 - (label ? 0 : 10) }}
            />
          </div>
        );
      })}

      {/* track */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 h-0.5 rounded-full bg-white/12"
        style={{ top: TRACK_Y - 1 }}
      />

      <div className="pointer-events-none absolute inset-x-0" style={{ top: STRIPS_Y }}>
        {hasLander ? (
          <VisibilityStrips series={series} windowStart={windowStart} windowDays={windowDays} />
        ) : (
          <div className="relative w-full rounded-[1px] bg-white/4" style={{ height: STRIPS_HEIGHT }} />
        )}
      </div>

      {/* hover cursor + tooltip */}
      {hover !== null && !isDragging && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-px bg-fg/30"
          style={{ transform: `translateX(${hoverX}px)` }}
        >
          <div
            className="absolute bottom-full mb-2 flex w-max max-w-44 flex-col gap-0.5 rounded-sm bg-surface-3 px-2.5 py-1.5 text-xs shadow-(--shadow-pop) ring-1 ring-line-strong"
            style={{
              transform: `translateX(calc(-50% + ${Math.min(Math.max(hoverX, TOOLTIP_EDGE), width - TOOLTIP_EDGE) - hoverX}px))`,
            }}
          >
            <span className="tabular whitespace-nowrap text-fg">{formatUtc(hoverT)}</span>
            {hoverInfo ? (
              <>
                <span className="text-sun">{hoverInfo.sun}</span>
                <span className="text-earth">{hoverInfo.earth}</span>
              </>
            ) : (
              <span className="text-fg-faint">
                {hasLander ? "Computing Sun and Earth" : "Place a lander to see Sun and Earth"}
              </span>
            )}
          </div>
        </div>
      )}

      {/* playhead: a zero-width layer moved by transform, so it never reflows or widens the page */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-0"
        style={{ transform: `translateX(${frac * width}px)` }}
      >
        <div
          className="absolute left-0 w-px -translate-x-1/2 bg-fg"
          style={{
            top: TRACK_Y - 6,
            height: STRIPS_Y + STRIPS_HEIGHT + 2 - (TRACK_Y - 6),
          }}
        />
        <div
          className="absolute left-0 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg shadow-[0_0_0_3px_oklch(0_0_0/0.35),0_2px_6px_oklch(0_0_0/0.5)]"
          style={{ top: TRACK_Y }}
        />
      </div>
    </div>
  );
}
