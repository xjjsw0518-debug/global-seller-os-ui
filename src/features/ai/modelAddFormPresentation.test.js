import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { AI_CAPABILITY_CATALOG, MODALITY_CANDIDATES, SCENARIO_CANDIDATES } from "./modelCapabilityCatalog.js";
import { initialModelDraft } from "./modelDraftSchema.js";
import {
  ADVANCED_FIELD_LABELS_ZH,
  CAPABILITY_LABELS_ZH,
  FORM_OPTION_LABELS_ZH,
  localizeAdvancedField,
  localizeCapability,
  localizeFormOption,
  localizeScenarioOrModality,
  toControlledInputValue,
} from "./modelAddFormPresentation.js";

test("controlled input display normalizes only nullish values", () => {
  assert.equal(toControlledInputValue(null), "");
  assert.equal(toControlledInputValue(undefined), "");
  assert.equal(toControlledInputValue(""), "");
  assert.equal(toControlledInputValue(0), 0);
  assert.equal(toControlledInputValue("runtime-1"), "runtime-1");
});

test("every candidate capability has a Chinese display label while IDs stay unchanged", () => {
  assert.ok(AI_CAPABILITY_CATALOG.length >= 34);
  assert.equal(Object.keys(CAPABILITY_LABELS_ZH).length, AI_CAPABILITY_CATALOG.length);
  for (const { id } of AI_CAPABILITY_CATALOG) {
    assert.match(localizeCapability(id), /[\u3400-\u9fff]/, id);
    assert.equal(id, AI_CAPABILITY_CATALOG.find((item) => item.id === id).id);
  }
});

test("scenario and modality labels are localized without changing candidate enum values", () => {
  for (const value of [...SCENARIO_CANDIDATES, ...MODALITY_CANDIDATES]) {
    assert.match(localizeScenarioOrModality(value), /[\u3400-\u9fff]/, value);
    assert.ok(SCENARIO_CANDIDATES.includes(value) || MODALITY_CANDIDATES.includes(value));
  }
  assert.equal(localizeScenarioOrModality("UNRECOGNIZED_ENUM"), "UNRECOGNIZED_ENUM");
});

test("status and option labels are Chinese while unknown enum values pass through", () => {
  assert.equal(localizeFormOption("enabled", ""), "未知");
  assert.equal(localizeFormOption("enabled", null), "未知");
  assert.equal(localizeFormOption("enabled", "true"), "启用");
  assert.equal(localizeFormOption("enabled", true), "启用");
  assert.equal(localizeFormOption("enabled", "false"), "停用");
  assert.equal(localizeFormOption("enabled", false), "停用");
  assert.match(localizeFormOption("connectionType", "CUSTOM"), /[\u3400-\u9fff]/);
  assert.equal(localizeFormOption("unmapped", "FUTURE_UNKNOWN_ENUM"), "FUTURE_UNKNOWN_ENUM");
  assert.ok(FORM_OPTION_LABELS_ZH.GPU_RUNTIME);
});

test("all capability-specific controls have Chinese labels", () => {
  for (const key of Object.keys(ADVANCED_FIELD_LABELS_ZH)) {
    assert.match(localizeAdvancedField(key), /[\u3400-\u9fff]/, key);
  }
  assert.equal(localizeAdvancedField("futureField"), "futureField");
});

test("AddModelPage uses display-only null normalization and shared label helpers", async () => {
  const source = await readFile(new URL("./AddModelPage.jsx", import.meta.url), "utf8");
  assert.match(source, /value=\{key === "qualityTier" && form\[key\] === "UNKNOWN" \? "" : toControlledInputValue\(form\[key\]\)\}/);
  assert.match(source, /placeholder=\{unavailable \? .*? : key === "qualityTier" && form\[key\] === "UNKNOWN" \? localizeFormOption\("qualityTier", "UNKNOWN"\) : ""\}/);
  assert.equal(initialModelDraft.qualityTier, "UNKNOWN");
  assert.doesNotMatch(source, /value=\{form\[key\]\]\}/);
  assert.match(source, /localizeScenarioOrModality\(option\)/);
  assert.match(source, /localizeCapability\(cap\)/);
  assert.match(source, /localizeFormOption\("enabled", "true"\)/);
  assert.ok(source.includes("localizeAdvancedField"), "Shared localization helper remains available for declared fields");
});
test("production status display localizes known enum and mock states without changing unknowns", () => {
  assert.equal(localizeFormOption("billingMode", "UNMANAGED"), "\u672a\u6258\u7ba1");
  assert.equal(localizeFormOption("pricingStatus", "UNKNOWN"), "\u672a\u77e5");
  assert.equal(localizeFormOption("endpointMode", "AUTO"), "\u81ea\u52a8\u89e3\u6790");
  assert.equal(localizeFormOption("connectionTest", "UNTESTED"), "\u672a\u6d4b\u8bd5");
  assert.equal(localizeFormOption("connectionTest", "TEST_SUCCESS"), "\u6d4b\u8bd5\u901a\u8fc7\uff08\u6a21\u62df\uff09");
  assert.equal(localizeFormOption("logoState", "PROVIDER_FALLBACK"), "\u4f7f\u7528 Provider \u6807\u8bc6\u4f5c\u4e3a\u540e\u5907");
  assert.equal(localizeFormOption("future", "FUTURE_ENUM"), "FUTURE_ENUM");
});

test("locked production wizard uses verified capability and save state without legacy debug fields", async () => {
  const healthApi = await readFile(new URL("./modelConnectionHealthApi.js", import.meta.url), "utf8");
  assert.match(healthApi, /fetcher\("\/api\/v1\/ai-model-connection-tests"/);
  const source = await readFile(new URL("./AddModelPage.jsx", import.meta.url), "utf8");
  for (const [pattern,message] of [
    [/form\.capabilities\.length >= 10/,"Capability count remains bounded"],
    [/官方能力仅允许选择当前模型 Registry 中有验证证据的能力/,"Official capabilities require verified evidence"],
    [/testAiModelConnection\(/,"Real health endpoint is retained"],
    [/saveAiModelConfiguration\(/,"Save uses exact backend readback"],
    [/REQUIRED_MODEL_CONNECTION_CHECKS\.every/,"Enable requires all health checks"],
    [/服务端保存与数据库读回一致/,"Success is tied to database readback"],
    [/savedRecord\.dbReadback/,"Unconfirmed database readback cannot claim verified success"],
  ]) assert.ok(pattern.test(source),message);
  assert.ok(!source.includes('className="add-page-card add-page-contract"'), "Legacy debug contract is absent from frozen wizard");
});
