import test from "node:test";
import assert from "node:assert/strict";
import { createRoutingAdviceCandidateTestFlow, routingAdviceCandidateFingerprint } from "./routingAdviceCandidateTestFlow.js";
import { createRoutingAdvicePreviewAdapter } from "./routingAdvicePreviewAdapter.js";

const candidate = (overrides = {}) => ({ recommendationId: "rec-1", targetKey: "worker-1/runtime-1", actionField: "model_id", currentValue: "model-old", proposedValue: "model-next", targetProvider: "provider-next", targetModel: "model-next", currentConfigFingerprint: "current-v1", proposedConfigFingerprint: "proposed-v1", risk: "HIGH", eligible: true, requiredCapability: "TEXT_GENERATION", connectionTestRequired: true, ...overrides });
const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

test("defaults disconnected and does not call absent candidate adapter", async () => {
  const flow = createRoutingAdviceCandidateTestFlow();
  assert.equal(flow.getSnapshot().status, "NOT_CONNECTED");
  assert.equal((await flow.run(candidate())).reason, "NOT_CONNECTED");
});

test("publishes loading and suppresses duplicate candidate test while one is in flight", async () => {
  const pending = deferred(); let calls = 0;
  const flow = createRoutingAdviceCandidateTestFlow({ adapter: { testCandidateConnection: () => { calls += 1; return pending.promise; } } });
  const first = flow.run(candidate());
  assert.equal(flow.getSnapshot().status, "LOADING");
  assert.equal((await flow.run(candidate())).reason, "IN_FLIGHT");
  assert.equal(calls, 1);
  pending.resolve({ status: "SUCCESS", candidateFingerprint: routingAdviceCandidateFingerprint(candidate()), validForMs: 1000 });
  await first;
  assert.equal(flow.getSnapshot().status, "SUCCESS");
});

test("success evidence is candidate-bound, explicitly time-bounded, and not reused for changed candidate", async () => {
  const flow = createRoutingAdviceCandidateTestFlow({ adapter: { testCandidateConnection: async (request) => ({ status: "SUCCESS", candidateFingerprint: request.candidateFingerprint, validForMs: 1000 }) } });
  const firstCandidate = candidate();
  await flow.run(firstCandidate);
  const firstFingerprint = routingAdviceCandidateFingerprint(firstCandidate);
  assert.equal(flow.getEvidence(firstFingerprint)?.validitySource, "EXPLICIT_MOCK_WINDOW");
  const changed = candidate({ proposedConfigFingerprint: "proposed-v2" });
  const changedFingerprint = routingAdviceCandidateFingerprint(changed);
  assert.notEqual(firstFingerprint, changedFingerprint);
  assert.equal(flow.select(changed).status, "NOT_TESTED");
  assert.equal(flow.getEvidence(changedFingerprint), null);
  assert.equal(flow.getEvidence(firstFingerprint), null);
  assert.equal(flow.select(firstCandidate).status, "NOT_TESTED");
});

test("candidate mutation during a test invalidates its late response", async () => {
  const pending = deferred();
  const firstCandidate = candidate();
  const flow = createRoutingAdviceCandidateTestFlow({ adapter: { testCandidateConnection: () => pending.promise } });
  const first = flow.run(firstCandidate);
  flow.select(candidate({ targetKey: "worker-2/runtime-2" }));
  pending.resolve({ status: "SUCCESS", candidateFingerprint: routingAdviceCandidateFingerprint(firstCandidate), validForMs: 1000 });
  assert.equal((await first).stale, true);
  assert.equal(flow.getSnapshot().status, "NOT_TESTED");
});

test("failure exposes a safe code and does not retain old success evidence", async () => {
  const flow = createRoutingAdviceCandidateTestFlow({ adapter: { testCandidateConnection: async () => { throw Object.assign(new Error("secret-like upstream detail"), { code: "MOCK_TEST_FAILED" }); } } });
  await flow.run(candidate());
  assert.equal(flow.getSnapshot().status, "FAILURE");
  assert.equal(flow.getSnapshot().error.code, "MOCK_TEST_FAILED");
  assert.equal(JSON.stringify(flow.getSnapshot()).includes("secret-like"), false);
  assert.equal(flow.getEvidence(routingAdviceCandidateFingerprint(candidate())), null);
});

test("unknown validity or mismatched response identity cannot become success", async () => {
  const candidateValue = candidate();
  const fingerprint = routingAdviceCandidateFingerprint(candidateValue);
  const noExpiry = createRoutingAdviceCandidateTestFlow({ adapter: { testCandidateConnection: async () => ({ status: "SUCCESS", candidateFingerprint: fingerprint }) } });
  await noExpiry.run(candidateValue);
  assert.equal(noExpiry.getSnapshot().error.code, "TEST_FRESHNESS_UNKNOWN");
  const mismatch = createRoutingAdviceCandidateTestFlow({ adapter: { testCandidateConnection: async () => ({ status: "SUCCESS", candidateFingerprint: "other", validForMs: 1000 }) } });
  await mismatch.run(candidateValue);
  assert.equal(mismatch.getSnapshot().error.code, "CANDIDATE_FINGERPRINT_MISMATCH");
});

test("expires evidence and clears it from candidate-scoped lookup", async () => {
  const candidateValue = candidate();
  const fingerprint = routingAdviceCandidateFingerprint(candidateValue);
  const flow = createRoutingAdviceCandidateTestFlow({ maxValidityMs: 15, adapter: { testCandidateConnection: async () => ({ status: "SUCCESS", candidateFingerprint: fingerprint, validForMs: 10 }) } });
  await flow.run(candidateValue);
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(flow.getSnapshot().status, "EXPIRED");
  assert.equal(flow.getEvidence(fingerprint), null);
});

test("preview candidate connection adapter is opt-in, synthetic, and has independent call counts", async () => {
  const disconnected = createRoutingAdvicePreviewAdapter({ delayMs: 0 });
  assert.equal(disconnected.testCandidateConnection, undefined);
  const adapter = createRoutingAdvicePreviewAdapter({ delayMs: 0, candidateTestEnabled: true, failCandidateTestOnCalls: [1] });
  const request = { candidateFingerprint: "fp-1" };
  const failure = await adapter.testCandidateConnection(request);
  const success = await adapter.testCandidateConnection(request);
  assert.equal(failure.status, "FAILURE");
  assert.equal(failure.source, "LOCAL_SYNTHETIC_FIXTURE");
  assert.equal(success.status, "SUCCESS");
  assert.equal(success.candidateFingerprint, "fp-1");
  assert.equal(success.validForMs, 15_000);
  assert.equal(adapter.candidateTestCallCount, 2);
  assert.equal(adapter.callCount, 0);
});
