import { geoEquirectangular, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import atlas from "world-atlas/countries-50m.json";
import "./workerWorldOutlineMap.css";

// Use a georeferenced Plate Carrée outline; the former illustrative PNG does
// not share the longitude/latitude projection used by Worker resource points.
const projection = geoEquirectangular()
  .scale(180 / Math.PI)
  .translate([180, 90]);
const path = geoPath(projection);
const countries = feature(atlas, atlas.objects.countries);

export default function WorkerWorldOutlineMap() {
  return (
    <svg className="worker-world-outline-map" viewBox="0 0 360 180" preserveAspectRatio="none" aria-hidden="true">
      <path className="worker-world-land" d={path(countries) || undefined} />
    </svg>
  );
}
