import { createAiLogoAssetAdapter } from "./modelLogoReferenceContract.js";
import { AI_MODEL_OPERATIONS_ENDPOINT, AI_MODEL_OPERATIONS_PAGE_SIZE, mapAiModelOperationPage } from "./modelOperationsReadContract.js";
import { aiModelOperationsApi, createAiModelOperationsReadTransport } from "./aiModelOperationsApi.js";
import { getAiVisualFixtureData, isAiVisualFixtureMode } from "./aiVisualFixtureRuntime.js";
import {
  USAGE_COST_ENDPOINTS,
  USAGE_COST_PAGE_SIZE_DEFAULT,
  USAGE_COST_PAGE_SIZE_MAX,
  buildUsageCostQuery,
  mapUsageCostBreakdowns,
  mapUsageCostCsv,
  mapUsageCostDetail,
  mapUsageCostRecords,
  mapUsageCostSummary,
  mapUsageCostTrends,
} from "./usageCostReadContract.js";

const initialModels = [
  { id: "m01", model: "GPT-4o", provider: "OpenAI", type: "多模态", context: "128K", used: 980.2, quota: 2000, enabled: true, status: "待测试", priority: "P0", updated: "2024-12-07 14:20" },
  { id: "m02", model: "Claude 3.5 Sonnet", provider: "Anthropic", type: "多模态", context: "200K", used: 756.3, quota: 1500, enabled: true, status: "待测试", priority: "P0", updated: "2024-12-07 13:45" },
  { id: "m03", model: "Gemini 1.5 Pro", provider: "Google", type: "多模态", context: "1M", used: 1240.5, quota: 3000, enabled: true, status: "待测试", priority: "P1", updated: "2024-12-07 12:30" },
  { id: "m04", model: "DeepSeek V3", provider: "DeepSeek", type: "文本", context: "128K", used: 320.6, quota: 1000, enabled: true, status: "待测试", priority: "P1", updated: "2024-12-07 11:20" },
  { id: "m05", model: "Qwen Max", provider: "Alibaba Cloud", type: "多模态", context: "128K", used: 468.2, quota: 500, enabled: true, status: "额度告警", priority: "P1", updated: "2024-12-07 10:15" },
  { id: "m06", model: "Azure OpenAI", provider: "Microsoft Azure", type: "多模态", context: "128K", used: 620.1, quota: 1000, enabled: true, status: "待测试", priority: "P2", updated: "2024-12-07 09:50" },
  { id: "m07", model: "GPT-4o mini", provider: "OpenAI", type: "文本", context: "128K", used: 100, quota: 1000, enabled: true, status: "待测试", priority: "P1", updated: "2024-12-06 16:42" },
  { id: "m08", model: "Claude 3 Haiku", provider: "Anthropic", type: "文本", context: "200K", used: 50, quota: 500, enabled: true, status: "待测试", priority: "P2", updated: "2024-12-06 14:12" },
  { id: "m09", model: "Gemini 1.5 Flash", provider: "Google", type: "多模态", context: "1M", used: 70, quota: 800, enabled: true, status: "待测试", priority: "P2", updated: "2024-12-06 12:08" },
  { id: "m10", model: "DeepSeek Coder", provider: "DeepSeek", type: "代码", context: "64K", used: 0, quota: 300, enabled: false, status: "已停用", priority: "P3", updated: "2024-12-05 18:25" },
  { id: "m11", model: "自定义模型 A", provider: "其他", type: "文本", context: "128K", used: 44.3, quota: 500, enabled: false, status: "已停用", priority: "P2", updated: "2024-12-05 15:30" },
  { id: "m12", model: "自定义模型 B", provider: "其他", type: "多模态", context: "128K", used: 30, quota: 400, enabled: false, status: "已停用", priority: "P3", updated: "2024-12-04 10:00" },
];

// Contract seam: isolated in-memory preview only; it never stores API credentials or contacts providers.
const createdModels = [];
const archivedModels = [];
const aiLogoAssetAdapter = createAiLogoAssetAdapter();
let aiModelOperationsReadTransport = null;
let aiModelOperationsReadTransportConfigured = false;
const previewSearch = () => typeof window === "undefined" ? "" : window.location?.search || "";
const explicitDevFixtureMode = () => isAiVisualFixtureMode();
const hasBrowserOrigin = () => typeof window !== "undefined" && /^https?:\/\//i.test(String(window.location?.origin || ""));
const defaultAiModelOperationsReadTransport = hasBrowserOrigin() && !explicitDevFixtureMode() ? createAiModelOperationsReadTransport() : null;
const usesLiveAiModelOperationsApi = () => !aiModelOperationsReadTransportConfigured && Boolean(defaultAiModelOperationsReadTransport);
const fixtureBoundaryAllowed = () => !hasBrowserOrigin() || explicitDevFixtureMode();
function blockVisualFixtureWrite() {
  if (!isAiVisualFixtureMode()) return;
  const error = new Error("AI_VISUAL_FIXTURE_READ_ONLY");
  error.code = "AI_VISUAL_FIXTURE_READ_ONLY";
  error.source = "LOCAL_VISUAL_FIXTURE";
  error.productionVerified = false;
  throw error;
}

// The seam accepts an explicitly supplied read-only transport. It deliberately
// creates no fetch client, credentials, or network connection on its own.
export function configureAiModelOperationsReadTransport(transport = null) {
  if (transport !== null && (typeof transport !== "object" || typeof transport.get !== "function")) {
    throw new TypeError("AI model operations read transport must expose get() or be null.");
  }
  aiModelOperationsReadTransport = transport;
  aiModelOperationsReadTransportConfigured = true;
}

export function getAiModelOperationsReadStatus() {
  if (usesLiveAiModelOperationsApi()) return { state: "SAME_ORIGIN_STAGING_API", endpoint: AI_MODEL_OPERATIONS_ENDPOINT, mutationsAvailable: true, productionVerified: false };
  if (aiModelOperationsReadTransport) return { state: "READ_TRANSPORT_INJECTED", endpoint: AI_MODEL_OPERATIONS_ENDPOINT, mutationsAvailable: false, productionVerified: false };
  return { state: fixtureBoundaryAllowed() ? "TEST_FIXTURE_ONLY" : "NOT_CONNECTED", endpoint: AI_MODEL_OPERATIONS_ENDPOINT, mutationsAvailable: false, productionVerified: false };
}

function requireUsageCostReadTransport() {
  if (aiModelOperationsReadTransport) return aiModelOperationsReadTransport;
  const error = new Error("Usage-cost read transport is not connected.");
  error.code = "AI_USAGE_COST_READ_NOT_CONNECTED";
  error.source = "NOT_CONNECTED";
  error.productionVerified = false;
  throw error;
}

async function readUsageCost(endpoint, query, responseType) {
  const transport = requireUsageCostReadTransport();
  try {
    return await transport.get(endpoint, { query, ...(responseType ? { responseType } : {}) });
  } catch (cause) {
    const error = new Error("Usage-cost read failed.");
    error.code = typeof cause?.code === "string" ? cause.code : "AI_USAGE_COST_READ_FAILED";
    error.source = "INJECTED_READ_TRANSPORT";
    error.productionVerified = false;
    throw error;
  }
}

// Optional local-only E2E counters: they retain counts and a boolean only, never key contents.
const recordMockCall = (operation, config) => {
  const preview = new URLSearchParams(previewSearch());
  if (import.meta.env?.DEV !== true || preview.get("mockDiagnostics") !== "1") return;
  const diagnostics = window.__aiMockDiagnostics || { calls: {}, rawApiKeyPassed: false };
  diagnostics.calls[operation] = (diagnostics.calls[operation] || 0) + 1;
  diagnostics.rawApiKeyPassed = diagnostics.rawApiKeyPassed || Object.prototype.hasOwnProperty.call(config || {}, "apiKey");
  window.__aiMockDiagnostics = diagnostics;
};
export const modelQuotaAdapter = {
  async getUsageCostSummary(filters = {}) {
    return mapUsageCostSummary(await readUsageCost(USAGE_COST_ENDPOINTS.summary, buildUsageCostQuery(filters)));
  },
  async getUsageCostTrends(filters = {}) {
    return mapUsageCostTrends(await readUsageCost(USAGE_COST_ENDPOINTS.trends, buildUsageCostQuery(filters)));
  },
  async getUsageCostBreakdowns(filters = {}) {
    return mapUsageCostBreakdowns(await readUsageCost(USAGE_COST_ENDPOINTS.breakdowns, buildUsageCostQuery(filters)));
  },
  async getUsageCostRecords(filters = {}) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? USAGE_COST_PAGE_SIZE_DEFAULT;
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > USAGE_COST_PAGE_SIZE_MAX) {
      const error = new Error("Usage-cost pagination requires page >= 1 and pageSize from 1 to 100.");
      error.code = "AI_USAGE_COST_BAD_PAGINATION";
      error.source = "LOCAL_READ_VALIDATION";
      error.productionVerified = false;
      throw error;
    }
    const query = { ...buildUsageCostQuery(filters), page, page_size: pageSize };
    return mapUsageCostRecords(await readUsageCost(USAGE_COST_ENDPOINTS.records, query));
  },
  async getUsageCostRecordDetail(requestId) {
    if (typeof requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
      const error = new Error("A UUID request ID is required for usage-cost detail.");
      error.code = "AI_USAGE_COST_BAD_REQUEST_ID";
      error.source = "LOCAL_READ_VALIDATION";
      error.productionVerified = false;
      throw error;
    }
    return mapUsageCostDetail(await readUsageCost(`${USAGE_COST_ENDPOINTS.detail}${encodeURIComponent(requestId)}`, {}));
  },
  async exportUsageCostCsv(filters = {}) {
    const value = await readUsageCost(USAGE_COST_ENDPOINTS.exportCsv, buildUsageCostQuery(filters), "text");
    return mapUsageCostCsv(value);
  },
  async uploadLogoAsset(file) {
    blockVisualFixtureWrite();
    recordMockCall("uploadLogoAsset", { fileType: file?.type, fileSize: file?.size });
    return aiLogoAssetAdapter.upload(file);
  },
  async list(options = {}) {
    if (isAiVisualFixtureMode()) {
      const fixture = getAiVisualFixtureData("modelQuota");
      return {
        items: [...(fixture?.models || [])], total: fixture?.total || 0, demo: true,
        source: "VISUAL_QA_ONLY", readMode: "LOCAL_VISUAL_FIXTURE", writeMode: "DISABLED",
        summary: { visualFixtureId: fixture?.id, ...fixture?.summary },
      };
    }
    if (usesLiveAiModelOperationsApi()) {
      const page = options.page ?? 1;
      const pageSize = options.pageSize ?? 100;
      return aiModelOperationsApi.list({ page, pageSize, search: options.search });
    }
    if (aiModelOperationsReadTransport) {
      const page = options.page ?? 1;
      const pageSize = options.pageSize ?? AI_MODEL_OPERATIONS_PAGE_SIZE;
      if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < AI_MODEL_OPERATIONS_PAGE_SIZE || pageSize > 100) {
        const error = new Error("AI model operations page must be >= 1 and pageSize must be between 20 and 100.");
        error.code = "AI_MODEL_OPERATIONS_INVALID_PAGINATION";
        throw error;
      }
      let dto;
      try {
        dto = await aiModelOperationsReadTransport.get(AI_MODEL_OPERATIONS_ENDPOINT, {
          query: { page, page_size: pageSize, ...(options.search ? { search: String(options.search) } : {}) },
        });
      } catch (error) {
        if (error && typeof error === "object") {
          error.source = "INJECTED_READ_TRANSPORT";
          error.productionVerified = false;
        }
        throw error;
      }
      return { ...mapAiModelOperationPage(dto), demo: false, readMode: "INJECTED_READ_ONLY", writeMode: "LOCAL_MOCK", productionVerified: false };
    }
    if (!fixtureBoundaryAllowed()) {
      const error = new Error("AI_MODEL_OPERATIONS_API_NOT_CONNECTED");
      error.code = "AI_MODEL_OPERATIONS_API_NOT_CONNECTED";
      error.source = "NOT_CONNECTED";
      error.productionVerified = false;
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 180));
    const preview = new URLSearchParams(previewSearch());
    if (preview.get("mockFailure") === "1") { const error = new Error("Preview-only simulated adapter failure"); error.code = "MOCK_LIST_FAILED"; error.mock = true; throw error; }
    const items = [...initialModels, ...createdModels].map((item) => ({ ...item, currency: item.currency || "CNY", __testFixture: true, quotaSummary: { status: "KNOWN", total: Number(item.quota), used: Number(item.used), remaining: Number(item.quota) - Number(item.used), currency: "CNY", source: "TEST_FIXTURE" } }));
    return { items: preview.get("mockEmpty") === "1" ? [] : items, total: preview.get("mockEmpty") === "1" ? 0 : items.length, demo: true };
  },
  async listArchived() {
    if (isAiVisualFixtureMode()) return { items: [], total: 0, source: "VISUAL_QA_ONLY", writeMode: "DISABLED" };
    if (usesLiveAiModelOperationsApi()) return aiModelOperationsApi.listArchived();
    if (!fixtureBoundaryAllowed()) throw Object.assign(new Error("AI_MODEL_ARCHIVE_LIST_API_NOT_CONNECTED"), { code: "AI_MODEL_ARCHIVE_LIST_API_NOT_CONNECTED", source: "NOT_CONNECTED", productionVerified: false });
    const preview = new URLSearchParams(window.location.search);
    const delay = preview.get("mockArchiveListSlow") === "1" ? 1100 : 180;
    await new Promise((resolve) => setTimeout(resolve, delay));
    if (preview.get("mockArchiveListPermission") === "1") { const error = new Error("Preview-only archive permission denied"); error.code = "MOCK_ARCHIVE_LIST_PERMISSION_DENIED"; throw error; }
    if (preview.get("mockArchiveListFailure") === "1") { const error = new Error("Preview-only archive list failure"); error.code = "MOCK_ARCHIVE_LIST_FAILED"; throw error; }
    return { items: archivedModels.map(({ item, archivedAt }) => ({ ...item, archivedAt })), total: archivedModels.length, mock: true };
  },
  async archive(id, itemToArchive) {
    blockVisualFixtureWrite();
    if (usesLiveAiModelOperationsApi()) {
      const result = await aiModelOperationsApi.archive(id, itemToArchive);
      return { item: { id, archivedAt: result.archived_at }, source: result.source, serverConfirmed: result.archived === true };
    }
    if (!fixtureBoundaryAllowed()) throw Object.assign(new Error("AI_MODEL_ARCHIVE_API_NOT_CONNECTED"), { code: "AI_MODEL_ARCHIVE_API_NOT_CONNECTED", source: "NOT_CONNECTED", productionVerified: false });
    recordMockCall("archive", { id });
    await new Promise((resolve) => setTimeout(resolve, 360));
    const preview = new URLSearchParams(window.location.search);
    if (preview.get("mockArchivePermission") === "1") { const error = new Error("Preview-only archive permission denied"); error.code = "MOCK_ARCHIVE_PERMISSION_DENIED"; throw error; }
    if (preview.get("mockArchiveFailure") === "1") { const error = new Error("Preview-only archive failure"); error.code = "MOCK_ARCHIVE_FAILED"; throw error; }
    const created = createdModels.findIndex((item) => item.id === id);
    const collection = created >= 0 ? createdModels : initialModels;
    const index = created >= 0 ? created : initialModels.findIndex((item) => item.id === id);
    if (index < 0) { const error = new Error("Preview-only model not found"); error.code = "MODEL_NOT_FOUND"; throw error; }
    const [item] = collection.splice(index, 1);
    const archivedAt = new Date().toISOString().slice(0, 16).replace("T", " ");
    archivedModels.unshift({ item: { ...item }, collection: created >= 0 ? "created" : "initial", index, archivedAt });
    return { item: { ...item }, archivedAt, mock: true };
  },
  async restore(id) {
    blockVisualFixtureWrite();
    if (usesLiveAiModelOperationsApi()) return aiModelOperationsApi.restore(id);
    if (!fixtureBoundaryAllowed()) throw Object.assign(new Error("AI_MODEL_RESTORE_API_NOT_CONNECTED"), { code: "AI_MODEL_RESTORE_API_NOT_CONNECTED", source: "NOT_CONNECTED", productionVerified: false });
    recordMockCall("restore", { id });
    await new Promise((resolve) => setTimeout(resolve, 360));
    const preview = new URLSearchParams(window.location.search);
    if (preview.get("mockRestorePermission") === "1") { const error = new Error("Preview-only restore permission denied"); error.code = "MOCK_RESTORE_PERMISSION_DENIED"; throw error; }
    if (preview.get("mockRestoreFailure") === "1") { const error = new Error("Preview-only restore failure"); error.code = "MOCK_RESTORE_FAILED"; throw error; }
    const index = archivedModels.findIndex((entry) => entry.item.id === id);
    if (index < 0) { const error = new Error("Preview-only archived model not found"); error.code = "ARCHIVED_MODEL_NOT_FOUND"; throw error; }
    const [entry] = archivedModels.splice(index, 1);
    const collection = entry.collection === "created" ? createdModels : initialModels;
    collection.splice(Math.min(entry.index, collection.length), 0, { ...entry.item });
    return { item: { ...entry.item }, mock: true };
  },
  async update(id, changes) {
    blockVisualFixtureWrite();
    if (usesLiveAiModelOperationsApi()) return aiModelOperationsApi.update(id, changes);
    if (!fixtureBoundaryAllowed()) throw Object.assign(new Error("AI_MODEL_UPDATE_API_NOT_CONNECTED"), { code: "AI_MODEL_UPDATE_API_NOT_CONNECTED", source: "NOT_CONNECTED", productionVerified: false });
    await new Promise((resolve) => setTimeout(resolve, 420));
    if (new URLSearchParams(window.location.search).get("mockUpdateFailure") === "1") throw new Error("Preview-only simulated update failure");
    const source = [...createdModels, ...initialModels].find((item) => item.id === id);
    if (!source) throw new Error("Preview-only model not found");
    const quota = Number(changes.quota);
    const used = source.used == null ? null : Number(source.used);
    const status = quota > 0 && used != null && used / quota >= 0.9 ? "额度告警" : source.enabled ? "待测试" : "已停用";
    const item = { ...source, provider: changes.provider, model: changes.model.trim(), type: changes.type, context: changes.context, quota, priority: changes.priority, ...(Object.hasOwn(changes, "modelLogo") ? { modelLogo: changes.modelLogo } : {}), status, updated: new Date().toISOString().slice(0, 16).replace("T", " ") };
    const collection = createdModels.includes(source) ? createdModels : initialModels;
    const index = collection.findIndex((entry) => entry.id === id);
    collection[index] = item;
    return { item: { ...item }, mock: true };
  },
  async setEnabled(id, enabled) {
    blockVisualFixtureWrite();
    if (usesLiveAiModelOperationsApi()) return aiModelOperationsApi.setEnabled(id, enabled);
    if (!fixtureBoundaryAllowed()) throw Object.assign(new Error("AI_MODEL_STATE_API_NOT_CONNECTED"), { code: "AI_MODEL_STATE_API_NOT_CONNECTED", source: "NOT_CONNECTED", productionVerified: false });
    await new Promise((resolve) => setTimeout(resolve, 650));
    if (new URLSearchParams(window.location.search).get("mockToggleFailure") === "1") throw new Error("Preview-only simulated enable/disable failure");
    const source = [...createdModels, ...initialModels].find((item) => item.id === id);
    if (!source) throw new Error("Preview-only model not found");
    const status = enabled ? (source.quota > 0 && source.used != null && source.used / source.quota >= 0.9 ? "额度告警" : "待测试") : "已停用";
    const item = { ...source, enabled: Boolean(enabled), status, updated: new Date().toISOString().slice(0, 16).replace("T", " ") };
    const collection = createdModels.some((entry) => entry.id === id) ? createdModels : initialModels;
    const index = collection.findIndex((entry) => entry.id === id);
    collection[index] = item;
    return { item: { ...item }, mock: true };
  },
  async getDetail(id) {
    if (usesLiveAiModelOperationsApi()) return aiModelOperationsApi.getDetail(id);
    if (!fixtureBoundaryAllowed()) throw Object.assign(new Error("AI_MODEL_DETAIL_API_NOT_CONNECTED"), { code: "AI_MODEL_DETAIL_API_NOT_CONNECTED", source: "NOT_CONNECTED", productionVerified: false });
    await new Promise((resolve) => setTimeout(resolve, 320));
    const preview = new URLSearchParams(window.location.search);
    if (preview.get("mockDetailFailure") === "1") throw new Error("Preview-only simulated detail failure");
    if (preview.get("mockDetailEmpty") === "1") return { item: null, mock: true };
    const source = [...createdModels, ...initialModels].find((item) => item.id === id);
    if (!source) return { item: null, mock: true };
    // Explicit allow-list: detail views must never expose credentials or arbitrary adapter fields.
    const item = Object.fromEntries(["id", "model", "provider", "type", "context", "used", "quota", "enabled", "status", "priority", "updated"]
      .filter((key) => Object.hasOwn(source, key))
      .map((key) => [key, source[key]]));
    return { item, mock: true };
  },
  async validateConnection(config) {
    blockVisualFixtureWrite();
    if (usesLiveAiModelOperationsApi()) return aiModelOperationsApi.testConnection(config);
    if (!fixtureBoundaryAllowed()) throw Object.assign(new Error("AI_MODEL_CONNECTION_TEST_API_NOT_CONNECTED"), { code: "AI_MODEL_CONNECTION_TEST_API_NOT_CONNECTED", source: "NOT_CONNECTED", productionVerified: false });
    recordMockCall("validateConnection", config);
    await new Promise((resolve) => setTimeout(resolve, 350));
    const preview = new URLSearchParams(window.location.search);
    if (preview.get("mockTestFailure") === "1") {
      const error = new Error("Preview-only simulated connection failure");
      error.code = "MOCK_CONNECTION_TIMEOUT";
      throw error;
    }
    if (preview.get("mockTestSuccess") === "1") {
      return { ok: true, status: "TEST_SUCCESS", mock: true, latencyMs: 142, message: "模拟测试通过；未访问 Provider。" };
    }
    return { ok: false, status: "TEST_FAILED", mock: true, errorCode: "MOCK_NOT_CONFIGURED", message: "隔离预览未配置真实 Provider；未发送请求。" };
  },
  async testConnection(config) {
    blockVisualFixtureWrite();
    if (usesLiveAiModelOperationsApi()) return aiModelOperationsApi.testConnection(config);
    if (!fixtureBoundaryAllowed()) throw Object.assign(new Error("AI_MODEL_CONNECTION_TEST_API_NOT_CONNECTED"), { code: "AI_MODEL_CONNECTION_TEST_API_NOT_CONNECTED", source: "NOT_CONNECTED", productionVerified: false });
    recordMockCall("testConnection", config);
    await new Promise((resolve) => setTimeout(resolve, 420));
    const preview = new URLSearchParams(window.location.search);
    if (preview.get("mockConnectionTestPermission") === "1") return { state: "PERMISSION_DENIED", code: "MOCK_PERMISSION_DENIED", message: "模拟权限拒绝；未连接服务商。", mock: true };
    if (preview.get("mockConnectionTestFailure") === "1") return { state: "ERROR", code: "MOCK_CONNECTION_FAILED", message: "模拟连接失败；未连接服务商。", mock: true };
    if (preview.get("mockConnectionTestSuccess") === "1") return { state: "SUCCESS", code: "MOCK_CONNECTION_OK", message: "模拟响应成功；未连接服务商，未验证真实健康状态。", mock: true };
    return { state: "NOT_CONFIGURED", code: "MOCK_CREDENTIALS_NOT_CONFIGURED", message: "当前隔离预览没有服务商凭据；未发起连接。", mock: true };
  },
  async create(config) {
    blockVisualFixtureWrite();
    if (!fixtureBoundaryAllowed()) throw Object.assign(new Error("AI_MODEL_CREATE_API_NOT_CONNECTED"), { code: "AI_MODEL_CREATE_API_NOT_CONNECTED", source: "NOT_CONNECTED", productionVerified: false });
    recordMockCall("create", config);
    await new Promise((resolve) => setTimeout(resolve, 220));
    const preview = new URLSearchParams(window.location.search);
    if (preview.get("mockCreateFailure") === "1") { const error = new Error("Preview-only simulated save failure"); error.code = "MOCK_CREATE_FAILED"; error.mock = true; throw error; }
    const modelId = String(config.model || "").trim();
    const duplicate = [...initialModels, ...createdModels, ...archivedModels.map((entry) => entry.item)].some((item) => item.provider === config.provider && String(item.model).trim().toLocaleLowerCase() === modelId.toLocaleLowerCase());
    if (preview.get("mockDuplicate") === "1" || duplicate) {
      const error = new Error("Preview-only duplicate model");
      error.code = "MODEL_ALREADY_EXISTS";
      throw error;
    }
    // The demo fixture never stores the API key or a false zero-usage value.
    const modelLogo = config.modelLogo?.kind === "custom-model" && config.modelLogo.persistence === "MEMORY_ONLY" && typeof config.modelLogo.dataUrl === "string" && /^data:image\/(png|jpeg|webp);base64,/.test(config.modelLogo.dataUrl) && Number(config.modelLogo.size) > 0 && Number(config.modelLogo.size) <= 1024 * 1024 ? { ...config.modelLogo } : undefined;
    const item = { id: "draft-" + Date.now(), model: modelId, provider: config.provider, type: config.type, context: config.context, used: null, quota: Number(config.quota), enabled: false, status: "???", priority: "P3", ...(modelLogo ? { modelLogo } : {}), updated: new Date().toISOString().slice(0, 16).replace("T", " ") };
    createdModels.unshift(item);
    return { item: { ...item }, mock: true };
  },
};
