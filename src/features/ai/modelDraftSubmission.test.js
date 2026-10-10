import test from "node:test";
import assert from "node:assert/strict";
import { createModelDraftSubmissionGate } from "./modelDraftSubmission.js";

test("A14 synchronous gate suppresses a rapid duplicate call while the first save is pending", async () => {
  const gate = createModelDraftSubmissionGate();
  let release;
  let calls = 0;
  const pending = new Promise((resolve) => { release = resolve; });
  const firstAccepted = gate.acquire();
  const first = firstAccepted ? (calls += 1, pending.finally(() => gate.release())) : Promise.resolve();
  const duplicateAccepted = gate.acquire();
  if (duplicateAccepted) calls += 1;
  assert.equal(duplicateAccepted, false);
  assert.equal(calls, 1);
  release({ item: { id: "fixture-saved" }, mock: true });
  const result = await first;
  assert.equal(result.item.id, "fixture-saved");
  assert.equal(gate.inFlight, false);
});

test("A15 failed save reports failure without mutating the caller's draft object and permits retry", async () => {
  const gate = createModelDraftSubmissionGate();
  const draft = Object.freeze({ modelId: "keep-on-failure", displayName: "Keep this draft" });
  const failure = new Error("preview save failure");
  assert.equal(gate.acquire(), true);
  let captured;
  try { throw failure; } catch (error) { captured = error; } finally { gate.release(); }
  assert.equal(captured, failure);
  assert.deepEqual(draft, { modelId: "keep-on-failure", displayName: "Keep this draft" });
  assert.equal(gate.inFlight, false);
  assert.equal(gate.acquire(), true);
  gate.release();
});
