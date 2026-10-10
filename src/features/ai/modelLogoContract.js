export const MODEL_LOGO_MAX_BYTES = 1024 * 1024;
export const MODEL_LOGO_MIME_TYPES = Object.freeze(["image/png", "image/jpeg", "image/webp"]);
export const providerLogoAssets = Object.freeze({
  "OpenAI": new URL("./assets/provider-logos/openai-user-knot-icon.png", import.meta.url).href,
  "Anthropic": new URL("./assets/provider-logos/anthropic-wordmark.svg", import.meta.url).href,
  "Google": new URL("./assets/provider-logos/google-g-icon-2025.svg", import.meta.url).href,
  "DeepSeek": new URL("./assets/provider-logos/deepseek-icon.svg", import.meta.url).href,
  "Alibaba Cloud": new URL("./assets/provider-logos/alibaba-cloud-official-footer.svg", import.meta.url).href,
  "Microsoft Azure": new URL("./assets/provider-logos/microsoft-azure-logo.svg", import.meta.url).href,
  "Qwen": new URL("./assets/provider-logos/qwen-official-icon.png", import.meta.url).href,
  "Kimi": new URL("./assets/provider-logos/kimi-official-app-icon.png", import.meta.url).href,
  "Zhipu AI": new URL("./assets/provider-logos/zai-glm-official-logo.svg", import.meta.url).href,
  "MiniMax": new URL("./assets/provider-logos/minimax-official-favicon.ico", import.meta.url).href,
  "xAI": new URL("./assets/provider-logos/grok-official-favicon-sanitized.svg", import.meta.url).href,
  "Mistral AI": new URL("./assets/provider-logos/mistral-official-gradient-icon.webp", import.meta.url).href,
  "Cohere": new URL("./assets/provider-logos/cohere-official-logo.svg", import.meta.url).href,
  "Meta Llama": new URL("./assets/provider-logos/meta-ai-official-mark.svg", import.meta.url).href,
  "Doubao": new URL("./assets/provider-logos/doubao-official-icon-128.png", import.meta.url).href,
  "Hunyuan": new URL("./assets/provider-logos/hunyuan-official-logo.svg", import.meta.url).href,
});
const providerLogoNames = Object.freeze(Object.keys(providerLogoAssets));
const providerLogoAliases = Object.freeze({
  "openai": "OpenAI",
  "openai api": "OpenAI",
  "open ai": "OpenAI",
  "anthropic api": "Anthropic",
  "claude api": "Anthropic",
  "google ai": "Google",
  "google ai studio": "Google",
  "google vertex ai": "Google",
  "vertex ai": "Google",
  "google gemini": "Google",
  "google_gemini": "Google",
  "deepseek": "DeepSeek",
  "deepseek api": "DeepSeek",
  "qwen": "Qwen",
  "qwen ai": "Qwen",
  "kimi": "Kimi",
  "moonshot": "Kimi",
  "moonshot ai": "Kimi",
  "zhipu": "Zhipu AI",
  "zhipu ai": "Zhipu AI",
  "glm": "Zhipu AI",
  "minimax": "MiniMax",
  "xai": "xAI",
  "x ai": "xAI",
  "grok": "xAI",
  "mistral": "Mistral AI",
  "mistral ai": "Mistral AI",
  "cohere": "Cohere",
  "meta": "Meta Llama",
  "meta llama": "Meta Llama",
  "llama": "Meta Llama",
  "doubao": "Doubao",
  "bytedance": "Doubao",
  "hunyuan": "Hunyuan",
  "tencent hunyuan": "Hunyuan",
  "阿里云": "Alibaba Cloud",
  "alibaba cloud model studio": "Alibaba Cloud",
  "microsoft azure": "Microsoft Azure",
  "azure": "Microsoft Azure",
  "azure openai": "Microsoft Azure",
  "azure openai service": "Microsoft Azure",
});
const normalizeProviderLogoAlias = (value) => String(value ?? "").trim().toLocaleLowerCase().replace(/[._-]+/g, " ").replace(/\s+/g, " ");

/** Resolve a candidate provider fixture or matching custom display name to a shared logo key. */
export function resolveProviderLogoName(providerName, providerDisplayName = "") {
  const providerAlias = normalizeProviderLogoAlias(providerName);
  const display = normalizeProviderLogoAlias(String(providerDisplayName).replace(/\s*\(SYNTHETIC\)\s*$/i, ""));
  const byCanonicalName = providerLogoNames.find((name) => normalizeProviderLogoAlias(name) === providerAlias);
  if (byCanonicalName) return byCanonicalName;
  // The explicit provider identity must win over a stale display name from the previously selected vendor.
  if (providerLogoAliases[providerAlias]) return providerLogoAliases[providerAlias];
  const displayCanonical = providerLogoNames.find((name) => normalizeProviderLogoAlias(name) === display);
  if (displayCanonical) return displayCanonical;
  if (providerLogoAliases[display]) return providerLogoAliases[display];
  return String(providerName || providerDisplayName || "Other").trim() || "Other";
}
const unknownProviderFallback = Object.freeze({ kind: "generic-provider-fallback", iconName: "SquaresFour", sourceUrl: "https://github.com/phosphor-icons/react", sourceStatus: "PHOSPHOR_REACT", licenseStatus: "MIT", version: "2.1.10", title: "Generic provider fallback · no verified brand or model logo is available" });

export const requiredModelVendorLogoKeys = Object.freeze({
  OPENAI: "OpenAI", ANTHROPIC: "Anthropic", GOOGLE_GEMINI: "Google", DEEPSEEK: "DeepSeek",
  QWEN: "Qwen", KIMI: "Kimi", ZHIPU: "Zhipu AI", MINIMAX: "MiniMax", XAI: "xAI",
  MISTRAL: "Mistral AI", COHERE: "Cohere", META: "Meta Llama", MOONSHOT: "Kimi",
  DOUBAO: "Doubao", HUNYUAN: "Hunyuan",
});

const assetRecord = (src, sourceUrl, sourceStatus, version, title, licenseStatus = "OFFICIAL_ASSET; TRADEMARK/USAGE_TERMS_REMAIN") => Object.freeze({ kind: "provider-local-asset", src, sourceUrl, sourceStatus, licenseStatus, version, title });

export const providerLogoCatalog = Object.freeze({
  "OpenAI": assetRecord("openai-user-knot-icon.png", null, "USER_SUPPLIED_REFERENCE", "2026-10-07", "用户提供的 OpenAI 结形标识原图；仅进行裁边与显示增强", "USER_SUPPLIED_REFERENCE"),
  "Anthropic": assetRecord("anthropic-wordmark.svg", "https://commons.wikimedia.org/wiki/File:Anthropic_logo.svg", "COMMONS_FILE_PAGE_VERIFIED", "2023-07-01", "Anthropic wordmark; local source recorded", "PD_TEXTLOGO; TRADEMARK_STATUS_NOT_STATED_ON_FILE_PAGE"),
  "Google": assetRecord("google-g-icon-2025.svg", "https://commons.wikimedia.org/wiki/File:Google_Favicon_2025.svg", "COMMONS_FILE_PAGE_VERIFIED", "2025-05-12", "Google 2025 G icon; local source recorded", "CC0_VECTORIZATION_TRADEMARK_REMAINS"),
  "DeepSeek": assetRecord("deepseek-icon.svg", "https://commons.wikimedia.org/wiki/File:DeepSeek-icon.svg", "DEEPSEEK_SOURCE_RECORDED", "2023-09-11", "DeepSeek icon; copyright and MIT/Expat notice retained in the asset README", "MIT_NOTICE_RETAINED; TRADEMARK_TERMS_REMAIN"),
  "Alibaba Cloud": assetRecord("alibaba-cloud-official-footer.svg", "https://www.alibabacloud.com/en/news/product/supports-scc-hl2?_p_lc=1", "OFFICIAL_SITE_FOOTER_FILE", "checked 2026-10-01", "Alibaba Cloud logo downloaded from the official site footer", "NO_FILE_LICENSE_STATED; IDENTIFICATION_ONLY"),
  "Microsoft Azure": assetRecord("microsoft-azure-logo.svg", "https://commons.wikimedia.org/wiki/File:Microsoft_Azure_Logo.svg", "COMMONS_FILE_PAGE_VERIFIED", "2021-08-15", "Microsoft Azure SVG; local source recorded", "PD_TEXTLOGO_TRADEMARK_REMAINS"),
  "Qwen": assetRecord("qwen-official-icon.png", "https://img.alicdn.com/imgextra/i4/O1CN01OXv3EM1FN8t9W4P79_!!6000000000474-2-tps-80-80.png", "OFFICIAL_QWEN_SITE_ICON", "checked 2026-10-05", "Qwen site icon served by the official Qwen website CDN"),
  "Kimi": assetRecord("kimi-official-app-icon.png", "https://kimi.moonshot.cn/pwa-192.png", "OFFICIAL_KIMI_SITE_APP_ICON", "checked 2026-10-05", "Kimi app icon served by the official Kimi website"),
  "Zhipu AI": assetRecord("zai-glm-official-logo.svg", "https://z-cdn.chatglm.cn/z-ai/static/logo.svg", "OFFICIAL_ZAI_SITE_LOGO", "checked 2026-10-05", "Official Z.ai logo used to identify the Zhipu/GLM model family"),
  "MiniMax": assetRecord("minimax-official-favicon.ico", "https://www.minimax.io/favicon.ico", "OFFICIAL_MINIMAX_SITE_FAVICON", "checked 2026-10-05", "MiniMax official site favicon; exact asset retained"),
  "xAI": assetRecord("grok-official-favicon-sanitized.svg", "https://grok.com/images/favicon.svg", "OFFICIAL_GROK_SITE_FAVICON", "checked 2026-10-05", "Official Grok site favicon for the xAI/Grok model vendor; displayed unchanged"),
  "Mistral AI": assetRecord("mistral-official-gradient-icon.webp", "https://mistral.ai/_astro/cover-logo-icon-gradient_Z1vzKon.webp?dpl=6abbd11780b53c00082eea6f", "OFFICIAL_MISTRAL_BRAND_PAGE_ASSET", "brand page checked 2026-10-05", "Official Mistral brand-page gradient icon; displayed unchanged"),
  "Cohere": assetRecord("cohere-official-logo.svg", "https://cohere.com/nav_icon.svg", "OFFICIAL_COHERE_SITE_NAV_ICON", "checked 2026-10-05", "Cohere official site navigation mark; light tile preserves its original dark mark"),
  "Meta Llama": assetRecord("meta-ai-official-mark.svg", "https://meta.ai/images/meta-ai-orbit-logo-gradient-3d_light.svg", "OFFICIAL_META_AI_SITE_MARK", "checked 2026-10-05", "Official Meta AI mark used to identify Meta Llama; displayed unchanged"),
  "Doubao": assetRecord("doubao-official-icon-128.png", "https://lf-flow-web-cdn.doubao.com/obj/flow-doubao/doubao/chat/favicon-doubao.png", "OFFICIAL_DOUBAO_SITE_FAVICON", "checked 2026-10-05", "Doubao official site favicon for vendor identification"),
  "Hunyuan": assetRecord("hunyuan-official-logo.svg", "https://hunyuan-blog-web-prod-1258344703.cos.ap-guangzhou.myqcloud.com/favicon.png", "OFFICIAL_HUNYUAN_SITE_FAVICON", "checked 2026-10-05", "Hunyuan official website favicon"),
  "Other": Object.freeze({ kind: "generic-provider-fallback", iconName: "SquaresFour", sourceUrl: "https://github.com/phosphor-icons/react", sourceStatus: "PHOSPHOR_REACT", licenseStatus: "MIT", version: "2.1.10", title: "Generic provider fallback · no verified brand or model logo is available" }),
  "其他": Object.freeze({ kind: "generic-provider-fallback", iconName: "SquaresFour", sourceUrl: "https://github.com/phosphor-icons/react", sourceStatus: "PHOSPHOR_REACT", licenseStatus: "MIT", version: "2.1.10", title: "Generic provider fallback · no verified brand or model logo is available" }),
});

export function identifyLogoMime(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export async function validateModelLogoFile(file, { decode = true } = {}) {
  if (!file || typeof file.arrayBuffer !== "function") return { valid: false, code: "LOGO_FILE_REQUIRED" };
  if (!MODEL_LOGO_MIME_TYPES.includes(file.type)) return { valid: false, code: "LOGO_TYPE_UNSUPPORTED" };
  if (file.size <= 0 || file.size > MODEL_LOGO_MAX_BYTES) return { valid: false, code: "LOGO_SIZE_INVALID" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = identifyLogoMime(bytes);
  if (detected !== file.type) return { valid: false, code: "LOGO_SIGNATURE_MISMATCH" };
  if (decode && typeof createImageBitmap === "function") {
    try { const bitmap = await createImageBitmap(file); const dimensionsValid = bitmap.width > 0 && bitmap.height > 0; bitmap.close?.(); if (!dimensionsValid) return { valid: false, code: "LOGO_IMAGE_INVALID" }; }
    catch { return { valid: false, code: "LOGO_IMAGE_INVALID" }; }
  }
  return { valid: true, mimeType: detected, size: file.size, mock: true, persistence: "MEMORY_ONLY" };
}

export function resolveModelLogo(model, providerCatalog = providerLogoCatalog) {
  if (model?.modelLogo?.kind === "custom-model" && model.modelLogo.dataUrl) return { kind: "custom-model", src: model.modelLogo.dataUrl, alt: `${model.model || "Model"} custom logo`, persistence: "MEMORY_ONLY", sourceStatus: "NON_OFFICIAL_CUSTOM" };
  const providerKey = resolveProviderLogoName(model?.provider);
  const provider = providerCatalog[providerKey] || unknownProviderFallback;
  if (provider.kind === "provider-local-asset") return { ...provider, alt: `${model?.provider || "Provider"} Provider logo fallback`, persistence: "LOCAL_PROVIDER_ASSET" };
  if (model?.provider === "OpenAI" || model?.provider === "Microsoft Azure") {
    const wordmark = model.provider === "OpenAI" ? "OpenAI" : "Azure";
    return { kind: "provider-wordmark-fallback", wordmark, sourceUrl: null, sourceStatus: "OFFICIAL_ASSET_NOT_MATERIALIZED", licenseStatus: "BRAND_GUIDANCE_REVIEWED", title: `${wordmark} name label; provider logo asset unavailable`, alt: `${wordmark} provider name; logo asset unavailable`, persistence: "PROVIDER_NAME_FALLBACK" };
  }
  return { ...provider, alt: provider.title, persistence: "GENERIC_PROVIDER_FALLBACK" };
}

export function createLocalMockModelLogo(file, dataUrl) {
  return { kind: "custom-model", fileName: String(file?.name || "custom-logo"), mimeType: file?.type || "", size: Number(file?.size || 0), dataUrl, mock: true, persistence: "MEMORY_ONLY", sourceStatus: "NON_OFFICIAL_CUSTOM" };
}

