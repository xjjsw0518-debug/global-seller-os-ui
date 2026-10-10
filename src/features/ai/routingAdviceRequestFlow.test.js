import test from "node:test";
import assert from "node:assert/strict";
import { createRoutingAdviceRequestFlow } from "./routingAdviceRequestFlow.js";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

test("reports NOT_CONNECTED without invoking an absent candidate adapter", async () => {
  const flow = createRoutingAdviceRequestFlow();
  assert.equal(flow.getSnapshot().status, "NOT_CONNECTED");
  assert.deepEqual(await flow.reanalyze({ risk_level: "HIGH" }), {
    accepted: false,
    reason: "NOT_CONNECTED",
    snapshot: flow.getSnapshot(),
  });
  assert.deepEqual(flow.getSnapshot(), { status: "NOT_CONNECTED", data: null, error: null });
});

test("publishes LOADING then SUCCESS and suppresses duplicate reanalysis", async () => {
  const pending = deferred();
  let calls = 0;
  const flow = createRoutingAdviceRequestFlow({ adapter: { reanalyze: () => { calls += 1; return pending.promise; } } });
  const states = [];
  const unsubscribe = flow.subscribe((state) => states.push(state.status));

  const first = flow.reanalyze({ category: "STABILITY" });
  assert.equal(flow.getSnapshot().status, "LOADING");
  const duplicate = await flow.reanalyze({ category: "COST" });
  assert.equal(duplicate.accepted, false);
  assert.equal(duplicate.reason, "IN_FLIGHT");
  assert.equal(calls, 1);

  const payload = { recommendations: [{ recommendation_id: "mock-rec-1" }] };
  pending.resolve(payload);
  const completed = await first;
  unsubscribe();
  assert.equal(completed.accepted, true);
  assert.deepEqual(flow.getSnapshot(), { status: "SUCCESS", data: payload, error: null });
  assert.deepEqual(states, ["LOADING", "SUCCESS"]);
});

test("publishes safe ERROR code, hides raw error text and permits retry", async () => {
  let calls = 0;
  const flow = createRoutingAdviceRequestFlow({ adapter: { reanalyze: async () => {
    calls += 1;
    if (calls === 1) throw Object.assign(new Error("raw response includes sensitive details"), { code: "MOCK_TIMEOUT" });
    return { recommendations: [] };
  } } });

  await flow.reanalyze();
  assert.deepEqual(flow.getSnapshot(), { status: "ERROR", data: null, error: { code: "MOCK_TIMEOUT" } });
  assert.equal(JSON.stringify(flow.getSnapshot()).includes("sensitive details"), false);
  await flow.reanalyze();
  assert.deepEqual(flow.getSnapshot(), { status: "SUCCESS", data: { recommendations: [] }, error: null });
  assert.equal(calls, 2);
});

test("ignores late success from an invalidated request while a newer request is loading", async () => {
  const first = deferred();
  const second = deferred();
  let calls = 0;
  const flow = createRoutingAdviceRequestFlow({ adapter: { reanalyze: () => (++calls === 1 ? first.promise : second.promise) } });

  const oldRequest = flow.reanalyze({ request: "old" });
  flow.invalidate();
  assert.equal(flow.getSnapshot().status, "IDLE");
  const currentRequest = flow.reanalyze({ request: "current" });
  first.resolve({ source: "late-old-response" });
  const oldResult = await oldRequest;
  assert.equal(oldResult.stale, true);
  assert.equal(flow.getSnapshot().status, "LOADING");
  assert.equal(flow.getSnapshot().data, null);

  const currentData = { source: "current-response" };
  second.resolve(currentData);
  await currentRequest;
  assert.deepEqual(flow.getSnapshot(), { status: "SUCCESS", data: currentData, error: null });
});

test("ignores late rejection after invalidation instead of replacing the newer state", async () => {
  const pending = deferred();
  const flow = createRoutingAdviceRequestFlow({ adapter: { reanalyze: () => pending.promise } });
  const oldRequest = flow.reanalyze();
  flow.invalidate();
  pending.reject(Object.assign(new Error("late raw failure"), { code: "LATE_FAILURE" }));
  const result = await oldRequest;
  assert.equal(result.stale, true);
  assert.deepEqual(flow.getSnapshot(), { status: "IDLE", data: null, error: null });
});
