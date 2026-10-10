import test from "node:test";
import assert from "node:assert/strict";
import { PROFILE_ADVANCED_FIELDS, PROFILE_PRIMARY_FIELDS, PRIMARY_BUDGET_FIELD } from "./modelAddAdvancedPresentation.js";

test("UI04 retains the main routing, priority, and budget controls", () => {
  assert.ok(PROFILE_PRIMARY_FIELDS.includes("routingPolicy"));
  assert.ok(PROFILE_PRIMARY_FIELDS.includes("priority"));
  assert.equal(PRIMARY_BUDGET_FIELD, "monthlyBudget");
});

test("UI04 advanced disclosure only groups existing lower-frequency profile fields", () => {
  const primary = new Set(PROFILE_PRIMARY_FIELDS);
  assert.equal(PROFILE_ADVANCED_FIELDS.some((field) => primary.has(field)), false);
  assert.equal(new Set(PROFILE_ADVANCED_FIELDS).size, PROFILE_ADVANCED_FIELDS.length);
  assert.deepEqual(PROFILE_ADVANCED_FIELDS, [
    "providerModelId", "runtimeId", "runtimeEndpoint", "runtimeHealthReason",
    "supportedLanguages", "qualityTier", "enabled", "fallbackModelId", "modelVersion",
    "commercialUseStatus", "licenseId", "licenseUrl", "commercialUseEvidenceUrl",
    "costUnit", "commercialCostStatus", "costPerUnit", "costCurrency", "commercialCostEvidenceUrl",
  ]);
});
