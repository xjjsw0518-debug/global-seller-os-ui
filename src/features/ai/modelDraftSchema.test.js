import test from "node:test";
import assert from "node:assert/strict";
import { buildModelDraftPayload, buildModelPricingPayload, initialModelDraft, validateModelDraft } from "./modelDraftSchema.js";

const valid = () => ({ ...initialModelDraft, providerName: "OPENAI", providerDisplayName: "OpenAI (合成演示)", providerId: "fixture-openai-0001", apiBaseUrl: "https://api.openai.com/v1", modelId: "gpt-4o", displayName: "GPT-4o", connectionType: "OPENAI_COMPATIBLE" });
const check = (value) => validateModelDraft(value);

test("complete minimum draft accepts default UNKNOWN pricing and preserves unknown quotas", () => {
  const value = valid(); const result = check(value); assert.equal(result.valid, true, JSON.stringify(result.errors));
  const payload = buildModelDraftPayload(value);
  assert.equal(payload.model.model_id, "gpt-4o"); assert.equal(payload.model.model_name, "gpt-4o");
  assert.equal(Object.hasOwn(payload, "pricing"), false); assert.deepEqual(buildModelPricingPayload(value), { status: "UNKNOWN", input_cost_per_million_tokens: null, output_cost_per_million_tokens: null, currency: null });
  assert.equal(payload.model.rpm, null); assert.equal(payload.model.free_quota, null);
  assert.equal(JSON.stringify(payload).includes("apiKey"), false);
});

test("required identities, names, lengths, and synthetic Provider UUID are validated", () => {
  for (const key of ["providerName", "providerDisplayName", "providerId", "modelId", "displayName"]) { const value = valid(); value[key] = ""; assert.ok(check(value).errors[key], key); }
  for (const [key, length] of [["providerDisplayName", 161], ["modelId", 121], ["displayName", 161]]) { const value = valid(); value[key] = "x".repeat(length); assert.ok(check(value).errors[key], key); }
  const bad = valid(); bad.providerId = "real-provider-uuid"; assert.ok(check(bad).errors.providerId);
});

test("string length boundaries are inclusive and URL limit is exactly 512 characters", () => {
  const value = valid();
  value.providerDisplayName = "P".repeat(160); value.modelId = "m".repeat(120); value.displayName = "D".repeat(160);
  value.apiBaseUrl = `https://x.io/${"a".repeat(499)}`;
  assert.equal(value.apiBaseUrl.length, 512); assert.equal(check(value).valid, true);
  value.apiBaseUrl += "a"; assert.ok(check(value).errors.apiBaseUrl);
  value.apiBaseUrl = "https://api.openai.com/v1"; value.currency = "U".repeat(16); assert.equal(check(value).valid, true);
  value.defaultBaseUrl = `https://x.io/${"b".repeat(499)}`; assert.equal(value.defaultBaseUrl.length, 512); assert.equal(check(value).valid, true);
  value.defaultBaseUrl += "b"; assert.ok(check(value).errors.defaultBaseUrl);
  value.currency = "US"; assert.ok(check(value).errors.currency);
  value.currency = "U".repeat(17); assert.ok(check(value).errors.currency);
});

test("all explicit enums accept supported values and reject unknown values", () => {
  const fields = { providerName: "CUSTOM", providerType: "OLLAMA", providerStatus: "QUOTA_LIMITED", endpointMode: "MANUAL", authType: "NONE", connectionType: "CUSTOM", costLevel: "HIGH", usageStrategy: "FALLBACK", pricingStatus: "DISABLED", billingMode: "SELF_HOSTED" };
  const value = { ...valid(), ...fields, manualBaseUrl: "https://local.example/v1" };
  assert.equal(check(value).valid, true, JSON.stringify(check(value).errors));
  for (const key of Object.keys(fields)) { const bad = { ...value, [key]: "UNKNOWN_ENUM" }; assert.ok(check(bad).errors[key], key); }
});

test("AUTO and MANUAL endpoint modes enforce valid HTTP(S) URLs without userinfo or controls", () => {
  const value = valid(); assert.equal(check(value).valid, true);
  value.apiBaseUrl = ""; value.defaultBaseUrl = ""; assert.equal(check(value).valid, true); // Provider URLs are optional in candidate config.
  value.defaultBaseUrl = "https://user:pass@example.com"; assert.ok(check(value).errors.defaultBaseUrl);
  value.defaultBaseUrl = "https://default.example/v1"; assert.equal(check(value).valid, true);
  value.endpointMode = "MANUAL"; assert.ok(check(value).errors.manualBaseUrl);
  value.manualBaseUrl = "https://user:pass@example.com/v1"; assert.ok(check(value).errors.manualBaseUrl);
  value.manualBaseUrl = "https://example.com/v1"; assert.equal(check(value).valid, true);
  assert.equal(Object.hasOwn(buildModelDraftPayload(value).model, "manual_base_url"), true);
  value.endpointMode = "AUTO"; value.apiBaseUrl = "ftp://example.com"; assert.ok(check(value).errors.apiBaseUrl);
  value.endpointMode = "AUTO"; value.apiBaseUrl = ""; value.manualBaseUrl = ""; assert.equal(Object.hasOwn(buildModelDraftPayload(value).model, "manual_base_url"), false);
  value.apiBaseUrl = `https://${"a".repeat(510)}.com`; assert.ok(check(value).errors.apiBaseUrl);
});

test("pricing UNKNOWN leaves values unknown and VERIFIED requires both rates, currency, and source", () => {
  const value = valid(); assert.equal(check(value).valid, true);
  value.pricingStatus = "VERIFIED"; assert.ok(check(value).errors.pricingStatus);
  Object.assign(value, { inputRate: "0", outputRate: "0.25", currency: "USD", pricingSource: "official price list" });
  assert.equal(check(value).valid, true); assert.equal(Object.hasOwn(buildModelDraftPayload(value), "pricing"), false); assert.deepEqual(buildModelPricingPayload(value), { status: "VERIFIED", input_cost_per_million_tokens: 0, output_cost_per_million_tokens: 0.25, currency: "USD", pricing_source: "official price list" });
  value.pricingStatus = "DISABLED"; value.inputRate = ""; value.outputRate = ""; value.currency = "";
  const payload = buildModelPricingPayload(value); assert.equal(payload.status, "DISABLED"); assert.equal(payload.input_cost_per_million_tokens, null); assert.equal(payload.output_cost_per_million_tokens, null); assert.equal(payload.currency, null); assert.equal(Object.hasOwn(payload, "pricing_source"), false);
});

test("rate, budgets, limits, enums, and capabilities accept inclusive bounds and reject invalid values", () => {
  const value = valid(); Object.assign(value, { rpm: "10000000", tpm: "1000000000", rpd: "10000000", warningThreshold: "100", monthlyBudget: "0", providerDailyBudget: "0", providerMonthlyBudget: "0", freeQuota: "0", inputRate: "0", outputRate: "0", capabilities: ["TEXT_GENERATION"] });
  assert.equal(check(value).valid, true);
  for (const [key, invalid] of [["rpm", "10000001"], ["tpm", "1.2"], ["rpd", "-1"], ["warningThreshold", "101"], ["monthlyBudget", "-0.01"], ["inputRate", "-1"], ["providerDailyBudget", "NaN"]]) { const item = { ...value, [key]: invalid }; assert.ok(check(item).errors[key], key); }
  value.capabilities = Array.from({ length: 11 }, (_, i) => `CAP_${i}`); assert.ok(check(value).errors.capabilities);
  value.capabilities = ["NOT_REGISTERED"]; assert.ok(check(value).errors.capabilities);
});

test("old context_window remains explicitly unmapped and never enters model payload", () => {
  const value = valid(); value.contextWindow = "128K"; assert.ok(check(value).errors.contextWindow);
  value.contextWindow = ""; const payload = buildModelDraftPayload(value);
  assert.equal(Object.hasOwn(payload.model, "context_window"), false); assert.equal(payload.metadata.context_window_status, "UNKNOWN");
});

test("candidate payload distinguishes provider budget, model quota, draft/test states and boolean-only secret marker", () => {
  const value = { ...valid(), providerDailyBudget: "12", providerMonthlyBudget: "90", monthlyBudget: "50", secretConfigured: true };
  const payload = buildModelDraftPayload(value);
  assert.equal(payload.provider.daily_budget, 12); assert.equal(payload.provider.monthly_budget, 90); assert.equal(payload.model.monthly_budget_limit, 50);
  assert.equal(payload.metadata.configuration_status, "DRAFT"); assert.equal(payload.metadata.connection_test_status, "UNTESTED"); assert.equal(payload.metadata.secret_configured_mock, true);
  const encoded = JSON.stringify(payload); assert.equal(encoded.includes("api_key"), false); assert.equal(encoded.includes("apiKey"), false);
});
