import { useEffect, useRef, useState } from "react";
import { CheckCircle, CloudArrowUp, DownloadSimple, FileText, Info, MagnifyingGlass, Trash, UploadSimple, WarningCircle } from "@phosphor-icons/react";
import { read, utils, write } from "xlsx";
import { Button } from "./ui/index.jsx";
import { cityZh } from "./mock/localization.js";
import { getWorkerVisualFixture, isWorkerVisualFixtureEnabled, WorkerVisualFixtureNotice } from "./workerVisualFixtureProvider.jsx";
import {
  BUILTIN_PROVIDERS,
  PROVIDER_CREDENTIAL_ALIASES,
  RESOURCE_IMPORT_FIELD_HELP,
  RESOURCE_IMPORT_HEADERS,
  validateResourceImportHeaders,
  buildResourceImportTemplateRows,
  safeProviderUrl,
  validateAndSanitizeResourceImportRecord,
} from "./workerBulkImportContract.js";

const headers = RESOURCE_IMPORT_HEADERS;
const templateHeaders = headers.map((key) => key === "provider_website_credential" ? "provider_website_password" : key);
const previewColumns = Object.freeze([
  { key: "__status", label: "校验结果" },
  { key: "resource_type", label: "资源类型" },
  { key: "display_name", label: "资源名称" },
  { key: "resource_address", label: "资源地址" },
  { key: "country", label: "国家/地区" },
  { key: "city", label: "城市" },
  { key: "provider_name", label: "服务商" },
  { key: "configuration", label: "配置/机型" },
  { key: "provider_website_username", label: "账号用户名" },
  { key: "provider_website_credential", label: "账号密码" },
  { key: "site_label", label: "备注" },
]);
const templatePath = "/__worker_staging/api/v1/resources/template.xlsx";
const importPath = "/__worker_staging/api/v1/resources/import";
const credentialHeaders = new Set(PROVIDER_CREDENTIAL_ALIASES);
const addressHeaders = new Set(["resource_address"]);
const providerByName = new Map(BUILTIN_PROVIDERS.flatMap((provider) => provider.aliases.map((alias) => [alias, provider])));
const templateNotes = [["字段", "填写说明"], ...RESOURCE_IMPORT_FIELD_HELP.map(([key, help]) => [key === "provider_website_credential" ? "provider_website_password" : key, help])];
function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function errorLines(errors) {
  if (!Array.isArray(errors)) return [];
  return errors.map((item) => {
    if (typeof item === "string") return item;
    const line = item?.row ?? item?.line ?? item?.row_number;
    const message = item?.message ?? item?.error ?? item?.detail ?? "服务端校验失败";
    return `${line ? `第 ${line} 行：` : ""}${message}`;
  });
}

function templateFromRows() {
  const workbook = utils.book_new();
  const exampleRows = buildResourceImportTemplateRows();
  const data = utils.aoa_to_sheet([
    templateHeaders,
    ...exampleRows.map((row) => templateHeaders.map((_key, index) => row[index] ?? "")),
  ]);
  const notes = utils.aoa_to_sheet(templateNotes);
  utils.book_append_sheet(workbook, data, "资源导入模板");
  utils.book_append_sheet(workbook, notes, "字段说明");
  return workbook;
}

function fileForSelectedRows(sourceFile, selectedRows) {
  const sheet = utils.aoa_to_sheet([
    templateHeaders,
    ...selectedRows.map((row) => templateHeaders.map((header) => {
      const key = header === "provider_website_password" ? "provider_website_credential" : header;
      return row[key] ?? "";
    })),
  ]);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, sheet, "资源导入模板");
  if (sourceFile.name.toLowerCase().endsWith(".csv")) {
    return new File(["\uFEFF", utils.sheet_to_csv(sheet, { blankrows: false })], sourceFile.name, {
      type: "text/csv;charset=utf-8",
    });
  }
  return new File([write(workbook, { type: "array", bookType: "xlsx" })], sourceFile.name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function providerLogo(providerName, customLogoUrl) {
  const provider = providerByName.get(String(providerName ?? "").trim().toLocaleLowerCase());
  return provider?.logo || (String(customLogoUrl ?? "").startsWith("https://") ? String(customLogoUrl).trim() : "");
}

function requestImport(file, confirm, onProgress, onUploadComplete) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const form = new FormData();
    form.append("file", file, file.name);
    request.open("POST", `${importPath}?confirm=${confirm ? "true" : "false"}`);
    request.withCredentials = true;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    request.upload.onload = onUploadComplete;
    request.onload = () => {
      let body;
      try { body = JSON.parse(request.responseText); }
      catch { body = { detail: "服务端返回了无法识别的响应。" }; }
      resolve({ httpStatus: request.status, body });
    };
    request.onerror = () => reject(new Error(confirm
      ? "连接中断，导入结果未知。请先到资源列表按文件中的 VPS Key 核对，不要直接重发确认导入。"
      : "连接中断，未收到服务端校验结果；可以重新执行服务端校验。"));
    request.onabort = () => reject(new Error(confirm
      ? "确认请求已中断，导入结果未知。请先到资源列表按文件中的 VPS Key 核对，不要直接重发确认导入。"
      : "校验请求已取消，可以重新执行服务端校验。"));
    request.send(form);
  });
}

function inspectHeaders(actual) {
  const validation = validateResourceImportHeaders(actual);
  return validation.valid ? null : validation.errors[0];
}

export default function BulkImportV3({ onClose, onNotify }) {
  const visualFixtureMode = isWorkerVisualFixtureEnabled();
  const visualFixture = getWorkerVisualFixture("bulkImport");
  const inputRef = useRef(null);
  const tableScrollRef = useRef(null);
  const selectPageRef = useRef(null);
  const fileGenerationRef = useRef(0);
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [fileError, setFileError] = useState("");
  const [localXls, setLocalXls] = useState(false);
  const [serverResult, setServerResult] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [templateBusy, setTemplateBusy] = useState(false);
  const [templateError, setTemplateError] = useState("");
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(100);
  const [page, setPage] = useState(1);
  const [apiBusy, setApiBusy] = useState(false);
  const [serverSchemaState, setServerSchemaState] = useState("NOT_CHECKED");
  const [resourceType, setResourceType] = useState("VPS");
  const [providerMenuOpen, setProviderMenuOpen] = useState(false);
  const [selectedProviders, setSelectedProviders] = useState([]);
  const [customProviderName, setCustomProviderName] = useState("");
  const [customProviderLogoUrl, setCustomProviderLogoUrl] = useState("");
  const [customProviderWebsiteUrl, setCustomProviderWebsiteUrl] = useState("");
  const [draftProviders, setDraftProviders] = useState([]);
  const [draftCustomProvider, setDraftCustomProvider] = useState({ name: "", logoUrl: "", websiteUrl: "" });
  const [helpOpen, setHelpOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedLines, setSelectedLines] = useState(() => new Set());
  const [fixtureActionNotice, setFixtureActionNotice] = useState("");
  const displayRows = visualFixture?.rows || rows;
  const displayFile = visualFixture?.file || file;
  const validCount = displayRows.filter((row) => !row.__errors.length && !row.__deferred && !row.__duplicate).length;
  const deferredCount = displayRows.filter((row) => row.__deferred).length;
  // Duplicate keys have their own visible metric; keep them out of the separate field-error count.
  const errorCount = displayRows.filter((row) => !row.__deferred && !row.__duplicate && row.__errors.length > 0).length;
  const duplicateCount = displayRows.filter((row) => row.__duplicate).length;
  const fileHasCredentialRows = displayRows.some((row) => row.__credentialProvided);
  const visibleProviderOptions = selectedProviders.length
    ? BUILTIN_PROVIDERS.filter((provider) => selectedProviders.includes(provider.id))
    : BUILTIN_PROVIDERS;
  const visibleRows = displayRows.filter((row) => {
    const providerSelected = !selectedProviders.length || selectedProviders.includes(row.__canonicalProviderId);
    return providerSelected && [...headers, "__credentialIndicator"].some((key) => String(row[key] ?? "").toLowerCase().includes(query.toLowerCase()));
  });
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const pageRows = visibleRows.slice((page - 1) * pageSize, page * pageSize);
  const selectedRows = rows.filter((row) => selectedLines.has(row.__line));
  const rowsToImport = selectionMode ? selectedRows : rows;
  const hasCredentialRows = rowsToImport.some((row) => row.__credentialProvided);
  const hasDeferredRows = rowsToImport.some((row) => row.__deferred);
  const importErrorCount = rowsToImport.filter((row) => !row.__deferred && !row.__duplicate && row.__errors.length > 0).length;
  const importDuplicateCount = rowsToImport.filter((row) => row.__duplicate).length;
  const selectedPageCount = pageRows.filter((row) => selectedLines.has(row.__line)).length;
  const selectedAllOnPage = pageRows.length > 0 && selectedPageCount === pageRows.length;
  const pageTokens = pageCount <= 7
    ? Array.from({ length: pageCount }, (_, index) => index + 1)
    : page <= 3
      ? [1, 2, 3, 4, 5, "…", pageCount]
      : page >= pageCount - 2
        ? [1, "…", pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1, pageCount]
        : [1, "…", page - 1, page, page + 1, "…", pageCount];
  const stagingImportReady = rowsToImport.length > 0 && serverSchemaState === "MATCH" && !hasCredentialRows && !hasDeferredRows && importErrorCount === 0 && importDuplicateCount === 0;
  const serverPreviewReady = serverResult?.phase === "preview" && serverResult?.status === "preview-valid";
  const toggleProvider = (id) => setSelectedProviders((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const openProviderDrawer = () => {
    setDraftProviders(selectedProviders);
    setDraftCustomProvider({ name: customProviderName, logoUrl: customProviderLogoUrl, websiteUrl: customProviderWebsiteUrl });
    setProviderMenuOpen(true);
  };
  const toggleDraftProvider = (id) => setDraftProviders((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const confirmProviderDrawer = () => {
    const customSelected = draftProviders.includes("custom");
    if (customSelected && (!draftCustomProvider.name.trim() || !safeProviderUrl(draftCustomProvider.name, draftCustomProvider.websiteUrl))) return;
    setSelectedProviders(draftProviders);
    setCustomProviderName(draftCustomProvider.name.trim());
    setCustomProviderLogoUrl(draftCustomProvider.logoUrl.trim());
    setCustomProviderWebsiteUrl(draftCustomProvider.websiteUrl.trim());
    setProviderMenuOpen(false);
  };
  useEffect(() => {
    if (!providerMenuOpen) return undefined;
    const closeOnEscape = (event) => { if (event.key === "Escape") setProviderMenuOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [providerMenuOpen]);
  useEffect(() => {
    if (!helpOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setHelpOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [helpOpen]);
  const setCurrentPageSelection = (checked) => {
    setSelectionMode(true);
    setSelectedLines((current) => {
      const next = new Set(current);
      pageRows.forEach((row) => checked ? next.add(row.__line) : next.delete(row.__line));
      return next;
    });
    setServerResult(null);
  };
  const setRowSelection = (line, checked) => {
    setSelectionMode(true);
    setSelectedLines((current) => {
      const next = new Set(current);
      checked ? next.add(line) : next.delete(line);
      return next;
    });
    setServerResult(null);
  };
  useEffect(() => {
    if (selectPageRef.current) selectPageRef.current.indeterminate = selectedPageCount > 0 && !selectedAllOnPage;
  }, [selectedPageCount, selectedAllOnPage]);
  useEffect(() => { if (tableScrollRef.current) tableScrollRef.current.scrollTop = 0; }, [page, pageSize, query, rows]);

  const downloadServerTemplate = async (format) => {
    if (visualFixtureMode) {
      setFixtureActionNotice("视觉夹具模式已拦截模板请求；没有访问 API。");
      return;
    }
    setTemplateBusy(true);
    setTemplateError("");
    try {
      const response = await fetch(templatePath, { credentials: "same-origin" });
      let liveTemplateMatches = false;
      if (response.ok) {
        const liveBlob = await response.blob();
        const liveWorkbook = read(await liveBlob.arrayBuffer(), { type: "array" });
        const liveSheet = liveWorkbook.Sheets?.[liveWorkbook.SheetNames?.[0]];
        const liveHeaders = liveSheet ? (utils.sheet_to_json(liveSheet, { header: 1, defval: "", blankrows: false })[0] || []).map((value) => String(value)) : [];
        liveTemplateMatches = !inspectHeaders(liveHeaders);
        setServerSchemaState(liveTemplateMatches ? "MATCH" : "OUTDATED");
        if (liveTemplateMatches) {
          if (format === "csv") {
            saveBlob(new Blob(["\uFEFF", utils.sheet_to_csv(liveSheet, { blankrows: false })], { type: "text/csv;charset=utf-8" }), "worker_resource_template.csv");
          } else saveBlob(liveBlob, "worker_resource_template.xlsx");
          return;
        }
      } else {
        setServerSchemaState(response.status === 401 || response.status === 403 ? "AUTH_UNAVAILABLE" : "UNAVAILABLE");
      }

      const localWorkbook = templateFromRows();
      const localSheet = localWorkbook.Sheets["资源导入模板"];
      if (format === "csv") {
        saveBlob(new Blob(["\uFEFF", utils.sheet_to_csv(localSheet, { blankrows: false })], { type: "text/csv;charset=utf-8" }), "worker_resource_template_local_preview.csv");
      } else {
        saveBlob(new Blob([write(localWorkbook, { type: "array", bookType: "xlsx" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "worker_resource_template_local_preview.xlsx");
      }
      setTemplateError(response.ok
        ? "Staging 当前模板仍是旧字段结构。已下载仅供本地预览的新版模板；服务端校验/导入保持禁用，直到 Staging API 模板与该契约一致。"
        : `无法读取 Staging 模板（HTTP ${response.status}）。已下载本地预览模板；服务端校验/导入保持禁用。`);
    } catch (error) {
      setServerSchemaState("UNAVAILABLE");
      const localWorkbook = templateFromRows();
      if (format === "csv") saveBlob(new Blob(["\uFEFF", utils.sheet_to_csv(localWorkbook.Sheets["资源导入模板"], { blankrows: false })], { type: "text/csv;charset=utf-8" }), "worker_resource_template_local_preview.csv");
      else saveBlob(new Blob([write(localWorkbook, { type: "array", bookType: "xlsx" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "worker_resource_template_local_preview.xlsx");
      setTemplateError(`${error instanceof Error ? error.message : "无法读取 Staging 模板。"} 已下载本地预览模板；服务端校验/导入保持禁用。`);
    } finally {
      setTemplateBusy(false);
    }
  };

  const submitToServer = async (confirm) => {
    if (visualFixtureMode) {
      setFixtureActionNotice("视觉演示已拦截提交；没有请求 API 或写入数据库。");
      return;
    }
    if (!file || !rowsToImport.length || localXls || apiBusy || serverSchemaState !== "MATCH" || hasCredentialRows || hasDeferredRows || importErrorCount > 0 || importDuplicateCount > 0) return;
    if (confirm && !window.confirm(`将把${selectionMode ? "选中的" : "文件中的全部"} ${rowsToImport.length} 行提交到测试环境。服务端会再次校验，并在确认后创建资源。继续吗？`)) return;
    const submitFile = selectionMode ? fileForSelectedRows(file, rowsToImport) : file;
    setApiBusy(true);
    setUploadProgress(0);
    setServerResult({ phase: confirm ? "importing" : "validating", status: "uploading", body: null, httpStatus: null, error: "" });
    try {
      const result = await requestImport(
        submitFile,
        confirm,
        (percent) => setUploadProgress(percent),
        () => setServerResult((current) => current ? { ...current, status: "processing" } : current),
      );
      const { body, httpStatus } = result;
      const detail = typeof body.detail === "string" ? body.detail : body.detail?.message;
      const phase = confirm ? "import" : "preview";
      const status = httpStatus < 200 || httpStatus >= 300
        ? "error"
        : confirm
          ? body.confirmed === true ? "success" : "rejected"
          : body.valid === true ? "preview-valid" : "invalid";
      setServerResult({ phase, status, body, httpStatus, error: detail || "" });
      if (status === "success") onNotify?.(`服务端已确认导入 ${Array.isArray(body.created) ? body.created.length : 0} 行。`);
    } catch (error) {
      setServerResult({ phase: confirm ? "import" : "preview", status: "error", body: null, httpStatus: null, error: error instanceof Error ? error.message : "请求失败。" });
    } finally {
      setApiBusy(false);
    }
  };

  const handleFile = async (selected) => {
    if (visualFixtureMode) {
      setFixtureActionNotice("视觉夹具使用固定合成样例；所选文件不会被读取或上传。");
      return;
    }
    if (!selected || apiBusy) return;
    const generation = ++fileGenerationRef.current;
    setFileError("");
    setRows([]);
    setSelectionMode(false);
    setSelectedLines(new Set());
    setServerResult(null);
    setUploadProgress(null);
    const extension = selected.name.split(".").pop()?.toLowerCase();
    setFile(selected);
    setLocalXls(extension === "xls");
    setQuery("");
    setPage(1);
    if (tableScrollRef.current) { tableScrollRef.current.scrollLeft = 0; tableScrollRef.current.scrollTop = 0; }
    const fail = (message) => { if (generation === fileGenerationRef.current) setFileError(message); };
    if (!["xlsx", "xls", "csv"].includes(extension)) return fail("仅接受 .xlsx / .csv；.xls 仅支持本地预览，Staging 服务端不接受 .xls。");
    if (!selected.size) return fail("文件为空，请选择包含表头和数据行的模板文件。");
    if (selected.size > 10 * 1024 * 1024) return fail("文件超过本地预览 10 MB 限制。");
    try {
      let workbook;
      if (extension === "csv") {
        workbook = read(await selected.text(), { type: "string" });
      } else {
        const buffer = await selected.arrayBuffer();
        if (generation !== fileGenerationRef.current) return;
        const bytes = new Uint8Array(buffer);
        const isXlsx = bytes[0] === 0x50 && bytes[1] === 0x4b;
        const isXls = bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
        if ((extension === "xlsx" && !isXlsx) || (extension === "xls" && !isXls)) return fail("文件扩展名与内容签名不匹配或文件已损坏。");
        workbook = read(buffer, { type: "array" });
      }
      if (generation !== fileGenerationRef.current) return;
      const sheet = workbook.Sheets?.[workbook.SheetNames?.[0]];
      if (!sheet) return fail("未找到可读取的工作表。");
      const matrix = utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false, raw: false });
      const actualHeaders = (matrix.shift() || []).map((cell) => String(cell).trim());
      const mismatch = inspectHeaders(actualHeaders);
      if (mismatch) return fail(mismatch);
      if (!matrix.length) return fail("文件只有表头，没有数据行。请填写至少一行后再预览。");
      const seenKeys = new Set();
      const actualHeadersForRows = actualHeaders;
      const parsed = matrix.map((cells, index) => {
        const record = Object.fromEntries(headers.map((key, column) => {
          const actualKey = key === "provider_website_credential" && actualHeadersForRows[column] === "provider_website_password" ? "provider_website_password" : key;
          const value = String(cells[column] ?? "");
          return [key, addressHeaders.has(key) || credentialHeaders.has(actualKey) ? value : value.trim()];
        }));
        return validateAndSanitizeResourceImportRecord(record, index + 2, seenKeys);
      });
      setRows(parsed);
      setPage(1);
      onNotify?.(`本地预览完成：${parsed.length} 行；未调用 API 或数据库。`);
    } catch {
      fail("无法解析该文件。请使用下载的 .xlsx/.csv 模板或检查文件是否损坏。");
    }
  };

  const resetFile = () => {
    if (visualFixtureMode) {
      setFixtureActionNotice("当前样例由视觉夹具提供；关闭夹具后可恢复真实文件流程。");
      return;
    }
    fileGenerationRef.current += 1;
    setFile(null); setRows([]); setFileError(""); setLocalXls(false); setPage(1); setSelectionMode(false); setSelectedLines(new Set()); setServerResult(null); setUploadProgress(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return <div className="bulk-v2-page bulk-v3-page">
    <style>{`
      .bulk-v3-page,.bulk-v3-page .bulk-v2-section,.bulk-v3-page .bulk-preview-head,.bulk-v3-page .bulk-template-controls,.bulk-v3-page .bulk-upload-grid{box-sizing:border-box;min-width:0;max-width:100%}
      .bulk-v3-page .bulk-v2-stepper{box-sizing:border-box;min-width:0;width:100%}
      .bulk-v3-page .bulk-v2-table-scroll{box-sizing:border-box;min-width:0;max-width:100%;overflow:auto}
      .bulk-v3-page .bulk-template{position:relative;z-index:3}
      .bulk-v3-page .bulk-upload{position:relative;z-index:1}
      .bulk-v3-page .bulk-v2-title{align-items:center;padding-bottom:5px}
      .bulk-v3-page .bulk-v2-title>div{display:flex;align-items:baseline;flex-wrap:wrap;gap:10px}
      .bulk-v3-page .bulk-v2-title p{margin:0}
      .bulk-v3-page .bulk-template h2{margin-bottom:5px}
      .bulk-v3-page .bulk-template-controls{grid-template-columns:350px minmax(220px,1fr) auto;align-items:center;gap:8px}
      .bulk-v3-page .bulk-resource-type{align-items:center;column-gap:4px;row-gap:3px}
      .bulk-v3-page .bulk-type-selector{flex-wrap:nowrap;gap:5px}
      .bulk-v3-page .bulk-resource-type label{height:29px;padding:0 5px;white-space:nowrap}
      .bulk-v3-page .bulk-contract-stamp{min-height:0;padding:0;border:0}
      .bulk-v3-page .bulk-template-hint{margin-top:4px}
      .bulk-v3-page .bulk-contract-details{margin-top:3px}
      .bulk-v3-page .bulk-upload .bulk-drop-zone{box-sizing:border-box;height:140px;min-height:140px;padding:5px;gap:4px}
      .bulk-v3-page .bulk-upload-grid{gap:8px}
      .bulk-v3-page .bulk-credential-import-warning{margin-top:5px;padding:4px 6px;font-size:9px;line-height:1.25}
      .bulk-v3-page .bulk-v2-table{width:100%;min-width:1270px}
      .bulk-v3-page .bulk-v2-table th,.bulk-v3-page .bulk-v2-table td{height:29px;padding:0 7px}
      .bulk-v3-page .bulk-v2-table th:first-child,.bulk-v3-page .bulk-v2-table td:first-child{width:32px}
      .bulk-v3-page .bulk-row-status{display:inline-flex;align-items:center;justify-content:center;gap:3px;min-width:58px;padding:3px 7px;border:1px solid currentColor;border-radius:11px;font-size:9px;line-height:1}
      .bulk-v3-page .bulk-row-status.valid{color:var(--success);background:rgba(37,224,170,.09)}
      .bulk-v3-page .bulk-row-status.error{color:var(--danger);background:rgba(255,96,122,.09)}
      .bulk-v3-page .bulk-row-status.duplicate{color:var(--warning);background:rgba(255,211,78,.09)}
      .bulk-v3-page .bulk-row-status.deferred{color:#d6bbff;background:rgba(139,93,204,.12)}
      .bulk-v3-page .bulk-address-error{color:#ff8094;font-size:10px}
      .bulk-v3-page .bulk-country-cell small{margin-left:5px}
      .bulk-v3-page .bulk-preview-tools{display:flex;align-items:center;justify-content:flex-end;gap:10px;min-width:0;color:#9eb8d7;font-size:10px;white-space:nowrap}
      .bulk-v3-page .bulk-preview-limit{display:flex;align-items:center;gap:5px}
      .bulk-v3-page .bulk-preview-limit select{height:29px;padding:0 7px;border:1px solid #1b5792;border-radius:5px;background:#091d38;color:#dbeaff;font-size:10px}
      .bulk-v3-page .bulk-provider-filter{position:relative}
      .bulk-v3-page .bulk-custom-provider{position:absolute;top:calc(100% + 5px);right:0;z-index:25;display:grid;gap:7px;width:min(360px,calc(100vw - 32px));padding:10px;border:1px solid #2877c7;border-radius:7px;background:#071a34;box-shadow:0 12px 28px #0009}
      .bulk-v3-page .bulk-provider-picker{flex:1;min-width:0}
      .bulk-v3-page .bulk-provider-trigger{width:100%;min-width:0}
      .bulk-v3-page .bulk-provider-summary{display:flex;align-items:center;gap:9px;min-width:0;overflow:hidden}
      .bulk-v3-page .bulk-provider-summary>span{display:inline-flex;align-items:center;gap:4px;min-width:0;color:#d9eaff;white-space:nowrap}
      .bulk-v3-page .bulk-provider-summary img{width:23px;height:19px;object-fit:contain;flex:none}
      .bulk-v3-page .bulk-provider-summary>span>span{max-width:88px;overflow:hidden;text-overflow:ellipsis}
      .bulk-v3-page .bulk-help{position:relative;display:flex;justify-content:flex-end}
      .bulk-v3-page .bulk-help>button{display:inline-flex;align-items:center;gap:5px;padding:0;border:0;background:transparent;color:#86c8ff;font-size:11px;cursor:pointer}
      .bulk-v3-page .bulk-help-popover{position:absolute;top:calc(100% + 8px);right:0;z-index:30;width:min(360px,calc(100vw - 32px));padding:12px;border:1px solid #2877c7;border-radius:7px;background:#071a34;color:#d9eaff;box-shadow:0 12px 28px #0009;font-size:11px;line-height:1.5}
      .bulk-v3-page .bulk-help-popover p{margin:0 0 8px}
      .bulk-v3-page .bulk-submit-feedback{display:grid;gap:3px;margin:4px 10px;padding:6px 9px;border:1px solid #2877c7;border-radius:5px;background:#0a2342;color:#d9eaff;font-size:10px}
      .bulk-v3-page .bulk-submit-feedback.error,.bulk-v3-page .bulk-submit-feedback.invalid,.bulk-v3-page .bulk-submit-feedback.rejected{border-color:#bd596c;background:#2a1420;color:#ffc7d0}
      .bulk-v3-page .bulk-submit-feedback.success{border-color:#199f83;background:#0d302d;color:#aaf3df}
      .bulk-v3-page .bulk-submit-feedback progress{width:100%}
      .bulk-v3-page .bulk-v2-footer>div{display:flex;align-items:center;gap:8px}
      .bulk-v3-page .pagination{display:flex;align-items:center;gap:4px}
      .bulk-v3-page .pagination button{min-width:25px;height:25px;padding:0 5px;border:1px solid #1b5792;border-radius:4px;background:#0b2548;color:#dbeaff;font-size:10px}
      .bulk-v3-page .pagination button.active{border-color:#36a6ff;background:#0879e8;color:#fff;box-shadow:0 0 8px #0879e855}
      .bulk-v3-page .pagination button:disabled{opacity:.45}
      .bulk-v3-page .pagination-ellipsis{padding:0 2px;color:#9eb8d7}
      .bulk-v3-page .bulk-page-jump,.bulk-v3-page .bulk-page-jump label{display:flex;align-items:center;gap:5px}
      .bulk-v3-page .bulk-page-jump{margin:0;color:#9eb8d7;font-size:9px}
      .bulk-v3-page .bulk-page-jump input{width:42px;height:24px;padding:0 4px;border:1px solid #1b5792;border-radius:4px;background:#091d38;color:#eaf5ff;font-size:10px}
      @media(min-width:1400px){
        .bulk-v3-page .bulk-country-cell small{display:none}
        .bulk-v3-page .pagination button{min-width:27px;height:27px}
        .bulk-v3-page{height:864px;min-height:864px;overflow:hidden;padding:0 10px 0;background:#061a35}
        .bulk-v3-page .bulk-v2-title{height:49px;align-items:center;padding:0 5px;border-bottom:1px solid #0757a0}
        .bulk-v3-page .bulk-v2-title h1{font-size:25px;letter-spacing:.2px}
        .bulk-v3-page .bulk-v2-title h1:before{content:"";display:inline-block;width:17px;height:27px;margin-right:8px;vertical-align:-5px;background:linear-gradient(145deg,#52e3ff 0 32%,#1688ff 34% 72%,#075ac6 74%);clip-path:polygon(28% 0,100% 0,68% 100%,0 100%);filter:drop-shadow(0 0 5px #159dff99)}
        .bulk-v3-page .bulk-v2-title p{font-size:12px}
        .bulk-v3-page .bulk-v2-stepper{box-sizing:border-box;width:calc(100% - 20px);height:67px;padding:14px 17px;margin:0 10px 2px;border-color:#14518c;background:#071d3b;box-shadow:0 0 13px #007bff12,inset 0 0 22px #0a65ae0d}
        .bulk-v3-page .bulk-v2-section{margin:0 10px 6px;padding:8px 10px;border-color:#14518c;background:#071d3b;box-shadow:0 0 13px #007bff12,inset 0 0 22px #0a65ae0d}
        .bulk-v3-page .bulk-template{height:103px}
        .bulk-v3-page .bulk-template h2,.bulk-v3-page .bulk-upload h2{height:22px;margin:0 0 4px;font-size:15px}
        .bulk-v3-page .bulk-template-controls{height:55px;grid-template-columns:238px minmax(360px,1fr) 276px;gap:12px}
        .bulk-v3-page .bulk-type-selector{flex-wrap:nowrap!important;gap:4px}
        .bulk-v3-page .bulk-type-selector label{gap:3px;padding:0 5px}
        .bulk-v3-page .bulk-deferred-badge{padding:1px 3px;font-size:7px;white-space:nowrap}
        .bulk-v3-page .bulk-resource-type>span,.bulk-v3-page .bulk-provider-picker>span{font-size:11px}
        .bulk-v3-page .bulk-resource-type label{box-sizing:border-box;height:31px;padding:0 5px;font-size:11px}
        .bulk-v3-page .bulk-type-selector label:first-child{width:96px;flex:none}
        .bulk-v3-page .bulk-type-selector label:last-child{width:120px;flex:none}
        .bulk-v3-page .bulk-provider-trigger{display:flex;align-items:center;gap:7px;width:100%;height:46px;min-height:46px;padding:2px;border:0;background:transparent;box-shadow:none;font-size:10px}
        .bulk-v3-page .bulk-provider-summary{flex:1;height:42px;gap:5px;overflow:hidden}
        .bulk-v3-page .bulk-provider-summary>span{box-sizing:border-box;display:inline-flex;flex:1 1 0;justify-content:center;height:40px;padding:0 5px;border:1px solid #15518d;border-radius:5px;background:linear-gradient(180deg,#0c2d55,#081f3d);gap:5px}
        .bulk-v3-page .bulk-provider-summary img{width:25px;height:25px}
        .bulk-v3-page .bulk-provider-summary>span>span{max-width:76px;font-size:9px}
        .bulk-v3-page .bulk-provider-trigger>span:last-child{display:grid;place-items:center;flex:none;width:54px;height:36px;border:1px solid #2678c4;border-radius:5px;background:#0a2c53;color:#d7ebff}
        .bulk-v3-page .bulk-provider-picker{display:block;transform:none}
        .bulk-v3-page .bulk-provider-options{display:grid;width:100%;grid-template-columns:127px repeat(7,minmax(0,1fr)) 54px;grid-template-rows:14px 40px;gap:5px 6px;align-items:center}
        .bulk-v3-page .bulk-provider-label{grid-column:1;grid-row:1;align-self:start;font-size:11px}
        .bulk-v3-page .bulk-provider-option.bulk-provider-all{grid-column:1;grid-row:2;width:118px;height:29px;justify-self:start}
        .bulk-v3-page .bulk-provider-option.bulk-provider-track{height:48px;align-self:center;min-width:0;margin-left:8px;padding:0 5px;gap:4px;font-size:9px;white-space:nowrap}.bulk-v3-page .bulk-provider-option.bulk-provider-track img{width:18px;height:18px;flex:none}.bulk-v3-page .bulk-provider-option.bulk-provider-track span{min-width:0;overflow:hidden;font-size:8px;line-height:1;white-space:nowrap;text-overflow:clip}
        .bulk-v3-page .bulk-provider-option.bulk-provider-more{grid-column:9;grid-row:1 / span 2;width:54px;height:40px;align-self:center}
        .bulk-v3-page .bulk-downloads{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:nowrap}
        .bulk-v3-page .bulk-downloads .ui-button{box-sizing:border-box;height:50px;font-size:11px}
        .bulk-v3-page .bulk-downloads .ui-button:first-child{width:126px;flex:none}
        .bulk-v3-page .bulk-downloads .ui-button:last-child{width:142px;flex:none;border-color:#168dff;background:linear-gradient(180deg,#168eff,#0875e7);color:#fff;box-shadow:0 0 9px #087cff33}
        .bulk-v3-page .bulk-upload{position:relative;height:203px;padding:8px 10px}
        .bulk-v3-page .bulk-upload h2{margin-bottom:7px}
        .bulk-v3-page .bulk-upload-grid{display:grid;width:100%;height:153px;grid-template-columns:minmax(0,1.42fr) minmax(0,1fr) minmax(0,1.05fr);gap:12px}
        .bulk-v3-page .bulk-upload .bulk-drop-zone,.bulk-v3-page .bulk-upload .bulk-file-card{height:153px;min-height:0;overflow:hidden}
        .bulk-v3-page .bulk-upload .bulk-validation{position:relative;grid-column:3;grid-row:1;align-self:stretch;box-sizing:border-box;width:auto;height:201px!important;min-height:0;margin-top:-37px;overflow:hidden}
        .bulk-v3-page .bulk-upload .bulk-drop-zone{padding:8px;gap:5px;border-color:#1a64a0;background:#04284c;box-shadow:inset 0 0 18px rgba(22,135,231,.12)}.bulk-v3-page .bulk-upload .bulk-drop-zone>strong{color:#d9efff;font-size:12px}.bulk-v3-page .bulk-upload .bulk-drop-zone>span{color:#9db7cc;font-size:10px}
        .bulk-v3-page .bulk-upload .bulk-drop-zone>svg{width:50px;height:50px}
        .bulk-v3-page .bulk-upload .bulk-drop-zone .ui-button{width:185px;height:34px}
        .bulk-v3-page .bulk-file-card{padding:10px}
                .bulk-v3-page .bulk-validation{display:grid;grid-template-rows:27px minmax(0,1fr) 10px;row-gap:1px;padding:7px 10px}
        .bulk-v3-page .bulk-file-card>div{margin-top:28px}
        .bulk-v3-page .bulk-file-card>div>svg{width:40px;height:40px;color:#35d6a0}
        .bulk-v3-page .bulk-file-card .bulk-fixture-upload-status{display:block;margin-top:3px;color:#28d7a1;font-size:9px;line-height:1.2}
        .bulk-v3-page .bulk-validation-head .ui-button{height:27px}
        .bulk-v3-page .bulk-validation-grid{min-height:0;grid-template-rows:repeat(2,minmax(0,1fr));gap:8px;margin-top:0}
        .bulk-v3-page .bulk-validation-grid>div{box-sizing:border-box;min-height:0;gap:12px;padding:7px 13px;border-radius:6px;background:#061f3d;box-shadow:none}
        .bulk-v3-page .bulk-validation-grid>div.good,.bulk-v3-page .bulk-validation-grid>div.bad,.bulk-v3-page .bulk-validation-grid>div.warn{background:#061f3d;box-shadow:none}
        .bulk-v3-page .bulk-validation-grid>div.good{border-color:#155f86}
        .bulk-v3-page .bulk-validation-grid>div.bad{border-color:#155f86}
        .bulk-v3-page .bulk-validation-grid>div.warn{border-color:#155f86}
        .bulk-v3-page .bulk-validation-grid .bulk-validation-icon{box-sizing:border-box;display:grid;place-items:center;flex:none;width:40px;height:40px;gap:0;border:1px solid currentColor;border-radius:50%;background:#082647}
        .bulk-v3-page .bulk-validation-grid .bulk-validation-icon svg{width:23px;height:23px}.bulk-v3-page .bulk-validation-grid .good .bulk-validation-icon{color:#16d3a2;border-color:#0bbd9a;box-shadow:0 0 8px #06d6af33}.bulk-v3-page .bulk-validation-grid .bad .bulk-validation-icon{color:#ff526b;border-color:#dc4964;box-shadow:0 0 8px #ff557333}.bulk-v3-page .bulk-validation-grid .warn .bulk-validation-icon{color:#ffad33;border-color:#cc8a31;box-shadow:0 0 8px #ffb33a33}
        .bulk-v3-page .bulk-validation .bulk-duplicate-note{box-sizing:border-box;min-height:0;height:10px;margin:0;overflow:hidden;color:#7e9aa9;font-size:8px;line-height:10px;white-space:nowrap;text-overflow:ellipsis}
        .bulk-v3-page .bulk-credential-import-warning{position:static;margin:7px 0 0;padding:3px 5px;border-width:1px;font-size:8px;line-height:1.25;white-space:normal}
        .bulk-v3-page .bulk-preview-section{display:flex;height:373px;flex-direction:column;margin-bottom:0;padding:0;overflow:hidden}
        .bulk-v3-page .bulk-preview-head{height:39px;min-height:39px;flex:none;align-items:center;padding:0 10px}
        .bulk-v3-page .bulk-preview-head h2{font-size:15px}
        .bulk-v3-page .bulk-preview-head>div{flex:1 1 auto;min-width:0;display:flex;align-items:center;justify-content:flex-end;gap:10px}
        .bulk-v3-page .bulk-preview-tools{flex:1 1 auto}
        .bulk-v3-page .bulk-preview-limit select{width:96px}
        .bulk-v3-page .bulk-search{display:grid;grid-template-columns:14px minmax(0,1fr);align-items:center;gap:8px;width:100%;white-space:nowrap}
        .bulk-v3-page .bulk-search>svg{color:#8eabc9}
        .bulk-v3-page .bulk-search{flex:0 0 255px;width:255px}
        .bulk-v3-page .bulk-search input{width:100%;max-width:none;font-size:11px}
        .bulk-v3-page .bulk-search input::placeholder{color:#9eb8d7;opacity:1}
        .bulk-v3-page .bulk-v2-table-scroll{height:289px;max-height:none;flex:none}
        .bulk-v3-page .bulk-v2-table{width:100%;min-width:0;table-layout:fixed;font-size:12px}
        .bulk-v3-page .bulk-v2-table th,.bulk-v3-page .bulk-v2-table td{height:26px;padding:0 7px;font-size:12px}
        .bulk-v3-page .bulk-v2-table th{background:#072b50}
        .bulk-v3-page .bulk-v2-table tbody tr:nth-child(even) td{background:#041d38}
        .bulk-v3-page .bulk-v2-table tbody tr:nth-child(odd) td{background:#001b38}
        .bulk-v3-page .bulk-v2-table th,.bulk-v3-page .bulk-v2-table td{overflow:hidden;text-overflow:ellipsis}
        .bulk-v3-page .bulk-v2-table input[type="checkbox"]{width:14px;height:14px;margin:0}
        .bulk-v3-page .bulk-v2-table th:nth-child(1),.bulk-v3-page .bulk-v2-table td:nth-child(1){width:3%;padding-inline:4px;text-align:center}
        .bulk-v3-page .bulk-v2-table th:nth-child(2),.bulk-v3-page .bulk-v2-table td:nth-child(2){width:3%;padding-inline:4px;text-align:center}
        .bulk-v3-page .bulk-v2-table th:nth-child(3),.bulk-v3-page .bulk-v2-table td:nth-child(3){width:6%}
        .bulk-v3-page .bulk-v2-table th:nth-child(4),.bulk-v3-page .bulk-v2-table td:nth-child(4){width:6%}
        .bulk-v3-page .bulk-v2-table th:nth-child(5),.bulk-v3-page .bulk-v2-table td:nth-child(5){width:7%}
        .bulk-v3-page .bulk-v2-table th:nth-child(6),.bulk-v3-page .bulk-v2-table td:nth-child(6){width:8%}
        .bulk-v3-page .bulk-v2-table th:nth-child(7),.bulk-v3-page .bulk-v2-table td:nth-child(7){width:7%}
        .bulk-v3-page .bulk-v2-table th:nth-child(8),.bulk-v3-page .bulk-v2-table td:nth-child(8){width:6%}
        .bulk-v3-page .bulk-v2-table th:nth-child(9),.bulk-v3-page .bulk-v2-table td:nth-child(9){width:8%}
        .bulk-v3-page .bulk-v2-table th:nth-child(10),.bulk-v3-page .bulk-v2-table td:nth-child(10){width:9%}
        .bulk-v3-page .bulk-v2-table th:nth-child(11),.bulk-v3-page .bulk-v2-table td:nth-child(11){width:7%}
        .bulk-v3-page .bulk-v2-table th:nth-child(12),.bulk-v3-page .bulk-v2-table td:nth-child(12){width:7%}
        .bulk-v3-page .bulk-v2-table th:nth-child(13),.bulk-v3-page .bulk-v2-table td:nth-child(13){width:13%}
        .bulk-v3-page .bulk-v2-table-footer{height:42px;flex:none;padding:7px 10px;font-size:10px}
        .bulk-v3-page .bulk-row-status{min-width:68px;padding:3px 8px;font-size:10px}
        .bulk-v3-page .bulk-v2-footer{width:calc(100% + 20px);height:55px;box-sizing:border-box;margin-left:-10px;margin-right:-10px;padding:0 30px;background:#071e3d}
      }
      @media(max-width:1100px){.bulk-v3-page .bulk-template-controls{grid-template-columns:minmax(0,1fr)}.bulk-v3-page .bulk-type-selector{flex-wrap:wrap}.bulk-v3-page .bulk-provider-picker{display:block;transform:none}.bulk-v3-page .bulk-provider-options{grid-template-columns:repeat(4,minmax(0,1fr));grid-template-rows:auto;gap:6px}.bulk-v3-page .bulk-provider-label{grid-column:1/-1;grid-row:auto}.bulk-v3-page .bulk-provider-card,.bulk-v3-page .bulk-provider-option.bulk-provider-all,.bulk-v3-page .bulk-provider-option.bulk-provider-track,.bulk-v3-page .bulk-provider-option.bulk-provider-more{grid-column:auto!important;grid-row:auto!important;width:auto;height:40px;margin:0}.bulk-v3-page .bulk-upload-grid{height:auto;grid-template-columns:minmax(0,1fr)}.bulk-v3-page .bulk-upload .bulk-validation{position:static;grid-column:auto;grid-row:auto;height:auto!important;margin:0}}
      @media(max-width:600px){
        .bulk-v3-page .bulk-v2-title{min-width:0;flex-direction:column;align-items:flex-start;gap:5px}
        .bulk-v3-page .bulk-v2-title>div{align-items:flex-start;flex-direction:column;gap:3px}
        .bulk-v3-page .bulk-v2-title>span{max-width:100%;overflow-wrap:anywhere;font-size:9px}
        .bulk-v3-page .bulk-v2-stepper{grid-template-columns:repeat(4,minmax(0,1fr));gap:2px;padding:7px 5px}
        .bulk-v3-page .bulk-v2-stepper>i{display:none}
        .bulk-v3-page .bulk-v2-stepper>span{grid-template-columns:minmax(0,1fr);grid-template-rows:auto;justify-items:center;gap:2px;min-width:0;text-align:center}
        .bulk-v3-page .bulk-v2-stepper>span b{grid-row:auto;width:25px;height:25px;font-size:12px}
        .bulk-v3-page .bulk-v2-stepper>span strong,.bulk-v3-page .bulk-v2-stepper>span small{max-width:100%;overflow-wrap:anywhere;text-align:center}
        .bulk-v3-page .bulk-v2-stepper>span strong{font-size:9px}
        .bulk-v3-page .bulk-v2-stepper>span small{font-size:8px}
        .bulk-v3-page .bulk-template-controls{grid-template-columns:minmax(0,1fr)}
        .bulk-v3-page .bulk-downloads{grid-column:auto;flex-wrap:wrap;white-space:normal}
        .bulk-v3-page .bulk-downloads button{flex:1 1 120px;min-width:0}
        .bulk-v3-page .bulk-upload-grid{grid-template-columns:minmax(0,1fr)}
        .bulk-v3-page .bulk-preview-head{align-items:flex-start;flex-direction:column}
        .bulk-v3-page .bulk-search input{max-width:120px}
        .bulk-v3-page .bulk-mock-controls{align-items:stretch;flex-direction:column}
        .bulk-v3-page .bulk-mock-controls button{width:100%}
        .bulk-v3-page .bulk-v2-footer{left:0;right:0;flex-wrap:wrap;padding:8px}
        .bulk-v3-page .bulk-v2-footer>span{flex:1 1 100%}
      }
      .bulk-v3-page .bulk-provider-picker{position:relative;display:grid;gap:6px;min-width:0;container-type:inline-size;color:var(--text-secondary);font-size:10px}
      .bulk-v3-page .bulk-provider-trigger{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:32px;padding:0 9px;border:1px solid var(--border-strong);border-radius:5px;background:var(--input-bg);color:#e7f2ff;text-align:left}
      .bulk-v3-page .bulk-provider-menu{position:absolute;top:calc(100% + 4px);left:0;z-index:20;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;width:min(440px,calc(100vw - 48px));max-height:270px;overflow:auto;padding:8px;border:1px solid #2877c7;border-radius:7px;background:#071a34;box-shadow:0 12px 28px #0009}
      .bulk-v3-page .bulk-provider-menu button{display:flex;align-items:center;gap:7px;min-width:0;min-height:34px;padding:4px 7px;border:1px solid #214b76;border-radius:5px;background:#0a2342;color:#d9eaff;text-align:left}
      .bulk-v3-page .bulk-provider-menu button.active{border-color:#28a9ff;background:#0e3560;box-shadow:0 0 9px #087cff50}
      .bulk-v3-page .bulk-provider-menu img{width:27px;height:22px;object-fit:contain;flex:none}
      .bulk-v3-page .bulk-provider-menu img[src$="/aws.png"],.bulk-v3-page .bulk-provider-cell img[src$="/aws.png"],.bulk-v3-page .bulk-provider-brand img[src$="/aws.png"],.bulk-v3-page .bulk-provider-drawer-card img[src$="/aws.png"]{filter:brightness(0) invert(1)}
      .bulk-v3-page .bulk-provider-menu .bulk-select-all{grid-column:1/-1;justify-content:center}
      .bulk-v3-page .bulk-provider-options{position:relative;display:grid;grid-template-columns:127px repeat(7,minmax(0,1fr)) 54px;grid-template-rows:14px 40px;gap:5px 6px;align-items:center;min-width:0}
      .bulk-v3-page .bulk-provider-label{grid-column:1;grid-row:1;align-self:start;font-size:11px}
      .bulk-v3-page .bulk-provider-option.bulk-provider-all{grid-column:1;grid-row:2;width:118px;height:29px;justify-self:start}
      .bulk-v3-page .bulk-provider-option.bulk-provider-more{grid-column:9;grid-row:1 / span 2;width:54px;height:40px;align-self:center}
      .bulk-v3-page .bulk-provider-option.bulk-provider-all{border-color:#2678c4;background:#0a2c53}
      .bulk-v3-page .bulk-provider-menu small{grid-column:1/-1;padding:3px 4px;color:#9eb8d7;font-size:9px;line-height:1.4}
      .bulk-v3-page .bulk-provider-card{position:relative;box-sizing:border-box;display:flex;align-items:center;justify-content:center;min-width:0;height:40px;margin:0;padding:3px 20px 3px 4px;border:1px solid #15518d;border-radius:6px;background:linear-gradient(180deg,#0c2d55,#081f3d);transition:border-color .15s,background .15s,box-shadow .15s}
      .bulk-v3-page .bulk-provider-card.active{border-color:#36a6ff;background:linear-gradient(180deg,#103b69,#0b294a);box-shadow:inset 0 0 12px #087cff22}
      .bulk-v3-page .bulk-provider-brand{display:flex;align-items:center;justify-content:flex-start;gap:5px;width:100%;min-width:0;color:#d9eaff;text-decoration:none;cursor:pointer}
      .bulk-v3-page .bulk-provider-brand img{width:24px;height:24px;object-fit:contain;flex:none}
      .bulk-v3-page .bulk-provider-brand span{min-width:0;overflow:hidden;color:#d9eaff;font-size:9px;line-height:1.1;text-overflow:ellipsis;white-space:nowrap}
      .bulk-v3-page .bulk-provider-brand:hover span{text-decoration:underline;text-decoration-color:#74c8ff}
      .bulk-v3-page .bulk-provider-card-toggle{position:absolute;top:50%;right:4px;transform:translateY(-50%);display:grid;place-items:center;width:14px;height:14px;padding:0;border:1px solid #3473a7;border-radius:50%;background:#071a34;color:#92b9da;font-size:9px;line-height:1;cursor:pointer}
      .bulk-v3-page .bulk-provider-card-toggle[aria-pressed="true"]{border-color:#52d8bb;background:#0c564e;color:#d4fff4}
      .bulk-v3-page .bulk-provider-more{cursor:pointer}
      .bulk-v3-page .bulk-provider-drawer-backdrop{position:fixed;inset:0;z-index:1200;display:flex;justify-content:flex-end;background:#020a13b8;backdrop-filter:blur(3px)}
      .bulk-v3-page .bulk-provider-drawer{box-sizing:border-box;display:flex;flex-direction:column;gap:14px;width:min(560px,calc(100vw - 24px));height:100%;padding:22px;border-left:1px solid #2877c7;background:linear-gradient(155deg,#0b2546,#07182f 68%);box-shadow:-18px 0 52px #0009;color:#dceaff;overflow:auto}
      .bulk-v3-page .bulk-provider-drawer-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding-bottom:12px;border-bottom:1px solid #1b4773}
      .bulk-v3-page .bulk-provider-drawer-head h2{margin:0;font-size:20px}.bulk-v3-page .bulk-provider-drawer-head p{margin:5px 0 0;color:#9eb8d7;font-size:12px}
      .bulk-v3-page .bulk-provider-drawer-close{width:34px;height:34px;border:1px solid #28547c;border-radius:7px;background:#0a2342;color:#dceaff;font-size:20px;cursor:pointer}
      .bulk-v3-page .bulk-provider-selected{display:flex;flex-wrap:wrap;align-items:center;gap:7px;min-height:38px;padding:9px;border:1px solid #17436f;border-radius:8px;background:#081d37}
      .bulk-v3-page .bulk-provider-selected>strong{margin-right:3px;color:#9eb8d7;font-size:11px}.bulk-v3-page .bulk-provider-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 8px;border:1px solid #2678c4;border-radius:16px;background:#0b3157;color:#d9eaff;font-size:11px}.bulk-v3-page .bulk-provider-chip button{padding:0;border:0;background:transparent;color:#a9d8ff;cursor:pointer}
      .bulk-v3-page .bulk-provider-drawer-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
      .bulk-v3-page .bulk-provider-drawer-card{position:relative;display:flex;align-items:center;gap:10px;min-width:0;min-height:64px;padding:9px 40px 9px 11px;border:1px solid #1b4f80;border-radius:8px;background:linear-gradient(145deg,#0c2b4c,#091d37);color:#dceaff}
      .bulk-v3-page .bulk-provider-drawer-card>a{display:flex;align-items:center;gap:10px;min-width:0;color:inherit;text-decoration:none;cursor:pointer}.bulk-v3-page .bulk-provider-drawer-card>a:hover span{text-decoration:underline;text-decoration-color:#74c8ff}
      .bulk-v3-page .bulk-provider-drawer-card img,.bulk-v3-page .bulk-provider-drawer-card .bulk-logo-shell{display:grid;place-items:center;width:34px;height:34px;object-fit:contain;flex:none;border-radius:6px;background:#07182d}
      .bulk-v3-page .bulk-provider-drawer-card img[src$="/aws.png"]{width:42px;height:26px;border-radius:0;background:transparent}
      .bulk-v3-page .bulk-provider-drawer-card span{overflow:hidden;font-size:12px;font-weight:600;text-overflow:ellipsis;white-space:nowrap}
      .bulk-v3-page .bulk-provider-drawer-card>button{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:25px;height:25px;border:1px solid #326795;border-radius:6px;background:#0a2342;color:#9fc6e6;cursor:pointer}
      .bulk-v3-page .bulk-provider-drawer-card>button[aria-pressed="true"]{border-color:#43c9b0;background:#0b524b;color:#dcfff7}
      .bulk-v3-page .bulk-provider-custom-form{display:grid;gap:10px;padding:14px;border:1px solid #1b4f80;border-radius:9px;background:#081c34}
      .bulk-v3-page .bulk-provider-custom-form h3{margin:0;font-size:14px}.bulk-v3-page .bulk-provider-custom-form>label{display:grid;gap:5px;color:#a9c3df;font-size:11px}
      .bulk-v3-page .bulk-provider-custom-form input{box-sizing:border-box;width:100%;height:38px;padding:0 10px;border:1px solid #285783;border-radius:6px;background:#06162b;color:#e5f2ff;font-size:12px;outline:none}
      .bulk-v3-page .bulk-provider-custom-form input:focus{border-color:#43adff;box-shadow:0 0 0 2px #168eff2b}.bulk-v3-page .bulk-provider-custom-form small{color:#8eabc9;font-size:10px;line-height:1.45}.bulk-v3-page .bulk-provider-custom-form a{color:#83cbff;font-size:11px}
      .bulk-v3-page .bulk-provider-drawer-footer{display:flex;justify-content:flex-end;gap:8px;margin-top:auto;padding-top:12px;border-top:1px solid #1b4773}
      @media(max-width:600px){.bulk-v3-page .bulk-provider-options{grid-template-columns:repeat(2,minmax(0,1fr))}.bulk-v3-page .bulk-provider-label{grid-column:1/-1}}
      @media(min-width:601px) and (max-width:1450px){.bulk-v3-page .bulk-provider-options{grid-template-columns:repeat(4,minmax(0,1fr));grid-template-rows:auto;gap:6px}.bulk-v3-page .bulk-provider-label{grid-column:1/-1;grid-row:auto}.bulk-v3-page .bulk-provider-card,.bulk-v3-page .bulk-provider-option.bulk-provider-all,.bulk-v3-page .bulk-provider-option.bulk-provider-track,.bulk-v3-page .bulk-provider-option.bulk-provider-more{grid-column:auto!important;grid-row:auto!important;width:auto;height:40px;margin:0}}
      @container (max-width: 900px){.bulk-v3-page .bulk-provider-options{grid-template-columns:repeat(4,minmax(0,1fr));grid-template-rows:auto;gap:6px}.bulk-v3-page .bulk-provider-label{grid-column:1/-1;grid-row:auto}.bulk-v3-page .bulk-provider-card,.bulk-v3-page .bulk-provider-option.bulk-provider-all,.bulk-v3-page .bulk-provider-option.bulk-provider-track,.bulk-v3-page .bulk-provider-option.bulk-provider-more{grid-column:auto!important;grid-row:auto!important;width:auto;height:40px;margin:0}}
      @media(max-width:600px){.bulk-v3-page .bulk-provider-drawer{padding:16px}.bulk-v3-page .bulk-provider-drawer-grid{grid-template-columns:1fr}}
      .bulk-v3-page .bulk-custom-provider{grid-column:1/-1}
      .bulk-v3-page .bulk-custom-provider .field-error{color:#ff9cac}
      .bulk-v3-page .bulk-provider-cell{display:inline-flex;align-items:center;gap:6px;max-width:260px;white-space:nowrap}
      .bulk-v3-page .bulk-provider-cell img{width:26px;height:23px;object-fit:contain;flex:none}
      .bulk-v3-page .bulk-provider-cell a{overflow:hidden;color:#d9eaff;text-decoration:underline;text-decoration-color:#4c92d3;text-overflow:ellipsis}
      .bulk-v3-page .bulk-provider-cell a:hover{color:#74c8ff}
      .bulk-v3-page .bulk-schema-status{margin-top:7px;padding:7px 9px;border:1px solid #be8a36;border-radius:5px;background:#30240d;color:#ffdc8b;font-size:10px}
      .bulk-v3-page .bulk-security-note{margin-top:7px;padding:8px 10px;border:1px solid #6f5a24;border-radius:5px;background:#28220e;color:#f1d99b;font-size:10px}
      .bulk-v3-page .bulk-type-selector{display:flex;align-items:center;flex-wrap:wrap;gap:8px}
      .bulk-v3-page .bulk-deferred-badge{display:inline-flex;align-items:center;padding:2px 6px;border:1px solid #835bc5;border-radius:10px;color:#d6bbff;font-size:9px}
      /* Keep the compact provider picker from colliding with the resource-type controls. */
      @media (min-width:1400px) and (max-width:1699px){
        .bulk-v3-page .bulk-template-controls{height:auto;min-height:55px;align-items:start}
        .bulk-v3-page .bulk-resource-type,.bulk-v3-page .bulk-downloads{align-self:start}
      }
      @container (max-width:900px){
        .bulk-v3-page .bulk-provider-options{grid-template-columns:repeat(5,minmax(0,1fr));grid-template-rows:auto;gap:6px}
        .bulk-v3-page .bulk-provider-label{grid-column:1/-1;grid-row:auto}
        .bulk-v3-page .bulk-provider-card,.bulk-v3-page .bulk-provider-option.bulk-provider-all,.bulk-v3-page .bulk-provider-option.bulk-provider-more{grid-column:auto!important;grid-row:auto!important;width:auto;height:40px;margin:0}
      }
      .bulk-v3-page .bulk-provider-brand{box-sizing:border-box;display:flex;align-items:center;justify-content:flex-start;min-height:30px;line-height:1.2}
      .bulk-v3-page .bulk-provider-brand img{display:block;align-self:center;flex:none}
      .bulk-v3-page .bulk-provider-brand span{display:block;align-self:center;line-height:1.2}
      .bulk-v3-page .bulk-provider-filter button.bulk-provider-card-toggle{box-sizing:border-box;display:grid;place-items:center;flex:none;min-width:24px;min-height:24px;width:24px;height:24px;padding:0;line-height:1;text-align:center;border-radius:6px}
      .bulk-v3-page .bulk-provider-filter button.bulk-provider-card-toggle:hover{border-color:#56baff;background:#0b3157;color:#e9f6ff}
      .bulk-v3-page .bulk-provider-drawer-card>button{box-sizing:border-box;display:grid;place-items:center;min-width:28px;min-height:28px;width:28px;height:28px;padding:0;line-height:1;text-align:center}
      .bulk-v3-page .bulk-provider-cell>a{box-sizing:border-box;display:inline-flex;align-items:center;gap:6px;min-width:0;min-height:24px;line-height:1.2;vertical-align:middle}
      .bulk-v3-page .bulk-provider-cell>a img{display:block;align-self:center;width:26px;height:24px;object-fit:contain;flex:none}
    `}</style>
    <header className="bulk-v2-title"><div><h1>批量导入</h1><p>支持批量导入 Worker 资源（VPS、手机 RPA），请先下载模板，按模板格式填写后上传</p>{visualFixtureMode&&<WorkerVisualFixtureNotice message={fixtureActionNotice}/>}</div><div className="bulk-help"><button type="button" aria-expanded={helpOpen} onClick={()=>setHelpOpen((open)=>!open)}><Info size={17}/>使用说明</button>{helpOpen&&<div className="bulk-help-popover" role="dialog" aria-label="批量导入使用说明"><p>先选择资源类型并下载对应模板，再上传文件检查字段、地址和重复项。</p><p>服务端会先进行不写入的校验；校验通过后，确认导入才会创建资源。</p><p>手机 RPA 目前仅展示导入入口，业务功能延期。</p></div>}</div></header>
    <div className="bulk-v2-stepper"><span className="active"><b>1</b><strong>下载模板</strong><small>选择资源类型</small></span><i/><span><b>2</b><strong>上传文件</strong><small>支持拖放或点击上传</small></span><i/><span><b>3</b><strong>数据校验</strong><small>预览校验结果</small></span><i/><span><b>4</b><strong>开始导入</strong><small>确认后创建资源</small></span></div>
    <section className="bulk-v2-section bulk-template"><h2><b>1</b>选择资源类型并下载模板</h2>
      <div className="bulk-template-controls"><div className="bulk-resource-type"><span>资源类型</span><div className="bulk-type-selector"><label><input type="radio" name="bulk-resource-type" value="VPS" checked={resourceType==="VPS"} onChange={()=>visualFixtureMode?setFixtureActionNotice("视觉预览中固定展示合成样例。含义与功能状态不变。"):setResourceType("VPS")}/>VPS 资源</label><label><input type="radio" name="bulk-resource-type" value="MOBILE_RPA" checked={resourceType==="MOBILE_RPA"} onChange={()=>visualFixtureMode?setFixtureActionNotice("视觉预览中固定展示合成样例。含义与功能状态不变。"):setResourceType("MOBILE_RPA")}/>手机 RPA <span className="bulk-deferred-badge" title={visualFixtureMode?"仅供本地视觉演示，不代表真实功能状态":"UI_PRESENT · FUNCTION_DEFERRED"} aria-label={visualFixtureMode?"本地合成视觉样例":"UI_PRESENT; FUNCTION_DEFERRED"}>{visualFixture?.presentation?.resourceSampleBadge || "UI · 延期"}</span></label></div></div>
        <div className="bulk-provider-filter"><div className="bulk-provider-picker"><div className="bulk-provider-options" role="group" aria-label="云服务商多选筛选"><span className="bulk-provider-label">选择云服务商（可多选）</span><button type="button" className={`bulk-provider-option bulk-provider-all ${selectedProviders.length===0?"active":""}`} aria-pressed={selectedProviders.length===0} onClick={()=>setSelectedProviders([])}>全部</button>{BUILTIN_PROVIDERS.slice(0, 7).map((provider,index)=><div key={provider.id} style={{gridColumn:index+2,gridRow:"1 / span 2"}} className={`bulk-provider-card ${selectedProviders.includes(provider.id)?"active":""}`}><a className="bulk-provider-brand" href={provider.website} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label={`打开${provider.name}官网`}><img src={provider.logo} alt="" loading="lazy"/><span>{provider.name}</span></a><button type="button" className="bulk-provider-card-toggle" aria-label={`${selectedProviders.includes(provider.id)?"取消选择":"选择"}${provider.name}`} aria-pressed={selectedProviders.includes(provider.id)} onClick={()=>toggleProvider(provider.id)}>{selectedProviders.includes(provider.id)?"✓":"＋"}</button></div>)}<button type="button" className="bulk-provider-option bulk-provider-more" aria-expanded={providerMenuOpen} onClick={openProviderDrawer}>更多</button></div></div></div>
        <div className="bulk-downloads"><Button variant="primary" icon={DownloadSimple} onClick={()=>downloadServerTemplate("xlsx")} disabled={templateBusy}>{visualFixture?.presentation?.templateActions.xlsx || "下载 XLSX 模板"}</Button><Button icon={DownloadSimple} onClick={()=>downloadServerTemplate("csv")} disabled={templateBusy}>{visualFixture?.presentation?.templateActions.csv || "下载 CSV 模板"}</Button></div></div>
      {templateError&&<p className="danger-text" role="alert">{templateError}</p>}{serverSchemaState==="OUTDATED"&&<div className="bulk-schema-status" role="status">当前 Staging 模板契约尚未包含 resource_address / provider_* 字段。本地模板可用于预览；服务端校验和导入禁用。</div>}{serverSchemaState==="MATCH"&&<div className="bulk-schema-status" role="status">已从隔离 Staging 读取并核对当前模板字段；仍需真实 API 确认和数据回读才能验收。</div>}
    </section>
    <section className="bulk-v2-section bulk-upload"><h2><b>2</b>上传模板文件</h2>{fileError && <p className="danger-text bulk-file-error" role="alert">{fileError}</p>}
      <div className="bulk-upload-grid"><div className="bulk-drop-zone" onDragOver={(event)=>event.preventDefault()} onDrop={(event)=>{event.preventDefault();handleFile(event.dataTransfer.files[0]);}}><CloudArrowUp size={38}/><strong>将文件拖拽到此处，或点击上传</strong><span>支持 .xlsx、.csv；单个文件不超过 10 MB</span><small>.xls 仅本地预览，Staging 服务端不接受</small><input ref={inputRef} type="file" accept=".xlsx,.csv,.xls" hidden disabled={apiBusy||visualFixtureMode} onChange={(event)=>{const selected=event.currentTarget.files?.[0];event.currentTarget.value="";handleFile(selected);}}/><Button variant="primary" icon={UploadSimple} onClick={()=>visualFixtureMode?setFixtureActionNotice("视觉夹具中不会读取文件；关闭夹具后可使用真实上传流程。"):inputRef.current?.click()} disabled={apiBusy}>选择文件</Button></div>
      <div className="bulk-file-card"><h3>当前文件</h3><div><FileText size={26}/><p><b>{displayFile?.name || "尚未选择文件"}</b><small>{displayFile ? (visualFixtureMode?visualFixture?.presentation?.fileMeta:`${(displayFile.size/1024).toFixed(1)} KB · 浏览器本地预览`) : "不上传到服务器"}</small>{visualFixtureMode&&visualFixture?.presentation?.fileStatus&&<small className="bulk-fixture-upload-status">{visualFixture.presentation.fileStatus}</small>}</p>{displayFile&&<button aria-label="移除文件" onClick={resetFile} disabled={apiBusy}><Trash size={17}/></button>}</div>{localXls&&<p className="warning-text">该 .xls 仅供浏览器本地预览，Staging 服务端不接受此格式。</p>}{fileHasCredentialRows&&!visualFixtureMode&&<div className="bulk-security-note bulk-credential-import-warning" role="alert">凭据已掩码；Worker Secret Store 未验证，导入已禁用。</div>}</div>
      <div className="bulk-validation"><div className="bulk-validation-head"><h3>文件校验结果</h3><Button onClick={()=>visualFixtureMode?setFixtureActionNotice("样例数据由视觉夹具提供；没有重新解析文件。"):file&&handleFile(file)} disabled={!visualFixtureMode&&!file||apiBusy}>重新解析</Button></div><div className="bulk-validation-grid"><div><span className="bulk-validation-icon"><FileText size={22}/></span><span>数据行<b>{displayRows.length}</b></span></div><div className="good"><span className="bulk-validation-icon"><CheckCircle size={22}/></span><span>本地规则通过<b>{validCount}</b></span></div><div className="bad"><span className="bulk-validation-icon"><WarningCircle size={22}/></span><span>字段错误<b>{errorCount}</b></span></div><div className="warn"><span className="bulk-validation-icon"><WarningCircle size={22}/></span><span>重复键<b>{duplicateCount}</b></span></div></div><small className="bulk-duplicate-note">{visualFixtureMode?"以上为合成预览统计，不代表服务端校验结果。":"本地只检查文件内重复键；已有资源是否重复以服务端校验结果为准。"}</small></div></div>
    </section>
    <section className="bulk-v2-section bulk-preview-section"><div className="bulk-preview-head"><h2><b>3</b>数据预览 <small>（前 {pageRows.length} 行）</small></h2><div className="bulk-preview-tools"><span>共 {visibleRows.length} 行</span><label className="bulk-preview-limit">显示 <select value={pageSize} onChange={(event)=>{setPageSize(Number(event.target.value));setPage(1);}}><option value={100}>100</option><option value={500}>500</option><option value={1000}>1000</option></select> 行</label><label className="bulk-search"><MagnifyingGlass size={14} aria-hidden="true"/><input aria-label="搜索字段值" value={query} onChange={(event)=>{setQuery(event.target.value);setPage(1);}} placeholder="请输入关键字搜索（IP、名称等）"/></label></div></div>
      {selectionMode&&!visualFixtureMode&&<div className="bulk-preview-selection" role="status"><span>已选择 {selectedLines.size} 行，仅处理所选行</span><button type="button" onClick={()=>{setSelectionMode(false);setSelectedLines(new Set());setServerResult(null);}}>取消选择</button></div>}
      <div className="bulk-v2-table-scroll" ref={tableScrollRef}><table className="bulk-v2-table"><thead><tr><th className="bulk-select-cell"><input ref={selectPageRef} type="checkbox" aria-label="选择当前页所有行" checked={selectedAllOnPage} disabled={visualFixtureMode||!pageRows.length||apiBusy} onChange={(event)=>setCurrentPageSelection(event.target.checked)}/></th><th>行号</th>{previewColumns.map(({key,label})=><th key={key}>{label}</th>)}</tr></thead><tbody>{pageRows.map((row)=><tr key={row.__line}><td className="bulk-select-cell"><input type="checkbox" aria-label={`选择第 ${Number(row.__line)-1} 行`} checked={!visualFixtureMode&&selectedLines.has(row.__line)} disabled={visualFixtureMode||apiBusy} onChange={(event)=>setRowSelection(row.__line,event.target.checked)}/></td><td>{Number(row.__line) - 1}</td>{previewColumns.map(({key})=><td key={key}>
        {key==="__status"?(row.__duplicate?<span className="bulk-row-status duplicate" title={row.__errors.join("；")}><WarningCircle size={13}/>重复</span>:row.__errors.length?<span className="bulk-row-status error" title={row.__errors.join("；")}><WarningCircle size={13}/>错误</span>:row.__deferred?<span className="bulk-row-status deferred" title="功能延期；不会提交"><WarningCircle size={13}/>延期</span>:<span className="bulk-row-status valid"><CheckCircle size={13}/>通过</span>)
          :key==="provider_name"?row.provider_name?<span className="bulk-provider-cell">{safeProviderUrl(row.provider_name,row.provider_website_url)?<a href={safeProviderUrl(row.provider_name,row.provider_website_url)} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" title={`打开${row.provider_name}官网`}>{providerLogo(row.provider_name,row.provider_logo_url)&&<img src={providerLogo(row.provider_name,row.provider_logo_url)} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(event)=>{event.currentTarget.hidden=true;}}/>}{row.provider_name}</a>:<><span>{providerLogo(row.provider_name,row.provider_logo_url)&&<img src={providerLogo(row.provider_name,row.provider_logo_url)} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(event)=>{event.currentTarget.hidden=true;}}/>}</span><span>{row.provider_name}</span></>}</span>:"—"
          :key==="provider_website_credential"?(row.__credentialProvided?<span aria-label="凭据已填写并掩码">********</span>:"—")
          :key==="resource_type"?((row.__deferred||row.resource_type==="MOBILE_RPA")?<span className="type-badge mobile">手机 RPA{row.__deferred?" · 功能延期":""}</span>:<span className="type-badge">VPS 资源</span>)
          :key==="country"?<span className="bulk-country-cell"><img src={`/assets/flags/${String(row.country_code||"xx").toLowerCase()}.svg`} alt="" loading="lazy" onError={(event)=>{event.currentTarget.src="/assets/flags/unknown.svg";}}/><span>{row.country_name||"—"}<small>{row.country_code||""}</small></span></span>
          :key==="configuration"?(row.configuration||`${row.cpu_cores||"—"}核 ${row.memory_gb||"—"}GB ${row.system_disk_gb||"—"}GB`)
          :key==="resource_address"?row.__errors.some((message)=>message.startsWith("resource_address"))?<span className="bulk-address-error" title={`${row.resource_address||""}${row.__errors.length?` · ${row.__errors.join("；")}`:""}`}>{row.resource_address||"资源地址不能为空"}</span>:<span title={row.resource_address||""}>{row.resource_address||"—"}</span>
          :key==="city"?<span title={cityZh(row.city)}>{cityZh(row.city)||"—"}</span>
          :row[key]||"—"}</td>)}</tr>)}{!pageRows.length&&<tr><td colSpan={previewColumns.length+2}>{fileError?"文件未通过结构检查":"尚无本地预览数据"}</td></tr>}</tbody></table></div>
      <div className="bulk-v2-table-footer"><label>每页 <select value={pageSize} onChange={(event)=>{setPageSize(Number(event.target.value));setPage(1);}}><option value={100}>100</option><option value={500}>500</option><option value={1000}>1000</option></select></label><span>第 {page} / {pageCount} 页 · {visibleRows.length} 行 · 本地预检通过 {validCount}</span><div className="pagination"><button type="button" aria-label="上一页" disabled={page<=1} onClick={()=>setPage(page-1)}>‹</button>{pageTokens.map((token,index)=>token==="…"?<span className="pagination-ellipsis" key={`ellipsis-${index}`}>…</span>:<button type="button" key={token} aria-current={token===page?"page":undefined} className={token===page?"active":""} onClick={()=>setPage(token)}>{token}</button>)}<button type="button" aria-label="下一页" disabled={page>=pageCount} onClick={()=>setPage(page+1)}>›</button><form className="bulk-page-jump" onSubmit={(event)=>{event.preventDefault();const value=Number(new FormData(event.currentTarget).get("page"));if(Number.isInteger(value))setPage(Math.min(pageCount,Math.max(1,value)));}}><label>跳至 <input key={page} name="page" type="number" min="1" max={pageCount} defaultValue={page} aria-label="跳至页码"/></label><span>页</span></form></div></div>
    </section>
    {(apiBusy||serverResult)&&<div className={`bulk-submit-feedback ${apiBusy?"running":serverResult?.status||""}`} role="status">
      {apiBusy&&<><strong>{serverResult?.status==="processing"?"文件已上传，等待服务端响应":serverResult?.phase==="validating"?"正在进行服务端校验":"正在提交确认导入"}</strong>{uploadProgress!==null&&<><progress max="100" value={uploadProgress}/><span>浏览器文件上传 {uploadProgress}%</span></>}<small>仅展示浏览器上传和服务端响应状态。</small></>}
      {!apiBusy&&serverResult&&<><strong>{serverResult.phase==="preview"?"服务端校验": "导入结果"} · {serverResult.httpStatus?"HTTP "+serverResult.httpStatus:"请求状态未知"}</strong>{serverResult.error&&<span>{serverResult.error}</span>}{serverResult.body&&<span>{serverResult.body.valid===false?"校验未通过":serverResult.body.confirmed===true?"导入已确认 · 创建 "+(Array.isArray(serverResult.body.created)?serverResult.body.created.length:0)+" 行":serverResult.status==="preview-valid"?"校验通过 · "+(serverResult.body.row_count??rows.length)+" 行 · 未创建资源":"服务端未确认导入"}</span>}{serverResult.body?.errors?.length>0&&errorLines(serverResult.body.errors).map((message,index)=><span key={index}>{message}</span>)}{serverResult.phase==="import"&&serverResult.status==="error"&&<small>该次确认的最终状态未知。先在资源列表按文件中的 VPS Key 核对，不要直接重发确认导入。</small>}{serverResult.phase==="import"&&serverResult.status==="rejected"&&<small>服务端未确认导入。请修正文件并重新校验；不会自动重发确认请求。</small>}</>}
    </div>}
    <footer className="bulk-v2-footer"><span><Info size={16}/>{visualFixtureMode?"视觉夹具数据仅用于本地展示；模板/API/DB提交均已拦截。":selectionMode&&!selectedRows.length?"请至少选择一行后继续。":serverPreviewReady?`服务端校验通过，确认后将导入 ${serverResult?.body?.row_count??rowsToImport.length} 行至隔离 Staging。`:hasDeferredRows?"手机 RPA 当前仅展示入口，业务功能延期。":hasCredentialRows?"服务商凭据仅本地掩码；Worker Secret Store 摄取未验证，服务端导入保持禁用。":serverSchemaState==="MATCH"?`先进行 confirm=false 校验，通过后确认导入 ${rowsToImport.length} 行。`:"导入前将先进行不写入的服务端校验。Staging 模板/Schema 未匹配时操作保持禁用。"}</span><div><Button onClick={onClose} disabled={apiBusy}>取消</Button><Button variant="primary" icon={UploadSimple} disabled={visualFixtureMode?false:!file||localXls||apiBusy||!stagingImportReady||serverResult?.status==="success"} onClick={()=>visualFixtureMode?setFixtureActionNotice("视觉演示已拦截提交；没有请求 API 或写入数据库。"):serverPreviewReady?submitToServer(true):submitToServer(false)}>{visualFixtureMode?"开始导入（演示）":serverResult?.status==="success"?"导入完成":apiBusy?"处理中…":selectionMode?`校验所选行（${rowsToImport.length} 条）`:serverPreviewReady?`开始导入（${serverResult?.body?.row_count??rowsToImport.length} 条）`:serverResult?.phase==="preview"?`重新校验（${rowsToImport.length} 条）`:`开始导入（${rowsToImport.length} 条）`}</Button></div></footer>
    {providerMenuOpen&&<div className="bulk-provider-drawer-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget)setProviderMenuOpen(false);}}><aside className="bulk-provider-drawer" role="dialog" aria-modal="true" aria-labelledby="bulk-provider-drawer-title"><div className="bulk-provider-drawer-head"><div><h2 id="bulk-provider-drawer-title">更多服务商</h2><p>浏览和暂存服务商选择；点击确认后才应用到筛选。</p></div><button type="button" className="bulk-provider-drawer-close" aria-label="关闭服务商面板" onClick={()=>setProviderMenuOpen(false)}>×</button></div><div className="bulk-provider-selected"><strong>已选服务商</strong>{draftProviders.length?draftProviders.map((id)=>{const provider=BUILTIN_PROVIDERS.find((item)=>item.id===id);const name=id==="custom"?(draftCustomProvider.name||"自定义服务商"):provider?.name||id;return <span className="bulk-provider-chip" key={id}>{name}<button type="button" aria-label={`移除${name}`} onClick={()=>toggleDraftProvider(id)}>×</button></span>;}):<span className="bulk-provider-chip">未选择</span>}</div><div className="bulk-provider-drawer-grid">{BUILTIN_PROVIDERS.map((provider)=><div className="bulk-provider-drawer-card" key={provider.id}><a href={provider.website} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label={`打开${provider.name}官网`}><img src={provider.logo} alt=""/><span>{provider.name}</span></a><button type="button" aria-label={`${draftProviders.includes(provider.id)?"取消选择":"选择"}${provider.name}`} aria-pressed={draftProviders.includes(provider.id)} onClick={()=>toggleDraftProvider(provider.id)}>{draftProviders.includes(provider.id)?"✓":"＋"}</button></div>)}<div className="bulk-provider-drawer-card"><a href={safeProviderUrl(draftCustomProvider.name,draftCustomProvider.websiteUrl)||undefined} target={safeProviderUrl(draftCustomProvider.name,draftCustomProvider.websiteUrl)?"_blank":undefined} rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label="自定义服务商官网">{draftCustomProvider.logoUrl?<img src={draftCustomProvider.logoUrl} alt="" onError={(event)=>{event.currentTarget.hidden=true;}}/>:<span className="bulk-logo-shell">＋</span>}<span>{draftCustomProvider.name||"自定义服务商"}</span></a><button type="button" aria-label={`${draftProviders.includes("custom")?"取消选择":"选择"}自定义服务商`} aria-pressed={draftProviders.includes("custom")} onClick={()=>toggleDraftProvider("custom")}>{draftProviders.includes("custom")?"✓":"＋"}</button></div></div><div className="bulk-provider-custom-form" id="custom-provider-form"><h3>添加自定义服务商</h3><label>服务商名称<input value={draftCustomProvider.name} onChange={(event)=>setDraftCustomProvider((current)=>({...current,name:event.target.value}))} placeholder="例如：Acme Cloud" autoComplete="off"/></label><label>服务商 Logo 地址<input value={draftCustomProvider.logoUrl} onChange={(event)=>setDraftCustomProvider((current)=>({...current,logoUrl:event.target.value}))} placeholder="https://example.com/logo.svg" autoComplete="off"/></label><label>服务商官网或后台地址<input value={draftCustomProvider.websiteUrl} onChange={(event)=>setDraftCustomProvider((current)=>({...current,websiteUrl:event.target.value}))} placeholder="https://example.com/" autoComplete="url"/></label><small>自定义资料仅保存在当前页面内存；链接需使用 HTTPS。确认后 Logo 和名称均可在新标签页打开。</small></div><div className="bulk-provider-drawer-footer"><Button onClick={()=>setProviderMenuOpen(false)}>取消</Button><Button variant="primary" onClick={confirmProviderDrawer} disabled={draftProviders.includes("custom")&&(!draftCustomProvider.name.trim()||!safeProviderUrl(draftCustomProvider.name,draftCustomProvider.websiteUrl))}>确认选择</Button></div></aside></div>}
  </div>;
}


