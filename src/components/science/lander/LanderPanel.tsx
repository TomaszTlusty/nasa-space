"use client";

import { Cube, Eye, MapPin, Trash } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/overlay";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import type { RegionSite } from "@/lib/moon/types";
import { type LanderId, useApp } from "@/lib/store";
import { useRegion } from "@/lib/use-region";
import { CompareView } from "./CompareView";
import { LanderDetails } from "./LanderDetails";
import { Section, SourceLink } from "./Section";

type Tab = LanderId | "compare";

const KIND_LABEL: Record<RegionSite["kind"], string> = {
  artemis: "Artemis candidate",
  lander: "Lander target",
  "high-illumination": "High illumination",
  reference: "Reference",
};

function SitePicks({ id, sites }: { id: LanderId; sites: RegionSite[] | null }) {
  const placeLander = useApp((s) => s.placeLander);
  return (
    <Section title="Known sites">
      {sites ? (
        <ul className="-mx-2 flex flex-col">
          {sites.map((site) => (
            <li key={site.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => placeLander(id, { x: site.x, y: site.y, siteId: site.id })}
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-sm px-2 py-1.5 text-left transition-[background-color,transform] duration-150 ease-(--ease-out) hover:bg-white/5 active:scale-[0.98]"
              >
                <MapPin size={14} weight="light" className="shrink-0 text-fg-faint" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-fg text-xs">{site.name}</span>
                  <span className="block truncate text-2xs text-fg-faint">{KIND_LABEL[site.kind]}</span>
                </span>
              </button>
              <SourceLink href={site.source}>Coords</SourceLink>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-fg-muted text-xs">Loading sites…</p>
      )}
    </Section>
  );
}

/**
 * Right-column Science panel: place/inspect landers A and B, live sky at the playhead, mission-window
 * results, landing screening, mast height (curated sites) and an A/B comparison.
 */
export function LanderPanel() {
  const landers = useApp((s) => s.landers);
  const activeLander = useApp((s) => s.activeLander);
  const placing = useApp((s) => s.placing);
  const camera = useApp((s) => s.camera);
  const regionId = useApp((s) => s.regionId);
  const setActiveLander = useApp((s) => s.setActiveLander);
  const setPlacing = useApp((s) => s.setPlacing);
  const setCamera = useApp((s) => s.setCamera);
  const removeLander = useApp((s) => s.removeLander);
  const { region } = useRegion(regionId);
  const sites = region?.meta.sites ?? null;
  const [compare, setCompare] = useState(false);

  const both = Boolean(landers.A && landers.B);
  const tab: Tab = compare && both ? "compare" : activeLander;
  const placement = landers[activeLander];
  const siteName = placement?.siteId ? sites?.find((s) => s.id === placement.siteId)?.name : undefined;

  const selectTab = (t: Tab) => {
    if (t === "compare") return setCompare(true);
    setCompare(false);
    setActiveLander(t);
    if (!landers[t]) setPlacing(t);
  };

  return (
    <Panel className="flex max-h-full min-h-0 flex-col overflow-hidden">
      <PanelHeader
        eyebrow="Landing site"
        title={tab === "compare" ? "Compare A and B" : (siteName ?? `Lander ${activeLander}`)}
      />
      <div className="px-4 pb-3">
        <Segmented<Tab>
          ariaLabel="Lander"
          size="sm"
          block
          value={tab}
          onChange={selectTab}
          options={[
            { value: "A", label: "A" },
            { value: "B", label: landers.B ? "B" : "Add B" },
            ...(both ? [{ value: "compare" as const, label: "Compare" }] : []),
          ]}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {tab === "compare" ? (
          <CompareView />
        ) : (
          <>
            <div className="flex flex-col gap-2.5 border-line border-t px-4 py-3">
              <Switch
                label={placement ? `Click terrain to move ${activeLander}` : `Click terrain to place ${activeLander}`}
                checked={placing === activeLander}
                onChange={(on) => setPlacing(on ? activeLander : null)}
              />
              {placement && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={camera === "lander" ? "primary" : "secondary"}
                    className="flex-1"
                    aria-pressed={camera === "lander"}
                    onClick={() => setCamera(camera === "lander" ? "orbit" : "lander")}
                  >
                    {camera === "lander" ? <Cube size={14} weight="regular" /> : <Eye size={14} weight="regular" />}
                    {camera === "lander" ? "Back to orbit view" : "View from lander"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => removeLander(activeLander)}>
                    <Trash size={14} weight="regular" />
                    Remove
                  </Button>
                </div>
              )}
            </div>
            {placement ? (
              <LanderDetails id={activeLander} siteName={siteName} />
            ) : (
              <>
                <p className="border-line border-t px-4 py-3 text-fg-muted text-sm leading-5">
                  Click anywhere on the terrain to land lander {activeLander}, or start from a known site below.
                </p>
                <SitePicks id={activeLander} sites={sites} />
              </>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}
