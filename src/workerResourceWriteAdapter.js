const PREFIX = "/__worker_staging/api/v1";
async function request(path, { method = "GET", body, signal } = {}) {
  const response = await fetch(`${PREFIX}${path}`, {
    method,
    credentials: "same-origin",
    signal,
    headers: body === undefined ? { Accept: "application/json" } : { Accept: "application/json", "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error("Worker staging request failed");
    error.status = response.status;
    error.code = payload?.detail?.code || payload?.code || null;
    throw error;
  }
  return payload;
}
export const WORKER_WRITE_PATHS = Object.freeze({ vps: "/vps", vpsDetail: (id) => `/vps/${encodeURIComponent(id)}`, runtime: "/managed-runtimes", sessions: "/zero-touch/provisioning/sessions", session: (id) => `/zero-touch/provisioning/sessions/${encodeURIComponent(id)}`, readiness: (id) => `/zero-touch/provisioning/sessions/${encodeURIComponent(id)}/readiness` });
function toVpsPayload(form) {
  const displayName = String(form.name || "").trim();
  const normalizedName = displayName.toLocaleUpperCase().replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "");
  const legacyAcceptanceRecord = displayName.toLocaleUpperCase() === "TEST_VPS_01 UI ACCEPTANCE";
  const countryCode = String(form.countryCode || "").toUpperCase();
  const countryName = String(form.countryName || form.country || "").trim()
    || (countryCode ? new Intl.DisplayNames(["en"], { type: "region" }).of(countryCode) : "")
    || countryCode;
  return {
    vps_key: legacyAcceptanceRecord ? "TEST_VPS_01_UI_20261004" : `VPS_${normalizedName}`.slice(0, 96),
    display_name: displayName,
    country_code: countryCode,
    country_name: countryName,
    city: String(form.city || "").trim(),
    latitude: form.lat === "" ? null : Number(form.lat),
    longitude: form.lng === "" ? null : Number(form.lng),
    location_source: "MANUAL",
    environment: legacyAcceptanceRecord ? "TEST" : "STAGING",
    purpose: "ACCEPTANCE_TEST",
    notes: legacyAcceptanceRecord ? "Worker Center Add Resource staging acceptance record" : "Worker Center user-entered acceptance resource",
    rdp_enabled: false,
  };
}
function sameVps(a, b) {
  const keys = ["vps_key", "display_name", "country_code", "country_name", "city", "environment", "purpose", "rdp_enabled"];
  return keys.every((key) => String(a?.[key] ?? "").toLowerCase() === String(b?.[key] ?? "").toLowerCase());
}
export function createWorkerResourceWriteAdapter({ transport = { request } } = {}) {
  if (!transport || typeof transport.request !== "function") throw new TypeError("Worker write transport is required");
  const call = (path, options) => transport.request(path, options);
  return Object.freeze({
    async updateResource({ vpsId, form }) {
      if (!vpsId || !form || typeof form !== "object") throw new TypeError("VPS identity and resource form are required");
      const displayName = String(form.name || "").trim();
      const countryCode = String(form.countryCode || "").trim().toUpperCase();
      const countryName = String(form.countryName || form.country || "").trim()
        || (countryCode ? new Intl.DisplayNames(["en"], { type: "region" }).of(countryCode) : "")
        || countryCode;
      const city = String(form.city || "").trim();
      if (displayName.length < 2) throw Object.assign(new Error("Resource name is required"), { code: "INVALID_RESOURCE_NAME" });
      if (!/^[A-Z]{2}$/.test(countryCode) || !countryName) throw Object.assign(new Error("A valid country is required"), { code: "INVALID_COUNTRY" });
      if (!city) throw Object.assign(new Error("City is required"), { code: "INVALID_CITY" });
      const latitude = form.lat === "" || form.lat == null ? null : Number(form.lat);
      const longitude = form.lng === "" || form.lng == null ? null : Number(form.lng);
      if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) throw Object.assign(new Error("Invalid latitude"), { code: "INVALID_LATITUDE" });
      if (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) throw Object.assign(new Error("Invalid longitude"), { code: "INVALID_LONGITUDE" });
      const vps = await call(WORKER_WRITE_PATHS.vpsDetail(vpsId), {
        method: "PATCH",
        body: { display_name: displayName, country_code: countryCode, country_name: countryName, city, latitude, longitude, location_source: "MANUAL" },
      });
      const detail = await call(WORKER_WRITE_PATHS.vpsDetail(vpsId));
      const persisted = detail?.vps || detail;
      if (persisted?.id !== vpsId || persisted?.display_name !== displayName || persisted?.country_code !== countryCode || persisted?.country_name !== countryName || persisted?.city !== city || persisted?.latitude !== latitude || persisted?.longitude !== longitude) {
        throw Object.assign(new Error("VPS edit readback did not match the saved values"), { code: "READBACK_MISMATCH", vps, detail });
      }
      return { vps, detail, readback: persisted };
    },
    async saveResource(form) {
      if (form.rdpEnabled === true) throw Object.assign(new Error("RDP contract is outside this Worker acceptance slice"), { code: "RDP_NOT_IN_SCOPE" });
      const payload = toVpsPayload(form);
      try {
        const vps = await call(WORKER_WRITE_PATHS.vps, { method: "POST", body: payload });
        return { vps, detail: await call(WORKER_WRITE_PATHS.vpsDetail(vps.id)), created: !vps.idempotent_reuse, idempotentReuse: Boolean(vps.idempotent_reuse) };
      } catch (error) {
        if (error?.status !== 409) throw error;
        const rows = await call(WORKER_WRITE_PATHS.vps);
        const existing = Array.isArray(rows) ? rows.find((row) => row?.vps_key === payload.vps_key) : null;
        if (!existing || !sameVps(existing, payload)) throw error;
        return { vps: existing, detail: await call(WORKER_WRITE_PATHS.vpsDetail(existing.id)), created: false, idempotentReuse: true };
      }
    },
    async triggerInstall({ vpsId, resourceName, runtimeType = "BROWSER_RPA", runtimeVersion = "v5.3-test-runtime", variant = "STANDARD", browserMode = "HEADED" }) {
      if (!vpsId || !resourceName) throw new TypeError("VPS identity and resource name are required");
      const detail = await call(WORKER_WRITE_PATHS.vpsDetail(vpsId));
      const workers = Array.isArray(detail?.workers) ? detail.workers : [];
      const uniqueWorkers = [...new Map(workers.map((worker) => [worker.id, worker])).values()];
      if (uniqueWorkers.length > 1) throw Object.assign(new Error("Ambiguous worker binding"), { code: "AMBIGUOUS_WORKER_BINDING" });
      const worker = uniqueWorkers[0] || null;
      const activeRuntimes = (Array.isArray(detail?.runtimes) ? detail.runtimes : []).filter((item) => item?.lifecycle_status !== "ARCHIVED" && (!worker || item.worker_id === worker.id));
      if (activeRuntimes.length > 1) throw Object.assign(new Error("Ambiguous runtime binding"), { code: "AMBIGUOUS_RUNTIME_BINDING" });
      const existingRuntime = activeRuntimes[0] || null;
      const runtimeId = existingRuntime?.id || existingRuntime?.runtime_id || null;
      if (runtimeId) {
        const sessions = await call(WORKER_WRITE_PATHS.sessions);
        if (!Array.isArray(sessions)) throw Object.assign(new Error("Provisioning session list is invalid"), { code: "INVALID_SESSION_LIST" });
        const matchingSessions = sessions.filter((item) => item?.vps_id === vpsId && item?.runtime_id === runtimeId && (!worker || item?.worker_id === worker.id));
        const readySession = matchingSessions.find((item) => String(item?.status || "").toUpperCase() === "READY");
        if (readySession) return { runtime: existingRuntime, session: readySession, worker, reusedRuntime: true, reusedSession: true, alreadyReady: true };
        if (matchingSessions.length) {
          throw Object.assign(new Error("A provisioning session already exists for this resource; refusing to create another"), { code: "EXISTING_PROVISIONING_SESSION" });
        }
      }
      const runtime = await call(WORKER_WRITE_PATHS.runtime, { method: "POST", body: { vps_id: vpsId, worker_id: worker?.id || null, runtime_name: existingRuntime?.runtime_name || `${resourceName} Browser Runtime`, runtime_type: runtimeType, capabilities: ["BROWSER", "RPA"], runtime_status: "PLANNED", runtime_version: runtimeVersion } });
      const effectiveRuntimeId = runtime.id || runtime.runtime_id;
      const session = await call(WORKER_WRITE_PATHS.sessions, { method: "POST", body: { vps_id: vpsId, worker_id: worker?.id || null, runtime_id: effectiveRuntimeId, worker_name: worker?.worker_name || `${resourceName}_WORKER`, template: "WINDOWS_BROWSER_AI_FULL", runtime_variant: variant, browser_mode: browserMode, persistent_profile_enabled: true, idempotency_key: `worker-add-resource:${vpsId}:${worker?.id || "unbound"}:${effectiveRuntimeId}`, enrollment_ttl_seconds: 900 } });
      return { runtime, session, worker };
    },
    getProvisioningSession: (id) => call(WORKER_WRITE_PATHS.session(id)),
    getReadiness: (id) => call(WORKER_WRITE_PATHS.readiness(id)),
  });
}


