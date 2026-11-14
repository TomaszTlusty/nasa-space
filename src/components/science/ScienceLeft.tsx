"use client";

import { Sparkle } from "@phosphor-icons/react";
import { useState } from "react";
import { MissionAssistant } from "@/components/ai/MissionAssistant";
import { DiscoveryPanel } from "@/components/science/discovery/DiscoveryPanel";
import { LayersPanel } from "@/components/science/layers/LayersPanel";
import { Segmented } from "@/components/ui/segmented";

type Tool = "discover" | "assistant";

/** Science-mode left column: map layers, then either manual site discovery or the AI mission assistant. */
export function ScienceLeft() {
  const [tool, setTool] = useState<Tool>("discover");
  return (
    <>
      <LayersPanel />
      <div className="glass flex items-center rounded-full p-1">
        <Segmented<Tool>
          block
          ariaLabel="Site search tool"
          value={tool}
          onChange={setTool}
          options={[
            { value: "discover", label: "Find sites" },
            {
              value: "assistant",
              label: (
                <>
                  <Sparkle size={13} weight="regular" /> Ask the assistant
                </>
              ),
            },
          ]}
          className="bg-transparent ring-0"
        />
      </div>
      {tool === "discover" ? (
        <DiscoveryPanel className="min-h-0 flex-1" />
      ) : (
        <MissionAssistant className="min-h-0 flex-1" />
      )}
    </>
  );
}
