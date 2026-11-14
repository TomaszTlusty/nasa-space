/**
 * Shared data contract between the offline precompute (`scripts/data/*`) and the app.
 *
 * Coordinate conventions (MUST be honoured by every module):
 * - Moon: sphere R = 1_737_400 m, Mean Earth / Polar Axis body-fixed frame (as LOLA).
 * - Selenographic lat in degrees (south negative), lon in degrees East, normalised to (-180, 180].
 * - Projection: LOLA south polar stereographic, centre lon 0, true scale at the pole:
 *     rho = 2R * tan(pi/4 + lat/2)   (lat in radians, negative in the south)
 *     X = rho * sin(lon),  Y = rho * cos(lon)            (metres)
 * - Region local frame: x = X - meta.center.X, y = Y - meta.center.Y (metres), z = up (radial at
 *   the region centre). "Grid north" is +y. Grid azimuth = angle from +y clockwise toward +x, deg [0, 360).
 * - three.js scene mapping: three.x = x, three.y = z (up), three.z = -y.
 * - Heights: metres relative to R (LOLA "height"), NOT curvature-corrected. The scene applies the
 *   curvature drop d^2 / 2R itself.
 */

export interface RegionGrid {
  /** samples along x (columns) */
  width: number;
  /** samples along y (rows) */
  height: number;
  /** local x of column 0 / local y of row 0 (metres). Row 0 is the SOUTHERN-most (min y) row. */
  x0: number;
  y0: number;
  /** spacing in metres between samples */
  step: number;
}

export interface HorizonGridInfo extends RegionGrid {
  /** number of azimuth bins; bin k samples grid azimuth k * (360 / azBins) exactly */
  azBins: number;
  /** observer height above terrain used when computing this grid (metres) */
  mastHeight: number;
  /**
   * Encoding of `horizon.bin`: Uint8, elevationDeg = value * quantDeg + offsetDeg.
   * Values are clipped to [offsetDeg, offsetDeg + 255 * quantDeg].
   */
  quantDeg: number;
  offsetDeg: number;
  /** byte layout: index = az * width * height + row * width + col (matches THREE.Data3DTexture) */
  layout: "az-row-col";
}

export interface SiteHorizon {
  mastHeight: number;
  /** horizon elevation (deg) at grid azimuth k * (360 / values.length), full Float precision */
  values: number[];
}

export interface RegionSite {
  id: string;
  name: string;
  /** short category for UI grouping */
  kind: "artemis" | "lander" | "high-illumination" | "reference";
  lat: number;
  lon: number;
  /** local frame coordinates (metres) */
  x: number;
  y: number;
  /** DEM height at the site (m) */
  elevation: number;
  /** citation URL for the coordinates */
  source: string;
  note?: string;
  /** exact per-site horizons at several mast heights (e.g. 0, 2, 5, 10 m), azimuth step <= 0.5 deg */
  horizons: SiteHorizon[];
}

export interface RegionMeta {
  id: string;
  name: string;
  description: string;
  center: { lat: number; lon: number; X: number; Y: number };
  /** side length of the square region (metres) */
  extent: number;
  /** `heights.bin`: Float32 heights (m), layout row * width + col, row 0 = min y */
  terrain: RegionGrid & { file: "heights.bin"; minHeight: number; maxHeight: number };
  /** `normal.png`: RGB tangent-space-free world normal map in region frame, row 0 = max y (image top) */
  normalMap: { file: "normal.png"; size: number };
  /** `horizon.bin` */
  horizon: HorizonGridInfo & { file: "horizon.bin" };
  /** `slope.bin`: Uint8 slope in degrees (0..90) on the horizon grid, layout row * width + col */
  slope: { file: "slope.bin" };
  sites: RegionSite[];
  /** provenance for the References slide / About panel */
  sources: { label: string; url: string }[];
}

/** Output of the validation scripts, shown in the "Validated against NASA" card. */
export interface ValidationReport {
  generatedAt: string;
  horizons: {
    body: "sun" | "earth";
    lat: number;
    lon: number;
    utc: string;
    jplAzimuth: number | null;
    jplElevation: number;
    oursAzimuth: number | null;
    oursElevation: number;
  }[];
  mazarico?: {
    region: string;
    samples: number;
    sunMaePp: number;
    earthMaePp: number;
    sunBiasPp: number;
    earthBiasPp: number;
    method: string;
  }[];
}
