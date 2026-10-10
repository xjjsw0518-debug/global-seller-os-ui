import test from "node:test";
import assert from "node:assert/strict";
import { readModelCapabilityRegistry, verifiedModelCapabilitySources } from "./modelCapabilityRegistryApi.js";

const VALID_IDENTITY = Object.freeze({ providerId: "p-1", modelVendor: "OPENAI", modelId: "m", modelIdentityType: "OFFICIAL" });

test("registry read scopes by provider and full model identity", async () => {
  let request;
  const fetcher = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200, json: async () => ({ data: { capabilities: [] } }) };
  };
  await readModelCapabilityRegistry({ providerId: "p-1", modelVendor: "OPENAI", modelId: "gpt-x", modelIdentityType: "OFFICIAL" }, fetcher);
  assert.match(request.url, /provider_id=p-1/);
  assert.match(request.url, /model_vendor=OPENAI/);
  assert.match(request.url, /model_id=gpt-x/);
  assert.equal(request.options.credentials, "same-origin");
});

test("official capability allowlist includes only verified adapter or metadata evidence", () => {
  const registry = { capabilities: [
    { capability_code: "TEXT_GENERATION", verification_status: "VERIFIED", evidence_source: "PROVIDER_ADAPTER", verification_method: "MINIMAL_TEXT_INFERENCE" },
    { capability_code: "IMAGE_GENERATION", verification_status: "VERIFIED", evidence_source: "MANUAL_USER_SUPPLEMENT", verification_method: "USER_ATTESTATION" },
    { capability_code: "OCR", verification_status: "UNKNOWN", evidence_source: "MODEL_METADATA", verification_method: "NONE" },
  ] };
  assert.deepEqual(verifiedModelCapabilitySources(registry), { TEXT_GENERATION: "PROVIDER_ADAPTER" });
  assert.deepEqual(verifiedModelCapabilitySources(registry, "LOCAL"), { IMAGE_GENERATION: "MANUAL_USER_SUPPLEMENT" });
});

test("registry response errors are sanitized to a stable code", async () => {
  await assert.rejects(
    readModelCapabilityRegistry({ providerId: "p", modelVendor: "V", modelId: "m" }, async () => ({
      ok: false, status: 401, json: async () => ({ detail: { code: "AUTH_ERROR", message: "secret must not leak" } }),
    })),
    (error) => error.code === "AUTH_ERROR" && !error.message.includes("secret"),
  );
});

test("incomplete or invalid identity fails before any read request", async () => {
  let calls = 0;
  const fetcher = async () => { calls += 1; throw new Error("must not dispatch"); };
  for (const identity of [
    { providerId: "", modelVendor: "OPENAI", modelId: "gpt-5" },
    { providerId: "provider-1", modelVendor: "", modelId: "gpt-5" },
    { providerId: "provider-1", modelVendor: "OPENAI", modelId: "" },
    { providerId: "provider-1", modelVendor: "OPENAI", modelId: "gpt-5", modelIdentityType: "UNKNOWN" },
  ]) {
    await assert.rejects(readModelCapabilityRegistry(identity, fetcher), { code: "CAPABILITY_REGISTRY_IDENTITY_REQUIRED" });
  }
  assert.equal(calls, 0);
});


import { readFile } from "node:fs/promises";
test("registry component ignores superseded success and failure results", async () => {
  const source = await readFile(new URL("./AddModelPage.jsx", import.meta.url), "utf8");
  const fn = source.slice(source.indexOf("const loadCapabilityRegistry ="), source.indexOf("const escape ="));
  assert.ok(fn.includes("const requestId = ++capabilityRegistryRequestIdRef.current"));
  assert.equal(fn.split("if (requestId !== capabilityRegistryRequestIdRef.current) return null;").length - 1, 2);
  assert.ok(source.includes("capabilityRegistryRequestIdRef.current += 1; connectionTestInFlightRef.current = false; }, []);"));
});


test("registry deadline bounds a fetch that ignores abort without automatic retry", async () => {
  let calls = 0, signal;
  await assert.rejects(readModelCapabilityRegistry(VALID_IDENTITY, async (_url, options) => {
    calls++; signal = options.signal; return new Promise(() => {});
  }, { timeoutMs: 15 }), { code: "CAPABILITY_REGISTRY_TIMEOUT" });
  assert.equal(calls, 1);
  assert.equal(signal.aborted, true);
});

test("registry deadline covers stalled response JSON too", async () => {
  let signal;
  await assert.rejects(readModelCapabilityRegistry(VALID_IDENTITY, async (_url, options) => {
    signal = options.signal;
    return { ok: true, status: 200, json: () => new Promise(() => {}) };
  }, { timeoutMs: 15 }), { code: "CAPABILITY_REGISTRY_TIMEOUT" });
  assert.equal(signal.aborted, true);
});

test("registry rejects invalid deadlines before dispatch", async () => {
  let calls = 0;
  for (const timeoutMs of [0, -1, NaN, Infinity]) {
    await assert.rejects(readModelCapabilityRegistry({}, async () => { calls++; }, { timeoutMs }), TypeError);
  }
  assert.equal(calls, 0);
});

test("successful registry reads clear deadline and retain identity and evidence", async () => {
  let signal;
  const row = { capability_code: "TEXT_GENERATION", verification_status: "VERIFIED", evidence_source: "PROVIDER_ADAPTER", verification_method: "MINIMAL_TEXT_INFERENCE" };
  const result = await readModelCapabilityRegistry(VALID_IDENTITY, async (_url, options) => {
    signal = options.signal;
    return { ok: true, status: 200, json: async () => ({ data: { model_id: "m", capabilities: [row] } }) };
  }, { timeoutMs: 15 });
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(signal.aborted, false);
  assert.equal(result.model_id, "m");
  assert.deepEqual(result.capabilities, [row]);
});

test("late registry response cannot replace an expired result", async () => {
  let resolve;
  const pending = readModelCapabilityRegistry(VALID_IDENTITY, async () => new Promise(done => { resolve = done; }), { timeoutMs: 15 });
  await assert.rejects(pending, { code: "CAPABILITY_REGISTRY_TIMEOUT" });
  resolve({ ok: true, status: 200, json: async () => ({ data: { capabilities: [] } }) });
  await assert.rejects(pending, { code: "CAPABILITY_REGISTRY_TIMEOUT" });
});


test("capability evidence is bound to full provider and model identity", () => {
  const registry = { provider_id: "p", model_vendor: "DEEPSEEK", model_id: "flash", model_identity_type: "OFFICIAL", capabilities: [{ capability_code: "TEXT_GENERATION", verification_status: "VERIFIED", evidence_source: "PROVIDER_ADAPTER", verification_method: "MINIMAL_TEXT_INFERENCE" }] };
  const identity = { providerId: "p", modelVendor: "DeepSeek", modelId: "flash" };
  assert.deepEqual(verifiedModelCapabilitySources(registry, "OFFICIAL", identity), { TEXT_GENERATION: "PROVIDER_ADAPTER" });
  for (const delta of [{ providerId: "other" }, { modelVendor: "OPENAI" }, { modelId: "pro" }]) {
    assert.deepEqual(verifiedModelCapabilitySources(registry, "OFFICIAL", { ...identity, ...delta }), {});
  }
  assert.deepEqual(verifiedModelCapabilitySources(registry, "LOCAL", identity), {});
  assert.deepEqual(verifiedModelCapabilitySources({ capabilities: registry.capabilities }, "OFFICIAL", identity), {});
});

test("component invalidates evidence on identity changes and only enables ready matching evidence", async () => {
  const source = await readFile(new URL("./AddModelPage.jsx", import.meta.url), "utf8");
  assert.ok(source.includes('capabilityRegistryState === "READY"'));
  assert.ok(source.includes('setCapabilityRegistry(null); setCapabilityRegistryState("NOT_LOADED"); setCapabilitySources({});'));
  assert.ok(source.includes('[accessProvider, form.modelVendor, form.modelId, registryIdentityType, visualFixture]'));
  assert.ok(source.includes('verifiedModelCapabilitySources(result, modelIdentityType, { providerId, modelVendor, modelId })'));
});
