import { saveAiModelConfiguration, projectRegistryCosts } from "./modelConfigurationApi.js";
import { normalizeModelConnectionHealthResponse } from "./modelConnectionHealthContract.js";

const ROOT = "/api/v1/ai-model-operations";
const CONFIG = "/api/v1/ai-model-configurations";
const CONNECTION_TEST = "/api/v1/ai-model-connection-tests";
const confirmedArchives = new Map();

const codeOf = (value, fallback) => /^[A-Z0-9_]{1,80}$/.test(String(value || "")) ? String(value) : fallback;
const envelopeData = (body) => body?.data ?? body?.item ?? body;

async function request(path, options = {}, fetcher = fetch) {
  const response = await fetcher(path, {
    credentials: "same-origin",
    headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(codeOf(body?.detail?.code || body?.code, `HTTP_${response.status}`));
    error.code = codeOf(body?.detail?.code || body?.code, `HTTP_${response.status}`);
    error.status = response.status;
    error.source = "AI_STAGING_API";
    error.productionVerified = false;
    throw error;
  }
  return envelopeData(body);
}

function safeConfiguration(value) {
  const result = value && typeof value === "object" ? structuredClone(value) : {};
  if (result.connection && typeof result.connection === "object") delete result.connection.secret_ref;
  delete result.api_key;
  delete result.secret;
  delete result.password;
  delete result.authorization;
  return result;
}

function operationRow(value) {
  const row = value && typeof value === "object" ? value : {};
  const rawCost = row.cost_summary && typeof row.cost_summary === "object" ? row.cost_summary : {};
  const currency = typeof rawCost.currency === "string" && /^[A-Z]{3}$/.test(rawCost.currency) ? rawCost.currency : null;
  // Operations quota_summary may mix free-token allowance with token usage.
  // Compare only monetary budget and monetary cost with the same currency.
  const rawBudget = row.monthly_budget_limit ?? row.monthly_quota;
  const quotaTotal = rawBudget != null && Number.isFinite(Number(rawBudget)) ? Number(rawBudget) : null;
  const spend = rawCost.status === "KNOWN" && currency && Number.isFinite(Number(rawCost.amount)) ? Number(rawCost.amount) : null;
  const quotaSummary = {
    status: quotaTotal != null && currency ? "KNOWN" : "UNKNOWN",
    total: quotaTotal != null && currency ? quotaTotal : null,
    used: spend,
    remaining: quotaTotal != null && currency && spend != null ? Math.max(0, quotaTotal - spend) : null,
    currency,
    source: quotaTotal != null && currency && spend != null ? "SERVER_QUOTA_AND_COST_READBACK" : "UNKNOWN",
  };
  const healthStatus = String(row.health_status || "UNKNOWN").toUpperCase();
  const enabled = typeof row.enabled === "boolean" ? row.enabled : null;
  const statusLabel = enabled === false ? "已停用" : enabled === null ? "状态未知" : ({ READY: "运行正常", DEGRADED: "连接降级", RATE_LIMITED: "频率受限", AUTH_ERROR: "认证错误", TIMEOUT: "连接超时", UNAVAILABLE: "不可用", DISABLED: "已停用" }[healthStatus] || "待测试");
  return {
    id: row.model_registry_id || row.id,
    model: row.display_name || row.model_id || row.model_name || "Unknown model",
    modelId: row.model_id || row.model_name || "",
    provider: row.provider_display_name || "Access Provider",
    providerId: row.provider_id || null,
    type: row.category || row.model_category || row.type || "未知",
    context: row.context_window || row.context_length || "未知",
    used: spend,
    quota: quotaSummary.total,
    currency,
    enabled,
    status: statusLabel,
    healthStatus,
    priority: row.route_priority == null ? "—" : `P${row.route_priority}`,
    updated: row.updated_at ? new Date(row.updated_at).toLocaleString("zh-CN", { hour12: false }) : "—",
    readbackSource: "AI_STAGING_SERVER",
    capabilityCount: Array.isArray(row.capabilities) ? row.capabilities.length : 0,
    credentialConfigured: row.credential_configured === true,
    quotaSummary,
    usageSummary: row.usage_summary || {},
    costSummary: rawCost,
    costLevel: row.cost_level || "UNKNOWN",
    usageStrategy: row.usage_strategy || "UNKNOWN",
    billingMode: row.billing_mode || "UNMANAGED",
    rawOperation: row,
  };
}

function withQuery(path, query = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  return params.size ? `${path}?${params.toString()}` : path;
}

export const aiModelOperationsApi = {
  async list({ page = 1, pageSize = 100, search } = {}) {
    const dto = await request(withQuery(ROOT, { page, page_size: pageSize, search }));
    if (Array.isArray(dto)) return { items: dto.map(operationRow), total: dto.length, page: 1, pageSize: dto.length, totalPages: 1, summary: { enabled: dto.filter((row) => row.enabled === true).length, healthy: dto.filter((row) => row.health_status === "READY").length }, source: "SERVER_READ_PROJECTION" };
    if (!dto || !Array.isArray(dto.items) || !Number.isInteger(dto.total)) throw Object.assign(new Error("AI_MODEL_OPERATIONS_BAD_RESPONSE"), { code: "AI_MODEL_OPERATIONS_BAD_RESPONSE", source: "AI_STAGING_API" });
    return { items: dto.items.map(operationRow), total: dto.total, page: dto.page || page, pageSize: dto.page_size || pageSize, totalPages: dto.total_pages || 0, summary: dto.summary || {}, source: "SERVER_READ_PROJECTION" };
  },
  async getConfiguration(id) {
    const result = await request(`${CONFIG}/${encodeURIComponent(id)}`);
    if (!result || typeof result !== "object") throw Object.assign(new Error("AI_MODEL_CONFIGURATION_BAD_RESPONSE"), { code: "AI_MODEL_CONFIGURATION_BAD_RESPONSE", source: "AI_STAGING_API" });
    return safeConfiguration(result);
  },
  async getDetail(id) {
    const config = await this.getConfiguration(id);
    const modelId = config.model?.model_id || config.model_id || "";
    const projection = modelId ? await this.list({ page: 1, pageSize: 100, search: modelId }) : { items: [] };
    const row = projection.items.find((item) => item.id === id);
    return { item: { ...(row || operationRow({ ...config, model_registry_id: config.id, provider_display_name: config.provider_display_name })), configuration: config }, source: "AI_STAGING_API" };
  },
  async setEnabled(id, enabled) {
    try {
      const result = await request(`${ROOT}/${encodeURIComponent(id)}/state`, { method: "PATCH", body: JSON.stringify({ enabled: Boolean(enabled) }) });
      return { item: operationRow(result), source: "AI_STAGING_API" };
    } catch (error) {
      if (!enabled || error.code !== "CONNECTION_TEST_REQUIRED") throw error;
      const config = await request(`${CONFIG}/${encodeURIComponent(id)}`);
      const areas = ["model", "connection", "quota_settings", "cost_registry", "routing_strategy"];
      if (areas.some((area) => !config?.[area] || typeof config[area] !== "object")) throw error;
      const payload = Object.fromEntries(areas.map((area) => [area, config[area]]));
      payload.model_registry_id = id;
      payload.monthly_budget_limit = config.quota_settings.monthly_quota ?? null;
      Object.assign(payload, projectRegistryCosts(config.cost_registry, config));
      // The existing enable endpoint verifies the real connection before committing.
      const saved = await saveAiModelConfiguration(payload, { enable: true });
      if (saved.model.id !== id) throw Object.assign(new Error("AI_MODEL_ENABLE_ID_MISMATCH"), { code: "AI_MODEL_ENABLE_ID_MISMATCH" });
      const detail = await this.getDetail(id);
      return { ...detail, dbReadback: saved.dbReadback };
    }
  },
  async update(id, changes) {
    const current = await request(`${CONFIG}/${encodeURIComponent(id)}`);
    const model = { ...(current.model || {}) };
    const connection = { ...(current.connection || {}) };
    const quota = { ...(current.quota_settings || {}) };
    const costs = { ...(current.cost_registry || {}) };
    const routing = { ...(current.routing_strategy || {}) };
    if (typeof changes.modelId === "string") model.model_id = changes.modelId.trim();
    else if (typeof changes.model === "string") model.model_id = changes.model.trim();
    if (typeof changes.displayName === "string") model.display_name = changes.displayName.trim();
    if (changes.quota !== undefined) quota.monthly_quota = changes.quota === "" || changes.quota == null ? null : Number(changes.quota);
    if (changes.priority !== undefined) routing.route_priority = changes.priority === "" || changes.priority == null ? null : Number(String(changes.priority).replace(/^P/i, ""));
    if (changes.routeWeight !== undefined) routing.route_weight = Number(changes.routeWeight);
    if (changes.costLevel !== undefined) current.cost_level = changes.costLevel;
    if (changes.usageStrategy !== undefined) current.usage_strategy = changes.usageStrategy;
    const payload = {
      model, connection, quota_settings: quota, cost_registry: costs, routing_strategy: routing,
      model_registry_id: current.id || id,
      provider_id: current.provider_id,
      model_id: model.model_id || current.model_id,
      display_name: model.display_name || current.display_name || model.model_id || current.model_id,
      cost_level: current.cost_level ?? null,
      usage_strategy: current.usage_strategy ?? null,
      capabilities: Array.isArray(current.capabilities) ? current.capabilities : (model.capabilities || []),
      auth_type: connection.auth_type || current.auth_type || "API_KEY",
      endpoint_mode: connection.endpoint_mode || current.endpoint_mode || "AUTO",
      manual_base_url: connection.endpoint_mode === "MANUAL" ? (connection.base_url || current.manual_base_url || null) : null,
      connection_type: connection.connection_type || current.connection_type || null,
      notes: current.notes || "",
      input_cost_per_million_tokens: current.input_cost_per_million_tokens ?? null,
      output_cost_per_million_tokens: current.output_cost_per_million_tokens ?? null,
      currency: current.currency || null,
      ...projectRegistryCosts(costs, current),
      rpm: quota.rpm ?? current.rpm ?? null,
      tpm: quota.tpm ?? current.tpm ?? null,
      rpd: quota.daily_quota ?? current.rpd ?? null,
      free_quota: current.free_quota ?? null,
      monthly_budget_limit: Object.hasOwn(quota, "monthly_quota") ? quota.monthly_quota : current.monthly_budget_limit ?? null,
      billing_mode: current.billing_mode || "UNMANAGED",
      warning_threshold_percent: current.warning_threshold_percent ?? null,
      endpoint_details: "",
      connection_test_status: current.connection_test_status === "TEST_SUCCESS" ? "TEST_SUCCESS" : "UNTESTED",
      discovery_source: current.discovery_source || "UNKNOWN",
    };
    const saved = await saveAiModelConfiguration(payload, { enable: current.enabled === true });
    const rowPage = await this.list({ page: 1, pageSize: 100 });
    const item = rowPage.items.find((row) => row.id === id) || operationRow({ ...saved.model, model_registry_id: id, enabled: current.enabled === true });
    return { item, source: "AI_STAGING_API", dbReadback: saved.dbReadback };
  },
  async testConnection(modelOrConfig) {
    const config = modelOrConfig?.connection ? modelOrConfig : await request(`${CONFIG}/${encodeURIComponent(modelOrConfig.id)}`);
    const connection = config.connection || {};
    const result = await request(CONNECTION_TEST, {
      method: "POST",
      body: JSON.stringify({
        provider_id: config.provider_id || connection.access_provider_id,
        model_id: config.model?.model_id || config.model_id,
        model_vendor: config.model?.model_vendor || config.model_vendor,
        model_identity_type: config.model?.model_identity_type || config.model_identity_type || "OFFICIAL",
        ...(typeof connection.secret_ref === "string" && connection.secret_ref.startsWith("secret://") ? { secret_ref: connection.secret_ref } : {}),
        endpoint_mode: connection.endpoint_mode || config.endpoint_mode || "AUTO",
        ...(connection.endpoint_mode === "MANUAL" && (connection.base_url || config.manual_base_url) ? { manual_base_url: connection.base_url || config.manual_base_url } : {}),
        connection_type: connection.connection_type || config.connection_type,
        auth_type: connection.auth_type || config.auth_type || "API_KEY",
      }),
    });
    const health = normalizeModelConnectionHealthResponse(result);
    return { ...result, state: health.status === "READY" ? "SUCCESS" : "ERROR", health: health.status, message: health.message, source: "AI_STAGING_API" };
  },
  async archive(id, item) {
    const result = await request(`${ROOT}/${encodeURIComponent(id)}`, { method: "DELETE", body: JSON.stringify({ confirm: true, reason: "E2E_TEST Model & Quota archive acceptance" }) });
    if (result?.archived === true) confirmedArchives.set(id, { ...(item || {}), id, archivedAt: result.archived_at, source: "SERVER_ARCHIVE_CONFIRMATION" });
    return { ...result, source: "AI_STAGING_API" };
  },
  async listArchived() {
    return { items: [...confirmedArchives.values()].map((item) => ({ ...item })), total: confirmedArchives.size, source: "CURRENT_SESSION_SERVER_ARCHIVE_CONFIRMATIONS", historyAvailable: false };
  },
  async restore(id) {
    const result = await request(`${ROOT}/${encodeURIComponent(id)}/restore`, { method: "POST" });
    if (result) confirmedArchives.delete(id);
    return { item: operationRow(result), source: "AI_STAGING_API" };
  },
};

export function createAiModelOperationsReadTransport(fetcher = fetch) {
  return {
    async get(endpoint, options = {}) {
      return request(withQuery(endpoint, options.query), { method: "GET" }, fetcher);
    },
  };
}
