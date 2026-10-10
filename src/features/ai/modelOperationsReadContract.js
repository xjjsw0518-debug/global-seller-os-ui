export const AI_MODEL_OPERATIONS_ENDPOINT = "/api/v1/ai-model-operations";
export const AI_MODEL_OPERATIONS_PAGE_SIZE = 20;

const contractError = (message, code = "AI_MODEL_OPERATIONS_BAD_RESPONSE") => {
  const error = new Error(message);
  error.code = code;
  return error;
};

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);
const finiteOrNull = (value) => isFiniteNumber(value) ? value : null;

const requireValue = (record, key, predicate, label = key) => {
  if (!Object.hasOwn(record, key) || !predicate(record[key])) {
    throw contractError(`Invalid AI model operations response: ${label} is missing or invalid.`);
  }
  return record[key];
};

function mapOperation(item, index) {
  if (!isRecord(item)) throw contractError(`Invalid AI model operations response: items[${index}] must be an object.`);
  const id = requireValue(item, "model_registry_id", (value) => typeof value === "string" && value.length > 0, `items[${index}].model_registry_id`);
  const providerId = requireValue(item, "provider_id", (value) => typeof value === "string" && value.length > 0, `items[${index}].provider_id`);
  const model = requireValue(item, "model_id", (value) => typeof value === "string" && value.length > 0, `items[${index}].model_id`);
  const displayName = requireValue(item, "display_name", (value) => typeof value === "string" && value.length > 0, `items[${index}].display_name`);
  const provider = requireValue(item, "provider_display_name", (value) => typeof value === "string" && value.length > 0, `items[${index}].provider_display_name`);
  const enabled = requireValue(item, "enabled", (value) => typeof value === "boolean", `items[${index}].enabled`);
  const credentialConfigured = requireValue(item, "credential_configured", (value) => typeof value === "boolean", `items[${index}].credential_configured`);
  const quota = isRecord(item.quota_summary) ? item.quota_summary : {};
  const usage = isRecord(item.usage_summary) ? item.usage_summary : {};
  const cost = isRecord(item.cost_summary) ? item.cost_summary : {};
  const capabilities = Array.isArray(item.capabilities) && item.capabilities.every((value) => typeof value === "string")
    ? [...item.capabilities]
    : [];

  return {
    id,
    providerId,
    model,
    displayName,
    provider,
    enabled,
    credentialConfigured,
    providerLogoAsset: typeof item.provider_logo_asset === "string" ? item.provider_logo_asset : null,
    costLevel: typeof item.cost_level === "string" ? item.cost_level : "UNKNOWN",
    usageStrategy: typeof item.usage_strategy === "string" ? item.usage_strategy : "UNKNOWN",
    capabilities,
    endpointMode: typeof item.endpoint_mode === "string" ? item.endpoint_mode : "UNKNOWN",
    connectionType: typeof item.connection_type === "string" ? item.connection_type : null,
    healthStatus: typeof item.health_status === "string" ? item.health_status : "UNKNOWN",
    healthSource: typeof item.health_source === "string" ? item.health_source : "UNKNOWN",
    healthErrorCode: typeof item.health_error_code === "string" ? item.health_error_code : null,
    healthObservedAt: typeof item.health_observed_at === "string" ? item.health_observed_at : null,
    quotaSummary: {
      status: typeof quota.status === "string" ? quota.status : "UNKNOWN",
      total: finiteOrNull(quota.total),
      used: finiteOrNull(quota.used),
      remaining: finiteOrNull(quota.remaining),
      period: typeof quota.period === "string" ? quota.period : null,
      source: typeof quota.source === "string" ? quota.source : "UNKNOWN",
    },
    usageSummary: {
      requestCount: finiteOrNull(usage.request_count),
      inputTokens: finiteOrNull(usage.input_tokens),
      outputTokens: finiteOrNull(usage.output_tokens),
      totalTokens: finiteOrNull(usage.total_tokens),
      knownCostRequestCount: finiteOrNull(usage.known_cost_request_count),
    },
    costSummary: {
      status: typeof cost.status === "string" ? cost.status : "UNKNOWN",
      amount: finiteOrNull(cost.amount),
      currency: typeof cost.currency === "string" ? cost.currency : null,
      source: typeof cost.source === "string" ? cost.source : "UNKNOWN",
      unknownRequestCount: finiteOrNull(cost.unknown_request_count),
      fxStatus: typeof cost.fx_status === "string" ? cost.fx_status : "UNKNOWN",
    },
    billingMode: typeof item.billing_mode === "string" ? item.billing_mode : "UNMANAGED",
    tokenPackageState: typeof item.token_package_state === "string" ? item.token_package_state : "NOT_APPLICABLE",
    warningThresholdPercent: finiteOrNull(item.warning_threshold_percent),
    lastActivityAt: typeof item.last_activity_at === "string" ? item.last_activity_at : null,
    updatedAt: typeof item.updated_at === "string" ? item.updated_at : null,
    source: "SERVER_READ_PROJECTION",
  };
}

export function mapAiModelOperationPage(dto) {
  if (!isRecord(dto)) throw contractError("Invalid AI model operations response: expected a paginated object.");
  const items = requireValue(dto, "items", Array.isArray);
  const total = requireValue(dto, "total", (value) => Number.isInteger(value) && value >= 0);
  const page = requireValue(dto, "page", (value) => Number.isInteger(value) && value >= 1);
  const pageSize = requireValue(dto, "page_size", (value) => Number.isInteger(value) && value >= AI_MODEL_OPERATIONS_PAGE_SIZE && value <= 100);
  const totalPages = requireValue(dto, "total_pages", (value) => Number.isInteger(value) && value >= 0);
  const summary = isRecord(dto.summary) ? dto.summary : {};
  return {
    items: items.map(mapOperation),
    total,
    page,
    pageSize,
    totalPages,
    summary: {
      enabled: finiteOrNull(summary.enabled),
      healthy: finiteOrNull(summary.healthy),
    },
    source: "SERVER_READ_PROJECTION",
  };
}
