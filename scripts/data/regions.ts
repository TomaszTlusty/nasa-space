/** Region and site definitions for the precompute (coordinates: planetocentric, ME frame, deg E). */
import { latLonToPolar, normLon } from "../../src/lib/moon/frames";
import type { RegionSite } from "../../src/lib/moon/types";

export const DATA_BOOK_URL =
  "https://ntrs.nasa.gov/api/citations/20230007818/downloads/ACD-50044%20Lunar%20Surface%20Data%20Book%20Rev%20A.pdf";
export const GLASER_2018_URL = "https://ntrs.nasa.gov/citations/20170007365";
export const ARTEMIS_REGIONS_URL =
  "https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/";
export const CLPS_URL = "https://science.nasa.gov/lunar-science/clps-deliveries/";
export const LOLA_GDR_URL = "http://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/";
export const MAZARICO_URL = "https://pgda.gsfc.nasa.gov/products/69";

export type SiteDef = Pick<RegionSite, "id" | "name" | "kind" | "lat" | "lon" | "source" | "note">;

export interface RegionDef {
  id: string;
  name: string;
  description: string;
  /** projected centre (m) */
  X: number;
  Y: number;
  sites: SiteDef[];
}

const site = (s: SiteDef): SiteDef => ({ ...s, lon: normLon(s.lon) });

const site23 = latLonToPolar(-85.9948, -0.2358);

export const REGIONS: Record<string, RegionDef> = {
  shackleton: {
    id: "shackleton",
    name: "Shackleton & Connecting Ridge",
    description:
      "41 x 41 km around the lunar south pole: Shackleton crater (permanently shadowed floor), its sunlit rim and the Connecting Ridge toward de Gerlache, among the best-lit terrain near the south pole (up to ~88% average illumination 2 m above ground, Gläser et al. 2018).",
    // chosen so Shackleton (centre X 7.9 km, Y -6.6 km, ~21 km wide), C2 (X -18.9 km) and the ridge
    // sites all lie >= 1.5 km inside the square
    X: -300,
    Y: -6600,
    // ordered for the UI: best demo picks first
    sites: [
      site({
        id: "c1",
        name: "Connecting Ridge C1",
        kind: "high-illumination",
        lat: -89.4505,
        lon: 222.84,
        source: GLASER_2018_URL,
        note: "Gläser et al. 2018: 76.0 % average illumination at the surface, 88.0 % at 2 m (nearby optimum -89.4398, 222.83).",
      }),
      site({
        id: "rim-s",
        name: "Shackleton rim S",
        kind: "high-illumination",
        lat: -89.7849,
        lon: 203.97,
        source: GLASER_2018_URL,
        note: "Gläser et al. 2018: 81.0 % average illumination at the surface.",
      }),
      site({
        id: "c2",
        name: "Connecting Ridge C2",
        kind: "high-illumination",
        lat: -89.3157,
        lon: 245.94,
        source: GLASER_2018_URL,
        note: "Gläser et al. 2018: 75.6 % average illumination at the surface.",
      }),
      site({
        id: "cr1",
        name: "NASA example landing point CR1",
        kind: "reference",
        lat: -89.468,
        lon: 222.6,
        source: DATA_BOOK_URL,
        note: "Example landing point used in the NASA Lunar Surface Data Book (§7.3). Connecting Ridge was an Artemis III candidate region in 2022, not in the 2024 list of 9.",
      }),
      site({
        id: "blue-moon-mk1",
        name: "Blue Moon MK1 target",
        kind: "lander",
        lat: -89.468,
        lon: 222.6,
        source: CLPS_URL,
        note: "Target area (Shackleton Connecting Ridge); exact point not published — shown at NASA's CR1 example point.",
      }),
      site({
        id: "site01",
        name: "Connecting Ridge region (Site 01 centre)",
        kind: "reference",
        lat: -89.4632,
        lon: -137.49,
        source: DATA_BOOK_URL,
        note: "Region centre from the NASA Lunar Surface Data Book (PGDA 5 m site ROI, Table A2-2); a region centre, not an illumination optimum (~51 % year-average sunlight here).",
      }),
      site({
        id: "site04",
        name: "Shackleton rim region (Site 04 centre)",
        kind: "reference",
        lat: -89.7668,
        lon: -171.87,
        source: DATA_BOOK_URL,
        note: "Region centre from the NASA Lunar Surface Data Book; lies on the inner crater wall, not the sunlit rim crest.",
      }),
      site({
        id: "shackleton-floor",
        name: "Shackleton crater floor",
        kind: "reference",
        lat: -89.66,
        lon: 129.78,
        source: GLASER_2018_URL,
        note: "Crater centre (IAU gazetteer 89.66 S, 129.78 E). Permanently shadowed region: no direct sunlight.",
      }),
    ],
  },
  malapert: {
    id: "malapert",
    name: "Malapert Massif",
    description:
      "41 x 41 km around the Malapert Massif (Artemis candidate region): its summit, ~5 km above the lunar datum, faces the Earth and sees far more sunlight than the surrounding lowlands, while slopes behind it lose the Earth entirely.",
    X: Math.round(site23.X),
    Y: Math.round(site23.Y),
    sites: [
      site({
        id: "site23",
        name: "Malapert Massif (Site 23)",
        kind: "artemis",
        lat: -85.9948,
        lon: -0.2358,
        source: DATA_BOOK_URL,
        note: "PGDA 5 m site ROI centre (Lunar Surface Data Book Table A2-2); Artemis candidate region.",
      }),
      // + DEM-derived reference points added by build.ts (lower slope, crater floor)
    ],
  },
};
