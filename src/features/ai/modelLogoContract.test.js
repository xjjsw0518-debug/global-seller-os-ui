import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { MODEL_LOGO_MAX_BYTES, createLocalMockModelLogo, identifyLogoMime, providerLogoAssets, providerLogoCatalog, requiredModelVendorLogoKeys, resolveModelLogo, resolveProviderLogoName, validateModelLogoFile } from "./modelLogoContract.js";

const png = Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0x00]);
const jpeg = Uint8Array.from([0xff,0xd8,0xff,0x00]);
const webp = Uint8Array.from([0x52,0x49,0x46,0x46,0x00,0x00,0x00,0x00,0x57,0x45,0x42,0x50]);
const file = (type, bytes, size = bytes.length, name = "logo.bin") => ({ type, size, name, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });

test("accepts PNG/JPEG/WebP signatures; rejects unsupported or mismatched types", async () => {
  assert.equal(identifyLogoMime(png), "image/png"); assert.equal(identifyLogoMime(jpeg), "image/jpeg"); assert.equal(identifyLogoMime(webp), "image/webp");
  for (const [type, bytes] of [["image/png",png],["image/jpeg",jpeg],["image/webp",webp]]) assert.equal((await validateModelLogoFile(file(type, bytes), { decode: false })).valid, true);
  assert.equal((await validateModelLogoFile(file("image/svg+xml", png), { decode: false })).code, "LOGO_TYPE_UNSUPPORTED");
  assert.equal((await validateModelLogoFile(file("image/png", jpeg), { decode: false })).code, "LOGO_SIGNATURE_MISMATCH");
  assert.equal((await validateModelLogoFile(file("image/png", new Uint8Array([1,2,3])), { decode: false })).code, "LOGO_SIGNATURE_MISMATCH");
});

test("enforces non-empty 1 MiB size boundary", async () => {
  assert.equal((await validateModelLogoFile(file("image/png", png, 0), { decode: false })).code, "LOGO_SIZE_INVALID");
  assert.equal((await validateModelLogoFile(file("image/png", png, MODEL_LOGO_MAX_BYTES), { decode: false })).valid, true);
  assert.equal((await validateModelLogoFile(file("image/png", png, MODEL_LOGO_MAX_BYTES + 1), { decode: false })).code, "LOGO_SIZE_INVALID");
  assert.equal((await validateModelLogoFile(null, { decode: false })).code, "LOGO_FILE_REQUIRED");
});

test("model-specific user logo wins; otherwise use explicit provider asset or neutral generic", () => {
  const custom = resolveModelLogo({ model: "model-x", provider: "Google", modelLogo: { kind: "custom-model", dataUrl: "data:image/png;base64,AA==" } });
  assert.equal(custom.kind, "custom-model"); assert.equal(custom.persistence, "MEMORY_ONLY"); assert.equal(custom.sourceStatus, "NON_OFFICIAL_CUSTOM");
  const provider = resolveModelLogo({ model: "model-y", provider: "Google" });
  assert.equal(provider.kind, "provider-local-asset"); assert.equal(provider.sourceStatus, "COMMONS_FILE_PAGE_VERIFIED"); assert.equal(provider.licenseStatus, "CC0_VECTORIZATION_TRADEMARK_REMAINS");
  const unknown = resolveModelLogo({ model: "model-z", provider: "Unknown" });
  assert.equal(unknown.kind, "generic-provider-fallback"); assert.equal(unknown.iconName, "SquaresFour");
});

test("named providers use their local brand asset or an honest provider-name fallback", () => {
  for (const name of ["OpenAI", "Anthropic", "Google", "DeepSeek", "Alibaba Cloud", "Microsoft Azure"]) {
    assert.equal(providerLogoCatalog[name].kind, "provider-local-asset", name);
    if (name === "OpenAI") {
      assert.equal(providerLogoCatalog[name].sourceStatus,"USER_SUPPLIED_REFERENCE");
      assert.equal(providerLogoCatalog[name].licenseStatus,"USER_SUPPLIED_REFERENCE");
    } else assert.ok(providerLogoCatalog[name].sourceUrl, name);
    assert.notEqual(providerLogoCatalog[name].sourceStatus, "SOURCE_UNVERIFIED", name);
  }
  const azure = resolveModelLogo({ model: "Azure OpenAI", provider: "Microsoft Azure" });
  assert.equal(azure.kind, "provider-local-asset"); assert.equal(azure.src, "microsoft-azure-logo.svg");
  const openai = resolveModelLogo({ model: "GPT-4o", provider: "OpenAI" });
  assert.equal(openai.kind, "provider-local-asset"); assert.equal(openai.src, "openai-user-knot-icon.png");
  const alibaba = resolveModelLogo({ model: "Qwen Max", provider: "Alibaba Cloud" });
  assert.equal(alibaba.kind, "provider-local-asset"); assert.equal(alibaba.src, "alibaba-cloud-official-footer.svg");
  const other = resolveModelLogo({ model: "custom", provider: "其他" });
  assert.equal(other.iconName, "SquaresFour"); assert.equal(other.persistence, "GENERIC_PROVIDER_FALLBACK");
});

test("all mapped brand assets exist and SVGs contain only safe local references", async () => {
  for (const [provider, entry] of Object.entries(providerLogoCatalog)) {
    if (entry.kind !== "provider-local-asset") continue;
    const bytes = await readFile(new URL(`./assets/provider-logos/${entry.src}`, import.meta.url));
    assert.ok(bytes.length > 0, `${provider} asset is not empty`);
    if (/\.svg$/i.test(entry.src)) {
      const content = bytes.toString("utf8");
      assert.match(content, /<svg[\s>]/i, provider);
      assert.doesNotMatch(content, /<script|<foreignObject|\son[a-z]+\s*=/i, provider);
      assert.doesNotMatch(content, /(?:href|src)\s*=\s*["']https?:/i, provider);
      const references = [...content.matchAll(/\b(?:xlink:)?href\s*=\s*["']([^"']+)/gi)].map((match) => match[1]);
      assert.ok(references.every((reference) => reference.startsWith("#")), `${provider} has only local fragment references`);
    }
  }
  const notices = await readFile(new URL("./assets/provider-logos/README.md", import.meta.url), "utf8");
  assert.match(notices, /Copyright © DeepSeek/);
  assert.match(notices, /MIT\/Expat/);
});

test("custom logo descriptor remains local-only and keeps memory fallback contract", () => {
  const descriptor = createLocalMockModelLogo({ name: "logo.webp", type: "image/webp", size: 12 }, "data:image/webp;base64,AA==");
  assert.equal(descriptor.fileName, "logo.webp"); assert.equal(descriptor.persistence, "MEMORY_ONLY"); assert.equal(descriptor.mock, true); assert.equal(descriptor.sourceStatus, "NON_OFFICIAL_CUSTOM");
});

test("all required model vendors resolve to a local branded asset with recorded provenance", () => {
  for (const [vendorId, canonicalName] of Object.entries(requiredModelVendorLogoKeys)) {
    assert.equal(resolveProviderLogoName(vendorId), canonicalName, vendorId);
    assert.equal(providerLogoCatalog[canonicalName].kind, "provider-local-asset", vendorId);
    if (canonicalName === "OpenAI") {
      assert.equal(providerLogoCatalog[canonicalName].sourceStatus,"USER_SUPPLIED_REFERENCE");
      assert.equal(providerLogoCatalog[canonicalName].src,"openai-user-knot-icon.png");
    } else assert.ok(providerLogoCatalog[canonicalName].sourceUrl, vendorId);
    assert.ok(providerLogoCatalog[canonicalName].sourceStatus === "USER_SUPPLIED_REFERENCE" && canonicalName === "OpenAI" || providerLogoCatalog[canonicalName].sourceStatus.startsWith("OFFICIAL_") || providerLogoCatalog[canonicalName].sourceStatus === "COMMONS_FILE_PAGE_VERIFIED" || providerLogoCatalog[canonicalName].sourceStatus === "DEEPSEEK_SOURCE_RECORDED", vendorId);
    const resolved = resolveModelLogo({ model: "vendor-fixture", provider: vendorId });
    assert.equal(resolved.kind, "provider-local-asset", vendorId);
    const assetFile = new URL(providerLogoAssets[canonicalName]).pathname.split("/").at(-1);
    assert.equal(resolved.src, assetFile, vendorId);
  }
});

test("brand aliases remain distinct from access and connection providers", () => {
  assert.equal(resolveProviderLogoName("GOOGLE_GEMINI"), "Google");
  assert.equal(resolveProviderLogoName("MOONSHOT"), "Kimi");
  assert.equal(resolveProviderLogoName("GLM"), "Zhipu AI");
  assert.equal(resolveProviderLogoName("Grok"), "xAI");
  assert.equal(resolveProviderLogoName("ByteDance"), "Doubao");
  assert.equal(resolveProviderLogoName("Alibaba Cloud"), "Alibaba Cloud");
  assert.equal(resolveProviderLogoName("OpenAI-Compatible Gateway"), "OpenAI-Compatible Gateway");
});

test("provider assets are shared by Add, list, and edit surfaces", () => {
  for (const name of ["OpenAI", "Anthropic", "Google", "DeepSeek", "Alibaba Cloud", "Microsoft Azure"]) {
    const resolved = resolveModelLogo({ model: "logo-fixture", provider: name });
    const assetFile = new URL(providerLogoAssets[name]).pathname.split("/").at(-1);
    assert.equal(resolved.kind, "provider-local-asset", name);
    assert.equal(resolved.src, assetFile, name);
    assert.equal(providerLogoCatalog[name].src, assetFile, name);
    assert.equal(resolveProviderLogoName("CUSTOM", `${name} (SYNTHETIC)`), name);
  }
  assert.equal(resolveProviderLogoName("OPENAI"), "OpenAI");
  assert.equal(resolveProviderLogoName("DEEPSEEK"), "DeepSeek");
  assert.equal(resolveProviderLogoName("DOUBAO"), "Doubao");
});

test("recognizes explicit provider aliases without widening unknown or protocol names into brand marks", () => {
  assert.equal(resolveProviderLogoName("OpenAI API"), "OpenAI");
  assert.equal(resolveProviderLogoName("open_ai"), "OpenAI");
  assert.equal(resolveProviderLogoName("Claude API"), "Anthropic");
  assert.equal(resolveProviderLogoName("Google AI Studio"), "Google");
  assert.equal(resolveProviderLogoName("Vertex AI"), "Google");
  assert.equal(resolveProviderLogoName("DeepSeek API"), "DeepSeek");
  assert.equal(resolveProviderLogoName("Alibaba Cloud Model Studio"), "Alibaba Cloud");
  assert.equal(resolveProviderLogoName("Azure OpenAI Service"), "Microsoft Azure");
  assert.equal(resolveProviderLogoName("OpenAI-Compatible Gateway"), "OpenAI-Compatible Gateway");
  assert.equal(resolveProviderLogoName("DOUBAO"), "Doubao");
  assert.equal(resolveProviderLogoName("CUSTOM", "Unverified reseller"), "CUSTOM");
});

