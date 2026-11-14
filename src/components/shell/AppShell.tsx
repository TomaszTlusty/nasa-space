"use client";

import type { ReactNode } from "react";
import { SceneLoader } from "@/components/scene/SceneLoader";
import { TooltipProvider } from "@/components/ui/overlay";

/**
 * Full-viewport layout: the 3D scene fills the screen; HUD surfaces float above it in fixed slots.
 * Slots are pointer-transparent wrappers; only the panels inside them take input, so the terrain stays
 * draggable between panels.
 */
export function AppShell({
  top,
  left,
  right,
  bottom,
  overlay,
}: {
  top: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  bottom: ReactNode;
  /** full-screen layers above everything (dialogs, game end screen, welcome) */
  overlay?: ReactNode;
}) {
  return (
    <TooltipProvider delay={400}>
      <main className="relative h-dvh w-full overflow-hidden bg-canvas">
        <SceneLoader />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-3 *:pointer-events-auto">{top}</div>
        {left && (
          <div className="pointer-events-none absolute top-[76px] bottom-[148px] left-3 z-10 flex w-[320px] flex-col gap-3 overflow-visible *:pointer-events-auto max-lg:hidden">
            {left}
          </div>
        )}
        {right && (
          <div className="pointer-events-none absolute top-[76px] right-3 bottom-[148px] z-10 flex w-[360px] flex-col gap-3 *:pointer-events-auto max-md:hidden">
            {right}
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-3 *:pointer-events-auto">{bottom}</div>
        {overlay}
      </main>
    </TooltipProvider>
  );
}
