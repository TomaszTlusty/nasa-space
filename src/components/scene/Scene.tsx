"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { altAzAtLocalPoint, bodyVectorRegionFromEphemeris, moonEphemeris } from "@/lib/moon/ephemeris";
import { discVisibleFraction, horizonAt, type LoadedRegion } from "@/lib/moon/horizon";
import { type LanderId, type LanderPlacement, useApp } from "@/lib/store";
import { heightAt, sceneY } from "@/lib/terrain";
import { useRegion } from "@/lib/use-region";
import { Beacons } from "./Beacons";
import { Lander } from "./Lander";
import { SiteMarkers } from "./SiteMarkers";
import { Sky } from "./Sky";
import { landerHorizonProfile, Skyline } from "./Skyline";
import { type SkyState, Terrain } from "./Terrain";

const ORBIT_LANDER_SCALE = 0.06; // km per model metre: ~60x so the lander reads at regional zoom
const FP_EYE_M = 2; // first-person camera height above terrain (mast height in the spec)

export interface LanderLive {
  sunVis: number;
  earthVis: number;
  sunElev: number;
  earthElev: number;
}

/** Instantaneous Sun/Earth visibility at a local point, from the same horizon data the shader uses. */
export function liveVisibility(region: LoadedRegion, sky: SkyState, x: number, y: number): LanderLive {
  const { meta } = region;
  const s = altAzAtLocalPoint([sky.sun.x, sky.sun.y, sky.sun.z], x, y, meta);
  const e = altAzAtLocalPoint([sky.earth.x, sky.earth.y, sky.earth.z], x, y, meta);
  return {
    sunVis: discVisibleFraction(s.elevationDeg, horizonAt(region, x, y, s.gridAzimuthDeg), sky.sunRadiusDeg),
    earthVis: discVisibleFraction(e.elevationDeg, horizonAt(region, x, y, e.gridAzimuthDeg), sky.earthRadiusDeg),
    sunElev: s.elevationDeg,
    earthElev: e.elevationDeg,
  };
}

export function useSky(region: LoadedRegion | null, time: number): SkyState | null {
  return useMemo(() => {
    if (!region) return null;
    const eph = moonEphemeris(new Date(time));
    const sun = bodyVectorRegionFromEphemeris(eph, "sun", region.meta);
    const earth = bodyVectorRegionFromEphemeris(eph, "earth", region.meta);
    return {
      sun: new THREE.Vector3(...sun.v),
      earth: new THREE.Vector3(...earth.v),
      sunRadiusDeg: sun.angularRadiusDeg,
      earthRadiusDeg: earth.angularRadiusDeg,
    };
  }, [region, time]);
}

function CameraRig({
  region,
  centerHeight,
  lander,
}: {
  region: LoadedRegion;
  centerHeight: number;
  lander: LanderPlacement | null;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const controls = useRef<OrbitControlsImpl>(null);
  const firstPerson = lander !== null;

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    if (firstPerson && lander) {
      const h = heightAt(region.meta, region.heights, lander.x, lander.y);
      const eye = new THREE.Vector3(
        lander.x / 1000,
        sceneY(h, lander.x, lander.y, centerHeight) + FP_EYE_M / 1000,
        -lander.y / 1000,
      );
      camera.position.copy(eye);
      // look roughly toward the region centre at the horizon
      const dir = new THREE.Vector3(-eye.x, 0, -eye.z);
      if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
      dir.normalize().multiplyScalar(0.001);
      c.target.copy(eye).add(dir);
      camera.fov = 70;
    } else {
      const ext = region.meta.extent / 1000;
      camera.position.set(-ext * 0.55, ext * 0.42, ext * 0.62);
      c.target.set(0, -ext * 0.03, 0);
      camera.fov = 40;
    }
    camera.updateProjectionMatrix();
    c.update();
  }, [firstPerson, lander, region, centerHeight, camera]);

  const ext = region.meta.extent / 1000;
  return firstPerson ? (
    <OrbitControls
      ref={controls}
      makeDefault
      enableZoom={false}
      enablePan={false}
      rotateSpeed={-0.35}
      enableDamping
      dampingFactor={0.12}
    />
  ) : (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={ext * 0.08}
      maxDistance={ext * 2.2}
      maxPolarAngle={Math.PI * 0.47}
      zoomSpeed={0.7}
    />
  );
}

function World({ region }: { region: LoadedRegion }) {
  const time = useApp((s) => s.time);
  const overlay = useApp((s) => s.overlay);
  const landers = useApp((s) => s.landers);
  const activeLander = useApp((s) => s.activeLander);
  const camera = useApp((s) => s.camera);
  const placing = useApp((s) => s.placing);
  const placeLander = useApp((s) => s.placeLander);
  const setActiveLander = useApp((s) => s.setActiveLander);
  const averageData = useApp((s) => s.averageData);
  const mastHeight = useApp((s) => s.mastHeight);
  const discoveryResults = useApp((s) => s.discovery.results);

  const sky = useSky(region, time) as SkyState;
  const centerHeight = useMemo(() => heightAt(region.meta, region.heights, 0, 0), [region]);
  const earthThree = useMemo(() => new THREE.Vector3(sky.earth.x, sky.earth.z, -sky.earth.y), [sky]);
  const sunThree = useMemo(() => new THREE.Vector3(sky.sun.x, sky.sun.z, -sky.sun.y), [sky]);

  const fpLander = camera === "lander" ? (landers[activeLander] ?? null) : null;
  const profile = useMemo(
    () => (fpLander ? landerHorizonProfile(region, fpLander, mastHeight) : null),
    [region, fpLander, mastHeight],
  );

  const landerEntries = (Object.entries(landers) as [LanderId, LanderPlacement][]).map(([id, p]) => {
    const h = heightAt(region.meta, region.heights, p.x, p.y);
    const live = liveVisibility(region, sky, p.x, p.y);
    return { id, p, live, pos: new THREE.Vector3(p.x / 1000, sceneY(h, p.x, p.y, centerHeight), -p.y / 1000) };
  });

  const activeLive = landerEntries.find((l) => l.id === activeLander)?.live;

  return (
    <>
      <color attach="background" args={["#0d0e12"]} />
      <directionalLight position={sunThree.clone().multiplyScalar(100)} intensity={3 * (activeLive?.sunVis ?? 1)} />
      <hemisphereLight args={["#2a3550", "#0b0c10", 0.25]} />
      <Sky sky={sky} />
      <Terrain
        region={region}
        centerHeight={centerHeight}
        sky={sky}
        overlay={overlay}
        averageData={averageData}
        onPick={(x, y) => {
          if (placing) placeLander(placing, { x, y });
        }}
      />
      <SiteMarkers
        region={region}
        centerHeight={centerHeight}
        dimmed={fpLander !== null}
        onSelect={(s) => placeLander(placing ?? activeLander, { x: s.x, y: s.y, siteId: s.id })}
      />
      {profile && <Skyline profile={profile} />}
      {!fpLander && <Beacons region={region} centerHeight={centerHeight} results={discoveryResults} />}
      {landerEntries
        .filter((l) => !(fpLander && l.id === activeLander))
        .map((l) => (
          <Lander
            key={l.id}
            id={l.id}
            position={l.pos}
            earthDir={earthThree}
            sunVis={l.live.sunVis}
            earthVis={l.live.earthVis}
            scale={fpLander ? 0.001 : ORBIT_LANDER_SCALE}
            showLabel={!fpLander}
            active={l.id === activeLander}
            onSelect={() => setActiveLander(l.id)}
          />
        ))}
      <CameraRig region={region} centerHeight={centerHeight} lander={fpLander} />
    </>
  );
}

export default function Scene() {
  const regionId = useApp((s) => s.regionId);
  const { region, error } = useRegion(regionId);

  return (
    <div className="absolute inset-0">
      <Canvas
        gl={{ antialias: true, logarithmicDepthBuffer: true, preserveDrawingBuffer: true }}
        dpr={[1, 2]}
        camera={{ fov: 40, near: 0.0005, far: 4000, position: [-20, 15, 25] }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.15;
        }}
      >
        <Suspense fallback={null}>{region && <World region={region} />}</Suspense>
      </Canvas>
      {!region && !error && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="eyebrow animate-pulse">Loading NASA terrain…</div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 grid place-items-center text-danger text-sm">
          Could not load region data: {error.message}
        </div>
      )}
    </div>
  );
}
