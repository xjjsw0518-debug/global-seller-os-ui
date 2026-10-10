import React, { useEffect, useRef, useState } from "react";
import { WarningCircle, X } from "@phosphor-icons/react";
import "./add-model-dialog.css";

const presentation = {
  NOT_CONFIGURED: { title: "未配置 · 未测试", className: "", icon: "i" },
  SUCCESS: { title: "连接测试成功", className: "is-success", icon: "✓" },
  ERROR: { title: "连接测试失败", className: "is-error", icon: "!" },
  PERMISSION_DENIED: { title: "权限拒绝", className: "is-permission", icon: "!" },
};

export default function ModelConnectionTestDialog({ model, adapter, onClose }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const busyRef = useRef(false);
  const close = () => { if (!busyRef.current) onClose(); };

  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === "Escape" && !busyRef.current) { event.preventDefault(); onClose(); } };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const run = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setResult({ state: "TESTING", mock: false });
    try {
      setResult(await adapter.testConnection({ id: model.id, provider: model.provider, modelId: model.model }));
    } catch {
      setResult({ state: "ERROR", code: "CONNECTION_TEST_ERROR", message: "连接测试请求失败，可重试。", mock: false });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const shown = result?.state === "TESTING" ? { title: "测试中", className: "", icon: "…" } : presentation[result?.state] || presentation.NOT_CONFIGURED;
  const message = result?.state === "TESTING" ? "正在通过隔离 staging 执行连接测试。" : result?.message || "尚未执行连接测试。结果由隔离 staging API 返回。";

  return <div className="add-model-backdrop connection-test-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section className="add-model-dialog connection-test-dialog" role="dialog" aria-modal="true" aria-labelledby="connection-test-title" aria-busy={busy} tabIndex={-1}>
      <header><div><span className="dialog-eyebrow">CONNECTION TEST · STAGING</span><h2 id="connection-test-title">模型连接测试</h2><p>通过隔离 staging 的已接受连接测试契约验证配置。</p></div><button type="button" className="dialog-close" aria-label="关闭连接测试" onClick={close} disabled={busy}><X size={18}/></button></header>
      <div className="dialog-notice"><WarningCircle size={17}/><span>连接测试结果由 staging 返回；不会显示或发送明文密钥。</span></div>
      <div className="connection-test-summary"><span>服务商</span><strong>{model.provider}</strong><span>模型</span><strong>{model.model}</strong><span>凭据状态</span><strong>未核实（不读取、不发送密钥）</strong></div>
      <div className={`connection-test-result ${shown.className}`} role={result?.state === "ERROR" || result?.state === "PERMISSION_DENIED" ? "alert" : "status"} aria-live="polite"><b>{shown.icon} {shown.title}</b>{message}{result?.code && <div>状态码：{result.code}</div>}</div>
      <footer className="connection-test-actions"><button type="button" onClick={close} disabled={busy}>关闭</button><button type="button" className="run-test" onClick={run} disabled={busy}>{busy && <span className="spinner" aria-hidden="true"/>}{busy ? "测试中" : "运行连接测试"}</button></footer>
    </section>
  </div>;
}


