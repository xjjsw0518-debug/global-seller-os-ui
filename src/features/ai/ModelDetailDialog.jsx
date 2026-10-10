import React, { useEffect, useState } from "react";
import { ArrowsClockwise, CircleNotch, ShieldCheck, X } from "@phosphor-icons/react";
import "./model-detail-dialog.css";

const displayValue = (value, suffix = "") => value == null || value === "" ? "未知" : `${value}${suffix}`;
const money = (value) => value == null || !Number.isFinite(Number(value)) ? "未知" : `¥ ${Number(value).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ModelDetailDialog({ model, adapter, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const result = await adapter.getDetail(model.id);
      setDetail(result.item);
    } catch {
      setError(true);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [model.id]);
  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const used = detail?.used;
  const quota = detail?.quota;
  const rate = used == null || quota == null || Number(quota) <= 0 ? null : Number(used) / Number(quota);

  return <div className="ai-model-detail-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="ai-model-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-model-detail-title" aria-busy={loading}>
      <header className="ai-model-detail-header"><div><span className="ai-model-detail-eyebrow">MODEL RECORD · 服务端读取</span><h2 id="ai-model-detail-title">模型详情</h2><p>读取当前模型服务端配置投影</p></div><button type="button" className="ai-model-detail-close" aria-label="关闭详情" onClick={onClose}><X size={18}/></button></header>
      {loading ? <div className="ai-model-detail-state" role="status"><CircleNotch className="ai-model-detail-spinner" size={22}/><b>正在读取模型详情…</b><span>正在读取服务端模型配置</span></div>
        : error ? <div className="ai-model-detail-state ai-model-detail-error" role="alert"><b>暂时无法读取详情</b><span>读取失败，列表记录未修改。</span><button type="button" onClick={load}><ArrowsClockwise size={14}/>重试</button></div>
          : !detail ? <div className="ai-model-detail-state" role="status"><b>暂无详情记录</b><span>没有找到此模型的详情数据；列表内容保持不变。</span></div>
            : <>
              <div className="ai-model-detail-banner"><span className="ai-model-detail-brand">{detail.provider?.slice(0, 1) || "?"}</span><div><strong>{displayValue(detail.model)}</strong><span>{displayValue(detail.provider)} · {displayValue(detail.type)}</span></div><em className={detail.enabled ? "is-enabled" : "is-disabled"}>{detail.enabled ? "已启用" : "已停用"}</em></div>
              <div className="ai-model-detail-grid">
                <section><h3>模型配置</h3><dl><div><dt>预览记录 ID</dt><dd>{displayValue(detail.id)}</dd></div><div><dt>上下文</dt><dd>{displayValue(detail.context)}</dd></div><div><dt>路由优先级</dt><dd>{displayValue(detail.priority)}</dd></div><div><dt>列表状态</dt><dd>{displayValue(detail.status)}</dd></div><div><dt>更新时间</dt><dd>{displayValue(detail.updated)}</dd></div></dl></section>
                <section><h3>额度与凭据</h3><dl><div><dt>已用额度</dt><dd>{money(used)}</dd></div><div><dt>额度</dt><dd>{money(quota)}</dd></div><div><dt>使用率</dt><dd>{rate == null ? "未知" : `${Math.round(rate * 100)}%`}</dd></div><div><dt>密钥配置状态</dt><dd className="ai-model-detail-safe"><ShieldCheck size={14}/>未返回 · 详情不展示密钥</dd></div></dl><p>真实连接健康、Provider 凭据配置及后端额度/成本摘要未由当前列表契约提供。</p></section>
              </div>
              <div className="ai-model-detail-disclosure">此处只展示服务端配置投影；凭据内容不会返回到页面。</div>
            </>}
      <footer className="ai-model-detail-footer"><button type="button" onClick={onClose}>关闭</button></footer>
    </section>
  </div>;
}



