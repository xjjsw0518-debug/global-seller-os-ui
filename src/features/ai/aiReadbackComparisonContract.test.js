import test from "node:test";
import assert from "node:assert/strict";
import {
  AI_READBACK_FIELD_MATRIX,
  compareAiModelReadback,
  projectAiReadbackSnapshot,
  redactAiReadbackEvidence,
} from "./aiReadbackComparisonContract.js";

const ui = () => ({
  accessProvider: "provider-1",
  form: { modelId: "model-1", displayName: "Model One", modelVendor: "openai", modelIdentityType: "OFFICIAL", capabilities: ["TOOL_CALLING", "TEXT_GENERATION"] },
  enabled: false,
  advancedConnection: { connectionType: "openai_compatible", authType: "api_key", deploymentType: "public_cloud", region: "apac" },
  quota: { rpm: "60", tpm: "1000", monthlyQuota: "0" },
  costs: { INPUT_TOKEN: "0.002", OUTPUT_TOKEN: "0", currency: "usd" },
  routing: { priority: "1", weight: 100, fallbackModelId: "", costStrategy: "balanced", healthThreshold: 80, autoRouting: false },
});

const api = () => ({
  provider_id: "provider-1",
  model: { model_id: "model-1", display_name: "Model One", model_vendor: "OPENAI", model_identity_type: "OFFICIAL", capabilities: ["TEXT_GENERATION", "TOOL_CALLING"] },
  enabled: false,
  connection: { connection_type: "OPENAI_COMPATIBLE", auth_type: "API_KEY", deployment_type: "PUBLIC_CLOUD", region: "APAC" },
  quota_settings: { rpm: 60, tpm: 1000, monthly_quota: 0 },
  cost_registry: { INPUT_TOKEN: 0.002, OUTPUT_TOKEN: 0 },
  currency: "USD",
  routing_strategy: { route_priority: 1, route_weight: 100, fallback_model_id: "", cost_strategy: "BALANCED", health_threshold: 80, auto_routing: false },
});

const db = () => ({
  provider_id: "provider-1", model_id: "model-1", display_name: "Model One", model_vendor: "OPENAI", model_identity_type: "OFFICIAL", enabled: false,
  connection_type: "OPENAI_COMPATIBLE", auth_type: "API_KEY", deployment_type: "PUBLIC_CLOUD", region: "APAC",
  rpm: 60, tpm: 1000, monthly_quota: 0, input_cost: 0.002, output_cost: 0, currency: "USD",
  capabilities: ["TEXT_GENERATION", "TOOL_CALLING"], route_priority: 1, route_weight: 100, fallback_model_id: "", cost_strategy: "BALANCED", health_threshold: 80, auto_routing: false,
});

const coreFields = ["providerId", "modelId", "displayName", "modelVendor", "identityType", "enabled", "connectionType", "authType", "deploymentType", "region", "rpm", "tpm", "monthlyQuota", "inputCost", "outputCost", "currency", "capabilities", "priority", "weight", "fallbackModelId", "strategy", "threshold", "autoRouting"];

test("AI-C12 reports MATCH only for complete equal UI, API and DB evidence", () => {
  const result = compareAiModelReadback({ ui: ui(), api: api(), db: db(), fields: coreFields });
  assert.equal(result.state, "MATCH");
  assert.ok(result.fields.every((item) => item.state === "MATCH"));
  assert.equal(result.sensitiveFieldsRemoved, true);
});

test("AI-C12 distinguishes MISMATCH, PARTIAL and NOT_AVAILABLE", () => {
  const mismatchDb = db();
  mismatchDb.enabled = true;
  assert.equal(compareAiModelReadback({ ui: ui(), api: api(), db: mismatchDb, fields: ["enabled"] }).state, "MISMATCH");

  const partialApi = api();
  delete partialApi.currency;
  assert.equal(compareAiModelReadback({ ui: ui(), api: partialApi, db: db(), fields: ["currency"] }).state, "PARTIAL");

  assert.equal(compareAiModelReadback({ ui: ui(), api: api(), db: null, fields: ["modelId"] }).state, "NOT_AVAILABLE");
});

test("AI-C12 keeps null distinct from zero and normalizes unordered capability sets", () => {
  const zero = compareAiModelReadback({ ui: { quota: { monthlyQuota: "0" } }, api: { quota_settings: { monthly_quota: 0 } }, db: { monthly_quota: null }, fields: ["monthlyQuota"] });
  assert.equal(zero.state, "MISMATCH");
  const projected = projectAiReadbackSnapshot("ui", ui());
  assert.deepEqual(projected.fields.capabilities, ["TEXT_GENERATION", "TOOL_CALLING"]);
});

test("AI-C12 removes credentials and sanitizes sensitive URL parts", () => {
  const sanitized = redactAiReadbackEvidence({
    apiKey: "must-disappear",
    secret_ref: "secret://must-disappear",
    credentialConfigured: true,
    endpoint: "https://user:password@example.test/v1?token=must-disappear&region=apac",
    nested: { Authorization: "must-disappear", status: "READY" },
  });
  assert.equal(JSON.stringify(sanitized).includes("must-disappear"), false);
  assert.equal(sanitized.credentialConfigured, true);
  assert.equal(sanitized.endpoint, "https://example.test/v1?region=apac");
  assert.deepEqual(sanitized.nested, { status: "READY" });
});

test("AI-C12 publishes a stable field mapping without credential fields", () => {
  assert.ok(AI_READBACK_FIELD_MATRIX.some((item) => item.field === "providerId"));
  assert.ok(AI_READBACK_FIELD_MATRIX.some((item) => item.field === "monthlyCostLimit"));
  assert.equal(AI_READBACK_FIELD_MATRIX.some((item) => /secret|token|password|authorization/i.test(item.field)), false);
});
