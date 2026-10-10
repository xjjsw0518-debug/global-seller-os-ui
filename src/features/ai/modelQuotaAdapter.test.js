import test from "node:test";
import assert from "node:assert/strict";
import { configureAiModelOperationsReadTransport, modelQuotaAdapter } from "./modelQuotaAdapter.js";
import { presentAiAdapterFailure } from "./aiAdapterStatus.js";

test("retry invokes the mock connection adapter again and failed attempts leave model list unchanged", async () => {
  const previousWindow = globalThis.window;
  globalThis.window = { location: { search: "?mockTestFailure=1&mockDiagnostics=1" } };
  try {
    const before = await modelQuotaAdapter.list();
    await assert.rejects(modelQuotaAdapter.uploadLogoAsset({ type: "image/png", size: 16 }), { code: "AI_LOGO_ASSET_API_NOT_CONNECTED" });
    let adapterCalls = 0;
    const testAdapter = {
      ...modelQuotaAdapter,
      async validateConnection(config) {
        adapterCalls += 1;
        return modelQuotaAdapter.validateConnection(config);
      },
    };
    const config = { providerId: "fixture-openai-01", model: "retry-fixture-model", mock: true };

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await assert.rejects(testAdapter.validateConnection(config), { code: "MOCK_CONNECTION_TIMEOUT" });
    }

    const after = await modelQuotaAdapter.list();
    assert.equal(adapterCalls, 2, "two explicit retry attempts must call the adapter twice");
    assert.deepEqual(after.items, before.items, "failed connection attempts must not mutate the model list");
    assert.equal(after.total, before.total);

    globalThis.window.location.search = "?mockCreateFailure=1&mockDiagnostics=1";
    const beforeSaveFailure = await modelQuotaAdapter.list();
    await assert.rejects(modelQuotaAdapter.create({ provider: "OPENAI", model: "offline-save-failure-fixture", quota: "250", type: "OPENAI_COMPATIBLE" }), /simulated save failure/);
    const afterSaveFailure = await modelQuotaAdapter.list();
    assert.deepEqual(afterSaveFailure.items, beforeSaveFailure.items, "failed draft save must not change the model list");

    globalThis.window.location.search = "?mockDiagnostics=1";
    const saved = await modelQuotaAdapter.create({
      provider: "OPENAI", model: `offline-save-success-${Date.now()}`, quota: "250", type: "OPENAI_COMPATIBLE",
      modelLogo: { kind: "custom-model", fileName: "fixture.png", mimeType: "image/png", size: 16, dataUrl: "data:image/png;base64,AA==", mock: true, persistence: "MEMORY_ONLY" },
    });
    const afterSaveSuccess = await modelQuotaAdapter.list();
    assert.ok(afterSaveSuccess.items.some((item) => item.id === saved.item.id && item.model === saved.item.model), "successful save must be echoed in the local list");
    assert.equal(saved.item.enabled, false);
    assert.equal(saved.item.modelLogo.persistence, "MEMORY_ONLY");
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test("synthetic list and create failures remain explicitly local mock outcomes", async () => {
  const previousWindow = globalThis.window;
  globalThis.window = { location: { search: "?mockFailure=1" } };
  try {
    await assert.rejects(modelQuotaAdapter.list(), (error) => {
      const presentation = presentAiAdapterFailure(error);
      assert.equal(presentation.state, "MOCK_OPERATION_FAILURE");
      assert.equal(presentation.source, "LOCAL_MOCK");
      assert.equal(presentation.productionVerified, false);
      return true;
    });
    globalThis.window.location.search = "?mockCreateFailure=1";
    await assert.rejects(modelQuotaAdapter.create({ provider: "OPENAI", model: "offline-fixture", quota: "1" }), (error) => {
      assert.match(error.message, /simulated save failure/);
      const presentation = presentAiAdapterFailure(error);
      assert.equal(presentation.state, "MOCK_OPERATION_FAILURE");
      assert.equal(presentation.source, "LOCAL_MOCK");
      assert.equal(presentation.productionVerified, false);
      return true;
    });
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test("production-like browser without a server read keeps archived list outside local fixtures", async () => {
  const previousWindow = globalThis.window;
  configureAiModelOperationsReadTransport(null);
  globalThis.window = { location: { origin: "https://models.example.test", search: "" } };
  try {
    await assert.rejects(modelQuotaAdapter.listArchived(), { code: "AI_MODEL_ARCHIVE_LIST_API_NOT_CONNECTED" });
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
