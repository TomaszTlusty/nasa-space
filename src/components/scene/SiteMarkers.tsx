"use client";

import { Html } from "@react-three/drei";
import { useMemo } from "react";
import type { LoadedRegion } from "@/lib/moon/horizon";
import type { RegionSite } from "@/lib/moon/types";
import { sceneY } from "@/lib/terrain";

const KIND_DOT: Record<RegionSite["kind"], string> = {
  artemis: "bg-sun",
  lander: "bg-earth",
  "high-illumination": "bg-[oklch(0.9_0.12_95)]",
  reference: "bg-fg-faint",
};

/** Sites closer than this share one pin (e.g. Blue Moon MK1 target = NASA CR1 point). */
const MERGE_DISTANCE_M = 600;

/** Curated NASA/literature sites as small labelled pins. Clicking one places the lander exactly on it. */
export function SiteMarkers({
  region,
  centerHeight,
  onSelect,
  dimmed,
}: {
  region: LoadedRegion;
  centerHeight: number;
  onSelect: (site: RegionSite) => void;
  dimmed: boolean;
}) {
  const groups = useMemo(() => {
    const out: RegionSite[][] = [];
    for (const s of region.meta.sites) {
      const g = out.find((sites) => Math.hypot(sites[0].x - s.x, sites[0].y - s.y) < MERGE_DISTANCE_M);
      if (g) g.push(s);
      else out.push([s]);
    }
    return out;
  }, [region]);

  return (
    <>
      {groups.map((sites) => {
        const s = sites[0];
        return (
          <group key={s.id} position={[s.x / 1000, sceneY(s.elevation, s.x, s.y, centerHeight), -s.y / 1000]}>
            <Html center zIndexRange={[15, 0]} style={{ pointerEvents: dimmed ? "none" : "auto" }}>
              <button
                type="button"
                onClick={() => onSelect(s)}
                title={sites.map((x) => x.note ?? x.name).join("\n")}
                className={`flex -translate-y-3 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full bg-black/55 py-0.5 pr-2 pl-1.5 text-2xs text-fg-muted ring-1 ring-white/10 backdrop-blur-md transition-[opacity,background-color,color] duration-150 hover:bg-black/80 hover:text-fg ${
                  dimmed ? "opacity-0" : "opacity-100"
                }`}
              >
                {sites.map((x) => (
                  <span key={x.id} className={`size-1.5 rounded-full ${KIND_DOT[x.kind]}`} />
                ))}
                {s.name}
                {sites.length > 1 && <span className="tabular text-fg-faint">+{sites.length - 1}</span>}
              </button>
            </Html>
          </group>
        );
      })}
    </>
  );
}
