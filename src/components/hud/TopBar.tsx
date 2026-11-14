"use client";

import { type ReactNode, useSyncExternalStore } from "react";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/cn";
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

/**
 * Floating top island: wordmark, mode, region, UTC playhead, Sun/Earth countdowns and the `right`
 * slot (Report / About). Tiers:
 * - ≥1280 px: one pill row, full labels.
 * - 768–1279 px: one pill row (≤ 56 px tall), compact labels, chips and icon-only `right` buttons.
 * - <768 px: two rows (mode + region + `right`; date + chips), 98 px tall incl. its border.
 */
export function TopBar({ right }: { right?: ReactNode }) {
  const mode = useApp((s) => s.mode);
  const setMode = useApp((s) => s.setMode);
  const wide = useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => true,
  );

  return (
    <header
      className={cn(
        "glass mx-auto flex w-fit max-w-full flex-col gap-1 rounded-2xl p-1.5",
        "md:h-14 md:flex-row md:items-center md:gap-1.5 md:rounded-full md:py-0 md:pr-2 md:pl-2.5 xl:gap-2 2xl:pl-5",
      )}
    >
      <div className="flex items-center justify-between gap-1.5 md:contents">
        <span className="mr-1 shrink-0 font-medium text-sm tracking-[-0.01em] max-2xl:hidden">Malapert</span>
        <Segmented<Mode>
          ariaLabel="Mode"
          size={wide ? "md" : "sm"}
          value={mode}
          onChange={setMode}
          options={[
            {
              value: "science",
              ariaLabel: "Mission planning",
              label: (
                <>
                  <span className="lg:hidden">Plan</span>
                  <span className="max-lg:hidden">Mission planning</span>
                </>
              ),
            },
            {
              value: "student",
              ariaLabel: "Explore & learn",
              label: (
                <>
                  <span className="lg:hidden">Learn</span>
                  <span className="max-lg:hidden">Explore &amp; learn</span>
                </>
              ),
            },
          ]}
        />
        <span aria-hidden className="h-6 w-px shrink-0 bg-line max-xl:hidden" />
        <RegionSelect />
        {right && (
          <div
            className={cn(
              "flex shrink-0 items-center md:order-last md:ml-0.5",
              // below 1280 px text buttons in the slot (Report) collapse to their icons; the text stays
              // in the DOM as the accessible name
              "max-xl:[&_button:not([aria-label])]:gap-1 max-xl:[&_button:not([aria-label])]:px-2 max-xl:[&_button:not([aria-label])]:text-[0px]",
            )}
          >
            {right}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-1.5 md:contents">
        <DateJump />
        <span aria-hidden className="h-6 w-px shrink-0 bg-line max-xl:hidden" />
        <Countdowns />
      </div>
    </header>
  );
}
