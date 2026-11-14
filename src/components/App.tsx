"use client";

import { AppShell } from "@/components/shell/AppShell";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { type Mode, useApp } from "@/lib/store";

/**
 * Composition root. Feature panels plug into the shell slots here; each feature owns its own files.
 */
export function App() {
  const mode = useApp((s) => s.mode);
  const setMode = useApp((s) => s.setMode);
  const time = useApp((s) => s.time);

  return (
    <AppShell
      top={
        <div className="glass mx-auto flex h-14 w-fit items-center gap-4 rounded-full px-3 pl-5">
          <span className="font-medium text-sm tracking-[-0.01em]">Malapert</span>
          <Segmented<Mode>
            ariaLabel="Mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: "science", label: "Mission planning" },
              { value: "student", label: "Explore & learn" },
            ]}
          />
          <span className="tabular text-fg-muted text-xs">{new Date(time).toISOString().slice(0, 16)}Z</span>
        </div>
      }
      right={
        <Panel>
          <PanelHeader eyebrow="Placeholder" title="Panels plug in here" />
        </Panel>
      }
      bottom={<div className="glass mx-auto h-20 max-w-5xl rounded-2xl" />}
    />
  );
}
