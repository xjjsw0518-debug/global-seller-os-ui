import test from "node:test";
import assert from "node:assert/strict";
import { normalizeModelConnectionHealthResponse, REQUIRED_MODEL_CONNECTION_CHECKS } from "./modelConnectionHealthContract.js";

const passedChecks = () => REQUIRED_MODEL_CONNECTION_CHECKS.map((name) => ({ name, status: "PASS", message: "ignored" }));

test("requires explicit READY plus all eight required checks", () => {
  const result = normalizeModelConnectionHealthResponse({ status: "READY", checks: passedChecks() });
  assert.equal(result.status, "READY");
  assert.equal(result.allChecksPassed, true);
  assert.deepEqual(result.checks.map((item) => item.name), REQUIRED_MODEL_CONNECTION_CHECKS);
  assert.ok(result.checks.every((item) => item.message === ""));
});

test("HTTP-success legacy status without the required chain never becomes READY", () => {
  const result = normalizeModelConnectionHealthResponse({ status: "TEST_SUCCESS", provider_status: "PASS" });
  assert.equal(result.status, "DEGRADED");
  assert.equal(result.allChecksPassed, false);
  assert.equal(result.checks.length, 8);
  assert.ok(result.checks.every((item) => item.status === "NOT_CHECKED"));
});

test("all checks passing without declared READY remains degraded", () => {
  const result = normalizeModelConnectionHealthResponse({ status: "TEST_SUCCESS", checks: passedChecks() });
  assert.equal(result.allChecksPassed, true);
  assert.equal(result.status, "DEGRADED");
});

test("missing, duplicate, or failed required checks prevent readiness", () => {
  const checks = passedChecks().filter((item) => item.name !== "Minimal Inference");
  checks.push({ name: "Capability Validation", status: "FAIL" });
  const result = normalizeModelConnectionHealthResponse({ status: "READY", checks });
  assert.equal(result.status, "DEGRADED");
  assert.equal(result.allChecksPassed, false);
  assert.equal(result.checks.find((item) => item.name === "Minimal Inference").status, "NOT_CHECKED");
});

test("known service health errors are preserved and response messages are not exposed", () => {
  const result = normalizeModelConnectionHealthResponse({ status: "AUTH_ERROR", error_code: "AUTH_ERROR", safe_message: "redacted" });
  assert.equal(result.status, "AUTH_ERROR");
  assert.equal(result.errorCode, "AUTH_ERROR");
  assert.ok(result.checks.every((item) => item.message === ""));
});
