import { routingAdvicePreviewData } from "./routingAdvicePreviewData.js";
import { USAGE_COST_DASHBOARD_FIXTURE } from "./usageCostDashboard.js";
import { parseAddModelFixtureParams } from "./addModelVisualState.js";

const VISUAL_FIXTURE_SESSION_KEY = "gso.aiVisualFixtures.v1";

const b01Models = [
  ["m01", "GPT-4o", "OpenAI", "多模态", "128K", 980.2, 2000, true, "正常", "P0", "2024-12-07 14:20"],
  ["m02", "Claude 3.5 Sonnet", "Anthropic", "多模态", "200K", 756.3, 1500, true, "正常", "P0", "2024-12-07 13:45"],
  ["m03", "Gemini 1.5 Pro", "Google", "多模态", "1M", 1240.5, 3000, true, "正常", "P1", "2024-12-07 12:30"],
  ["m04", "DeepSeek V3", "DeepSeek", "文本", "128K", 320.6, 1000, true, "正常", "P1", "2024-12-07 11:20"],
  ["m05", "Qwen Max", "阿里云", "多模态", "128K", 468.2, 500, true, "额度告警", "P1", "2024-12-07 10:15"],
  ["m06", "Azure OpenAI", "Azure", "多模态", "128K", 620.1, 1000, true, "正常", "P2", "2024-12-07 09:50"],
  ["m07", "GPT-4o mini", "OpenAI", "文本", "128K", 100, 1000, true, "正常", "P1", "2024-12-06 16:42"],
  ["m08", "Claude 3 Haiku", "Anthropic", "文本", "200K", 50, 500, true, "正常", "P2", "2024-12-06 14:12"],
  ["m09", "Gemini 1.5 Flash", "Google", "文本", "1M", 70, 800, true, "正常", "P2", "2024-12-06 12:08"],
  ["m10", "DeepSeek Coder", "DeepSeek", "代码", "64K", 0, 300, false, "不可用", "P3", "2024-12-05 18:25"],
  ["m11", "自定义模型 A", "其他", "文本", "128K", 44.3, 500, false, "已停用", "P2", "2024-12-05 15:30"],
  ["m12", "自定义模型 B", "其他", "多模态", "128K", 30, 400, false, "已停用", "P3", "2024-12-04 10:00"],
].map(([id, model, provider, type, context, used, quota, enabled, status, priority, updated]) => ({
  id, model, provider, type, context, used, quota, enabled, status, priority, updated,
  healthStatus: status === "额度告警" ? "DEGRADED" : status === "不可用" ? "UNAVAILABLE" : enabled ? "READY" : "DISABLED",
  currency: "CNY", __testFixture: true, __visualFixtureId: "VISUAL_QA_ONLY_771271_B01_v2",
  quotaSummary: { status: "KNOWN", total: quota, used, remaining: quota - used, currency: "CNY", source: "VISUAL_QA_ONLY" },
})).map((model, index) => ({ ...model,
  successRate: [99.2, 98.8, 99.6, 97.9, 94.1, 98.4, 99.4, 98.2, 99.1, 0, 96.8, 97.3][index],
  averageLatencyMs: [820, 1060, 740, 1280, 1560, 910, 650, 590, 680, null, 1440, 1620][index],
  requestCount: [28640, 19420, 25760, 28110, 17630, 18900, 13740, 8400, 12650, 7700, 5200, 3050][index],
}));

const overview = Object.freeze({
  providers: Object.freeze([{ name: "OpenAI", models: "6" }, { name: "Anthropic", models: "4" }, { name: "Google", models: "4" }, { name: "DeepSeek", models: "3" }, { name: "Alibaba Cloud", models: "4" }, { name: "Microsoft Azure", models: "3" }]),
  models: Object.freeze([{ name: "GPT-4o", provider: "OpenAI" }, { name: "Claude 3.5 Sonnet", provider: "Anthropic" }, { name: "Gemini 1.5 Pro", provider: "Google" }, { name: "DeepSeek V3", provider: "DeepSeek" }, { name: "Qwen Max", provider: "Alibaba Cloud" }]),
  snapshot: Object.freeze({
    today: Object.freeze({ label: "今日", dates: ["12-01", "12-02", "12-03", "12-04", "12-05", "12-06", "12-07"], requests: [34, 48, 39, 62, 76, 68, 65], success: [24, 31, 30, 43, 51, 46, 41] }),
    "7d": Object.freeze({ label: "近7天", dates: ["12-01", "12-02", "12-03", "12-04", "12-05", "12-06", "12-07"], requests: [28, 37, 48, 42, 69, 76, 65], success: [21, 29, 36, 32, 48, 52, 41] }),
    "30d": Object.freeze({ label: "近30天", dates: ["12-01", "12-02", "12-03", "12-04", "12-05", "12-06", "12-07"], requests: [22, 42, 37, 56, 63, 74, 69], success: [15, 28, 26, 39, 43, 49, 46] }),
  }),
  kpis: Object.freeze([
    { label: "模型总数", value: "24", note: "视觉样例", icon: "Cube", tone: "blue" }, { label: "已启用模型", value: "18", note: "视觉样例", icon: "Lightning", tone: "cyan" },
    { label: "Provider 数量", value: "6", note: "视觉样例", icon: "Pulse", tone: "violet" }, { label: "今日请求", value: "128,460", note: "视觉样例", icon: "Cube", tone: "blue" },
    { label: "连接测试", value: "—", note: "未连接真实服务", icon: "Pulse", tone: "teal" }, { label: "平均延迟", value: "—", note: "未连接真实服务", icon: "Clock", tone: "cyan" },
    { label: "今日成本", value: "未知", note: "未验证真实费率", icon: "Cube", tone: "violet" }, { label: "告警概况", value: "未知", note: "未读取真实告警", icon: "WarningCircle", tone: "red" },
  ]),
  sourceMix: Object.freeze([["电商平台", "38%"], ["独立站", "26%"], ["ERP 系统", "18%"], ["客服系统", "10%"], ["其他", "8%"]]),
  alertCount: 2,
  routingSummary: Object.freeze({ status: "待确认", executableCount: 0 }),
  costs: Object.freeze({ today: [18.4, 21.7, 19.9, 24.5, 28.1, 26.3, 31.2], "7d": [18.4, 21.7, 19.9, 24.5, 28.1, 26.3, 31.2], "30d": [18.4, 21.7, 19.9, 24.5, 28.1, 26.3, 31.2] }),
  usageSummary: Object.freeze({ requestCount: 128460, successCount: 121875, failureCount: 6585, knownCost: 2846.7, unknownCostCount: 17, monthlyCost: 84216.3, monthlyUnknownCostCount: 214, budget: { status: "VISUAL_QA_ONLY" } }),
});

const usageRecords = Object.freeze([
  { id: "req_visual_10482", time: "2026-10-01 13:42:08", provider: "OpenAI", model: "gpt-4o-mini", worker: "wrk_visual_01", runtime: "rt_visual_12", task: "task_visual_9341", status: "成功", input: 8240, output: 1940, tokens: 10180, cost: 0.0428, costState: "已知", currency: "USD", latency: "1.42 秒", source: "VISUAL_QA_ONLY", attempts: [{ provider: "OpenAI", model: "gpt-4o-mini", status: "成功", tokens: "10,180", cost: "$0.0428", latency: "1.42 秒" }] },
  { id: "req_visual_10481", time: "2026-10-01 13:37:24", provider: "DeepSeek", model: "deepseek-chat", worker: "wrk_visual_02", runtime: "rt_visual_08", task: "task_visual_9338", status: "成功", input: 15302, output: 4380, tokens: 19682, cost: 0.0181, costState: "已知", currency: "USD", latency: "2.06 秒", source: "VISUAL_QA_ONLY", attempts: [{ provider: "DeepSeek", model: "deepseek-chat", status: "成功", tokens: "19,682", cost: "$0.0181", latency: "2.06 秒" }] },
  { id: "req_visual_10480", time: "2026-10-01 13:29:16", provider: "Anthropic", model: "claude-sonnet-visual", worker: "wrk_visual_01", runtime: "rt_visual_15", task: "task_visual_9332", status: "重试后成功", input: 29710, output: 8252, tokens: 37962, cost: null, costState: "未知", currency: null, latency: "8.73 秒", source: "VISUAL_QA_ONLY", attempts: [{ provider: "Anthropic", model: "claude-sonnet-visual", status: "失败 · 已脱敏", tokens: "未知", cost: "未知", latency: "2.74 秒" }, { provider: "DeepSeek", model: "deepseek-chat", status: "成功", tokens: "37,962", cost: "未知", latency: "5.99 秒" }] },
  { id: "req_visual_10479", time: "2026-10-01 13:24:05", provider: "OpenAI", model: "gpt-4o", worker: "wrk_visual_03", runtime: "rt_visual_04", task: "task_visual_9329", status: "失败", input: null, output: null, tokens: null, cost: null, costState: "未知", currency: null, latency: "超时", source: "VISUAL_QA_ONLY", attempts: [{ provider: "OpenAI", model: "gpt-4o", status: "失败 · 已脱敏", tokens: "未知", cost: "未知", latency: "超时" }] },
  { id: "req_visual_10478", time: "2026-10-01 13:18:49", provider: "Google", model: "gemini-flash-visual", worker: "wrk_visual_02", runtime: "rt_visual_08", task: "task_visual_9322", status: "成功", input: 4260, output: 920, tokens: 5180, cost: 0.0067, costState: "已知", currency: "USD", latency: "0.94 秒", source: "VISUAL_QA_ONLY", attempts: [{ provider: "Google", model: "gemini-flash-visual", status: "成功", tokens: "5,180", cost: "$0.0067", latency: "0.94 秒" }] },
  { id: "req_visual_10477", time: "2026-10-01 13:12:10", provider: "DeepSeek", model: "deepseek-reasoner-visual", worker: "wrk_visual_04", runtime: "rt_visual_19", task: "task_visual_9316", status: "成功", input: 11820, output: 6094, tokens: 17914, cost: 0.0245, costState: "已知", currency: "USD", latency: "3.12 秒", source: "VISUAL_QA_ONLY", attempts: [{ provider: "DeepSeek", model: "deepseek-reasoner-visual", status: "成功", tokens: "17,914", cost: "$0.0245", latency: "3.12 秒" }] },
  { id: "req_visual_10476", time: "2026-10-01 12:58:33", provider: "OpenAI", model: "gpt-4o-mini", worker: "wrk_visual_01", runtime: "rt_visual_12", task: "task_visual_9307", status: "成功", input: 3418, output: 775, tokens: 4193, cost: 0.0039, costState: "已知", currency: "USD", latency: "0.81 秒", source: "VISUAL_QA_ONLY", attempts: [{ provider: "OpenAI", model: "gpt-4o-mini", status: "成功", tokens: "4,193", cost: "$0.0039", latency: "0.81 秒" }] },
  { id: "req_visual_10475", time: "2026-10-01 12:44:51", provider: "Other", model: "custom-visual-01", worker: "wrk_visual_03", runtime: "rt_visual_04", task: "task_visual_9299", status: "成功", input: null, output: null, tokens: null, cost: null, costState: "未知", currency: null, latency: "1.90 秒", source: "VISUAL_QA_ONLY", attempts: [{ provider: "Other", model: "custom-visual-01", status: "成功", tokens: "未知", cost: "未知", latency: "1.90 秒" }] },
]);

const aiVisualFixtureData = Object.freeze({
  modelQuota: Object.freeze({
    id: "VISUAL_QA_ONLY_771271_B01_v2", models: Object.freeze(b01Models), total: 12,
    summary: Object.freeze({ enabled: 9, healthy: 9, needsCheck: 2, unavailable: 1, providerCount: 6 }),
    referenceTopIds: Object.freeze(["m03", "m02", "m06", "m04", "m01"]),
    referenceProviderOrder: Object.freeze(["OpenAI", "Anthropic", "Google", "DeepSeek", "阿里云", "Azure", "其他"]),
    kpiTrends: Object.freeze([["↑ 33%", "较上月 +3"], ["↑ 28%", "较上月 +2"], ["↑ 20%", "较上月 +1"], ["↑ 25%", "较上月 +2,500"], ["↑ 24%", "较上月 +920.30"], ["↓ 50%", "较上月 -1"]]),
    trendChartMax: 8000,
    trendTooltip: Object.freeze({ date: "12-05", total: "6,000", used: "2,980" }),
    usage: Object.freeze({ state: "ready", trends: Object.freeze(Array.from({ length: 7 }, (_, index) => ({ date: `12-0${index + 1}`, time: `12-0${index + 1}`, totalAmount: [2600, 3400, 4100, 4900, 5600, 5900, 6000][index], usedAmount: [1500, 1900, 2100, 2450, 2800, 3000, 3400][index], totalQuota: [2600, 3400, 4100, 4900, 5600, 5900, 6000][index] }))), records: Object.freeze(usageRecords.slice(0, 4)) }),
    usagePeriods: Object.freeze({
      month: Object.freeze(Array.from({ length: 6 }, (_, index) => ({ time: `第 ${index + 1} 周`, totalQuota: [3400, 4100, 4900, 5600, 5900, 6000][index], usedAmount: [1900, 2100, 2450, 2800, 3000, 3400][index] }))),
      quarter: Object.freeze(Array.from({ length: 3 }, (_, index) => ({ time: ["第 1 月", "第 2 月", "当前"][index], totalQuota: [3600, 5000, 6200][index], usedAmount: [1900, 2600, 3500][index] }))),
      halfYear: Object.freeze(Array.from({ length: 6 }, (_, index) => ({ time: `${index + 1}月`, totalQuota: [1800, 2500, 3300, 4100, 5100, 6200][index], usedAmount: [900, 1300, 1700, 2200, 2800, 3500][index] }))),
    }),
    activity: Object.freeze([
      { event_id: "visual-event-1", event_type: "ai_model.created", model_id: "m05", model_name: "Qwen Max", occurred_at: "2024-12-07T10:15:00Z", actor: "Admin" },
      { event_id: "visual-event-2", event_type: "ai_model.updated", model_id: "m01", model_name: "GPT-4o", occurred_at: "2024-12-07T09:42:00Z", actor: "Admin" },
      { event_id: "visual-event-3", event_type: "ai_model.quota_alert", model_id: "m05", model_name: "Qwen Max", occurred_at: "2024-12-07T09:20:00Z", actor: "系统通知" },
      { event_id: "visual-event-4", event_type: "ai_model.enabled", model_id: "m04", model_name: "DeepSeek V3", occurred_at: "2024-12-07T08:55:00Z", actor: "Admin" },
      { event_id: "visual-event-5", event_type: "ai_model.updated", model_id: "m03", model_name: "Gemini 1.5 Pro", occurred_at: "2024-12-06T16:42:00Z", actor: "管理员" },
      { event_id: "visual-event-6", event_type: "ai_model.disabled", model_id: "m10", model_name: "DeepSeek Coder", occurred_at: "2024-12-06T15:30:00Z", actor: "管理员" },
      { event_id: "visual-event-7", event_type: "ai_model.draft_saved", model_id: "m06", model_name: "Azure OpenAI", occurred_at: "2024-12-06T14:18:00Z", actor: "管理员" },
      { event_id: "visual-event-8", event_type: "ai_model.created", model_id: "m08", model_name: "Claude 3 Haiku", occurred_at: "2024-12-06T13:05:00Z", actor: "管理员" },
      { event_id: "visual-event-9", event_type: "ai_model.quota_alert", model_id: "m03", model_name: "Gemini 1.5 Pro", occurred_at: "2024-12-05T11:44:00Z", actor: "系统通知" },
      { event_id: "visual-event-10", event_type: "ai_model.restored", model_id: "m09", model_name: "Gemini 1.5 Flash", occurred_at: "2024-12-05T09:12:00Z", actor: "管理员" },
    ]),
  }),
  overview,
  usage: Object.freeze({ records: usageRecords, dashboard: USAGE_COST_DASHBOARD_FIXTURE }),
  routingAdvice: Object.freeze({ recommendations: routingAdvicePreviewData }),
  addModel: Object.freeze({
    vendorId: "OPENAI", modelId: "gpt-5", displayName: "GPT-5", identityMode: "OFFICIAL",
    modelPreview: Object.freeze({ category: "多模态", contextWindow: "256K", maxOutput: "32K", releaseDate: "2025-08-07", website: "https://openai.com", description: "GPT-5 是 OpenAI 的多模态大模型，支持推理、代码、工具调用与复杂任务处理。此处内容仅用于本地视觉预览，能力和运行状态以真实 Provider / Registry 读回为准。", tags: Object.freeze(["多模态", "强大推理", "代码能力", "工具调用", "图像理解", "音频理解", "视频理解", "企业级应用"]) }),
    accessProvider: "fixture-openai-access", accessProviderName: "OpenAI Platform（合成预览）",
    secretRef: "secret://visual-fixture/credential-placeholder", baseUrl: "https://api.example.invalid/v1",
    connectionType: "OPENAI_COMPATIBLE", authType: "API_KEY", deploymentType: "PUBLIC_CLOUD", region: "AUTO",
    advancedConnection: Object.freeze({ timeout: 60, retry: 3, healthPath: "/models", healthInterval: 300 }),
    capabilities: Object.freeze(["TEXT_GENERATION", "STRUCTURED_OUTPUT", "TOOL_CALLING", "IMAGE_UNDERSTANDING", "OCR", "IMAGE_GENERATION", "STT", "TTS"]),
    capabilityStatus: Object.freeze({ TEXT_GENERATION: "ENABLED", STRUCTURED_OUTPUT: "ENABLED", TOOL_CALLING: "ENABLED", RPA_PLANNER_TOOL_CALLING: "UNAVAILABLE", IMAGE_UNDERSTANDING: "ENABLED", OCR: "ENABLED", DOCUMENT_UNDERSTANDING: "AVAILABLE", IMAGE_GENERATION: "ENABLED", IMAGE_EDIT: "AVAILABLE", VIDEO_GENERATION: "AVAILABLE", VIDEO_UNDERSTANDING: "UNKNOWN", VIDEO_EDIT: "UNAVAILABLE", IMAGE_TO_VIDEO: "AVAILABLE", STT: "ENABLED", TTS: "ENABLED", VOICE_CLONE: "AVAILABLE", REALTIME_VOICE: "AVAILABLE", SENTIMENT_ANALYSIS: "AVAILABLE", NEXT_BEST_ACTION: "UNAVAILABLE", LIP_SYNC: "AVAILABLE", PORTRAIT_ANIMATION: "AVAILABLE" }),
    inputModalities: Object.freeze(["TEXT", "IMAGE", "AUDIO"]), outputModalities: Object.freeze(["TEXT", "JSON", "AUDIO"]),
    quota: Object.freeze({ rpm: 1200, tpm: 200000, maxConcurrency: 50, dailyQuota: 10000000, monthlyQuota: 300000000 }),
    costs: Object.freeze({ INPUT_TOKEN: "0.0005", OUTPUT_TOKEN: "0.0015", REQUEST: "0.012", IMAGE: "0.04", VIDEO_SECOND: "0.08", AUDIO_SECOND: "0.006", GPU_SECOND: "0.00034", GPU_MINUTE: "0.02", JOB: "0.1" }),
    routing: Object.freeze({ priority: 1, weight: 40, strategy: "CHEAPEST_QUALIFIED", fallbackModelId: "m01", healthCheck: true, healthThreshold: 70, scenarioBinding: Object.freeze(["RPA", "CONTENT_CREATION"]) }),
  }),
});

export function isAiVisualFixtureMode() {
  if (import.meta.env?.DEV !== true || typeof window === "undefined") return false;
  const query = new URLSearchParams(window.location.search);
  const queryEnabled = query.get("aiVisualFixture") === "1" || query.get("aiVisualFixtures") === "1" || query.get("aiModelFixtures") === "1";
  try {
    if (queryEnabled) window.sessionStorage.setItem(VISUAL_FIXTURE_SESSION_KEY, "1");
    return queryEnabled || window.sessionStorage.getItem(VISUAL_FIXTURE_SESSION_KEY) === "1";
  } catch {
    return queryEnabled;
  }
}

export function getAiVisualFixtureData(page) {
  if (!isAiVisualFixtureMode()) return null;
  const base = aiVisualFixtureData[page] || null;
  if (page !== "addModel" || !base) return base;
  const requested = parseAddModelFixtureParams(window.location.search).connectionState;
  const required = ["Credential Validation", "Endpoint Connectivity", "Authentication", "Model Discovery", "Selected Model Exists", "Minimal Inference", "Capability Validation", "Latency"];
  const state = String(requested || "").toLowerCase();
  if (!["idle", "testing", "success", "failure", "timeout", "auth", "rate-limit"].includes(state)) return base;
  const healthByState = { idle: "UNTESTED", testing: "TESTING", success: "READY", failure: "DEGRADED", timeout: "TIMEOUT", auth: "AUTH_ERROR", "rate-limit": "RATE_LIMITED" };
  const failingCheck = { failure: "Minimal Inference", timeout: "Endpoint Connectivity", auth: "Authentication", "rate-limit": "Endpoint Connectivity" }[state];
  const checks = state === "idle" ? [] : required.map((name, index) => {
    let status = state === "success" ? "PASS" : "NOT_CHECKED";
    if (state === "testing") status = index === 0 ? "PASS" : index === 1 ? "TESTING" : "NOT_CHECKED";
    if (failingCheck === name) status = state === "timeout" ? "TIMEOUT" : state === "rate-limit" ? "RATE_LIMITED" : "FAIL";
    if (failingCheck && index < required.indexOf(failingCheck)) status = "PASS";
    return { name, status, message: status === "PASS" ? "检查完成" : status === "TESTING" ? "正在执行检查" : status === "NOT_CHECKED" ? "尚未执行" : "服务端检查未通过" };
  });
  const messageByState = {
    idle: "尚未执行连接测试。测试结果只会在真实服务端验证后更新。",
    testing: "正在依次验证凭据、端点、认证、模型发现、推理能力与延迟。",
    success: "连接正常 · 八项健康检查全部通过。",
    failure: "连接测试未通过 · 最小推理检查失败，可检查配置后重试。",
    timeout: "连接超时 · 端点未在设定时间内响应。",
    auth: "认证失败 · 请检查 Secret Store 引用和认证类型。",
    "rate-limit": "请求受限 · Provider 返回频率限制状态。",
  };
  return { ...base, connectionState: state, connectionHealth: healthByState[state], connectionChecks: checks, connectionMessage: messageByState[state] };
}

export function disableAiVisualFixtureMode() {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.removeItem(VISUAL_FIXTURE_SESSION_KEY); } catch {}
  const next = new URL(window.location.href);
  next.searchParams.delete("aiVisualFixture");
  next.searchParams.delete("aiVisualFixtures");
  next.searchParams.delete("aiModelFixtures");
  window.location.assign(`${next.pathname}${next.search}${next.hash}`);
}

