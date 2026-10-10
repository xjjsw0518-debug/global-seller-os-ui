import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, CircleNotch, WarningCircle, CheckCircle, XCircle } from "@phosphor-icons/react";
import { buildModelDraftPayload, capabilityCandidates, initialModelDraft, providerFixtures, validateModelDraft } from "./modelDraftSchema.js";
import { createLocalMockModelLogo, validateModelLogoFile } from "./modelLogoContract.js";
import "./add-model-dialog.css";
import "./model-add-page.css";

const focusableSelector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const providerFixture = (name) => providerFixtures.find((fixture) => fixture.name === name);

export default function AddModelDialog({ adapter, onClose, onSaved, open = true, onRequestClose, onCancel, mode = "dialog" }) {
  const [form, setForm] = useState(initialModelDraft);
  const [errors, setErrors] = useState({});
  const [dirty, setDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [busy, setBusy] = useState("");
  const [connection, setConnection] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [validationResult, setValidationResult] = useState(null);
  const [notice, setNotice] = useState("");
  const [discovery, setDiscovery] = useState(null);
  const [mockKey, setMockKey] = useState("");
  const [logoFile, setLogoFile] = useState(null);
  const [logoDataUrl, setLogoDataUrl] = useState("");
  const [logoError, setLogoError] = useState("");
  const [simulatedEnabled, setSimulatedEnabled] = useState(false);
  const busyRef = useRef(false);
  const dialogRef = useRef(null);
  const restoreFocusRef = useRef(null);
  const discardTriggerRef = useRef(null);
  const dropdownEscRef = useRef(false);
  const validation = useMemo(() => validateModelDraft(form), [form]);

  const finishClose = useCallback(() => { onRequestClose?.(); onCancel?.(); onClose?.(); }, [onCancel, onClose, onRequestClose]);
  const requestClose = useCallback(() => {
    if (busyRef.current) return;
    if (dirty) { discardTriggerRef.current = document.activeElement; setConfirmDiscard(true); }
    else finishClose();
  }, [dirty, finishClose]);

  useEffect(() => {
    if (!open) { onRequestClose?.(); onClose?.(); }
  }, [open, onClose, onRequestClose]);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement;
    const frame = requestAnimationFrame(() => dialogRef.current?.querySelector("[data-autofocus]")?.focus());
    return () => { cancelAnimationFrame(frame); const target = restoreFocusRef.current; if (target?.isConnected) target.focus?.(); };
  }, []);
  useEffect(() => {
    if (confirmDiscard) dialogRef.current?.querySelector('[role="alertdialog"] .cancel-action')?.focus();
    else if (discardTriggerRef.current?.isConnected) discardTriggerRef.current.focus();
  }, [confirmDiscard]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        const active = document.activeElement;
        const select = active?.tagName === "SELECT";
        if (select && !dropdownEscRef.current) { dropdownEscRef.current = true; return; }
        dropdownEscRef.current = false;
        event.preventDefault();
        if (confirmDiscard) setConfirmDiscard(false); else requestClose();
        return;
      }
      if (event.key === "Tab") dropdownEscRef.current = false;
      if (event.key !== "Tab") return;
      const scope = dialogRef.current?.querySelector('[role="alertdialog"]') || dialogRef.current;
      if (!scope) return;
      const focusables = [...scope.querySelectorAll(focusableSelector)].filter((el) => el.getClientRects().length > 0);
      if (!focusables.length) { event.preventDefault(); scope.focus(); return; }
      if (event.shiftKey && (document.activeElement === focusables[0] || !scope.contains(document.activeElement))) { event.preventDefault(); focusables.at(-1).focus(); }
      else if (!event.shiftKey && (document.activeElement === focusables.at(-1) || !scope.contains(document.activeElement))) { event.preventDefault(); focusables[0].focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmDiscard, requestClose]);

  const update = (key, value) => {
    if (busyRef.current) return;
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "providerName") {
        const fixture = providerFixture(value);
        next.providerDisplayName = fixture?.displayName || "";
        next.providerId = fixture?.id || "";
        next.providerType = fixture?.providerType || "OPENAI_COMPATIBLE";
        next.connectionType = fixture?.providerType || "OPENAI_COMPATIBLE";
        next.apiBaseUrl = fixture?.apiBaseUrl || "";
      }
      return next;
    });
    setDirty(true); setConnection(null); setSaveError(""); setValidationResult(null); setErrors((current) => ({ ...current, [key]: "" }));
  };
  const validate = () => { const next = validation.errors; setErrors(next); if (validation.valid) return true; setValidationResult({ kind: "error", message: "请先修正必填项和标出的字段。" }); return false; };
  const handleDiscover = () => {
    if (busyRef.current || !form.providerId) { setNotice("先选择一个合成 Provider fixture。此按钮仅演示发现状态，不发起 HTTP 请求。"); return; }
    const query = new URLSearchParams(window.location.search);
    const status = query.get("mockDiscoveryStatus") || "SUCCESS_EMPTY";
    const messages = { SUCCESS: "找到合成模型 fixture；请在模型 ID 字段手工确认。", SUCCESS_EMPTY: "演示 Provider 暂无模型发现结果，可手工输入模型 ID。", UNSUPPORTED: "该合成 Provider fixture 不支持发现模型。", TIMEOUT: "模拟发现超时。", CONNECTION_ERROR: "模拟连接错误。", AUTH_ERROR: "模拟认证错误。", INVALID_ENDPOINT: "模拟 endpoint 错误。", PROVIDER_ERROR: "模拟 Provider 错误。", MALFORMED_RESPONSE: "模拟响应格式错误。" };
    setDiscovery({ status, mock: true, message: messages[status] || messages.SUCCESS_EMPTY }); setNotice("本地 mock；没有调用 Provider。");
  };
  const handleTest = async () => {
    if (busyRef.current || !validate()) return;
    busyRef.current = true; setBusy("connection"); setConnection({ status: "TESTING", mock: true, message: "正在运行本地模拟测试；不会连接 Provider。" }); setValidationResult(null);
    try {
      const response = await adapter.validateConnection({ provider: form.providerName, providerId: form.providerId, model: form.modelId.trim(), endpointMode: form.endpointMode, manualBaseUrl: form.endpointMode === "MANUAL" ? form.manualBaseUrl.trim() : undefined, mock: true });
      const status = response?.status === "TEST_SUCCESS" || response?.state === "SUCCESS" || response?.ok ? "TEST_SUCCESS" : "TEST_FAILED";
      setConnection({ ...response, status, message: response?.message || (status === "TEST_SUCCESS" ? "本地 mock 测试成功；未连接 Provider。" : "本地 mock 未通过；未连接 Provider。"), mock: true });
    } catch (error) { setConnection({ ok: false, status: "TEST_FAILED", mock: true, errorCode: error?.code || "MOCK_CONNECTION_ERROR", message: "本地模拟测试失败；尚未连接 Provider。" }); }
    finally { busyRef.current = false; setBusy(""); }
  };
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (busyRef.current || !validate()) return;
    busyRef.current = true; setBusy("save"); setSaveError(""); setNotice("");
    try {
      const payload = buildModelDraftPayload(form);
      await adapter.create({
        provider: form.providerDisplayName, model: form.modelId.trim(), baseUrl: form.endpointMode === "MANUAL" ? form.manualBaseUrl.trim() : form.apiBaseUrl.trim(),
        type: form.connectionType, context: "未知（旧列表展示字段；未映射到候选后端 schema）", quota: form.monthlyBudget || "0", secretConfigured: Boolean(form.secretConfigured || mockKey),
        draftPayload: payload,
        ...(logoFile && logoDataUrl ? { modelLogo: createLocalMockModelLogo(logoFile, logoDataUrl) } : {}),
      });
      setDirty(false); setMockKey(""); setForm((current) => ({ ...current, secretConfigured: false }));
      await onSaved?.();
    } catch (error) {
      setSaveError(["MODEL_ALREADY_EXISTS", "MODEL_REGISTRY_EXISTS"].includes(error?.code) ? "该 Provider 下模型 ID 已存在，请检查并修改。" : "草稿保存失败；当前输入仍保留，请重试。请留意本地 mock 错误状态。");
    } finally { busyRef.current = false; setBusy(""); }
  };

  const input = (key, label, options = {}) => <label className={`field ${options.wide ? "wide" : ""}`}><span>{label}{options.required && <b> *</b>}</span><input aria-label={label} type={options.type || "text"} min={options.min} max={options.max} step={options.step} maxLength={options.maxLength} value={form[key]} placeholder={options.placeholder || ""} aria-invalid={Boolean(errors[key])} onChange={(e) => update(key, e.target.value)} disabled={Boolean(busy)} />{options.help && <small>{options.help}</small>}{errors[key] && <small className="field-error">{errors[key]}</small>}</label>;
  const select = (key, label, options, labels = {}) => <label className="field"><span>{label}{errors[key] && <b> *</b>}</span><select aria-label={label} value={form[key]} aria-invalid={Boolean(errors[key])} onChange={(e) => update(key, e.target.value)} disabled={Boolean(busy)}><option value="">请选择</option>{options.map((value) => <option key={value} value={value}>{labels[value] || value}</option>)}</select>{errors[key] && <small className="field-error">{errors[key]}</small>}</label>;
  const handleLogoFile = async (file) => {
    setLogoError("");
    const result = await validateModelLogoFile(file);
    if (!result.valid) { setLogoFile(null); setLogoDataUrl(""); setLogoError(`Logo validation failed: ${result.code}`); return; }
    const reader = new FileReader();
    reader.onerror = () => { setLogoFile(null); setLogoDataUrl(""); setLogoError("Logo could not be read; Provider fallback restored."); };
    reader.onload = () => { setLogoFile(file); setLogoDataUrl(String(reader.result || "")); setDirty(true); };
    reader.readAsDataURL(file);
  };
  const handleMockEnable = () => {
    if (connection?.status !== "TEST_SUCCESS") return;
    setSimulatedEnabled(true);
    setNotice("MOCK: simulated enable only. No real Provider request or backend state change occurred.");
  };
  if (!open) return null;

  return <div className={mode === "page" ? "add-model-page-host" : "add-model-backdrop"} onMouseDown={(event) => { if (mode !== "page" && event.target === event.currentTarget) requestClose(); }}>
    <section className={`add-model-dialog add-model-dialog--draft ${mode === "page" ? "add-model-dialog--page" : ""}`} ref={dialogRef} role={mode === "page" ? "main" : "dialog"} aria-modal={mode === "page" ? undefined : "true"} aria-labelledby="add-model-title" tabIndex={-1}>
      <header><div><span className="dialog-eyebrow">MODEL CONFIGURATION · LOCAL DRAFT</span><h2 id="add-model-title">添加 AI 模型</h2><p>Provider、模型、连接、计价和限额分组配置；此批所有操作仅更新本地 mock。</p></div><button type="button" className="dialog-close" aria-label="关闭添加模型" onClick={requestClose} disabled={Boolean(busy)}><X size={18} /></button></header>
      <div className="dialog-notice"><WarningCircle size={17} /><span>无生产 API 调用。API Key 不采集也不发送；请勿粘贴真实密钥。UUID、能力清单和发现结果均为合成 fixture。</span></div>
      <form onSubmit={handleSubmit} noValidate>
        <div className="field wide model-logo-field"><span>Model-specific Logo (optional)</span><div className="model-logo-picker"><div className="model-logo-preview">{logoDataUrl ? <img src={logoDataUrl} alt="Model logo preview" onError={() => { setLogoDataUrl(""); setLogoFile(null); setLogoError("Logo preview failed; Provider fallback restored."); }} /> : <div className="model-logo-neutral">{form.providerName || "AI"}</div>}</div><div className="model-logo-controls"><label className="subtle-action">Choose image<input aria-label="Choose model logo image" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { const file=e.target.files?.[0]; if(file) void handleLogoFile(file); e.target.value=""; }} disabled={Boolean(busy)} /></label>{logoFile && <button type="button" className="subtle-action" onClick={() => { setLogoFile(null); setLogoDataUrl(""); setLogoError(""); setDirty(true); }}>Restore Provider fallback</button>}<small>PNG/JPEG/WebP, max 1 MiB. Local mock memory only; refresh persistence is unsupported.</small>{logoError && <small className="field-error" role="alert">{logoError}</small>}</div></div></div>
        <div className="draft-section"><h3>1 · Provider 身份与预算 <small>合成 Provider fixture</small></h3><div className="add-model-grid">
          {select("providerName", "Provider 标识", ["OPENAI", "DEEPSEEK", "DOUBAO", "CUSTOM"], { OPENAI: "OPENAI", DEEPSEEK: "DEEPSEEK", DOUBAO: "DOUBAO", CUSTOM: "CUSTOM" })}
          {input("providerDisplayName", "Provider 显示名", { required: true, maxLength: 160, help: "候选契约：1–160 字符" })}
          {input("providerId", "Provider UUID（合成）", { required: true, help: "由 fixture 选择填充；仅接受 fixture UUID" })}
          {select("providerType", "Provider 协议 provider_type", ["OPENAI_COMPATIBLE", "PROVIDER_NATIVE", "OLLAMA", "CUSTOM"])}
          {select("providerStatus", "Provider 状态", ["ACTIVE", "DISABLED", "ERROR", "QUOTA_LIMITED"])}
          <label className="field draft-check"><span>Provider enabled</span><input aria-label="Provider enabled" type="checkbox" checked={form.providerEnabled} onChange={(e) => update("providerEnabled", e.target.checked)} /></label>
          {input("apiBaseUrl", "Provider API Base URL", { wide: true, maxLength: 512, help: "AUTO endpoint 使用；HTTP(S)、无账号信息、最多 512 字符。" })}
          {input("providerDailyBudget", "Provider 日预算", { type: "number", min: 0, step: "any", help: "Provider 级预算；默认 0。不与模型配额混用。" })}
          {input("providerMonthlyBudget", "Provider 月预算", { type: "number", min: 0, step: "any", help: "Provider 级预算；默认 0。" })}
        </div></div>
        <div className="draft-section"><h3>2 · 模型与连接 <small>状态默认 DRAFT / UNTESTED</small></h3><div className="add-model-grid">
          {input("modelId", "模型 ID model_id", { required: true, maxLength: 120, placeholder: "例如 gpt-4o", help: "1–120 字符；保存时 model_name 与 model_id 一致。" })}
          {input("displayName", "模型显示名 display_name", { required: true, maxLength: 160, placeholder: "用于控制台展示", help: "1–160 字符" })}
          {select("endpointMode", "Endpoint 模式 endpoint_mode", ["AUTO", "MANUAL"])}
          {select("authType", "认证 auth_type", ["API_KEY", "NONE"])}
          {select("connectionType", "连接协议 connection_type", ["OPENAI_COMPATIBLE", "PROVIDER_NATIVE", "OLLAMA", "CUSTOM"])}
          {select("costLevel", "成本级别 cost_level", ["FREE", "LOW", "MEDIUM", "HIGH"])}
          {select("usageStrategy", "调用策略 usage_strategy", ["PRIORITY", "NORMAL", "BACKUP", "FALLBACK"])}
          {form.endpointMode === "MANUAL" && input("manualBaseUrl", "手动地址 manual_base_url", { wide: true, maxLength: 512, required: true, help: "MANUAL 必填；HTTP(S)、无账号信息、最多 512 字符。" })}
          <label className="field wide"><span>Provider API Key（可选；仅合成 mock）</span><input aria-label="Provider API Key（合成 mock）" type="password" autoComplete="new-password" maxLength={4096} value={mockKey} placeholder="如不需要凭据可留空；禁止输入真实 Key" onChange={(e) => { setMockKey(e.target.value); update("secretConfigured", Boolean(e.target.value)); }} disabled={Boolean(busy)} /><small>密码框不回显；Key 只暂存在当前组件内存，用来生成 secretConfigured 布尔标记，永不发送或持久化。真实凭据需在后端安全入口配置。</small></label>
          <div className="field wide draft-actions"><button type="button" className="subtle-action" onClick={handleDiscover} disabled={Boolean(busy)}>发现模型（本地模拟）</button><small>{discovery ? `MOCK · ${discovery.status} — ${discovery.message}` : "发现状态为 SUCCESS / SUCCESS_EMPTY / UNSUPPORTED / TIMEOUT / CONNECTION_ERROR / AUTH_ERROR / INVALID_ENDPOINT / PROVIDER_ERROR / MALFORMED_RESPONSE；此入口不发网络请求。"}</small>{notice && <small role="status">{notice}</small>}</div>
          {input("endpointDetails", "Endpoint 备注 endpoint_details", { wide: true, maxLength: 2000, help: "最多 2000 字符；非敏感说明。" })}
          {input("contextWindow", "上下文窗口 context_window（本地说明）", { placeholder: "留空 = 未知", help: "候选配置 schema/ORM 无此字段；仅本地说明，不发送。旧 context 不映射为 input_context。" })}
        </div><div className="draft-info">保存的测试状态保持 UNTESTED。模拟测试结果不代表真实 Provider 连接，也不能据此启用模型。</div></div>
        <div className="draft-section"><h3>3 · 计价 <small>未知不会按 0 计价</small></h3><div className="add-model-grid">
          {input("inputRate", "输入费率 / 百万 Token", { type: "number", min: 0, step: "any", placeholder: "留空 = 未知" })}
          {input("outputRate", "输出费率 / 百万 Token", { type: "number", min: 0, step: "any", placeholder: "留空 = 未知" })}
          {input("currency", "币种 currency", { maxLength: 16, placeholder: "例如 USD；留空 = 未知" })}
          {select("pricingStatus", "定价状态 pricing_status", ["UNKNOWN", "VERIFIED", "DISABLED"], { UNKNOWN: "UNKNOWN（默认）", VERIFIED: "VERIFIED（独立计价接口候选）", DISABLED: "DISABLED" })}
          {form.pricingStatus === "VERIFIED" && input("pricingSource", "定价来源 pricing_source", { wide: true, maxLength: 240, required: true, placeholder: "公开价目表或来源说明" })}
          <div className="field wide draft-info">VERIFIED 要求输入/输出费率、币种及非空来源。当前草稿只展示/记录候选计价字段；后端独立计价接口尚未接通。</div>
        </div></div>
        <div className="draft-section"><h3>4 · 计费与模型限额</h3><div className="add-model-grid">
          {select("billingMode", "计费模式 billing_mode", ["USAGE_BASED", "PREPAID_BALANCE", "TOKEN_PACKAGE", "ENTERPRISE_CONTRACT", "SELF_HOSTED", "UNMANAGED"])}
          {input("rpm", "RPM", { type: "number", min: 0, max: 10000000, step: 1, placeholder: "0–10,000,000；留空 = 未知" })}
          {input("tpm", "TPM", { type: "number", min: 0, max: 1000000000, step: 1, placeholder: "0–1,000,000,000；留空 = 未知" })}
          {input("rpd", "RPD", { type: "number", min: 0, max: 10000000, step: 1, placeholder: "0–10,000,000；留空 = 未知" })}
          {input("freeQuota", "免费额度 free_quota", { type: "number", min: 0, step: "any", placeholder: "留空 = 未知" })}
          {input("monthlyBudget", "模型月预算 monthly_budget_limit", { type: "number", min: 0, step: "any", placeholder: "0 = 未设限" })}
          {input("warningThreshold", "预警比例 warning_threshold_percent", { type: "number", min: 0, max: 100, step: 1, placeholder: "0–100；留空 = 未知" })}
          <fieldset className="draft-field wide draft-capabilities"><legend>能力 capabilities（最多 10 项）</legend><small>候选注册能力合成 fixture；不是线上启用清单。</small><div>{capabilityCandidates.map((cap) => <label key={cap}><input aria-label={`能力 ${cap}`} type="checkbox" checked={form.capabilities.includes(cap)} disabled={Boolean(busy)} onChange={() => { const exists = form.capabilities.includes(cap); if (!exists && form.capabilities.length >= 10) { setErrors((current) => ({ ...current, capabilities: "最多选择 10 项注册能力" })); return; } setErrors((current) => ({ ...current, capabilities: "" })); update("capabilities", exists ? form.capabilities.filter((item) => item !== cap) : [...form.capabilities, cap]); }} />{cap}</label>)}</div>{errors.capabilities && <small className="field-error">{errors.capabilities}</small>}</fieldset>
        </div></div>
        <div className="form-feedback" role="status" aria-live="polite">
          {validationResult && <span className={validationResult.kind === "error" ? "feedback-error" : "feedback-info"}>{validationResult.message}</span>}
          {connection && <span className={`connection-feedback ${connection.status === "TEST_SUCCESS" ? "feedback-success" : connection.status === "TEST_FAILED" ? "feedback-error" : "feedback-info"}`}>{connection.status === "TESTING" ? <CircleNotch className="spin" size={13} /> : connection.status === "TEST_SUCCESS" ? <CheckCircle size={13} /> : connection.status === "TEST_FAILED" ? <XCircle size={13} /> : null}<b>MOCK · {connection.status}</b> {connection.message}{connection.errorCode && <code>{connection.errorCode}</code>}</span>}
          {saveError && <span className="feedback-error" role="alert"><b>MOCK · </b>{saveError}</span>}
        </div>
        <footer><button type="button" className="subtle-action" onClick={() => validate() && setValidationResult({ kind: "info", message: "表单校验通过。仍为本地 draft；尚未连接 Provider。" })} disabled={Boolean(busy)}>校验草稿</button><button type="button" className="subtle-action" onClick={handleTest} disabled={Boolean(busy)}>{busy === "connection" && <CircleNotch className="spin" size={15} />}模拟连接测试</button><span className="footer-spacer"/><button type="button" className="cancel-action" onClick={requestClose} disabled={Boolean(busy)}>取消</button><button type="submit" className="save-action" disabled={Boolean(busy)}>{busy === "save" && <CircleNotch className="spin" size={15} />}保存草稿</button><button type="button" className="subtle-action" disabled title="需要真实后端测试成功；本地 mock 不提供启用。">测试后启用 · 需真实服务</button></footer>
      </form>
      {mode === "page" && <aside className="add-model-page-aside"><section className="page-preview-card"><header><b>配置预览</b><small>随配置更新</small></header><div className="page-preview-logo">{logoDataUrl ? <img src={logoDataUrl} alt="模型 Logo" /> : <div className="model-logo-neutral">{form.providerName || "AI"}</div>}<span><b>{form.displayName || "模型显示名"}</b><small>{form.modelId || "模型 ID"}</small></span></div><dl><dt>Provider</dt><dd>{form.providerDisplayName || "未选择"}</dd><dt>成本等级</dt><dd>{form.costLevel || "未知"}</dd><dt>使用策略</dt><dd>{form.usageStrategy || "未选择"}</dd><dt>适用任务</dt><dd>{form.capabilities.length ? form.capabilities.join(" / ") : "未选择能力"}</dd><dt>API 地址</dt><dd>{form.endpointMode === "AUTO" ? "AUTO · 跟随 Provider" : form.manualBaseUrl || "MANUAL · 未填写"}</dd><dt>凭据状态</dt><dd>{form.secretConfigured || mockKey ? "已配置（本地标记）" : "未配置"}</dd><dt>计价状态</dt><dd>{form.pricingStatus}</dd><dt>配置状态</dt><dd>DRAFT · UNTESTED</dd></dl></section><section className="page-test-card"><header><b>连接测试</b><small>MOCK</small></header><p>先完成配置校验，再运行本地模拟测试。</p>{["Provider 可用性","模型可用性","API Key 凭据","API Endpoint","模型响应"].map((label)=><div key={label}><span>○ {label}</span><small>{connection?.status || "未测试"}</small></div>)}<small>未接入真实接口；不会发送 API 请求，mock 结果不能解锁启用。</small></section></aside>}
      {confirmDiscard && <div className="discard-backdrop"><section className="discard-dialog" role="alertdialog" aria-modal="true" aria-labelledby="discard-title" tabIndex={-1}><h3 id="discard-title">放弃未保存的草稿？</h3><p>字段内容尚未保存到本地 mock。选择继续编辑可保留内容；确认放弃会关闭表单。</p><footer><button type="button" className="cancel-action" onClick={() => setConfirmDiscard(false)}>保留草稿</button><button type="button" className="save-action danger" onClick={finishClose}>确认放弃</button></footer></section></div>}
    </section>
  </div>;
}

export function AddModelPage({ adapter, onCancel, onSaved }) {
  return <AddModelDialog adapter={adapter} onCancel={onCancel} onSaved={onSaved} mode="page" />;
}
