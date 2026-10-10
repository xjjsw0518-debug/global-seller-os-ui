import test from "node:test";
import assert from "node:assert/strict";
import { createWorkerResourceWriteAdapter, WORKER_WRITE_PATHS } from "./workerResourceWriteAdapter.js";

const VPS_ID = "4f469ebd-8af3-45f6-83bc-4324a3503c4d";
const WORKER_ID = "3943d885-993d-4820-b7be-a525885db278";
const RUNTIME_ID = "061c83b5-19bd-45c1-9a3e-b10c20abc1b9";

test("real VPS edit patches supported identity and location fields and requires matching API readback", async () => {
  const calls = [];
  const stored = { id: VPS_ID, display_name: "VPS-JKT", country_code: "ID", country_name: "Indonesia", city: "Jakarta", latitude: null, longitude: null, location_source: null };
  const adapter = createWorkerResourceWriteAdapter({ transport: { async request(path, options = {}) {
    calls.push({ path, options });
    if (options.method === "PATCH") {
      Object.assign(stored, options.body);
      return { ...stored };
    }
    if (path === WORKER_WRITE_PATHS.vpsDetail(VPS_ID)) return { ...stored };
    throw new Error(`Unexpected request: ${path}`);
  } } });

  const result = await adapter.updateResource({ vpsId: VPS_ID, form: { name: "VPS-JKT", countryCode: "id", countryName: "Indonesia", city: "Jakarta", lat: "-6.1865021", lng: "106.8044012" } });

  assert.equal(calls[0].options.method, "PATCH");
  assert.deepEqual(calls[0].options.body, { display_name: "VPS-JKT", country_code: "ID", country_name: "Indonesia", city: "Jakarta", latitude: -6.1865021, longitude: 106.8044012, location_source: "MANUAL" });
  assert.equal(calls[1].options.method, undefined);
  assert.equal(result.readback.latitude, -6.1865021);
  assert.equal(result.readback.longitude, 106.8044012);
});

test("VPS location update rejects out-of-range coordinates before network access", async () => {
  let requests = 0;
  const adapter = createWorkerResourceWriteAdapter({ transport: { async request() { requests += 1; return {}; } } });
  await assert.rejects(() => adapter.updateResource({ vpsId: VPS_ID, form: { name: "VPS-JKT", countryCode: "ID", countryName: "Indonesia", city: "Jakarta", lat: "91", lng: "0" } }), { code: "INVALID_LATITUDE" });
  assert.equal(requests, 0);
});

test("new staging resource save uses a stable key from the entered identity", async () => {
  const calls = [];
  const adapter = createWorkerResourceWriteAdapter({ transport: { async request(path, options = {}) {
    calls.push({ path, options });
    if (path === WORKER_WRITE_PATHS.vps && options.method === "POST") return { id: VPS_ID, vps_key: options.body.vps_key, created_at: "2026-10-07T00:00:00Z" };
    if (path === WORKER_WRITE_PATHS.vpsDetail(VPS_ID)) return existingResourceDetail();
    throw new Error(`Unexpected request: ${path}`);
  } } });

  const result = await adapter.saveResource({ name: "VPS-CHINA", countryCode: "cn", city: "Shanghai", lat: "", lng: "", rdpEnabled: false });
  const create = calls.find((call) => call.path === WORKER_WRITE_PATHS.vps && call.options.method === "POST");
  assert.equal(create.options.body.vps_key, "VPS_VPS_CHINA");
  assert.equal(create.options.body.display_name, "VPS-CHINA");
  assert.equal(create.options.body.country_code, "CN");
  assert.equal(create.options.body.country_name, "China");
  assert.equal(create.options.body.environment, "STAGING");
  assert.equal(create.options.body.purpose, "ACCEPTANCE_TEST");
  assert.equal(create.options.body.latitude, null);
  assert.equal(create.options.body.longitude, null);
  assert.equal(result.vps.vps_key, "VPS_VPS_CHINA");
});

test("legacy protected acceptance record keeps its existing stable key", async () => {
  const calls = [];
  const adapter = createWorkerResourceWriteAdapter({ transport: { async request(path, options = {}) {
    calls.push({ path, options });
    if (path === WORKER_WRITE_PATHS.vps && options.method === "POST") return { id: VPS_ID, vps_key: options.body.vps_key, created_at: "2026-10-07T00:00:00Z" };
    if (path === WORKER_WRITE_PATHS.vpsDetail(VPS_ID)) return existingResourceDetail();
    throw new Error(`Unexpected request: ${path}`);
  } } });

  await adapter.saveResource({ name: "TEST_VPS_01 UI Acceptance", countryCode: "id", city: "TEST_VPS_01", rdpEnabled: false });
  const create = calls.find((call) => call.path === WORKER_WRITE_PATHS.vps && call.options.method === "POST");
  assert.equal(create.options.body.vps_key, "TEST_VPS_01_UI_20261004");
  assert.equal(create.options.body.environment, "TEST");
});

function existingResourceDetail() {
  return {
    id: VPS_ID,
    workers: [{ id: WORKER_ID, worker_name: "TEST_VPS_01_WORKER" }],
    runtimes: [{ id: RUNTIME_ID, worker_id: WORKER_ID, runtime_name: "TEST_VPS_01 Browser Runtime", runtime_type: "BROWSER_RPA", lifecycle_status: "ACTIVE" }],
  };
}

test("Install Trigger reuses the matching READY session without runtime/session writes", async () => {
  const calls = [];
  const readySession = { id: "60d210a5-830e-47da-9655-ad30239a62c8", vps_id: VPS_ID, worker_id: WORKER_ID, runtime_id: RUNTIME_ID, status: "READY" };
  const adapter = createWorkerResourceWriteAdapter({ transport: { async request(path, options = {}) {
    calls.push({ path, method: options.method || "GET" });
    if (path === WORKER_WRITE_PATHS.vpsDetail(VPS_ID)) return existingResourceDetail();
    if (path === WORKER_WRITE_PATHS.sessions) return [readySession];
    throw new Error("Unexpected mutation request");
  } } });

  const result = await adapter.triggerInstall({ vpsId: VPS_ID, resourceName: "TEST_VPS_01" });

  assert.equal(result.alreadyReady, true);
  assert.equal(result.reusedSession, true);
  assert.equal(result.session.id, readySession.id);
  assert.deepEqual(calls.map((call) => call.method), ["GET", "GET"]);
});

test("Install Trigger refuses a duplicate when a matching non-READY session exists", async () => {
  const calls = [];
  const adapter = createWorkerResourceWriteAdapter({ transport: { async request(path, options = {}) {
    calls.push({ path, method: options.method || "GET" });
    if (path === WORKER_WRITE_PATHS.vpsDetail(VPS_ID)) return existingResourceDetail();
    if (path === WORKER_WRITE_PATHS.sessions) return [{ id: "pending-session", vps_id: VPS_ID, worker_id: WORKER_ID, runtime_id: RUNTIME_ID, status: "RUNNING" }];
    throw new Error("Unexpected mutation request");
  } } });

  await assert.rejects(() => adapter.triggerInstall({ vpsId: VPS_ID, resourceName: "TEST_VPS_01" }), { code: "EXISTING_PROVISIONING_SESSION" });
  assert.deepEqual(calls.map((call) => call.method), ["GET", "GET"]);
});

test("new Install Trigger uses a stable resource identity idempotency key", async () => {
  const calls = [];
  const adapter = createWorkerResourceWriteAdapter({ transport: { async request(path, options = {}) {
    calls.push({ path, options });
    if (path === WORKER_WRITE_PATHS.vpsDetail(VPS_ID)) return { ...existingResourceDetail(), runtimes: [] };
    if (path === WORKER_WRITE_PATHS.sessions) return [];
    if (path === WORKER_WRITE_PATHS.runtime) return { id: RUNTIME_ID };
    if (path === WORKER_WRITE_PATHS.sessions && options.method === "POST") return { id: "new-session" };
    if (path === WORKER_WRITE_PATHS.sessions) return [];
    throw new Error(`Unexpected request: ${path}`);
  } } });

  await adapter.triggerInstall({ vpsId: VPS_ID, resourceName: "TEST_VPS_01" });
  const createSession = calls.find((call) => call.path === WORKER_WRITE_PATHS.sessions && call.options.method === "POST");
  assert.equal(createSession.options.body.idempotency_key, `worker-add-resource:${VPS_ID}:${WORKER_ID}:${RUNTIME_ID}`);
});
