"use client";

import { Html } from "@react-three/drei";
import type { LoadedRegion } from "@/lib/moon/horizon";
import type { RegionSite } from "@/lib/moon/types";
import { sceneY } from "@/lib/terrain";

const KIND_DOT: Record<RegionSite["kind"], string> = {
  artemis: "bg-sun",
  lander: "bg-earth",
  "high-illumination": "bg-[oklch(0.9_0.12_95)]",
  reference: "bg-fg-faint",
};

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
  return (
    <>
      {region.meta.sites.map((s) => (
        <group key={s.id} position={[s.x / 1000, sceneY(s.elevation, s.x, s.y, centerHeight), -s.y / 1000]}>
          <Html center zIndexRange={[15, 0]} style={{ pointerEvents: dimmed ? "none" : "auto" }}>
            <button
              type="button"
              onClick={() => onSelect(s)}
              title={s.note ?? s.name}
              className={`group flex -translate-y-3 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full bg-black/55 py-0.5 pr-2 pl-1.5 text-2xs text-fg-muted ring-1 ring-white/10 backdrop-blur-md transition-[opacity,background-color,color] duration-150 hover:bg-black/80 hover:text-fg ${
                dimmed ? "opacity-0" : "opacity-100"
              }`}
            >
              <span className={`size-1.5 rounded-full ${KIND_DOT[s.kind]}`} />
              {s.name}
            </button>
          </Html>
        </group>
      ))}
    </>
  );
}
