"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { SkyState } from "./Terrain";

/** Distance (scene km) at which sky objects are drawn. They follow the camera so they behave as if at infinity. */
const SKY_DISTANCE = 900;

const toThree = (v: THREE.Vector3, out: THREE.Vector3) => out.set(v.x, v.z, -v.y);

const earthVertex = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vNormal = normalize(mat3(modelMatrix) * normal);
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`;

// Procedural Earth: oceans, land masses and cloud bands from value noise, lit by the real Sun direction,
// so the phase seen from the Moon is physically right (it is the complement of the Moon phase).
const earthFragment = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3 uSun;
  varying vec3 vNormal;
  varying vec3 vPos;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float noise(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
  void main() {
    #include <logdepthbuf_fragment>
    vec3 p = normalize(vPos);
    float land = smoothstep(0.52, 0.56, fbm(p * 2.2 + 3.1));
    float cloud = smoothstep(0.5, 0.75, fbm(p * 4.0 + vec3(0.0, 7.0, 1.3)));
    vec3 col = mix(vec3(0.05, 0.16, 0.38), vec3(0.32, 0.36, 0.22), land);
    col = mix(col, vec3(0.95), cloud * 0.85);
    float lit = max(dot(normalize(vNormal), uSun), 0.0);
    float rim = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 3.0);
    col = col * (lit * 1.6 + 0.015) + vec3(0.3, 0.5, 1.0) * rim * lit * 0.4;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function Sky({ sky }: { sky: SkyState }) {
  const camera = useThree((s) => s.camera);
  const sunRef = useRef<THREE.Group>(null);
  const earthRef = useRef<THREE.Mesh>(null);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const sunThree = useMemo(() => new THREE.Vector3(), []);

  const earthMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: earthVertex,
        fragmentShader: earthFragment,
        uniforms: { uSun: { value: new THREE.Vector3() } },
      }),
    [],
  );

  const sunTexture = useMemo(() => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      g.addColorStop(0, "rgba(255,250,240,1)");
      g.addColorStop(0.11, "rgba(255,246,228,1)");
      g.addColorStop(0.13, "rgba(255,214,150,0.55)");
      g.addColorStop(0.3, "rgba(255,190,110,0.12)");
      g.addColorStop(1, "rgba(255,180,90,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    }
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  useFrame(() => {
    toThree(sky.sun, sunThree);
    if (sunRef.current) {
      sunRef.current.position.copy(camera.position).addScaledVector(sunThree, SKY_DISTANCE);
      sunRef.current.lookAt(camera.position);
      // disc core is 11% of the sprite radius -> sprite radius = r / 0.115
      const r = SKY_DISTANCE * Math.tan((sky.sunRadiusDeg * Math.PI) / 180);
      sunRef.current.scale.setScalar(r / 0.115);
    }
    if (earthRef.current) {
      toThree(sky.earth, tmp);
      earthRef.current.position.copy(camera.position).addScaledVector(tmp, SKY_DISTANCE);
      const r = SKY_DISTANCE * Math.tan((sky.earthRadiusDeg * Math.PI) / 180);
      earthRef.current.scale.setScalar(r);
      // Earth's axis roughly toward lunar "north" so it looks upside-down from the south pole, as it does.
      earthRef.current.rotation.set(Math.PI, 0, 0);
      (earthMaterial.uniforms.uSun.value as THREE.Vector3).copy(sunThree);
    }
  });

  return (
    <>
      <group ref={sunRef} renderOrder={-1}>
        <mesh>
          <planeGeometry args={[2, 2]} />
          <meshBasicMaterial
            map={sunTexture}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      </group>
      <mesh ref={earthRef} material={earthMaterial} renderOrder={-1}>
        <sphereGeometry args={[1, 48, 32]} />
      </mesh>
    </>
  );
}
