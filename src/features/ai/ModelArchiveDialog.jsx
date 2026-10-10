import React, { useEffect, useRef, useState } from "react";
import { Archive, ArrowCounterClockwise, WarningCircle, X } from "@phosphor-icons/react";
import "./add-model-dialog.css";
import "./model-archive-dialog.css";

const messageFor = (error, action) => error?.message || `${action}失败；当前记录未改变。可重试。`;

export default function ModelArchiveDialog({ mode, model, adapter, onClose, onArchived, onRestored }) {
  const [items, setItems] = useState([]);
  const [listState, setListState] = useState("loading");
  const [listError, setListError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const busyRef = useRef(false);
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const loadArchived = async () => {
    setListState("loading");
    setListError("");
    try {
      const result = await adapter.listArchived();
      setItems(result.items);
      setListState(result.items.length ? "ready" : "empty");
    } catch (error) {
      setListError(messageFor(error, "读取归档记录"));
      setListState(error?.code?.includes("PERMISSION") ? "permission" : "error");
    }
  };

  useEffect(() => {
    if (mode === "list") loadArchived();
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !busyRef.current) {
        event.preventDefault();
        onCloseRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    const frame = requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mode]);

  const archive = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setActionError("");
    try {
      await adapter.archive(model.id, model);
      await onArchived(model.id);
    } catch (error) {
      setActionError(messageFor(error, "归档"));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const restore = async (item) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setBusyId(item.id);
    setActionError("");
    try {
      await adapter.restore(item.id);
      setItems((current) => current.filter((candidate) => candidate.id !== item.id));
      setListState((current) => current === "ready" && items.length <= 1 ? "empty" : current);
      await onRestored(item.id);
    } catch (error) {
      setActionError(messageFor(error, "恢复"));
    } finally {
      busyRef.current = false;
      setBusy(false);
      setBusyId(null);
    }
  };

  return <div className="add-model-backdrop archive-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="add-model-dialog archive-dialog" role="dialog" aria-modal="true" aria-labelledby="archive-dialog-title" aria-busy={busy} tabIndex={-1} ref={dialogRef}>
      <header><div><span className="dialog-eyebrow">MODEL REGISTRY · SERVER</span><h2 id="archive-dialog-title">{mode === "confirm" ? "归档模型" : "归档记录"}</h2><p>{mode === "confirm" ? "此操作由隔离 staging API 执行，可通过归档记录恢复。" : "显示本次会话由服务端确认的归档记录。历史归档读取契约尚不可用。"}</p></div><button type="button" className="dialog-close" aria-label="关闭归档窗口" onClick={onClose} disabled={busy}><X size={18} /></button></header>
      <div className="dialog-notice"><WarningCircle size={17}/><span>仅允许操作隔离 AI staging 中符合条件的测试模型；生产数据不会被触及。</span></div>
      {mode === "confirm" ? <>
        <div className="archive-model-summary"><Archive size={18}/><div><b>{model?.model}</b><span>{model?.provider} · {model?.type}</span></div></div>
        {actionError && <div className="archive-error" role="alert">{actionError}</div>}
        <footer className="archive-actions"><button type="button" className="cancel-action" onClick={onClose} disabled={busy}>取消</button><button type="button" className="save-action archive-confirm" onClick={archive} disabled={busy}>{busy && <span className="spin" aria-hidden="true"/>}{busy ? "正在归档…" : "确认归档"}</button></footer>
      </> : <>
        <div className="archive-list" aria-live="polite">
          {listState === "loading" && <div className="archive-state"><span className="spinner"/><b>正在读取归档记录…</b></div>}
          {listState === "empty" && <div className="archive-state"><Archive size={25}/><b>暂无归档模型</b><span>服务端归档确认后，本次会话中的记录会显示在这里。</span></div>}
          {(listState === "error" || listState === "permission") && <div className="archive-state is-error" role="alert"><b>{listState === "permission" ? "没有读取权限" : "归档记录加载失败"}</b><span>{listError}</span><button type="button" className="cancel-action" onClick={loadArchived}>重试</button></div>}
          {listState === "ready" && items.map((item) => <article className="archived-model" key={item.id}><div><b>{item.model}</b><span>{item.provider} · {item.type}</span><small>归档于 {item.archivedAt || "服务端确认"}</small></div><button type="button" className="restore-action" onClick={() => restore(item)} disabled={busy}>{busyId === item.id ? <span className="spin"/> : <ArrowCounterClockwise size={14}/>}恢复</button></article>)}
        </div>
        {actionError && <div className="archive-error" role="alert">{actionError}</div>}
        <footer className="archive-actions"><button type="button" className="cancel-action" onClick={onClose} disabled={busy}>关闭</button></footer>
      </>}
    </section>
  </div>;
}




