export const ROUTE_ADVICE_RISKS = Object.freeze(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]);

const textOrNull = (value) => typeof value === "string" && value.trim() ? value.trim() : null;
const numberOrNull = (value) => typeof value === "number" && Number.isFinite(value) ? value : null;
const objectOrEmpty = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const firstValue = (...values) => values.find((value) => value !== undefined && value !== null && value !== "");

function projectRouteValues(value, fallback = {}) {
  const config = objectOrEmpty(value);
  return {
    provider: textOrNull(firstValue(config.provider_name, config.provider, config.provider_id, fallback.provider_id)),
    model: textOrNull(firstValue(config.model_name, config.model, config.model_id, fallback.model_id)),
    worker: textOrNull(firstValue(config.worker_name, config.worker, config.worker_id, fallback.worker_id)),
    runtime: textOrNull(firstValue(config.runtime_name, config.runtime, config.runtime_id, fallback.runtime_id)),
    task: textOrNull(firstValue(config.task_name, config.task, config.task_id, fallback.task_id)),
    usageStrategy: textOrNull(firstValue(config.usage_strategy, config.strategy)),
    rpm: numberOrNull(firstValue(config.rpm, config.rpm_limit)),
    tpm: numberOrNull(firstValue(config.tpm, config.tpm_limit)),
    rpd: numberOrNull(firstValue(config.rpd, config.rpd_limit)),
  };
}

export function projectRouteAdviceList(rows) {
  if (!Array.isArray(rows)) throw Object.assign(new Error("Route advice list must be an array."), { code: "AI_ROUTE_ADVICE_BAD_LIST" });
  const items = rows.map((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw Object.assign(new Error(`Route advice row ${index} is invalid.`), { code: "AI_ROUTE_ADVICE_BAD_ROW" });
    const identity = objectOrEmpty(row.target);
    const fallback = {
      provider_id: textOrNull(row.provider_id ?? identity.provider_id),
      model_id: textOrNull(row.model_id ?? identity.model_id),
      worker_id: textOrNull(row.worker_id ?? identity.worker_id),
      runtime_id: textOrNull(row.runtime_id ?? identity.runtime_id),
      task_id: textOrNull(row.task_id ?? identity.task_id),
    };
    return {
      id: textOrNull(row.recommendation_id ?? row.id) || `unknown-${index + 1}`,
      title: textOrNull(row.problem_summary ?? row.title) || "未命名建议",
      category: textOrNull(row.category),
      scope: textOrNull(row.scope),
      risk: ROUTE_ADVICE_RISKS.includes(row.risk ?? row.risk_level) ? (row.risk ?? row.risk_level) : "UNKNOWN",
      current: projectRouteValues(row.current_config ?? row.current, fallback),
      recommended: projectRouteValues(row.suggested_config ?? row.recommended),
      reason: textOrNull(row.problem_summary ?? row.reason),
      confidence: numberOrNull(row.confidence),
      eligible: typeof row.eligible === "boolean" ? row.eligible : null,
      connectionTestRequired: typeof row.connection_test_required === "boolean" ? row.connection_test_required : null,
      requiredCapability: textOrNull(row.required_capability),
      source: "LOCAL_SYNTHETIC_FIXTURE",
    };
  });
  return {
    source: "LOCAL_SYNTHETIC_FIXTURE",
    productionVerified: false,
    items,
    counts: Object.fromEntries(ROUTE_ADVICE_RISKS.map((risk) => [risk, items.filter((item) => item.risk === risk).length])),
  };
}
