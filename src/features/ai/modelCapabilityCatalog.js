// Local candidate catalog for the AI UI. Entries are not proof of runtime enablement.
export const CAPABILITY_CATALOG_STATUS = "LOCAL_CANDIDATE_CATALOG_NOT_REMOTE_REGISTRY";

export const SCENARIO_CANDIDATES = Object.freeze([
  "GENERAL", "RPA", "CONTENT_CREATION", "AI_GUARD", "PRODUCT", "CUSTOMER_SERVICE", "VOICE_SALES",
]);
export const MODALITY_CANDIDATES = Object.freeze(["TEXT", "JSON", "IMAGE", "VIDEO", "AUDIO"]);
export const DEPLOYMENT_TYPES = Object.freeze([
  "EXTERNAL_API", "LOCAL_RUNTIME", "GPU_RUNTIME", "OLLAMA", "PRIVATE_ENDPOINT",
]);
export const CONNECTION_TYPES = Object.freeze([
  "OPENAI_COMPATIBLE", "PROVIDER_NATIVE", "OLLAMA", "CUSTOM_HTTP", "LOCAL_RUNTIME", "GPU_RUNTIME",
  // Kept as a first-class legacy alias; payloads retain CUSTOM verbatim.
  "CUSTOM",
]);
export const ROUTING_POLICY_CANDIDATES = Object.freeze([
  "CHEAPEST_QUALIFIED", "FASTEST", "BEST_QUALITY", "BALANCED", "FIXED_MODEL",
]);
export const COMMERCIAL_USE_STATUSES = Object.freeze([
  "UNKNOWN", "CONFIRMED_ALLOWED", "RESTRICTED", "PROHIBITED", "NEEDS_REVIEW",
]);
export const COMMERCIAL_COST_STATUSES = Object.freeze([
  "UNKNOWN", "ESTIMATED", "VERIFIED", "CONFIRMED_FREE",
]);
export const COST_UNIT_CANDIDATES = Object.freeze([
  "UNKNOWN", "TOKEN_PER_1M", "IMAGE", "VIDEO_SECOND", "AUDIO_SECOND", "AUDIO_TOKEN_1K", "GPU_SECOND", "REQUEST",
]);
export const RUNTIME_HEALTH_REASONS = Object.freeze([
  "UNKNOWN", "RUNTIME_OFFLINE", "VRAM_EXHAUSTED", "QUEUE_FULL", "MODEL_LOAD_FAILED",
  "MODEL_VERSION_MISMATCH", "ENDPOINT_UNREACHABLE", "AUTH_ERROR", "QUOTA_EXHAUSTED",
]);

// AUDIO_REFERENCE is a role carried by AUDIO input, not another modality.
export const MODALITY_INPUT_ROLES = Object.freeze({
  AUDIO_REFERENCE: Object.freeze({
    modality: "AUDIO", direction: "INPUT", role: "REFERENCE_CONDITIONING",
    applicableCapabilities: Object.freeze(["VOICE_CLONING", "VOICE_STYLE_CONTROL"]),
  }),
});

export const CAPABILITY_ADVANCED_FIELDS = Object.freeze({
  imageWidthPx: Object.freeze({ type: "integer", unit: "px", purpose: "image_dimensions" }),
  imageHeightPx: Object.freeze({ type: "integer", unit: "px", purpose: "image_dimensions" }),
  resolution: Object.freeze({ type: "string", unit: null, purpose: "media_resolution" }),
  aspectRatios: Object.freeze({ type: "string_list", unit: null, purpose: "media_aspect_ratio" }),
  maxDurationSeconds: Object.freeze({ type: "number", unit: "seconds", purpose: "media_duration" }),
  frameRateFps: Object.freeze({ type: "number", unit: "fps", purpose: "video_frame_rate" }),
  supportedFormats: Object.freeze({ type: "string_list", unit: null, purpose: "media_formats" }),
  minimumVramGb: Object.freeze({ type: "number", unit: "GB", purpose: "runtime_resource" }),
  expectedLatencyMs: Object.freeze({ type: "number", unit: "ms", purpose: "runtime_performance" }),
  maxConcurrency: Object.freeze({ type: "integer", unit: "requests", purpose: "runtime_capacity" }),
  streaming: Object.freeze({ type: "boolean", unit: null, purpose: "runtime_mode" }),
  batchSize: Object.freeze({ type: "integer", unit: "items", purpose: "runtime_capacity" }),
});

const advanced = Object.freeze({
  image: Object.freeze(["imageWidthPx", "imageHeightPx", "resolution", "aspectRatios", "supportedFormats", "batchSize"]),
  video: Object.freeze(["resolution", "aspectRatios", "maxDurationSeconds", "frameRateFps", "supportedFormats", "minimumVramGb", "expectedLatencyMs", "maxConcurrency", "streaming", "batchSize"]),
  audio: Object.freeze(["maxDurationSeconds", "supportedFormats", "minimumVramGb", "expectedLatencyMs", "maxConcurrency", "streaming", "batchSize"]),
  runtime: Object.freeze(["minimumVramGb", "expectedLatencyMs", "maxConcurrency", "streaming", "batchSize"]),
});
const define = (id, group, input, output, advancedFields = []) => Object.freeze({
  id, group, inputModalities: Object.freeze(input), outputModalities: Object.freeze(output),
  advancedFields: Object.freeze(advancedFields), status: "CANDIDATE_NOT_REMOTE_VERIFIED",
});
export const AI_CAPABILITY_CATALOG = Object.freeze([
  // Canonical Model & Quota capability IDs; legacy aliases below remain available for stored drafts.
  define("STRUCTURED_OUTPUT", "text", ["TEXT"], ["JSON"]),
  define("FUNCTION_CALLING", "tools", ["TEXT", "JSON"], ["TEXT", "JSON"]),
  define("TRANSLATION", "text", ["TEXT"], ["TEXT"]),
  define("IMAGE_UNDERSTANDING", "vision", ["IMAGE", "TEXT"], ["TEXT", "JSON"]),
  define("DOCUMENT_UNDERSTANDING", "vision", ["IMAGE", "TEXT"], ["TEXT", "JSON"]),
  define("OCR", "vision", ["IMAGE"], ["TEXT", "JSON"]),
  define("IMAGE_EDIT", "image", ["IMAGE", "TEXT"], ["IMAGE"], advanced.image),
  define("IMAGE_TO_VIDEO", "video", ["IMAGE", "TEXT"], ["VIDEO"], advanced.video),
  define("TEXT_TO_VIDEO", "video", ["TEXT"], ["VIDEO"], advanced.video),
  define("VIDEO_EDIT", "video", ["VIDEO", "TEXT"], ["VIDEO"], advanced.video),
  define("STT", "audio", ["AUDIO"], ["TEXT"], advanced.audio),
  define("TTS", "audio", ["TEXT"], ["AUDIO"], advanced.audio),
  define("VOICE_CLONE", "audio", ["AUDIO", "TEXT"], ["AUDIO"], advanced.audio),
  define("REALTIME_VOICE", "audio", ["AUDIO", "TEXT"], ["AUDIO", "TEXT"], advanced.audio),
  define("UPSCALE", "image", ["IMAGE"], ["IMAGE"], advanced.image),
  define("RESTORE", "image", ["IMAGE"], ["IMAGE"], advanced.image),
  define("TEXT_GENERATION", "text", ["TEXT"], ["TEXT"]),
  define("STRUCTURED_OUTPUT_JSON", "text", ["TEXT"], ["JSON"]),
  define("COMPLEX_REASONING", "reasoning", ["TEXT"], ["TEXT"]),
  define("TOOL_CALLING", "tools", ["TEXT", "JSON"], ["TEXT", "JSON"]),
  define("RPA_PLANNER_TOOL_CALLING", "tools", ["TEXT", "JSON"], ["TEXT", "JSON"], advanced.runtime),
  define("SENTIMENT_ANALYSIS", "other", ["TEXT"], ["JSON"]),
  define("NEXT_BEST_ACTION", "other", ["TEXT", "JSON"], ["JSON"]),
  define("VISION_UNDERSTANDING", "vision", ["IMAGE", "TEXT"], ["TEXT", "JSON"]),
  define("IMAGE_GENERATION", "image", ["TEXT"], ["IMAGE"], advanced.image),
  define("IMAGE_EDITING", "image", ["IMAGE", "TEXT"], ["IMAGE"], advanced.image),
  define("IMAGE_INPAINTING", "image", ["IMAGE", "TEXT"], ["IMAGE"], advanced.image),
  define("IMAGE_BACKGROUND_REMOVAL", "image", ["IMAGE"], ["IMAGE"], advanced.image),
  define("IMAGE_SCENE_GENERATION", "image", ["TEXT"], ["IMAGE"], advanced.image),
  define("IMAGE_SEGMENTATION", "image", ["IMAGE"], ["IMAGE", "JSON"], advanced.image),
  define("OBJECT_REMOVAL", "image", ["IMAGE", "TEXT"], ["IMAGE"], advanced.image),
  define("MASK_GENERATION", "image", ["IMAGE", "TEXT"], ["IMAGE"], advanced.image),
  define("IMAGE_UPSCALING", "image", ["IMAGE"], ["IMAGE"], advanced.image),
  define("IMAGE_RESTORATION", "image", ["IMAGE"], ["IMAGE"], advanced.image),
  define("VIDEO_UNDERSTANDING", "video", ["VIDEO", "TEXT"], ["TEXT", "JSON"], advanced.video),
  define("VIDEO_GENERATION", "video", ["TEXT", "IMAGE"], ["VIDEO"], advanced.video),
  define("VIDEO_EDITING", "video", ["VIDEO", "TEXT"], ["VIDEO"], advanced.video),
  define("VIDEO_INPAINTING", "video", ["VIDEO", "TEXT"], ["VIDEO"], advanced.video),
  define("VIDEO_FRAME_INTERPOLATION", "video", ["VIDEO"], ["VIDEO"], advanced.video),
  define("LIP_SYNC", "audio_video", ["AUDIO", "VIDEO", "TEXT"], ["VIDEO"], advanced.video),
  define("PORTRAIT_ANIMATION", "audio_video", ["IMAGE", "AUDIO", "TEXT"], ["VIDEO"], advanced.video),
  define("FACE_ANIMATION", "audio_video", ["IMAGE", "TEXT"], ["VIDEO"], advanced.video),
  define("TEXT_TO_SPEECH", "audio", ["TEXT"], ["AUDIO"], advanced.audio),
  define("VOICE_CLONING", "audio", ["AUDIO", "TEXT"], ["AUDIO"], advanced.audio),
  define("VOICE_STYLE_CONTROL", "audio", ["AUDIO", "TEXT"], ["AUDIO"], advanced.audio),
  define("EMOTION_CONTROL", "audio", ["TEXT"], ["AUDIO"], advanced.audio),
  define("SPEECH_TO_TEXT", "audio", ["AUDIO"], ["TEXT"], advanced.audio),
  define("AUTOMATIC_SPEECH_RECOGNITION", "audio", ["AUDIO"], ["TEXT"], advanced.audio),
  define("TRANSCRIPTION", "audio", ["AUDIO"], ["TEXT"], advanced.audio),
  define("LANGUAGE_IDENTIFICATION", "audio", ["AUDIO"], ["TEXT", "JSON"], advanced.audio),
  define("MUSIC_GENERATION", "audio", ["TEXT"], ["AUDIO"], advanced.audio),
  define("SOUND_EFFECT_GENERATION", "audio", ["TEXT"], ["AUDIO"], advanced.audio),
]);
export const CAPABILITY_IDS = Object.freeze(AI_CAPABILITY_CATALOG.map((item) => item.id));
export const LEGACY_CAPABILITY_IDS = Object.freeze([
  "TEXT_GENERATION", "STRUCTURED_OUTPUT_JSON", "VISION_UNDERSTANDING", "IMAGE_GENERATION", "IMAGE_EDITING",
  "VIDEO_UNDERSTANDING", "VIDEO_GENERATION", "VIDEO_EDITING", "COMPLEX_REASONING", "RPA_PLANNER_TOOL_CALLING",
]);
export const DEPLOYMENT_CONNECTION_COMPATIBILITY = Object.freeze({
  EXTERNAL_API: Object.freeze(["OPENAI_COMPATIBLE", "PROVIDER_NATIVE", "CUSTOM_HTTP", "CUSTOM"]),
  LOCAL_RUNTIME: Object.freeze(["LOCAL_RUNTIME", "OLLAMA"]),
  GPU_RUNTIME: Object.freeze(["GPU_RUNTIME", "LOCAL_RUNTIME"]),
  OLLAMA: Object.freeze(["OLLAMA"]),
  PRIVATE_ENDPOINT: Object.freeze(["OPENAI_COMPATIBLE", "PROVIDER_NATIVE", "CUSTOM_HTTP", "CUSTOM", "LOCAL_RUNTIME", "GPU_RUNTIME"]),
});
export const getCapabilityDefinition = (id) => AI_CAPABILITY_CATALOG.find((item) => item.id === id) || null;

const uniqueKnownArray = (value, allowed) => Array.isArray(value)
  && value.every((item) => typeof item === "string" && allowed.includes(item))
  && new Set(value).size === value.length;
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

export function validateCapabilityDraftMetadata(draft) {
  const errors = {};
  const arrayFields = [
    ["scenarioSupport", SCENARIO_CANDIDATES],
    ["inputModalities", MODALITY_CANDIDATES],
    ["outputModalities", MODALITY_CANDIDATES],
    ["supportedLanguages", null],
  ];
  for (const [key, allowed] of arrayFields) {
    const value = draft[key];
    if (value == null) continue; // null is unknown; an explicit [] is a known empty selection.
    const valid = Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim().length > 0
      && item.length <= 35 && (!allowed || allowed.includes(item))) && new Set(value).size === value.length;
    if (!valid) errors[key] = allowed ? "Select unique registered values or leave unknown." : "Use a unique list of language tags or leave unknown.";
  }
  const capabilities = Array.isArray(draft.capabilities) ? draft.capabilities : [];
  for (const [modalityKey, direction] of [["inputModalities", "inputModalities"], ["outputModalities", "outputModalities"]]) {
    const selected = draft[modalityKey];
    if (selected == null || !Array.isArray(selected)) continue;
    for (const id of capabilities) {
      const capability = getCapabilityDefinition(id);
      if (capability && capability[direction].length && !capability[direction].some((item) => selected.includes(item))) {
        errors[modalityKey] = "Selected capabilities require a compatible " + (direction === "inputModalities" ? "input" : "output") + " modality.";
        break;
      }
    }
  }
  if (draft.deploymentType && draft.deploymentType !== "UNKNOWN" && draft.connectionType && draft.connectionType !== "UNKNOWN") {
    const compatible = DEPLOYMENT_CONNECTION_COMPATIBILITY[draft.deploymentType];
    if (compatible && !compatible.includes(draft.connectionType)) errors.connectionType = "This connection type does not match the selected deployment type.";
  }
  if (draft.capabilitySettings != null && !isRecord(draft.capabilitySettings)) errors.capabilitySettings = "Capability settings must be a keyed object or unknown.";
  if (isRecord(draft.capabilitySettings)) {
    for (const [capabilityId, settings] of Object.entries(draft.capabilitySettings)) {
      const definition = getCapabilityDefinition(capabilityId);
      if (!definition || !capabilities.includes(capabilityId) || !isRecord(settings)) { errors.capabilitySettings = "Advanced settings must belong to a selected capability."; break; }
      for (const [key, value] of Object.entries(settings)) {
        if (!definition.advancedFields.includes(key)) { errors.capabilitySettings = "The " + key + " setting is not registered for " + capabilityId + "."; break; }
        const rule = CAPABILITY_ADVANCED_FIELDS[key];
        if (rule.type === "integer" && (!Number.isInteger(value) || value < 1)) errors.capabilitySettings = key + " must be a positive integer.";
        else if (rule.type === "number" && (typeof value !== "number" || !Number.isFinite(value) || value < 0)) errors.capabilitySettings = key + " must be a non-negative number.";
        else if (rule.type === "string" && (typeof value !== "string" || !value.trim())) errors.capabilitySettings = key + " must be a non-empty value.";
        else if (rule.type === "string_list" && (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim()) || new Set(value).size !== value.length)) errors.capabilitySettings = key + " must be a unique list of values.";
        else if (rule.type === "boolean" && typeof value !== "boolean") errors.capabilitySettings = key + " must be true or false.";
      }
      if (errors.capabilitySettings) break;
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}
