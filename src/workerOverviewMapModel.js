const isKnownCount = (value) => value?.state === "KNOWN" && Number.isSafeInteger(value.value) && value.value >= 0;
const clean = (value) => typeof value === "string" && value.trim() ? value.trim() : null;
const idList = (rows) => rows.map((row) => row.id).filter((id) => typeof id === "string" && id.length > 0).sort();
function pulseGroupFreshness(pulses) {
  const active = (pulses || []).filter((pulse) => pulse.lifecycleStatus === "ACTIVE");
  if (!active.length || active.some((pulse) => pulse.freshnessState === "UNKNOWN")) return "UNKNOWN";
  if (active.some((pulse) => pulse.freshnessState === "STALE")) return "STALE";
  return active.every((pulse) => pulse.freshnessState === "FRESH") ? "FRESH" : "UNKNOWN";
}

function resourcePulseFreshness(resource) {
  const worker = pulseGroupFreshness(resource.workerPulses);
  const runtime = pulseGroupFreshness(resource.runtimePulses);
  if (worker === "UNKNOWN" || runtime === "UNKNOWN") return "UNKNOWN";
  if (worker === "STALE" || runtime === "STALE") return "STALE";
  return "FRESH";
}

function groupResources(resources) {
  const countries = new Map();
  let unassignedCountryCount = 0;
  for (const resource of resources) {
    const code = clean(resource.countryCode)?.toUpperCase();
    if (!code) {
      unassignedCountryCount += 1;
      continue;
    }
    if (!countries.has(code)) countries.set(code, { countryCode: code, countryName: clean(resource.countryName) || code, resources: [], cities: new Map() });
    const country = countries.get(code);
    if (country.countryName === code && clean(resource.countryName)) country.countryName = clean(resource.countryName);
    country.resources.push(resource);
    const cityName = clean(resource.city);
    if (!cityName) continue;
    const cityKey = cityName.toLocaleLowerCase();
    if (!country.cities.has(cityKey)) country.cities.set(cityKey, { cityName, resources: [] });
    country.cities.get(cityKey).resources.push(resource);
  }
  return {
    countries: [...countries.values()].map((country) => ({
      countryCode: country.countryCode,
      countryName: country.countryName,
      resources: country.resources,
      resourceCount: country.resources.length,
      cities: [...country.cities.values()].map((city) => ({ ...city, resourceCount: city.resources.length })),
    })),
    unassignedCountryCount,
  };
}

export function buildWorkerOverviewMapModel(overviewRead, mapRead) {
  const overview = overviewRead?.data;
  const map = mapRead?.data;
  if (!overview || !map || !Array.isArray(overview.entities) || !Array.isArray(map.resources)) {
    return { state: "UNAVAILABLE", data: null };
  }
  const vpsRows = overview.entities.filter((entity) => entity?.entityType === "VPS_RESOURCE");
  const mapRows = map.resources;
  const overviewById = new Map(vpsRows.filter((resource) => resource?.id).map((resource) => [resource.id, resource]));
  const overviewIds = idList(vpsRows);
  const mapIds = idList(mapRows);
  const duplicateMapIds = mapIds.filter((id, index) => index > 0 && id === mapIds[index - 1]).length;
  const identitiesMatch = duplicateMapIds === 0 && overviewIds.length === vpsRows.length && mapIds.length === mapRows.length
    && overviewIds.length === mapIds.length && overviewIds.every((id, index) => id === mapIds[index]);
  const groups = groupResources(mapRows);
  const vpsTotal = overview.counts?.vpsTotal;
  const countryCount = overview.counts?.countryCount;
  const mapVpsCount = map.summary?.vpsCount;
  const mapUnlocatedCount = map.summary?.unlocatedCount;
  const countryCodesFromRows = groups.countries.length;
  const countChecks = {
    identities: identitiesMatch ? "MATCH" : "MISMATCH",
    vpsTotal: isKnownCount(vpsTotal) && isKnownCount(mapVpsCount)
      ? (vpsTotal.value === mapVpsCount.value && mapVpsCount.value === mapRows.length ? "MATCH" : "MISMATCH")
      : "UNKNOWN",
    countryCount: isKnownCount(countryCount)
      ? (countryCount.value === countryCodesFromRows ? "MATCH" : "MISMATCH")
      : "UNKNOWN",
    unlocated: isKnownCount(mapUnlocatedCount)
      ? (mapUnlocatedCount.value === mapRows.filter((row) => row.coordinateState === "UNLOCATED").length ? "MATCH" : "MISMATCH")
      : "UNKNOWN",
  };
  const hasMismatch = Object.values(countChecks).includes("MISMATCH");
  const partialInput = !["AVAILABLE", "EMPTY"].includes(overviewRead.state) || !["AVAILABLE", "EMPTY"].includes(mapRead.state);
  return {
    state: hasMismatch ? "INCONSISTENT" : partialInput ? "PARTIAL" : mapRows.length ? "AVAILABLE" : "EMPTY",
    data: {
      resources: mapRows.map((resource) => ({
        ...resource,
        locationSource: overviewById.get(resource.id)?.locationSource || null,
        workerPulseFreshness: pulseGroupFreshness(resource.workerPulses),
        runtimePulseFreshness: pulseGroupFreshness(resource.runtimePulses),
        pulseFreshness: resourcePulseFreshness(resource),
      })),
      countries: groups.countries,
      unassignedCountryCount: groups.unassignedCountryCount,
      kpis: {
        vpsTotal: isKnownCount(vpsTotal) ? { ...vpsTotal, source: "worker-ops/overview" } : { state: "UNKNOWN", value: null, source: "worker-ops/overview" },
        countryCount: isKnownCount(countryCount) ? { ...countryCount, source: "worker-ops/overview" } : { state: "UNKNOWN", value: null, source: "worker-ops/overview" },
      },
      unlocatedCount: isKnownCount(mapUnlocatedCount) ? { ...mapUnlocatedCount, source: "worker-ops/map-data" } : { state: "UNKNOWN", value: null, source: "worker-ops/map-data" },
      counts: countChecks,
      mapDataStatus: map.dataStatus || "UNKNOWN",
      generatedAt: map.generatedAt || null,
      pulseFreshness: mapRows.length === 0 ? "UNKNOWN" : mapRows.every((resource) => resourcePulseFreshness(resource) === "FRESH") ? "FRESH" : mapRows.some((resource) => resourcePulseFreshness(resource) === "STALE") ? "STALE" : "UNKNOWN",
    },
  };
}
