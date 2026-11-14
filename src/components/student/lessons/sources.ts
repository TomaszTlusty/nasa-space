/**
 * Citations for every science fact shown in Student mode (guide bubbles and lessons).
 * Each fact in the UI links to one of these.
 */
export interface Source {
  label: string;
  url: string;
}

export const SOURCES = {
  /** Connecting Ridge ~76 % average illumination (88 % at 2 m), longest darkness ~112 h; Sun ~1.5° at the pole. */
  glaser2018: {
    label: "Gläser et al. 2018, illumination near Shackleton",
    url: "https://ntrs.nasa.gov/api/citations/20170007365/downloads/20170007365.pdf",
  },
  /** How the Sun and Earth move in the sky seen from the south pole (1.54° axial tilt). */
  svs4944: {
    label: "NASA SVS 4944, Earth and Sun from the Moon's South Pole",
    url: "https://svs.gsfc.nasa.gov/4944/",
  },
  /** Permanently shadowed floors ~35 K (−238 °C), water ice stable there. */
  moonWater: {
    label: "NASA Science, Moon water and ices",
    url: "https://science.nasa.gov/moon/moon-water-and-ices/",
  },
  /** Earth disc 1.8–2.0°, libration ±6.7° / ±7.9°, Earth ~2 weeks visible / ~2 weeks hidden at the pole. */
  hls2024: {
    label: "NASA HLS lunar south pole environment, 2024 (NTRS 20240009596)",
    url: "https://ntrs.nasa.gov/citations/20240009596",
  },
  /** No air on the Moon: nothing scatters sunlight into shadows, so they are pitch black. */
  amesShadows: {
    label: "NASA Ames, How light looks different on the Moon",
    url: "https://www.nasa.gov/centers-and-facilities/ames/the-dark-side-of-the-crater-how-light-looks-different-on-the-moon-and-what-nasa-is-doing-about-it/",
  },
  /** Terrain heights used for every map and horizon in this app. */
  lola: {
    label: "LRO LOLA polar elevation models (NASA PDS)",
    url: "http://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/",
  },
} satisfies Record<string, Source>;
