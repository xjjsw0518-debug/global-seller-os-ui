const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const validLatitude = (value) => Number.isFinite(value) && value >= -90 && value <= 90;
const validLongitude = (value) => Number.isFinite(value) && value >= -180 && value <= 180;

/** Project a real longitude/latitude pair onto the equirectangular Worker world-map asset. */
export function projectWorkerWorldCoordinate(latitude, longitude) {
  if (!validLatitude(latitude) || !validLongitude(longitude)) return null;
  return {
    x: ((longitude + 180) / 360) * 100,
    y: ((90 - latitude) / 180) * 100,
  };
}

/** Return a marker only for a stable VPS identity with an actual coordinate pair. */
export function projectWorkerMapResource(resource) {
  if (!resource || resource.entityType !== "VPS_RESOURCE" || typeof resource.id !== "string" || !UUID_PATTERN.test(resource.id)) return null;
  if (resource.coordinateState !== "LOCATED" || resource.hasCoordinates !== true) return null;
  const point = projectWorkerWorldCoordinate(resource.latitude, resource.longitude);
  return point ? { resourceId: resource.id.toLowerCase(), ...point } : null;
}
