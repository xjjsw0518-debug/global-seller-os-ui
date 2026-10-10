import React, { useState } from "react";
import { Trash, X } from "@phosphor-icons/react";
import "./model-archive-dialog.css";

export default function ModelDeleteDialog({ model, adapter, visualFixture, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      // Existing DELETE contract removes the registry entry; no archive UI is exposed.
      if (!visualFixture) await adapter.archive(model.id, model);
      await onDeleted(model.id);
    } catch {
      setError("删除失败，请稍后重试。");
      setBusy(false);
    }
  }
  return <div className="add-model-backdrop archive-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="add-model-dialog archive-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-model-title" onKeyDown={(event) => { if (event.key === "Escape" && !busy) onClose(); }}>
      <header><div><h2 id="delete-model-title">删除模型</h2><p>确认删除此模型？删除后将从模型列表移除。</p></div><button type="button" className="dialog-close" aria-label="关闭删除窗口" onClick={onClose} disabled={busy}><X size={18}/></button></header>
      <div className="archive-model-summary"><Trash size={20}/><div><b>{model.model}</b><span>{model.provider} · {model.type}</span></div></div>
      {error && <p role="alert">{error}</p>}
      <footer className="archive-actions"><button className="cancel-action" onClick={onClose} disabled={busy}>取消</button><button className="save-action archive-confirm" onClick={remove} disabled={busy}>{busy ? "正在删除…" : "确认删除"}</button></footer>
    </section>
  </div>;
}
