"use client";

import { CalendarBlank } from "@phosphor-icons/react";
import { useState } from "react";
import { Popover } from "@/components/ui/overlay";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/cn";
import { DATE_MAX, DATE_MIN, DAY, HOUR, useApp } from "@/lib/store";
import { formatClock, formatDate, toDateInput } from "./format";

/** UTC playhead readout; opens a popover to move the mission window (landing date + hour). */
export function DateJump() {
  const time = useApp((s) => s.time);
  const windowStart = useApp((s) => s.windowStart);
  const windowDays = useApp((s) => s.windowDays);
  const setWindow = useApp((s) => s.setWindow);
  /** hour being dragged; null when the slider is at rest and mirrors the store */
  const [dragHour, setDragHour] = useState<number | null>(null);

  const latestStart = DATE_MAX - windowDays * DAY;
  const dayStart = Math.floor(windowStart / DAY) * DAY;
  const storeHour = Math.round((windowStart - dayStart) / HOUR);
  const hour = dragHour ?? storeHour;

  const jump = (day: number, h: number) => {
    setWindow(Math.min(latestStart, Math.max(DATE_MIN, day + h * HOUR)));
  };

  return (
    <Popover
      align="center"
      trigger={
        <button
          type="button"
          aria-label={`Date and time ${formatDate(time)} ${formatClock(time)} UTC. Change landing date`}
          className={cn(
            "flex h-10 select-none items-center gap-2 rounded-full px-3 text-fg",
            "transition-[background-color,transform] duration-150 ease-(--ease-out) hover:bg-white/5 active:scale-[0.97]",
            "data-popup-open:bg-white/5",
          )}
        >
          <CalendarBlank size={15} weight="light" className="shrink-0 text-fg-faint" />
          <span className="tabular whitespace-nowrap text-xs">
            {formatDate(time)} <span className="text-fg-muted">{formatClock(time)}</span>
            <span className="ml-1 text-fg-faint">UTC</span>
          </span>
        </button>
      }
      className="w-72"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="eyebrow">Landing date</span>
          <p className="text-fg-muted text-xs">Moves the mission window start. Times are UTC.</p>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-fg-muted text-xs">Date</span>
          <input
            type="date"
            required
            value={toDateInput(windowStart)}
            min={toDateInput(DATE_MIN)}
            max={toDateInput(latestStart)}
            onChange={(e) => {
              const v = e.currentTarget.valueAsNumber;
              if (Number.isFinite(v)) jump(v, storeHour);
            }}
            className="tabular h-9 rounded-md bg-black/30 px-2.5 text-fg text-sm ring-1 ring-line focus-visible:ring-line-strong"
          />
        </label>
        <Slider
          label="Hour"
          valueLabel={`${String(hour).padStart(2, "0")}:00`}
          value={hour}
          min={0}
          max={23}
          step={1}
          tone="neutral"
          onChange={setDragHour}
          onCommit={(h) => {
            setDragHour(null);
            jump(dayStart, h);
          }}
        />
      </div>
    </Popover>
  );
}
