import { CAPABILITY_IDS, COMMERCIAL_COST_STATUSES, COMMERCIAL_USE_STATUSES, CONNECTION_TYPES, COST_UNIT_CANDIDATES, DEPLOYMENT_TYPES, MODALITY_CANDIDATES, ROUTING_POLICY_CANDIDATES, RUNTIME_HEALTH_REASONS, SCENARIO_CANDIDATES, validateCapabilityDraftMetadata } from "./modelCapabilityCatalog.js";

export const capabilityCandidates = CAPABILITY_IDS;

export const providerFixtures = [
  { id: "fixture-openai-0001", name: "OPENAI", displayName: "OpenAI (SYNTHETIC)", providerType: "OPENAI_COMPATIBLE", apiBaseUrl: "https://api.openai.com/v1" },
  { id: "fixture-deepseek-0001", name: "DEEPSEEK", displayName: "DeepSeek (SYNTHETIC)", providerType: "OPENAI_COMPATIBLE", apiBaseUrl: "https://api.deepseek.com" },
  { id: "fixture-doubao-0001", name: "DOUBAO", displayName: "DOUBAO (SYNTHETIC)", providerType: "PROVIDER_NATIVE", apiBaseUrl: "" },
  { id: "fixture-custom-0001", name: "CUSTOM", displayName: "CUSTOM Provider (SYNTHETIC)", providerType: "CUSTOM", apiBaseUrl: "" },
];

export const initialModelDraft = {
  modelVendor: "", modelIdentityType: "OFFICIAL",
  providerName: "", providerDisplayName: "", providerId: "", providerType: "OPENAI_COMPATIBLE", providerStatus: "ACTIVE", providerEnabled: true,
  providerDailyBudget: "0", providerMonthlyBudget: "0", apiBaseUrl: "", defaultBaseUrl: "", modelId: "", displayName: "", endpointMode: "AUTO", manualBaseUrl: "",
  authType: "API_KEY", connectionType: "OPENAI_COMPATIBLE", deploymentType: "UNKNOWN", scenarioSupport: null, inputModalities: null, outputModalities: null, providerModelId: "", runtimeId: null, runtimeEndpoint: null, runtimeHealthReason: "UNKNOWN", supportedLanguages: null, qualityTier: "UNKNOWN", routingPolicy: "UNKNOWN", priority: null, enabled: null, fallbackModelId: "", modelVersion: "", commercialUseStatus: "UNKNOWN", licenseId: "", licenseUrl: "", commercialUseEvidenceUrl: "", costUnit: "UNKNOWN", costPerUnit: "", costCurrency: "", commercialCostStatus: "UNKNOWN", commercialCostEvidenceUrl: "", capabilitySettings: {}, costLevel: "", usageStrategy: "", capabilities: [], inputRate: "", outputRate: "", currency: "",
  pricingStatus: "UNKNOWN", pricingSource: "", billingMode: "UNMANAGED", rpm: "", tpm: "", rpd: "", freeQuota: "", monthlyBudget: "", warningThreshold: "",
  contextWindow: "", endpointDetails: "", secretConfigured: false,
};

const enums = {
  providerName: ["OPENAI", "DEEPSEEK", "DOUBAO", "CUSTOM"],
  providerType: ["OPENAI_COMPATIBLE", "PROVIDER_NATIVE", "OLLAMA", "CUSTOM"],
  providerStatus: ["ACTIVE", "DISABLED", "ERROR", "QUOTA_LIMITED"],
  endpointMode: ["AUTO", "MANUAL"], authType: ["API_KEY", "NONE"],
  connectionType: CONNECTION_TYPES, deploymentType: ["UNKNOWN", ...DEPLOYMENT_TYPES], runtimeHealthReason: RUNTIME_HEALTH_REASONS, routingPolicy: ["UNKNOWN", ...ROUTING_POLICY_CANDIDATES], commercialUseStatus: COMMERCIAL_USE_STATUSES, costUnit: COST_UNIT_CANDIDATES, commercialCostStatus: COMMERCIAL_COST_STATUSES,
  costLevel: ["", "FREE", "LOW", "MEDIUM", "HIGH"], usageStrategy: ["", "PRIORITY", "NORMAL", "BACKUP", "FALLBACK"],
  pricingStatus: ["UNKNOWN", "VERIFIED", "DISABLED"],
  billingMode: ["USAGE_BASED", "PREPAID_BALANCE", "TOKEN_PACKAGE", "ENTERPRISE_CONTRACT", "SELF_HOSTED", "UNMANAGED"],
};

const validUrl = (raw) => {
  if (!raw || raw.length > 512 || /[\u0000-\u001f\u007f]/.test(raw)) return false;
  try { const url = new URL(raw); return ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password; } catch { return false; }
};
const numberError = (value, { max = null, integer = false } = {}) => {
  if (value === "" || value == null) return "";
  const n = Number(value);
  return !Number.isFinite(n) || n < 0 || (integer && !Number.isInteger(n)) || (max != null && n > max) ? "Enter a valid non-negative value within the allowed range." : "";
};

export function validateModelDraft(value) {
  const errors = {};
  const required = (key, label, max) => {
    const v = String(value[key] ?? "").trim();
    if (!v) errors[key] = `${label} is required.`;
    else if (max && v.length > max) errors[key] = `Maximum length: ${max}.`;
  };
  required("providerName", "Provider 标识");
  if (!enums.providerName.includes(value.providerName)) errors.providerName = "Select a supported Provider fixture.";
  required("providerDisplayName", "Provider 显示名", 160);
  required("providerId", "Provider UUID");
  if (!/^fixture-[a-z0-9-]{8,64}$/.test(value.providerId)) errors.providerId = "Use a synthetic Provider UUID from the fixture list.";
  required("modelId", "模型 ID", 120);
  required("displayName", "模型显示名", 160);
  for (const key of Object.keys(enums)) if (!enums[key].includes(value[key])) errors[key] = "Select a supported value.";
  if (value.apiBaseUrl && !validUrl(value.apiBaseUrl.trim())) errors.apiBaseUrl = "Enter an HTTP(S) URL without userinfo (max 512 chars).";
  if (value.defaultBaseUrl && !validUrl(value.defaultBaseUrl.trim())) errors.defaultBaseUrl = "Enter an HTTP(S) URL without userinfo (max 512 chars).";
  if (value.endpointMode === "MANUAL" && !validUrl(value.manualBaseUrl.trim())) errors.manualBaseUrl = "MANUAL requires an HTTP(S) URL.";
  else if (value.manualBaseUrl && !validUrl(value.manualBaseUrl.trim())) errors.manualBaseUrl = "Enter an HTTP(S) URL without userinfo (max 512 chars).";
  if (!Array.isArray(value.capabilities) || value.capabilities.length > 10 || value.capabilities.some((x) => !capabilityCandidates.includes(x))) errors.capabilities = "Select at most 10 registered capabilities.";
  const ranges = { inputRate: {}, outputRate: {}, freeQuota: {}, monthlyBudget: {}, providerDailyBudget: {}, providerMonthlyBudget: {}, rpm: { max: 10000000, integer: true }, tpm: { max: 1000000000, integer: true }, rpd: { max: 10000000, integer: true }, warningThreshold: { max: 100, integer: true }, costPerUnit: {} };
  for (const [key, range] of Object.entries(ranges)) { const error = numberError(value[key], range); if (error) errors[key] = error; }
  if (value.currency && (value.currency.length < 3 || value.currency.length > 16)) errors.currency = "Currency length must be 3 to 16 characters.";
  if (value.costCurrency != null && value.costCurrency !== "" && (typeof value.costCurrency !== "string" || value.costCurrency.length < 3 || value.costCurrency.length > 16)) errors.costCurrency = "Currency length must be 3 to 16 characters.";
  if (value.pricingStatus === "VERIFIED" && (value.inputRate === "" || value.outputRate === "" || !value.currency.trim() || !value.pricingSource.trim())) errors.pricingStatus = "VERIFIED requires both rates, currency, and a source.";
  Object.assign(errors, validateCapabilityDraftMetadata(value).errors);
  for (const [key, max] of [["providerModelId", 128], ["runtimeId", 128], ["qualityTier", 64], ["fallbackModelId", 120], ["modelVersion", 120], ["licenseId", 256], ["runtimeEndpoint", 512], ["licenseUrl", 512], ["commercialUseEvidenceUrl", 512], ["commercialCostEvidenceUrl", 512]]) {
    const item = value[key]; if (item != null && item !== "" && (typeof item !== "string" || item.trim().length > max)) errors[key] = "Maximum length: " + max + " characters.";
  }
  for (const key of ["runtimeEndpoint", "licenseUrl", "commercialUseEvidenceUrl", "commercialCostEvidenceUrl"]) if (typeof value[key] === "string" && value[key] && !validUrl(value[key].trim())) errors[key] = "Enter an HTTP(S) URL without userinfo (max 512 characters).";
  if (value.priority != null && (!Number.isInteger(value.priority) || value.priority < 0 || value.priority > 10000000)) errors.priority = "Priority must be an integer from 0 to 10000000 or unknown.";
  if (value.commercialUseStatus === "CONFIRMED_ALLOWED" && (typeof value.licenseId !== "string" || !value.licenseId.trim() || typeof value.licenseUrl !== "string" || !validUrl(value.licenseUrl.trim()) || typeof value.commercialUseEvidenceUrl !== "string" || !validUrl(value.commercialUseEvidenceUrl.trim()))) errors.commercialUseStatus = "A confirmed commercial-use status requires a license identifier and verifiable evidence URL.";
  const costAmountKnown = value.costPerUnit !== "" && value.costPerUnit != null && Number.isFinite(Number(value.costPerUnit));
  const costEvidenceValid = typeof value.commercialCostEvidenceUrl === "string" && validUrl(value.commercialCostEvidenceUrl.trim());
  if (["ESTIMATED", "VERIFIED", "CONFIRMED_FREE"].includes(value.commercialCostStatus) && (value.costUnit === "UNKNOWN" || !costAmountKnown || !costEvidenceValid)) errors.commercialCostStatus = "A stated cost status requires a known unit, explicit amount, and evidence URL.";
  if (["ESTIMATED", "VERIFIED"].includes(value.commercialCostStatus) && (typeof value.costCurrency !== "string" || !value.costCurrency.trim())) errors.commercialCostStatus = "Estimated and verified costs require a currency.";
  if (value.commercialCostStatus === "CONFIRMED_FREE" && Number(value.costPerUnit) !== 0) errors.commercialCostStatus = "Confirmed free must explicitly specify a zero amount for the stated unit.";
  if (value.commercialCostStatus === "UNKNOWN" && costAmountKnown) errors.commercialCostStatus = "Unknown costs must remain null/blank, not numeric zero or another amount.";
  if (value.enabled != null && typeof value.enabled !== "boolean") errors.enabled = "Enabled state must be true, false, or unknown.";
  if (value.endpointDetails.length > 2000) errors.endpointDetails = "Maximum length: 2000 characters.";
  if (value.contextWindow !== "") errors.contextWindow = "Not a candidate configuration field; keep unknown/blank. This is not input_context.";
  return { valid: Object.keys(errors).length === 0, errors };
}

export function buildModelDraftPayload(value) {
  const endpointMode = value.endpointMode;
  return {
    provider_id: value.providerId,
    provider: { provider_name: value.providerName, provider_display_name: value.providerDisplayName.trim(), provider_type: value.providerType, provider_status: value.providerStatus, enabled: value.providerEnabled, api_base_url: value.apiBaseUrl.trim(), ...(value.defaultBaseUrl.trim() ? { default_base_url: value.defaultBaseUrl.trim() } : {}), daily_budget: Number(value.providerDailyBudget || 0), monthly_budget: Number(value.providerMonthlyBudget || 0) },
    model: {
      model_id: value.modelId.trim(), model_name: value.modelId.trim(), display_name: value.displayName.trim(), model_vendor: value.modelVendor || null, model_identity_type: value.modelIdentityType || "OFFICIAL", endpoint_mode: endpointMode,
      ...(endpointMode === "MANUAL" ? { manual_base_url: value.manualBaseUrl.trim() } : {}), auth_type: value.authType, connection_type: value.connectionType,
      cost_level: value.costLevel || null, usage_strategy: value.usageStrategy || null, capabilities: [...value.capabilities],
      billing_mode: value.billingMode, rpm: value.rpm === "" ? null : Number(value.rpm), tpm: value.tpm === "" ? null : Number(value.tpm), rpd: value.rpd === "" ? null : Number(value.rpd),
      free_quota: value.freeQuota === "" ? null : Number(value.freeQuota), monthly_budget_limit: Number(value.monthlyBudget || 0), warning_threshold_percent: value.warningThreshold === "" ? null : Number(value.warningThreshold), endpoint_details: value.endpointDetails.trim(),
      ...buildOptionalCapabilityPayload(value),
    },
    metadata: { context_window_status: value.contextWindow ? "UNMAPPED_LOCAL_ONLY" : "UNKNOWN", secret_configured_mock: Boolean(value.secretConfigured), configuration_status: "DRAFT", connection_test_status: "UNTESTED" },
  };
}

const capabilityPayloadMap = Object.freeze({
  providerModelId: "provider_model_id", deploymentType: "deployment_type", scenarioSupport: "scenario_support",
  inputModalities: "input_modalities", outputModalities: "output_modalities", runtimeId: "runtime_id",
  runtimeEndpoint: "runtime_endpoint", runtimeHealthReason: "runtime_health_reason", supportedLanguages: "supported_languages",
  qualityTier: "quality_tier", routingPolicy: "routing_policy", priority: "priority", enabled: "enabled",
  fallbackModelId: "fallback_model_id", modelVersion: "model_version", commercialUseStatus: "commercial_use_status",
  licenseId: "license_id", licenseUrl: "license_url", commercialUseEvidenceUrl: "commercial_use_evidence_url", costUnit: "cost_unit", commercialCostStatus: "cost_status", commercialCostEvidenceUrl: "cost_evidence_url", costPerUnit: "cost_per_unit", costCurrency: "cost_currency",
  capabilitySettings: "capability_settings",
});
export function buildOptionalCapabilityPayload(value) {
  const payload = {};
  for (const [key, wireKey] of Object.entries(capabilityPayloadMap)) {
    const item = value[key];
    if (item == null || item === "" || item === "UNKNOWN") continue;
    if (key === "capabilitySettings" && Object.keys(item || {}).length === 0) continue;
    payload[wireKey] = Array.isArray(item) ? [...item] : item;
  }
  return payload;
}

// Pricing is deliberately a separate candidate operation from model drafts.
export function buildModelPricingPayload(value) {
  if (value.pricingStatus === "VERIFIED") return { status: value.pricingStatus, input_cost_per_million_tokens: Number(value.inputRate), output_cost_per_million_tokens: Number(value.outputRate), currency: value.currency.trim(), pricing_source: value.pricingSource.trim() };
  return { status: value.pricingStatus, input_cost_per_million_tokens: null, output_cost_per_million_tokens: null, currency: null };
}
