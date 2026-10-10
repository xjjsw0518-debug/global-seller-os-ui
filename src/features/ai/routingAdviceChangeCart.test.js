import test from "node:test";
import assert from "node:assert/strict";
import { createRoutingAdviceChangeCart } from "./routingAdviceChangeCart.js";

const proposal = (overrides = {}) => ({
  recommendationId: "rec-001",
  targetKey: "worker-01/runtime-01",
  actionField: "model_id",
  currentValue: "model-current",
  proposedValue: "model-next",
  risk: "HIGH",
  ...overrides,
});

test("starts as an empty inert cart with unknown savings and zero mutation counters", () => {
  const cart = createRoutingAdviceChangeCart();
  assert.deepEqual(cart.getSnapshot(), {
    state: "EMPTY",
    version: 0,
    items: [],
    summary: { itemCount: 0, riskCounts: { HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 }, estimatedMonthlySavings: null, costStatus: "UNKNOWN" },
    readOnlyEffectiveConfig: true,
    mutationCounters: { policy: 0, router: 0, runtime: 0 },
    source: "LOCAL_SYNTHETIC_FIXTURE",
  });
});

test("adds a local proposal and summarizes only explicit counts while money remains unknown", () => {
  const cart = createRoutingAdviceChangeCart();
  const result = cart.add(proposal({ candidateFingerprint: "candidate-fingerprint-v1" }));
  assert.equal(result.accepted, true);
  assert.deepEqual(result.snapshot.summary, {
    itemCount: 1,
    riskCounts: { HIGH: 1, MEDIUM: 0, LOW: 0, UNKNOWN: 0 },
    estimatedMonthlySavings: null,
    costStatus: "UNKNOWN",
  });
  assert.equal(result.snapshot.state, "HAS_ITEMS");
  assert.equal(result.snapshot.version, 1);
  assert.equal(result.item.candidateFingerprint, "candidate-fingerprint-v1");
  assert.equal(result.snapshot.readOnlyEffectiveConfig, true);
  assert.deepEqual(result.snapshot.mutationCounters, { policy: 0, router: 0, runtime: 0 });
});

test("rejects exact duplicates and conflicting target-field proposals without changing cart state", () => {
  const cart = createRoutingAdviceChangeCart();
  cart.add(proposal());
  const before = cart.getSnapshot();
  assert.deepEqual(cart.add(proposal({ recommendationId: "rec-duplicate" })), { accepted: false, error: { code: "DUPLICATE_CHANGE" } });
  assert.deepEqual(cart.add(proposal({ proposedValue: "model-third" })), { accepted: false, error: { code: "CHANGE_CONFLICT" } });
  assert.deepEqual(cart.getSnapshot(), before);
});

test("removes an item, returns to EMPTY, and does not increment version for a missing id", () => {
  const cart = createRoutingAdviceChangeCart();
  const added = cart.add(proposal());
  assert.equal(cart.remove("missing").removed, false);
  assert.equal(cart.getSnapshot().version, 1);
  assert.equal(cart.remove(added.item.changeId).removed, true);
  assert.equal(cart.getSnapshot().state, "EMPTY");
  assert.equal(cart.getSnapshot().version, 2);
  assert.equal(cart.getSnapshot().summary.estimatedMonthlySavings, null);
});

test("counts UNKNOWN risk without inventing a zero value or cost estimate", () => {
  const cart = createRoutingAdviceChangeCart();
  const result = cart.add(proposal({ recommendationId: "rec-unknown", currentValue: null, risk: "INVALID" }));
  assert.equal(result.accepted, true);
  assert.equal(result.item.risk, "UNKNOWN");
  assert.equal(result.item.currentValue, null);
  assert.equal(result.snapshot.summary.riskCounts.UNKNOWN, 1);
  assert.equal(result.snapshot.summary.estimatedMonthlySavings, null);
  assert.equal(result.snapshot.summary.costStatus, "UNKNOWN");
});

test("validates required fields and the proposed value length without mutation", () => {
  const cart = createRoutingAdviceChangeCart();
  assert.deepEqual(cart.add(proposal({ proposedValue: " " })), { accepted: false, error: { code: "INVALID_CHANGE" } });
  assert.deepEqual(cart.add(proposal({ proposedValue: "x".repeat(161) })), { accepted: false, error: { code: "INVALID_CHANGE" } });
  assert.equal(cart.getSnapshot().version, 0);
  assert.equal(cart.getSnapshot().items.length, 0);
});
