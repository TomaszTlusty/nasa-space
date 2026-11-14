"use client";

import { ArrowDown, ArrowUp, GlobeHemisphereWest, Sun } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { Tooltip } from "@/components/ui/overlay";
import { useTransitions } from "@/lib/analysis";
import { cn } from "@/lib/cn";
import { useApp } from "@/lib/store";
import { formatDuration, formatUtc } from "./format";

/**
 * Countdown to the next Sun / Earth horizon crossing at the active lander, recomputed from the
 * playhead so it ticks while playing or scrubbing. This is the challenge's core requirement.
 * From 1280 px chips read "Sunset in 41 h 12 m"; narrower they compact to icon + arrow + "41h 12m".
 */
export function Countdowns() {
  const activeLander = useApp((s) => s.activeLander);
  const placed = useApp((s) => s.landers[s.activeLander] !== undefined);
  const time = useApp((s) => s.time);
  const transitions = useTransitions(activeLander);

  if (!placed) {
    return (
      <span className="flex h-8 items-center whitespace-nowrap rounded-full px-3 text-2xs text-fg-faint ring-1 ring-line xl:text-xs">
        Place a lander to see countdowns
      </span>
    );
  }

  const sunUp = transitions?.sunUp;
  const earthUp = transitions?.earthUp;
  const sunEvent = transitions ? (transitions.sunUp ? transitions.sunset : transitions.sunrise) : undefined;
  const earthEvent = transitions ? (transitions.earthUp ? transitions.earthset : transitions.earthrise) : undefined;

  return (
    <div className="flex items-center gap-1.5">
      <span className="sr-only">Countdowns for lander {activeLander}:</span>
      <span aria-hidden className="eyebrow tabular mr-0.5">
        {activeLander}
      </span>
      <Chip
        tone="sun"
        icon={<Sun size={14} weight="regular" />}
        up={sunUp}
        label={sunUp === undefined ? "Sun" : sunUp ? "Sunset" : "Sunrise"}
        event={sunEvent}
        time={time}
        stuck={sunUp ? "Sun stays up" : "Sun stays down"}
        stuckShort={sunUp ? "stays up" : "stays down"}
      />
      <Chip
        tone="earth"
        icon={<GlobeHemisphereWest size={14} weight="regular" />}
        up={earthUp}
        label={earthUp === undefined ? "Earth" : earthUp ? "Earthset" : "Earthrise"}
        event={earthEvent}
        time={time}
        stuck={earthUp ? "Earth stays up" : "Earth stays hidden"}
        stuckShort={earthUp ? "stays up" : "stays hidden"}
      />
    </div>
  );
}

function Chip({
  tone,
  icon,
  up,
  label,
  event,
  time,
  stuck,
  stuckShort,
}: {
  tone: "sun" | "earth";
  icon: ReactNode;
  /** body currently above the horizon: the next event is a set (arrow down) */
  up: boolean | undefined;
  label: string;
  /** undefined = still computing / stale; null = no crossing within the analysis search span */
  event: number | null | undefined;
  time: number;
  stuck: string;
  stuckShort: string;
}) {
  let text: ReactNode;
  let hint: string;
  // an event at or before the playhead means the result predates the latest scrub: wait for fresh data
  if (event === undefined || (event !== null && event <= time)) {
    text = (
      <>
        <span aria-hidden className="text-fg-faint">
          …
        </span>
        <span className="sr-only">{tone === "sun" ? "Sun" : "Earth"} countdown computing</span>
      </>
    );
    hint = "Computing horizon crossings for this spot";
  } else if (event === null) {
    text = (
      <>
        <span className="max-xl:hidden">{stuck}</span>
        <span className="xl:hidden">{stuckShort}</span>
      </>
    );
    hint = `${stuck} for the rest of the search span`;
  } else {
    const Arrow = up ? ArrowDown : ArrowUp;
    text = (
      <>
        <span className="max-xl:hidden">
          {label} in <span className="tabular font-medium">{formatDuration(event - time)}</span>
        </span>
        <span className="flex items-center gap-0.5 xl:hidden">
          <Arrow aria-hidden size={11} weight="bold" />
          <span className="sr-only">{label} in </span>
          <span className="tabular font-medium">{formatDuration(event - time, true)}</span>
        </span>
      </>
    );
    hint = `${label} at ${formatUtc(event)}, seen from the real terrain horizon`;
  }

  return (
    <Tooltip content={hint} side="bottom">
      <span
        className={cn(
          "flex h-8 min-w-[6rem] items-center gap-1 whitespace-nowrap rounded-full px-2 text-2xs ring-1",
          "md:min-w-[6.5rem] md:gap-1.5 md:px-2.5 xl:min-w-[11.75rem] xl:px-3 xl:text-xs",
          tone === "sun" ? "bg-sun-soft text-sun ring-sun/25" : "bg-earth-soft text-earth ring-earth/25",
        )}
      >
        <span aria-hidden className="shrink-0">
          {icon}
        </span>
        {text}
      </span>
    </Tooltip>
  );
}
