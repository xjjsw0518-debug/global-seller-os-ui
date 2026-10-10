import test from "node:test";
import assert from "node:assert/strict";
import { presentAiAdapterFailure, presentUnknownAmount } from "./aiAdapterStatus.js";
import { buildModelDraftPayload, buildModelPricingPayload, initialModelDraft } from "./modelDraftSchema.js";

test("classifies auth, permission, expired credential, timeout, network, service and unknown failures", () => {
  const cases = [
    [{ status: 401 }, "AUTH_REQUIRED"],
    [{ statusCode: 403 }, "PERMISSION_DENIED"],
    [{ code: "TOKEN_EXPIRED" }, "CREDENTIAL_EXPIRED"],
    [{ code: "ETIMEDOUT" }, "NETWORK_TIMEOUT"],
    [{ code: "ERR_NETWORK" }, "NETWORK_UNAVAILABLE"],
    [{ status: 503 }, "SERVICE_FAILURE"],
    [{ code: "SOMETHING_NEW" }, "UNKNOWN_FAILURE"],
  ];
  for (const [error, state] of cases) {
    const result = presentAiAdapterFailure(error);
    assert.equal(result.state, state);
    assert.equal(result.productionVerified, false);
    assert.equal(result.source, "ADAPTER_RESPONSE_UNVERIFIED");
  }
});

test("labels synthetic errors as local mock and never echoes raw error text", () => {
  const result = presentAiAdapterFailure({ code: "MOCK_CONNECTION_TIMEOUT", mock: true, message: "secret=do-not-show" });
  assert.equal(result.state, "NETWORK_TIMEOUT");
  assert.equal(result.source, "LOCAL_MOCK");
  assert.equal(result.productionVerified, false);
  assert.equal(result.retryable, true);
  assert.doesNotMatch(result.message, /do-not-show|secret=/);
  assert.match(presentAiAdapterFailure({ code: "AI_LOGO_ASSET_API_NOT_CONNECTED" }).message, /not connected/);
  const connectionFailure = presentAiAdapterFailure({ code: "MOCK_CONNECTION_FAILED", mock: true });
  assert.equal(connectionFailure.state, "MOCK_OPERATION_FAILURE");
  assert.equal(connectionFailure.source, "LOCAL_MOCK");
  assert.equal(connectionFailure.retryable, false);
});

test("sanitizes returned connection states as local synthetic outcomes", () => {
  for (const [response, expected] of [
    [{ state: "PERMISSION_DENIED", mock: true, message: "private provider response" }, "PERMISSION_DENIED"],
    [{ status: 401, mock: true, message: "secret token detail" }, "AUTH_REQUIRED"],
  ]) {
    const presentation = presentAiAdapterFailure(response);
    assert.equal(presentation.state, expected);
    assert.equal(presentation.source, "LOCAL_MOCK");
    assert.equal(presentation.productionVerified, false);
    assert.doesNotMatch(presentation.message, /private provider response|secret token detail/);
  }
});

test("unknown quota and cost remain unknown instead of being converted to zero", () => {
  assert.deepEqual(presentUnknownAmount(null), { known: false, value: null, label: "UNKNOWN" });
  assert.deepEqual(presentUnknownAmount(""), { known: false, value: null, label: "UNKNOWN" });
  assert.deepEqual(presentUnknownAmount("not-a-number"), { known: false, value: null, label: "UNKNOWN" });
  assert.deepEqual(presentUnknownAmount("0"), { known: true, value: 0, label: "0" });
});

test("draft quota and pricing payloads preserve unknown values as null", () => {
  const draft = { ...initialModelDraft, providerName: "OPENAI", providerDisplayName: "OpenAI", providerId: "fixture-openai-0001", modelId: "fixture-model", displayName: "Fixture Model" };
  const payload = buildModelDraftPayload(draft);
  const pricing = buildModelPricingPayload(draft);
  assert.equal(payload.model.free_quota, null);
  assert.equal(payload.model.rpm, null);
  assert.equal(payload.model.tpm, null);
  assert.equal(payload.model.rpd, null);
  assert.equal(payload.model.monthly_budget_limit, 0, "explicit default budget remains distinct from unknown free quota");
  assert.equal(pricing.status, "UNKNOWN");
  assert.equal(pricing.input_cost_per_million_tokens, null);
  assert.equal(pricing.output_cost_per_million_tokens, null);
  assert.equal(pricing.currency, null);
});
