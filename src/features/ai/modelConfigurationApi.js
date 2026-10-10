export const AI_MODEL_CONFIGURATION_ENDPOINTS = Object.freeze({
  draft: "/api/v1/ai-model-configurations/draft",
  enable: "/api/v1/ai-model-configurations/enable",
  read: (id) => `/api/v1/ai-model-configurations/${encodeURIComponent(id)}`,
});

const safeCode = (value) => /^[A-Z0-9_]{1,80}$/.test(String(value || "")) ? String(value) : "AI_MODEL_SAVE_FAILED";

export function projectConnectionParameters(entries = [], secretRef) {
  const credentialName = /(?:authorization|auth(?:entication)?|api[_-]?key|token|secret|password|credential|cookie|^key$)/i;
  return entries.filter(({ name }) => String(name || "").trim()).map(({ name, value }) => credentialName.test(name)
    ? ({ name: String(name).trim(), secret_ref: secretRef })
    : ({ name: String(name).trim(), value: String(value ?? "") }));
}

async function requestJson(url, options = {}, fetcher = fetch) {
  const response = await fetcher(url, { credentials: "same-origin", headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}) }, ...options });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(safeCode(body?.detail?.code || body?.code || `HTTP_${response.status}`));
    error.code = safeCode(body?.detail?.code || body?.code || `HTTP_${response.status}`);
    error.status = response.status;
    throw error;
  }
  return body?.data ?? body?.item ?? body;
}

export function projectRegistryCosts(costs = {}, existing = {}) {
  const perMillion = (key, field) => {
    if (!Object.hasOwn(costs, key)) return existing[field] ?? null;
    if (costs[key] == null || costs[key] === "") return null;
    const value = Number(costs[key]) * 1000; // Frozen UI rates are USD per thousand tokens.
    if (!Number.isFinite(value) || value < 0) throw new TypeError("Token cost must be finite and non-negative.");
    return value;
  };
  const knownUiRate = Object.values(costs).some(value => value !== "" && value != null);
  return {
    input_cost_per_million_tokens: perMillion("INPUT_TOKEN", "input_cost_per_million_tokens"),
    output_cost_per_million_tokens: perMillion("OUTPUT_TOKEN", "output_cost_per_million_tokens"),
    currency: knownUiRate ? "USD" : existing.currency ?? null,
  };
}

export function buildAiModelConfigurationRequest({ form, accessProvider, secretRef, advancedConnection, customHeaders, customParams, quota, costs, routing, capabilitySources }) {
  if (!accessProvider) throw new TypeError("ACCESS_PROVIDER is required.");
  const authType = String(advancedConnection.authType || "API_KEY").toUpperCase();
  const requiresCredential = authType !== "NONE";
  if (requiresCredential && (!secretRef || !String(secretRef).startsWith("secret://"))) throw new TypeError("A Central Secret Store secret_ref is required for authenticated connections.");
  const numberOrNull = (value) => {
    if (value === "" || value == null) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) throw new TypeError("Quota and cost values must be finite non-negative numbers or unknown.");
    return parsed;
  };
  const costRegistry = Object.fromEntries(Object.entries(costs).map(([key, value]) => [key, numberOrNull(value)]));
  const validatedStage = buildModelStepThreePayload({ quota, costs, routing });
  const selectedCapabilitySources = Object.fromEntries(Object.entries(capabilitySources || {}).filter(([id]) => (form.capabilities || []).includes(id)));
  return {
    model: {
      model_id: String(form.modelId || "").trim(),
      display_name: String(form.displayName || "").trim(),
      model_vendor: form.modelVendor,
      model_identity_type: form.modelIdentityType || "OFFICIAL",
      input_modalities: [...(form.inputModalities || [])],
      output_modalities: [...(form.outputModalities || [])],
      capabilities: [...(form.capabilities || [])],
      capability_sources: selectedCapabilitySources,
    },
    connection: {
      access_provider_id: accessProvider,
      ...(requiresCredential ? { secret_ref: secretRef } : {}),
      endpoint_mode: form.endpointMode,
      base_url: form.endpointMode === "MANUAL" ? String(form.manualBaseUrl || "").trim() : undefined,
      connection_type: advancedConnection.connectionType,
      auth_type: authType,
      deployment_type: advancedConnection.deploymentType,
      region: advancedConnection.region,
      custom_headers: projectConnectionParameters(customHeaders, secretRef),
      custom_query_params: projectConnectionParameters(customParams, secretRef),
      timeout_seconds: Number(advancedConnection.timeout),
      retry_count: Number(advancedConnection.retry),
      health_check_path: advancedConnection.healthPath,
      health_check_interval_seconds: Number(advancedConnection.healthInterval),
    },
    quota_settings: {
      rpm: numberOrNull(quota.rpm),
      tpm: numberOrNull(quota.tpm),
      max_concurrency: numberOrNull(quota.maxConcurrency),
      daily_quota: numberOrNull(quota.dailyQuota),
      monthly_quota: numberOrNull(quota.monthlyQuota),
    },
    cost_registry: costRegistry,
    ...projectRegistryCosts(costRegistry),
    monthly_budget_limit: numberOrNull(quota.monthlyQuota),
    routing_strategy: validatedStage.routing_strategy,
  };
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

const SAFE_SECRET_METADATA_KEYS = new Set([
  "secret_ref", "credential_ref", "credential_configured", "credential_status",
  "api_key_masked", "api_key_last4",
]);
const PLAINTEXT_SECRET_KEY = /^(?:api[_-]?key(?:[_-]?value)?|secret(?:[_-]?value)?|password|authorization|credential[_-]?value|(?:access|session|refresh|bearer)[_-]?token)$/i;
const SENSITIVE_HEADER_OR_PARAM = /(?:authorization|api[_-]?key|token|secret|password|credential)/i;

function assertNoPlaintextSecrets(value, code = "AI_MODEL_SECRET_LEAK_REJECTED") {
  const inspect = (item) => {
    if (Array.isArray(item)) {
      item.forEach(inspect);
      return;
    }
    if (!item || typeof item !== "object") return;
    for (const [key, child] of Object.entries(item)) {
      if (!SAFE_SECRET_METADATA_KEYS.has(key) && PLAINTEXT_SECRET_KEY.test(key)) {
        const error = new Error(code);
        error.code = code;
        throw error;
      }
      if ((key === "custom_headers" || key === "custom_query_params") && Array.isArray(child)) {
        for (const entry of child) {
          if (SENSITIVE_HEADER_OR_PARAM.test(String(entry?.name || "")) && (Object.hasOwn(entry || {}, "value") || !entry?.secret_ref)) {
            const error = new Error(code);
            error.code = code;
            throw error;
          }
        }
      }
      inspect(child);
    }
  };
  inspect(value);
}

function assertReadback(saved, readback, payload, expectedEnabled) {
  assertNoPlaintextSecrets(saved);
  assertNoPlaintextSecrets(readback);
  if (!saved?.id || saved.id !== readback?.id || Boolean(readback.enabled) !== expectedEnabled) {
    const error = new Error("AI_MODEL_ENABLE_STATE_MISMATCH");
    error.code = "AI_MODEL_ENABLE_STATE_MISMATCH";
    throw error;
  }
  for (const area of ["model", "connection", "quota_settings", "cost_registry", "routing_strategy"]) {
    if (JSON.stringify(canonical(readback?.[area])) !== JSON.stringify(canonical(payload[area]))) {
      const error = new Error(`AI_MODEL_${area.toUpperCase()}_READBACK_MISMATCH`);
      error.code = `AI_MODEL_${area.toUpperCase()}_READBACK_MISMATCH`;
      throw error;
    }
  }
}

export function modelConfigurationSaveTimeoutMs(payload, enable = false) {
  if (!enable) return 30_000;
  const connection = payload?.connection || {};
  const seconds = Number.isInteger(connection.timeout_seconds) && connection.timeout_seconds >= 1 && connection.timeout_seconds <= 300 ? connection.timeout_seconds : 30;
  const retries = Number.isInteger(connection.retry_count) && connection.retry_count >= 0 && connection.retry_count <= 5 ? connection.retry_count : 2;
  // Enable performs health, discovery and minimal-inference checks on the server.
  // Budget all three stages plus persistence/readback; never retry a POST here.
  return 3 * seconds * (retries + 1) * 1000 + 30_000;
}

export async function saveAiModelConfiguration(payload, { enable = false, fetcher = fetch, timeoutMs = modelConfigurationSaveTimeoutMs(payload, enable) } = {}) {
  assertNoPlaintextSecrets(payload);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new TypeError("Save timeout must be positive and finite.");
  const controller = new AbortController();
  let expired = false;
  let timer;
  const timeoutError = () => Object.assign(new Error("AI_MODEL_SAVE_TIMEOUT"), { code: "AI_MODEL_SAVE_TIMEOUT" });
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      expired = true;
      reject(timeoutError());
      controller.abort();
    }, timeoutMs);
  });
  const performSave = async () => {
    const saved = await requestJson(enable ? AI_MODEL_CONFIGURATION_ENDPOINTS.enable : AI_MODEL_CONFIGURATION_ENDPOINTS.draft, {
      method: "POST",
      body: JSON.stringify(payload),
      signal: controller.signal,
    }, fetcher);
    // A transport may ignore abort. Never schedule readback after its deadline.
    if (expired) throw timeoutError();
    if (!saved || typeof saved.id !== "string" || !saved.id) {
      const error = new Error("AI_MODEL_SAVE_RESPONSE_INVALID");
      error.code = "AI_MODEL_SAVE_RESPONSE_INVALID";
      throw error;
    }
    const readback = await requestJson(AI_MODEL_CONFIGURATION_ENDPOINTS.read(saved.id), { method: "GET", signal: controller.signal }, fetcher);
    if (expired) throw timeoutError();
    assertReadback(saved, readback, payload, enable);
    const safeReadback = { ...readback, connection: { ...readback.connection } };
    delete safeReadback.connection.secret_ref;
    return { model: safeReadback, dbReadback: true, enabled: enable };
  };
  try {
    return await Promise.race([performSave(), deadline]);
  } finally {
    clearTimeout(timer);
  }
}
import { buildModelStepThreePayload } from "./modelStepThreeContract.js";
