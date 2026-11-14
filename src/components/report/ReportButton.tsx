"use client";

import { Menu } from "@base-ui/react/menu";
import { CaretDown, FileCsv, FilePdf } from "@phosphor-icons/react";
import { useState } from "react";
import { mergeSources } from "@/components/about/content";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/overlay";
import { usePointAnalysis } from "@/lib/analysis";
import type { PointAnalysis } from "@/lib/analysis/types";
import { cn } from "@/lib/cn";
import { useApp } from "@/lib/store";
import { useRegion } from "@/lib/use-region";
import { buildHourlyCsv } from "./csv";
import { downloadReportPdf, type ReportSnapshot, reportFilename } from "./pdf";

/** JPEG of the live 3D view (the renderer keeps its drawing buffer, so this reads the last frame). */
function snapshotScene(): ReportSnapshot | null {
  const canvas = document.querySelector<HTMLCanvasElement>("main canvas");
  if (!canvas || canvas.width === 0 || canvas.height === 0) return null;
  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.9),
    width: canvas.width,
    height: canvas.height,
  };
}

const itemClass =
  "flex cursor-default select-none items-start gap-2.5 rounded-sm px-2.5 py-2 text-sm outline-none data-highlighted:bg-white/6";

/**
 * "Report" menu: Site Selection Report (PDF) and hourly data (CSV) for the placed landers.
 * Disabled, with an explanation, until at least one lander is placed and analysed.
 */
export function ReportButton({ className }: { className?: string }) {
  const regionId = useApp((s) => s.regionId);
  const landers = useApp((s) => s.landers);
  const windowStart = useApp((s) => s.windowStart);
  const windowDays = useApp((s) => s.windowDays);
  const discovery = useApp((s) => s.discovery.results);
  const power = useApp((s) => s.power);
  const analysisA = usePointAnalysis("A");
  const analysisB = usePointAnalysis("B");
  const { region } = useRegion(regionId);
  const [busy, setBusy] = useState(false);

  const placed = (["A", "B"] as const).filter((id) => landers[id]);
  const byId = { A: analysisA, B: analysisB };
  const analyses = placed.map((id) => byId[id]).filter((a): a is PointAnalysis => a !== null);
  const ready = region !== null && placed.length > 0 && analyses.length === placed.length;

  if (!ready) {
    return (
      <Tooltip content={placed.length === 0 ? "Place a lander to create a report" : "Analysing the mission window…"}>
        {/* focusable + hoverable while disabled, so the reason stays reachable by mouse and keyboard */}
        <Button
          variant="ghost"
          disabled
          focusableWhenDisabled
          className={cn("data-disabled:pointer-events-auto data-disabled:cursor-not-allowed", className)}
        >
          <FilePdf size={16} weight="light" />
          Report
        </Button>
      </Tooltip>
    );
  }

  const meta = region.meta;

  const exportPdf = () => {
    setBusy(true);
    // let the menu close and the busy label paint before the synchronous PDF build blocks the thread
    requestAnimationFrame(() =>
      setTimeout(() => {
        try {
          downloadReportPdf({
            regionId,
            regionName: meta.name,
            regionDescription: meta.description,
            windowStart,
            windowDays,
            landers: analyses.map((analysis) => ({
              analysis,
              siteName: meta.sites.find((s) => s.id === analysis.siteId)?.name ?? null,
            })),
            discovery,
            snapshot: snapshotScene(),
            power,
            gridMastHeight: meta.horizon.mastHeight,
            sources: mergeSources(meta),
            generatedAt: Date.now(),
          });
        } finally {
          setBusy(false);
        }
      }, 0),
    );
  };

  const exportCsv = () => {
    const blob = new Blob([buildHourlyCsv(analyses)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = reportFilename(regionId, windowStart, "csv");
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <Menu.Root>
      <Menu.Trigger
        disabled={busy}
        render={
          <Button variant="ghost" className={className}>
            <FilePdf size={16} weight="light" />
            {busy ? "Preparing…" : "Report"}
            <CaretDown size={12} weight="regular" className="text-fg-faint" />
          </Button>
        }
      />
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={8} className="z-40">
          <Menu.Popup className="glass w-64 origin-(--transform-origin) rounded-lg bg-glass-strong p-1 shadow-(--shadow-pop) outline-none transition-[transform,opacity] duration-150 ease-(--ease-out) data-ending-style:scale-[0.97] data-starting-style:scale-[0.97] data-ending-style:opacity-0 data-starting-style:opacity-0">
            <Menu.Item className={itemClass} onClick={exportPdf}>
              <FilePdf size={16} weight="light" className="mt-0.5 shrink-0 text-fg-muted" />
              <span>
                <span className="block text-fg">Site Selection Report</span>
                <span className="block text-fg-faint text-xs">PDF with tables, charts and sources</span>
              </span>
            </Menu.Item>
            <Menu.Item className={itemClass} onClick={exportCsv}>
              <FileCsv size={16} weight="light" className="mt-0.5 shrink-0 text-fg-muted" />
              <span>
                <span className="block text-fg">Hourly data</span>
                <span className="block text-fg-faint text-xs">
                  CSV of Sun, Earth and battery for lander
                  {analyses.length > 1 ? "s A and B" : ` ${analyses[0].id}`}
                </span>
              </span>
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
