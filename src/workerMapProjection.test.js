import test from "node:test";
import assert from "node:assert/strict";
import { projectWorkerMapResource, projectWorkerWorldCoordinate } from "./workerMapProjection.js";

const VPS_ID = "9c8c2f8a-cc6a-4f1b-901d-8c81bc44ed11";

test("equirectangular projection maps real world bounds and equator", () => {
  assert.deepEqual(projectWorkerWorldCoordinate(90, -180), { x: 0, y: 0 });
  assert.deepEqual(projectWorkerWorldCoordinate(0, 0), { x: 50, y: 50 });
  assert.deepEqual(projectWorkerWorldCoordinate(-90, 180), { x: 100, y: 100 });
});

test("invalid or missing coordinates never create a map point", () => {
  for (const pair of [[null, 0], [0, null], [91, 0], [-91, 0], [0, 181], [0, -181], [NaN, 0]]) {
    assert.equal(projectWorkerWorldCoordinate(...pair), null);
  }
});

test("resource projection requires a stable VPS identity and backend-confirmed coordinates", () => {
  const base = { entityType: "VPS_RESOURCE", id: VPS_ID, coordinateState: "LOCATED", hasCoordinates: true, latitude: -6, longitude: 106 };
  const point = projectWorkerMapResource(base);
  assert.equal(point.resourceId, VPS_ID);
  assert.equal(point.x, ((106 + 180) / 360) * 100);
  assert.equal(point.y, ((90 - (-6)) / 180) * 100);
  assert.equal(projectWorkerMapResource({ ...base, latitude: null }), null);
  assert.equal(projectWorkerMapResource({ ...base, coordinateState: "UNLOCATED", hasCoordinates: false }), null);
  assert.equal(projectWorkerMapResource({ ...base, id: "TEST_VPS_01" }), null);
  assert.equal(projectWorkerMapResource({ ...base, entityType: "MANAGED_RUNTIME" }), null);
});
