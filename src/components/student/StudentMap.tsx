"use client";

import { Segmented } from "@/components/ui/segmented";
import { useWindowAverage } from "@/lib/analysis";
import { type Overlay, useApp } from "@/lib/store";

type StudentOverlay = Extract<Overlay, "none" | "instant" | "average">;

const HINT: Record<StudentOverlay, string> = {
  none: "The real Moon, lit by the Sun at this moment.",
  instant: "Amber ground is in sunlight right now. Blue stripes can see Earth.",
  average: "Brighter means more sunlight over the whole mission window. Purple stays dark.",
};

/** Learning-mode map colouring: always lets the student get back to the plain terrain. */
export function StudentMap() {
  const overlay = useApp((s) => s.overlay);
  const setOverlay = useApp((s) => s.setOverlay);
  // the slope layer only exists in planning mode; show it as plain terrain here
  const value: StudentOverlay = overlay === "instant" || overlay === "average" ? overlay : "none";
  useWindowAverage(value === "average");

  return (
    <section aria-label="Map colours" className="glass flex shrink-0 flex-col gap-2 rounded-xl p-2">
      <Segmented<StudentOverlay>
        block
        ariaLabel="Map colours"
        value={value}
        onChange={setOverlay}
        options={[
          { value: "none", label: "Moon" },
          { value: "instant", label: "Sun now" },
          { value: "average", label: "Sunlight map" },
        ]}
      />
      <p className="px-2 pb-1 text-fg-muted text-xs leading-snug">{HINT[value]}</p>
    </section>
  );
}
