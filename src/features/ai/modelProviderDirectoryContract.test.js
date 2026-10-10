import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAiProviderDirectoryResponse, configuredProviderSecretRef } from "./modelProviderDirectoryContract.js";

test("provider changes use only the new configured reference and fail closed", () => {
  const first = { credentialConfigured: true, secretRef: "secret://staging/provider-a" };
  const second = { credentialConfigured: true, secretRef: "secret://staging/provider-b" };
  assert.equal(configuredProviderSecretRef(first), "secret://staging/provider-a");
  assert.equal(configuredProviderSecretRef(second), "secret://staging/provider-b");
  assert.equal(configuredProviderSecretRef(undefined), "");
  assert.equal(configuredProviderSecretRef({ ...second, credentialConfigured: false }), "");
  assert.equal(configuredProviderSecretRef({ ...second, secretRef: "invalid-reference" }), "");
});

test("normalizes the existing raw AiProviderResponse array into safe UI state", () => {
  const rows = normalizeAiProviderDirectoryResponse([{
    id: "provider-staging-1",
    provider_code: "TEST_PROVIDER",
    provider_name: "CUSTOM",
    provider_display_name: "Staging Provider",
    api_base_url: "https://api.example.test/v1",
    default_base_url: "https://api.example.test/v1",
    enabled: true,
    secret_ref: "secret://staging/provider-1",
    credential_configured: true,
    credential_status: "CONFIGURED",
    api_key_last4: "4321",
    api_key_masked: "••••4321",
    provider_status: "ACTIVE",
    provider_type: "OPENAI_COMPATIBLE",
    connection_type: "OPENAI_COMPATIBLE",
    auth_type: "API_KEY",
  }]);

  assert.deepEqual(rows, [{
    id: "provider-staging-1",
    name: "Staging Provider",
    baseUrl: "https://api.example.test/v1",
    secretRef: "secret://staging/provider-1",
    credentialConfigured: true,
    enabled: true,
    providerStatus: "ACTIVE",
    providerType: "OPENAI_COMPATIBLE",
    connectionType: "OPENAI_COMPATIBLE",
    authType: "API_KEY",
  }]);
  assert.equal(JSON.stringify(rows).includes("4321"), false);
});

test("supports known response envelopes and rejects invalid rows and secret references", () => {
  const rows = normalizeAiProviderDirectoryResponse({ data: [
    { provider_id: "provider-2", display_name: "Envelope Provider", secret_ref: "not-a-secret-ref", credential_configured: true },
    { id: "" }, null,
  ] });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].secretRef, "");
  assert.equal(rows[0].credentialConfigured, true);
  assert.deepEqual(normalizeAiProviderDirectoryResponse({ data: { items: [] } }), []);
});

test("does not infer configured credentials from a reference alone", () => {
  const [row] = normalizeAiProviderDirectoryResponse([{ id: "provider-3", secret_ref: "secret://staging/provider-3" }]);
  assert.equal(row.credentialConfigured, false);
});

test("provider aliases retain canonical or explicit vendor identity independently", () => {
  const [deepseek, custom, hosted] = normalizeAiProviderDirectoryResponse([
    { id: "deepseek-1", provider_name: "DEEPSEEK", provider_display_name: "My staging connection" },
    { id: "custom-1", provider_name: "CUSTOM", provider_display_name: "Hosted API" },
    { id: "hosted-1", provider_name: "CUSTOM", model_vendor: "ZHIPU", provider_display_name: "SCNET" },
  ]);
  assert.equal(deepseek.modelVendor, "DEEPSEEK");
  assert.equal(custom.modelVendor, undefined);
  assert.equal(hosted.modelVendor, "ZHIPU");
  assert.equal(hosted.name, "SCNET");
});
