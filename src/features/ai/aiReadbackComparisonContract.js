const SENSITIVE_KEY = /(?:api[_-]?key|token|secret|password|authorization|cookie|credential[_-]?(?:value|ref)?)/i;
const SAFE_CREDENTIAL_KEYS = new Set(["credentialConfigured", "credential_configured", "credentialStatus", "credential_status"]);

export const AI_READBACK_STATES = Object.freeze(["MATCH", "MISMATCH", "PARTIAL", "NOT_AVAILABLE"]);

export const AI_READBACK_FIELD_MATRIX = Object.freeze([
  Object.freeze({ field: "providerId", ui: ["accessProvider", "form.providerId"], api: ["provider_id", "connection.access_provider_id"], db: ["provider_id"] }),
  Object.freeze({ field: "modelId", ui: ["form.modelId", "modelId"], api: ["model.model_id", "model_id"], db: ["model_id"] }),
  Object.freeze({ field: "displayName", ui: ["form.displayName", "displayName"], api: ["model.display_name", "display_name"], db: ["display_name"] }),
  Object.freeze({ field: "modelVendor", ui: ["form.modelVendor", "modelVendor"], api: ["model.model_vendor", "model_vendor"], db: ["model_vendor"] }),
  Object.freeze({ field: "identityType", ui: ["form.modelIdentityType", "identityType"], api: ["model.model_identity_type", "model_identity_type"], db: ["model_identity_type"] }),
  Object.freeze({ field: "enabled", ui: ["enabled", "savedRecord.enabled"], api: ["enabled"], db: ["enabled"] }),
  Object.freeze({ field: "connectionType", ui: ["advancedConnection.connectionType", "form.connectionType"], api: ["connection.connection_type", "connection_type"], db: ["connection_type"] }),
  Object.freeze({ field: "authType", ui: ["advancedConnection.authType", "form.authType"], api: ["connection.auth_type", "auth_type"], db: ["auth_type"] }),
  Object.freeze({ field: "deploymentType", ui: ["advancedConnection.deploymentType", "form.deploymentType"], api: ["connection.deployment_type", "deployment_type"], db: ["deployment_type"] }),
  Object.freeze({ field: "region", ui: ["advancedConnection.region", "form.region"], api: ["connection.region", "region"], db: ["region"] }),
  Object.freeze({ field: "rpm", ui: ["quota.rpm", "form.rpm"], api: ["quota_settings.rpm", "rpm"], db: ["rpm"] }),
  Object.freeze({ field: "tpm", ui: ["quota.tpm", "form.tpm"], api: ["quota_settings.tpm", "tpm"], db: ["tpm"] }),
  Object.freeze({ field: "rpd", ui: ["quota.rpd", "quota.dailyQuota", "form.rpd"], api: ["quota_settings.rpd", "quota_settings.daily_quota", "rpd"], db: ["rpd", "daily_quota"] }),
  Object.freeze({ field: "monthlyQuota", ui: ["quota.monthlyQuota"], api: ["quota_settings.monthly_quota"], db: ["monthly_quota"] }),
  Object.freeze({ field: "monthlyBudget", ui: ["quota.monthlyBudget", "form.monthlyBudget"], api: ["quota_settings.monthly_budget", "monthly_budget"], db: ["monthly_budget"] }),
  Object.freeze({ field: "monthlyCostLimit", ui: ["quota.monthlyCostLimit"], api: ["quota_settings.monthly_cost_limit", "monthly_cost_limit"], db: ["monthly_cost_limit"] }),
  Object.freeze({ field: "freeQuota", ui: ["quota.freeQuota", "form.freeQuota"], api: ["quota_settings.free_quota", "free_quota"], db: ["free_quota"] }),
  Object.freeze({ field: "warningThreshold", ui: ["quota.warningThreshold", "form.warningThreshold"], api: ["quota_settings.warning_threshold_percent", "warning_threshold_percent"], db: ["warning_threshold_percent"] }),
  Object.freeze({ field: "inputCost", ui: ["costs.INPUT_TOKEN", "form.inputRate"], api: ["cost_registry.INPUT_TOKEN", "input_cost"], db: ["input_cost"] }),
  Object.freeze({ field: "outputCost", ui: ["costs.OUTPUT_TOKEN", "form.outputRate"], api: ["cost_registry.OUTPUT_TOKEN", "output_cost"], db: ["output_cost"] }),
  Object.freeze({ field: "currency", ui: ["costs.currency", "form.currency"], api: ["currency", "cost_registry.currency"], db: ["currency"] }),
  Object.freeze({ field: "capabilities", ui: ["form.capabilities", "capabilities"], api: ["model.capabilities", "capabilities"], db: ["capabilities"] }),
  Object.freeze({ field: "priority", ui: ["routing.priority"], api: ["routing_strategy.route_priority"], db: ["route_priority"] }),
  Object.freeze({ field: "weight", ui: ["routing.weight"], api: ["routing_strategy.route_weight"], db: ["route_weight"] }),
  Object.freeze({ field: "fallbackModelId", ui: ["routing.fallbackModelId"], api: ["routing_strategy.fallback_model_id"], db: ["fallback_model_id"] }),
  Object.freeze({ field: "strategy", ui: ["routing.costStrategy"], api: ["routing_strategy.cost_strategy"], db: ["cost_strategy"] }),
  Object.freeze({ field: "threshold", ui: ["routing.healthThreshold"], api: ["routing_strategy.health_threshold"], db: ["health_threshold"] }),
  Object.freeze({ field: "autoRouting", ui: ["routing.autoRouting"], api: ["routing_strategy.auto_routing"], db: ["auto_routing"] }),
]);

const NUMERIC_FIELDS = new Set(["rpm", "tpm", "rpd", "monthlyQuota", "monthlyBudget", "monthlyCostLimit", "freeQuota", "warningThreshold", "inputCost", "outputCost", "priority", "weight", "threshold"]);
const BOOLEAN_FIELDS = new Set(["enabled", "autoRouting"]);
const UPPERCASE_FIELDS = new Set(["modelVendor", "identityType", "connectionType", "authType", "deploymentType", "region", "currency", "strategy"]);

const readPath = (value, path) => {
  let current = value;
  for (const key of path.split(".")) {
    if (!current || typeof current !== "object" || !Object.hasOwn(current, key)) return { found: false, value: undefined };
    current = current[key];
  }
  return current === undefined ? { found: false, value: undefined } : { found: true, value: current };
};

const firstPath = (value, paths) => {
  for (const path of paths) {
    const candidate = readPath(value, path);
    if (candidate.found) return candidate;
  }
  return { found: false, value: undefined };
};

function normalizeField(field, value) {
  if (value === null) return null;
  if (NUMERIC_FIELDS.has(field)) {
    if (value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  if (BOOLEAN_FIELDS.has(field)) return typeof value === "boolean" ? value : null;
  if (field === "capabilities") {
    if (!Array.isArray(value)) return null;
    return [...new Set(value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean))].sort();
  }
  const text = String(value).trim();
  return UPPERCASE_FIELDS.has(field) ? text.toUpperCase() : text;
}

const equivalent = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export function projectAiReadbackSnapshot(source, value) {
  if (!value || typeof value !== "object") return Object.freeze({ available: false, source, fields: Object.freeze({}) });
  const key = String(source || "").toLowerCase();
  if (!new Set(["ui", "api", "db"]).has(key)) throw new TypeError("Readback source must be ui, api or db.");
  const fields = {};
  for (const definition of AI_READBACK_FIELD_MATRIX) {
    const candidate = firstPath(value, definition[key]);
    if (candidate.found) fields[definition.field] = normalizeField(definition.field, candidate.value);
  }
  return Object.freeze({ available: true, source: key.toUpperCase(), fields: Object.freeze(fields) });
}

function sanitizeUrl(value) {
  if (!/^https?:\/\//i.test(value)) return value;
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    for (const key of [...url.searchParams.keys()]) if (SENSITIVE_KEY.test(key)) url.searchParams.delete(key);
    return url.toString();
  } catch {
    return "[REDACTED_URL]";
  }
}

export function redactAiReadbackEvidence(value) {
  if (Array.isArray(value)) return value.map(redactAiReadbackEvidence);
  if (!value || typeof value !== "object") return typeof value === "string" ? sanitizeUrl(value) : value;
  const output = {};
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key) && !SAFE_CREDENTIAL_KEYS.has(key)) continue;
    output[key] = redactAiReadbackEvidence(child);
  }
  return output;
}

export function compareAiModelReadback({ ui, api, db, fields } = {}) {
  const snapshots = {
    ui: projectAiReadbackSnapshot("ui", ui),
    api: projectAiReadbackSnapshot("api", api),
    db: projectAiReadbackSnapshot("db", db),
  };
  const requestedFields = fields == null
    ? AI_READBACK_FIELD_MATRIX.map((item) => item.field)
    : [...new Set(fields.filter((field) => AI_READBACK_FIELD_MATRIX.some((item) => item.field === field)))];
  const comparisons = requestedFields.map((field) => {
    const values = Object.fromEntries(Object.entries(snapshots)
      .filter(([, snapshot]) => snapshot.available && Object.hasOwn(snapshot.fields, field))
      .map(([source, snapshot]) => [source, snapshot.fields[field]]));
    const available = Object.keys(values);
    let state = "NOT_AVAILABLE";
    if (available.length >= 2) {
      const [first, ...rest] = Object.values(values);
      state = rest.every((value) => equivalent(first, value)) ? (available.length === 3 ? "MATCH" : "PARTIAL") : "MISMATCH";
    }
    return Object.freeze({ field, state, sources: Object.freeze(available), values: Object.freeze(values) });
  });
  let state;
  if (!snapshots.db.available) state = "NOT_AVAILABLE";
  else if (comparisons.some((item) => item.state === "MISMATCH")) state = "MISMATCH";
  else if (comparisons.length > 0 && comparisons.every((item) => item.state === "MATCH")) state = "MATCH";
  else if (comparisons.some((item) => item.state === "MATCH" || item.state === "PARTIAL")) state = "PARTIAL";
  else state = "NOT_AVAILABLE";
  return Object.freeze({
    state,
    sourceAvailability: Object.freeze(Object.fromEntries(Object.entries(snapshots).map(([source, snapshot]) => [source, snapshot.available]))),
    fields: Object.freeze(comparisons),
    sensitiveFieldsRemoved: true,
  });
}
