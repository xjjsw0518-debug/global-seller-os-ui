import test from "node:test";
import assert from "node:assert/strict";
import { modelTrendWindow, modelTrendWindowQuery } from "./modelTrendRange.js";

test("all three visible ranges use explicit matching UTC bounds", () => {
  const now = "2026-10-09T06:12:34.567Z";
  for (const [period, start] of [["month", "2026-09-09T06:12:34.567Z"], ["quarter", "2026-07-09T06:12:34.567Z"], ["halfYear", "2026-04-09T06:12:34.567Z"]]) {
    assert.deepEqual(modelTrendWindow(period, now), { period: "custom", date_from: start, date_to: now });
  }
});

test("month-end is clamped in non-leap years", () => {
  assert.equal(modelTrendWindow("month", "2026-03-31T10:20:30.000Z").date_from, "2026-02-28T10:20:30.000Z");
});

test("month-end is clamped in leap years", () => {
  assert.equal(modelTrendWindow("month", "2028-03-31T10:20:30.000Z").date_from, "2028-02-29T10:20:30.000Z");
});

test("calendar range can cross years without changing the caller date", () => {
  const now = new Date("2026-01-31T23:59:59.999Z");
  assert.equal(modelTrendWindow("halfYear", now).date_from, "2025-07-31T23:59:59.999Z");
  assert.equal(now.toISOString(), "2026-01-31T23:59:59.999Z");
});

test("UTC instant is preserved across local timezone and daylight-saving offsets", () => {
  assert.equal(modelTrendWindow("month", "2026-03-09T01:30:00-05:00").date_to, "2026-03-09T06:30:00.000Z");
});

test("invalid ranges, click-event objects and dates do not silently request one day", () => {
  for (const [period, now] of [["unknown", new Date()], ["toString", new Date()], ["constructor", new Date()], [{ type: "click" }, new Date()], ["month", "invalid"]]) {
    assert.throws(() => modelTrendWindow(period, now), { code: "AI_MODEL_TREND_RANGE_INVALID" });
  }
});

test("query encoding preserves a single identical range for both existing endpoints", () => {
  const query = new URLSearchParams(modelTrendWindowQuery("quarter", "2026-10-09T06:00:00Z"));
  assert.deepEqual(Object.fromEntries(query), { period: "custom", date_from: "2026-07-09T06:00:00.000Z", date_to: "2026-10-09T06:00:00.000Z" });
});
