"use client";

import { Html } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import type { LanderId } from "@/lib/store";

/** Stylised polar lander: squat body, four legs, a vertical sun-tracking array and a high-gain antenna. Metres. */
function LanderModel({ color, sunVis }: { color: string; sunVis: number }) {
  const body = useMemo(() => new THREE.MeshStandardMaterial({ color: "#c9ccd2", metalness: 0.6, roughness: 0.35 }), []);
  const foil = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#c79a3a", metalness: 0.9, roughness: 0.28, emissive: "#000" }),
    [],
  );
  const panel = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#1d2a4a", metalness: 0.4, roughness: 0.25, emissive: "#0b1530" }),
    [],
  );
  const accent = useMemo(() => new THREE.MeshBasicMaterial({ color }), [color]);
  panel.emissiveIntensity = 0.3 + sunVis * 0.4;

  return (
    <group>
      <mesh material={foil} position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.95, 1.1, 0.9, 6]} />
      </mesh>
      <mesh material={body} position={[0, 1.75, 0]}>
        <cylinderGeometry args={[0.7, 0.9, 0.4, 6]} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        return (
          <mesh
            key={i}
            material={body}
            position={[Math.cos(a) * 1.25, 0.55, Math.sin(a) * 1.25]}
            rotation={[Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45]}
          >
            <cylinderGeometry args={[0.05, 0.05, 1.3, 6]} />
          </mesh>
        );
      })}
      {/* vertical array on a 2 m mast */}
      <mesh material={body} position={[0, 2.6, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 1.4, 6]} />
      </mesh>
      <mesh material={panel} position={[0, 3.2, 0]}>
        <boxGeometry args={[2.2, 1.1, 0.05]} />
      </mesh>
      {/* antenna */}
      <mesh material={body} position={[0.6, 2.3, 0]} rotation={[0, 0, -0.6]}>
        <coneGeometry args={[0.35, 0.25, 16, 1, true]} />
      </mesh>
      <mesh material={accent} position={[0, 4.05, 0]}>
        <sphereGeometry args={[0.12, 12, 8]} />
      </mesh>
    </group>
  );
}

interface LanderProps {
  id: LanderId;
  position: THREE.Vector3;
  /** scene-space unit vector toward Earth */
  earthDir: THREE.Vector3;
  sunVis: number;
  earthVis: number;
  /** scene km per metre for the model; exaggerated in orbit view so the lander is visible */
  scale: number;
  showLabel: boolean;
  active: boolean;
  onSelect?: () => void;
}

const BEAM_LENGTH = 6; // km

export function Lander({ id, position, earthDir, sunVis, earthVis, scale, showLabel, active, onSelect }: LanderProps) {
  const color = id === "A" ? "#f5c26b" : "#9fd0ff";
  const linked = earthVis > 0.001;

  const beam = useMemo(
    () =>
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        earthDir.clone().multiplyScalar(BEAM_LENGTH),
      ]),
    [earthDir],
  );

  const beamMaterial = useMemo(
    () =>
      linked
        ? new THREE.LineBasicMaterial({ color: "#7cc4ff", transparent: true, opacity: 0.85, toneMapped: false })
        : new THREE.LineDashedMaterial({
            color: "#ff6b5e",
            dashSize: 0.18,
            gapSize: 0.12,
            transparent: true,
            opacity: 0.85,
            toneMapped: false,
          }),
    [linked],
  );

  const antennaTop = 4 * scale;

  return (
    <group position={position}>
      <group
        scale={scale}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.();
        }}
      >
        <LanderModel color={color} sunVis={sunVis} />
      </group>
      <group position={[0, antennaTop, 0]}>
        <lineSegments geometry={beam} material={beamMaterial} onUpdate={(l) => l.computeLineDistances()} />
      </group>
      {showLabel && (
        <Html position={[0, antennaTop * 1.35, 0]} center zIndexRange={[9, 0]} style={{ pointerEvents: "none" }}>
          <div
            className={`tabular flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-2xs ring-1 backdrop-blur-md ${
              active ? "bg-black/70 text-fg ring-white/25" : "bg-black/50 text-fg-muted ring-white/10"
            }`}
          >
            <span className="size-1.5 rounded-full" style={{ background: color }} />
            {id}
            <span className={sunVis > 0.001 ? "text-sun" : "text-fg-faint"}>Sun {Math.round(sunVis * 100)}%</span>
            <span className={linked ? "text-earth" : "text-danger"}>{linked ? "Earth link" : "No link"}</span>
          </div>
        </Html>
      )}
    </group>
  );
}
