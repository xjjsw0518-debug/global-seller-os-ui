import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Brain, ChatCircleText, CheckCircle, CircleNotch, Eye, FloppyDisk, ImageSquare, Key, MagnifyingGlass, ShieldCheck, SquaresFour, UserFocus, VideoCamera, Waveform, WarningCircle, Wrench, X } from "@phosphor-icons/react";
import { buildModelDraftPayload, capabilityCandidates, initialModelDraft, providerFixtures, validateModelDraft } from "./modelDraftSchema.js";
import { createLocalMockModelLogo, resolveProviderLogoName, validateModelLogoFile } from "./modelLogoContract.js";
import { getModelLogoPersistenceState } from "./modelLogoReferenceContract.js";
import { createModelDraftSubmissionGate } from "./modelDraftSubmission.js";
import { buildModelStepThreePayload } from "./modelStepThreeContract.js";
import { buildAiModelConfigurationRequest, saveAiModelConfiguration, projectConnectionParameters } from "./modelConfigurationApi.js";
import { normalizeModelConnectionHealthResponse, REQUIRED_MODEL_CONNECTION_CHECKS } from "./modelConnectionHealthContract.js";
import { normalizeAiProviderDirectoryResponse, configuredProviderSecretRef } from "./modelProviderDirectoryContract.js";
import { testAiModelConnection } from "./modelConnectionHealthApi.js";
import { discoverProviderModels } from "./modelDiscoveryApi.js";
import { liveVendorModelRows } from "./modelLiveCatalogContract.js";
import { readModelCapabilityRegistry, verifiedModelCapabilitySources } from "./modelCapabilityRegistryApi.js";
import { aiModelOperationsApi } from "./aiModelOperationsApi.js";
import { eligibleAiFallbackModels } from "./aiFallbackModelContract.js";
import { loadModelQuotaPages } from "./modelQuotaPagedRead.js";
import { AI_CAPABILITY_CATALOG, CAPABILITY_ADVANCED_FIELDS, DEPLOYMENT_TYPES, MODALITY_CANDIDATES, ROUTING_POLICY_CANDIDATES, SCENARIO_CANDIDATES } from "./modelCapabilityCatalog.js";
import { localizeAdvancedField, localizeCapability, localizeFormOption, localizeScenarioOrModality, toControlledInputValue } from "./modelAddFormPresentation.js";
import { PROFILE_ADVANCED_FIELDS, PRIMARY_BUDGET_FIELD } from "./modelAddAdvancedPresentation.js";
import { createAddModelFixtureSuccessRecord, parseAddModelFixtureParams, projectAddModelPreviewState, projectAddModelResultState } from "./addModelVisualState.js";
import { AiVisualFixtureNotice, getAiVisualFixtureData, isAiVisualFixtureMode } from "./aiVisualFixtureProvider.jsx";
import { presentAiAdapterFailure } from "./aiAdapterStatus.js";
import ProviderLogo from "./ProviderLogo.jsx";
import anthropicFrozenLogo from "./assets/provider-logos/frozen-baseline/anthropic.png";
import qwenFrozenLogo from "./assets/provider-logos/frozen-baseline/qwen.png";
import zhipuFrozenLogo from "./assets/provider-logos/frozen-baseline/zhipu.png";
import xaiFrozenLogo from "./assets/provider-logos/frozen-baseline/xai.png";
import mistralFrozenLogo from "./assets/provider-logos/frozen-baseline/mistral.png";
import cohereFrozenLogo from "./assets/provider-logos/frozen-baseline/cohere.png";
import metaFrozenLogo from "./assets/provider-logos/frozen-baseline/meta-llama.png";
import moonshotFrozenLogo from "./assets/provider-logos/frozen-baseline/moonshot.png";
import doubaoFrozenLogo from "./assets/provider-logos/frozen-baseline/doubao.png";
import hunyuanFrozenLogo from "./assets/provider-logos/frozen-baseline/hunyuan.png";
import openaiPreviewFrozenLogo from "./assets/provider-logos/frozen-baseline/openai-preview.png";
import openaiAddFrozenLogo from "./assets/provider-logos/frozen-baseline/openai-add.png";
import googleAddFrozenLogo from "./assets/provider-logos/frozen-baseline/google-add.png";
import deepseekAddFrozenLogo from "./assets/provider-logos/frozen-baseline/deepseek-add.png";
import kimiAddFrozenLogo from "./assets/provider-logos/frozen-baseline/kimi-add.png";
import minimaxAddFrozenLogo from "./assets/provider-logos/frozen-baseline/minimax-add.png";
import "./ai-feature.css";
import "./model-add-page.css";
import "./model-add-frozen-alignment.css";

const MODEL_VENDOR_CATALOG = [
  { id: "OPENAI", name: "OpenAI", category: "通用大模型", models: [["gpt-5", "GPT-5", "最新 · 推理 · 多模态", "256K", ["多模态", "推理", "代码", "工具调用"]], ["gpt-5-mini", "GPT-5 mini", "高性价比", "128K", ["多模态", "快速响应", "工具调用"]], ["gpt-4.1", "GPT-4.1", "稳定可靠", "1M", ["对话", "代码"]], ["o3", "o3", "推理增强", "200K", ["深度推理", "复杂问题"]], ["o4-mini", "o4-mini", "轻量高效", "200K", ["推理", "多模态"]], ["text-embedding-3-large", "text-embedding-3-large", "向量模型", "8192", ["文本嵌入"]], ["gpt-image-1", "gpt-image-1", "图像生成", "32K", ["图像生成", "图像理解"]]] },
  { id: "ANTHROPIC", name: "Anthropic", category: "通用大模型", models: [["claude-3-7-sonnet", "Claude 3.7 Sonnet", "复杂推理", "200K", ["多模态", "推理", "工具调用"]], ["claude-3-5-haiku", "Claude 3.5 Haiku", "快速响应", "200K", ["对话", "工具调用"]]] },
  { id: "GOOGLE_GEMINI", name: "Google Gemini", category: "通用大模型", models: [["gemini-2.5-pro", "Gemini 2.5 Pro", "多模态与强大推理", "1M", ["多模态", "推理", "视频理解"]], ["gemini-2.5-flash", "Gemini 2.5 Flash", "快速响应", "1M", ["多模态", "低成本"]]] },
  { id: "DEEPSEEK", name: "DeepSeek", category: "通用大模型", models: [["deepseek-chat", "DeepSeek V3", "开源高性能模型", "128K", ["文本", "代码"]], ["deepseek-reasoner", "DeepSeek R1", "深度推理", "128K", ["推理", "复杂问题"]], ["deepseek-flash", "DeepSeek V4.1 Flash", "厂商候选 · 待连接验证", "未知", []], ["deepseek-v4-pro", "DeepSeek V4 Pro", "厂商候选 · 待连接验证", "未知", []]] },
  { id: "QWEN", name: "Qwen", category: "通用大模型", models: [["qwen-max", "Qwen Max", "通义千问大模型", "128K", ["多模态", "推理"]], ["qwen-plus", "Qwen Plus", "通用增强", "128K", ["文本", "工具调用"]]] },
  { id: "KIMI", name: "Kimi", category: "通用大模型", models: [["kimi-k2", "Kimi K2", "长文本与对话推理", "128K", ["文本", "推理", "工具调用"]]] },
  { id: "ZHIPU", name: "智谱 AI", category: "通用大模型", models: [["glm-4.5", "GLM-4.5", "国产领先大模型", "128K", ["推理", "工具调用"]], ["GLM-5-Base", "GLM-5-Base", "Provider 已发现 · 待推理验证", "未知", []]] },
  { id: "MINIMAX", name: "MiniMax", category: "通用大模型", models: [["minimax-text-01", "MiniMax-Text-01", "强大的多模态能力", "1M", ["文本", "多模态"]]] },
  { id: "XAI", name: "xAI", category: "通用大模型", models: [["grok-3", "Grok 3", "前沿未来派 AI", "128K", ["推理", "文本"]]] },
  { id: "MISTRAL", name: "Mistral AI", category: "通用大模型", models: [["mistral-large", "Mistral Large", "高性能开源大模型", "128K", ["文本", "工具调用"]]] },
  { id: "COHERE", name: "Cohere", category: "通用大模型", models: [["command-a", "Command A", "企业级语言模型", "256K", ["文本", "工具调用"]]] },
  { id: "META", name: "Meta Llama", category: "通用大模型", models: [["llama-4-maverick", "Llama 4 Maverick", "开源大语言模型", "1M", ["多模态", "文本"]]] },
  { id: "MOONSHOT", name: "Moonshot AI", category: "通用大模型", models: [["kimi-k2", "Kimi K2", "Kimi 系列大模型", "128K", ["文本", "推理", "工具调用"]]] },
  { id: "DOUBAO", name: "Doubao", category: "通用大模型", models: [["doubao-seed-1.6", "Doubao Seed 1.6", "字节跳动大模型", "256K", ["多模态", "推理"]], ["doubao-seed-2-1-lite-260915", "Doubao Seed 2.1 Lite", "Provider 已发现 · 待能力验证", "未知", []]] },
  { id: "HUNYUAN", name: "Hunyuan", category: "通用大模型", models: [["hunyuan-t1", "Hunyuan T1", "腾讯混元大模型", "256K", ["推理", "文本"]]] },
];

const ROUTING_SCENARIO_OPTIONS = [
  ["RPA", "RPA自动化"],
  ["CONTENT_CREATION", "内容创作"],
  ["AI_GUARD", "AI防护"],
  ["AI_PHONE_SALES", "AI电话销售"],
  ["PRODUCT", "产品中心"],
  ["CUSTOMER_SERVICE", "客户服务"],
  ["DATA_ANALYTICS", "数据分析"],
  ["LOCALIZATION", "翻译本地化"],
  ["DEVELOPER_ASSISTANCE", "开发辅助"],
];
const VENDOR_TILES = ["OPENAI", "ANTHROPIC", "GOOGLE_GEMINI", "DEEPSEEK", "QWEN", "KIMI", "ZHIPU", "MINIMAX", "XAI"];
const FROZEN_VENDOR_MARKS = { OPENAI: openaiAddFrozenLogo, GOOGLE_GEMINI: googleAddFrozenLogo, DEEPSEEK: deepseekAddFrozenLogo, KIMI: kimiAddFrozenLogo, MINIMAX: minimaxAddFrozenLogo, ANTHROPIC: anthropicFrozenLogo, QWEN: qwenFrozenLogo, ZHIPU: zhipuFrozenLogo, XAI: xaiFrozenLogo, MISTRAL: mistralFrozenLogo, COHERE: cohereFrozenLogo, META: metaFrozenLogo, MOONSHOT: moonshotFrozenLogo, DOUBAO: doubaoFrozenLogo, HUNYUAN: hunyuanFrozenLogo };
function AddModelVendorLogo({ vendor, provider, className = "" }) {
  const image = FROZEN_VENDOR_MARKS[vendor?.id];
  return <span className={`add-model-vendor-logo ${image ? "is-frozen-crop" : ""} ${className}`} aria-label={`${vendor?.name || provider} 标识`} role="img">{image ? <img src={image} alt=""/> : <ProviderLogo provider={provider || vendor?.name}/>}</span>;
}
const fixtureAccessProviderForVendor = (vendorId) => {
  const vendor = MODEL_VENDOR_CATALOG.find((item) => item.id === vendorId);
  if (!vendor) return null;
  return { id: 'visual-provider-' + vendor.id.toLowerCase(), modelVendor: vendor.id, name: (vendor.id === 'OPENAI' ? 'OpenAI Platform' : vendor.name) + ' · 视觉样例', baseUrl: 'https://' + vendor.id.toLowerCase().replace(/_/g, '-') + '.example.invalid/v1', providerType: 'OPENAI_COMPATIBLE', credentialConfigured: false, secretRef: '' };
};
const providerMatchesVendor = (provider, vendorId) => {
  if (provider.modelVendor) return provider.modelVendor === vendorId;
  const vendor = MODEL_VENDOR_CATALOG.find((item) => item.id === vendorId);
  if (!vendor) return false;
  const normalize = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
  return [vendor.name, vendor.id].some((name) => normalize(provider.name).startsWith(normalize(name)));
};

function AccessProviderPicker({ value, providers, onChange, disabled, directoryState }) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef(null);
  const selected = providers.find((item) => item.id === value);
  useEffect(() => {
    const closeOutside = (event) => { if (!pickerRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);
  const logo = (item) => {
    const vendor = MODEL_VENDOR_CATALOG.find((entry) => entry.id === item?.modelVendor) || MODEL_VENDOR_CATALOG.find((entry) => providerMatchesVendor(item, entry.id));
    return <AddModelVendorLogo vendor={vendor} provider={vendor?.name || item?.providerType || "CUSTOM"}/>;
  };
  return <div className="add-page-field access-provider-field" ref={pickerRef} onKeyDown={(event) => {
    if (event.key === "Escape") { event.stopPropagation(); setOpen(false); pickerRef.current?.querySelector(".access-provider-trigger")?.focus(); }
    if (event.key === "ArrowDown" && !disabled) { event.preventDefault(); setOpen(true); requestAnimationFrame(() => pickerRef.current?.querySelector('[role="option"]')?.focus()); }
  }}><span>接入服务商 <b className="required-star" aria-hidden="true">*</b></span>
    <button type="button" className="access-provider-trigger" aria-label="接入服务商" aria-haspopup="listbox" aria-expanded={open} aria-controls="access-provider-options" disabled={disabled} onClick={() => setOpen((current) => !current)}>
      {selected && <span className="access-provider-logo">{logo(selected)}</span>}<span>{selected?.name || (["READY", "VISUAL_QA_ONLY"].includes(directoryState) ? "暂无对应服务商，请配置接入" : "服务商目录待载入")}</span><span className="access-provider-chevron" aria-hidden="true">⌄</span>
    </button>
    {open && <div className="access-provider-options" id="access-provider-options" role="listbox" aria-label="接入服务商目录">{providers.length ? providers.map((item) => <button type="button" key={item.id} role="option" aria-selected={item.id === value} onClick={() => { onChange(item.id); setOpen(false); pickerRef.current?.querySelector(".access-provider-trigger")?.focus(); }}><span className="access-provider-logo">{logo(item)}</span><span>{item.name}</span>{item.id === value && <CheckCircle size={18}/>}</button>) : <p>暂无接入服务商</p>}</div>}
  </div>;
}
const FROZEN_CAPABILITY_DESCRIPTIONS = {"TEXT_GENERATION":"对话、内容生成、问答等","STRUCTURED_OUTPUT":"输出结构化数据","TOOL_CALLING":"调用外部工具和函数","RPA_PLANNER_TOOL_CALLING":"复杂任务规划与自主执行","IMAGE_UNDERSTANDING":"通用图像理解与问答","OCR":"识别图片中的文字内容","DOCUMENT_UNDERSTANDING":"理解文档、表格、图文","IMAGE_GENERATION":"文生图、图生图、图像编辑","IMAGE_EDIT":"图像编辑、局部修改","VIDEO_GENERATION":"文本、图像生成视频","VIDEO_EDIT":"视频剪辑、风格转换","PORTRAIT_ANIMATION":"数字人生成、肖像驱动","LIP_SYNC":"音频驱动口型同步","STT":"语音转文字、多语言转录","TTS":"文字转语音、自然发声","VOICE_CLONE":"克隆指定声音、风格化配音","REALTIME_VOICE":"低延迟语音对话、双向交互","SENTIMENT_ANALYSIS":"分析文本、语音情感倾向","NEXT_BEST_ACTION":"基于对话上下文推荐动作"};
const VENDOR_BADGES = { "最新": "latest", "推荐": "recommended", "高性价比": "value", "稳定可靠": "stable", "推理增强": "reasoning", "轻量高效": "fast", "向量模型": "embedding", "图像生成": "image", "高性能开源大模型": "stable" };
const MODEL_RELEASE_DATES = { "gpt-5": "2025-08-07", "gpt-5-mini": "2025-07-18", "gpt-4.1": "2024-04-14", o3: "2024-12-20", "o4-mini": "2025-04-16", "text-embedding-3-large": "2025-01-25", "gpt-image-1": "2024-04-23" };
const MODEL_COST_DIMENSIONS = [["INPUT_TOKEN","输入 Token","每千 Token"],["OUTPUT_TOKEN","输出 Token","每千 Token"],["REQUEST","请求","每次请求"],["IMAGE","图像生成","每张图像"],["VIDEO_SECOND","视频生成","每秒视频"],["AUDIO_SECOND","语音处理","每秒音频"],["GPU_SECOND","图形处理器计算","每秒图形处理器"],["GPU_MINUTE","图形处理器计算","每分钟图形处理器"],["JOB","任务作业","每个任务"]];
const MODEL_CAPABILITY_GROUPS = [["文本与 Agent","text reasoning tools"],["视觉理解","vision"],["图像生成与编辑","image"],["视频理解与生成","video"],["语音与音频","audio"],["其他能力","audio_video"]];
const CONNECTION_HEALTH_CHECK_LABELS = Object.freeze({
  "Credential Validation": "凭据校验",
  "Endpoint Connectivity": "端点连通",
  Authentication: "身份认证",
  "Model Discovery": "模型发现",
  "Selected Model Exists": "模型存在性",
  "Minimal Inference": "最小推理",
  "Capability Validation": "能力校验",
  Latency: "响应延迟",
});
const contextLengthK = (value) => { const match = String(value).match(/^(\d+(?:\.\d+)?)(M|K)$/i); if (!match) return null; const amount = Number(match[1]); return match[2].toUpperCase() === "M" ? amount * 1024 : amount; };

const groups = [
 { key:"basic", title:"Provider", note:"\u4f9b\u5e94\u5546\u4fe1\u606f", fields:["providerName"] },
 { key:"connection", title:"Connection", note:"\u8fde\u63a5\u65b9\u5f0f\u4e0e\u63a5\u5165\u8bbe\u7f6e", fields:["endpointMode","apiBaseUrl","manualBaseUrl","authType","connectionType"] },
 { key:"profile", title:"Models", note:"\u6a21\u578b\u5b9a\u4e49\u3001\u80fd\u529b\u4e0e\u5546\u4e1a\u4fe1\u606f", fields:["modelId","displayName","deploymentType","scenarioSupport","inputModalities","outputModalities","capabilities"] },
 { key:"strategy", title:"Quota & Routing", note:"\u914d\u989d\u3001\u8d39\u7528\u4e0e\u8def\u7531\u7b56\u7565", fields:["costLevel","usageStrategy",PRIMARY_BUDGET_FIELD,"routingPolicy","priority"] },
];
const choices={ providerName:["OPENAI","DEEPSEEK","DOUBAO","CUSTOM"], providerType:["OPENAI_COMPATIBLE","PROVIDER_NATIVE","OLLAMA","CUSTOM"], providerStatus:["ACTIVE","DISABLED","ERROR","QUOTA_LIMITED"], endpointMode:["AUTO","MANUAL"], authType:["API_KEY","NONE"], connectionType:["OPENAI_COMPATIBLE","PROVIDER_NATIVE","OLLAMA","CUSTOM_HTTP","LOCAL_RUNTIME","GPU_RUNTIME","CUSTOM"], deploymentType:["UNKNOWN",...DEPLOYMENT_TYPES], runtimeHealthReason:["UNKNOWN","RUNTIME_OFFLINE","VRAM_EXHAUSTED","QUEUE_FULL","MODEL_LOAD_FAILED","MODEL_VERSION_MISMATCH","ENDPOINT_UNREACHABLE","AUTH_ERROR","QUOTA_EXHAUSTED"], routingPolicy:["UNKNOWN",...ROUTING_POLICY_CANDIDATES], commercialUseStatus:["UNKNOWN","CONFIRMED_ALLOWED","RESTRICTED","PROHIBITED","NEEDS_REVIEW"], costUnit:["UNKNOWN","TOKEN_PER_1M","IMAGE","VIDEO_SECOND","AUDIO_SECOND","AUDIO_TOKEN_1K","GPU_SECOND","REQUEST"], commercialCostStatus:["UNKNOWN","ESTIMATED","VERIFIED","CONFIRMED_FREE"], costLevel:["FREE","LOW","MEDIUM","HIGH"], usageStrategy:["PRIORITY","NORMAL","BACKUP","FALLBACK"], billingMode:["USAGE_BASED","PREPAID_BALANCE","TOKEN_PACKAGE","ENTERPRISE_CONTRACT","SELF_HOSTED","UNMANAGED"], pricingStatus:["UNKNOWN","VERIFIED","DISABLED"] };
const labels = {
  providerName: "Provider", providerDisplayName: "Provider 显示名称", providerId: "Provider UUID", providerType: "Provider 协议", providerStatus: "Provider 状态", providerEnabled: "启用 Provider", apiBaseUrl: "Provider API 地址", defaultBaseUrl: "Provider 默认地址（可选）", providerDailyBudget: "Provider 每日预算", providerMonthlyBudget: "Provider 每月预算",
  modelId: "模型 ID", displayName: "模型显示名称", endpointMode: "Endpoint 模式", manualBaseUrl: "手动 Base URL", authType: "认证方式", connectionType: "连接类型", costLevel: "成本等级", usageStrategy: "使用策略", secretConfigured: "本地模拟凭据标记（非真实凭据状态）", endpointDetails: "Endpoint 说明（可选）", contextWindow: "上下文窗口（未映射字段）",
  billingMode: "计费模式", rpm: "每分钟请求上限 RPM", tpm: "每分钟 Token 上限 TPM", rpd: "每日请求上限 RPD", freeQuota: "免费额度", monthlyBudget: "模型月预算", warningThreshold: "预算预警阈值（%）", capabilities: "能力（最多 10 项）",
  deploymentType: "部署类型", scenarioSupport: "适用场景", inputModalities: "输入模态", outputModalities: "输出模态", providerModelId: "Provider 模型 ID", runtimeId: "运行时 ID", runtimeEndpoint: "运行时 Endpoint", runtimeHealthReason: "运行时健康原因", supportedLanguages: "支持语言", qualityTier: "质量等级", routingPolicy: "路由策略", priority: "优先级", enabled: "启用状态", fallbackModelId: "备用模型 ID", modelVersion: "模型版本", commercialUseStatus: "商业使用状态", licenseId: "许可 ID", licenseUrl: "许可协议链接", commercialUseEvidenceUrl: "商用许可核验链接", costUnit: "成本计量单位", commercialCostStatus: "成本核验状态", costPerUnit: "单价", costCurrency: "计价币种", commercialCostEvidenceUrl: "成本依据链接",
  pricingStatus: "Token 价格状态", inputRate: "输入价格 / 百万 Token", outputRate: "输出价格 / 百万 Token", currency: "币种", pricingSource: "价格来源（核实价格时必填）",
};

const hints = { providerId: "此字段等待 Provider 注册表接入。", apiBaseUrl: "可选 HTTP(S) 地址，最多 512 个字符。", defaultBaseUrl: "可选 HTTP(S) 地址，最多 512 个字符。", providerDailyBudget: "Provider 级每日预算；0 表示不设上限。", providerMonthlyBudget: "Provider 级每月预算。", modelId: "1–120 个字符；保存时 model_name 与 model_id 保持一致。", displayName: "1–160 个字符。", manualBaseUrl: "MANUAL 模式必填；需为 HTTP(S) 地址。", secretConfigured: "不录入、不读取、不回显真实 Key；此状态只读。", endpointDetails: "最多 2000 个字符；请勿填写密钥。", contextWindow: "候选 Schema 未映射 context_window；请保持未知。", freeQuota: "未知时留空，不要填写 0。", monthlyBudget: "模型级月预算；0 表示不设上限。", warningThreshold: "0–100；达到此百分比时预警。", pricingStatus: "价格未知时保持为空；已核验价格需填写费率、币种和来源。", pricingSource: "价格依据来源；已核验价格时必填。" };
const limits={providerDisplayName:160,modelId:120,displayName:160,apiBaseUrl:512,defaultBaseUrl:512,manualBaseUrl:512,endpointDetails:2000,currency:16};
const numeric=new Set(["providerDailyBudget","providerMonthlyBudget","inputRate","outputRate","rpm","tpm","rpd","freeQuota","monthlyBudget","warningThreshold","priority","costPerUnit"]);
const providerCredentialFixture = Object.freeze({ configured: false, status: "NOT_CONFIGURED", mock: true, readOnly: true });
const optionLabel = localizeFormOption;
const providerLogoName = (name) => ({ OPENAI: "OpenAI", DEEPSEEK: "DeepSeek", DOUBAO: "DOUBAO", CUSTOM: "CUSTOM" }[name] || name);

function RuntimeAvailabilityChart() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return undefined;
    const values = [96.8, 98.2, 97.4, 99.1, 98.7, 99.4, 98.8, 99.6, 98.9, 99.2, 99.7, 99.1, 99.5, 98.8, 99.6, 99.2];
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * scale));
      canvas.height = Math.max(1, Math.round(rect.height * scale));
      context.setTransform(scale, 0, 0, scale, 0, 0);
      const width = rect.width;
      const height = rect.height;
      const left = 28, right = 5, top = 7, bottom = 5;
      const plotWidth = width - left - right;
      const plotHeight = height - top - bottom;
      [0, 50, 100].forEach((tick) => {
        const y = top + plotHeight * (1 - tick / 100);
        context.beginPath(); context.moveTo(left, y); context.lineTo(width - right, y);
        context.strokeStyle = "rgba(93, 158, 205, .18)"; context.lineWidth = 1; context.stroke();
        context.fillStyle = "#83a9c8"; context.font = "8px sans-serif"; context.textAlign = "right";
        context.fillText(`${tick}%`, left - 5, y + 3);
      });
      const points = values.map((value, index) => ({ x: left + (plotWidth * index) / (values.length - 1), y: top + plotHeight * (1 - value / 100) }));
      context.beginPath(); context.moveTo(points[0].x, top + plotHeight); points.forEach((point) => context.lineTo(point.x, point.y)); context.lineTo(points.at(-1).x, top + plotHeight); context.closePath();
      const fill = context.createLinearGradient(0, top, 0, height);
      fill.addColorStop(0, "rgba(19, 210, 173, .27)"); fill.addColorStop(1, "rgba(19, 210, 173, .02)");
      context.fillStyle = fill; context.fill();
      context.beginPath(); points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
      context.strokeStyle = "#15d2ad"; context.lineWidth = 2; context.stroke();
      points.forEach((point) => { context.beginPath(); context.arc(point.x, point.y, 2, 0, Math.PI * 2); context.fillStyle = "#15d2ad"; context.fill(); });
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);
  return <canvas ref={canvasRef} className="live-runtime-chart" role="img" aria-label="近24小时可用率趋势，整体稳定在99%左右"/>;
}

function LiveConfigurationPreview({ step, form, vendorName, logoProvider, identityMode, visualFixture, accessProviderName, connectionSecretRef, connectionHealth, connectionChecks, costDraft, quotaDraft, routingDraft, stepThreeArea, savedModel, savedEnabled, savedDbReadback, savedCapabilities, routeSummary }) {
  const [previewTab, setPreviewTab] = useState(step === 2 ? "运行状态" : stepThreeArea === "quota" ? "成本" : stepThreeArea === "routing" ? "运行状态" : "基础信息");
  useEffect(() => { setPreviewTab(step === 2 ? "运行状态" : step === 3 && stepThreeArea === "quota" ? "成本" : step === 3 && stepThreeArea === "routing" ? "运行状态" : "基础信息"); }, [step, stepThreeArea]);
  const modelName = savedModel?.display_name || form.displayName || "尚未选择模型";
  const modelId = savedModel?.model_id || form.modelId || "等待选择";
  const provider = identityMode ? form.providerDisplayName || "自定义模型" : vendorName || savedModel?.model_vendor || "待选择 Provider";
  const selectedCatalogVendor = MODEL_VENDOR_CATALOG.find((vendor) => vendor.id === form.modelVendor);
  const selectedCatalogModel = selectedCatalogVendor?.models.find(([id]) => id === form.modelId);
  const modelPreview = visualFixture ? (form.modelVendor === visualFixture.vendorId && form.modelId === visualFixture.modelId
    ? visualFixture.modelPreview
    : {
      category: selectedCatalogVendor?.category || "待连接读取",
      contextWindow: selectedCatalogModel?.[3] || "待连接读取",
      maxOutput: "待连接读取",
      releaseDate: MODEL_RELEASE_DATES[form.modelId] || "待连接读取",
      website: ({ OPENAI: "https://openai.com", ANTHROPIC: "https://www.anthropic.com", GOOGLE_GEMINI: "https://ai.google.dev", DEEPSEEK: "https://www.deepseek.com", QWEN: "https://qwen.ai", KIMI: "https://www.moonshot.cn", ZHIPU: "https://www.zhipuai.cn", MINIMAX: "https://www.minimaxi.com", XAI: "https://x.ai" })[form.modelVendor] || "",
      description: `${modelName} 是 ${provider} 的模型视觉样例。规格与能力将在连接服务商后校准；此处内容仅用于界面预览。`,
      tags: selectedCatalogModel?.[4] || [],
    }) : null;
  const capabilities = savedCapabilities?.length ? savedCapabilities : form.capabilities || [];
  const capabilitySummary = capabilities.length ? capabilities.slice(0, 3).map(localizeCapability).join("、") + (capabilities.length > 3 ? ` 等 ${capabilities.length} 项` : "") : visualFixture ? "文本生成 · 推理 · 多模态 · 工具调用" : "等待能力元数据";
  const endpointMode = form.endpointMode === "MANUAL" ? "手动接入地址" : "服务商自动地址";
  const endpoint = form.endpointMode === "MANUAL" ? form.manualBaseUrl || "尚未填写" : form.apiBaseUrl || "由已选服务商提供";
  const costLevel = form.costLevel ? localizeFormOption("costLevel", form.costLevel) : visualFixture ? "标准 · 视觉样例" : "待核验";
  const usageStrategy = form.usageStrategy ? localizeFormOption("usageStrategy", form.usageStrategy) : routingDraft?.costStrategy ? localizeFormOption("routingPolicy", routingDraft.costStrategy) : visualFixture ? "平衡策略 · 视觉样例" : "未设置";
  const credentialStatus = connectionSecretRef ? "已关联托管凭据" : form.authType === "NONE" ? "无需凭据" : "尚未关联凭据";
  const pricingStatus = visualFixture ? "视觉样例 · 非真实报价" : form.pricingStatus === "VERIFIED" ? "已核验" : form.pricingStatus === "DISABLED" ? "已停用" : "未知 · 待计价目录";
  const previewState = projectAddModelPreviewState({ step, hasSavedModel: Boolean(savedModel), savedEnabled, connectionHealth });
  const localizedConnectionHealth = ({ UNTESTED: "未测试", TESTING: "测试中", READY: "已就绪", DEGRADED: "未通过", TIMEOUT: "连接超时", AUTH_ERROR: "认证失败", RATE_LIMITED: "请求受限", UNAVAILABLE: "服务不可用", ERROR: "连接异常" })[previewState.connectionStatus] || "状态待确认";
  const configStatus = visualFixture && savedModel ? "成功页视觉样例 · 未写入" : savedModel ? previewState.enabled ? "已保存并启用" : "草稿已保存" : step === 1 ? "模型已选择 · 待连接" : step === 2 ? previewState.connectionStatus === "READY" ? "连接已验证" : previewState.connectionStatus === "UNTESTED" ? "待连接测试" : `连接状态 · ${localizedConnectionHealth}` : "配置草稿 · 尚未保存";
  const configTone = !visualFixture && (previewState.enabled || step === 2 && previewState.connectionStatus === "READY") ? "ready" : !visualFixture && (["AUTH_ERROR", "TIMEOUT", "RATE_LIMITED", "DEGRADED"].includes(previewState.connectionStatus)) ? "attention" : "pending";
  const estimatedMonthlyCost = [["INPUT_TOKEN",50000],["OUTPUT_TOKEN",100000],["IMAGE",1000],["VIDEO_SECOND",500],["AUDIO_SECOND",100000],["GPU_MINUTE",1000]].reduce((total,[id,quantity])=>total + (Number(costDraft?.[id]) || 0)*quantity,0);
  const monthlyCostCeiling = Number(quotaDraft?.monthlyCostLimit) || 1000;
  const areaLabel = stepThreeArea === "quota" ? "配额与成本" : stepThreeArea === "routing" ? "路由策略" : "模型能力";
  const rows = [
    ["模型厂商", provider],
    ["接入服务商", accessProviderName || (visualFixture ? "OpenAI Platform · 视觉样例" : "待选择")],
    ["模型", `${modelName} · ${modelId}`],
    ["成本等级", costLevel],
    ["使用策略", usageStrategy],
    ["适用任务 / 能力", capabilitySummary],
    ["API 地址", `${endpointMode} · ${endpoint}`],
    ["凭据状态", credentialStatus],
    ["计价状态", pricingStatus],
    ["配置状态", configStatus],
  ];
  return <aside className="add-page-card live-configuration-preview" aria-label="模型配置实时预览" data-step={savedModel ? "saved" : step}>
    <header className="live-preview-heading"><h2>模型预览</h2></header>
    <section className="live-preview-identity" aria-label="当前选中模型"><div className="live-preview-logo">{step>=2&&form.modelVendor==="OPENAI"?<span className="add-model-vendor-logo"><img src={openaiPreviewFrozenLogo} alt="OpenAI 标识"/></span>:<AddModelVendorLogo vendor={selectedCatalogVendor} provider={logoProvider}/>}</div><div className="live-preview-model-copy"><b>{provider} / {modelName}</b>{step>=2 && modelPreview && <div className="live-preview-description"><p>{visualFixture && form.modelVendor === "OPENAI" ? "OpenAI 最新旗舰模型，具备强大的多模态理解和推理能力，支持复杂任务处理。" : modelPreview.description}</p>{modelPreview.website && <a href={modelPreview.website} target="_blank" rel="noreferrer">{modelPreview.website} ↗</a>}</div>}<code>{modelId}</code><small>{visualFixture ? "本地视觉样例" : savedModel ? "服务端读回" : "当前选择"}</small></div><span className={`live-preview-state ${configTone}`}>{visualFixture && savedModel ? "视觉样例" : configTone === "ready" ? "就绪" : configTone === "attention" ? "需检查" : savedModel ? "草稿" : "配置中"}</span></section>
    {<>
      {step===1 && modelPreview?.description && <section className="live-preview-description"><p>{visualFixture && form.modelVendor === "OPENAI" ? "OpenAI 最新旗舰模型，具备强大的多模态理解和推理能力，支持复杂任务处理。" : modelPreview.description}</p>{modelPreview.website && <a href={modelPreview.website} target="_blank" rel="noreferrer">访问模型官网 ↗</a>}</section>}
      <nav className="live-preview-tabs" aria-label="预览信息分类">{["基础信息","能力","成本","运行状态"].map((tab)=><button type="button" key={tab} className={previewTab===tab?"active":""} aria-pressed={previewTab===tab} onClick={()=>setPreviewTab(tab)}>{tab}</button>)}</nav>
    </>}
    {previewTab === "基础信息" && <dl className="live-preview-table" aria-label="模型基础信息">{[["模型名称",modelName],["模型厂商",provider],["模型分类",modelPreview?.category||"待确认"],["上下文长度",modelPreview?.contextWindow||"待读取"],["最大输出",modelPreview?.maxOutput||"待读取"],["输入模态",(form.inputModalities||[]).map(localizeScenarioOrModality).join("、")||"待确认"],["输出模态",(form.outputModalities||[]).map(localizeScenarioOrModality).join("、")||"待确认"],["发布日期",modelPreview?.releaseDate||"待确认"]].map(([label,value])=><div className="live-preview-row" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
    {(previewTab === "能力" || previewTab === "基础信息") && <section className="live-preview-capabilities"><div><b>模型简介</b><span>{(form.inputModalities || []).length ? (form.inputModalities || []).map(localizeScenarioOrModality).join(" / ") : visualFixture ? "文本 / 图像 / 音频" : "输入模态待确认"}</span></div><div className="live-preview-tags">{(capabilities.length ? capabilities.slice(0, 5) : visualFixture ? ["TEXT_GENERATION", "COMPLEX_REASONING", "IMAGE_UNDERSTANDING", "TOOL_CALLING"] : []).map((item) => <span key={item}>{localizeCapability(item)}</span>)}{capabilities.length > 5 && <span>+{capabilities.length - 5}</span>}</div></section>}
    {previewTab === "成本" && (visualFixture ? <section className="live-cost-preview" aria-label="成本估算视觉样例">
      <section className="live-cost-rates"><h3>单价配置（美元）</h3>{MODEL_COST_DIMENSIONS.filter(([id]) => !["REQUEST", "GPU_SECOND"].includes(id)).map(([id, label, unit]) => <div key={id}><span>{label}</span><b>{costDraft?.[id] === "" || costDraft?.[id] == null ? "未知" : `${costDraft[id]} / ${unit}`}</b></div>)}</section>
      <section className="live-cost-estimate"><h3>成本估算（每月）</h3><div><span>预计请求量</span><b>50,000 次</b></div><div><span>预计 Token 使用</span><b>50,000,000（输入）/ 100,000,000（输出）</b></div><div><span>预计其他资源</span><b>图像 1,000 张 / 视频 500 秒</b></div><strong>${estimatedMonthlyCost.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}<small>预计月度成本</small></strong><footer data-over-limit={estimatedMonthlyCost > monthlyCostCeiling}><CheckCircle size={14} weight="fill"/>{estimatedMonthlyCost > monthlyCostCeiling ? "预计成本超过月度上限" : "成本在额度限制范围内"}（${monthlyCostCeiling.toLocaleString("en-US",{minimumFractionDigits:2})}）</footer></section>
      <small className="live-cost-fixture-note">估算仅为视觉样例，不代表真实用量或报价。</small>
    </section> : <dl className="live-preview-table" aria-label="成本信息">{MODEL_COST_DIMENSIONS.map(([id,label,unit])=><div className="live-preview-row" key={id}><dt>{label} · {unit}</dt><dd>{costDraft?.[id] === "" || costDraft?.[id] == null ? "未知" : costDraft[id] === "0" ? "零成本" : costDraft[id]}</dd></div>)}</dl>)}
    {previewTab === "运行状态" && step < 3 && <section className="live-runtime-dashboard" aria-label="当前连接检查状态"><header className="live-runtime-status"><ShieldCheck size={25}/><div><b>{localizedConnectionHealth}</b><small>{connectionHealth === "READY" ? "八项连接检查完成" : "连接检查结果随测试过程更新"}</small></div></header>{connectionChecks.map((check)=><section className="live-runtime-group" key={check.name}><h3>{CONNECTION_HEALTH_CHECK_LABELS[check.name] || check.name}</h3><div><span>检查状态</span><b data-check-status={check.status}>{({PASS:"通过",PASSED:"通过",SUCCESS:"通过",READY:"通过",PENDING:"待验证",TESTING:"检查中",FAIL:"不通过",FAILED:"不通过",ERROR:"不通过",TIMEOUT:"不通过",SKIPPED:"已跳过"})[check.status] || "待验证"}</b></div></section>)}</section>}
    {step === 3 && previewTab === "运行状态" && (visualFixture ? <section className="live-runtime-dashboard" aria-label="模型运行状态视觉样例">
      <header className="live-runtime-status"><CheckCircle size={25} weight="fill"/><div><b>运行正常</b><small>模型连接正常，可参与路由</small></div><span><small>健康度</small><strong>92%</strong></span></header>
      <div className="live-runtime-meta"><span>最近检测时间：视觉样例</span><span>仅供界面预览</span></div>
      <section className="live-runtime-group" aria-label="API连接状态"><h3>API 连接</h3><div><span>连接状态</span><b className="is-ok">正常</b><span>延迟</span><b>320 毫秒</b></div></section>
      <section className="live-runtime-group" aria-label="身份认证状态"><h3>身份认证</h3><div><span>API Key 验证</span><b className="is-ok">通过</b><span>权限校验</span><b className="is-ok">通过</b></div></section>
      <section className="live-runtime-group" aria-label="模型推理状态"><h3>模型推理</h3><div><span>文本生成</span><b className="is-ok">正常 · 1.2 秒</b><span>上下文理解</span><b className="is-ok">正常 · 1.5 秒</b></div></section>
      <section className="live-runtime-group live-runtime-multimodal" aria-label="多模态能力状态"><h3>多模态能力</h3><div>{[["图像理解", "1.8 秒"], ["图像生成", "2.3 秒"], ["语音输入", "1.1 秒"], ["语音输出", "1.4 秒"], ["视频理解", "2.6 秒"]].map(([label, duration]) => <span key={label}>{label}<b className="is-ok">正常 · {duration}</b></span>)}</div></section>
      <section className="live-runtime-availability" aria-label="近24小时可用率视觉样例"><div><b>近 24 小时可用性</b><small>视觉样例数据</small></div><RuntimeAvailabilityChart/><div className="live-runtime-chart-labels"><span>12:00</span><span>18:00</span><span>00:00</span><span>06:00</span><span>12:00</span><strong>99.2%<small>可用性</small></strong></div></section>
      <p className="live-runtime-fixture-note">所有运行数据仅为视觉样例，未发起真实检测。</p>
    </section> : <dl className="live-preview-table" aria-label="运行状态">{rows.slice(6).map(([label, value])=><div className="live-preview-row" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>)}
    {step === 2 && !savedModel && <section className="live-preview-context" data-status={connectionHealth}><div><b>连接验证</b><strong>{{ READY: "8 / 8 项通过", TESTING: "检查进行中", UNTESTED: "尚未测试", DEGRADED: "连接未通过", TIMEOUT: "连接超时", AUTH_ERROR: "认证失败", RATE_LIMITED: "请求频率受限", UNAVAILABLE: "服务不可用" }[connectionHealth] || "状态待确认"}</strong></div><small>{accessProviderName || "接入服务商待选择"} · {connectionChecks?.length ? `${connectionChecks.filter((item) => ["PASS", "PASSED", "READY", "SUCCESS"].includes(item.status)).length} 项已完成` : "等待服务端健康检查"}</small></section>}
    {step === 1 && !savedModel && <section className="live-preview-context"><div><b>当前配置区域</b><strong>{areaLabel}</strong></div><small>{stepThreeArea === "quota" ? `RPM ${quotaDraft?.rpm || "未知"} · 月配额 ${quotaDraft?.monthlyQuota || "未知"} · ${Object.values(costDraft || {}).some(Boolean) ? "成本已填写" : "成本未知"}` : stepThreeArea === "routing" ? `${usageStrategy} · 优先级 ${routingDraft?.priority || "1"} · 权重 ${routingDraft?.weight ?? 100}%` : capabilitySummary}</small></section>}
    {savedModel && <section className="live-preview-context"><div><b>{visualFixture ? "演示状态" : "保存与读回"}</b><strong>{visualFixture ? "未执行真实读回" : savedDbReadback ? "数据库读回一致" : "等待读回确认"}</strong></div><small>{visualFixture ? "未保存配置，也未加入线上路由" : routeSummary || (previewState.routingActive ? "当前模型已加入路由" : "已保存草稿，尚未启用")}</small></section>}
    {step === 1 && <footer className="live-preview-footnote"><span>摘要只读</span><span>{visualFixture ? "仅视觉样例 · 不写入 API / 数据库" : "数据随当前配置状态更新"}</span></footer>}
  </aside>;
}

export default function AddModelPage({ adapter, onCancel, onSaved }) {
  // Locked UI: visual samples require the explicit preview switch. Real journeys
  // must preserve their current mode instead of silently enabling sample data.
  const visualFixture = useMemo(() => getAiVisualFixtureData('addModel'), []);
  const fixtureParams = useMemo(() => parseAddModelFixtureParams(location.search), []);
  const [form, setForm] = useState(() => visualFixture ? {
    ...initialModelDraft, providerName: "OPENAI", providerDisplayName: "OpenAI", providerId: "fixture-openai-0001",
    providerType: "OPENAI_COMPATIBLE", modelVendor: visualFixture.vendorId, modelIdentityType: visualFixture.identityMode,
    modelId: visualFixture.modelId, displayName: visualFixture.displayName, apiBaseUrl: visualFixture.baseUrl,
    connectionType: visualFixture.connectionType, authType: visualFixture.authType, deploymentType: visualFixture.deploymentType,
    capabilities: [...visualFixture.capabilities], inputModalities: [...visualFixture.inputModalities], outputModalities: [...visualFixture.outputModalities],
    rpm: String(visualFixture.quota.rpm), tpm: String(visualFixture.quota.tpm), monthlyBudget: String(visualFixture.quota.monthlyQuota),
  } : initialModelDraft);
  const providerLogoName = (name) => resolveProviderLogoName(name, form.providerDisplayName);
  const [errors, setErrors] = useState({});
  const [logoFile, setLogoFile] = useState(null);
  const [logoDataUrl, setLogoDataUrl] = useState("");
  const [logoError, setLogoError] = useState("");
  const [logoReference, setLogoReference] = useState(null);
  const logoState = getModelLogoPersistenceState({ modelLogo: logoFile ? createLocalMockModelLogo(logoFile, logoDataUrl) : null, modelLogoReference: logoReference });
  const [mockKey, setMockKey] = useState("");
  const [busy, setBusy] = useState("");
  const [dirty, setDirty] = useState(false);
  const [exitPrompt, setExitPrompt] = useState(false);
  const [notice, setNotice] = useState("");
  const [testResult, setTestResult] = useState(null);
  const [discovery, setDiscovery] = useState(null);
  const [simulatedEnabled, setSimulatedEnabled] = useState(false);
  const [savedRecord, setSavedRecord] = useState(() => createAddModelFixtureSuccessRecord(visualFixture, fixtureParams.success));

  const [step, setStep] = useState(() => visualFixture ? fixtureParams.step : 1);
  const [vendorId, setVendorId] = useState(() => visualFixture?.vendorId || "OPENAI");
  const [moreVendorSearch, setMoreVendorSearch] = useState("");
  const [moreModelSearch, setMoreModelSearch] = useState("");
  const [moreVendorDraftId, setMoreVendorDraftId] = useState("");
  const [moreModelDraftId, setMoreModelDraftId] = useState("");
  const [moreIdentityDraftMode, setMoreIdentityDraftMode] = useState("");
  const [moreActiveTab, setMoreActiveTab] = useState("VENDORS");
  const [moreCustomDraft, setMoreCustomDraft] = useState({ providerDisplayName: "", modelId: "", displayName: "" });
  const [moreCapabilityFilter, setMoreCapabilityFilter] = useState("全部");
  const [moreModalityFilter, setMoreModalityFilter] = useState("全部");
  const [moreContextFilter, setMoreContextFilter] = useState("全部");
  const [modelSearch, setModelSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("全部");
  const [capabilityFilter, setCapabilityFilter] = useState("全部");
  const [modalityFilter, setModalityFilter] = useState("全部");
  const [contextFilter, setContextFilter] = useState("全部");
  const [quickFilter, setQuickFilter] = useState("");
  const [showMoreVendors, setShowMoreVendors] = useState(false);
  const [identityMode, setIdentityMode] = useState("");
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: "instant" }); }, [step]);
  const [stepThreeArea, setStepThreeArea] = useState(() => visualFixture ? fixtureParams.area : "capabilities");
  const [quotaDraft, setQuotaDraft] = useState(() => visualFixture ? { rpm: String(visualFixture.quota.rpm), tpm: String(visualFixture.quota.tpm), maxConcurrency: String(visualFixture.quota.maxConcurrency), dailyQuota: String(visualFixture.quota.dailyQuota), monthlyQuota: String(visualFixture.quota.monthlyQuota), requestTimeout: "60", retryCount: "3", monthlyCostLimit: "1000" } : { rpm: "", tpm: "", maxConcurrency: "", dailyQuota: "", monthlyQuota: "", requestTimeout: "", retryCount: "", monthlyCostLimit: "" });
  const [costDraft, setCostDraft] = useState(() => Object.fromEntries(MODEL_COST_DIMENSIONS.map(([id])=>[id,visualFixture?.costs?.[id] ?? ""])));
  const [routingDraft, setRoutingDraft] = useState(() => visualFixture ? { ...visualFixture.routing, costStrategy: visualFixture.routing.costStrategy || visualFixture.routing.strategy || "BALANCED", priority: String(visualFixture.routing.priority), scenarioBinding: ["RPA", "CONTENT_CREATION", "AI_GUARD", "AI_PHONE_SALES", "DATA_ANALYTICS", "DEVELOPER_ASSISTANCE"], triggerCondition: "HEALTH_OR_LIMIT", healthThreshold: visualFixture.routing.healthThreshold || 80, autoRouting: true } : { priority: "1", weight: 100, fallbackModelId: "", healthCheck: true, scenarioBinding: ["GENERAL"], costStrategy: "BALANCED", triggerCondition: "HEALTH_OR_LIMIT", healthThreshold: 80, autoRouting: true });
  const [fallbackModels, setFallbackModels] = useState([]);
  const [fallbackModelsState, setFallbackModelsState] = useState("NOT_LOADED");
  const [fallbackModelsReload, setFallbackModelsReload] = useState(0);
  const [capabilitySources, setCapabilitySources] = useState({});
  const [accessProvider, setAccessProvider] = useState(() => visualFixture?.accessProvider || "");
  const [connectionProviders, setConnectionProviders] = useState(() => visualFixture ? [{ id: visualFixture.accessProvider, name: "OpenAI Platform · 视觉样例", providerType: "OPENAI_COMPATIBLE", credentialConfigured: true, secretRef: visualFixture.secretRef }] : []);
  const [connectionDirectoryState, setConnectionDirectoryState] = useState(() => visualFixture ? "VISUAL_QA_ONLY" : "NOT_LOADED");
  const [providerModelDiscovery, setProviderModelDiscovery] = useState(() => visualFixture ? { status: "VISUAL_QA_ONLY", models: [] } : { status: "NOT_LOADED", models: [] });
  const [providerDiscoveryReload, setProviderDiscoveryReload] = useState(0);
  const [connectionSecretRef, setConnectionSecretRef] = useState(() => visualFixture?.secretRef || "");
  const [credentialEntryOpen, setCredentialEntryOpen] = useState(false);
  const [credentialDraft, setCredentialDraft] = useState({ providerDisplayName: "", baseUrl: "", apiKey: "" });
  const [credentialBusy, setCredentialBusy] = useState(false);
  const [credentialError, setCredentialError] = useState("");
  const [connectionHealth, setConnectionHealth] = useState(() => visualFixture?.connectionHealth || "UNTESTED");
  const [connectionChecks, setConnectionChecks] = useState(() => visualFixture?.connectionChecks || []);
  const [capabilityRegistry, setCapabilityRegistry] = useState(null);
  const [capabilityRegistryState, setCapabilityRegistryState] = useState("NOT_LOADED");
  const capabilityRegistryRequestIdRef = useRef(0);
  const [advancedConnection, setAdvancedConnection] = useState(() => visualFixture ? { connectionType: visualFixture.connectionType, authType: visualFixture.authType, deploymentType: visualFixture.deploymentType, region: visualFixture.region, ...visualFixture.advancedConnection } : { connectionType: "OPENAI_COMPATIBLE", authType: "API_KEY", deploymentType: "PUBLIC_CLOUD", region: "AUTO", timeout: 60, retry: 3, healthPath: "/models", healthInterval: 300 });
  const [customHeaders, setCustomHeaders] = useState([]);
  const [customParams, setCustomParams] = useState([]);
  const connectionFingerprint = useRef(null);
  useEffect(() => {
    const fingerprint = JSON.stringify({ accessProvider, connectionSecretRef, modelId: form.modelId, endpointMode: form.endpointMode, baseUrl: form.manualBaseUrl, advancedConnection, customHeaders, customParams });
    const previous = connectionFingerprint.current;
    connectionFingerprint.current = fingerprint;
    if (!visualFixture && previous !== null && previous !== fingerprint) {
      setConnectionHealth("UNTESTED"); setConnectionChecks([]); setTestResult(null);
    }
  }, [accessProvider, connectionSecretRef, form.modelId, form.endpointMode, form.manualBaseUrl, advancedConnection, customHeaders, customParams, visualFixture]);
  const selectedVendor = MODEL_VENDOR_CATALOG.find((vendor) => vendor.id === vendorId) || (vendorId === "CUSTOM" ? { id: "CUSTOM", name: form.providerDisplayName || "自定义接入", category: "自定义模型", models: [] } : MODEL_VENDOR_CATALOG[0]);
  const committedVendor = MODEL_VENDOR_CATALOG.find((vendor) => vendor.id === form.modelVendor) || selectedVendor;
  const hasAuthoritativeModelCatalog = ["SUCCESS", "SUCCESS_EMPTY"].includes(providerModelDiscovery.status) && Boolean(accessProvider);
  const authoritativeVendorModels = (vendor) => hasAuthoritativeModelCatalog ? liveVendorModelRows(vendor, providerModelDiscovery.models, connectionProviders.find(item => item.id === accessProvider)) : vendor.models;
  const selectedModelRow = authoritativeVendorModels(selectedVendor).find(([id]) => id === form.modelId) || null;
  const searchedVendors = MODEL_VENDOR_CATALOG.filter((vendor) => `${vendor.name} ${vendor.id}`.toLocaleLowerCase().includes(moreVendorSearch.trim().toLocaleLowerCase()));
  const visibleVendors = MODEL_VENDOR_CATALOG.filter((vendor) => VENDOR_TILES.includes(vendor.id));
  const matchedLiveVendorModels = hasAuthoritativeModelCatalog ? authoritativeVendorModels(selectedVendor) : [];
  const baseModels = hasAuthoritativeModelCatalog ? matchedLiveVendorModels : form.modelVendor === "CUSTOM" && form.modelId
    ? [[form.modelId, form.displayName || form.modelId, "自定义模型 · 待验证", "未知", []]]
    : selectedVendor.models;
  const visibleModels = baseModels.filter((model) => {
    const searchable = `${model[0]} ${model[1]} ${model[2]} ${model[4].join(" ")}`.toLocaleLowerCase();
    return (!modelSearch.trim() || searchable.includes(modelSearch.trim().toLocaleLowerCase()))
      && (categoryFilter === "全部" || selectedVendor.category === categoryFilter)
      && (capabilityFilter === "全部" || model[4].includes(capabilityFilter))
      && (modalityFilter === "全部" || modalityFilter === "文本" || (modalityFilter === "图像" && (model[4].some((item) => item.includes("多模态") || item.includes("图像")) || model[0].includes("image"))) || (modalityFilter === "视频" && model[4].some((item) => item.includes("视频"))) || (modalityFilter === "音频" && model[4].some((item) => item.includes("音频") || item.includes("语音"))))
      && (contextFilter === "全部" || (contextFilter === "128K+" ? contextLengthK(model[3]) >= 128 : contextLengthK(model[3]) < 128))
      && (!quickFilter || model[2].includes(quickFilter) || model[4].some((item) => item.includes(quickFilter)) || (quickFilter === "推荐" && model[0] === "gpt-5") || (quickFilter === "低成本" && model[2] === "高性价比"));
  });
  const moreSelectedVendor = MODEL_VENDOR_CATALOG.find((vendor) => vendor.id === moreVendorDraftId) || null;
  const availableMoreModels = moreSelectedVendor ? (moreSelectedVendor.id === form.modelVendor ? authoritativeVendorModels(moreSelectedVendor) : moreSelectedVendor.models) : [];
  const moreSelectedModel = availableMoreModels.find(([id]) => id === moreModelDraftId) || null;
  const visibleMoreModels = availableMoreModels.filter((model) => {
    const searchable = `${model[0]} ${model[1]} ${model[2]} ${model[4].join(" ")}`.toLocaleLowerCase();
    return (!moreModelSearch.trim() || searchable.includes(moreModelSearch.trim().toLocaleLowerCase()))
      && (moreCapabilityFilter === "全部" || model[4].includes(moreCapabilityFilter))
      && (moreModalityFilter === "全部" || moreModalityFilter === "文本" || (moreModalityFilter === "图像" && (model[4].some((item) => item.includes("多模态") || item.includes("图像")) || model[0].includes("image"))) || (moreModalityFilter === "视频" && model[4].some((item) => item.includes("视频"))) || (moreModalityFilter === "音频" && model[4].some((item) => item.includes("音频") || item.includes("语音"))))
      && (moreContextFilter === "全部" || (moreContextFilter === "128K+" ? contextLengthK(model[3]) >= 128 : contextLengthK(model[3]) < 128));
  });
  const openMoreVendors = () => {
    setMoreVendorSearch(""); setMoreModelSearch(""); setMoreCapabilityFilter("全部"); setMoreModalityFilter("全部"); setMoreContextFilter("全部");
    const draftVendorId = VENDOR_TILES.includes(form.modelVendor) ? MODEL_VENDOR_CATALOG.find((vendor) => !VENDOR_TILES.includes(vendor.id))?.id || "" : form.modelVendor;
    const draftVendor = MODEL_VENDOR_CATALOG.find((vendor) => vendor.id === draftVendorId);
    setMoreActiveTab("VENDORS"); setMoreVendorDraftId(draftVendorId === form.modelVendor ? draftVendorId : ""); setMoreModelDraftId(draftVendorId === form.modelVendor ? form.modelId : ""); setMoreIdentityDraftMode("");
    setMoreCustomDraft({ providerDisplayName: "", modelId: "", displayName: "" }); setShowMoreVendors(true);
  };
  const cancelMoreVendors = () => setShowMoreVendors(false);
  const confirmMoreSelection = () => {
    if (moreIdentityDraftMode) {
      const mode = moreIdentityDraftMode === "AGGREGATOR" ? "CUSTOM" : moreIdentityDraftMode;
      setVendorId("CUSTOM"); setIdentityMode(mode);
      setForm((old) => ({ ...old, modelVendor: "CUSTOM", modelIdentityType: mode, providerName: "", providerDisplayName: moreCustomDraft.providerDisplayName, providerId: "", modelId: moreCustomDraft.modelId, displayName: moreCustomDraft.displayName || moreCustomDraft.modelId, deploymentType: mode === "LOCAL" ? "LOCAL_RUNTIME" : mode === "PRIVATE" ? "PRIVATE_ENDPOINT" : "UNKNOWN", connectionType: "CUSTOM" }));
      setDirty(true); setShowMoreVendors(false); return;
    }
    if (!moreSelectedVendor || !moreSelectedModel) return;
    const [id, name] = moreSelectedModel;
    setVendorId(moreSelectedVendor.id);
    setIdentityMode("");
    setForm((old) => ({ ...old, modelVendor: moreSelectedVendor.id, modelIdentityType: "OFFICIAL", modelId: id, displayName: name }));
    setDirty(true); setShowMoreVendors(false);
  };
  const pageRef = useRef(null);
  const exitButton = useRef(null);
  const exitTriggerRef = useRef(null);
  const selectEscapeRef = useRef(false);
  const connectionTestInFlightRef = useRef(false);
  const connectionTestRequestIdRef = useRef(0);
  const providerDiscoveryAttemptRef = useRef("");
  const previousConnectionIdentity = useRef(form.modelVendor + ':' + (form.providerDisplayName || ''));
  useEffect(() => {
    const identity = form.modelVendor + ':' + (form.providerDisplayName || '');
    const changed = previousConnectionIdentity.current !== identity;
    previousConnectionIdentity.current = identity;
    if (changed) {
      setModelSearch(""); setCategoryFilter("全部"); setCapabilityFilter("全部"); setModalityFilter("全部"); setContextFilter("全部"); setQuickFilter("");
      connectionTestRequestIdRef.current += 1; connectionTestInFlightRef.current = false;
      setConnectionSecretRef(''); setConnectionHealth('UNTESTED'); setConnectionChecks([]); setTestResult(null);
      setProviderModelDiscovery({ status: visualFixture ? 'VISUAL_QA_ONLY' : 'NOT_LOADED', models: [] });
      providerDiscoveryAttemptRef.current = '';
      setCredentialEntryOpen(false); setCredentialDraft({ providerDisplayName: '', baseUrl: '', apiKey: '' }); setCredentialError('');
    }
    const matching = visualFixture ? (fixtureAccessProviderForVendor(form.modelVendor) || (!changed ? connectionProviders.find((item) => item.modelVendor === form.modelVendor && item.customIdentity === form.providerDisplayName) : null)) : ((!changed && connectionProviders.find((item) => item.id === accessProvider)) || connectionProviders.find((item) => providerMatchesVendor(item, form.modelVendor)));
    if (visualFixture) {
      const current = connectionProviders.find((item) => item.id === matching?.id);
      const provider = matching ? { ...matching, credentialConfigured: !changed && Boolean(connectionSecretRef), secretRef: !changed ? connectionSecretRef : '' } : null;
      if (provider && (!current || changed)) setConnectionProviders([provider]);
      else if (!provider && connectionProviders.length) setConnectionProviders([]);
    }
    if (changed || accessProvider !== (matching?.id || '')) {
      setAccessProvider(matching?.id || '');
      if (!visualFixture) setConnectionSecretRef(configuredProviderSecretRef(matching));
      setForm((current) => ({ ...current, endpointMode: 'AUTO', manualBaseUrl: '', apiBaseUrl: matching?.baseUrl || '', defaultBaseUrl: matching?.baseUrl || '' }));
    }
  }, [form.modelVendor, form.providerDisplayName, connectionProviders, visualFixture]);
  const saveGateRef = useRef(null);
  if (!saveGateRef.current) saveGateRef.current = createModelDraftSubmissionGate();
  const validation = useMemo(() => validateModelDraft(form), [form]);
  const registryIdentityType = form.modelIdentityType || (identityMode || "OFFICIAL");
  useEffect(() => {
    capabilityRegistryRequestIdRef.current += 1;
    if (!visualFixture) {
      setCapabilityRegistry(null); setCapabilityRegistryState("NOT_LOADED"); setCapabilitySources({});
    }
  }, [accessProvider, form.modelVendor, form.modelId, registryIdentityType, visualFixture]);
  const registryCapabilitySources = useMemo(() => capabilityRegistryState === "READY"
    ? verifiedModelCapabilitySources(capabilityRegistry, registryIdentityType, { providerId: accessProvider, modelVendor: form.modelVendor, modelId: form.modelId }) : {},
  [capabilityRegistry, capabilityRegistryState, registryIdentityType, accessProvider, form.modelVendor, form.modelId]);
  const runtimeTextCapabilityVerified = Boolean(registryCapabilitySources.TEXT_GENERATION);
  const customCapabilityManualAllowed = ["CUSTOM", "PRIVATE", "LOCAL"].includes(identityMode);

  const change = (key, value) => {
    setForm((old) => {
      const next = { ...old, [key]: value };
      if (key === "capabilities") {
        const selected = new Set(value);
        next.capabilitySettings = Object.fromEntries(Object.entries(old.capabilitySettings || {}).filter(([id, settings]) => selected.has(id) && Object.keys(settings || {}).length));
      }
      if (key === "providerName") {
        const fixture = providerFixtures.find((item) => item.name === value);
         Object.assign(next, { providerDisplayName: fixture?.displayName.replace(/\s*\(SYNTHETIC\)$/i, "") || "", providerId: fixture?.id || "", providerType: fixture?.providerType || "OPENAI_COMPATIBLE", connectionType: fixture?.providerType || "OPENAI_COMPATIBLE", apiBaseUrl: fixture?.apiBaseUrl || "", defaultBaseUrl: fixture?.defaultBaseUrl || "" });
      }
      return next;
    });
    setDirty(true); setErrors((old) => ({ ...old, [key]: "" })); setNotice(""); setTestResult(null); setSimulatedEnabled(false);
  };
  const closeCredentialEntry = () => {
    if (credentialBusy) return;
    setCredentialEntryOpen(false);
    setCredentialDraft((current) => ({ ...current, apiKey: "" }));
    setCredentialError("");
  };
  const submitCredentialEntry = async (event) => {
    event.preventDefault();
    if (credentialBusy) return;
    const submittedKey = credentialDraft.apiKey;
    const providerDisplayName = credentialDraft.providerDisplayName.trim();
    const baseUrl = credentialDraft.baseUrl.trim();
    if (!providerDisplayName || !baseUrl || !submittedKey.trim()) {
      setCredentialError("请先填写 Base URL 和 API Key。");
      return;
    }
    if (visualFixture) {
      const existing = connectionProviders.find((item) => item.id === accessProvider);
      const provider = { ...(existing || {}), id: existing?.id || 'visual-provider-custom', modelVendor: form.modelVendor, customIdentity: form.providerDisplayName, name: existing?.name || providerDisplayName + ' · 视觉样例', baseUrl, providerType: 'OPENAI_COMPATIBLE', credentialConfigured: true, secretRef: 'secret://visual-fixture/' + form.modelVendor.toLowerCase() + '/credential-placeholder' };
      setConnectionProviders([provider]); setAccessProvider(provider.id); setConnectionSecretRef(provider.secretRef);
      setForm((current) => ({ ...current, endpointMode: 'AUTO', manualBaseUrl: '', apiBaseUrl: baseUrl, defaultBaseUrl: baseUrl }));
      setConnectionHealth('UNTESTED'); setConnectionChecks([]); setTestResult(null);
      setCredentialDraft((current) => ({ ...current, apiKey: '' })); setCredentialEntryOpen(false); setCredentialError('');
      setNotice('视觉样例已关联；未保存密钥或调用真实接口。');
      return;
    }
    setCredentialBusy(true);
    setCredentialError("");
    setCredentialDraft((current) => ({ ...current, apiKey: "" }));
    try {
      const normalizedVendor = String(form.modelVendor || "CUSTOM").toUpperCase();
      const providerName = ["OPENAI", "DEEPSEEK", "DOUBAO"].includes(normalizedVendor) ? normalizedVendor : "CUSTOM";
      const response = await fetch("/api/v1/ai-providers", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_name: providerName,
          provider_type: "OPENAI_COMPATIBLE",
          provider_display_name: providerDisplayName,
          api_base_url: baseUrl,
          default_base_url: baseUrl,
          endpoint_mode: "MANUAL",
          manual_base_url: baseUrl,
          connection_type: "OPENAI_COMPATIBLE",
          auth_type: "API_KEY",
          api_key: submittedKey,
          enabled: true,
          provider_status: "ACTIVE",
          timeout_seconds: Number(advancedConnection.timeout) || 60,
          max_retries: Number(advancedConnection.retry) || 0,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const code = body?.detail?.code || body?.code || `HTTP_${response.status}`;
        throw Object.assign(new Error("凭据保存失败"), { code: /^[A-Z0-9_]{1,80}$/.test(String(code)) ? code : `HTTP_${response.status}` });
      }
      const created = normalizeAiProviderDirectoryResponse(body)[0];
      if (!created?.id || !created.secretRef || !created.credentialConfigured) {
        throw Object.assign(new Error("服务端未返回安全凭据引用"), { code: "CREDENTIAL_REFERENCE_MISSING" });
      }
      setConnectionProviders((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setAccessProvider(created.id);
      setConnectionSecretRef(created.secretRef);
      setConnectionHealth("UNTESTED");
      setTestResult(null);
      setCredentialEntryOpen(false);
      setCredentialDraft({ providerDisplayName: "", baseUrl: "", apiKey: "" });
      setNotice("接入服务商已保存；模型连接仅关联密钥引用，密钥不会在页面回显。");
    } catch (error) {
      const code = /^[A-Z0-9_]{1,80}$/.test(String(error?.code || "")) ? error.code : "CREDENTIAL_SAVE_FAILED";
      setCredentialError(`未能保存凭据（${code}）。密钥输入已清除，请检查信息后重新录入。`);
    } finally {
      setCredentialBusy(false);
      setCredentialDraft((current) => ({ ...current, apiKey: "" }));
    }
  };
  const check = () => { setErrors(validation.errors); if (!validation.valid) { setNotice("请修正标红字段后继续。"); pageRef.current?.querySelector('[aria-invalid="true"]')?.focus(); } return validation.valid; };
  const navigateWithAiFixture = async (callback, ...args) => {
    await callback?.(...args);
    if (isAiVisualFixtureMode()) {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("aiVisualFixture", "1");
      window.history.replaceState(window.history.state, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
    }
  };
  const requestExit = () => { if (busy) return; if (dirty) { exitTriggerRef.current = document.activeElement; setExitPrompt(true); } else void navigateWithAiFixture(onCancel); };

  const loadCapabilityRegistry = async (identity = {}) => {
    const requestId = ++capabilityRegistryRequestIdRef.current;
    if (visualFixture) {
      setCapabilityRegistry(null);
      setCapabilityRegistryState("VISUAL_QA_ONLY");
      setCapabilitySources(Object.fromEntries(form.capabilities.map((id) => [id, "VISUAL_QA_ONLY"])));
      return { source: "VISUAL_QA_ONLY", capabilities: [...form.capabilities] };
    }
    const providerId = identity.providerId || accessProvider;
    const modelVendor = identity.modelVendor || form.modelVendor;
    const modelId = identity.modelId || form.modelId;
    const modelIdentityType = identity.modelIdentityType || registryIdentityType;
    if (!providerId || !modelVendor || !modelId) { setCapabilityRegistry(null); setCapabilityRegistryState("NOT_READY"); return null; }
    setCapabilityRegistryState("LOADING");
    try {
      const result = await readModelCapabilityRegistry({ providerId, modelVendor, modelId, modelIdentityType });
      if (requestId !== capabilityRegistryRequestIdRef.current) return null;
      setCapabilityRegistry(result);
      setCapabilityRegistryState("READY");
      const sources = verifiedModelCapabilitySources(result, modelIdentityType, { providerId, modelVendor, modelId });
      setCapabilitySources((current) => ({ ...current, ...sources }));
      return result;
    } catch (error) {
      if (requestId !== capabilityRegistryRequestIdRef.current) return null;
      setCapabilityRegistry(null);
      setCapabilityRegistryState(error.code || "UNAVAILABLE");
      return null;
    }
  };

  useEffect(() => {
    const escape = (event) => {
      if (exitPrompt && event.key === "Tab") {
        const focusables = [...pageRef.current.querySelectorAll('[role="alertdialog"] button:not([disabled])')];
        if (focusables.length && (event.shiftKey && document.activeElement === focusables[0] || !event.shiftKey && document.activeElement === focusables.at(-1))) { event.preventDefault(); (event.shiftKey ? focusables.at(-1) : focusables[0]).focus(); }
        return;
      }
      if (event.key !== "Escape") return;
      const current = document.activeElement;
      if (current?.tagName === "SELECT" && selectEscapeRef.current) selectEscapeRef.current = false; // native popup consumed its first Escape; this second Escape exits
      event.preventDefault();
      if (exitPrompt) { setExitPrompt(false); return; }
      requestExit();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [busy, dirty, exitPrompt]);
  useEffect(() => { if (exitPrompt) exitButton.current?.focus(); else if (exitTriggerRef.current?.isConnected) exitTriggerRef.current.focus?.(); }, [exitPrompt]);
  useEffect(() => () => { connectionTestRequestIdRef.current += 1; capabilityRegistryRequestIdRef.current += 1; connectionTestInFlightRef.current = false; }, []);
  useEffect(() => {
    if (step !== 2) return;
    if (visualFixture) {
      const provider = fixtureAccessProviderForVendor(form.modelVendor) || connectionProviders.find((item) => item.modelVendor === form.modelVendor && item.customIdentity === form.providerDisplayName);
      setConnectionProviders(provider ? [{ ...provider, credentialConfigured: Boolean(connectionSecretRef), secretRef: connectionSecretRef }] : []);
      setConnectionDirectoryState("VISUAL_QA_ONLY");
      return undefined;
    }
    let active = true; setConnectionDirectoryState("LOADING");
    fetch("/api/v1/ai-providers", { credentials: "same-origin", headers: { Accept: "application/json" } }).then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(`Provider directory unavailable (HTTP ${response.status}).`), { code: body?.detail?.code || `HTTP_${response.status}` });
      const safeRows = normalizeAiProviderDirectoryResponse(body);
      if (active) { setConnectionProviders(safeRows); setConnectionDirectoryState("READY"); }
    }).catch((error) => { if (active) { setConnectionProviders([]); setConnectionDirectoryState(error.code || "UNAVAILABLE"); } });
    return () => { active = false; };
  }, [step, visualFixture, form.modelVendor]);
  useEffect(() => {
    if (step !== 2 || !accessProvider) return undefined;
    if (visualFixture) {
      setProviderModelDiscovery({ status: "VISUAL_QA_ONLY", models: [], message: "视觉样例不会请求真实服务商目录。" });
      return undefined;
    }
    const directoryProvider = connectionProviders.find(item => item.id === accessProvider);
    if (form.endpointMode === "MANUAL" && form.manualBaseUrl.trim() !== (directoryProvider?.baseUrl || "").trim()) {
      setProviderModelDiscovery({ status: "MANUAL_ENDPOINT_UNVERIFIED", models: [], message: "手动地址与服务商目录地址不同，旧目录不作为实时结果。" });
      return undefined;
    }
    const attemptKey = `${accessProvider}:${providerDiscoveryReload}`;
    if (providerDiscoveryAttemptRef.current === attemptKey) return undefined;
    providerDiscoveryAttemptRef.current = attemptKey;
    let active = true;
    const controller = new AbortController();
    setProviderModelDiscovery({ status: "LOADING", models: [] });
    discoverProviderModels(accessProvider, { signal: controller.signal }).then((result) => {
      if (active) setProviderModelDiscovery({ ...result, message: result.status === "SUCCESS_EMPTY" ? "服务商未返回模型；本地候选不会被标记为可用。" : "目录来自所选接入服务商的实时响应。" });
    }).catch((error) => {
      if (active && error.name !== "AbortError") setProviderModelDiscovery({ status: error.code || "UNAVAILABLE", models: [], message: error.message || "模型目录读取失败，请检查接入服务商后重试。" });
    });
    return () => { active = false; controller.abort(); if (providerDiscoveryAttemptRef.current === attemptKey) providerDiscoveryAttemptRef.current = ""; };
  }, [step, accessProvider, providerDiscoveryReload, visualFixture, form.endpointMode, form.manualBaseUrl]);
  useEffect(() => {
    if (step !== 3 || !accessProvider || !form.modelVendor || !form.modelId) return;
    void loadCapabilityRegistry();
  }, [step, accessProvider, form.modelVendor, form.modelId, registryIdentityType]);
  useEffect(() => {
    if (step !== 3 || stepThreeArea !== "routing") return;
    if (visualFixture) {
      const fixtureModels = getAiVisualFixtureData("modelQuota")?.models || [];
      setFallbackModels(fixtureModels.map((item) => ({ ...item, modelId: item.model, source: "VISUAL_QA_ONLY" })).filter((item) => item.modelId !== form.modelId));
      setFallbackModelsState("VISUAL_QA_ONLY");
      return undefined;
    }
    let active = true;
    setFallbackModelsState("LOADING");
    loadModelQuotaPages((query) => aiModelOperationsApi.list(query), { isCurrent: () => active }).then((result) => {
      if (!active) return;
      setFallbackModels(eligibleAiFallbackModels(result.items, form.modelId));
      setFallbackModelsState("READY");
    }).catch((error) => {
      if (!active) return;
      setFallbackModels([]);
      setFallbackModelsState(String(error?.code || "AI_MODEL_LIST_UNAVAILABLE").replace(/[^A-Z0-9_]/gi, "_").slice(0, 80));
    });
    return () => { active = false; };
  }, [step, stepThreeArea, form.modelId, fallbackModelsReload, visualFixture]);

  const pickLogo = async (file) => {
    setLogoError("");
    setLogoReference(null);
    const result = await validateModelLogoFile(file);
    if (!result.valid) { setLogoFile(null); setLogoDataUrl(""); setLogoError(`图片无法使用：${result.code}`); return; }
    const reader = new FileReader();
    reader.onerror = () => { setLogoFile(null); setLogoDataUrl(""); setLogoError("图片读取失败，已回到 Provider Logo。"); };
     reader.onload = () => { setLogoFile(file); setLogoDataUrl(String(reader.result || "")); setDirty(true); setNotice("图片预览已更新；保存能力尚未接入。"); };
    reader.readAsDataURL(file);
  };
  const uploadLogo = async () => {
    if (!logoFile || busy) return;
    setLogoError(""); setBusy("logo-upload");
    try {
      const reference = await adapter.uploadLogoAsset(logoFile);
      setLogoReference(reference);
    } catch (error) {
      const failure = presentAiAdapterFailure(error); setLogoError(`${failure.code}: ${failure.message}`);
    } finally { setBusy(""); }
  };
  const discover = () => {
    if (!form.providerId) { setNotice("请先选择 Provider。"); return; }
    const forced = new URLSearchParams(location.search).get("mockDiscoveryStatus");
    const status = forced || "SUCCESS_EMPTY";
     setDiscovery(status); setNotice(`MOCK · ${status}：未发送 HTTP 请求；可手工填写模型 ID。`);
  };
  const test = async () => {
    if (visualFixture) { setNotice("本地视觉预览已禁用连接测试；不会调用真实 Provider。"); return; }
    if (busy || connectionTestInFlightRef.current || !check()) return;
    connectionTestInFlightRef.current = true;
    const requestId = ++connectionTestRequestIdRef.current;
    setBusy("test"); setTestResult({ status: "TESTING", mock: true });
    try {
      const response = await adapter.testConnection({ id: form.providerId, provider: form.providerDisplayName, providerId: form.providerId, modelId: form.modelId.trim(), endpointMode: form.endpointMode, manualBaseUrl: form.endpointMode === "MANUAL" ? form.manualBaseUrl.trim() : undefined, mock: true });
      if (requestId !== connectionTestRequestIdRef.current) return;
      const status = response?.status === "TEST_SUCCESS" || response?.state === "SUCCESS" || response?.ok ? "TEST_SUCCESS" : "TEST_FAILED";
      const failure = status === "TEST_SUCCESS" ? null : presentAiAdapterFailure({ ...response, code: response?.code || response?.errorCode || response?.state, mock: true });
      setTestResult({ status, mock: true, message: status === "TEST_SUCCESS" ? "模拟通过；未访问 Provider。" : `${failure.code}: ${failure.message}` }); setNotice(`MOCK · ${status}。该结果不代表真实 Provider 已连接。`);
    } catch (error) { const failure = presentAiAdapterFailure({ ...error, mock: true }); setTestResult({ status: "TEST_FAILED", mock: true, message: `${failure.code}: ${failure.message}` }); setNotice("MOCK · 测试失败；草稿内容已保留。"); }
    finally { connectionTestInFlightRef.current = false; setBusy(""); }
  };
  const save = async (event) => {
    event.preventDefault(); if (busy || !check()) return;
    if (visualFixture) { setNotice("本地视觉预览为只读展示；不会保存草稿或调用 API/DB。"); return; }
    if (!saveGateRef.current.acquire()) { setNotice("MOCK · duplicate save ignored; request still in progress"); return; }
    setBusy("save"); setNotice("");
    try {
      const draftPayload = buildModelDraftPayload(form);
      Object.assign(draftPayload.model, buildModelStepThreePayload({ quota: quotaDraft, costs: costDraft, routing: routingDraft, capabilitySources }));
      await adapter.create({ provider: form.providerDisplayName, model: form.modelId.trim(), baseUrl: form.endpointMode === "MANUAL" ? form.manualBaseUrl.trim() : form.apiBaseUrl.trim() || form.defaultBaseUrl.trim(), type: form.connectionType, context: "unknown (context_window is not mapped)", quota: form.monthlyBudget || "0", secretConfigured: Boolean(form.secretConfigured), draftPayload, ...(logoFile && logoDataUrl ? { modelLogo: createLocalMockModelLogo(logoFile, logoDataUrl) } : {}) });
      setDirty(false); setNotice("MOCK · 草稿已写入本地内存列表；未保存到后台。"); await navigateWithAiFixture(onSaved);
    } catch (error) { const failure = presentAiAdapterFailure({ ...error, mock: true }); setNotice(["MODEL_ALREADY_EXISTS", "MODEL_REGISTRY_EXISTS"].includes(error?.code) ? "这个 Provider 下已有相同模型 ID；草稿仍保留。" : `${failure.message} 草稿内容已保留，可重试。`); }
    finally { saveGateRef.current.release(); setBusy(""); }
  };

  const runConnectionHealthCheck = async () => {
    if (visualFixture) {
      if (busy || connectionTestInFlightRef.current) return;
      const requestId = ++connectionTestRequestIdRef.current;
      connectionTestInFlightRef.current = true;
      setBusy("connection-health"); setConnectionHealth("TESTING"); setNotice("");
      const names = [...REQUIRED_MODEL_CONNECTION_CHECKS];
      const results = names.map((name) => ({ name, status: "PENDING", message: "等待检查 · 视觉样例" }));
      setConnectionChecks(results);
      try {
        const failedIndex = ({ auth: 2, timeout: 1, "rate-limit": 1, failure: 5 })[visualFixture.connectionState];
        for (let index = 0; index < names.length; index += 1) {
          if (requestId !== connectionTestRequestIdRef.current) return;
          results[index] = { name: names[index], status: "TESTING", message: "检查中 · 视觉样例" };
          setConnectionChecks([...results]);
          await new Promise((resolve) => setTimeout(resolve, 240));
          if (requestId !== connectionTestRequestIdRef.current) return;
          if (index === failedIndex) {
            const status = ({ auth: "AUTH_ERROR", timeout: "TIMEOUT", "rate-limit": "RATE_LIMITED", failure: "DEGRADED" })[visualFixture.connectionState];
            results[index] = { name: names[index], status: "FAIL", message: "检查未通过 · 视觉样例" };
            for (let rest = index + 1; rest < names.length; rest += 1) results[rest] = { name: names[rest], status: "SKIPPED", message: "前置检查未通过" };
            setConnectionChecks([...results]); setConnectionHealth(status);
            setTestResult({ status: "TEST_FAILED", mock: true, message: "视觉样例检查未通过，可修改配置后重新测试。" });
            return;
          }
          results[index] = { name: names[index], status: "PASS", message: ([120, 243, 318, 412, 186, 1245, 327, 638][index]) + " 毫秒 · 视觉样例" };
          setConnectionChecks([...results]);
        }
        setConnectionHealth("READY");
        setTestResult({ status: "TEST_SUCCESS", mock: true, message: "八项检查完成 · 仅视觉样例，未发送网络请求。" });
      } finally { connectionTestInFlightRef.current = false; setBusy(""); }
      return;
    }
    const requiresCredential = advancedConnection.authType !== "NONE";
    if (!accessProvider || (requiresCredential && !connectionSecretRef) || busy) return;
    setBusy("connection-health"); setConnectionHealth("TESTING"); setConnectionChecks([]); setNotice("");
    const testedFingerprint = connectionFingerprint.current;
    try {
      const result = await testAiModelConnection({ provider_id: accessProvider, model_vendor: form.modelVendor, model_identity_type: registryIdentityType, model_id: form.modelId.trim(), endpoint_mode: form.endpointMode, manual_base_url: form.endpointMode === "MANUAL" ? form.manualBaseUrl.trim() : undefined, connection_type: advancedConnection.connectionType, auth_type: advancedConnection.authType, ...(requiresCredential && connectionSecretRef ? { secret_ref: connectionSecretRef } : {}), deployment_type: advancedConnection.deploymentType, region: advancedConnection.region, custom_headers: projectConnectionParameters(customHeaders, connectionSecretRef), custom_query_params: projectConnectionParameters(customParams, connectionSecretRef), timeout_seconds: Number(advancedConnection.timeout), retry_count: Number(advancedConnection.retry), health_check_path: advancedConnection.healthPath, health_check_interval_seconds: Number(advancedConnection.healthInterval) });
      if (testedFingerprint !== connectionFingerprint.current) { setNotice("连接配置已变更，请重新测试。"); return; }
      const health = normalizeModelConnectionHealthResponse(result);
      setConnectionHealth(health.status);
      setConnectionChecks(health.checks);
      setTestResult({ status: health.status === "READY" ? "TEST_SUCCESS" : "TEST_FAILED", mock: false, message: health.message });
      if (health.status === "READY") await loadCapabilityRegistry();
    } catch (error) {
      if (testedFingerprint !== connectionFingerprint.current) return;
      const safeCode = String(error.code || "CONNECTION_TEST_FAILED").slice(0, 80);
      setConnectionHealth(safeCode === "CONNECTION_TEST_TIMEOUT" ? "TIMEOUT" : "UNAVAILABLE"); setTestResult({ status: "TEST_FAILED", mock: false, message: `${safeCode}: 连接校验未完成；详细响应已隐藏。` });
      setConnectionChecks([{ name: "Provider 连接校验 API", status: "UNAVAILABLE", message: safeCode }]);
      setNotice("真实连接校验未通过；草稿内容已保留。未发送或保存明文凭据。");
    } finally { setBusy(""); }
  };

  const persistConfiguration = async (enable = false) => {
    if (visualFixture) {
      if (busy || (enable && connectionHealth !== "READY")) return;
      setSavedRecord({ enabled: enable, dbReadback: false, model: {
        id: "visual-fixture-model", enabled: enable,
        model: { display_name: form.displayName, model_vendor: form.modelVendor, model_id: form.modelId, capabilities: [...form.capabilities] },
        quota_settings: { monthly_quota: quotaDraft.monthlyQuota },
        routing_strategy: { cost_strategy: routingDraft.costStrategy, route_priority: Number(routingDraft.priority) },
        connection: { access_provider_id: accessProvider },
      } });
      setDirty(false); setNotice("");
      return;
    }
    const requiresCredential = advancedConnection.authType !== "NONE";
    if (busy) return;
    if (!form.modelId || !form.displayName || !form.modelVendor) {
      setNotice("请先完成模型身份和模型名称。");
      return;
    }
    if (!accessProvider || (requiresCredential && !connectionSecretRef)) {
      setNotice(requiresCredential ? "请选择已保存的 ACCESS_PROVIDER 凭据；页面不会接收或保存明文密钥。" : "请选择 ACCESS_PROVIDER 后继续。");
      return;
    }
    if (enable && (connectionHealth !== "READY" || !REQUIRED_MODEL_CONNECTION_CHECKS.every((name) => connectionChecks.some((item) => item.name === name && ["PASS", "PASSED", "READY", "SUCCESS"].includes(item.status))))) {
      setNotice("启用前必须由连接校验服务完成全部八项检查并返回 READY。");
      return;
    }
    if (!saveGateRef.current.acquire()) return;
    setBusy(enable ? "enable" : "save-draft");
    setNotice("");
    try {
      const payload = buildAiModelConfigurationRequest({ form, accessProvider, secretRef: connectionSecretRef, advancedConnection, customHeaders, customParams, quota: quotaDraft, costs: costDraft, routing: routingDraft, capabilitySources });
      const result = await saveAiModelConfiguration(payload, { enable });
      setSavedRecord(result);
      setDirty(false);
      setNotice("");
    } catch (error) {
      const code = /^[A-Z0-9_]{1,80}$/.test(String(error?.code || "")) ? error.code : "AI_MODEL_SAVE_FAILED";
      setNotice(`保存或数据库读回未通过：${code}。配置仍保留在本页；未报告成功。`);
    } finally {
      saveGateRef.current.release();
      setBusy("");
    }
  };

  const connectionField = (label, value, onChange, options, name, required = false) => <label className="add-page-field" key={name}><span>{label}{required && <b className="required-star" aria-hidden="true"> *</b>}</span>{options ? <select aria-label={label} aria-required={required} value={value} onChange={(event) => onChange(event.target.value)} disabled={Boolean(busy)}>{options.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select> : <input aria-label={label} aria-required={required} value={value} onChange={(event) => onChange(event.target.value)} disabled={Boolean(busy)} />}</label>;
  const updateAdvancedConnection = (key, value) => setAdvancedConnection((current) => ({ ...current, [key]: value }));
  const renderConnectionPairs = (rows, setRows, label) => <div className="connection-pair-list">
    <header><b>{label}</b><button type="button" className="add-page-link" onClick={() => setRows((current) => [...current, { name: "", value: "" }])}>＋ 添加</button></header>
    {rows.length === 0 && <small>可选；不需要时留空。</small>}
    {rows.map((row, index) => <div className="connection-pair-row" key={`${label}-${index}`}>
      <input aria-label={`${label}名称 ${index + 1}`} value={row.name} placeholder="名称" onChange={(event) => setRows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))}/>
      <input aria-label={`${label}值 ${index + 1}`} value={row.value} placeholder="值（请勿填写密钥）" onChange={(event) => setRows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))}/>
      <button type="button" className="add-page-secondary" aria-label={`删除${label} ${index + 1}`} onClick={() => setRows((current) => current.filter((_, itemIndex) => itemIndex !== index))}>删除</button>
    </div>)}
  </div>;

  const field = (key) => {
    const required = ["providerName", "providerDisplayName", "providerId", "modelId", "displayName"].includes(key) || (key === "manualBaseUrl" && form.endpointMode === "MANUAL") || (key === "pricingSource" && form.pricingStatus === "VERIFIED");
     if (key === "providerName") return <fieldset className="add-page-provider-field" key={key}><legend>{labels[key]}{required && <b> *</b>}</legend><div className="add-page-provider-options" role="group" aria-label={labels[key]} aria-invalid={Boolean(errors.providerName)} tabIndex={-1} aria-describedby={errors.providerName ? "add-page-provider-error" : undefined}>{providerFixtures.map((fixture) => { const selected = form.providerName === fixture.name; const brandName = fixture.name === "CUSTOM" ? "自定义 Provider" : providerLogoName(fixture.name); return <button type="button" key={fixture.name} className={"add-page-provider-option" + (selected ? " selected" : "")} aria-pressed={selected} aria-label={brandName + " Provider"} onClick={() => change("providerName", fixture.name)} disabled={Boolean(busy)}><ProviderLogo provider={providerLogoName(fixture.name)} displayMode="compact"/><span><strong>{brandName}</strong><small>Provider</small></span><i aria-hidden="true">{selected ? "✓" : ""}</i></button>; })}</div>{errors.providerName && <small id="add-page-provider-error" className="add-page-error">{errors.providerName}</small>}</fieldset>;
    const multiOptions = { scenarioSupport: SCENARIO_CANDIDATES, inputModalities: MODALITY_CANDIDATES, outputModalities: MODALITY_CANDIDATES };
     if (multiOptions[key]) return <fieldset className="add-page-capabilities" key={key}><legend>{labels[key]}</legend><div>{multiOptions[key].map((option) => <label key={option}><input type="checkbox" checked={(form[key] || []).includes(option)} onChange={() => { const current = form[key] || []; change(key, current.includes(option) ? current.filter((item) => item !== option) : [...current, option]); }} />{localizeScenarioOrModality(option)}</label>)}</div><small>可选；未知时保持未选。</small>{errors[key] && <small className="add-page-error">{errors[key]}</small>}</fieldset>;
    if (key === "supportedLanguages") return <label className="add-page-field wide" key={key}><span>{labels[key]}</span><input aria-label={labels[key]} value={(form.supportedLanguages || []).join(", ")} placeholder="en, zh-CN" onChange={(event) => change(key, event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} /><small>用逗号分隔语言标签；未知时留空。</small>{errors[key] && <small className="add-page-error">{errors[key]}</small>}</label>;
    if (key === "enabled") return <label className="add-page-field" key={key}><span>{labels[key]}</span><select aria-label={labels[key]} value={form.enabled == null ? "" : String(form.enabled)} onChange={(event) => change(key, event.target.value === "" ? null : event.target.value === "true")}><option value="">{localizeFormOption("enabled", "")}</option><option value="true">{localizeFormOption("enabled", "true")}</option><option value="false">{localizeFormOption("enabled", "false")}</option></select><small>仅记录候选状态，不会启用线上模型。</small></label>;
    if (key === "costLevel" || key === "usageStrategy") {
      const labelsFor = key === "costLevel" ? { FREE: "免费", LOW: "低价", MEDIUM: "中价", HIGH: "高价" } : { PRIORITY: "优先", NORMAL: "普通", BACKUP: "备用", FALLBACK: "兜底" };
      return <fieldset className="add-page-choice-field" key={key}><legend>{labels[key]}</legend><div>{choices[key].map((option) => <button type="button" key={option} aria-pressed={form[key] === option} className={form[key] === option ? "selected" : ""} onClick={() => change(key, option)}>{labelsFor[option]}</button>)}</div>{key === "usageStrategy" && <small>普通：用于日常任务；备用与兜底按路由规则触发。</small>}</fieldset>;
    }
    if (key === "capabilities") {
      const groupIcons = { text: ChatCircleText, reasoning: Brain, tools: Wrench, vision: Eye, image: ImageSquare, video: VideoCamera, audio: Waveform, audio_video: UserFocus, other: SquaresFour };
      const capabilityIcons = { TEXT_GENERATION: ChatCircleText, STRUCTURED_OUTPUT: SquaresFour, COMPLEX_REASONING: Brain, TOOL_CALLING: Wrench, FUNCTION_CALLING: SquaresFour, RPA_PLANNER_TOOL_CALLING: Brain, IMAGE_UNDERSTANDING: Eye, OCR: MagnifyingGlass, DOCUMENT_UNDERSTANDING: ChatCircleText, IMAGE_GENERATION: ImageSquare, IMAGE_EDIT: Wrench, VIDEO_GENERATION: VideoCamera, TEXT_TO_VIDEO: VideoCamera, VIDEO_UNDERSTANDING: Eye, VIDEO_EDIT: VideoCamera, IMAGE_TO_VIDEO: ImageSquare, STT: Waveform, TTS: Waveform, VOICE_CLONE: UserFocus, REALTIME_VOICE: Waveform, LIP_SYNC: UserFocus, PORTRAIT_ANIMATION: UserFocus, FACE_EXPRESSION: UserFocus, HEAD_MOTION: UserFocus, SENTIMENT_ANALYSIS: ChatCircleText, NEXT_BEST_ACTION: SquaresFour };
      const isDefaultFixtureModel = Boolean(visualFixture && form.modelVendor === visualFixture.vendorId && form.modelId === visualFixture.modelId);
      const modelCapabilityTags = new Set(selectedModelRow?.[4] || []);
      const visualModelCapabilities = new Set(["TEXT_GENERATION"]);
      if (["推理", "深度推理", "推理增强"].some((tag) => modelCapabilityTags.has(tag))) visualModelCapabilities.add("COMPLEX_REASONING");
      if (["多模态", "图像理解"].some((tag) => modelCapabilityTags.has(tag))) visualModelCapabilities.add("IMAGE_UNDERSTANDING");
      if (modelCapabilityTags.has("图像生成")) visualModelCapabilities.add("IMAGE_GENERATION");
      if (modelCapabilityTags.has("工具调用")) visualModelCapabilities.add("TOOL_CALLING");
      const control = (cap) => {
        const registrySource = registryCapabilitySources[cap];
        const definition = AI_CAPABILITY_CATALOG.find((item) => item.id === cap);
        const CapabilityIcon = capabilityIcons[cap] || groupIcons[definition?.group] || SquaresFour;
        const fixtureStatus = isDefaultFixtureModel ? (visualFixture?.capabilityStatus?.[cap] || "UNKNOWN") : form.capabilities.includes(cap) ? "ENABLED" : visualModelCapabilities.has(cap) ? "AVAILABLE" : "UNKNOWN";
        const fixtureSelectable = Boolean(visualFixture && ["ENABLED", "AVAILABLE"].includes(fixtureStatus));
        const selectable = customCapabilityManualAllowed || Boolean(registrySource) || fixtureSelectable;
        const state = visualFixture ? (form.capabilities.includes(cap) ? "ENABLED" : fixtureStatus === "ENABLED" ? "AVAILABLE" : fixtureStatus) : form.capabilities.includes(cap) ? "ENABLED" : registrySource ? "AVAILABLE" : "UNKNOWN";
        const statusLabel = visualFixture ? ({ ENABLED: "已启用", AVAILABLE: "可用", UNAVAILABLE: "不支持", UNKNOWN: "待确认" })[state] : form.capabilities.includes(cap) ? (capabilitySources[cap] || "来源待读回") : registrySource || (customCapabilityManualAllowed ? "允许人工补充" : "等待元数据/Registry 验证");
        return <label className={`${selectable ? "" : "capability-unverified"} capability-state-${state.toLowerCase()}`} data-capability={cap} data-group={definition?.group || "other"} data-status={state} key={cap}>
          <input type="checkbox" checked={form.capabilities.includes(cap)} disabled={!selectable || Boolean(busy)} onChange={() => {
            const has = form.capabilities.includes(cap);
            if (!has && form.capabilities.length >= 10) { setErrors((old) => ({ ...old, capabilities: "最多选择 10 项。" })); return; }
            change("capabilities", has ? form.capabilities.filter((item) => item !== cap) : [...form.capabilities, cap]);
            setCapabilitySources((old) => { const next = { ...old }; if (has) delete next[cap]; else if (customCapabilityManualAllowed) next[cap] = "MANUAL_USER_SUPPLEMENT"; else if (visualFixture) next[cap] = "VISUAL_QA_ONLY"; else if (registrySource) next[cap] = registrySource; return next; });
          }}/>
          <i aria-hidden="true"><CapabilityIcon size={20} weight="regular" /></i><span><b>{localizeCapability(cap)}</b><code>{cap}</code></span><em className="capability-description">{FROZEN_CAPABILITY_DESCRIPTIONS[cap] || "当前模型能力支持状态"}</em><small>{statusLabel}</small>
        </label>;
      };
      const registryMessage = visualFixture ? "本地视觉预览 · 实际能力以模型登记信息和服务商连接器核验结果为准。" : capabilityRegistryState === "LOADING" ? "正在读取模型能力登记信息…" : capabilityRegistryState === "READY" ? "能力登记信息已读取 · 已核验 " + Object.keys(registryCapabilitySources).length + " 项" : capabilityRegistryState === "NOT_READY" ? "选择接入服务商和模型后读取能力登记信息。" : "能力登记信息暂不可用（" + capabilityRegistryState + "）；官方能力保持禁用。";
      const groupNames = { text: "文本与 Agent", reasoning: "文本与 Agent", tools: "文本与 Agent", vision: "视觉理解", image: "图像生成与编辑", video: "视频理解与生成", audio: "语音与音频", audio_video: "其他能力", other: "其他能力" };
      const groupOrder = ["文本与 Agent", "视觉理解", "图像生成与编辑", "视频理解与生成", "语音与音频", "其他能力"];
      const renderGroups = (ids) => {
        const grouped = new Map();
        for (const id of ids) {
          const definition = AI_CAPABILITY_CATALOG.find((item) => item.id === id);
          const name = visualFixture && ["LIP_SYNC", "PORTRAIT_ANIMATION"].includes(id) ? "视频理解与生成" : groupNames[definition?.group] || "其他能力";
          if (!grouped.has(name)) grouped.set(name, []);
          grouped.get(name).push(id);
        }
        return groupOrder.filter((name) => grouped.has(name)).map((name) => <section className="step-three-capability-group" key={name}><header><b>{name}</b></header><div>{grouped.get(name).map(control)}</div></section>);
      };
      const primaryCapabilityOrder = visualFixture
        ? ["TEXT_GENERATION", "STRUCTURED_OUTPUT", "TOOL_CALLING", "RPA_PLANNER_TOOL_CALLING", "IMAGE_UNDERSTANDING", "OCR", "DOCUMENT_UNDERSTANDING", "IMAGE_GENERATION", "IMAGE_EDIT", "VIDEO_GENERATION", "VIDEO_EDIT", "PORTRAIT_ANIMATION", "LIP_SYNC", "STT", "TTS", "VOICE_CLONE", "REALTIME_VOICE", "SENTIMENT_ANALYSIS", "NEXT_BEST_ACTION"]
        : ["TEXT_GENERATION", "STRUCTURED_OUTPUT", "COMPLEX_REASONING", "TOOL_CALLING", "IMAGE_UNDERSTANDING", "OCR", "IMAGE_GENERATION", "IMAGE_EDIT", "TEXT_TO_VIDEO", "VIDEO_UNDERSTANDING", "VIDEO_EDIT", "STT", "TTS", "VOICE_CLONE", "REALTIME_VOICE", "LIP_SYNC", "PORTRAIT_ANIMATION"];
      const primaryCapabilityRank = new Map(primaryCapabilityOrder.map((id, index) => [id, index]));
      const fixtureLegacyAliases = new Set(["STRUCTURED_OUTPUT_JSON", "VISION_UNDERSTANDING", "IMAGE_EDITING", "VIDEO_EDITING"]);
      const orderedCapabilities = [...capabilityCandidates]
        .filter((id) => !visualFixture || !fixtureLegacyAliases.has(id))
        .sort((left, right) => (primaryCapabilityRank.get(left) ?? 1000) - (primaryCapabilityRank.get(right) ?? 1000));
      const visibleLimitByGroup = visualFixture
        ? { text: 2, reasoning: 0, tools: 2, vision: 3, image: 2, video: 4, audio: 4, audio_video: 3, other: 0 }
        : { text: 2, reasoning: 1, tools: 1, vision: 3, image: 2, video: 4, audio: 4, audio_video: 3 };
      const visibleCounts = new Map();
      const visibleCapabilities = [];
      const additionalCapabilities = [];
      for (const id of orderedCapabilities) {
        const group = AI_CAPABILITY_CATALOG.find((item) => item.id === id)?.group || "other";
        const count = visibleCounts.get(group) || 0;
        if (visualFixture ? primaryCapabilityRank.has(id) : count < (visibleLimitByGroup[group] ?? 2)) {
          visibleCapabilities.push(id);
          visibleCounts.set(group, count + 1);
        } else additionalCapabilities.push(id);
      }
      return <fieldset className="add-page-capabilities" key={key}><legend>{labels[key]}</legend><p>{customCapabilityManualAllowed ? "自定义/私有/本地模型支持可追溯的人工补充。" : "官方能力仅允许选择当前模型 Registry 中有验证证据的能力。"}</p><small aria-live="polite">{registryMessage} {accessProvider && form.modelId && !visualFixture && <button type="button" className="capability-registry-retry" onClick={() => void loadCapabilityRegistry()} disabled={capabilityRegistryState === "LOADING"}>重试</button>}</small><div className="step-three-capability-groups">{renderGroups(visibleCapabilities)}</div>{errors.capabilities && <small className="add-page-error">{errors.capabilities}</small>}</fieldset>;
    }
    if ((key === "manualBaseUrl" && form.endpointMode !== "MANUAL") || (key === "pricingSource" && form.pricingStatus !== "VERIFIED")) return null;
    if (choices[key]) return <label className="add-page-field" key={key}><span>{labels[key]}{required && <b> *</b>}</span><select aria-label={labels[key]} value={form[key]} aria-invalid={Boolean(errors[key])} onMouseDown={() => { selectEscapeRef.current = true; }} onBlur={() => { selectEscapeRef.current = false; }} onChange={(e) => { selectEscapeRef.current = false; change(key, e.target.value); }} disabled={Boolean(busy)}><option value="">选择…</option>{choices[key].map((option) => <option key={option} value={option}>{optionLabel(key, option)}</option>)}</select>{errors[key] && <small className="add-page-error">{errors[key]}</small>}{hints[key] && <small>{hints[key]}</small>}</label>;
    const unavailable = key === "contextWindow";
    const type = numeric.has(key) ? "number" : "text";
    const props = {};
    if (limits[key]) props.maxLength = limits[key];
    if (numeric.has(key)) { props.min = 0; props.step = ["rpm", "tpm", "rpd", "warningThreshold"].includes(key) ? 1 : "any"; if (key === "rpm" || key === "rpd") props.max = 10000000; if (key === "tpm") props.max = 1000000000; if (key === "warningThreshold") props.max = 100; }
    return <label className={`add-page-field ${["apiBaseUrl", "defaultBaseUrl", "manualBaseUrl", "endpointDetails", "contextWindow"].includes(key) ? "wide" : ""}`} key={key}><span>{labels[key]}{required && <b> *</b>}</span><input aria-label={labels[key]} type={type} value={key === "qualityTier" && form[key] === "UNKNOWN" ? "" : toControlledInputValue(form[key])} {...props} disabled={Boolean(busy) || unavailable} aria-invalid={Boolean(errors[key])} placeholder={unavailable ? "未映射；保持空白" : key === "qualityTier" && form[key] === "UNKNOWN" ? localizeFormOption("qualityTier", "UNKNOWN") : ""} onChange={(e) => change(key, e.target.value)} />{hints[key] && <small>{hints[key]}</small>}{errors[key] && <small className="add-page-error">{errors[key]}</small>}</label>;
  };

  if (savedRecord) {
    const saved = savedRecord.model;
    const resultState = projectAddModelResultState(savedRecord, connectionHealth);
    const savedModel = saved.model || {};
    const savedQuota = saved.quota_settings || {};
    const savedRoute = saved.routing_strategy || {};
    const savedCapabilities = savedModel.capabilities || [];
    // Context length is model-catalog metadata, not a persisted quota/schema field.
    // Resolve it from the selected model catalog for the visual success summary.
    const selectedModelVendor = MODEL_VENDOR_CATALOG.find((vendor) => vendor.id === String(savedModel.model_vendor || form.modelVendor || "").toUpperCase()) || selectedVendor;
    const catalogContextWindow = selectedModelVendor.models.find(([id]) => id === (savedModel.model_id || form.modelId))?.[3];
    const contextWindowSummary = savedModel.context_window || savedModel.contextWindow || catalogContextWindow || modelPreview?.contextWindow || "未知";
    const quotaSummary = savedQuota.monthly_quota == null ? "未设置" : String(savedQuota.monthly_quota);
    const routeSummary = resultState.routeSummary;
    return <div className="ai-feature"><AiVisualFixtureNotice/><main className="add-model-page add-model-wizard model-save-success" ref={pageRef}>
      <header className="add-page-heading"><div><span className="add-page-eyebrow">模型配置</span><h1>添加模型</h1><p>选择模型厂商和具体模型，然后进行连接配置，完成后即可启用。</p></div><span className="connection-status-pill" data-status={resultState.enabled ? "READY" : "UNTESTED"}>{visualFixture ? "视觉样例" : resultState.enabled ? "已启用" : "草稿"}</span></header>
      <nav className="add-model-stepper" aria-label="添加模型步骤">{[[1,"选择模型","选择模型厂商和具体模型"],[2,"连接配置","配置接入凭据和连接参数"],[3,"能力、配额与路由","设置模型参与策略"]].map(([number,title,detail])=><button type="button" key={number} className="complete"><b>✓</b><span><strong>{title}</strong><small>{detail}</small></span></button>)}</nav>
      <section className="model-save-success-layout">
        <div className="model-save-success-main">
          <section className="add-page-card model-save-success-card" role="status"><CheckCircle size={58}/><h2>{resultState.enabled ? "模型添加并启用成功！" : "模型草稿已保存"}</h2><p>{visualFixture ? "演示成功页样式；没有保存、启用或写入任何真实数据。" : `${savedModel.display_name || form.displayName} ${resultState.enabled ? "已成功添加到 AI 网关，并完成所有配置，现在可以正常使用。" : "已保存为草稿；模型尚未启用。"}`}</p>
            <div className="model-save-identity"><div className="add-page-model-icon"><AddModelVendorLogo vendor={MODEL_VENDOR_CATALOG.find((vendor)=>vendor.id===(savedModel.model_vendor || form.modelVendor))} provider={providerLogoName(savedModel.model_vendor || form.modelVendor)}/></div><div><b>{savedModel.display_name || form.displayName}</b><small>提供商　{savedModel.model_vendor || form.modelVendor}　 │　模型类型　{savedModel.model_id || form.modelId}</small><span>{visualFixture ? "演示状态：未改变真实模型状态" : resultState.enabled ? "模型已启用" : "草稿未启用"}</span></div><strong data-enabled={resultState.enabled}>{visualFixture ? "演示状态" : resultState.enabled ? "已启用" : "草稿"}</strong></div>
            <div className="model-save-summary-grid"><article><i className="success-metric-icon">◉</i><span>连接状态</span><b data-status={resultState.connectionStatus}>{resultState.enabled ? "就绪" : resultState.connectionStatus === "UNTESTED" ? "待测试" : resultState.connectionStatus}</b><small>{resultState.enabled ? "API 连接正常" : "模型尚未启用"}</small></article><article><i className="success-metric-icon">▦</i><span>已启用能力</span><b>{savedCapabilities.length}</b><small>{savedCapabilities.length ? savedCapabilities.map(localizeCapability).slice(0,4).join("、") : "尚无已启用能力"}</small></article><article><i className="success-metric-icon">▤</i><span>配额配置</span><b>{contextWindowSummary}</b><small>上下文窗口（模型目录）</small></article><article><i className="success-metric-icon">⌘</i><span>路由策略</span><b>{({ BALANCED: "均衡策略", FIXED_MODEL: "固定模型", FASTEST: "最快响应", CHEAPEST_QUALIFIED: "最低成本", BEST_QUALITY: "优先质量" })[savedRoute.cost_strategy] || (resultState.routingActive ? "均衡策略" : "未参与路由")}</b><small>{resultState.routingActive ? `优先级 ${savedRoute.route_priority ?? routingDraft.priority}` : "启用后参与 AI 网关"}</small></article></div>
            <ul className="model-save-checks"><li><CheckCircle size={15}/>{visualFixture ? "视觉样例：未执行数据库读回" : savedRecord.dbReadback ? "服务端保存与数据库读回一致" : "数据库读回未确认"}</li><li><CheckCircle size={15}/>{visualFixture ? "演示成功状态：未改变真实模型状态" : resultState.enabled ? "模型状态已启用" : "模型保留为未启用草稿"}</li><li><CheckCircle size={15}/>{visualFixture ? "未修改线上路由" : resultState.routingActive ? "模型已参与当前路由策略" : "草稿不会参与线上路由"}</li></ul>
            <footer><button type="button" className="add-page-primary" onClick={() => document.querySelector("#model-save-detail-dialog")?.showModal()}>查看模型详情</button><button type="button" className="add-page-secondary" onClick={() => { try { window.sessionStorage.setItem("aiModelQuotaLastSavedReadback", JSON.stringify({ id: saved.id, providerName: connectionProviders.find((item) => item.id === saved.connection?.access_provider_id)?.name || form.modelVendor })); } catch {} void navigateWithAiFixture(onSaved, saved); }}>返回模型与额度</button><button type="button" className="add-page-secondary" onClick={() => window.location.assign(visualFixture ? "/ai-center/models/add?aiVisualFixture=1" : "/ai-center/models/add")}>继续添加模型</button></footer>
          </section>
          <dialog id="model-save-detail-dialog" className="model-save-detail-dialog" onKeyDown={(event)=>{if(event.key==="Escape")event.stopPropagation();}}><header><div><small>模型详情</small><h2>{savedModel.display_name || form.displayName}</h2></div><button type="button" aria-label="关闭模型详情" onClick={()=>document.querySelector("#model-save-detail-dialog")?.close()}>×</button></header><dl><dt>模型厂商</dt><dd>{savedModel.model_vendor || form.modelVendor}</dd><dt>模型编号</dt><dd>{savedModel.model_id || form.modelId}</dd><dt>接入服务商</dt><dd>{connectionProviders.find((item)=>item.id===saved.connection?.access_provider_id)?.name || (visualFixture ? "OpenAI Platform · 视觉样例" : "接入服务商未匹配")}</dd><dt>连接状态</dt><dd>{resultState.enabled || resultState.connectionStatus === "READY" ? "连接正常" : resultState.connectionStatus === "UNTESTED" ? "待测试" : "连接状态未知"}</dd><dt>月度额度</dt><dd>{quotaSummary}</dd><dt>上下文长度</dt><dd>{contextWindowSummary}</dd></dl><p>{visualFixture ? "视觉样例 · 未保存真实配置，也未执行数据库读回。" : savedRecord.dbReadback ? "已完成服务端保存与数据库读回核对。" : "数据库读回尚未确认。"}</p><footer><button type="button" onClick={()=>document.querySelector("#model-save-detail-dialog")?.close()}>关闭</button></footer></dialog>
        </div>
        <LiveConfigurationPreview step={3} form={form} vendorName={selectedVendor.name} logoProvider={providerLogoName(savedModel.model_vendor || form.modelVendor)} identityMode={identityMode} visualFixture={visualFixture} accessProviderName={connectionProviders.find((item) => item.id === savedModel.connection?.access_provider_id)?.name} connectionSecretRef={connectionSecretRef} connectionHealth={resultState.connectionStatus} connectionChecks={connectionChecks} costDraft={costDraft} quotaDraft={quotaDraft} routingDraft={routingDraft} stepThreeArea={stepThreeArea} savedModel={savedModel} savedEnabled={resultState.enabled} savedDbReadback={savedRecord.dbReadback} savedCapabilities={savedCapabilities} routeSummary={routeSummary}/>
      </section>
    </main></div>;
  }
  return <div className="ai-feature"><AiVisualFixtureNotice/><main className="add-model-page add-model-wizard" ref={pageRef}>

       <header className="add-page-heading"><button type="button" className="add-page-back" onClick={requestExit} aria-label="返回模型列表"><ArrowLeft size={18} />返回模型列表</button><div><span className="add-page-eyebrow">模型配置</span><h1>添加模型</h1><p>选择模型厂商和具体模型，然后进行连接配置，完成后即可启用。</p></div><span className="add-page-draft-chip"><WarningCircle size={14}/>草稿 · 未验证</span></header>
    <nav className="add-model-stepper" aria-label="添加模型步骤">{[[1,"选择模型","选择模型厂商和具体模型"],[2,"连接配置","选择凭据引用和连接参数"],[3,"模型能力","配置能力、配额与路由"]].map(([number,title,detail])=><button type="button" key={number} className={step===number?"active":step>number?"complete":""} onClick={()=>number<step&&setStep(number)} disabled={number>step}><b>{step>number?"✓":number}</b><span><strong>{title}</strong><small>{detail}</small></span></button>)}</nav>
     {step===1 ? <section className="model-select-layout" aria-label="选择模型">
       <div className="model-select-main">
         <section className="model-vendor-panel add-page-section"><header><span className="add-page-step">1</span><div><h2>选择模型厂商 <b className="required-star" aria-label="必填">*</b></h2><p>选择后自动载入该厂商的模型名称；完成连接后自动读取服务商目录并校准。</p></div></header><div className="model-vendor-grid">{visibleVendors.map((vendor)=><button type="button" key={vendor.id} aria-pressed={form.modelVendor===vendor.id} className={form.modelVendor===vendor.id?"selected":""} onClick={()=>{const firstModel=vendor.models[0];setVendorId(vendor.id);setModelSearch("");setCategoryFilter("全部");setCapabilityFilter("全部");setModalityFilter("全部");setContextFilter("全部");setQuickFilter("");setIdentityMode("");setShowMoreVendors(false);setForm((old)=>({...old,modelVendor:vendor.id,modelIdentityType:"OFFICIAL",modelId:firstModel?.[0]||"",displayName:firstModel?.[1]||"",capabilities:[]}));setDirty(true);}}><span className="model-vendor-mark"><AddModelVendorLogo vendor={vendor} provider={providerLogoName(vendor.id)}/></span><span><strong>{vendor.name}</strong><small>{vendor.category}</small></span>{form.modelVendor===vendor.id&&<b className="model-vendor-check">✓</b>}</button>)}<button type="button" className={"model-vendor-more-entry" + (!VENDOR_TILES.includes(form.modelVendor) ? " selected" : "")} aria-pressed={!VENDOR_TILES.includes(form.modelVendor)} aria-expanded={showMoreVendors} onClick={openMoreVendors}><span className="model-vendor-mark" aria-hidden="true">···</span><span><strong>更多厂商</strong><small>{!VENDOR_TILES.includes(form.modelVendor) ? `已选：${committedVendor.name}` : "浏览其他厂商与自定义模型"}</small></span></button></div></section>
         <section className="model-catalog-panel add-page-section"><header><span className="add-page-step">2</span><div><h2>选择具体模型 <b className="required-star" aria-label="必填">*</b></h2><p>{hasAuthoritativeModelCatalog ? `已自动读取接入服务商目录：${providerModelDiscovery.models.length} 个模型；仅展示与所选厂商准确匹配的名称。` : `已自动载入 ${selectedVendor.name} 模型名称；连接服务商后将读取实时目录。`}</p></div></header><div className="model-catalog-filters"><label className="model-catalog-search"><MagnifyingGlass size={17}/><input aria-label="搜索模型" placeholder="搜索模型名称、标签或描述..." value={modelSearch} onChange={(event)=>setModelSearch(event.target.value)}/></label>{[["模型分类",categoryFilter,setCategoryFilter,["全部","通用大模型"]],["能力筛选",capabilityFilter,setCapabilityFilter,["全部","推理","多模态","代码","工具调用","文本","图像生成"]],["输入模态",modalityFilter,setModalityFilter,["全部","文本","图像","视频","音频"]],["上下文长度",contextFilter,setContextFilter,["全部","128K+","128K 以下"]]].map(([label,value,set,options])=><label className="model-catalog-filter" key={label}><span>{label}</span><select aria-label={label} value={value} onChange={(event)=>set(event.target.value)}>{options.map((option)=><option key={option} value={option}>{option}</option>)}</select></label>)}</div><div className="model-quick-filters" aria-label="快捷筛选">{["最新","推荐","长上下文","低成本"].map((item)=><button type="button" key={item} className={quickFilter===item?"selected":""} onClick={()=>setQuickFilter(quickFilter===item?"":item)}>{item}</button>)}</div>{providerModelDiscovery.status==="LOADING"&&<div className="model-live-catalog-note" role="status">正在自动读取已连接服务商的模型目录…</div>}{hasAuthoritativeModelCatalog&&<div className="model-live-catalog-note" role="status">已读取 {providerModelDiscovery.models.length} 个实时模型名称；{matchedLiveVendorModels.length ? `其中 ${matchedLiveVendorModels.length} 个与 ${selectedVendor.name} 厂商目录关联。` : "未发现可安全归属到当前厂商的名称，避免误选；请核对厂商与接入服务商配置。"}</div>}<div className="model-catalog-table"><div className="model-catalog-head"><span>模型名称</span><span>标签</span><span>上下文长度</span><span>主要能力</span><span>发布日期</span></div>{visibleModels.map(([id,name,tag,context,capabilities])=><button type="button" key={id} className={form.modelId===id?"model-catalog-row selected":"model-catalog-row"} aria-pressed={form.modelId===id} onClick={()=>{if(form.modelVendor!=="CUSTOM")setIdentityMode("");setForm((old)=>({...old,modelVendor:vendorId,modelIdentityType:old.modelVendor==="CUSTOM"?(old.modelIdentityType||"CUSTOM"):"OFFICIAL",modelId:id,displayName:name}));setDirty(true);}}><span><i/>{name}</span><span><b className={`model-catalog-badge ${VENDOR_BADGES[tag]||""}`}>{hasAuthoritativeModelCatalog?"实时可用":tag}</b></span><span>{context}</span><span>{capabilities.join(" · ")}</span><span>{MODEL_RELEASE_DATES[id]||"—"}</span></button>)}</div>{visibleModels.length===0&&<p className="model-catalog-empty">{hasAuthoritativeModelCatalog?"实时目录没有与所选厂商准确匹配的模型名称，未将其他厂商模型混入。":"没有匹配的模型，请调整搜索或筛选条件。"}</p>}<footer className="model-catalog-footer"><span>共 {visibleModels.length} 个{hasAuthoritativeModelCatalog?"已匹配模型名称":"厂商模型名称"}</span><span>目录：{hasAuthoritativeModelCatalog?"服务商实时结果":"自动载入的厂商候选"}</span></footer></section>
       </div>
       <aside className={"model-select-aside" + (showMoreVendors ? " is-expanded" : "")}>
         <LiveConfigurationPreview step={1} form={form} vendorName={committedVendor.name} logoProvider={providerLogoName(form.modelVendor)} identityMode={identityMode} visualFixture={visualFixture} accessProviderName={connectionProviders.find((item)=>item.id===accessProvider)?.name} connectionSecretRef={connectionSecretRef} connectionHealth={connectionHealth} connectionChecks={connectionChecks} costDraft={costDraft} quotaDraft={quotaDraft} routingDraft={routingDraft} stepThreeArea={stepThreeArea}/>
        {showMoreVendors && <section className="add-page-card model-more-panel" aria-label="更多模型侧边目录">
           <header><div><span>扩展模型目录</span><h2>更多厂商 / 自定义接入</h2></div><button type="button" aria-label="取消并关闭更多厂商" onClick={cancelMoreVendors}>×</button></header>
           <p>扩展目录仅在此侧栏浏览。确认前不会改动主页面已选模型。</p>
           <nav className="model-more-tabs" aria-label="扩展目录类型"><button type="button" className={moreActiveTab==="VENDORS"?"active":""} aria-pressed={moreActiveTab==="VENDORS"} onClick={()=>setMoreActiveTab("VENDORS")}>更多厂商</button><button type="button" className={moreActiveTab==="CUSTOM"?"active":""} aria-pressed={moreActiveTab==="CUSTOM"} onClick={()=>setMoreActiveTab("CUSTOM")}>自定义接入</button></nav>
           {moreActiveTab === "VENDORS" && <label className="model-vendor-search"><MagnifyingGlass size={15}/><input aria-label="搜索更多模型厂商" value={moreVendorSearch} onChange={(event)=>setMoreVendorSearch(event.target.value)} placeholder="搜索厂商名称或标识…"/></label>}
           <div className={"model-more-workspace" + (moreActiveTab === "CUSTOM" ? " is-custom-tab" : "")}>
             {moreActiveTab === "CUSTOM" ? <div className="model-custom-access-pane"><h3>自定义接入方式</h3><p>适用于兼容接口、私有部署和本地模型。填写模型身份后，在连接配置中设置 Base URL 与 API Key。</p><div className="model-custom-identity-options">{[["CUSTOM","自定义 OpenAI 兼容","通过兼容接口接入模型服务"],["LOCAL","本地模型","接入本地部署的模型服务"],["AGGREGATOR","第三方聚合平台","通过聚合服务统一接入模型"],["PRIVATE","私有端点","接入企业内部模型服务"]].map(([mode,title,description])=><button type="button" key={mode} className={moreIdentityDraftMode===mode?"selected":""} aria-pressed={moreIdentityDraftMode===mode} onClick={()=>{setMoreIdentityDraftMode(mode);setMoreVendorDraftId("CUSTOM");setMoreModelDraftId("");}}><span className="custom-access-icon" aria-hidden="true">{mode === "CUSTOM" ? <ChatCircleText size={30}/> : mode === "LOCAL" ? <Brain size={30}/> : mode === "AGGREGATOR" ? <SquaresFour size={30}/> : <Key size={30}/>}</span><b>{title}</b><small>{description}</small></button>)}</div>{moreIdentityDraftMode ? <div className="model-custom-identity-fields"><label>所属团队或厂商<input aria-label="暂存模型所属团队或厂商" value={moreCustomDraft.providerDisplayName} onChange={(event)=>setMoreCustomDraft((old)=>({...old,providerDisplayName:event.target.value}))} placeholder="例如：企业内部模型团队"/></label><label>模型编号<input aria-label="暂存自定义模型编号" value={moreCustomDraft.modelId} onChange={(event)=>setMoreCustomDraft((old)=>({...old,modelId:event.target.value,displayName:old.displayName||event.target.value}))} placeholder="例如：private-chat-v1"/></label><label>模型显示名称<input aria-label="暂存模型显示名称" value={moreCustomDraft.displayName} onChange={(event)=>setMoreCustomDraft((old)=>({...old,displayName:event.target.value}))} placeholder="输入模型名称"/></label></div> : <div className="model-more-empty"><b>请选择一种接入方式</b><span>先选择模型身份，再填写模型编号和显示名称。</span></div>}</div> : <><div className="model-more-vendors"><h3>模型厂商 <small>扩展目录</small></h3><div>{searchedVendors.filter((vendor)=>!VENDOR_TILES.includes(vendor.id) || vendor.id === "XAI").map((vendor)=><button type="button" key={vendor.id} className={"model-more-vendor-option" + (moreVendorDraftId===vendor.id && !moreIdentityDraftMode ? " selected" : "")} aria-pressed={moreVendorDraftId===vendor.id && !moreIdentityDraftMode} onClick={()=>{setMoreVendorDraftId(vendor.id);setMoreModelDraftId(authoritativeVendorModels(vendor)[0]?.[0]||"");setMoreIdentityDraftMode("");}}><AddModelVendorLogo vendor={vendor} provider={resolveProviderLogoName(vendor.id)}/><span><strong>{vendor.id === "XAI" ? "Grok" : vendor.name}</strong><small>{vendor.category}</small></span></button>)}<button type="button" className="model-more-vendor-option" onClick={()=>setMoreActiveTab("CUSTOM")}><span className="model-other-vendor-mark" aria-hidden="true">•••</span><span><strong>其他模型厂商</strong><small>通过自定义接入更多模型</small></span></button></div></div>
             <div className="model-more-catalog">
               {moreSelectedVendor ? <><header className="model-more-catalog-heading"><div><span>浏览扩展目录</span><h3>{moreSelectedVendor.name} · {availableMoreModels.length} 个模型</h3></div></header>
                 <label className="model-vendor-search"><MagnifyingGlass size={14}/><input aria-label="搜索扩展模型" value={moreModelSearch} onChange={(event)=>setMoreModelSearch(event.target.value)} placeholder="搜索模型名称、标签或能力…"/></label>
                 <div className="model-more-filters"><label>能力<select aria-label="扩展模型能力筛选" value={moreCapabilityFilter} onChange={(event)=>setMoreCapabilityFilter(event.target.value)}>{["全部","推理","多模态","代码","工具调用","文本","图像生成"].map((value)=><option key={value}>{value}</option>)}</select></label><label>模态<select aria-label="扩展模型模态筛选" value={moreModalityFilter} onChange={(event)=>setMoreModalityFilter(event.target.value)}>{["全部","文本","图像","视频","音频"].map((value)=><option key={value}>{value}</option>)}</select></label><label>上下文<select aria-label="扩展模型上下文筛选" value={moreContextFilter} onChange={(event)=>setMoreContextFilter(event.target.value)}>{["全部","128K+","128K 以下"].map((value)=><option key={value}>{value}</option>)}</select></label></div>
                 <div className="model-more-model-list" aria-label="扩展模型候选">{visibleMoreModels.map(([id,name,tag,context,capabilities])=><button type="button" key={id} className={moreModelDraftId===id?"selected":""} aria-pressed={moreModelDraftId===id} onClick={()=>setMoreModelDraftId(id)}><span><b>{name}</b><small>{tag}</small></span><span>{context}</span></button>)}{visibleMoreModels.length===0&&<p>没有匹配模型，请调整筛选条件。</p>}</div>
                 {moreSelectedModel&&<article className="model-more-detail"><h4>模型详情</h4><b>{moreSelectedModel[1]}</b><code>{moreSelectedModel[0]}</code><span>上下文：{moreSelectedModel[3]}</span><span>能力：{moreSelectedModel[4].length?moreSelectedModel[4].join(" · "):"待 Registry 验证"}</span></article>}</> : <div className="model-more-empty"><b>选择一个扩展厂商</b><span>厂商、模型浏览与筛选都将在此侧栏完成。</span></div>}
             </div></>}
           </div>
           <footer className="model-more-actions"><button type="button" className="add-page-secondary" onClick={cancelMoreVendors}>取消</button><button type="button" className="add-page-primary" disabled={moreIdentityDraftMode ? !moreCustomDraft.modelId.trim() : !moreSelectedModel} onClick={confirmMoreSelection}>确认选择</button></footer>
         </section>}
       </aside>
     </section> : step===2 ? <section className="model-connection-step" aria-label="连接配置">
       <section className="model-connection-main add-page-section">
         <header><span className="add-page-step">1</span><div><h2>连接配置</h2><p>填写服务地址并安全关联 API Key。</p></div><span className="connection-status-pill" data-status={connectionHealth}>{({ UNTESTED: "未测试", TESTING: "测试中", READY: "已就绪", DEGRADED: "需检查", RATE_LIMITED: "请求受限", AUTH_ERROR: "认证失败", TIMEOUT: "连接超时", UNAVAILABLE: "不可用", DISABLED: "已停用" })[connectionHealth] || "状态未知"}</span></header>
         <div className="connection-grid">
           <AccessProviderPicker value={accessProvider} providers={connectionProviders} disabled={Boolean(busy)} directoryState={connectionDirectoryState} onChange={(value)=>{const selected=connectionProviders.find((item)=>item.id===value);setAccessProvider(value);setConnectionSecretRef(selected?.credentialConfigured?selected.secretRef||"":"");setConnectionHealth("UNTESTED");setConnectionChecks([]);setTestResult(null);setProviderModelDiscovery({status:"NOT_LOADED",models:[]});}}/>
           {(()=>{const selected=connectionProviders.find((item)=>item.id===accessProvider);const requiresCredential=advancedConnection.authType!=="NONE";return <div className="credential-reference-field api-key-control"><div className="add-page-field"><span>API Key{requiresCredential && <b className="required-star" aria-label="必填"> *</b>}</span><div className="api-key-status" data-configured={Boolean(selected?.credentialConfigured&&connectionSecretRef)}><span>{selected?.credentialConfigured&&connectionSecretRef?"已安全关联":"尚未设置"}</span><small>密钥由服务端加密保存，页面不显示明文</small></div></div><button type="button" className="credential-entry-trigger" onClick={()=>{setCredentialDraft({providerDisplayName:selected?.name||committedVendor.name,baseUrl:form.endpointMode==="MANUAL"?form.manualBaseUrl:selected?.baseUrl||"",apiKey:""});setCredentialError("");setCredentialEntryOpen(true);}} disabled={Boolean(busy)}><Key size={16}/>输入 API Key</button></div>;})()}
           <label className="add-page-field wide"><span>Base URL <b className="required-star" aria-label="必填">*</b></span><input aria-label="Base URL" aria-required="true" value={form.endpointMode === "MANUAL" ? form.manualBaseUrl : connectionProviders.find((item)=>item.id===accessProvider)?.baseUrl || ""} onChange={(event)=>{if(form.endpointMode!=="MANUAL")change("endpointMode","MANUAL");change("manualBaseUrl",event.target.value);setConnectionHealth("UNTESTED");setConnectionChecks([]);setTestResult(null);}} placeholder="https://api.example.com/v1" disabled={Boolean(busy)} /><small>填写服务商提供的接口地址，密钥请单独填入 API Key。</small></label>
          </div>
          <details className="connection-advanced" open>
            <summary><span><b>高级设置</b><small>连接方式、认证类型、部署区域与健康检查参数</small></span><span aria-hidden="true">⌄</span></summary>
            <div className="connection-advanced-grid">
              <label className="add-page-field"><span>连接类型</span><select aria-label="连接类型" value={advancedConnection.connectionType} onChange={(event)=>updateAdvancedConnection("connectionType",event.target.value)}>{[["OPENAI_COMPATIBLE","OpenAI 兼容"],["PROVIDER_NATIVE","服务商原生协议"],["OLLAMA","Ollama 本地服务"],["CUSTOM_HTTP","自定义 HTTP"],["LOCAL_RUNTIME","本地运行时"],["GPU_RUNTIME","GPU 运行时"]].map(([value,title])=><option key={value} value={value}>{title}</option>)}</select></label>
              <label className="add-page-field"><span>认证类型</span><select aria-label="认证类型" value={advancedConnection.authType} onChange={(event)=>updateAdvancedConnection("authType",event.target.value)}><option value="API_KEY">API Key（安全凭据）</option><option value="NONE">无需认证</option></select></label>
              <label className="add-page-field"><span>部署类型</span><select aria-label="部署类型" value={advancedConnection.deploymentType} onChange={(event)=>updateAdvancedConnection("deploymentType",event.target.value)}>{[["EXTERNAL_API","公有云 API"],["PRIVATE_ENDPOINT","私有端点"],["LOCAL_RUNTIME","本地运行时"],["GPU_RUNTIME","GPU 运行时"],["OLLAMA","Ollama"]].map(([value,title])=><option key={value} value={value}>{title}</option>)}</select></label>
              <label className="add-page-field"><span>区域</span><select aria-label="区域" value={advancedConnection.region} onChange={(event)=>updateAdvancedConnection("region",event.target.value)}>{[["AUTO","自动选择"],["GLOBAL","全球"],["US","美国"],["EU","欧洲"],["APAC","亚太"],["CN","中国"]].map(([value,title])=><option key={value} value={value}>{title}</option>)}</select></label>
              <label className="add-page-field"><span>请求超时（秒）</span><input aria-label="请求超时（秒）" type="number" min="1" max="600" value={advancedConnection.timeout} onChange={(event)=>updateAdvancedConnection("timeout",event.target.value)}/></label>
              <label className="add-page-field"><span>重试次数</span><input aria-label="重试次数" type="number" min="0" max="10" value={advancedConnection.retry} onChange={(event)=>updateAdvancedConnection("retry",event.target.value)}/></label>
              <label className="add-page-field"><span>健康检查路径</span><input aria-label="健康检查路径" value={advancedConnection.healthPath} onChange={(event)=>updateAdvancedConnection("healthPath",event.target.value)}/></label>
              <label className="add-page-field"><span>健康检查间隔（秒）</span><input aria-label="健康检查间隔（秒）" type="number" min="30" max="3600" value={advancedConnection.healthInterval} onChange={(event)=>updateAdvancedConnection("healthInterval",event.target.value)}/></label>
              {renderConnectionPairs(customHeaders,setCustomHeaders,"自定义请求头")}
              {renderConnectionPairs(customParams,setCustomParams,"自定义查询参数")}
            </div>
          </details>
          <section className="connection-test-results"><header><div><span>连接测试</span><h3>接入服务商健康检查</h3></div><button type="button" className="add-page-primary" onClick={runConnectionHealthCheck} disabled={Boolean(busy)||!accessProvider||(advancedConnection.authType!=="NONE"&&!connectionSecretRef)}>{busy==="connection-health"||visualFixture?.connectionState==="testing"?"正在测试…":"测试连接"}</button></header><p>只有凭据、服务地址、认证、模型发现、模型存在、最小推理、能力验证和响应时间检查全部通过后，状态才会显示“已就绪”。</p><div className="connection-test-state-banner" data-status={connectionHealth} role="status" aria-live="polite"><b>{connectionHealth==="READY"?"✓":connectionHealth==="TESTING"?"…":connectionHealth==="UNTESTED"?"○":"!"}</b><span><strong>{connectionHealth==="UNTESTED"?"等待测试":connectionHealth==="TESTING"?"连接测试进行中":connectionHealth==="READY"?"连接测试成功":connectionHealth==="AUTH_ERROR"?"认证失败":connectionHealth==="TIMEOUT"?"连接超时":connectionHealth==="RATE_LIMITED"?"请求频率受限":connectionHealth==="DEGRADED"?"连接测试未通过":connectionHealth}</strong><small>{testResult?.message||visualFixture?.connectionMessage||"连接状态由真实健康检查返回；未测试时保持未知。"}</small></span><em>{visualFixture?.connectionState?"仅视觉预览":connectionHealth==="READY"?"已就绪":"状态"}</em></div><div className="connection-check-grid">{["Credential Validation","Endpoint Connectivity","Authentication","Model Discovery","Selected Model Exists","Minimal Inference","Capability Validation","Latency"].map((name,index)=>{const result=connectionChecks.find((item)=>item.name===name||item.code===name);return <div key={name} data-status={result?.status||"PENDING"}><b>{index+1}. {CONNECTION_HEALTH_CHECK_LABELS[name] || name}</b><span>{{ PENDING: "待验证", TESTING: "检查中", NOT_CHECKED: "待检查", NOT_REQUIRED: "无需检查", PASS: "通过", PASSED: "通过", READY: "通过", SUCCESS: "通过", FAIL: "未通过", FAILED: "未通过", CHECK_FAILED: "检查失败", ERROR: "异常", TIMEOUT: "超时", SKIPPED: "已跳过" }[result?.status] || "待验证"}</span><small>{result?.message||"等待服务端验证"}</small></div>;})}</div>{testResult?.mock===false&&testResult.status==="TEST_FAILED"&&<p role="alert" className="connection-test-error">{testResult.message}</p>}</section>
       </section>
       <LiveConfigurationPreview step={2} form={form} vendorName={selectedVendor.name} logoProvider={providerLogoName(form.modelVendor)} identityMode={identityMode} visualFixture={visualFixture} accessProviderName={connectionProviders.find((item)=>item.id===accessProvider)?.name} connectionSecretRef={connectionSecretRef} connectionHealth={connectionHealth} connectionChecks={connectionChecks} costDraft={costDraft} quotaDraft={quotaDraft} routingDraft={routingDraft} stepThreeArea={stepThreeArea}/>
     </section> : <section className="model-step-three" aria-label="能力、配额与路由">
       <div className="step-three-main">
       <header className="step-three-model-header"><div className="add-page-model-icon"><ProviderLogo provider={providerLogoName(form.modelVendor)}/></div><div><b>{form.displayName}</b><small>模型厂商 · {identityMode?(form.providerDisplayName||"自定义"):selectedVendor.name} · {form.modelId}</small></div><span data-status={connectionHealth}>{{ UNTESTED: "未测试", TESTING: "测试中", READY: "已就绪", DEGRADED: "需检查", TIMEOUT: "连接超时", AUTH_ERROR: "认证失败", RATE_LIMITED: "请求受限" }[connectionHealth] || "状态未知"}</span></header>
         <nav className="step-three-tabs" aria-label="模型配置区域"><button type="button" className={stepThreeArea==="capabilities"?"active":""} onClick={()=>{setStepThreeArea("capabilities");}}>模型能力</button><button type="button" className={stepThreeArea==="quota"?"active":""} onClick={()=>{setStepThreeArea("quota");}}>配额设置</button><button type="button" className={stepThreeArea==="routing"?"active":""} onClick={()=>{setStepThreeArea("routing");}}>路由策略</button></nav>
         {stepThreeArea==="capabilities"&&<section className="step-three-panel step-three-capability-panel"><header className="step-three-capability-intro"><div><b>模型能力</b><p>配置此模型支持的能力，启用后可在相应业务模块中使用。不同模型的能力支持情况不同，不支持的能力将置灰显示。</p>{!visualFixture&&<small>{customCapabilityManualAllowed?"自定义能力将标记为人工补充。":"能力来源："+(capabilityRegistryState==="READY"?"已读取":capabilityRegistryState==="LOADING"?"读取中":"未就绪")+" · 已验证文本生成："+(runtimeTextCapabilityVerified?"是":"否")}</small>}</div><button type="button" onClick={()=>document.querySelector("#ai-capability-help-dialog")?.showModal()}>能力说明</button></header><div className="step-three-capability-fields">{field("capabilities")}{!visualFixture&&<details className="step-three-meta-details"><summary>输入/输出模态设置</summary><div className="step-three-meta-fields">{field("inputModalities")}{field("outputModalities")}</div></details>}</div><dialog id="ai-capability-help-dialog" className="step-three-bulk-dialog" onKeyDown={(event)=>{if(event.key==="Escape")event.stopPropagation();}}><form method="dialog"><b>模型能力说明</b><p>只有当前模型已验证或明确支持的能力可以启用。未知或不支持的能力会保持禁用；自定义模型的人工补充能力会单独标记来源。</p><footer><button value="close">关闭</button></footer></form></dialog></section>}
         {stepThreeArea==="quota"&&<section className="step-three-panel step-three-quota-panel"><div className="step-three-callout"><b>配额与请求配置</b><span>按模型设置调用上限与稳定性参数；留空表示不限制或未知。</span></div><div className="step-three-quota-grid">{[["rpm","每分钟请求数上限","每分钟允许的最大请求数"],["tpm","每分钟令牌上限","每分钟令牌使用上限"],["maxConcurrency","最大并发请求数","同时处理的请求数量"],["dailyQuota","每日额度上限","每日可用额度"],["monthlyQuota","每月额度上限","每月可用额度"]].map(([key,label,hint])=><label className="add-page-field" key={key}><span>{label}</span><input aria-label={label} type="number" min="0" step="1" value={quotaDraft[key]} placeholder="不限制" onChange={(event)=>setQuotaDraft((old)=>({...old,[key]:event.target.value}))}/><small>{hint}</small></label>)}{[["requestTimeout","请求超时","秒", "连接超时后结束当前请求"],["retryCount","重试次数","次", "请求失败后的自动重试次数"],["monthlyCostLimit","月度成本上限","美元 / 月", "达到上限后暂停当前模型"]].map(([key,label,unit,hint])=><label className="add-page-field quota-visual-extra" key={key}><span>{label}<small>（{unit}）</small></span><input aria-label={label} type="number" min="0" step="1" value={quotaDraft[key]} placeholder="未设置" onChange={(event)=>setQuotaDraft((old)=>({...old,[key]:event.target.value}))}/><small>{hint}</small></label>)}</div><section className="step-three-costs"><header><div><b>成本计费配置</b><small>不同调用类型分别计价，价格单位为美元。</small></div><span className="cost-header-actions"><button type="button" onClick={()=>setCostDraft(Object.fromEntries(MODEL_COST_DIMENSIONS.map(([id])=>[id,visualFixture?.costs?.[id]??""]))) } disabled={!visualFixture}>恢复默认价格</button><button type="button" onClick={()=>document.querySelector("#ai-cost-bulk-dialog")?.showModal()}>批量设置</button></span></header><div className="step-three-cost-table"><div className="step-three-cost-head"><span>计费类型</span><span>计费单位</span><span>单价（美元）</span><span>说明</span></div>{MODEL_COST_DIMENSIONS.filter(([id])=>!["REQUEST","GPU_SECOND"].includes(id)).map(([id,label,unit])=><div className="step-three-cost-row" key={id}><b>{label}</b><span>{unit}</span><input aria-label={`${label}单价`} type="number" min="0" step="any" value={costDraft[id]} placeholder="未知" onChange={(event)=>setCostDraft((old)=>({...old,[id]:event.target.value}))}/><small>{costDraft[id]===""?"未设置":costDraft[id]==="0"?"明确设置为零成本":"已填写"}</small></div>)}</div></section><dialog id="ai-cost-bulk-dialog" className="step-three-bulk-dialog" onKeyDown={(event)=>{if(event.key==="Escape")event.stopPropagation();}}><form method="dialog"><b>批量设置计费单价</b><p>输入单价后，将应用到上方七种常用计费类型。</p><label>单价（美元）<input aria-label="批量单价" type="number" min="0" step="any" placeholder="输入金额"/></label><footer><button value="cancel">取消</button><button value="apply" onClick={(event)=>{const value=event.currentTarget.form?.querySelector('input[aria-label="批量单价"]')?.value;if(value!==undefined&&value!=="")setCostDraft((old)=>({...old,INPUT_TOKEN:value,OUTPUT_TOKEN:value,IMAGE:value,VIDEO_SECOND:value,AUDIO_SECOND:value,GPU_MINUTE:value,JOB:value}));}}>应用</button></footer></form></dialog></section>}
         {stepThreeArea==="routing"&&<section className="step-three-panel"><div className="step-three-callout"><b>当前模型的路由参与方式</b><span>仅配置 {form.displayName} 如何参与 AI 网关，不会更改全局多模型路由控制台。</span></div><div className="step-three-routing-grid"><label className="add-page-field route-priority"><span>路由优先级</span><input aria-label="路由优先级" type="number" min="1" step="1" value={routingDraft.priority} onChange={(event)=>setRoutingDraft((old)=>({...old,priority:event.target.value}))}/></label><label className="add-page-field route-weight"><span>路由权重 · {routingDraft.weight}%</span><input aria-label="路由权重" type="range" min="0" max="100" value={routingDraft.weight} onChange={(event)=>setRoutingDraft((old)=>({...old,weight:Number(event.target.value)}))}/></label><label className="add-page-field route-fallback"><span>备用模型</span><select aria-label="备用模型" value={routingDraft.fallbackModelId} onChange={(event)=>setRoutingDraft((old)=>({...old,fallbackModelId:event.target.value}))}><option value="">不设置</option>{fallbackModels.map((item)=><option key={item.id} value={item.id}>{item.model} · {item.provider} · {item.modelId}</option>)}</select><small aria-live="polite">{fallbackModelsState==="LOADING"?"正在读取已启用且健康的模型…":fallbackModelsState==="READY"?(fallbackModels.length?`已读取 ${fallbackModels.length} 个真实可用模型。`:"当前没有其他已启用且健康的已登记模型。"):fallbackModelsState==="VISUAL_QA_ONLY"?`视觉样例 · ${fallbackModels.length} 个候选；不会写入真实路由。`:fallbackModelsState==="NOT_LOADED"?"打开路由策略后读取可用模型。":"模型目录暂不可用（"+fallbackModelsState+"）。"}{fallbackModelsState!=="LOADING"&&fallbackModelsState!=="NOT_LOADED"&&fallbackModelsState!=="READY"&&fallbackModelsState!=="VISUAL_QA_ONLY"&&<button type="button" className="capability-registry-retry" onClick={()=>setFallbackModelsReload((value)=>value+1)}>重试</button>}</small></label><label className="add-page-field route-trigger"><span>触发条件</span><select aria-label="触发条件" value={routingDraft.triggerCondition} onChange={(event)=>setRoutingDraft((old)=>({...old,triggerCondition:event.target.value}))}><option value="HEALTH_OR_LIMIT">健康异常或额度接近上限</option><option value="HEALTH_ONLY">仅健康异常</option><option value="MANUAL_ONLY">仅手动切换</option></select></label><label className="add-page-field route-threshold"><span>健康阈值 · {routingDraft.healthThreshold}%</span><input aria-label="健康阈值" type="range" min="50" max="100" value={routingDraft.healthThreshold} onChange={(event)=>setRoutingDraft((old)=>({...old,healthThreshold:Number(event.target.value)}))}/></label><div className="step-three-route-switches"><label className="step-three-health-toggle"><input type="checkbox" checked={routingDraft.autoRouting} onChange={(event)=>setRoutingDraft((old)=>({...old,autoRouting:event.target.checked}))}/><span><b>自动参与路由</b><small>模型满足健康及场景条件时参与 AI 网关调度</small></span></label></div></div><fieldset className="step-three-scenarios"><legend>适用场景</legend><p>业务场景与模型能力分离；绑定范围只影响当前模型。</p><div>{(visualFixture ? ROUTING_SCENARIO_OPTIONS : SCENARIO_CANDIDATES.map((id)=>[id,localizeScenarioOrModality(id)])).map(([scenario,scenarioLabel])=><label key={scenario}><input type="checkbox" checked={routingDraft.scenarioBinding.includes(scenario)} onChange={()=>setRoutingDraft((old)=>({...old,scenarioBinding:old.scenarioBinding.includes(scenario)?old.scenarioBinding.filter((item)=>item!==scenario):[...old.scenarioBinding,scenario]}))}/>{scenarioLabel}</label>)}</div></fieldset><section className="step-three-cost-strategy"><header><b>成本策略</b><small>按当前模型参与路由时的偏好</small></header><div>{[["CHEAPEST_QUALIFIED","满足条件的最低成本"],["FASTEST","最快响应"],["BEST_QUALITY","优先质量"],["BALANCED","平衡策略"],["FIXED_MODEL","固定模型"]].map(([value,label])=><label key={value} className={(routingDraft.costStrategy || visualFixture?.routing?.strategy || "BALANCED")===value?"selected":""}><input type="radio" name="routing-cost-strategy" value={value} checked={routingDraft.costStrategy===value} onChange={()=>setRoutingDraft((old)=>({...old,costStrategy:value}))}/><span><b>{label}</b><small>{value==="CHEAPEST_QUALIFIED"?"在符合能力要求的候选中控制成本":value==="FASTEST"?"优先选择响应时间较短的候选":value==="BEST_QUALITY"?"优先选择质量等级较高的候选":value==="BALANCED"?"综合平衡成本、质量与响应": "仅使用当前指定模型"}</small></span></label>)}</div></section></section>}
       </div>
       <LiveConfigurationPreview step={3} form={form} vendorName={selectedVendor.name} logoProvider={providerLogoName(form.modelVendor)} identityMode={identityMode} visualFixture={visualFixture} accessProviderName={connectionProviders.find((item)=>item.id===accessProvider)?.name} connectionSecretRef={connectionSecretRef} connectionHealth={connectionHealth} connectionChecks={connectionChecks} costDraft={costDraft} quotaDraft={quotaDraft} routingDraft={routingDraft} stepThreeArea={stepThreeArea}/>
     </section>}
      {step===3&&notice&&<p className="model-step-feedback" role="status" aria-live="polite">{notice}</p>}
      <footer className="model-step-actions"><button type="button" className="add-page-secondary" onClick={step===1?requestExit:()=>setStep((current)=>Math.max(1,current-1))} disabled={Boolean(busy)}>{step===1?"取消":"上一步"}</button><span>{step===1?"选择模型后继续配置连接":step===2?"请完成连接配置；启用前须完成健康校验":"保存后将执行数据库读回核对"}</span>{step<3?<button type="button" className="add-page-primary" disabled={step===1&&(!form.modelId||!form.displayName||!form.modelVendor||(Boolean(identityMode)&&!form.providerDisplayName))} onClick={()=>{if(step===1){if(!form.modelId||!form.displayName||!form.modelVendor||(identityMode&&!form.providerDisplayName)){setNotice("请先完成模型厂商身份和具体模型。");return;}setStep(2);setNotice("");}else{setStep(3);setStepThreeArea("capabilities");setNotice("");}}}>{step===1?"下一步：连接配置":"下一步：模型能力、配额与路由"}</button>:<><button type="button" className="add-page-secondary" onClick={()=>void persistConfiguration(false)} disabled={Boolean(busy)||!accessProvider||(advancedConnection.authType!=="NONE"&&!connectionSecretRef)}>{busy==="save-draft"?<CircleNotch className="spin" size={15}/>:<FloppyDisk size={15}/>}保存草稿</button><button type="button" className="add-page-primary" onClick={()=>void persistConfiguration(true)} disabled={Boolean(busy)||!accessProvider||(advancedConnection.authType!=="NONE"&&!connectionSecretRef)||connectionHealth!=="READY"}>{busy==="enable"?<CircleNotch className="spin" size={15}/>:<CheckCircle size={15}/>}保存并启用</button></>}</footer>
     {credentialEntryOpen && <div className="add-model-backdrop credential-entry-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget)closeCredentialEntry();}}><section className="add-model-dialog credential-entry-dialog" role="dialog" aria-modal="true" aria-labelledby="credential-entry-title" aria-busy={credentialBusy}><header><div><span className="dialog-eyebrow">中央密钥库 · 安全录入</span><h2 id="credential-entry-title">安全录入 API Key</h2><p>{visualFixture ? "仅模拟关联状态，不发送或保存密钥；操作后输入会清空。" : "密钥仅在提交时发送给服务端；保存后页面只保留安全引用。"}</p></div><button type="button" className="dialog-close" aria-label="关闭安全凭据录入" onClick={closeCredentialEntry} disabled={credentialBusy}><X size={18}/></button></header><div className="credential-entry-security"><ShieldCheck size={17}/><span>当前服务商：{credentialDraft.providerDisplayName || committedVendor.name} · 密钥不会回显，也不会写入浏览器存储。</span></div><form onSubmit={submitCredentialEntry} noValidate><label className="add-page-field"><span>API Key <b className="required-star">*</b></span><input aria-label="手工填写 API Key" type="password" value={credentialDraft.apiKey} onChange={(event)=>setCredentialDraft((current)=>({...current,apiKey:event.target.value}))} placeholder="粘贴服务商提供的 API Key" maxLength={4096} autoComplete="new-password" spellCheck={false} required/><small>Base URL 使用连接配置页中填写的地址；提交后输入会立即清空。</small></label>{credentialError&&<p className="credential-entry-error" role="alert">{credentialError}</p>}<footer><button type="button" className="add-page-secondary" onClick={closeCredentialEntry} disabled={credentialBusy}>取消</button><span>{visualFixture?"仅本地模拟，不保存密钥":"密钥由服务端加密保存"}</span><button type="submit" className="add-page-primary" disabled={credentialBusy||!credentialDraft.providerDisplayName.trim()||!credentialDraft.baseUrl.trim()||!credentialDraft.apiKey.trim()}>{credentialBusy?"正在安全保存…":visualFixture?"模拟关联":"安全保存并关联"}</button></footer></form></section></div>}
     {exitPrompt && <div className="add-page-exit-backdrop"><section className="add-page-exit" role="alertdialog" aria-modal="true" aria-labelledby="add-page-exit-title"><h2 id="add-page-exit-title">离开此页面？</h2><p>当前字段尚未保存。离开将丢弃当前内容。</p><footer><button ref={exitButton} type="button" className="add-page-secondary" onClick={() => setExitPrompt(false)}>继续编辑</button><button type="button" className="add-page-danger" onClick={() => { setExitPrompt(false); void navigateWithAiFixture(onCancel); }}>放弃并离开</button></footer></section></div>}
  </main></div>;
}
