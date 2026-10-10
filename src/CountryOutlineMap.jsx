import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import atlas from "world-atlas/countries-50m.json";

const countryNumericId = {
  id: 360, us: 840, sg: 702, de: 276, jp: 392, es: 724, fr: 250, it: 380,
  kr: 410, mx: 484, th: 764, vn: 704, nl: 528, ph: 608, my: 458,
  ae: 784, tr: 792, za: 710, pl: 616, gb: 826, ca: 124, au: 36, br: 76, in: 356,
};

const countries = feature(atlas, atlas.objects.countries).features;
const cache = new Map();

export function getCountryMapLayout(countryCode) {
  if (cache.has(countryCode)) return cache.get(countryCode);
  const source = countries.find((item) => Number(item.id) === countryNumericId[countryCode]);
  if (!source) return null;
  // The US country shape includes Alaska and Hawaii. The country drill-down
  // uses the contiguous mainland so its city markers remain legible.
  const geometry = countryCode === "us" && source.geometry.type === "MultiPolygon"
    ? { ...source, geometry: { type: "MultiPolygon", coordinates: source.geometry.coordinates.filter((polygon) => polygon[0].some(([lon, lat]) => lon > -130 && lon < -65 && lat > 20 && lat < 55)) } }
    : source;
  const projection = geoMercator().fitExtent([[65, 18], [935, 282]], geometry);
  const layout = {
    path: geoPath(projection)(geometry),
    project: ([latitude, longitude]) => projection([longitude, latitude]),
  };
  cache.set(countryCode, layout);
  return layout;
}

export default function CountryOutlineMap({ countryCode }) {
  const layout = getCountryMapLayout(countryCode);
  if (!layout) return null;
  const gradientId = `country-fill-${countryCode}`;
  return <svg className="country-outline-map" viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#123a71" /><stop offset=".55" stopColor="#0b2c60" /><stop offset="1" stopColor="#071a3e" /></linearGradient>
      <pattern id="country-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M 32 0 L 0 0 0 32" fill="none" stroke="#1895e2" strokeOpacity=".13" strokeWidth="1" /></pattern>
    </defs>
    <path className="country-shape-glow" d={layout.path} />
    <path className="country-shape" d={layout.path} fill={`url(#${gradientId})`} />
    <path d={layout.path} fill="url(#country-grid)" opacity=".85" />
  </svg>;
}
