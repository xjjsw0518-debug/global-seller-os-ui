import React, { useEffect, useRef, useState } from "react";
import { ArrowsClockwise, CircleNotch, WarningCircle, X } from "@phosphor-icons/react";
import { presentAiAdapterFailure } from "./aiAdapterStatus.js";
import "./add-model-dialog.css";
import "./edit-model-dialog.css";

const toInitial = (model, configuration) => ({
  modelId: configuration?.model?.model_id ?? model.modelId ?? "",
  displayName: configuration?.model?.display_name ?? model.model ?? "",
  quota: configuration?.quota_settings?.monthly_quota == null ? "" : String(configuration.quota_settings.monthly_quota),
  priority: configuration?.routing_strategy?.route_priority == null ? "" : String(configuration.routing_strategy.route_priority),
});

export default function EditModelDialog({ model, availableModels = [], adapter, onClose, onSaved }) {
  const [form, setForm] = useState(() => toInitial(model));
  const [detailsReady, setDetailsReady] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [detailsError, setDetailsError] = useState("");
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const submitting = useRef(false);
  const detailRequest = useRef(0);

  const loadDetails = async () => {
    const requestId = ++detailRequest.current;
    setDetailsLoading(true);
    setDetailsError("");
    try {
      const result = await adapter.getDetail(model.id);
      if (requestId !== detailRequest.current) return;
      if (!result?.item?.configuration) throw new Error("服务端未返回可编辑的模型配置。");
      setForm(toInitial(model, result.item.configuration));
      setDetailsReady(true);
    } catch (error) {
      if (requestId !== detailRequest.current) return;
      setDetailsReady(false);
      setDetailsError(`${error?.message || "读取模型配置失败。"} 请重试后再编辑。`);
    } finally {
      if (requestId === detailRequest.current) setDetailsLoading(false);
    }
  };
  useEffect(() => { void loadDetails(); return () => { detailRequest.current++; }; }, [model.id]);

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
    setSaveError("");
  };
  const validate = () => {
    const next = {};
    if (!form.modelId.trim()) next.modelId = "请输入模型 ID。";
    else if (form.modelId.trim().length > 120) next.modelId = "模型 ID 最多 120 个字符。";
    if (!form.displayName.trim()) next.displayName = "请输入显示名称。";
    else if (form.displayName.trim().length > 160) next.displayName = "显示名称最多 160 个字符。";
    if (form.quota !== "" && (!Number.isFinite(Number(form.quota)) || Number(form.quota) < 0)) next.quota = "额度必须是非负数字或留空表示未知。";
    if (form.priority !== "" && (!Number.isInteger(Number(form.priority)) || Number(form.priority) < 0)) next.priority = "优先级必须为非负整数或留空表示未知。";
    const duplicate = availableModels.some((item) => item.id !== model.id
      && item.provider === model.provider
      && (item.modelId || item.model).trim().toLocaleLowerCase() === form.modelId.trim().toLocaleLowerCase());
    if (!next.modelId && duplicate) next.modelId = "同一 Provider 下已存在此模型 ID。";
    setErrors(next);
    return Object.keys(next).length === 0;
  };
  const submit = async (event) => {
    event.preventDefault();
    if (submitting.current || !validate()) return;
    submitting.current = true;
    setBusy(true);
    setSaveError("");
    try {
      const result = await adapter.update(model.id, {
        modelId: form.modelId.trim(),
        displayName: form.displayName.trim(),
        quota: form.quota,
        priority: form.priority,
      });
      await onSaved(result.item);
    } catch (error) {
      const failure = presentAiAdapterFailure(error);
      setSaveError(`${failure.message} 修改仍保留，可重试或取消。`);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  const close = () => { if (!submitting.current) onClose(); };
  return <div className="add-model-backdrop edit-model-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section className="add-model-dialog edit-model-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-model-title" aria-busy={busy}>
      <header><div><span className="dialog-eyebrow">模型注册 · 配置编辑</span><h2 id="edit-model-title">编辑模型</h2><p>修改模型名称、额度与路由优先级。</p></div><button type="button" className="dialog-close" aria-label="关闭编辑模型" onClick={close} disabled={busy}><X size={18} /></button></header>
      <div className="dialog-notice"><WarningCircle size={17} /> 凭据由中央密钥库保管；此窗口不读取、不显示或修改 API 密钥。</div>
      <div className="edit-model-current-status"><span>当前模型</span><b>{model.model || "未知模型"}</b><i>{model.provider || "服务商未知"}</i><i>{model.type || "类型未知"}</i><i>上下文 {model.context || "未知"}</i></div>
      {detailsError && <div className="edit-model-feedback" role="alert">{detailsError}<button type="button" onClick={() => void loadDetails()} disabled={detailsLoading}><ArrowsClockwise size={14}/> 重试读取</button></div>}
      <form onSubmit={submit} noValidate>
        <div className="edit-model-grid">
          <label className="field"><span>模型 ID <b>*</b></span><input aria-label="编辑模型 ID" value={form.modelId} maxLength={120} onChange={(e) => update("modelId", e.target.value)} disabled={busy || detailsLoading || !detailsReady} aria-invalid={Boolean(errors.modelId)} />{errors.modelId && <small className="field-error">{errors.modelId}</small>}</label>
          <label className="field"><span>显示名称 <b>*</b></span><input aria-label="编辑显示名称" value={form.displayName} maxLength={160} onChange={(e) => update("displayName", e.target.value)} disabled={busy || detailsLoading || !detailsReady} aria-invalid={Boolean(errors.displayName)} />{errors.displayName && <small className="field-error">{errors.displayName}</small>}</label>
          <label className="field"><span>月额度（{model.currency || "币种未知"}）</span><input aria-label="编辑模型月额度" inputMode="decimal" type="number" min="0" step="0.01" value={form.quota} onChange={(e) => update("quota", e.target.value)} disabled={busy || detailsLoading || !detailsReady} aria-invalid={Boolean(errors.quota)} />{errors.quota && <small className="field-error">{errors.quota}</small>}<small>留空表示未知。</small></label>
          <label className="field"><span>路由优先级</span><input aria-label="编辑路由优先级" inputMode="numeric" type="number" min="0" step="1" value={form.priority} onChange={(e) => update("priority", e.target.value)} disabled={busy || detailsLoading || !detailsReady} aria-invalid={Boolean(errors.priority)} />{errors.priority && <small className="field-error">{errors.priority}</small>}<small>留空表示未知。</small></label>
        </div>
        <p className="edit-model-connect-note">{detailsLoading ? "正在读取服务端配置…" : `连接状态：${model.status || "未知"} · 保存编辑不会执行连接测试或更改启停状态。`}</p>
        <div className="edit-model-feedback" role={saveError ? "alert" : "status"} aria-live="polite">{busy ? <><CircleNotch className="spin" size={14} /> 正在保存模型配置…</> : saveError}</div>
        <footer><button type="button" className="cancel-action" onClick={close} disabled={busy}>取消</button><span className="footer-spacer"/><button type="submit" className="save-action" disabled={busy || detailsLoading || !detailsReady}>{busy ? "保存中…" : "保存修改"}</button></footer>
      </form>
    </section>
  </div>;
}


