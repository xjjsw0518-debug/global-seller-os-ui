import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createAddModelFixtureSuccessRecord,
  parseAddModelFixtureParams,
  projectAddModelPreviewState,
  projectAddModelResultState,
} from "./addModelVisualState.js";

const fixture = Object.freeze({
  displayName: "GPT-5",
  vendorId: "OPENAI",
  modelId: "gpt-5",
  capabilities: Object.freeze(["TEXT_GENERATION"]),
  quota: Object.freeze({ monthlyQuota: 300 }),
  accessProvider: "fixture-openai-access",
});

test("AI-C01 parses the frozen Step1, Step2, Step3 and area fixture matrix once", () => {
  assert.deepEqual(parseAddModelFixtureParams(""), { step: 1, area: "capabilities", success: null, connectionState: null });
  assert.deepEqual(parseAddModelFixtureParams("?aiVisualStep=2&aiVisualConnectionState=success"), { step: 2, area: "capabilities", success: null, connectionState: "success" });
  assert.deepEqual(parseAddModelFixtureParams("?aiVisualStep=3&aiVisualArea=quota&aiVisualConnectionState=TIMEOUT"), { step: 3, area: "quota", success: null, connectionState: "timeout" });
  assert.deepEqual(parseAddModelFixtureParams("?aiVisualStep=3&aiVisualArea=routing"), { step: 3, area: "routing", success: null, connectionState: null });
  assert.deepEqual(parseAddModelFixtureParams("?aiVisualStep=9&aiVisualArea=bad&aiVisualSuccess=bad&aiVisualConnectionState=bad"), { step: 1, area: "capabilities", success: null, connectionState: null });
});

test("AI-C02 draft and enabled fixture records preserve the accepted success matrix", () => {
  const draft = createAddModelFixtureSuccessRecord(fixture, "draft");
  const enabled = createAddModelFixtureSuccessRecord(fixture, "enabled");
  assert.equal(draft.enabled, false);
  assert.equal(draft.model.enabled, false);
  assert.equal(enabled.enabled, true);
  assert.equal(enabled.model.enabled, true);
  assert.equal(createAddModelFixtureSuccessRecord(fixture, null), null);
  assert.deepEqual(draft.model.model.capabilities, ["TEXT_GENERATION"]);
});

test("AI-C03 preview keeps unsaved steps out of enabled routing state", () => {
  for (const step of [1, 2, 3]) {
    assert.deepEqual(projectAddModelPreviewState({ step, connectionHealth: step === 2 ? "READY" : "UNTESTED" }), {
      step,
      enabled: false,
      connectionStatus: step === 2 ? "READY" : "UNTESTED",
      routingActive: false,
    });
  }
  assert.deepEqual(projectAddModelPreviewState({ step: 3, hasSavedModel: true, savedEnabled: true, connectionHealth: "UNTESTED" }), {
    step: 3, enabled: true, connectionStatus: "READY", routingActive: true,
  });
});

test("AI-C03 result state fails closed when envelope and readback enabled flags disagree", () => {
  const draft = projectAddModelResultState({ enabled: false, model: { enabled: false, routing_strategy: { cost_strategy: "BALANCED" } } }, "READY");
  assert.deepEqual(draft, { enabled: false, stateConsistent: true, connectionStatus: "READY", routingActive: false, routeSummary: "草稿 · 未参与路由" });
  const enabled = projectAddModelResultState({ enabled: true, model: { enabled: true, routing_strategy: { cost_strategy: "BALANCED" } } }, "UNTESTED");
  assert.deepEqual(enabled, { enabled: true, stateConsistent: true, connectionStatus: "READY", routingActive: true, routeSummary: "BALANCED" });
  for (const record of [{ enabled: true, model: { enabled: false } }, { enabled: false, model: { enabled: true } }]) {
    const state = projectAddModelResultState(record, "UNTESTED");
    assert.equal(state.enabled, false);
    assert.equal(state.stateConsistent, false);
    assert.equal(state.routingActive, false);
  }
});

test("AI-C02 locks the more-vendor drawer and centralized fixture parameter source contracts", async () => {
  const source = await readFile(new URL("./AddModelPage.jsx", import.meta.url), "utf8");
  assert.match(source, /aria-expanded=\{showMoreVendors\}/);
  assert.match(source, /showMoreVendors && <section className="add-page-card model-more-panel"/);
  assert.match(source, /onClick=\{openMoreVendors\}/);
  assert.match(source, /onClick=\{cancelMoreVendors\}/);
  assert.match(source, /createAddModelFixtureSuccessRecord\(visualFixture, fixtureParams\.success\)/);
  assert.match(source, /visualFixture \? fixtureParams\.step : 1/);
  assert.match(source, /visualFixture \? fixtureParams\.area : "capabilities"/);
  assert.doesNotMatch(source, /URLSearchParams\(location\.search\)\.get\("aiVisual(?:Success|Step|Area)"\)/);
});
