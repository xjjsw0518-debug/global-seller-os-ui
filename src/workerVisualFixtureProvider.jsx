const FIXTURE_QUERY_PARAM = "workerVisualFixture";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
const HOME_STATUSES = ["运行中", "空闲", "离线", "异常", "已就绪"];

const firstPageRows = [
  { status: "valid", key: "IDN-JKT-001", name: "IDN-JKT-001", country: "ID", countryName: "印度尼西亚", city: "Jakarta", provider: "AWS", config: "2核 4GB 50GB", username: "root", credential: true },
  { status: "valid", key: "US-LAX-001", name: "US-LAX-001", country: "US", countryName: "美国", city: "Los Angeles", provider: "DigitalOcean", config: "2核 8GB 100GB", username: "root", credential: true },
  { status: "error", key: "SG-001", name: "SG-001", country: "SG", countryName: "新加坡", city: "Singapore", provider: "腾讯云", config: "4核 8GB 100GB", username: "root", note: "资源地址不能为空" },
  { status: "valid", key: "JP-TYO-002", name: "JP-TYO-002", country: "JP", countryName: "日本", city: "Tokyo", provider: "AWS", config: "Android 12", username: "—", resourceType: "MOBILE_RPA" },
  { status: "duplicate", key: "DE-FRA-003", name: "DE-FRA-003", country: "DE", countryName: "德国", city: "Frankfurt", provider: "腾讯云", config: "4核 16GB 200GB", username: "admin", credential: true, note: "与第 12 行重复" },
  { status: "valid", key: "GB-LON-001", name: "GB-LON-001", country: "GB", countryName: "英国", city: "London", provider: "Microsoft Azure", config: "4核 8GB 100GB", username: "azureuser", credential: true },
  { status: "valid", key: "CA-YVR-001", name: "CA-YVR-001", country: "CA", countryName: "加拿大", city: "Vancouver", provider: "Google Cloud", config: "Android 11", username: "—", resourceType: "MOBILE_RPA" },
  { status: "error", key: "AU-SYD-001", name: "AU-SYD-001", country: "AU", countryName: "澳大利亚", city: "Sydney", provider: "华为云", config: "4核 8GB 100GB", username: "root", note: "缺少必要字段" },
  { status: "valid", key: "BR-GRU-001", name: "BR-GRU-001", country: "BR", countryName: "巴西", city: "Sao Paulo", provider: "AWS", config: "4核 16GB 200GB", username: "root", credential: true },
  { status: "duplicate", key: "IN-BOM-001", name: "IN-BOM-001", country: "IN", countryName: "印度", city: "Mumbai", provider: "DigitalOcean", config: "Android 13", username: "—", note: "与第 25 行重复", resourceType: "MOBILE_RPA" },
];

const providerIds = new Map([
  ["AWS", "aws"], ["DigitalOcean", "digitalocean"], ["腾讯云", "tencent"],
  ["Microsoft Azure", "azure"], ["Google Cloud", "google-cloud"], ["华为云", "huawei"],
]);

// Deliberately synthetic, deterministic home-page data. Country and city totals
// are the source of truth; every row and map aggregate is derived from them.
const homeCountries = [
  { code: "id", name: "印度尼西亚", total: 42, anchor: [72, 61], cities: [["Jakarta",18],["Surabaya",8],["Medan",6],["Bandung",4],["Makassar",3],["Batam",3]] },
  { code: "us", name: "美国", total: 38, anchor: [23, 37], cities: [["Los Angeles",12],["New York",9],["Seattle",7],["Chicago",6],["San Francisco",4]] },
  { code: "sg", name: "新加坡", total: 36, anchor: [69, 55], cities: [["Singapore",36]] },
  { code: "de", name: "德国", total: 28, anchor: [48, 29], cities: [["Frankfurt",9],["Berlin",7],["Munich",6],["Hamburg",4],["Cologne",2]] },
  { code: "jp", name: "日本", total: 25, anchor: [77, 37], cities: [["Tokyo",10],["Osaka",6],["Yokohama",4],["Nagoya",3],["Fukuoka",2]] },
  { code: "es", name: "西班牙", total: 23, anchor: [46, 37], cities: [["Madrid",10],["Barcelona",8],["Valencia",5]] },
  { code: "fr", name: "法国", total: 23, anchor: [47, 33], cities: [["Paris",10],["Lyon",7],["Marseille",6]] },
  { code: "it", name: "意大利", total: 23, anchor: [50, 38], cities: [["Rome",10],["Milan",8],["Naples",5]] },
  { code: "kr", name: "韩国", total: 23, anchor: [77, 42], cities: [["Seoul",12],["Busan",6],["Incheon",5]] },
  { code: "mx", name: "墨西哥", total: 23, anchor: [18, 49], cities: [["Mexico City",12],["Guadalajara",6],["Monterrey",5]] },
  { code: "th", name: "泰国", total: 22, anchor: [72, 51], cities: [["Bangkok",12],["Chiang Mai",6],["Phuket",4]] },
  { code: "vn", name: "越南", total: 22, anchor: [74, 52], cities: [["Ho Chi Minh City",12],["Hanoi",6],["Da Nang",4]] },
  { code: "nl", name: "荷兰", total: 22, anchor: [48, 29], cities: [["Amsterdam",10],["Rotterdam",7],["Utrecht",5]] },
  { code: "ph", name: "菲律宾", total: 22, anchor: [78, 57], cities: [["Manila",12],["Cebu",6],["Davao",4]] },
  { code: "my", name: "马来西亚", total: 22, anchor: [72, 57], cities: [["Kuala Lumpur",10],["Penang",7],["Johor Bahru",5]] },
  { code: "ae", name: "阿联酋", total: 22, anchor: [57, 47], cities: [["Dubai",12],["Abu Dhabi",6],["Sharjah",4]] },
  { code: "tr", name: "土耳其", total: 22, anchor: [55, 40], cities: [["Istanbul",12],["Ankara",6],["Izmir",4]] },
  { code: "za", name: "南非", total: 22, anchor: [51, 82], cities: [["Johannesburg",10],["Cape Town",7],["Durban",5]] },
  { code: "pl", name: "波兰", total: 22, anchor: [52, 30], cities: [["Warsaw",10],["Krakow",7],["Gdansk",5]] },
];
const homeProviders = [
  ["AWS", "aws"], ["DigitalOcean", "digitalocean"], ["Google Cloud", "google"],
  ["Microsoft Azure", "azure"], ["Alibaba Cloud", "aliyun"], ["Tencent Cloud", "tencent"],
  ["Huawei Cloud", "huawei"], ["Hetzner", "hetzner"], ["Vultr", "vultr"], ["Linode", "linode"],
];
const homePlans = ["TikTok场景版", "YouTube版", "多平台版", "Browser AI RPA"];

function buildWorkerHomeFixture() {
  const rows = [];
  let index = 0;
  const citySequences = new Map();
  for (const country of homeCountries) {
    for (const [city, cityCount] of country.cities) {
      const cityKey = `${country.code}:${city}`;
      citySequences.set(cityKey, 0);
      for (let inCity = 0; inCity < cityCount; inCity += 1) {
        const rowIndex = index++;
        const [provider, providerKey] = homeProviders[rowIndex % homeProviders.length];
        const type = rowIndex < 298 ? "VPS RPA" : "手机RPA";
        const status = rowIndex < 312 ? "运行中" : rowIndex < 398 ? "空闲" : rowIndex < 446 ? "离线" : rowIndex < 461 ? "异常" : "已就绪";
        const ready = rowIndex < 367;
        const remote = rowIndex < 289;
        const componentStatus = status === "异常" ? "异常" : status === "离线" ? "离线" : status === "空闲" ? "空闲" : "运行中";
        const heartbeatOnline = componentStatus !== "离线" && componentStatus !== "异常";
        const heartbeatAt = new Date(Date.now() - (heartbeatOnline ? (rowIndex % 24) * 1000 : 24 * 60 * 60 * 1000)).toISOString();
        const sequence = citySequences.get(cityKey) + 1;
        citySequences.set(cityKey, sequence);
        const prefix = country.code.toUpperCase();
        const cityTag = city.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || "RES";
        rows.push(Object.freeze({
          name: `${prefix}-${cityTag}-${String(sequence).padStart(3, "0")}`,
          entityId: `VISUAL-${String(rowIndex + 1).padStart(4, "0")}`,
          fixtureOnly: true,
          fixtureStatus: status,
          businessAgentAttached: rowIndex < 386,
          customerAgentAttached: rowIndex < 352,
          workerRegistered: true,
          runtimeBound: true,
          type,
          country: country.name,
          countryCode: country.code,
          city,
          provider,
          providerKey,
          ip: `198.51.${Math.floor(rowIndex / 250)}.${(rowIndex % 250) + 1}`,
          agent: rowIndex % 9 === 0 && componentStatus === "运行中" ? "空闲" : componentStatus,
          customerAgent: rowIndex % 9 === 0 && componentStatus === "运行中" ? "空闲" : componentStatus,
          worker: componentStatus === "异常" ? "离线" : componentStatus,
          runtime: componentStatus === "运行中" || componentStatus === "空闲" ? "已就绪" : componentStatus,
          plan: homePlans[rowIndex % homePlans.length],
          remote: remote ? (type === "手机RPA" ? "手机远程" : "RDP") : "未启用",
          progress: ready ? 100 : status === "已就绪" ? 86 : 78,
          progressState: "KNOWN",
          final: ready ? "已就绪" : status === "已就绪" ? "运行中" : status,
          heartbeat: `2026-10-07 ${String(9 + (rowIndex % 8)).padStart(2, "0")}:${String((rowIndex * 7) % 60).padStart(2, "0")}`,
          last_heartbeat_at: heartbeatAt,
          fixtureHeartbeatOffsetSeconds: heartbeatOnline ? rowIndex % 24 : 24 * 60 * 60,
          worker_id: `VISUAL-WORKER-${String(rowIndex + 1).padStart(4, "0")}`,
          last_seen_at: heartbeatAt,
          heartbeat_interval_seconds: 30,
        }));
      }
    }
  }

  const byCountry = homeCountries.map((country) => {
    const countryRows = rows.filter((row) => row.countryCode === country.code);
    const cities = country.cities.map(([city, count]) => ({ name: city, count }));
    const typeCounts = {
      vps: countryRows.filter((row) => row.type === "VPS RPA").length,
      mobile: countryRows.filter((row) => row.type === "手机RPA").length,
    };
    const statusCounts = Object.fromEntries(HOME_STATUSES.map((status) => [status, countryRows.filter((row) => row.fixtureStatus === status).length]));
    return Object.freeze({ ...country, cities, typeCounts, statusCounts });
  });

  // One approximate country aggregate per country. These are not resource
  // coordinates; city/resource locations are only shown when a source exists.
  const mapNodes = byCountry.map((country) => {
    const countryRows = rows.filter((row) => row.countryCode === country.code);
    const typeCounts = {
      vps: countryRows.filter((row) => row.type === "VPS RPA").length,
      mobile: countryRows.filter((row) => row.type === "手机RPA").length,
    };
    const statuses = Object.fromEntries(HOME_STATUSES.map((status) => [status, countryRows.filter((row) => row.fixtureStatus === status).length]));
    const count = Object.values(statuses).reduce((sum, value) => sum + value, 0);
    const status = Object.entries(statuses).sort((a, b) => b[1] - a[1])[0][0];
    const tone = status === "异常" ? "danger" : status === "离线" ? "muted" : status === "已就绪" ? "cyan" : "green";
    return Object.freeze({
      countryCode: country.code,
      countryName: country.name,
      x: country.anchor[0],
      y: country.anchor[1],
      count,
      tone,
      resourceType: typeCounts.vps && typeCounts.mobile ? "VPS RPA / 手机RPA" : typeCounts.mobile ? "手机RPA" : "VPS RPA",
      typeCounts,
      statusCounts: statuses,
      status,
    });
  });

  const statusCounts = Object.fromEntries(HOME_STATUSES.map((status) => [status, rows.filter((row) => row.fixtureStatus === status).length]));
  const providerCounts = homeProviders.map(([name, key]) => ({ name, key, count: rows.filter((row) => row.providerKey === key).length }));
  const cities = byCountry.flatMap((country) => country.cities.map((city) => ({ ...city, countryCode: country.code, countryName: country.name })));
  return Object.freeze({
    rows: Object.freeze(rows),
    countries: Object.freeze(byCountry),
    cities: Object.freeze(cities),
    mapNodes: Object.freeze(mapNodes),
    providers: Object.freeze(providerCounts),
    kpis: Object.freeze([
      { label: "资源总数", value: rows.length, tone: "blue", icon: "cube" },
      { label: "运行中RPA", value: statusCounts["运行中"], tone: "green", icon: "play" },
      { label: "空闲RPA", value: statusCounts["空闲"], tone: "blue", icon: "pause" },
      { label: "离线RPA", value: statusCounts["离线"], tone: "danger", icon: "offline" },
      { label: "已就绪", value: rows.filter((row) => row.final === "已就绪").length, tone: "green", icon: "ready" },
      { label: "可远程连接", value: rows.filter((row) => row.remote !== "未启用").length, tone: "cyan", icon: "desktop" },
      { label: "异常 / 失败", value: statusCounts["异常"], tone: "danger", icon: "alert" },
    ]),
    statusCounts: Object.freeze(statusCounts),
    summary: Object.freeze([
      ["运行中", statusCounts["运行中"], "green"], ["空闲", statusCounts["空闲"], "blue"],
      ["离线", statusCounts["离线"], "muted"], ["异常 / 失败", statusCounts["异常"], "danger"],
      ["运行状态已就绪", statusCounts["已就绪"], "cyan"], ["部署已就绪", rows.filter((row) => row.final === "已就绪").length, "green"],
      ["VPS RPA", rows.filter((row) => row.type === "VPS RPA").length, "blue"], ["手机RPA", rows.filter((row) => row.type === "手机RPA").length, "purple"],
      ["可远程连接", rows.filter((row) => row.remote !== "未启用").length, "cyan"],
    ]),
  });
}

const workerHomeFixture = buildWorkerHomeFixture();

export function getWorkerHomeFixtureScope(fixture, view = "global", countryCode = "id", cityName = "Jakarta") {
  if (!fixture) return null;
  const country = fixture.countries.find((item) => item.code === countryCode) || fixture.countries[0];
  const countryRows = fixture.rows.filter((row) => row.countryCode === country.code);
  const rows = view === "city" ? countryRows.filter((row) => row.city === cityName) : view === "country" ? countryRows : fixture.rows;
  const sourceCities = view === "global"
    ? fixture.cities
    : country.cities
      .filter((city) => view !== "city" || city.name === cityName)
      .map((city) => ({ ...city, countryCode: country.code, countryName: country.name }));
  const cities = sourceCities
    .map((city) => ({ ...city, count: rows.filter((row) => row.countryCode === city.countryCode && row.city === city.name).length }))
    .filter((city) => city.count > 0);
  const statusCounts = Object.fromEntries(["运行中", "空闲", "离线", "异常", "已就绪"].map((status) => [status, rows.filter((row) => row.fixtureStatus === status).length]));
  const typeCounts = { vps: rows.filter((row) => row.type === "VPS RPA").length, mobile: rows.filter((row) => row.type === "手机RPA").length };
  const ready = rows.filter((row) => row.final === "已就绪").length;
  const remote = rows.filter((row) => row.remote !== "未启用").length;
  const kpis = view === "global"
    ? [
        { label: "资源总数", value: rows.length, tone: "blue", icon: "cube" },
        { label: "运行中RPA", value: statusCounts["运行中"], tone: "green", icon: "play" },
        { label: "空闲RPA", value: statusCounts["空闲"], tone: "blue", icon: "pause" },
        { label: "离线RPA", value: statusCounts["离线"], tone: "danger", icon: "offline" },
        { label: "已就绪", value: ready, tone: "green", icon: "ready" },
        { label: "可远程连接", value: remote, tone: "cyan", icon: "desktop" },
        { label: "异常 / 失败", value: statusCounts["异常"], tone: "danger", icon: "alert" },
      ]
    : [
        { label: "资源总数", value: rows.length, tone: "blue", icon: "cube" },
        { label: "运行中RPA", value: statusCounts["运行中"], tone: "green", icon: "play" },
        { label: "空闲RPA", value: statusCounts["空闲"], tone: "blue", icon: "pause" },
        { label: "离线RPA", value: statusCounts["离线"], tone: "danger", icon: "offline" },
        { label: "已就绪", value: ready, tone: "green", icon: "ready" },
        { label: "可远程连接", value: remote, tone: "cyan", icon: "desktop" },
        { label: "异常 / 失败", value: statusCounts["异常"], tone: "danger", icon: "alert" },
      ];
  const summary = [
    ["运行中", statusCounts["运行中"], "green"], ["空闲", statusCounts["空闲"], "blue"],
    ["离线", statusCounts["离线"], "muted"], ["异常 / 失败", statusCounts["异常"], "danger"],
    ["运行状态已就绪", statusCounts["已就绪"], "cyan"], ["部署已就绪", ready, "green"],
    ["VPS RPA", typeCounts.vps, "blue"], ["手机RPA", typeCounts.mobile, "purple"], ["可远程连接", remote, "cyan"],
  ];
  return { country, rows, cities, statusCounts, typeCounts, ready, remote, kpis, summary };
}

function documentationAddress(index) {
  const octet = (index % 240) + 10;
  const network = Math.floor(index / 240);
  const ranges = ["198.51.100", "203.0.113", "192.0.2"];
  return `${ranges[network % ranges.length]}.${octet}`;
}

function makeBulkImportRows() {
  const statuses = firstPageRows.map((row) => row.status);
  statuses.push(...Array(430).fill("valid"), ...Array(26).fill("error"), ...Array(16).fill("duplicate"));

  return statuses.map((status, index) => {
    const sample = firstPageRows[index % firstPageRows.length];
    const displayName = index < firstPageRows.length ? sample.name : `DEMO-${sample.country}-${String(index + 1).padStart(3, "0")}`;
    const row = {
      __line: index + 2,
      __errors: status === "error" ? [`resource_address ${sample.note || "地址不能为空"}`] : status === "duplicate" ? [`duplicate_key ${sample.note || "与文件中其他行重复"}`] : [],
      __deferred: status === "deferred",
      __duplicate: status === "duplicate",
      __credentialProvided: Boolean(sample.credential),
      __canonicalProviderId: providerIds.get(sample.provider) || "aws",
      vps_key: status === "duplicate" ? `VISUAL-DUP-${Math.max(1, index - 1)}` : `VISUAL-ONLY-${String(index + 1).padStart(3, "0")}`,
      display_name: displayName,
      resource_type: index < firstPageRows.length && sample.resourceType === "MOBILE_RPA" ? "MOBILE_RPA" : "VPS",
      resource_address: status === "error" ? "" : index === 0 ? "198.51.100.10:8080" : index === 1 ? "worker.example.com:8443" : documentationAddress(index),
      country_code: sample.country,
      country_name: sample.countryName,
      city: sample.city,
      configuration: sample.config,
      environment: "TEST",
      purpose: "VISUAL_DEMO",
      site_label: sample.note || "",
      cpu_cores: status === "deferred" ? "" : index % 2 ? "2" : "4",
      memory_gb: status === "deferred" ? "" : index % 2 ? "8" : "16",
      system_disk_gb: status === "deferred" ? "" : "100",
      bandwidth_mbps: status === "deferred" ? "" : "500",
      provider_name: sample.provider,
      provider_logo_url: "",
      provider_website_url: "",
      provider_website_username: sample.username,
      provider_website_credential: "",
      runtime_name: status === "deferred" ? "Demo mobile runtime" : "Demo runtime",
      runtime_type: status === "deferred" ? "ANDROID" : "BROWSER",
      test_only: true,
    };

    return Object.freeze(row);
  });
}

export const WORKER_VISUAL_FIXTURES = Object.freeze({
  workerCenter: Object.freeze({
    routes: Object.freeze([
      "global", "country", "city", "add-vps", "add-mobile", "package", "package-mobile",
      "bulkImport", "bulk-progress", "ready-vps", "ready-mobile", "resource-detail", "edit",
    ]),
    source: "Worker资源中心本地视觉预览；只在开发环境 loopback + workerVisualFixture=1 生效。",
  }),
  bulkImport: Object.freeze({
    file: Object.freeze({ name: "worker_import_demo.xlsx", size: 103321 }),
    rows: Object.freeze(makeBulkImportRows()),
    counts: Object.freeze({ total: 482, locallyValid: 436, errors: 28, duplicates: 18, deferred: 0 }),
    presentation: Object.freeze({
      resourceSampleBadge: "视觉样例",
      templateActions: Object.freeze({ xlsx: "下载 VPS 模板", csv: "下载手机 RPA 模板" }),
      fileMeta: "9.2 MB · 2024-01-14 12:32",
      fileStatus: "上传成功（视觉样例）",
    }),
    source: "合成演示数据；仅本地浏览器内存，不代表服务端校验或导入结果。",
  }),
  workerHome: Object.freeze({
    ...workerHomeFixture,
    source: "合成全球总览；仅在本地 Vite loopback 视觉预览中使用，不写入 API/DB。",
  }),
});

export function isWorkerVisualFixtureEnabled(locationLike = globalThis.location) {
  if (import.meta.env?.DEV !== true || !locationLike || !LOOPBACK_HOSTS.has(locationLike.hostname)) return false;
  return new URLSearchParams(locationLike.search || "").get(FIXTURE_QUERY_PARAM) === "1";
}

export function getWorkerVisualFixture(pageKey) {
  return isWorkerVisualFixtureEnabled() ? WORKER_VISUAL_FIXTURES[pageKey] || null : null;
}

export function disableWorkerVisualFixtureMode() {
  if (!isWorkerVisualFixtureEnabled()) return false;
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.delete(FIXTURE_QUERY_PARAM);
  window.location.replace(nextUrl.href);
  return true;
}

export function WorkerVisualFixtureNotice({ message = "" }) {
  if (!isWorkerVisualFixtureEnabled()) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: 7, marginTop: 5 }}>
      <span role="status" aria-label="本地视觉夹具已启用" style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid #3776a9", borderRadius: 999, padding: "3px 9px", color: "#cfe8ff", background: "#0b2b49", fontSize: 10, lineHeight: 1.35 }}>
        <b style={{ color: "#72c2ff" }}>本地视觉预览</b>
        <span>合成数据 · 不调用 API/DB</span>
      </span>
      <button type="button" onClick={disableWorkerVisualFixtureMode} style={{ border: "1px solid #31516d", borderRadius: 5, padding: "4px 8px", color: "#d5e8f8", background: "#102740", fontSize: 10, cursor: "pointer" }}>关闭夹具</button>
      {message && <span role="status" style={{ color: "#ffd98c", fontSize: 10 }}>{message}</span>}
    </div>
  );
}
