import test from "node:test";
import assert from "node:assert/strict";
import { validateRoutingAdviceCart } from "./routingAdviceCartValidation.js";

const item = (overrides = {}) => ({ changeId: "c1", recommendationId: "r1", targetKey: "w1/runtime-a", actionField: "model_id", currentValue: "old", proposedValue: "new", risk: "MEDIUM", eligible: true, connectionTestRequired: false, ...overrides });
const facts = (overrides = {}) => ({ r1: { recommendationExists: true, fingerprintFresh: true, targetEnabled: true, health: "HEALTHY", quota: "AVAILABLE", ...overrides } });
const cart = (...items) => ({ version: 4, items });

test("blocks an empty cart and never reports mutation", () => {
  const result = validateRoutingAdviceCart(cart());
  assert.equal(result.status, "MOCK_BLOCKED");
  assert.deepEqual(result.blockers, ["EMPTY_CART"]);
  assert.equal(result.effectiveConfigChanged, false);
  assert.deepEqual(result.mutationCounters, { policy: 0, router: 0, runtime: 0 });
});

test("validates known safe candidate as a mock-only preflight", () => {
  const result = validateRoutingAdviceCart(cart(item()), facts());
  assert.equal(result.status, "MOCK_VALIDATED");
  assert.equal(result.items[0].status, "VALIDATED");
  assert.equal(result.source, "LOCAL_SYNTHETIC_FIXTURE");
  assert.equal(result.readOnlyEffectiveConfig, true);
});

test("requires connection-test evidence only when the candidate requires it", () => {
  const proposal = item({ risk: "HIGH", connectionTestRequired: true, requiredCapability: "TEXT_GENERATION" });
  const blocked = validateRoutingAdviceCart(cart(proposal), facts({ capabilityEnabled: true }));
  assert.ok(blocked.blockers.includes("CONNECTION_TEST_REQUIRED"));
  const passed = validateRoutingAdviceCart(cart(proposal), facts({ capabilityEnabled: true, connectionTestPassed: true }));
  assert.equal(passed.status, "MOCK_VALIDATED");
});

test("unknown risk, eligibility and missing facts cannot pass", () => {
  const result = validateRoutingAdviceCart(cart(item({ risk: "UNKNOWN", eligible: null })), {});
  assert.equal(result.status, "MOCK_BLOCKED");
  for (const code of ["RISK_UNKNOWN", "ELIGIBILITY_UNKNOWN", "RECOMMENDATION_EXISTENCE_UNKNOWN", "FINGERPRINT_FRESHNESS_UNKNOWN", "TARGET_ENABLED_UNKNOWN", "HEALTH_UNKNOWN", "QUOTA_UNKNOWN"]) assert.ok(result.blockers.includes(code), code);
});

test("inherited validation facts cannot satisfy candidate checks", () => {
  const inherited = Object.create({ r1: { recommendationExists: true, fingerprintFresh: true, targetEnabled: true, health: "HEALTHY", quota: "AVAILABLE" } });
  const result = validateRoutingAdviceCart(cart(item()), inherited);
  assert.equal(result.status, "MOCK_BLOCKED");
  assert.ok(result.blockers.includes("RECOMMENDATION_EXISTENCE_UNKNOWN"));
});

test("blocks stale, disabled, unhealthy, exhausted, and missing capability candidates", () => {
  const result = validateRoutingAdviceCart(cart(item({ requiredCapability: "VISION_UNDERSTANDING" })), facts({ recommendationExists: false, fingerprintFresh: false, targetEnabled: false, health: "UNHEALTHY", quota: "EXHAUSTED", capabilityEnabled: false }));
  for (const code of ["RECOMMENDATION_STALE_OR_MISSING", "RECOMMENDATION_STALE", "TARGET_DISABLED", "TARGET_UNHEALTHY", "QUOTA_EXHAUSTED", "CAPABILITY_MISSING"]) assert.ok(result.blockers.includes(code), code);
});

test("degraded health and near-limit quota warn without erasing known values", () => {
  const result = validateRoutingAdviceCart(cart(item()), facts({ health: "DEGRADED", quota: "NEAR_LIMIT" }));
  assert.equal(result.status, "MOCK_WARNING");
  assert.deepEqual(result.warnings.sort(), ["QUOTA_NEAR_LIMIT", "TARGET_DEGRADED"]);
  assert.deepEqual(result.blockers, []);
});

test("blocks exact duplicate and conflicting target-field changes", () => {
  const exact = validateRoutingAdviceCart(cart(item(), item({ changeId: "c2" })), facts());
  assert.ok(exact.blockers.includes("DUPLICATE_CHANGE"));
  const conflict = validateRoutingAdviceCart(cart(item(), item({ changeId: "c2", proposedValue: "other" })), facts());
  assert.ok(conflict.blockers.includes("CHANGE_CONFLICT"));
});

test("malformed cart and missing required fields are blocked safely", () => {
  assert.equal(validateRoutingAdviceCart(null).blockers[0], "INVALID_CART");
  const result = validateRoutingAdviceCart(cart(item({ targetKey: "", currentValue: null, proposedValue: "", actionField: "" })), facts());
  for (const code of ["TARGET_MISSING", "CURRENT_VALUE_UNKNOWN", "PROPOSED_VALUE_MISSING", "ACTION_FIELD_MISSING"]) assert.ok(result.blockers.includes(code), code);
});

test("preflight leaves input proposal and effective route untouched", () => {
  const original = cart(item());
  const before = JSON.stringify(original);
  const result = validateRoutingAdviceCart(original, facts());
  assert.equal(JSON.stringify(original), before);
  assert.equal(result.effectiveConfigChanged, false);
  assert.deepEqual(result.mutationCounters, { policy: 0, router: 0, runtime: 0 });
});
