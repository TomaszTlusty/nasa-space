"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useDiscoveryHover } from "@/components/science/discovery/hover";
import type { LoadedRegion } from "@/lib/moon/horizon";
import type { DiscoveryResult } from "@/lib/store";
import { heightAt, sceneY } from "@/lib/terrain";

/** Scene units are km. */
const COLUMN_HEIGHT = 1.5;
const COLUMN_WIDTH = 0.3;
const DOT_RADIUS = 0.035;
const RING_INNER = 0.1;
const RING_OUTER = 0.122;
const RING_LIFT = 0.02;
/** Screen-space label lift (px) above the dot for rank 1, plus one label height per further rank. */
const LABEL_LIFT_PX = 14;
const LABEL_STEP_PX = 19;
/** --color-beacon (oklch(0.98 0 0)) */
const BEACON = new THREE.Color("#f9f9f9");

type Emphasis = "normal" | "hover" | "dim";
const COLUMN_OPACITY: Record<Emphasis, number> = {
  normal: 0.42,
  hover: 0.9,
  dim: 0.14,
};
const RING_OPACITY: Record<Emphasis, number> = {
  normal: 0.65,
  hover: 1,
  dim: 0.25,
};

/**
 * Soft light-column sprite: a crisp core line plus a faint halo across the width, fading upward.
 * Alpha only (white RGB); drawn additively so it brightens the terrain without hiding it.
 */
function createColumnTexture(): THREE.DataTexture {
  const w = 64;
  const h = 128;
  const data = new Uint8Array(w * h * 4);
  for (let j = 0; j < h; j++) {
    const v = j / (h - 1);
    const fade = (1 - v) ** 1.8 * Math.min(1, v / 0.015 + 0.6);
    for (let i = 0; i < w; i++) {
      const u = (i + 0.5) / w - 0.5;
      const across = 0.85 * Math.exp(-((u / 0.05) ** 2)) + 0.16 * Math.exp(-((u / 0.2) ** 2));
      const k = (j * w + i) * 4;
      data[k] = 255;
      data[k + 1] = 255;
      data[k + 2] = 255;
      data[k + 3] = Math.round(Math.min(1, across * fade) * 255);
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

interface BeaconAssets {
  column: THREE.PlaneGeometry;
  dot: THREE.SphereGeometry;
  ring: THREE.RingGeometry;
  texture: THREE.DataTexture;
  columnMat: Record<Emphasis, THREE.MeshBasicMaterial>;
  ringMat: Record<Emphasis, THREE.MeshBasicMaterial>;
  dotMat: THREE.MeshBasicMaterial;
}

function createAssets(): BeaconAssets {
  const column = new THREE.PlaneGeometry(COLUMN_WIDTH, COLUMN_HEIGHT);
  column.translate(0, COLUMN_HEIGHT / 2, 0);
  const ring = new THREE.RingGeometry(RING_INNER, RING_OUTER, 64);
  ring.rotateX(-Math.PI / 2);
  const texture = createColumnTexture();
  const emphases: Emphasis[] = ["normal", "hover", "dim"];
  const columnMat = Object.fromEntries(
    emphases.map((e) => [
      e,
      new THREE.MeshBasicMaterial({
        color: BEACON,
        map: texture,
        transparent: true,
        opacity: COLUMN_OPACITY[e],
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    ]),
  ) as Record<Emphasis, THREE.MeshBasicMaterial>;
  const ringMat = Object.fromEntries(
    emphases.map((e) => [
      e,
      new THREE.MeshBasicMaterial({
        color: BEACON,
        transparent: true,
        opacity: RING_OPACITY[e],
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    ]),
  ) as Record<Emphasis, THREE.MeshBasicMaterial>;
  const dotMat = new THREE.MeshBasicMaterial({
    color: BEACON,
    toneMapped: false,
  });
  return {
    column,
    dot: new THREE.SphereGeometry(DOT_RADIUS, 16, 12),
    ring,
    texture,
    columnMat,
    ringMat,
    dotMat,
  };
}

export interface BeaconsProps {
  region: LoadedRegion;
  /** DEM height (m) at the region centre, as used by the terrain mesh */
  centerHeight: number;
  results: DiscoveryResult[];
  /** rank to emphasise; omit to follow the DiscoveryPanel results list hover */
  hoveredRank?: number | null;
}

/**
 * Discovery results in 3D: a white dot and hairline ring on the ground, a thin soft light column
 * (~1.5 km) that stays readable from orbit, and a "Site #n · score" label.
 */
export function Beacons({ region, centerHeight, results, hoveredRank }: BeaconsProps) {
  const listHover = useDiscoveryHover((s) => s.hoveredRank);
  const active = hoveredRank === undefined ? listHover : hoveredRank;
  const assets = useMemo(createAssets, []);
  const columns = useRef<(THREE.Mesh | null)[]>([]);

  useEffect(
    () => () => {
      assets.column.dispose();
      assets.dot.dispose();
      assets.ring.dispose();
      assets.texture.dispose();
      for (const m of [...Object.values(assets.columnMat), ...Object.values(assets.ringMat), assets.dotMat])
        m.dispose();
    },
    [assets],
  );

  const placed = useMemo(
    () =>
      results.map((r) => {
        const h = heightAt(region.meta, region.heights, r.x, r.y);
        return {
          r,
          pos: [r.x / 1000, sceneY(h, r.x, r.y, centerHeight), -r.y / 1000] as [number, number, number],
        };
      }),
    [results, region, centerHeight],
  );

  // Cylindrical billboarding: each column turns about the vertical to face the camera.
  useFrame(({ camera }) => {
    for (let i = 0; i < placed.length; i++) {
      const m = columns.current[i];
      if (!m) continue;
      const [x, , z] = placed[i].pos;
      m.rotation.y = Math.atan2(camera.position.x - x, camera.position.z - z);
    }
  });

  return (
    <>
      {placed.map(({ r, pos }, i) => {
        const emphasis: Emphasis = active == null ? "normal" : active === r.rank ? "hover" : "dim";
        return (
          <group key={r.rank} position={pos}>
            <mesh
              ref={(m) => {
                columns.current[i] = m;
              }}
              geometry={assets.column}
              material={assets.columnMat[emphasis]}
              renderOrder={2}
              raycast={() => null}
            />
            <mesh
              geometry={assets.ring}
              material={assets.ringMat[emphasis]}
              position={[0, RING_LIFT, 0]}
              renderOrder={1}
              raycast={() => null}
            />
            <mesh geometry={assets.dot} material={assets.dotMat} raycast={() => null} />
            <Html zIndexRange={[8, 0]} style={{ pointerEvents: "none" }}>
              {/* Labels are lifted by rank on hairline leaders, so neighbouring sites never stack. */}
              <div className="relative size-0">
                <div
                  aria-hidden
                  className={`absolute bottom-0 left-0 w-px transition-colors duration-150 ${
                    emphasis === "hover" ? "bg-white/60" : emphasis === "dim" ? "bg-white/10" : "bg-white/30"
                  }`}
                  style={{ height: LABEL_LIFT_PX + (r.rank - 1) * LABEL_STEP_PX }}
                />
                <div
                  className={`tabular absolute left-0 whitespace-nowrap rounded-[3px] px-1.5 py-px text-2xs ring-1 backdrop-blur-md transition-[opacity,background-color,color] duration-150 ${
                    emphasis === "hover"
                      ? "bg-black/80 text-fg ring-white/30"
                      : emphasis === "dim"
                        ? "bg-black/45 text-fg-faint opacity-60 ring-white/8"
                        : "bg-black/55 text-fg-muted ring-white/12"
                  }`}
                  style={{ bottom: LABEL_LIFT_PX + (r.rank - 1) * LABEL_STEP_PX }}
                >
                  Site #{r.rank} · {Math.round(r.score * 100)}%
                </div>
              </div>
            </Html>
          </group>
        );
      })}
    </>
  );
}
