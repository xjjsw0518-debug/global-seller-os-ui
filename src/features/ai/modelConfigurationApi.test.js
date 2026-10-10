import test from "node:test";
import assert from "node:assert/strict";
import { buildAiModelConfigurationRequest, saveAiModelConfiguration, projectRegistryCosts, modelConfigurationSaveTimeoutMs } from "./modelConfigurationApi.js";

const payload = () => ({
  model: {
    model_id: "test-model-v1",
    display_name: "Test Model",
    model_vendor: "CUSTOM",
    model_identity_type: "PRIVATE",
    input_modalities: ["TEXT"],
    output_modalities: ["TEXT"],
    capabilities: ["TEXT_GENERATION"],
    capability_sources: { TEXT_GENERATION: "MANUAL_USER_SUPPLEMENT" },
  },
  connection: {
    access_provider_id: "provider-test-id",
    secret_ref: "secret://test/provider",
    endpoint_mode: "MANUAL",
    base_url: "https://staging.example.test/v1",
    connection_type: "OPENAI_COMPATIBLE",
    auth_type: "API_KEY",
    deployment_type: "PRIVATE_ENDPOINT",
    region: "APAC",
    custom_headers: [{ name: "Authorization", secret_ref: "secret://test/provider" }],
    custom_query_params: [],
    timeout_seconds: 30,
    retry_count: 2,
    health_check_path: "/health",
    health_check_interval_seconds: 120,
  },
  quota_settings: { rpm: 60, tpm: 10000, max_concurrency: 4, daily_quota: null, monthly_quota: 100000 },
  cost_registry: { INPUT_TOKEN: null, OUTPUT_TOKEN: 0, REQUEST: null, IMAGE: null, VIDEO_SECOND: null, AUDIO_SECOND: null, GPU_SECOND: null, GPU_MINUTE: null, JOB: null },
  routing_strategy: { route_priority: 1, route_weight: 100, fallback_model_id: null, health_check_enabled: true, scenario_binding: ["GENERAL"], cost_strategy: "BALANCED" },
});

test("save deadline releases a stalled POST without automatically retrying", async () => {
  let calls = 0;
  let signal;
  await assert.rejects(saveAiModelConfiguration(payload(), {
    timeoutMs: 20,
    fetcher: async (_, options) => { calls += 1; signal = options.signal; return new Promise(() => {}); },
  }), { code: "AI_MODEL_SAVE_TIMEOUT" });
  assert.equal(calls, 1);
  assert.equal(signal.aborted, true);
});

test("late POST completion after timeout cannot start readback", async () => {
  let finish;
  let calls = 0;
  await assert.rejects(saveAiModelConfiguration(payload(), {
    timeoutMs: 20,
    fetcher: async () => { calls += 1; return new Promise(resolve => { finish = resolve; }); },
  }), { code: "AI_MODEL_SAVE_TIMEOUT" });
  finish(jsonResponse({ ...payload(), id: "late-save", enabled: false }));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 1);
});

test("save deadline includes mandatory readback and never reports success on timeout", async () => {
  const signals = [];
  await assert.rejects(saveAiModelConfiguration(payload(), {
    timeoutMs: 20,
    fetcher: async (_, options) => {
      signals.push(options.signal);
      return options.method === "POST" ? jsonResponse({ id: "readback-stalled" }) : new Promise(() => {});
    },
  }), { code: "AI_MODEL_SAVE_TIMEOUT" });
  assert.equal(signals.length, 2);
  assert.equal(signals[0], signals[1]);
  assert.equal(signals[1].aborted, true);
});

test("save deadline covers stalled JSON decoding", async () => {
  await assert.rejects(saveAiModelConfiguration(payload(), {
    timeoutMs: 20,
    fetcher: async () => ({ ok: true, json: () => new Promise(() => {}) }),
  }), { code: "AI_MODEL_SAVE_TIMEOUT" });
});

test("HTTP failures preserve their error code and allow a separate explicit retry", async () => {
  let calls = 0;
  const request = payload();
  const fetcher = async () => {
    calls += 1;
    if (calls === 1) return { ok: false, status: 503, json: async () => ({ code: "AI_SAVE_UNAVAILABLE" }) };
    return jsonResponse({ ...request, id: "explicit-retry", enabled: false });
  };
  await assert.rejects(saveAiModelConfiguration(request, { fetcher }), { code: "AI_SAVE_UNAVAILABLE" });
  assert.equal(calls, 1);
  assert.equal((await saveAiModelConfiguration(request, { fetcher })).dbReadback, true);
  assert.equal(calls, 3);
});

test("successful save clears its deadline and does not later abort its requests", async () => {
  let signal;
  const request = payload();
  await saveAiModelConfiguration(request, { timeoutMs: 20, fetcher: async (_, options) => {
    signal = options.signal;
    return jsonResponse({ ...request, id: "on-time", enabled: false });
  } });
  await new Promise(resolve => setTimeout(resolve, 35));
  assert.equal(signal.aborted, false);
});

test("invalid save deadlines fail before network activity", async () => {
  let calls = 0;
  for (const timeoutMs of [0, -1, Infinity, NaN, "30"]) {
    await assert.rejects(saveAiModelConfiguration(payload(), { timeoutMs, fetcher: async () => { calls += 1; } }), TypeError);
  }
  assert.equal(calls, 0);
});

test("enable deadline budgets configured server connection stages instead of using the draft limit", () => {
  assert.equal(modelConfigurationSaveTimeoutMs(payload()), 30_000);
  assert.equal(modelConfigurationSaveTimeoutMs(payload(), true), 300_000);
  assert.equal(modelConfigurationSaveTimeoutMs({ connection: { timeout_seconds: 1, retry_count: 0 } }, true), 33_000);
  assert.equal(modelConfigurationSaveTimeoutMs({ connection: { timeout_seconds: 300, retry_count: 5 } }, true), 5_430_000);
});

test("invalid enable timeout settings use bounded defaults while backend validation stays authoritative", () => {
  for (const connection of [{}, { timeout_seconds: Infinity, retry_count: -1 }, { timeout_seconds: "30", retry_count: 99 }]) {
    assert.equal(modelConfigurationSaveTimeoutMs({ connection }, true), 300_000);
  }
});

const jsonResponse = (data) => new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });

test("real request builder rejects invalid routing weights, priorities, scenarios and strategies", () => {
  const args = { form:{modelId:"test",displayName:"Test",modelVendor:"CUSTOM",modelIdentityType:"CUSTOM",capabilities:[],inputModalities:[],outputModalities:[],endpointMode:"AUTO"}, accessProvider:"test", secretRef:"secret://test/reference", advancedConnection:{authType:"API_KEY"}, customHeaders:[],customParams:[],quota:{},costs:{},routing:{priority:1,weight:100,scenarioBinding:["GENERAL"],costStrategy:"BALANCED"} };
  for(const change of [{weight:101},{weight:-1},{priority:0},{priority:1.5},{scenarioBinding:["UNREGISTERED"]},{costStrategy:"UNREGISTERED"},{triggerCondition:"UNREGISTERED"},{healthThreshold:49},{healthThreshold:101},{healthThreshold:NaN},{autoRouting:"false"}]) {
    assert.throws(()=>buildAiModelConfigurationRequest({...args,routing:{...args.routing,...change}}),TypeError);
  }
  assert.equal(buildAiModelConfigurationRequest({...args,routing:{...args.routing,weight:0}}).routing_strategy.route_weight,0);
  const savedRouting = buildAiModelConfigurationRequest({...args,routing:{...args.routing,triggerCondition:"MANUAL_ONLY",healthThreshold:50,autoRouting:false}}).routing_strategy;
  assert.equal(savedRouting.trigger_condition,"MANUAL_ONLY");
  assert.equal(savedRouting.health_threshold,50);
  assert.equal(savedRouting.auto_routing,false);
  const defaults = buildAiModelConfigurationRequest(args).routing_strategy;
  assert.equal(defaults.trigger_condition,"HEALTH_OR_LIMIT");
  assert.equal(defaults.health_threshold,80);
  assert.equal(defaults.auto_routing,true);
});

test("registry pricing converts frozen per-thousand token rates to per-million without inventing unknown prices", () => {
  assert.deepEqual(projectRegistryCosts({INPUT_TOKEN:0.002,OUTPUT_TOKEN:0}),{input_cost_per_million_tokens:2,output_cost_per_million_tokens:0,currency:"USD"});
  assert.deepEqual(projectRegistryCosts({INPUT_TOKEN:null,OUTPUT_TOKEN:null}),{input_cost_per_million_tokens:null,output_cost_per_million_tokens:null,currency:null});
  assert.deepEqual(projectRegistryCosts({}, {input_cost_per_million_tokens:3,currency:"EUR"}),{input_cost_per_million_tokens:3,output_cost_per_million_tokens:null,currency:"EUR"});
  assert.throws(()=>projectRegistryCosts({INPUT_TOKEN:Number.MAX_VALUE}),/finite/);
});

test("keeps capability provenance scoped to the capabilities selected for this model", () => {
  const request = buildAiModelConfigurationRequest({
    form: { modelId: "test-model-v1", displayName: "Test Model", modelVendor: "CUSTOM", modelIdentityType: "PRIVATE", capabilities: ["TEXT_GENERATION"], inputModalities: ["TEXT"], outputModalities: ["TEXT"], endpointMode: "MANUAL", manualBaseUrl: "https://staging.example.test/v1" },
    accessProvider: "provider-test-id", secretRef: "secret://test/provider",
    advancedConnection: { authType: "API_KEY", connectionType: "OPENAI_COMPATIBLE", deploymentType: "PRIVATE_ENDPOINT", timeout: 30, retry: 2, healthPath: "/health", healthInterval: 120 },
    customHeaders: [], customParams: [], quota: { rpm: "", tpm: "", maxConcurrency: "", dailyQuota: "", monthlyQuota: "" },
    costs: { INPUT_TOKEN: "", OUTPUT_TOKEN: "" }, routing: { priority: 1, weight: 100, fallbackModelId: "", healthCheck: true, scenarioBinding: ["GENERAL"], costStrategy: "BALANCED" },
    capabilitySources: { TEXT_GENERATION: "PROVIDER_MINIMAL_INFERENCE_VALIDATION", IMAGE_GENERATION: "PROVIDER_REGISTRY" },
  });
  assert.deepEqual(request.model.capability_sources, { TEXT_GENERATION: "PROVIDER_MINIMAL_INFERENCE_VALIDATION" });
});

test("uses same-origin session credentials and requires exact v2 readback", async () => {
  const request = payload();
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    if (options.method === "POST") return jsonResponse({ ...request, id: "staging-model-1", enabled: false });
    return jsonResponse({ ...request, id: "staging-model-1", enabled: false });
  };

  const result = await saveAiModelConfiguration(request, { fetcher });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.credentials, "same-origin");
  assert.equal(calls[0].url, "/api/v1/ai-model-configurations/draft");
  assert.equal(calls[1].url, "/api/v1/ai-model-configurations/staging-model-1");
  assert.equal(result.dbReadback, true);
  assert.equal(result.enabled, false);
  assert.equal(Object.hasOwn(result.model.connection, "secret_ref"), false);
  assert.deepEqual(JSON.parse(calls[0].options.body), request);
});

test("selects enable endpoint and verifies enabled readback", async () => {
  const request = payload();
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    return jsonResponse({ ...request, id: "staging-model-2", enabled: true });
  };

  const result = await saveAiModelConfiguration(request, { enable: true, fetcher });

  assert.equal(calls[0].url, "/api/v1/ai-model-configurations/enable");
  assert.equal(result.enabled, true);
  assert.equal(result.model.enabled, true);
});

test("refuses plaintext credential-shaped request fields before network access", async () => {
  const request = payload();
  request.connection.api_key = "TEST_ONLY_NOT_A_REAL_SECRET";
  let calls = 0;
  await assert.rejects(
    saveAiModelConfiguration(request, { fetcher: async () => { calls += 1; } }),
    { code: "AI_MODEL_SECRET_LEAK_REJECTED" },
  );
  assert.equal(calls, 0);
});

test("rejects a readback that contains plaintext credential fields", async () => {
  const request = payload();
  const fetcher = async (url, options) => {
    const response = { ...request, id: "staging-model-3", enabled: false };
    if (options.method === "GET") response.connection.secret_value = "TEST_ONLY_NOT_A_REAL_SECRET";
    return jsonResponse(response);
  };

  await assert.rejects(
    saveAiModelConfiguration(request, { fetcher }),
    { code: "AI_MODEL_SECRET_LEAK_REJECTED" },
  );
});

test("rejects sensitive custom header values unless represented by secret_ref", async () => {
  const request = payload();
  request.connection.custom_headers = [{ name: "Authorization", value: "TEST_ONLY_NOT_A_REAL_SECRET" }];
  let calls = 0;
  await assert.rejects(
    saveAiModelConfiguration(request, { fetcher: async () => { calls += 1; } }),
    { code: "AI_MODEL_SECRET_LEAK_REJECTED" },
  );
  assert.equal(calls, 0);
});

test('connection test and save share safe parameter projection', async () => {
  const { projectConnectionParameters } = await import('./modelConfigurationApi.js');
  const projected = projectConnectionParameters([{name:'X-QA',value:'safe'},{name:'Authorization',value:'DUMMY_PRIVATE_INPUT'},{name:'Cookie',value:'DUMMY_PRIVATE_INPUT'},{name:'',value:''}], 'secret://test/provider');
  assert.deepEqual(projected, [{name:'X-QA',value:'safe'},{name:'Authorization',secret_ref:'secret://test/provider'},{name:'Cookie',secret_ref:'secret://test/provider'}]);
  assert.equal(JSON.stringify(projected).includes('DUMMY_PRIVATE_INPUT'), false);
});
