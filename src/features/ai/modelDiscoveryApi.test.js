import test from "node:test";
import assert from "node:assert/strict";
import { discoverProviderModels, MODEL_DISCOVERY_TIMEOUT_MS } from "./modelDiscoveryApi.js";

const ok = (body) => ({ ok: true, status: 200, json: async () => body });
test("discovery retains server timing headroom and exact metadata POST contract", async () => {
  assert.equal(MODEL_DISCOVERY_TIMEOUT_MS, 90000);
  let request;
  const result = await discoverProviderModels("qa/provider", { fetcher: async (url, options) => {
    request = { url, options };
    return ok({ status: "SUCCESS", models: [{ model_id: "m", display_name: "M", model_vendor: "deepseek" }, { model_id: "m", display_name: "M" }] });
  } });
  assert.equal(request.url, "/api/v1/ai-providers/qa%2Fprovider/discover-models");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.credentials, "same-origin");
  assert.equal(request.options.body, undefined);
  assert.equal(result.models.length, 1);
});
test("discovery expires stalled transport and never automatically retries POST", async () => {
  let calls = 0, signal;
  await assert.rejects(discoverProviderModels("p", { timeoutMs: 15, fetcher: async (_url, options) => {
    calls++; signal = options.signal; return new Promise(() => {});
  } }), { code: "TIMEOUT" });
  assert.equal(calls, 1); assert.equal(signal.aborted, true);
});
test("discovery deadline covers response JSON", async () => {
  await assert.rejects(discoverProviderModels("p", { timeoutMs: 15, fetcher: async () => ({ ok: true, status: 200, json: () => new Promise(() => {}) }) }), { code: "TIMEOUT" });
});
test("discovery handles external cancellation even if transport ignores abort", async () => {
  const controller = new AbortController(); let signal;
  const pending = discoverProviderModels("p", { signal: controller.signal, fetcher: async (_url, options) => {
    signal = options.signal; return new Promise(() => {});
  } });
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(signal.aborted, true);
});
test("pre-cancelled discovery and invalid deadlines dispatch nothing", async () => {
  let calls = 0; const fetcher = async () => { calls++; };
  const controller = new AbortController(); controller.abort();
  await assert.rejects(discoverProviderModels("p", { fetcher, signal: controller.signal }), { name: "AbortError" });
  for (const timeoutMs of [0, -1, NaN, Infinity]) await assert.rejects(discoverProviderModels("p", { fetcher, timeoutMs }), TypeError);
  await assert.rejects(discoverProviderModels("", { fetcher }), { code: "PROVIDER_REQUIRED" });
  assert.equal(calls, 0);
});
test("successful discovery clears deadline and preserves empty catalog", async () => {
  let signal; const result = await discoverProviderModels("p", { timeoutMs: 15, fetcher: async (_url, options) => { signal = options.signal; return ok({ status: "SUCCESS_EMPTY", models: [] }); } });
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(signal.aborted, false); assert.deepEqual(result, { status: "SUCCESS_EMPTY", models: [] });
});
test("discovery retains auth and server failure mapping", async () => {
  await assert.rejects(discoverProviderModels("p", { fetcher: async () => ({ ok: false, status: 401, json: async () => ({}) }) }), { code: "AUTH_ERROR" });
  await assert.rejects(discoverProviderModels("p", { fetcher: async () => ok({ status: "TIMEOUT", models: [] }) }), { code: "TIMEOUT" });
});
test("late metadata response cannot replace an expired result", async () => {
  let resolve; const pending = discoverProviderModels("p", { timeoutMs: 15, fetcher: () => new Promise(done => { resolve = done; }) });
  await assert.rejects(pending, { code: "TIMEOUT" });
  resolve(ok({ status: "SUCCESS", models: [{ model_id: "late" }] }));
  await assert.rejects(pending, { code: "TIMEOUT" });
});
