"use client";

import { useTexture } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { LoadedRegion } from "@/lib/moon/horizon";
import { sceneY } from "@/lib/terrain";
import { createTerrainMaterial, OVERLAY_CODE } from "./terrain-material";

export interface SkyState {
  sun: THREE.Vector3; // region frame (x, y, z-up)
  earth: THREE.Vector3;
  sunRadiusDeg: number;
  earthRadiusDeg: number;
}

interface TerrainProps {
  region: LoadedRegion;
  centerHeight: number;
  sky: SkyState;
  overlay: keyof typeof OVERLAY_CODE;
  /** RGBA8 per horizon-grid node: R = mean sun fraction, G = mean earth fraction (255 = 1) */
  averageData: Uint8Array | null;
  onPick?: (x: number, y: number) => void;
  onHover?: (x: number, y: number) => void;
}

export function Terrain({ region, centerHeight, sky, overlay, averageData, onPick, onHover }: TerrainProps) {
  const { meta, heights } = region;
  const normalMap = useTexture(`/regions/${meta.id}/normal.png`);

  const geometry = useMemo(() => {
    const t = meta.terrain;
    const positions = new Float32Array(t.width * t.height * 3);
    for (let r = 0; r < t.height; r++) {
      const y = t.y0 + r * t.step;
      for (let c = 0; c < t.width; c++) {
        const x = t.x0 + c * t.step;
        const i = r * t.width + c;
        positions[i * 3] = x / 1000;
        positions[i * 3 + 1] = sceneY(heights[i], x, y, centerHeight);
        positions[i * 3 + 2] = -y / 1000;
      }
    }
    const index = new Uint32Array((t.width - 1) * (t.height - 1) * 6);
    let k = 0;
    for (let r = 0; r < t.height - 1; r++) {
      for (let c = 0; c < t.width - 1; c++) {
        const a = r * t.width + c;
        const b = a + 1;
        const d = a + t.width;
        const e = d + 1;
        // counter-clockwise when viewed from +Y (three up); row index grows toward -Z
        index[k++] = a;
        index[k++] = b;
        index[k++] = d;
        index[k++] = b;
        index[k++] = e;
        index[k++] = d;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setIndex(new THREE.BufferAttribute(index, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }, [meta, heights, centerHeight]);

  const material = useMemo(() => createTerrainMaterial(region, normalMap), [region, normalMap]);

  useEffect(
    () => () => {
      geometry.dispose();
    },
    [geometry],
  );
  useEffect(
    () => () => {
      for (const u of Object.values(material.uniforms)) {
        if (u.value instanceof THREE.Texture && u.value !== normalMap) u.value.dispose();
      }
      material.dispose();
    },
    [material, normalMap],
  );

  // Uniform updates are cheap; do them on every change of sky/overlay.
  const u = material.uniforms;
  u.uSunDir.value.copy(sky.sun);
  u.uEarthDir.value.copy(sky.earth);
  u.uSunRadius.value = sky.sunRadiusDeg;
  u.uEarthRadius.value = sky.earthRadiusDeg;
  u.uOverlay.value = OVERLAY_CODE[overlay];

  useEffect(() => {
    if (!averageData) return;
    const tex = material.uniforms.uOverlayTex.value as THREE.DataTexture;
    (tex.image.data as Uint8Array).set(averageData);
    tex.needsUpdate = true;
  }, [averageData, material]);

  const toLocal = (e: ThreeEvent<PointerEvent | MouseEvent>) => ({ x: e.point.x * 1000, y: -e.point.z * 1000 });

  return (
    <mesh
      geometry={geometry}
      material={material}
      onClick={(e) => {
        if (e.delta > 4 || !onPick) return;
        e.stopPropagation();
        const p = toLocal(e);
        onPick(p.x, p.y);
      }}
      onPointerMove={
        onHover
          ? (e) => {
              const p = toLocal(e);
              onHover(p.x, p.y);
            }
          : undefined
      }
    />
  );
}
