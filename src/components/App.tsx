"use client";

import { Timeline } from "@/components/hud/Timeline";
import { TopBar } from "@/components/hud/TopBar";
import { ChartsDrawer, ChartsToggle } from "@/components/science/charts/ChartsDrawer";
import { DiscoveryPanel } from "@/components/science/discovery/DiscoveryPanel";
import { LanderPanel } from "@/components/science/lander/LanderPanel";
import { LayersPanel } from "@/components/science/layers/LayersPanel";
import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/lib/store";

/** Composition root. Feature panels plug into the shell slots here; each feature owns its own files. */
export function App() {
  const mode = useApp((s) => s.mode);
  const science = mode === "science";

  return (
    <AppShell
      top={<TopBar />}
      left={
        science ? (
          <>
            <LayersPanel />
            <DiscoveryPanel className="min-h-0 flex-1" />
          </>
        ) : undefined
      }
      right={science ? <LanderPanel /> : undefined}
      bottom={
        <div className="mx-auto flex max-w-[1180px] items-end gap-2">
          <div className="min-w-0 flex-1">
            <Timeline />
          </div>
          {science && <ChartsToggle className="mb-2" />}
        </div>
      }
      overlay={science ? <ChartsDrawer /> : undefined}
    />
  );
}
