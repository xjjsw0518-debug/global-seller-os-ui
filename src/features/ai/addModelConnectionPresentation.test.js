import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("UI03 keeps provider URL and endpoint controls in the connection section", async () => {
  const source = await readFile(new URL("./AddModelPage.jsx", import.meta.url), "utf8");
  assert.match(source, /key:"connection"[^\n]*fields:\["endpointMode","apiBaseUrl","manualBaseUrl","authType","connectionType"\]/);
  assert.doesNotMatch(source, /\["providerDisplayName", "providerId", "providerType", "providerStatus", "providerEnabled", "apiBaseUrl"/);
});

test("locked wizard uses real accessible health controls and separates visual fixtures", async () => {
  const healthApi = await readFile(new URL("./modelConnectionHealthApi.js", import.meta.url), "utf8");
  assert.match(healthApi, /fetcher\("\/api\/v1\/ai-model-connection-tests"/);
  const source = await readFile(new URL("./AddModelPage.jsx", import.meta.url), "utf8");
  const checks = [
    [/connection-test-state-banner[^>]*role="status"[^>]*aria-live="polite"/, "Health result remains an accessible live status"],
    [/onClick=\{runConnectionHealthCheck\}/, "Visible test button invokes actual health chain"],
    [/testAiModelConnection\(/, "Health test uses existing backend endpoint"],
    [/advancedConnection.authType!=="NONE"&&!connectionSecretRef/, "Authenticated test requires managed reference"],
    [/REQUIRED_MODEL_CONNECTION_CHECKS\.every/, "Enable requires every mandatory check"],
  ];
  for (const [pattern,message] of checks) assert.ok(pattern.test(source),message);
  const start=source.indexOf("const runConnectionHealthCheck = async () => {");
  const handler=source.slice(start,source.indexOf("const persistConfiguration",start));
  const fixture=handler.slice(handler.indexOf("if (visualFixture)"),handler.indexOf('testAiModelConnection('));
  assert.ok(fixture.includes("return;"), "Visual fixture exits before real network access");
  assert.ok(handler.includes("secret_ref:"), "Test sends a managed reference rather than a plaintext credential");
  assert.match(source, /type="password"[\s\S]*?autoComplete="new-password"/, "Credential entry masks the key");
  const credentialStart = source.indexOf("const submitCredentialEntry = async (event) => {");
  const credentialHandler = source.slice(credentialStart, source.indexOf("const check =", credentialStart));
  assert.ok(credentialHandler.indexOf('apiKey: ""') < credentialHandler.indexOf('fetch("/api/v1/ai-providers"'), "Input clears before secure provider submission");
  assert.match(credentialHandler, /api_key: submittedKey/, "Credential is submitted only to provider registration");
  assert.match(credentialHandler, /setConnectionSecretRef\(created.secretRef\)/, "Only managed reference is retained after registration");
  assert.match(credentialHandler, /finally[\s\S]*apiKey: ""/, "Key clears after failure and success");
  assert.doesNotMatch(credentialHandler, /localStorage|sessionStorage|console\./, "Credential entry never logs or persists the key in browser storage");
  assert.doesNotMatch(handler, /api_key:|submittedKey|credentialDraft.apiKey/, "Health tests never send the plaintext credential");
});

test("UI03 styling keeps status and test control visible within the connection group", async () => {
  const css = await readFile(new URL("./model-add-page.css", import.meta.url), "utf8");
  assert.match(css, /add-page-connection-panel/);
  assert.match(css, /add-page-connection-status\[data-status="TEST_SUCCESS"\]/);
  assert.match(css, /add-page-connection-test:focus-visible/);
});
