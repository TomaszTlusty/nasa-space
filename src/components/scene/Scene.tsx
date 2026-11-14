"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { liveAt } from "@/lib/analysis";
import { bodyVectorRegionFromEphemeris, moonEphemeris } from "@/lib/moon/ephemeris";
import type { LoadedRegion } from "@/lib/moon/horizon";
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
const FLY_SECONDS = 0.9;

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

  // Fly-to requests (lessons, discovery results): keep the current viewing direction, move to `distanceKm`.
  const focus = useApp((s) => s.focus);
  const fly = useRef<{
    fromPos: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toPos: THREE.Vector3;
    toTarget: THREE.Vector3;
    t: number;
  } | null>(null);
  useEffect(() => {
    const c = controls.current;
    if (!focus || firstPerson || !c) return;
    const h = heightAt(region.meta, region.heights, focus.x, focus.y);
    const toTarget = new THREE.Vector3(focus.x / 1000, sceneY(h, focus.x, focus.y, centerHeight), -focus.y / 1000);
    // keep the current heading but look down at least ~35°, so a fly-to after first-person never ends at ground level
    const dir = camera.position.clone().sub(c.target).normalize();
    const horiz = Math.hypot(dir.x, dir.z) || 1;
    if (dir.y < 0.57) dir.set((dir.x / horiz) * 0.82, 0.57, (dir.z / horiz) * 0.82).normalize();
    const toPos = toTarget.clone().addScaledVector(dir, focus.distanceKm);
    fly.current = { fromPos: camera.position.clone(), fromTarget: c.target.clone(), toPos, toTarget, t: 0 };
  }, [focus, firstPerson, region, centerHeight, camera]);

  const viewHome = useApp((s) => s.viewHome);
  useEffect(() => {
    const c = controls.current;
    if (viewHome === 0 || firstPerson || !c) return;
    const ext = region.meta.extent / 1000;
    fly.current = {
      fromPos: camera.position.clone(),
      fromTarget: c.target.clone(),
      toPos: new THREE.Vector3(-ext * 0.55, ext * 0.42, ext * 0.62),
      toTarget: new THREE.Vector3(0, -ext * 0.03, 0),
      t: 0,
    };
  }, [viewHome, firstPerson, region, camera]);
  useFrame((_, dt) => {
    const f = fly.current;
    const c = controls.current;
    if (!f || !c) return;
    f.t = Math.min(1, f.t + dt / FLY_SECONDS);
    const k = 1 - (1 - f.t) ** 3; // ease-out cubic
    camera.position.lerpVectors(f.fromPos, f.toPos, k);
    c.target.lerpVectors(f.fromTarget, f.toTarget, k);
    c.update();
    if (f.t >= 1) fly.current = null;
  });

  const ext = region.meta.extent / 1000;
  // Distinct keys: R3F would otherwise reuse one OrbitControls instance and reset removed props to 0
  // (e.g. maxDistance/rotateSpeed), freezing the camera after switching views.
  return firstPerson ? (
    <OrbitControls
      key="first-person"
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
      key="orbit"
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
  const sitePinsHidden = useApp((s) => s.sitePinsHidden);

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
    // same function the panels use (exact per-site horizon when placed on a curated site)
    const live = liveAt(region, time, p.x, p.y, { siteId: p.siteId, mastHeight });
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
      {!sitePinsHidden && (
        <SiteMarkers
          region={region}
          centerHeight={centerHeight}
          dimmed={fpLander !== null}
          occupied={landerEntries.map((l) => l.p)}
          onSelect={(s) => placeLander(placing ?? activeLander, { x: s.x, y: s.y, siteId: s.id })}
        />
      )}
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
