import { ROUTING_POLICY_CANDIDATES, SCENARIO_CANDIDATES } from "./modelCapabilityCatalog.js";

export const MODEL_COST_DIMENSION_IDS = Object.freeze([
  "INPUT_TOKEN", "OUTPUT_TOKEN", "REQUEST", "IMAGE", "VIDEO_SECOND", "AUDIO_SECOND", "GPU_SECOND", "GPU_MINUTE", "JOB",
]);

const numericOrUnknown = (value) => {
  if (value === "" || value == null) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new TypeError("Quota and cost values must be non-negative numbers or unknown.");
  return number;
};

export function buildModelStepThreePayload({ quota = {}, costs = {}, routing = {}, capabilitySources = {} } = {}) {
  const priority = Number(routing.priority ?? 1);
  const weight = Number(routing.weight ?? 100);
  const triggerCondition = routing.triggerCondition ?? "HEALTH_OR_LIMIT";
  const healthThreshold = Number(routing.healthThreshold ?? 80);
  if (!Number.isInteger(priority) || priority < 1) throw new TypeError("Route priority must be a positive integer.");
  if (!Number.isFinite(weight) || weight < 0 || weight > 100) throw new TypeError("Route weight must be between 0 and 100.");
  if (!["HEALTH_OR_LIMIT", "HEALTH_ONLY", "MANUAL_ONLY"].includes(triggerCondition)) throw new TypeError("Route trigger condition must be registered.");
  if (!Number.isFinite(healthThreshold) || healthThreshold < 50 || healthThreshold > 100) throw new TypeError("Route health threshold must be between 50 and 100.");
  if (routing.autoRouting != null && typeof routing.autoRouting !== "boolean") throw new TypeError("Automatic routing must be a boolean.");
  const scenarioBinding = routing.scenarioBinding ?? ["GENERAL"];
  if (!Array.isArray(scenarioBinding) || scenarioBinding.some((item) => !SCENARIO_CANDIDATES.includes(item)) || new Set(scenarioBinding).size !== scenarioBinding.length) throw new TypeError("Scenario binding must use unique registered scenarios.");
  const costStrategy = routing.costStrategy ?? "BALANCED";
  if (!ROUTING_POLICY_CANDIDATES.includes(costStrategy)) throw new TypeError("Cost strategy must use a registered routing strategy.");
  return {
    quota_settings: {
      rpm: numericOrUnknown(quota.rpm),
      tpm: numericOrUnknown(quota.tpm),
      max_concurrency: numericOrUnknown(quota.maxConcurrency),
      daily_quota: numericOrUnknown(quota.dailyQuota),
      monthly_quota: numericOrUnknown(quota.monthlyQuota),
    },
    cost_registry: Object.fromEntries(MODEL_COST_DIMENSION_IDS.map((id) => [id, numericOrUnknown(costs[id])])),
    routing_strategy: {
      route_priority: priority,
      route_weight: weight,
      fallback_model_id: String(routing.fallbackModelId || "").trim() || null,
      health_check_enabled: routing.healthCheck !== false,
      trigger_condition: triggerCondition,
      health_threshold: healthThreshold,
      auto_routing: routing.autoRouting !== false,
      scenario_binding: [...scenarioBinding],
      cost_strategy: costStrategy,
    },
    capability_sources: { ...capabilitySources },
  };
}
