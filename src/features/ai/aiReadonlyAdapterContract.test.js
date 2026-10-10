import test from "node:test";
import assert from "node:assert/strict";
import {
  AI_READONLY_METHODS,
  assertAiReadonlyRequest,
  classifyAiReadonlyHttpStatus,
  createAiReadonlyAdapter,
  createAiReadonlyFixtureAdapter,
} from "./aiReadonlyAdapterContract.js";

test("AI-C10 allows only GET, HEAD and OPTIONS before transport dispatch", async () => {
  assert.deepEqual(AI_READONLY_METHODS, ["GET", "HEAD", "OPTIONS"]);
  let calls = 0;
  const adapter = createAiReadonlyAdapter(async (_url, options) => {
    calls += 1;
    return new Response(options.method === "HEAD" ? null : JSON.stringify({ data: { ok: true } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  for (const method of AI_READONLY_METHODS) await adapter.request("/api/v1/ai-model-operations", { method });
  assert.equal(calls, 3);
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    await assert.rejects(adapter.request("/api/v1/ai-model-operations", { method }), { code: "AI_READONLY_METHOD_BLOCKED" });
  }
  assert.equal(calls, 3);
});

test("AI-C10 blocks bodies, cross-origin paths and credential-shaped metadata", () => {
  assert.throws(() => assertAiReadonlyRequest({ url: "/api/test", body: "{}" }), { code: "AI_READONLY_PAYLOAD_BLOCKED" });
  assert.throws(() => assertAiReadonlyRequest({ url: "https://outside.test/api" }), { code: "AI_READONLY_SAME_ORIGIN_REQUIRED" });
  assert.throws(() => assertAiReadonlyRequest({ url: "/api/test?api_key=dummy" }), { code: "AI_READONLY_SENSITIVE_QUERY_BLOCKED" });
  assert.throws(() => assertAiReadonlyRequest({ url: "/api/test", headers: { Authorization: "dummy" } }), { code: "AI_READONLY_SENSITIVE_HEADER_BLOCKED" });
});

test("AI-C10 maps stable read failures without fixture fallback", async () => {
  const expected = new Map([[401, "AUTH_REQUIRED"], [403, "PERMISSION_DENIED"], [404, "NOT_AVAILABLE"], [409, "STATE_CONFLICT"], [500, "SERVICE_FAILURE"]]);
  for (const [status, state] of expected) {
    assert.equal(classifyAiReadonlyHttpStatus(status).state, state);
    const adapter = createAiReadonlyAdapter(async () => new Response("{}", { status, headers: { "Content-Type": "application/json" } }));
    await assert.rejects(adapter.request("/api/v1/ai-model-operations"), (error) => error.code === state && error.status === status && error.productionVerified === false);
  }
});

test("AI-C10 keeps fixture evidence explicitly non-production", async () => {
  const adapter = createAiReadonlyFixtureAdapter({ "/api/example": { models: 2 } });
  const found = await adapter.request("/api/example");
  const missing = await adapter.request("/api/missing");
  assert.deepEqual(found, { data: { models: 2 }, status: 200, source: "LOCAL_FIXTURE", productionVerified: false });
  assert.equal(missing.status, 404);
  assert.equal(missing.productionVerified, false);
});
