import test from "node:test";
import assert from "node:assert/strict";
import { buildModelDraftPayload, initialModelDraft, validateModelDraft } from "./modelDraftSchema.js";
import {
  AI_CAPABILITY_CATALOG, CAPABILITY_ADVANCED_FIELDS, CAPABILITY_CATALOG_STATUS, CONNECTION_TYPES,
  DEPLOYMENT_CONNECTION_COMPATIBILITY, LEGACY_CAPABILITY_IDS, MODALITY_CANDIDATES, MODALITY_INPUT_ROLES,
  ROUTING_POLICY_CANDIDATES, SCENARIO_CANDIDATES, getCapabilityDefinition,
} from "./modelCapabilityCatalog.js";

const valid = () => ({ ...initialModelDraft, providerName: "DEEPSEEK", providerDisplayName: "DeepSeek (SYNTHETIC)", providerId: "fixture-deepseek-0001", modelId: "deepseek-r1", displayName: "DeepSeek R1", connectionType: "OPENAI_COMPATIBLE", capabilities: ["RPA_PLANNER_TOOL_CALLING"] });

test("candidate catalog retains legacy DeepSeek/RPA and CUSTOM while adding six connection types", () => {
  const ids = AI_CAPABILITY_CATALOG.map((item) => item.id);
  for (const id of LEGACY_CAPABILITY_IDS) assert.ok(ids.includes(id), id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.length > 30);
  for (const value of ["OPENAI_COMPATIBLE", "PROVIDER_NATIVE", "OLLAMA", "CUSTOM_HTTP", "LOCAL_RUNTIME", "GPU_RUNTIME", "CUSTOM"]) assert.ok(CONNECTION_TYPES.includes(value), value);
  assert.equal(CAPABILITY_CATALOG_STATUS, "LOCAL_CANDIDATE_CATALOG_NOT_REMOTE_REGISTRY");
  assert.equal(validateModelDraft(valid()).valid, true);
});

test("scenarios and modalities are explicit; AUDIO_REFERENCE is an input role on AUDIO", () => {
  assert.deepEqual(SCENARIO_CANDIDATES, ["GENERAL", "RPA", "CONTENT_CREATION", "AI_GUARD", "PRODUCT", "CUSTOMER_SERVICE", "VOICE_SALES"]);
  assert.deepEqual(MODALITY_CANDIDATES, ["TEXT", "JSON", "IMAGE", "VIDEO", "AUDIO"]);
  assert.deepEqual(MODALITY_INPUT_ROLES.AUDIO_REFERENCE, { modality: "AUDIO", direction: "INPUT", role: "REFERENCE_CONDITIONING", applicableCapabilities: ["VOICE_CLONING", "VOICE_STYLE_CONTROL"] });
  assert.ok(!MODALITY_CANDIDATES.includes("AUDIO_REFERENCE"));
});

test("multimodal optional payload round-trips known values and leaves absent values unknown", () => {
  const draft = { ...valid(), deploymentType: "GPU_RUNTIME", connectionType: "GPU_RUNTIME", scenarioSupport: ["RPA", "GENERAL"], inputModalities: ["TEXT", "JSON"], outputModalities: ["TEXT", "JSON"], providerModelId: "deepseek-ai/DeepSeek-R1", runtimeId: "runtime-fixture-01", runtimeEndpoint: "http://127.0.0.1:9000/v1", runtimeHealthReason: "RUNTIME_OFFLINE", supportedLanguages: ["en", "zh-Hans"], qualityTier: "HIGH", routingPolicy: "FIXED_MODEL", priority: 4, enabled: false, fallbackModelId: "fallback-r1", modelVersion: "2026-09", commercialUseStatus: "NEEDS_REVIEW", licenseId: "License not verified", licenseUrl: "https://example.org/license", costUnit: "GPU_SECOND", commercialCostStatus: "UNKNOWN", capabilitySettings: { RPA_PLANNER_TOOL_CALLING: { minimumVramGb: 8, expectedLatencyMs: 250, streaming: true } } };
  assert.equal(validateModelDraft(draft).valid, true, JSON.stringify(validateModelDraft(draft).errors));
  const model = buildModelDraftPayload(draft).model;
  assert.equal(model.deployment_type, "GPU_RUNTIME"); assert.deepEqual(model.scenario_support, ["RPA", "GENERAL"]);
  assert.deepEqual(model.input_modalities, ["TEXT", "JSON"]); assert.equal(model.provider_model_id, "deepseek-ai/DeepSeek-R1");
  assert.equal(model.routing_policy, "FIXED_MODEL"); assert.equal(model.enabled, false); assert.equal(model.cost_status, undefined);
  assert.equal(Object.hasOwn(model, "secret_ref"), false); assert.equal(Object.hasOwn(model, "apiKey"), false);
  const oldPayload = buildModelDraftPayload({ ...valid(), ...initialModelDraft, providerName: "DEEPSEEK", providerDisplayName: "DeepSeek (SYNTHETIC)", providerId: "fixture-deepseek-0001", modelId: "deepseek-r1", displayName: "DeepSeek R1", connectionType: "CUSTOM", capabilities: ["RPA_PLANNER_TOOL_CALLING"] });
  assert.equal(oldPayload.model.connection_type, "CUSTOM");
  for (const key of ["deployment_type", "scenario_support", "input_modalities", "output_modalities", "cost_unit"]) assert.equal(Object.hasOwn(oldPayload.model, key), false, key);
});

test("deployment and explicit modality/capability combinations validate without rewriting CUSTOM", () => {
  assert.ok(DEPLOYMENT_CONNECTION_COMPATIBILITY.PRIVATE_ENDPOINT.includes("CUSTOM"));
  const value = { ...valid(), connectionType: "CUSTOM", deploymentType: "PRIVATE_ENDPOINT", capabilities: ["IMAGE_GENERATION"], inputModalities: ["TEXT"], outputModalities: ["IMAGE"] };
  assert.equal(validateModelDraft(value).valid, true, JSON.stringify(validateModelDraft(value).errors));
  assert.equal(buildModelDraftPayload(value).model.connection_type, "CUSTOM");
  value.deploymentType = "OLLAMA"; assert.ok(validateModelDraft(value).errors.connectionType);
  value.deploymentType = "PRIVATE_ENDPOINT"; value.outputModalities = ["TEXT"]; assert.ok(validateModelDraft(value).errors.outputModalities);
  value.outputModalities = ["IMAGE", "IMAGE"]; assert.ok(validateModelDraft(value).errors.outputModalities);
});

test("capability-specific advanced field declarations cover media, runtime and capacity", () => {
  assert.ok(getCapabilityDefinition("IMAGE_GENERATION").advancedFields.includes("imageWidthPx"));
  assert.ok(getCapabilityDefinition("VIDEO_GENERATION").advancedFields.includes("frameRateFps"));
  assert.ok(getCapabilityDefinition("TEXT_TO_SPEECH").advancedFields.includes("streaming"));
  assert.ok(getCapabilityDefinition("RPA_PLANNER_TOOL_CALLING").advancedFields.includes("minimumVramGb"));
  assert.deepEqual(Object.keys(CAPABILITY_ADVANCED_FIELDS), ["imageWidthPx", "imageHeightPx", "resolution", "aspectRatios", "maxDurationSeconds", "frameRateFps", "supportedFormats", "minimumVramGb", "expectedLatencyMs", "maxConcurrency", "streaming", "batchSize"]);
  const draft = { ...valid(), capabilities: ["IMAGE_GENERATION"], inputModalities: ["TEXT"], outputModalities: ["IMAGE"], capabilitySettings: { IMAGE_GENERATION: { imageWidthPx: 1024, imageHeightPx: 1024, aspectRatios: ["1:1"], batchSize: 1 } } };
  assert.equal(validateModelDraft(draft).valid, true, JSON.stringify(validateModelDraft(draft).errors));
  draft.capabilitySettings.IMAGE_GENERATION.minimumVramGb = -1; assert.ok(validateModelDraft(draft).errors.capabilitySettings);
  draft.capabilitySettings.IMAGE_GENERATION = { frameRateFps: 30 }; assert.ok(validateModelDraft(draft).errors.capabilitySettings);
});

test("new enum and metadata validators preserve null UNKNOWN instead of manufacturing zero", () => {
  assert.equal(validateModelDraft({ ...valid(), deploymentType: "UNKNOWN", scenarioSupport: null, inputModalities: null, outputModalities: null, supportedLanguages: null, costUnit: "UNKNOWN", commercialCostStatus: "UNKNOWN", commercialUseStatus: "UNKNOWN", runtimeHealthReason: "UNKNOWN" }).valid, true);
  const invalid = { ...valid(), scenarioSupport: ["EVERYTHING"], inputModalities: ["AUDIO_REFERENCE"], routingPolicy: "LOWEST_PRICE", commercialUseStatus: "OPEN_SOURCE", costUnit: "FREE", priority: -1, runtimeEndpoint: "https://user:password@example.org" };
  const errors = validateModelDraft(invalid).errors;
  for (const key of ["scenarioSupport", "inputModalities", "routingPolicy", "commercialUseStatus", "costUnit", "priority", "runtimeEndpoint"]) assert.ok(errors[key], key);
});

test("confirmed commercial-use and cost claims require verifiable evidence", () => {
  const allowed = { ...valid(), commercialUseStatus: "CONFIRMED_ALLOWED", licenseId: "Example license", licenseUrl: "https://example.org/license", commercialUseEvidenceUrl: "https://example.org/terms/commercial-use" };
  assert.equal(validateModelDraft(allowed).valid, true, JSON.stringify(validateModelDraft(allowed).errors));
  const noLicenseEvidence = { ...allowed, commercialUseEvidenceUrl: "" };
  assert.ok(validateModelDraft(noLicenseEvidence).errors.commercialUseStatus);
  assert.ok(validateModelDraft({ ...allowed, licenseId: null }).errors.commercialUseStatus);
  const free = { ...valid(), costUnit: "GPU_SECOND", costPerUnit: "0", commercialCostStatus: "CONFIRMED_FREE", commercialCostEvidenceUrl: "https://example.org/pricing/free" };
  assert.equal(validateModelDraft(free).valid, true, JSON.stringify(validateModelDraft(free).errors));
  assert.ok(validateModelDraft({ ...free, costUnit: "UNKNOWN" }).errors.commercialCostStatus);
  assert.ok(validateModelDraft({ ...free, commercialCostEvidenceUrl: "" }).errors.commercialCostStatus);
  assert.ok(validateModelDraft({ ...free, costPerUnit: "1" }).errors.commercialCostStatus);
  const verified = { ...valid(), costUnit: "IMAGE", costPerUnit: "0.05", costCurrency: "USD", commercialCostStatus: "VERIFIED", commercialCostEvidenceUrl: "https://example.org/pricing/images" };
  assert.equal(validateModelDraft(verified).valid, true, JSON.stringify(validateModelDraft(verified).errors));
  assert.ok(validateModelDraft({ ...verified, costPerUnit: "" }).errors.commercialCostStatus);
  assert.ok(validateModelDraft({ ...verified, costCurrency: null }).errors.commercialCostStatus);
  assert.ok(validateModelDraft({ ...verified, commercialCostStatus: "UNKNOWN" }).errors.commercialCostStatus);
});
