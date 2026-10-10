import test from "node:test";
import assert from "node:assert/strict";
import { presentModelQuotaMetric, presentModelQuotaReadSource } from "./modelQuotaMetricPresentation.js";

test("canonical unknown is displayed in Chinese without turning it into zero", () => {
  assert.equal(presentModelQuotaMetric("UNKNOWN"), "未知");
  assert.notEqual(presentModelQuotaMetric("UNKNOWN"), 0);
});

test("known counts, monetary labels and empty markers remain unchanged", () => {
  for (const value of [0, 1, 15, 243.5, "¥ 4,680.20", "—", null]) {
    assert.equal(presentModelQuotaMetric(value), value);
  }
});

test("real projection and fixture source labels retain their meanings", () => {
  assert.equal(presentModelQuotaReadSource("SERVER_READ_PROJECTION"), "实时");
  assert.equal(presentModelQuotaReadSource("TEST_FIXTURE"), "样例");
  assert.equal(presentModelQuotaReadSource("UNKNOWN"), "未知");
  assert.equal(presentModelQuotaReadSource(undefined), "未知");
});

test("frozen reference trend labels are not rewritten", () => {
  for (const value of ["↑ 24%", "↓ 2%", "视觉样例", "UNKNOWN", 0]) {
    assert.equal(presentModelQuotaReadSource(value, true), value);
  }
});
