"use client";

import { CaretRight, Lightning } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/overlay";
import { Divider, Panel, PanelHeader } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { Slider } from "@/components/ui/slider";
import { useWindowAverage } from "@/lib/analysis";
import { cn } from "@/lib/cn";
import { DAY, DEFAULT_POWER, type Overlay, useApp } from "@/lib/store";
import { OverlayLegend, SourceLink } from "./OverlayLegend";

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * At the pole the Sun stays within ~1.5° of the horizon, so a flat panel catches sin(1.5°) ≈ 2.6% of
 * the light; vertical Sun-tracking arrays are standard (Gläser et al. 2018).
 */
const PANEL_SOURCE = "https://ntrs.nasa.gov/api/citations/20170007365/downloads/20170007365.pdf";

function PowerModel() {
  const power = useApp((s) => s.power);
  const setPower = useApp((s) => s.setPower);
  const isDefault =
    power.panelAreaM2 === DEFAULT_POWER.panelAreaM2 &&
    power.efficiency === DEFAULT_POWER.efficiency &&
    power.batteryWh === DEFAULT_POWER.batteryWh &&
    power.loadW === DEFAULT_POWER.loadW;

  return (
    <Popover
      side="right"
      align="end"
      className="w-76"
      trigger={
        <Button variant="ghost" size="sm" className="h-auto w-full justify-between gap-3 rounded-md px-2 py-1.5">
          <span className="flex items-center gap-2 text-fg-muted">
            <Lightning size={14} weight="light" className="text-sun" />
            Lander power model
          </span>
          <span className="tabular flex items-center gap-1 text-2xs text-fg-faint">
            {power.panelAreaM2} m² · {Math.round(power.loadW)} W
            <CaretRight size={12} weight="regular" />
          </span>
        </Button>
      }
    >
      <div className="flex flex-col gap-3.5">
        <div>
          <div className="eyebrow">Assumption</div>
          <p className="mt-1 text-fg-muted text-xs">
            Polar landers use vertical, Sun-tracking panels; flat panels would see ~2.6% of the light.{" "}
            <SourceLink href={PANEL_SOURCE} />
          </p>
        </div>
        <Slider
          label="Panel area"
          value={power.panelAreaM2}
          onChange={(v) => setPower({ panelAreaM2: v })}
          min={1}
          max={20}
          step={0.5}
          valueLabel={`${power.panelAreaM2.toFixed(1)} m²`}
        />
        <Slider
          label="Panel efficiency"
          value={Math.round(power.efficiency * 100)}
          onChange={(v) => setPower({ efficiency: v / 100 })}
          min={10}
          max={40}
          step={1}
          valueLabel={`${Math.round(power.efficiency * 100)}%`}
        />
        <Slider
          label="Battery"
          value={power.batteryWh}
          onChange={(v) => setPower({ batteryWh: v })}
          min={500}
          max={20000}
          step={250}
          tone="neutral"
          valueLabel={`${power.batteryWh.toLocaleString("en-US")} Wh`}
        />
        <Slider
          label="Constant load"
          value={power.loadW}
          onChange={(v) => setPower({ loadW: v })}
          min={20}
          max={1000}
          step={10}
          tone="neutral"
          valueLabel={`${power.loadW} W`}
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-2xs text-fg-faint">Defaults are illustrative.</span>
          <Button variant="ghost" size="sm" disabled={isDefault} onClick={() => setPower(DEFAULT_POWER)}>
            Reset
          </Button>
        </div>
      </div>
    </Popover>
  );
}

/** Left-column panel: terrain overlay picker, its colour key and the lander power assumptions. */
export function LayersPanel({ className }: { className?: string }) {
  const overlay = useApp((s) => s.overlay);
  const setOverlay = useApp((s) => s.setOverlay);
  const windowStart = useApp((s) => s.windowStart);
  const windowDays = useApp((s) => s.windowDays);
  const stats = useWindowAverage(overlay === "average");

  return (
    <Panel className={cn("flex flex-col", className)} aria-label="Map layers">
      <PanelHeader eyebrow="Layers" title="Colour the terrain by" />
      <div className="flex flex-col gap-3 px-4 pb-3">
        <Segmented<Overlay>
          ariaLabel="Terrain overlay"
          size="sm"
          value={overlay}
          onChange={setOverlay}
          options={[
            { value: "none", label: "Terrain" },
            { value: "instant", label: "Sun now" },
            { value: "average", label: "Average", ariaLabel: "Window average" },
            { value: "slope", label: "Slope" },
          ]}
        />
        <OverlayLegend overlay={overlay} />
        {overlay === "average" && (
          <div className="tabular flex items-baseline justify-between gap-2 text-2xs text-fg-faint" aria-live="polite">
            <span>
              {DATE_FMT.format(windowStart)} → {DATE_FMT.format(windowStart + windowDays * DAY)}
            </span>
            <span className={stats ? undefined : "animate-pulse"}>
              {stats ? `computed in ${Math.round(stats.computeMs).toLocaleString("en-US")} ms` : "computing…"}
            </span>
          </div>
        )}
      </div>
      <Divider />
      <div className="p-1.5">
        <PowerModel />
      </div>
    </Panel>
  );
}
