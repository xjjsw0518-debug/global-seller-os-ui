import { AI_CAPABILITY_CATALOG } from "./modelCapabilityCatalog.js";

export const CAPABILITY_LABELS_ZH = Object.freeze({
  STRUCTURED_OUTPUT: "结构化输出", FUNCTION_CALLING: "函数调用", TRANSLATION: "翻译", IMAGE_UNDERSTANDING: "图像理解", OCR: "OCR文字识别", IMAGE_EDIT: "图像编辑", IMAGE_TO_VIDEO: "图像生成视频", TEXT_TO_VIDEO: "文本生成视频", VIDEO_EDIT: "视频编辑", STT: "语音识别", TTS: "语音合成", VOICE_CLONE: "语音克隆", REALTIME_VOICE: "实时语音", UPSCALE: "图像/视频放大", RESTORE: "图像/视频修复",
  TEXT_GENERATION: "文本生成", STRUCTURED_OUTPUT_JSON: "JSON结构化输出", COMPLEX_REASONING: "复杂推理", TOOL_CALLING: "工具调用", RPA_PLANNER_TOOL_CALLING: "Agent规划", VISION_UNDERSTANDING: "图像理解", DOCUMENT_UNDERSTANDING: "文档理解", SENTIMENT_ANALYSIS: "情感分析", NEXT_BEST_ACTION: "下一步建议",
  IMAGE_GENERATION: "图像生成", IMAGE_EDITING: "图像编辑", IMAGE_INPAINTING: "图像局部重绘", IMAGE_BACKGROUND_REMOVAL: "图像背景移除", IMAGE_SCENE_GENERATION: "图像场景生成", IMAGE_SEGMENTATION: "图像分割", OBJECT_REMOVAL: "移除图像对象", MASK_GENERATION: "遮罩生成", IMAGE_UPSCALING: "图像放大", IMAGE_RESTORATION: "图像修复增强",
  VIDEO_UNDERSTANDING: "视频理解", VIDEO_GENERATION: "视频生成", VIDEO_EDITING: "视频编辑", VIDEO_INPAINTING: "视频局部重绘", VIDEO_FRAME_INTERPOLATION: "视频帧插值", LIP_SYNC: "口型同步", PORTRAIT_ANIMATION: "人像动画", FACE_ANIMATION: "面部动画",
  TEXT_TO_SPEECH: "文本转语音", VOICE_CLONING: "语音克隆", VOICE_STYLE_CONTROL: "语音风格控制", EMOTION_CONTROL: "语音情绪控制", SPEECH_TO_TEXT: "语音转文本", AUTOMATIC_SPEECH_RECOGNITION: "自动语音识别", TRANSCRIPTION: "语音转录", LANGUAGE_IDENTIFICATION: "语种识别", MUSIC_GENERATION: "音乐生成", SOUND_EFFECT_GENERATION: "音效生成",
});

export const SCENARIO_MODALITY_LABELS_ZH = Object.freeze({
  GENERAL: "通用场景", RPA: "RPA自动化", CONTENT_CREATION: "内容创作", AI_GUARD: "AI防护", PRODUCT: "商品运营", CUSTOMER_SERVICE: "客户服务", VOICE_SALES: "语音销售",
  TEXT: "文本", JSON: "JSON结构化数据", IMAGE: "图像", VIDEO: "视频", AUDIO: "音频",
});

export const FORM_OPTION_LABELS_ZH = Object.freeze({
  OPENAI_COMPATIBLE: "OpenAI兼容", PROVIDER_NATIVE: "Provider原生协议", OLLAMA: "Ollama", CUSTOM_HTTP: "自定义HTTP", LOCAL_RUNTIME: "本地运行时", GPU_RUNTIME: "GPU运行时", CUSTOM: "CUSTOM（旧配置兼容）",
  UNKNOWN: "未知", EXTERNAL_API: "外部API", PRIVATE_ENDPOINT: "私有Endpoint", RUNTIME_OFFLINE: "运行时离线", VRAM_EXHAUSTED: "显存不足", QUEUE_FULL: "队列已满", MODEL_LOAD_FAILED: "模型加载失败", MODEL_VERSION_MISMATCH: "模型版本不匹配", ENDPOINT_UNREACHABLE: "Endpoint不可达", AUTH_ERROR: "认证失败", QUOTA_EXHAUSTED: "额度耗尽",
  CHEAPEST_QUALIFIED: "满足条件的最低成本", FASTEST: "最快", BEST_QUALITY: "质量优先", BALANCED: "均衡", FIXED_MODEL: "固定模型", CONFIRMED_ALLOWED: "已核实允许商用", RESTRICTED: "受限", PROHIBITED: "禁止商用", NEEDS_REVIEW: "待核实",
  TOKEN_PER_1M: "每百万Token", IMAGE: "每张图像", VIDEO_SECOND: "每秒视频", AUDIO_SECOND: "每秒音频", AUDIO_TOKEN_1K: "每千音频Token", GPU_SECOND: "每秒GPU用量", REQUEST: "每次请求", ESTIMATED: "估算", VERIFIED: "已核实", CONFIRMED_FREE: "已核实免费",
  ACTIVE: "可用", DISABLED: "已停用", ERROR: "异常", QUOTA_LIMITED: "额度受限", AUTO: "自动解析", MANUAL: "手动填写", API_KEY: "API Key（不录入）", NONE: "无需认证", USAGE_BASED: "按量计费", PREPAID_BALANCE: "预付余额", TOKEN_PACKAGE: "Token套餐", ENTERPRISE_CONTRACT: "企业合同", SELF_HOSTED: "自托管", UNMANAGED: "未托管", UNTESTED: "未测试", TESTING: "测试中（模拟）", TEST_SUCCESS: "测试通过（模拟）", TEST_FAILED: "测试失败（模拟）", PROVIDER_FALLBACK: "使用 Provider 标识作为后备", MEMORY_ONLY: "仅本地预览，未保存到服务器", INVALID_SERVER_REFERENCE: "服务器 Logo 引用无效", SERVER_REFERENCE_SAVED: "服务器 Logo 引用已确认", SERVER_ASSET_NOT_ASSIGNED: "服务器图片尚未关联到该模型",
});

export const ADVANCED_FIELD_LABELS_ZH = Object.freeze({
  imageWidthPx: "图像宽度", imageHeightPx: "图像高度", resolution: "分辨率", aspectRatios: "画面比例", maxDurationSeconds: "最长时长", frameRateFps: "视频帧率", supportedFormats: "支持格式", minimumVramGb: "最低显存", expectedLatencyMs: "预计延迟", maxConcurrency: "最大并发数", streaming: "支持流式", batchSize: "批量大小",
});

export const toControlledInputValue = (value) => value == null ? "" : value;
export const localizeCapability = (id) => CAPABILITY_LABELS_ZH[id] || id;
export const localizeScenarioOrModality = (value) => SCENARIO_MODALITY_LABELS_ZH[value] || value;
export const localizeFormOption = (field, value) => {
  if (field === "enabled") return value === "" || value == null ? "未知" : value === true || value === "true" ? "启用" : "停用";
  return FORM_OPTION_LABELS_ZH[value] || value;
};
export const localizeAdvancedField = (key) => ADVANCED_FIELD_LABELS_ZH[key] || key;

export const capabilityLabelsCoverCatalog = () => AI_CAPABILITY_CATALOG.every(({ id }) => Boolean(CAPABILITY_LABELS_ZH[id]));
