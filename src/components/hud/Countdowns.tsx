"use client";

import { GlobeHemisphereWest, Sun } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { Tooltip } from "@/components/ui/overlay";
import { useTransitions } from "@/lib/analysis";
import { cn } from "@/lib/cn";
import { useApp } from "@/lib/store";
import { formatDuration, formatUtc } from "./format";

/**
 * Countdown to the next Sun / Earth horizon crossing at the active lander, recomputed from the
 * playhead so it ticks while playing or scrubbing. This is the challenge's core requirement.
 */
export function Countdowns() {
  const activeLander = useApp((s) => s.activeLander);
  const placed = useApp((s) => s.landers[s.activeLander] !== undefined);
  const time = useApp((s) => s.time);
  const transitions = useTransitions(activeLander);

  if (!placed) {
    return (
      <span className="flex h-8 items-center whitespace-nowrap rounded-full px-3 text-fg-faint text-xs ring-1 ring-line">
        Place a lander to see countdowns
      </span>
    );
  }

  const sunUp = transitions?.sunUp;
  const earthUp = transitions?.earthUp;
  const sunEvent = transitions
    ? transitions.sunUp
      ? transitions.sunset
      : transitions.sunrise
    : undefined;
  const earthEvent = transitions
    ? transitions.earthUp
      ? transitions.earthset
      : transitions.earthrise
    : undefined;

  return (
    <div className="flex items-center gap-1.5">
      <span className="sr-only">Countdowns for lander {activeLander}:</span>
      <span aria-hidden className="eyebrow tabular mr-0.5">
        {activeLander}
      </span>
      <Chip
        tone="sun"
        icon={<Sun size={14} weight="regular" />}
        label={sunUp === undefined ? "Sun" : sunUp ? "Sunset" : "Sunrise"}
        event={sunEvent}
        time={time}
        stuck={sunUp ? "Sun stays up" : "Sun stays down"}
      />
      <Chip
        tone="earth"
        icon={<GlobeHemisphereWest size={14} weight="regular" />}
        label={
          earthUp === undefined ? "Earth" : earthUp ? "Earthset" : "Earthrise"
        }
        event={earthEvent}
        time={time}
        stuck={earthUp ? "Earth stays up" : "Earth stays hidden"}
      />
    </div>
  );
}

function Chip({
  tone,
  icon,
  label,
  event,
  time,
  stuck,
}: {
  tone: "sun" | "earth";
  icon: ReactNode;
  label: string;
  /** undefined = still computing; null = no crossing within the analysis search span */
  event: number | null | undefined;
  time: number;
  stuck: string;
}) {
  let text: ReactNode;
  let hint: string;
  if (event === undefined) {
    text = <span className="text-fg-faint">computing</span>;
    hint = "Computing horizon crossings for this spot";
  } else if (event === null) {
    text = stuck;
    hint = `${stuck} for the rest of the search span`;
  } else {
    text = (
      <>
        {label} in{" "}
        <span className="tabular font-medium">
          {formatDuration(event - time)}
        </span>
      </>
    );
    hint = `${label} at ${formatUtc(event)}, seen from the real terrain horizon`;
  }

  return (
    <Tooltip content={hint} side="bottom">
      <span
        className={cn(
          "flex h-8 min-w-[10.75rem] items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-2xs ring-1",
          "xl:min-w-[12rem] xl:text-xs",
          tone === "sun"
            ? "bg-sun-soft text-sun ring-sun/25"
            : "bg-earth-soft text-earth ring-earth/25",
        )}
      >
        <span className="shrink-0">{icon}</span>
        <span>{text}</span>
      </span>
    </Tooltip>
  );
}
