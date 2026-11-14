"use client";

import { type ReactNode, useSyncExternalStore } from "react";
import { Segmented } from "@/components/ui/segmented";
import { type Mode, useApp } from "@/lib/store";
import { Countdowns } from "./Countdowns";
import { DateJump } from "./DateJump";
import { RegionSelect } from "./RegionSelect";

const WIDE_QUERY = "(min-width: 1280px)";

function subscribeWide(onChange: () => void) {
  const mq = window.matchMedia(WIDE_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** Floating top island: wordmark, mode, region, UTC playhead and the Sun/Earth countdowns. */
export function TopBar({ right }: { right?: ReactNode }) {
  const mode = useApp((s) => s.mode);
  const setMode = useApp((s) => s.setMode);
  // below 1280 px the island compacts so it still fits at 1024 px
  const wide = useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => true,
  );

  return (
    <header className="glass mx-auto flex h-14 w-fit max-w-full items-center gap-1.5 rounded-full pr-2 pl-3 xl:gap-2 xl:pl-5">
      <span className="mr-1 shrink-0 font-medium text-sm tracking-[-0.01em] max-xl:hidden">
        Malapert
      </span>
      <Segmented<Mode>
        ariaLabel="Mode"
        size={wide ? "md" : "sm"}
        value={mode}
        onChange={setMode}
        options={[
          { value: "science", label: "Mission planning" },
          { value: "student", label: "Explore & learn" },
        ]}
      />
      <span aria-hidden className="h-6 w-px shrink-0 bg-line max-xl:hidden" />
      <RegionSelect />
      <DateJump />
      <span aria-hidden className="h-6 w-px shrink-0 bg-line max-xl:hidden" />
      <Countdowns />
      {right && (
        <div className="ml-1 flex shrink-0 items-center gap-1">{right}</div>
      )}
    </header>
  );
}
