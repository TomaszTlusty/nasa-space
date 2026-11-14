"use client";

import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { horizonAt, type LoadedRegion } from "@/lib/moon/horizon";
import type { LanderPlacement } from "@/lib/store";

const RING_DISTANCE = 600; // scene km; follows the camera, so it reads as "at the horizon"
const BASE_ELEV = -20; // deg, bottom of the silhouette band
const STEP = 0.5; // deg azimuth

/** Horizon profile (deg) for a lander: exact per-site horizon when placed on a curated site, else the grid. */
export function landerHorizonProfile(region: LoadedRegion, lander: LanderPlacement, mastHeight: number): Float32Array {
  const n = Math.round(360 / STEP);
  const out = new Float32Array(n);
  const site = lander.siteId ? region.meta.sites.find((s) => s.id === lander.siteId) : undefined;
  const exact = site?.horizons.reduce<(typeof site.horizons)[number] | undefined>(
    (best, h) => (!best || Math.abs(h.mastHeight - mastHeight) < Math.abs(best.mastHeight - mastHeight) ? h : best),
    undefined,
  );
  for (let i = 0; i < n; i++) {
    const az = i * STEP;
    if (exact) {
      const k = (az / 360) * exact.values.length;
      const k0 = Math.floor(k) % exact.values.length;
      const k1 = (k0 + 1) % exact.values.length;
      const f = k - Math.floor(k);
      out[i] = exact.values[k0] * (1 - f) + exact.values[k1] * f;
    } else {
      out[i] = horizonAt(region, lander.x, lander.y, az);
    }
  }
  return out;
}

const dirFor = (azDeg: number, elDeg: number, out: THREE.Vector3) => {
  const az = (azDeg * Math.PI) / 180;
  const el = (elDeg * Math.PI) / 180;
  // region (x = sin az, y = cos az) -> three (x, y-up, -y)
  return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
};

/**
 * First-person extras: the terrain skyline as computed from LOLA out to ~300 km (so distant ridges the
 * local tile cannot show are still drawn, and match the analysis), plus an azimuth/elevation grid.
 */
export function Skyline({ profile }: { profile: Float32Array }) {
  const camera = useThree((s) => s.camera);
  const group = useRef<THREE.Group>(null);

  const { band, rim } = useMemo(() => {
    const n = profile.length;
    const pos = new Float32Array((n + 1) * 2 * 3);
    const rimPos = new Float32Array((n + 1) * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i <= n; i++) {
      const az = (i % n) * STEP;
      const top = profile[i % n];
      dirFor(az, BASE_ELEV, v).multiplyScalar(RING_DISTANCE);
      pos.set([v.x, v.y, v.z], i * 6);
      dirFor(az, top, v).multiplyScalar(RING_DISTANCE);
      pos.set([v.x, v.y, v.z], i * 6 + 3);
      rimPos.set([v.x, v.y, v.z], i * 3);
    }
    const index: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = i * 2;
      index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const b = new THREE.BufferGeometry();
    b.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    b.setIndex(index);
    const r = new THREE.BufferGeometry();
    r.setAttribute("position", new THREE.BufferAttribute(rimPos, 3));
    return { band: b, rim: r };
  }, [profile]);

  const grid = useMemo(() => {
    const pts: number[] = [];
    const v = new THREE.Vector3();
    const w = new THREE.Vector3();
    const R = RING_DISTANCE * 0.98;
    for (const el of [0, 5, 10, 15]) {
      for (let az = 0; az < 360; az += 2) {
        dirFor(az, el, v).multiplyScalar(R);
        dirFor(az + 2, el, w).multiplyScalar(R);
        pts.push(v.x, v.y, v.z, w.x, w.y, w.z);
      }
    }
    for (let az = 0; az < 360; az += 15) {
      dirFor(az, -2, v).multiplyScalar(R);
      dirFor(az, az % 45 === 0 ? 20 : 8, w).multiplyScalar(R);
      pts.push(v.x, v.y, v.z, w.x, w.y, w.z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);

  const labels = useMemo(() => {
    const v = new THREE.Vector3();
    return [0, 45, 90, 135, 180, 225, 270, 315].map((az) => ({
      az,
      pos: dirFor(az, 21.5, v)
        .multiplyScalar(RING_DISTANCE * 0.97)
        .toArray(),
    }));
  }, []);

  useFrame(() => {
    group.current?.position.copy(camera.position);
  });

  return (
    <group ref={group}>
      <mesh geometry={band} renderOrder={0}>
        <meshBasicMaterial color="#121318" side={THREE.DoubleSide} />
      </mesh>
      <line>
        <primitive object={rim} attach="geometry" />
        <lineBasicMaterial color="#5b6170" transparent opacity={0.9} />
      </line>
      <lineSegments geometry={grid}>
        <lineBasicMaterial color="#ffffff" transparent opacity={0.07} depthWrite={false} />
      </lineSegments>
      {labels.map((l) => (
        <Html key={l.az} position={l.pos as [number, number, number]} center style={{ pointerEvents: "none" }}>
          <span className="tabular text-2xs text-white/40">{l.az}°</span>
        </Html>
      ))}
    </group>
  );
}
