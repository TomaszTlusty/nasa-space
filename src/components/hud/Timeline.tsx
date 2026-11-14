"use client";

import { Pause, Play } from "@phosphor-icons/react";
import { useEffect } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/overlay";
import { Panel } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { usePointAnalysis } from "@/lib/analysis";
import {
  DATE_MAX,
  DATE_MIN,
  DAY,
  HOUR,
  useApp,
  type WindowDays,
} from "@/lib/store";
import { formatDuration } from "./format";
import { Scrubber } from "./Scrubber";
import { usePlayLoop } from "./use-play-loop";

const SPEEDS = [
  { value: "1", label: "1 h/s" },
  { value: "6", label: "6 h/s" },
  { value: "24", label: "1 d/s" },
];

const WINDOWS = [
  { value: "1", label: "1 d" },
  { value: "7", label: "7 d" },
  { value: "15", label: "15 d" },
  { value: "30", label: "30 d" },
];

const SLIPS = [-1, 3, 7];

/** Restart from the window start when play is pressed at (or within an hour of) the end. */
function togglePlay() {
  const s = useApp.getState();
  if (!s.playing && s.time >= s.windowStart + s.windowDays * DAY - HOUR / 2)
    s.setTime(s.windowStart);
  s.setPlaying(!s.playing);
}

/**
 * Bottom timeline: play/pause, speed, window length, launch slip and the playhead scrubber with the
 * active lander's Sun/Earth strips. Also runs the play loop, so mount exactly one.
 */
export function Timeline() {
  usePlayLoop();
  const playing = useApp((s) => s.playing);
  const speed = useApp((s) => s.speed);
  const setSpeed = useApp((s) => s.setSpeed);
  const time = useApp((s) => s.time);
  const windowStart = useApp((s) => s.windowStart);
  const windowDays = useApp((s) => s.windowDays);
  const setWindow = useApp((s) => s.setWindow);
  const setTime = useApp((s) => s.setTime);
  const slipDays = useApp((s) => s.slipDays);
  const activeLander = useApp((s) => s.activeLander);
  const hasLander = useApp((s) => s.landers[s.activeLander] !== undefined);
  const analysis = usePointAnalysis(activeLander);

  // Space toggles playback anywhere except where Space types or activates something itself.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || e.metaKey || e.ctrlKey || e.altKey)
        return;
      const el = e.target instanceof Element ? e.target : null;
      if (
        el?.closest(
          'input, textarea, select, button, a[href], [contenteditable=""], [contenteditable="true"], [role="button"], [role="option"], [role="menuitem"], [role="switch"], [role="checkbox"], [role="textbox"], [role="combobox"]',
        )
      ) {
        return;
      }
      e.preventDefault();
      togglePlay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const changeWindow = (v: string) => {
    const days = Number(v) as WindowDays;
    const start = Math.min(windowStart, DATE_MAX - days * DAY);
    setWindow(start, days);
    // keep the playhead where it was if it is still inside the new window
    if (time >= start && time <= start + days * DAY) setTime(time);
  };

  const latestStart = DATE_MAX - windowDays * DAY;
  const elapsed = Math.max(0, time - windowStart);

  return (
    <Panel
      aria-label="Timeline"
      className="mx-auto flex w-full max-w-[1100px] flex-col gap-2 rounded-2xl px-4 pt-2.5 pb-3"
    >
      <div className="flex items-center gap-3">
        <IconButton
          label={playing ? "Pause (Space)" : "Play (Space)"}
          variant="secondary"
          size="md"
          onClick={togglePlay}
          className="shrink-0 rounded-full"
        >
          {playing ? (
            <Pause size={16} weight="regular" />
          ) : (
            <Play size={16} weight="regular" />
          )}
        </IconButton>

        <div className="flex w-[8.5rem] shrink-0 flex-col leading-none">
          <span className="eyebrow">Since landing</span>
          <span className="tabular mt-1 text-fg text-sm">
            {elapsed < HOUR / 2 ? "0 h" : formatDuration(elapsed)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="eyebrow max-lg:hidden">Speed</span>
          <Segmented
            ariaLabel="Playback speed"
            size="sm"
            value={String(speed)}
            onChange={(v) => setSpeed(Number(v))}
            options={SPEEDS.map((o) => ({
              ...o,
              label: <span className="tabular">{o.label}</span>,
            }))}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="eyebrow max-lg:hidden">Window</span>
          <Segmented
            ariaLabel="Mission window length"
            size="sm"
            value={String(windowDays)}
            onChange={changeWindow}
            options={WINDOWS.map((o) => ({
              ...o,
              label: <span className="tabular">{o.label}</span>,
            }))}
          />
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <span className="eyebrow mr-1">Launch slip</span>
          {SLIPS.map((d) => {
            const target = windowStart + d * DAY;
            const label = `${d > 0 ? "+" : "\u2212"}${Math.abs(d)} d`;
            return (
              <Tooltip
                key={d}
                content={`Launch ${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"} ${d > 0 ? "later" : "earlier"}: the same spot sees a different Sun and Earth`}
              >
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={`Slip launch by ${d} day${Math.abs(d) === 1 ? "" : "s"}`}
                  disabled={target < DATE_MIN || target > latestStart}
                  onClick={() => slipDays(d)}
                  className="tabular min-w-11 px-2"
                >
                  {label}
                </Button>
              </Tooltip>
            );
          })}
        </div>
      </div>

      <Scrubber
        series={hasLander ? (analysis?.series ?? null) : null}
        hasLander={hasLander}
      />
    </Panel>
  );
}
