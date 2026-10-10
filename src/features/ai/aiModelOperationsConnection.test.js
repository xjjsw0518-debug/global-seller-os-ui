import test from "node:test";
import assert from "node:assert/strict";
import { aiModelOperationsApi } from "./aiModelOperationsApi.js";
import { REQUIRED_MODEL_CONNECTION_CHECKS } from "./modelConnectionHealthContract.js";

test("parent connection dialog receives success only for verified READY, otherwise error", async () => {
  const original = globalThis.fetch;
  try {
    for (const [status, checks, expected] of [
      ["READY", REQUIRED_MODEL_CONNECTION_CHECKS.map(name => ({ name, status: "PASS" })), "SUCCESS"],
      ["READY", [], "ERROR"],
      ["AUTH_ERROR", [], "ERROR"],
    ]) {
      globalThis.fetch = async () => ({ ok: true, json: async () => ({ status, checks }) });
      const result = await aiModelOperationsApi.testConnection({ provider_id: "test", model_id: "test", connection: {} });
      assert.equal(result.state, expected);
      assert.notEqual(result.message, undefined);
    }
  } finally { globalThis.fetch = original; }
});

test("draft enable uses server-verified existing configuration and exact original record readback", async () => {
  const original = globalThis.fetch;
  const id = "test-registry";
  const config = { id, enabled: true, model: { model_id: "test-model", display_name: "Test" }, connection: { access_provider_id: "test-provider", secret_ref: "secret://test/reference" }, quota_settings: {}, cost_registry: {}, routing_strategy: {} };
  const calls = [];
  try {
    globalThis.fetch = async (url, options = {}) => {
      calls.push({ url, options });
      if (url.endsWith("/state")) return { ok: false, status: 422, json: async () => ({ detail: { code: "CONNECTION_TEST_REQUIRED" } }) };
      if (url.includes("ai-model-operations?")) return { ok: true, json: async () => ({ items: [{ model_registry_id: id, model_id: "test-model", enabled: true }], total: 1 }) };
      return { ok: true, json: async () => config };
    };
    const result = await aiModelOperationsApi.setEnabled(id, true);
    assert.equal(result.item.id, id);
    assert.equal(result.item.enabled, true);
    assert.equal(result.dbReadback, true);
    const enable = calls.filter(call => call.url.endsWith("/enable"));
    assert.equal(enable.length, 1);
    assert.equal(JSON.parse(enable[0].options.body).model_registry_id, id);
  } finally { globalThis.fetch = original; }
});

test("failed disable does not invoke the enable flow", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => { calls++; return { ok:false, status:403, json:async()=>({detail:{code:"PERMISSION_DENIED"}}) }; };
    await assert.rejects(aiModelOperationsApi.setEnabled("test-registry", false), /PERMISSION_DENIED/);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test("clearing monthly quota clears the registry budget instead of keeping the old amount", async () => {
  const original = globalThis.fetch;
  const id = "test-registry";
  let posted;
  const config = { id, enabled:false, monthly_budget_limit:123.45, model:{model_id:"test-model",display_name:"Test"}, connection:{access_provider_id:"test-provider",secret_ref:"secret://test/reference"}, quota_settings:{monthly_quota:123.45}, cost_registry:{}, routing_strategy:{} };
  try {
    globalThis.fetch = async (url, options = {}) => {
      if (options.method === "POST") { posted=JSON.parse(options.body); return {ok:true,json:async()=>({...posted,id,enabled:false})}; }
      if (url.includes("ai-model-operations?")) return {ok:true,json:async()=>({items:[{model_registry_id:id,enabled:false}],total:1})};
      return {ok:true,json:async()=>posted?({...posted,id,enabled:false}):config};
    };
    await aiModelOperationsApi.update(id,{quota:""});
    assert.equal(posted.quota_settings.monthly_quota,null);
    assert.equal(posted.monthly_budget_limit,null);
  } finally { globalThis.fetch=original; }
});
