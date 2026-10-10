export const PREVIEW_ONLY = true;

export const kpis = [
  { label: "资源总数", value: "482", tone: "blue", icon: "cube" },
  { label: "运行中RPA", value: "312", tone: "green", icon: "play" },
  { label: "空闲RPA", value: "86", tone: "blue", icon: "pause" },
  { label: "离线RPA", value: "48", tone: "danger", icon: "offline" },
  { label: "安装中", value: "3", tone: "warning", icon: "install" },
  { label: "已就绪", value: "367", tone: "green", icon: "ready" },
  { label: "可远程连接", value: "289", tone: "cyan", icon: "desktop" },
  { label: "异常 / 失败", value: "15", tone: "danger", icon: "alert" },
];

export const kpiSets = {
  global: kpis.filter((item) => item.label !== "安装中"),
  country: [
    { label: "资源总数", value: "42", tone: "blue", icon: "cube" },
    { label: "在线", value: "28", tone: "green", icon: "play" },
    { label: "离线", value: "6", tone: "blue", icon: "pause" },
    { label: "异常", value: "2", tone: "danger", icon: "alert" },
    { label: "已就绪", value: "36", tone: "green", icon: "ready" },
    { label: "VPS RPA", value: "18", tone: "cyan", icon: "desktop" },
    { label: "手机RPA", value: "12", tone: "purple", icon: "mobile" },
  ],
  city: [
    { label: "资源总数", value: "18", tone: "blue", icon: "cube" },
    { label: "运行中RPA", value: "12", tone: "green", icon: "play" },
    { label: "空闲RPA", value: "6", tone: "blue", icon: "pause" },
    { label: "离线RPA", value: "2", tone: "danger", icon: "offline" },
    { label: "已就绪", value: "16", tone: "green", icon: "ready" },
    { label: "可远程连接", value: "15", tone: "cyan", icon: "desktop" },
    { label: "异常", value: "0", tone: "danger", icon: "alert" },
  ],
};

export const globalSummary = [
  ["在线", "298", "green"], ["离线", "62", "muted"], ["异常", "15", "danger"],
  ["已就绪", "367", "green"], ["VPS RPA", "298", "blue"], ["手机RPA", "184", "purple"],
];

export const indonesiaSummary = [
  ["资源总数", "42", "blue"], ["VPS RPA", "18", "blue"], ["手机RPA", "12", "purple"],
  ["在线", "28", "green"], ["离线", "6", "muted"], ["异常", "2", "danger"], ["已就绪", "36", "green"],
];

export const jakartaSummary = [
  ["总资源数", "18", "blue"], ["在线", "18", "green"], ["离线", "2", "muted"],
  ["异常", "0", "danger"], ["已就绪", "16", "green"], ["VPS RPA", "12", "blue"], ["手机RPA", "6", "purple"],
];

export const topCountries = [
  ["印度尼西亚", "42", "id"], ["美国", "38", "us"], ["新加坡", "36", "sg"], ["德国", "28", "de"], ["日本", "25", "jp"],
];
export const topCities = [["Jakarta", "18"], ["Surabaya", "8"], ["Medan", "6"], ["Bandung", "4"], ["Makassar", "3"], ["Batam", "2"], ["Semarang", "1"], ["Yogyakarta", "1"]];

const common = { country: "印度尼西亚", countryCode: "id", city: "Jakarta", agent: "运行中", customerAgent: "运行中", worker: "运行中", runtime: "已就绪", remote: "RDP", progress: 100, final: "已就绪", heartbeat: "2024-01-14 12:32" };
export const resources = [
  { ...common, name: "IDN-JKT-001", type: "VPS RPA", provider: "AWS", providerKey: "aws", plan: "TikTok场景版", progress: 100, final: "已就绪" },
  { ...common, name: "IDN-JKT-002", type: "VPS RPA", provider: "DigitalOcean", providerKey: "digitalocean", plan: "YouTube版", progress: 90, final: "已就绪", heartbeat: "2024-01-14 10:21" },
  { ...common, name: "IDN-SBY-001", type: "VPS RPA", city: "Surabaya", provider: "Google Cloud", providerKey: "google", plan: "多平台版", progress: 80, final: "运行中", heartbeat: "2024-01-14 09:18" },
  { ...common, name: "IDN-SBY-002", type: "手机RPA", city: "Surabaya", provider: "Hetzner", providerKey: "hetzner", customerAgent: "空闲", remote: "手机远程", progress: 100, final: "已就绪", heartbeat: "2024-01-14 08:56" },
  { ...common, name: "IDN-MDN-001", type: "VPS RPA", city: "Medan", provider: "Alibaba Cloud", providerKey: "aliyun", worker: "空闲", progress: 70, final: "运行中", heartbeat: "2024-01-14 08:12" },
  { ...common, name: "IDN-BDG-001", type: "手机RPA", city: "Bandung", provider: "Microsoft Azure", providerKey: "azure", worker: "离线", runtime: "更新中", remote: "手机远程", progress: 60, final: "已就绪", heartbeat: "2024-01-13 22:41" },
  { ...common, name: "IDN-BDG-002", type: "VPS RPA", city: "Bandung", provider: "Vultr", providerKey: "vultr", customerAgent: "空闲", plan: "多平台版", progress: 100, final: "已就绪", heartbeat: "2024-01-13 20:33" },
  { ...common, name: "IDN-MKS-001", type: "手机RPA", city: "Makassar", provider: "Tencent Cloud", providerKey: "tencent", customerAgent: "异常", remote: "手机远程", progress: 85, final: "运行中", heartbeat: "2024-01-13 18:22" },
  { ...common, name: "IDN-MKS-002", type: "VPS RPA", city: "Makassar", provider: "Linode", providerKey: "linode", plan: "多平台版", progress: 90, final: "已就绪", heartbeat: "2024-01-13 16:11" },
  { ...common, name: "IDN-BTM-001", type: "VPS RPA", city: "Batam", provider: "Rackspace", providerKey: "rackspace", agent: "离线", remote: "RDP", progress: 40, final: "异常", heartbeat: "2024-01-13 14:05" },
];

export const jakartaResources = [
  { ...resources[0], district: "Central Jakarta" },
  { ...resources[1], district: "South Jakarta" },
  { ...common, name: "IDN-JKT-003", district: "West Jakarta", type: "手机RPA", provider: "Google Cloud", providerKey: "google", remote: "手机远程", plan: "多平台版", progress: 80 },
  { ...common, name: "IDN-JKT-004", district: "North Jakarta", type: "VPS RPA", provider: "AWS", providerKey: "aws", plan: "TikTok场景版", progress: 100 },
  { ...common, name: "IDN-JKT-005", district: "East Jakarta", type: "手机RPA", provider: "Vultr", providerKey: "vultr", remote: "手机远程", agent: "离线", customerAgent: "离线", worker: "离线", final: "离线", progress: 70 },
  { ...common, name: "IDN-JKT-006", district: "South Jakarta", type: "VPS RPA", provider: "Alibaba Cloud", providerKey: "aliyun", plan: "Amazon版", progress: 100 },
];

export const globalResources = resources.map((row, index) => ({ ...row, name: index === 0 ? row.name : ["US-LAX-001", "SG-001", "JP-TYO-002", "DE-FRA-003", "GB-LON-001", "CA-YVR-001", "AU-SYD-001", "BR-GRU-001", "IN-BOM-001"][index - 1] || row.name, country: ["印度尼西亚", "美国", "新加坡", "日本", "德国", "英国", "加拿大", "澳大利亚", "巴西", "印度"][index] || row.country, countryCode: ["id", "us", "sg", "jp", "de", "gb", "ca", "au", "br", "in"][index] || row.countryCode, city: ["Jakarta", "Los Angeles", "Singapore", "Tokyo", "Frankfurt", "London", "Vancouver", "Sydney", "Sao Paulo", "Mumbai"][index] || row.city }));

// PREVIEW_ONLY: country-specific drill-down data. Counts are design fixtures,
// not live production metrics. The representative rows stay browser-local.
export const countryPreviews = {
  id: { code: "id", slug: "indonesia", name: "印度尼西亚", total: 42, online: 28, offline: 6, abnormal: 2, ready: 36, vps: 18, mobile: 12, anchor: [72, 61], cities: topCities },
  us: { code: "us", slug: "united-states", name: "美国", total: 38, online: 26, offline: 8, abnormal: 4, ready: 31, vps: 23, mobile: 15, anchor: [23, 37], cities: [["Los Angeles", "12"], ["New York", "9"], ["Seattle", "7"], ["Chicago", "6"], ["San Francisco", "4"]] },
  sg: { code: "sg", slug: "singapore", name: "新加坡", total: 36, online: 26, offline: 7, abnormal: 3, ready: 29, vps: 22, mobile: 14, anchor: [69, 55], cities: [["Singapore", "36"]] },
  de: { code: "de", slug: "germany", name: "德国", total: 28, online: 19, offline: 7, abnormal: 2, ready: 23, vps: 17, mobile: 11, anchor: [48, 29], cities: [["Frankfurt", "9"], ["Berlin", "7"], ["Munich", "6"], ["Hamburg", "4"], ["Cologne", "2"]] },
  jp: { code: "jp", slug: "japan", name: "日本", total: 25, online: 18, offline: 5, abnormal: 2, ready: 21, vps: 16, mobile: 9, anchor: [77, 37], cities: [["Tokyo", "10"], ["Osaka", "6"], ["Yokohama", "4"], ["Nagoya", "3"], ["Fukuoka", "2"]] },
  gb: { code: "gb", slug: "united-kingdom", name: "英国", total: 1, online: 1, offline: 0, abnormal: 0, ready: 1, vps: 1, mobile: 0, anchor: [45, 26], cities: [["London", "1"]] },
  ca: { code: "ca", slug: "canada", name: "加拿大", total: 1, online: 1, offline: 0, abnormal: 0, ready: 1, vps: 1, mobile: 0, anchor: [23, 19], cities: [["Vancouver", "1"]] },
  au: { code: "au", slug: "australia", name: "澳大利亚", total: 1, online: 1, offline: 0, abnormal: 0, ready: 1, vps: 0, mobile: 1, anchor: [76, 77], cities: [["Sydney", "1"]] },
  br: { code: "br", slug: "brazil", name: "巴西", total: 1, online: 1, offline: 0, abnormal: 0, ready: 1, vps: 1, mobile: 0, anchor: [29, 65], cities: [["Sao Paulo", "1"]] },
  in: { code: "in", slug: "india", name: "印度", total: 1, online: 0, offline: 1, abnormal: 0, ready: 0, vps: 1, mobile: 0, anchor: [63, 47], cities: [["Mumbai", "1"]] },
};

// PREVIEW_ONLY: points are constrained to the countries represented by the
// browser-local resource fixtures. Each point has an explicit drill-down code.
const countryDotOffsets = {
  id: [[-4,-2],[-2,2],[0,0],[2,1],[4,2]],
  us: [[-5,-3],[-2,2],[1,-2],[3,0],[4,2],[1,3]],
  sg: [[0,0]],
  de: [[-1,1],[0,-1],[1,0],[1,2]],
  jp: [[0,-3],[0,-1],[-1,1],[-1,3]],
  gb: [[0,0]], ca: [[0,0]], au: [[-4,3],[0,0],[3,0]], br: [[0,0]], in: [[0,0]],
};
export const globalMapNodes = Object.entries(countryDotOffsets).flatMap(([countryCode, offsets]) => offsets.map(([dx, dy], index) => ({
  countryCode,
  x: countryPreviews[countryCode].anchor[0] + dx,
  y: countryPreviews[countryCode].anchor[1] + dy,
  tone: index === 0 && countryPreviews[countryCode].abnormal ? "danger" : index === 1 && countryPreviews[countryCode].offline ? "muted" : index % 3 === 0 ? "cyan" : "green",
})));

export const countryRows = (code) => code === "id" ? resources : (() => {
  const preview = countryPreviews[code];
  if (!preview) return [];
  const base = globalResources.find((row) => row.countryCode === code);
  if (!base) return [];
  return preview.cities.map(([city], index) => ({
    ...base,
    name: index === 0 ? base.name : `${code.toUpperCase()}-${city.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3)}-${String(index + 1).padStart(3, "0")}`,
    city,
    country: preview.name,
    countryCode: code,
  }));
})();

export const cityRows = (code, city) => code === "id" && city === "Jakarta"
  ? jakartaResources
  : countryRows(code).filter((row) => row.city === city);

// PREVIEW_ONLY: direct-link fallback for bulk progress. Uploaded Excel rows replace this array in memory.
export const bulkProgressPreview = Array.from({ length: 100 }, (_, index) => {
  const row = globalResources[index % globalResources.length];
  const stages = ["成功", "安装中", "验证中", "初始化", "待处理", "成功", "失败"];
  const stage = stages[index % stages.length];
  return {
    name: index < globalResources.length ? row.name : `${row.name}-${index + 1}`,
    type: row.type,
    countryCode: row.countryCode,
    country: row.country,
    city: row.city,
    stage,
    progress: { 成功: 100, 安装中: 64, 验证中: 86, 初始化: 20, 待处理: 0, 失败: 58 }[stage],
    reason: stage === "失败" ? "模拟：初始化超时，请查看日志后重试" : "",
  };
});

export const packageProfiles = {
  "Browser AI RPA": ["Chrome Runtime", "Playwright", "Stagehand", "Browser Extension", "Worker Package", "业务执行Agent Package", "客户消息监控Agent Package", "MCP Connector"],
  "TikTok RPA": ["Chrome Runtime", "Playwright", "TikTok Connector", "Worker Package", "业务执行Agent Package", "客户消息监控Agent Package"],
  "Instagram RPA": ["Chrome Runtime", "Playwright", "Instagram Connector", "Worker Package", "业务执行Agent Package", "客户消息监控Agent Package"],
  "Amazon RPA": ["Chrome Runtime", "Playwright", "Amazon Connector", "Worker Package", "业务执行Agent Package", "客户消息监控Agent Package"],
  "Shopee RPA": ["Chrome Runtime", "Playwright", "Shopee Connector", "Worker Package", "业务执行Agent Package", "客户消息监控Agent Package"],
  "Lazada RPA": ["Chrome Runtime", "Playwright", "Lazada Connector", "Worker Package", "业务执行Agent Package", "客户消息监控Agent Package"],
  "YouTube RPA": ["Chrome Runtime", "Playwright", "YouTube Connector", "Worker Package", "业务执行Agent Package", "客户消息监控Agent Package"],
  "通用浏览器RPA": ["Chrome Runtime", "Playwright", "Browser Extension", "Worker Package", "业务执行Agent Package", "客户消息监控Agent Package"],
  "Mobile RPA": ["Mobile Network Connector", "Remote Device Gateway", "Mobile RPA Engine", "Worker Package", "业务执行Agent Package", "客户消息监控Agent Package"],
  "自定义方案": ["自定义 RPA Adapter", "RPA Profile Manifest", "Worker Package", "业务执行Agent Package", "客户消息监控Agent Package"],
};

export const providerConsoleUrls = { AWS: "https://console.aws.amazon.com/", DigitalOcean: "https://cloud.digitalocean.com/", "Google Cloud": "https://console.cloud.google.com/", "Microsoft Azure": "https://portal.azure.com/", "Alibaba Cloud": "https://home.console.alibabacloud.com/", "Tencent Cloud": "https://console.cloud.tencent.com/", "Huawei Cloud": "https://console-intl.huaweicloud.com/", Hetzner: "https://console.hetzner.com/", Vultr: "https://console.vultr.com/", Linode: "https://cloud.linode.com/", Rackspace: "https://login.rackspace.com/" };
