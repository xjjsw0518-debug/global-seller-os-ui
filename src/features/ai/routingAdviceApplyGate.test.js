import test from "node:test";
import assert from "node:assert/strict";
import { createRoutingAdvicePreviewOnlyReceipt, getRoutingAdviceActionAvailability } from "./routingAdviceApplyGate.js";

const cart = (version = 2, items = [{ changeId: "c1", recommendationId: "r1", proposedValue: "fixture-model" }]) => ({ version, items });
const preflight = (overrides = {}) => ({ status: "MOCK_VALIDATED", cartVersion: 2, blockers: [], warnings: [], effectiveConfigChanged: false, mutationCounters: { policy: 0, router: 0, runtime: 0 }, ...overrides });

test("empty, blocked, or stale preflight cannot open preview-only review", () => {
  assert.equal(getRoutingAdviceActionAvailability(cart(2, []), preflight()).previewOnlyEnabled, false);
  assert.equal(getRoutingAdviceActionAvailability(cart(), preflight({ status: "MOCK_BLOCKED", blockers: ["CONNECTION_TEST_REQUIRED"] })).previewOnlyEnabled, false);
  assert.equal(getRoutingAdviceActionAvailability(cart(3), preflight()).previewOnlyEnabled, false);
});

test("validated and warning-only proposals may enter read-only preview only", () => {
  assert.equal(getRoutingAdviceActionAvailability(cart(), preflight()).previewOnlyEnabled, true);
  assert.equal(getRoutingAdviceActionAvailability(cart(), preflight({ status: "MOCK_WARNING", warnings: ["TARGET_DEGRADED"] })).previewOnlyEnabled, true);
});

test("apply and rollback remain disabled without authoritative endpoints and snapshots", () => {
  const state = getRoutingAdviceActionAvailability(cart(), preflight());
  assert.deepEqual(state.apply, { enabled: false, state: "NOT_CONNECTED" });
  assert.deepEqual(state.rollback, { enabled: false, state: "SNAPSHOT_UNKNOWN" });
  assert.equal(state.effectiveRouteVersion, "UNKNOWN");
});

test("preview confirmation is transient PREVIEW_ONLY metadata and cannot mutate the proposal or route", () => {
  const proposal = cart();
  const before = JSON.stringify(proposal);
  const receipt = createRoutingAdvicePreviewOnlyReceipt(proposal, preflight(), 1234);
  assert.equal(receipt.scope, "PREVIEW_ONLY");
  assert.equal(receipt.source, "LOCAL_SYNTHETIC_FIXTURE");
  assert.equal(receipt.effectiveRouteVersion, "UNKNOWN");
  assert.equal(receipt.effectiveConfigChanged, false);
  assert.deepEqual(receipt.mutationCounters, { policy: 0, router: 0, runtime: 0 });
  assert.equal("appliedVersion" in receipt, false);
  assert.equal("rollbackAvailable" in receipt, false);
  assert.equal(JSON.stringify(proposal), before);
  assert.equal(createRoutingAdvicePreviewOnlyReceipt(proposal, preflight({ status: "MOCK_BLOCKED", blockers: ["EMPTY_CART"] }), 1234), null);
});
