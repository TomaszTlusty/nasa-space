import * as THREE from "three";
import type { LoadedRegion } from "@/lib/moon/horizon";

/**
 * Terrain shader. Lit/unlit is NOT a shadow map: every fragment looks up the precomputed horizon
 * (Data3DTexture: x, y, azimuth) and compares it with the Sun's elevation at that point, then applies
 * the exact visible-disc fraction. The visuals therefore match the numbers in the HUD by construction,
 * and include shadows cast by mountains up to ~300 km outside the rendered tile.
 *
 * Overlay codes: 0 none, 1 instant sun/earth visibility, 2 window average (overlayTex R=sun, G=earth), 3 slope.
 */
export const OVERLAY_CODE = { none: 0, instant: 1, average: 2, slope: 3 } as const;

const vertex = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec2 vLocal;   // region local metres (x, y)
  void main() {
    vLocal = vec2(position.x, -position.z) * 1000.0;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  precision highp sampler3D;
  #include <common>
  #include <logdepthbuf_pars_fragment>

  uniform sampler2D uNormal;
  uniform sampler3D uHorizon;
  uniform sampler2D uSlope;
  uniform sampler2D uOverlayTex;
  uniform vec4 uTerrainRect;   // x0, y0, spanX, spanY (metres) of the normal map
  uniform vec4 uHorizonGrid;   // x0, y0, step, (unused)
  uniform vec3 uHorizonSize;   // width, height, azBins
  uniform vec2 uQuant;         // quantDeg, offsetDeg
  uniform vec3 uSunDir;        // region frame unit vector (x, y, z-up)
  uniform vec3 uEarthDir;
  uniform float uSunRadius;    // deg
  uniform float uEarthRadius;  // deg
  uniform float uR;            // Moon radius, metres
  uniform vec2 uCenter;        // region centre polar-stereo X, Y (metres)
  uniform int uOverlay;
  uniform float uOverlayOpacity;
  uniform float uEdgeFade;     // metres of fade at tile border
  uniform vec3 uCanvas;

  varying vec2 vLocal;

  const float DEG = 57.29577951308232;

  // Fraction of a disc of angular radius r visible above a locally straight horizon,
  // when its centre is d degrees above that horizon. Exact circular-segment area.
  float discFraction(float d, float r) {
    float h = clamp(d / r, -1.0, 1.0);
    return 1.0 - (acos(h) - h * sqrt(1.0 - h * h)) / 3.141592653589793;
  }

  vec3 gridCoord(vec2 p, float azDeg) {
    vec2 uv = ((p - uHorizonGrid.xy) / uHorizonGrid.z + 0.5) / uHorizonSize.xy;
    float binDeg = 360.0 / uHorizonSize.z;
    float w = (azDeg / binDeg + 0.5) / uHorizonSize.z;
    return vec3(uv, w);
  }

  float horizonAt(vec2 p, float azDeg) {
    return texture(uHorizon, gridCoord(p, azDeg)).r * 255.0 * uQuant.x + uQuant.y;
  }

  // Port of altAzAtLocalPoint (src/lib/moon/ephemeris.ts): elevation and grid azimuth (deg) of a
  // region-frame direction seen from local point p, incl. stereographic grid convergence gamma.
  vec2 altAz(vec3 v, vec2 p) {
    vec2 a = p / uR;
    float sinEl = (v.x * a.x + v.y * a.y + v.z) / sqrt(1.0 + dot(a, a));
    float el = asin(clamp(sinEl, -1.0, 1.0)) * DEG;
    float gamma = (uCenter.y * p.x - uCenter.x * p.y) / (2.0 * uR * uR);
    float az = (atan(v.x - a.x * v.z, v.y - a.y * v.z) + gamma) * DEG;
    return vec2(el, mod(az + 360.0, 360.0));
  }

  float visibility(vec3 dir, vec2 p, float radius) {
    vec2 ea = altAz(dir, p);
    return discFraction(ea.x - horizonAt(p, ea.y), radius);
  }

  // Inferno colour map (polynomial fit, Matt Zucker). Perceptually uniform and colour-blind safe.
  vec3 inferno(float t) {
    t = clamp(t, 0.0, 1.0);
    const vec3 c0 = vec3(0.0002189403691192265, 0.001651004631001012, -0.01948089843709184);
    const vec3 c1 = vec3(0.1065134194856116, 0.5639564367884091, 3.932712388889277);
    const vec3 c2 = vec3(11.60249308247187, -3.972853965665698, -15.9423941062914);
    const vec3 c3 = vec3(-41.70399613139459, 17.43639888205313, 44.35414519872813);
    const vec3 c4 = vec3(77.162935699427, -33.40235894210092, -81.80730925738993);
    const vec3 c5 = vec3(-71.31942824499214, 32.62606426397723, 73.20951985803202);
    const vec3 c6 = vec3(25.13112622477341, -12.24266895238567, -23.07032500287172);
    return c0 + t * (c1 + t * (c2 + t * (c3 + t * (c4 + t * (c5 + t * c6)))));
  }

  void main() {
    vec2 p = vLocal;
    vec2 tuv = (p - uTerrainRect.xy) / uTerrainRect.zw;
    vec3 n = normalize(texture(uNormal, tuv).xyz * 2.0 - 1.0);

    float sunVis = uSunDir.z > -0.2 ? visibility(uSunDir, p, uSunRadius) : 0.0;
    float earthVis = uEarthDir.z > -0.3 ? visibility(uEarthDir, p, uEarthRadius) : 0.0;

    // Regolith albedo ~0.12; light: direct sun (gated by terrain horizon), Earthshine fill, tiny ambient for legibility.
    float sunLambert = max(dot(n, uSunDir), 0.0);
    float earthLambert = max(dot(n, uEarthDir), 0.0);
    vec3 albedo = vec3(0.62, 0.61, 0.6);
    vec3 light = vec3(1.0, 0.97, 0.92) * sunLambert * sunVis * 4.2
               + vec3(0.32, 0.42, 0.62) * earthLambert * earthVis * 0.05
               + vec3(0.012, 0.014, 0.02);
    vec3 col = albedo * light;

    if (uOverlay == 1) {
      vec3 sunCol = mix(vec3(0.10, 0.11, 0.16), vec3(0.98, 0.72, 0.30), sunVis);
      col = mix(col, sunCol * (0.55 + 0.45 * sunLambert * 3.0), uOverlayOpacity);
      // Earth-visible ground gets fine diagonal hatching in Earth blue.
      float stripe = step(0.82, fract((p.x + p.y) / 160.0));
      col = mix(col, vec3(0.45, 0.72, 1.0), stripe * earthVis * 0.55 * uOverlayOpacity);
    } else if (uOverlay == 2) {
      vec2 g = ((p - uHorizonGrid.xy) / uHorizonGrid.z + 0.5) / uHorizonSize.xy;
      vec4 avg = texture(uOverlayTex, g);
      vec3 heat = inferno(0.08 + 0.92 * avg.r);
      float shade = 0.65 + 0.35 * clamp(dot(n, normalize(vec3(-0.4, 0.5, 0.75))), 0.0, 1.0);
      col = mix(col, heat * shade, uOverlayOpacity);
    } else if (uOverlay == 3) {
      vec2 g = ((p - uHorizonGrid.xy) / uHorizonGrid.z + 0.5) / uHorizonSize.xy;
      float s = texture(uSlope, g).r * 255.0;
      vec3 ok = vec3(0.22, 0.62, 0.52);
      vec3 warn = vec3(0.95, 0.70, 0.28);
      vec3 bad = vec3(0.86, 0.30, 0.26);
      vec3 sc = s < 5.0 ? ok : (s < 10.0 ? mix(ok, warn, (s - 5.0) / 5.0) : mix(warn, bad, clamp((s - 10.0) / 10.0, 0.0, 1.0)));
      float shade = 0.6 + 0.4 * clamp(dot(n, normalize(vec3(-0.4, 0.5, 0.75))), 0.0, 1.0);
      col = mix(col, sc * shade, uOverlayOpacity);
    }

    // Fade the tile into the canvas at its border (diorama edge).
    vec2 d = min(p - uTerrainRect.xy, uTerrainRect.xy + uTerrainRect.zw - p);
    float edge = smoothstep(0.0, uEdgeFade, min(d.x, d.y));
    col = mix(uCanvas, col, edge);

    #include <logdepthbuf_fragment>
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createTerrainMaterial(region: LoadedRegion, normalMap: THREE.Texture): THREE.ShaderMaterial {
  const { meta, horizon, slope } = region;
  const hg = meta.horizon;

  const horizonTex = new THREE.Data3DTexture(horizon, hg.width, hg.height, hg.azBins);
  horizonTex.format = THREE.RedFormat;
  horizonTex.type = THREE.UnsignedByteType;
  horizonTex.minFilter = THREE.LinearFilter;
  horizonTex.magFilter = THREE.LinearFilter;
  horizonTex.wrapS = THREE.ClampToEdgeWrapping;
  horizonTex.wrapT = THREE.ClampToEdgeWrapping;
  horizonTex.wrapR = THREE.RepeatWrapping;
  horizonTex.unpackAlignment = 1;
  horizonTex.needsUpdate = true;

  const slopeTex = new THREE.DataTexture(slope, hg.width, hg.height, THREE.RedFormat, THREE.UnsignedByteType);
  slopeTex.minFilter = THREE.LinearFilter;
  slopeTex.magFilter = THREE.LinearFilter;
  slopeTex.unpackAlignment = 1;
  slopeTex.needsUpdate = true;

  const overlayTex = new THREE.DataTexture(
    new Uint8Array(hg.width * hg.height * 4),
    hg.width,
    hg.height,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  overlayTex.minFilter = THREE.LinearFilter;
  overlayTex.magFilter = THREE.LinearFilter;
  overlayTex.needsUpdate = true;

  normalMap.colorSpace = THREE.NoColorSpace;
  normalMap.anisotropy = 8;

  const t = meta.terrain;
  const spanX = (t.width - 1) * t.step;
  const spanY = (t.height - 1) * t.step;

  return new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: {
      uNormal: { value: normalMap },
      uHorizon: { value: horizonTex },
      uSlope: { value: slopeTex },
      uOverlayTex: { value: overlayTex },
      uTerrainRect: { value: new THREE.Vector4(t.x0, t.y0, spanX, spanY) },
      uHorizonGrid: { value: new THREE.Vector4(hg.x0, hg.y0, hg.step, 0) },
      uHorizonSize: { value: new THREE.Vector3(hg.width, hg.height, hg.azBins) },
      uQuant: { value: new THREE.Vector2(hg.quantDeg, hg.offsetDeg) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0.02).normalize() },
      uEarthDir: { value: new THREE.Vector3(0, 1, 0.05).normalize() },
      uSunRadius: { value: 0.266 },
      uEarthRadius: { value: 0.95 },
      uR: { value: 1_737_400 },
      uCenter: { value: new THREE.Vector2(meta.center.X, meta.center.Y) },
      uOverlay: { value: 0 },
      uOverlayOpacity: { value: 0.85 },
      uEdgeFade: { value: Math.min(spanX, spanY) * 0.06 },
      uCanvas: { value: new THREE.Color("#0d0e12") },
    },
  });
}
