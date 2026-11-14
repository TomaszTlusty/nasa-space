"use client";

import { SidebarSimple, X } from "@phosphor-icons/react";
import { type ReactNode, useState } from "react";
import { SceneLoader } from "@/components/scene/SceneLoader";
import { TooltipProvider } from "@/components/ui/overlay";
import { cn } from "@/lib/cn";

type Sheet = "left" | "right" | null;

/**
 * Full-viewport layout: the 3D scene fills the screen; HUD surfaces float above it in fixed slots.
 * Slots are pointer-transparent wrappers; only the panels inside them take input, so the terrain stays
 * draggable between panels. Desktop shows both columns; narrower screens get them as toggleable sheets
 * (left below lg, right below md) so every feature stays reachable.
 */
export function AppShell({
  top,
  left,
  right,
  bottom,
  overlay,
  leftLabel = "Tools",
  rightLabel = "Details",
}: {
  top: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  bottom: ReactNode;
  /** full-screen layers above everything (dialogs, game end screen, welcome) */
  overlay?: ReactNode;
  leftLabel?: string;
  rightLabel?: string;
}) {
  const [sheet, setSheet] = useState<Sheet>(null);
  const toggle = (s: Exclude<Sheet, null>) => setSheet((cur) => (cur === s ? null : s));

  const sheetButton = (s: Exclude<Sheet, null>, label: string, className: string) => (
    <button
      type="button"
      onClick={() => toggle(s)}
      aria-expanded={sheet === s}
      className={cn(
        "glass pointer-events-auto absolute top-[76px] z-20 inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 font-medium text-fg text-xs transition-transform duration-150 active:scale-[0.97]",
        className,
      )}
    >
      {sheet === s ? <X size={14} /> : <SidebarSimple size={14} className={s === "right" ? "-scale-x-100" : ""} />}
      {label}
    </button>
  );

  return (
    <TooltipProvider delay={400}>
      <main className="relative h-dvh w-full overflow-hidden bg-canvas">
        <SceneLoader />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-3 *:pointer-events-auto">{top}</div>
        {left && (
          <>
            {sheetButton("left", leftLabel, "left-3 lg:hidden")}
            <div
              className={cn(
                "pointer-events-none absolute left-3 z-10 flex w-[320px] max-w-[calc(100vw-1.5rem)] flex-col gap-3 *:pointer-events-auto",
                "top-[76px] bottom-[148px]",
                "max-lg:top-[124px] max-lg:z-20",
                sheet === "left" ? "max-lg:flex" : "max-lg:hidden",
              )}
            >
              {left}
            </div>
          </>
        )}
        {right && (
          <>
            {sheetButton("right", rightLabel, "right-3 md:hidden")}
            <div
              className={cn(
                "pointer-events-none absolute right-3 z-10 flex w-[360px] max-w-[calc(100vw-1.5rem)] flex-col gap-3 *:pointer-events-auto",
                "top-[76px] bottom-[148px]",
                "max-md:top-[124px] max-md:z-20",
                sheet === "right" ? "max-md:flex" : "max-md:hidden",
              )}
            >
              {right}
            </div>
          </>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-3 *:pointer-events-auto">{bottom}</div>
        {overlay}
      </main>
    </TooltipProvider>
  );
}
