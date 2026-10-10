import test from "node:test";
import assert from "node:assert/strict";
import { buildWorkerOverviewMapModel } from "./workerOverviewMapModel.js";

const VPS_A = "9c8c2f8a-cc6a-4f1b-901d-8c81bc44ed11";
const VPS_B = "9c8c2f8a-cc6a-4f1b-901d-8c81bc44ed13";
const count = (value) => ({ state: "KNOWN", value });
const overview = (ids = [VPS_A], vpsTotal = ids.length, countryCount = 1) => ({
  state: ids.length ? "AVAILABLE" : "EMPTY",
  data: {
    entities: ids.map((id) => ({ id, entityType: "VPS_RESOURCE", countryCode: "ID", countryName: "Indonesia", city: "TEST_VPS_01", locationSource: "MANUAL" })),
    counts: { vpsTotal: count(vpsTotal), countryCount: count(countryCount) },
  },
});
const mapRead = (ids = [VPS_A], vpsCount = ids.length, unlocatedCount = ids.length) => ({
  state: ids.length ? "AVAILABLE" : "EMPTY",
  data: {
    dataStatus: ids.length ? "LIVE" : "EMPTY",
    generatedAt: "2026-10-05T00:00:00Z",
    resources: ids.map((id) => ({ id, countryCode: "ID", countryName: "Indonesia", city: "TEST_VPS_01", coordinateState: "UNLOCATED", latitude: null, longitude: null, statusRaw: "BUSY" })),
    summary: { vpsCount: count(vpsCount), unlocatedCount: count(unlocatedCount) },
  },
});

test("same real VPS identity drives overview KPI and country/city map groups", () => {
  const result = buildWorkerOverviewMapModel(overview(), mapRead());
  assert.equal(result.state, "AVAILABLE");
  assert.deepEqual(result.data.counts, { identities: "MATCH", vpsTotal: "MATCH", countryCount: "MATCH", unlocated: "MATCH" });
  assert.deepEqual(result.data.kpis.vpsTotal, { state: "KNOWN", value: 1, source: "worker-ops/overview" });
  assert.deepEqual(result.data.unlocatedCount, { state: "KNOWN", value: 1, source: "worker-ops/map-data" });
  assert.equal(result.data.countries[0].countryCode, "ID");
  assert.equal(result.data.countries[0].resourceCount, 1);
  assert.equal(result.data.countries[0].cities[0].cityName, "TEST_VPS_01");
  assert.equal(result.data.resources[0].locationSource, "MANUAL");
  assert.equal(result.data.resources[0].pulseFreshness, "UNKNOWN");
  assert.equal(result.data.resources[0].coordinateState, "UNLOCATED");
});

test("count and identity drift is explicit instead of normalizing incompatible snapshots", () => {
  const result = buildWorkerOverviewMapModel(overview([VPS_A], 2, 1), mapRead([VPS_B], 1, 1));
  assert.equal(result.state, "INCONSISTENT");
  assert.equal(result.data.counts.identities, "MISMATCH");
  assert.equal(result.data.counts.vpsTotal, "MISMATCH");
});

test("missing identity or counts remain partial/unknown and no status becomes a fresh pulse", () => {
  const partialMap = mapRead([VPS_A]);
  partialMap.data.resources[0].id = null;
  const partial = buildWorkerOverviewMapModel(overview(), partialMap);
  assert.equal(partial.state, "INCONSISTENT");
  assert.equal(partial.data.counts.identities, "MISMATCH");
  const unknown = buildWorkerOverviewMapModel({ state: "AVAILABLE", data: { entities: [], counts: {} } }, { state: "AVAILABLE", data: { resources: [], summary: {}, dataStatus: "LIVE" } });
  assert.equal(unknown.data.kpis.vpsTotal.state, "UNKNOWN");
  assert.equal(unknown.data.pulseFreshness, "UNKNOWN");
});

test("unavailable snapshots do not synthesize rows or metrics", () => {
  assert.deepEqual(buildWorkerOverviewMapModel({ state: "ERROR" }, { state: "ERROR" }), { state: "UNAVAILABLE", data: null });
});

test("freshness is computed only from active pulses supplied by the backend", () => {
  const map = mapRead();
  map.data.resources[0].workerPulses = [{ lifecycleStatus: "ACTIVE", freshnessState: "FRESH" }];
  map.data.resources[0].runtimePulses = [{ lifecycleStatus: "ACTIVE", freshnessState: "FRESH" }];
  assert.equal(buildWorkerOverviewMapModel(overview(), map).data.resources[0].pulseFreshness, "FRESH");
  map.data.resources[0].runtimePulses[0].freshnessState = "STALE";
  assert.equal(buildWorkerOverviewMapModel(overview(), map).data.resources[0].pulseFreshness, "STALE");
  map.data.resources[0].runtimePulses = [];
  assert.equal(buildWorkerOverviewMapModel(overview(), map).data.resources[0].workerPulseFreshness, "FRESH");
  assert.equal(buildWorkerOverviewMapModel(overview(), map).data.resources[0].runtimePulseFreshness, "UNKNOWN");
  assert.equal(buildWorkerOverviewMapModel(overview(), map).data.resources[0].pulseFreshness, "UNKNOWN");
  map.data.resources[0].workerPulses[0].lifecycleStatus = "ARCHIVED";
  assert.equal(buildWorkerOverviewMapModel(overview(), map).data.resources[0].pulseFreshness, "UNKNOWN");
});

test("Worker and Runtime pulse freshness stay separate", () => {
  const map = mapRead();
  map.data.resources[0].workerPulses = [{ lifecycleStatus: "ACTIVE", freshnessState: "FRESH" }];
  map.data.resources[0].runtimePulses = [{ lifecycleStatus: "ACTIVE", freshnessState: "STALE" }];
  const resource = buildWorkerOverviewMapModel(overview(), map).data.resources[0];
  assert.equal(resource.workerPulseFreshness, "FRESH");
  assert.equal(resource.runtimePulseFreshness, "STALE");
  assert.equal(resource.pulseFreshness, "STALE");
});
