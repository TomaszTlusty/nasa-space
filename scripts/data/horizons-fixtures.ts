/**
 * JPL Horizons fixtures (fetched 2026-11-14 from https://ssd.jpl.nasa.gov/api/horizons.api with
 * CENTER='coord@301', COORD_TYPE='GEODETIC', QUANTITIES='4', ANG_FORMAT='DEG', EXTRA_PREC='YES',
 * TLIST=<utc>). Apparent airless azimuth/elevation, MEAN_ME frame, sphere R = 1737.4 km.
 * Site = E-longitude (Horizons convention, 0..360), latitude, altitude 0.
 */
export interface HorizonsFixture {
  body: "sun" | "earth";
  lonE: number;
  lat: number;
  utc: string;
  az: number;
  el: number;
}

export const HORIZONS_FIXTURES: HorizonsFixture[] = [
  { body: "sun", lonE: 0, lat: -89.5, utc: "2026-11-14T00:00:00Z", az: 126.627332945, el: 1.25833464 },
  { body: "earth", lonE: 225, lat: -89.45, utc: "2026-11-14T00:00:00Z", az: 133.740725833, el: -5.0285092 },
  { body: "sun", lonE: 359.7642, lat: -85.9948, utc: "2027-03-01T12:00:00Z", az: 259.723530559, el: -1.296969175 },
  { body: "earth", lonE: 359.7642, lat: -85.9948, utc: "2027-03-01T12:00:00Z", az: 3.668698597, el: -1.884230386 },
  { body: "sun", lonE: 30, lat: -45, utc: "2026-12-01T06:00:00Z", az: 252.281167901, el: -14.939850325 },
  { body: "earth", lonE: 30, lat: -45, utc: "2026-12-01T06:00:00Z", az: 329.541046219, el: 38.705744107 },
  { body: "sun", lonE: 222.84, lat: -89.4505, utc: "2027-06-15T18:00:00Z", az: 180.148769682, el: -1.736070621 },
  { body: "earth", lonE: 188.13, lat: -89.7668, utc: "2026-12-20T03:00:00Z", az: 164.715203241, el: 5.791895053 },
  { body: "sun", lonE: 160, lat: 20, utc: "2027-01-10T09:30:00Z", az: 209.376237114, el: 66.364233236 },
  { body: "earth", lonE: 275, lat: -10, utc: "2027-02-05T21:00:00Z", az: 87.318611565, el: 6.254877368 },
];
