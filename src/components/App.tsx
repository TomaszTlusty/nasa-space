"use client";

import { AboutButton } from "@/components/about/AboutButton";
import { Timeline } from "@/components/hud/Timeline";
import { TopBar } from "@/components/hud/TopBar";
import { ReportButton } from "@/components/report/ReportButton";
import { ChartsDrawer, ChartsToggle } from "@/components/science/charts/ChartsDrawer";
import { LanderPanel } from "@/components/science/lander/LanderPanel";
import { ScienceLeft } from "@/components/science/ScienceLeft";
import { AppShell } from "@/components/shell/AppShell";
import { GameOverlay, GamePanel } from "@/components/student/game";
import { Welcome } from "@/components/welcome/Welcome";
import { useApp } from "@/lib/store";

/** Composition root. Feature panels plug into the shell slots here; each feature owns its own files. */
export function App() {
  const mode = useApp((s) => s.mode);
  const science = mode === "science";

  return (
    <AppShell
      top={
        <TopBar
          right={
            <div className="flex items-center gap-1">
              {science && <ReportButton />}
              <AboutButton />
            </div>
          }
        />
      }
      left={science ? <ScienceLeft /> : <GamePanel />}
      right={science ? <LanderPanel /> : undefined}
      bottom={
        <div className="mx-auto flex max-w-[1180px] items-end gap-2">
          <div className="min-w-0 flex-1">
            <Timeline />
          </div>
          {science && <ChartsToggle className="mb-2" />}
        </div>
      }
      overlay={
        <>
          {science && <ChartsDrawer />}
          <GameOverlay />
          <Welcome />
        </>
      }
    />
  );
}
