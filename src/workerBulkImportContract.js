import { WORKER_IMPORT_CONTRACT } from "./mock/workerImportContract.js";

export const RESOURCE_IMPORT_HEADERS = Object.freeze([
  "vps_key", "display_name", "resource_type", "resource_address",
  "country_code", "country_name", "city", "environment", "purpose", "site_label",
  "cpu_cores", "memory_gb", "system_disk_gb", "bandwidth_mbps",
  "provider_name", "provider_logo_url", "provider_website_url",
  "provider_website_username", "provider_website_credential",
  "runtime_name", "runtime_type", "agent_a_name", "agent_b_name", "test_only",
]);

export const PROVIDER_CREDENTIAL_ALIASES = Object.freeze([
  "provider_website_credential",
  "provider_website_password",
]);
export const RESOURCE_IMPORT_PASSWORD_ALIAS_HEADERS = Object.freeze(
  RESOURCE_IMPORT_HEADERS.map((key) => key === "provider_website_credential" ? "provider_website_password" : key),
);

export const BUILTIN_PROVIDERS = Object.freeze([
  { id: "aws", name: "AWS", aliases: ["aws", "amazon web services"], website: "https://aws.amazon.com/", logo: "/assets/brand/provider-verifiable/aws.png" },
  { id: "aliyun", name: "阿里云", aliases: ["阿里云", "alibaba cloud", "aliyun"], website: "https://www.alibabacloud.com/", logo: "/assets/brand/simple-icons-color/alibabacloud.svg" },
  { id: "tencent", name: "腾讯云", aliases: ["腾讯云", "tencent cloud"], website: "https://cloud.tencent.com/", logo: "/assets/brand/provider-verifiable/tencent-cloud.svg" },
  { id: "huawei", name: "华为云", aliases: ["华为云", "huawei cloud"], website: "https://www.huaweicloud.com/", logo: "/assets/brand/simple-icons-color/huawei.svg" },
  { id: "google-cloud", name: "Google Cloud", aliases: ["google cloud", "gcp"], website: "https://cloud.google.com/", logo: "/assets/brand/simple-icons-color/googlecloud.svg" },
  { id: "digitalocean", name: "DigitalOcean", aliases: ["digitalocean", "digital ocean"], website: "https://www.digitalocean.com/", logo: "/assets/brand/simple-icons-color/digitalocean.svg" },
  { id: "azure", name: "Microsoft Azure", aliases: ["microsoft azure", "azure"], website: "https://azure.microsoft.com/", logo: "/assets/brand/provider-verifiable/microsoft-azure.svg" },
]);

const requiredExistingFields = WORKER_IMPORT_CONTRACT.fields.filter((field) => field.required).map((field) => field.key);
const allowedValues = {
  environment: new Set(WORKER_IMPORT_CONTRACT.enums.environment),
  purpose: new Set(WORKER_IMPORT_CONTRACT.enums.purpose),
  runtime_type: new Set(WORKER_IMPORT_CONTRACT.enums.runtimeTypes.map(({ value }) => value)),
};
const ipv4Octet = /^(?:0|[1-9]\d{0,2})$/;
const domainLabel = /^[a-z\p{L}\p{N}](?:[a-z\p{L}\p{N}-]{0,61}[a-z\p{L}\p{N}])?$/iu;

function parsePort(value) {
  if (value === undefined) return { valid: true, value: null };
  if (!/^\d{1,5}$/.test(value)) return { valid: false, value: null };
  const port = Number(value);
  return { valid: Number.isInteger(port) && port >= 1 && port <= 65535, value: port };
}

function isIpv4(host) {
  const parts = host.split(".");
  return parts.length === 4 && parts.every((part) => ipv4Octet.test(part) && Number(part) <= 255);
}

function isIpv6(host) {
  if (!host || !host.includes(":")) return false;
  try {
    const parsed = new URL(`http://[${host}]/`);
    return parsed.hostname.startsWith("[") && parsed.hostname.endsWith("]");
  } catch {
    return false;
  }
}

function isDomain(host) {
  if (!host || host.length > 253 || host.startsWith(".") || host.endsWith(".")) return false;
  const labels = host.split(".");
  if (labels.length < 2 || !labels.every((label) => label.length <= 63 && domainLabel.test(label))) return false;
  return /\p{L}/u.test(host) || labels.every((label) => /^[a-z0-9-]+$/i.test(label));
}

/** Validate an address without normalizing or rewriting its display value. */
export function validateResourceAddress(input) {
  const displayValue = String(input ?? "");
  const fail = (reason) => ({ valid: false, kind: null, port: null, displayValue, reason });
  if (!displayValue || displayValue !== displayValue.trim()) return fail("地址不能为空，且首尾不能有空格");
  if (/[\s/?#@]/.test(displayValue) || /^[a-z][a-z\d+.-]*:\/\//i.test(displayValue)) return fail("只填写 IP 或域名，可选端口，不要填写协议或路径");

  let host = displayValue;
  let portText;
  let bracketedIpv6 = false;
  const bracketed = displayValue.match(/^\[([^\]]+)\](?::(.*))?$/);
  if (bracketed) {
    bracketedIpv6 = true;
    host = bracketed[1];
    portText = bracketed[2];
    if (!isIpv6(host)) return fail("IPv6 地址格式无效");
  } else {
    const colons = (displayValue.match(/:/g) || []).length;
    if (colons > 1) {
      if (!isIpv6(displayValue)) return fail("IPv6 地址格式无效；带端口时请使用 [IPv6]:端口 格式");
      host = displayValue;
    } else if (colons === 1) {
      const separator = displayValue.lastIndexOf(":");
      host = displayValue.slice(0, separator);
      portText = displayValue.slice(separator + 1);
    }
  }

  const port = parsePort(portText);
  if (!port.valid) return fail("端口必须是 1 到 65535 的整数");
  let kind;
  if (isIpv4(host)) kind = "ipv4";
  else if (/^[\d.]+$/.test(host)) return fail("IPv4 地址格式无效");
  else if (!bracketedIpv6 && isIpv6(host)) kind = "ipv6";
  else if (bracketedIpv6) kind = "ipv6";
  else if (isDomain(host)) kind = "domain";
  else return fail("请输入有效的 IPv4、IPv6 或域名地址");

  return { valid: true, kind, port: port.value, displayValue, reason: "" };
}

export function validateSecureWebsiteUrl(input) {
  const value = String(input ?? "");
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && Boolean(url.hostname) && !url.hash;
  } catch {
    return false;
  }
}

export function validateResourceImportHeaders(actualHeaders) {
  const actual = Array.isArray(actualHeaders) ? actualHeaders.map((value) => String(value)) : [];
  const validOrder = [RESOURCE_IMPORT_HEADERS, RESOURCE_IMPORT_PASSWORD_ALIAS_HEADERS]
    .some((expected) => expected.length === actual.length && expected.every((header, index) => header === actual[index]));
  if (validOrder) return { valid: true, errors: [] };
  const expected = new Set(RESOURCE_IMPORT_HEADERS);
  const actualSet = new Set(actual);
  const missing = RESOURCE_IMPORT_HEADERS.filter((header) => !actualSet.has(header) && !(header === "provider_website_credential" && actualSet.has("provider_website_password")));
  const extra = actual.filter((header) => !expected.has(header) && !(header === "provider_website_password" && expected.has("provider_website_credential")));
  return {
    valid: false,
    errors: [`模板列与当前导入结构不一致。缺少：${missing.join(", ") || "无"}；额外：${extra.join(", ") || "无"}。不会自动改列、拆分地址或丢弃凭据字段。`],
  };
}

function canonicalProvider(input) {
  const key = String(input ?? "").trim().toLocaleLowerCase();
  return BUILTIN_PROVIDERS.find((provider) => provider.aliases.includes(key)) || null;
}

/** Return a display-safe row; never retain an import credential in React state. */
export function validateAndSanitizeResourceImportRecord(record, line, seenKeys = new Set()) {
  const errors = [];
  const resourceType = String(record.resource_type ?? "VPS").trim().toUpperCase();
  if (!new Set(["VPS", "MOBILE_RPA"]).has(resourceType)) errors.push("resource_type 必须是 VPS 或 MOBILE_RPA");
  for (const key of requiredExistingFields) {
    if (!String(record[key] ?? "").trim()) errors.push(`${key} 必填`);
  }

  const address = String(record.resource_address ?? "");
  const addressResult = resourceType === "VPS" ? validateResourceAddress(address) : null;
  if (resourceType === "VPS" && !addressResult?.valid) errors.push(`resource_address：${addressResult?.reason || "请输入有效地址"}`);
  if (resourceType === "MOBILE_RPA" && address && !addressResult?.valid) errors.push(`resource_address：${addressResult?.reason || "请输入有效地址"}`);

  const country = String(record.country_code ?? "").trim().toUpperCase();
  if (country && !new Set(WORKER_IMPORT_CONTRACT.isoCountryCodes).has(country)) errors.push("country_code 必须是 ISO Alpha-2 代码");
  for (const [key, allowed] of Object.entries(allowedValues)) {
    const value = String(record[key] ?? "").trim().toUpperCase();
    if (value && !allowed.has(value)) errors.push(`${key} 不在允许范围内`);
  }
  for (const key of WORKER_IMPORT_CONTRACT.integerFields) {
    const value = String(record[key] ?? "").trim();
    if (value && !/^[+-]?\d+$/.test(value)) errors.push(`${key} 必须是整数`);
  }

  const vpsKey = String(record.vps_key ?? "").trim();
  const duplicate = Boolean(vpsKey && seenKeys.has(vpsKey));
  if (duplicate) errors.push("vps_key 在此文件前序行重复");
  if (vpsKey) seenKeys.add(vpsKey);

  const providerName = String(record.provider_name ?? "").trim();
  const builtin = canonicalProvider(providerName);
  const custom = providerName && !builtin;
  const logo = String(record.provider_logo_url ?? "").trim();
  const website = String(record.provider_website_url ?? "").trim();
  if (custom && !logo) errors.push("自定义服务商必须提供 provider_logo_url");
  if (custom && !validateSecureWebsiteUrl(website)) errors.push("自定义服务商必须提供有效的 HTTPS provider_website_url");
  if (builtin && website && !validateSecureWebsiteUrl(website)) errors.push("provider_website_url 必须是安全的 HTTPS 地址");
  if (logo && !validateSecureWebsiteUrl(logo)) errors.push("provider_logo_url 必须是安全的 HTTPS 地址");

  const credentials = PROVIDER_CREDENTIAL_ALIASES.filter((key) => String(record[key] ?? "") !== "");
  if (credentials.length > 1) errors.push("请只填写一个服务商凭据列");
  if (credentials.length && !String(record.provider_website_username ?? "").trim()) errors.push("填写服务商凭据时必须提供 provider_website_username");

  const safeRecord = { ...record };
  for (const key of PROVIDER_CREDENTIAL_ALIASES) safeRecord[key] = "";
  safeRecord.__credentialProvided = credentials.length === 1;
  safeRecord.__credentialIndicator = credentials.length === 1 ? "已填写 · 待安全保存" : "未提供凭据";
  safeRecord.__line = line;
  safeRecord.__errors = errors;
  safeRecord.__duplicate = duplicate;
  safeRecord.__deferred = resourceType === "MOBILE_RPA";
  safeRecord.__resourceType = resourceType;
  safeRecord.__addressKind = addressResult?.kind || null;
  safeRecord.__canonicalProviderId = builtin?.id || (custom ? "custom" : null);
  safeRecord.__providerWebsite = builtin?.website || website || "";
  return safeRecord;
}

export function safeProviderUrl(providerName, customUrl = "") {
  const provider = canonicalProvider(providerName);
  const target = provider?.website || String(customUrl ?? "").trim();
  return validateSecureWebsiteUrl(target) ? target : "";
}

export const RESOURCE_IMPORT_EXAMPLE_ROWS = Object.freeze([
  Object.freeze({ vps_key: "EXAMPLE_IP", display_name: "示例 IP 地址资源（导入前请替换）", resource_type: "VPS", resource_address: "103.10.10.11", country_code: "ID", country_name: "Indonesia", city: "Jakarta", environment: "TEST", purpose: "SYSTEM_MOCK", provider_name: "AWS", provider_website_url: "", provider_logo_url: "", test_only: "true", runtime_type: "BROWSER_RPA" }),
  Object.freeze({ vps_key: "EXAMPLE_IP_PORT", display_name: "示例 IP 端口资源（导入前请替换）", resource_type: "VPS", resource_address: "103.10.10.11:3389", country_code: "ID", country_name: "Indonesia", city: "Jakarta", environment: "TEST", purpose: "SYSTEM_MOCK", provider_name: "DigitalOcean", provider_website_url: "", provider_logo_url: "", test_only: "true", runtime_type: "BROWSER_RPA" }),
  Object.freeze({ vps_key: "EXAMPLE_DOMAIN", display_name: "示例域名资源（导入前请替换）", resource_type: "VPS", resource_address: "vps.example.com", country_code: "ID", country_name: "Indonesia", city: "Jakarta", environment: "TEST", purpose: "SYSTEM_MOCK", provider_name: "阿里云", provider_website_url: "", provider_logo_url: "", test_only: "true", runtime_type: "BROWSER_RPA" }),
  Object.freeze({ vps_key: "EXAMPLE_DOMAIN_PORT", display_name: "示例域名端口资源（导入前请替换）", resource_type: "VPS", resource_address: "vps.example.com:49268", country_code: "ID", country_name: "Indonesia", city: "Jakarta", environment: "TEST", purpose: "SYSTEM_MOCK", provider_name: "示例服务商", provider_logo_url: "https://example.com/logo.svg", provider_website_url: "https://example.com/", provider_website_username: "example-user", provider_website_credential: "", test_only: "true", runtime_type: "BROWSER_RPA" }),
  Object.freeze({ vps_key: "EXAMPLE_MOBILE_RPA", display_name: "示例手机 RPA（功能延期；请勿作为可导入资源）", resource_type: "MOBILE_RPA", resource_address: "", country_code: "ID", country_name: "Indonesia", city: "Jakarta", environment: "TEST", purpose: "SYSTEM_MOCK", test_only: "true", runtime_type: "ANDROID_RUNTIME" }),
]);

export function buildResourceImportTemplateRows() {
  return RESOURCE_IMPORT_EXAMPLE_ROWS.map((example) => RESOURCE_IMPORT_HEADERS.map((key) => example[key] ?? ""));
}

export const RESOURCE_IMPORT_FIELD_HELP = Object.freeze([
  ["resource_address", "VPS 地址格式：IP、IP:PORT、DOMAIN、DOMAIN:PORT；IPv6 带端口时使用 [IPv6]:PORT。未填写端口时不会补默认端口。"],
  ["provider_name", "内置服务商名称；自定义服务商请填 provider_name、provider_logo_url 与 provider_website_url。"],
  ["provider_logo_url", "自定义服务商使用 HTTPS 图片地址；仅用于预览，不会访问非 HTTPS 地址。"],
  ["provider_website_url", "服务商官网 HTTPS 地址；展示链接始终新窗口打开并禁用 opener/referrer。"],
  ["provider_website_username", "服务商网站账号名称；可在资源资料中显示。"],
  ["provider_website_credential", "可选；仅应由 staging Secret Store 适配器安全摄取，普通预览只显示掩码，不得回显或持久化明文。旧列名 provider_website_password 仅作识别别名。"],
  ["resource_type", "VPS 可继续当前真实链路；MOBILE_RPA 当前仅 UI_PRESENT，FUNCTION_DEFERRED。"],
]);
