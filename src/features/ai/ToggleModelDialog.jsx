import React, { useRef, useState } from "react";
import "./toggle-model-dialog.css";

export default function ToggleModelDialog({ model, adapter, onClose, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const nextEnabled = !model.enabled;

  const confirm = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await adapter.setEnabled(model.id, nextEnabled);
      onSaved(result.item);
    } catch {
      setError("操作未保存，请检查后重试。");
      submitting.current = false;
      setBusy(false);
    }
  };

  return <div className="ai-toggle-model-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="ai-toggle-model-dialog" role="dialog" aria-modal="true" aria-labelledby="toggle-model-title" aria-busy={busy}>
      <div className="ai-toggle-model-heading"><span className="ai-toggle-model-mark">{nextEnabled ? "＋" : "−"}</span><div><h2 id="toggle-model-title">{nextEnabled ? "启用模型" : "停用模型"}</h2><p>确认通过隔离 staging 更新此模型状态</p></div></div>
      <div className="ai-toggle-model-summary"><span>模型</span><b>{model.model}</b><span>Provider</span><b>{model.provider}</b><span>当前状态</span><b>{model.enabled ? "已启用" : "已停用"}</b><span>操作后</span><b>{nextEnabled ? "已启用 · 待测试" : "已停用"}</b></div>
      <p className="ai-toggle-model-note">状态通过隔离 staging API 更新；启用要求此前连接测试成功。</p>
      {error && <div className="ai-toggle-model-error" role="alert">{error}</div>}
      <div className="ai-toggle-model-actions"><button type="button" className="ai-toggle-model-cancel" disabled={busy} onClick={onClose}>取消</button><button type="button" className="ai-toggle-model-confirm" disabled={busy} onClick={confirm}>{busy && <span className="ai-toggle-model-spinner" aria-hidden="true"/>}{busy ? "处理中…" : `确认${nextEnabled ? "启用" : "停用"}`}</button></div>
    </section>
  </div>;
}


