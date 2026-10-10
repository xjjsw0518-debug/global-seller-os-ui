// UI-only grouping; all keys remain the existing draft fields.
export const PROFILE_PRIMARY_FIELDS = Object.freeze([
  "deploymentType",
  "scenarioSupport",
  "inputModalities",
  "outputModalities",
  "routingPolicy",
  "priority",
]);

export const PROFILE_ADVANCED_FIELDS = Object.freeze([
  "providerModelId",
  "runtimeId",
  "runtimeEndpoint",
  "runtimeHealthReason",
  "supportedLanguages",
  "qualityTier",
  "enabled",
  "fallbackModelId",
  "modelVersion",
  "commercialUseStatus",
  "licenseId",
  "licenseUrl",
  "commercialUseEvidenceUrl",
  "costUnit",
  "commercialCostStatus",
  "costPerUnit",
  "costCurrency",
  "commercialCostEvidenceUrl",
]);

export const PRIMARY_BUDGET_FIELD = "monthlyBudget";
