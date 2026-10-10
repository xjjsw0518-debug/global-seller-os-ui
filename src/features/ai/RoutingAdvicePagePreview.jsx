import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import RoutingAdvicePage from "./RoutingAdvicePage.jsx";
import { createRoutingAdvicePreviewAdapter } from "./routingAdvicePreviewAdapter.js";

const query = new URLSearchParams(location.search);
const delayMs = Math.max(0, Math.min(5000, Number(query.get("delayMs") || 450)));
const failureCall = Number(query.get("failCall") || 0);
const candidateFailureCall = Number(query.get("candidateTestFailCall") || 0);
const adapter = query.has("disconnected") ? null : createRoutingAdvicePreviewAdapter({ delayMs, failOnCalls: failureCall ? [failureCall] : [], candidateTestEnabled: query.has("mockCandidateTest"), failCandidateTestOnCalls: candidateFailureCall ? [candidateFailureCall] : [] });
const validationFacts = {
  'route-fixture-001': { recommendationExists: true, fingerprintFresh: true, targetEnabled: true, health: 'HEALTHY', quota: 'AVAILABLE', capabilityEnabled: true },
  'route-fixture-002': { recommendationExists: true, fingerprintFresh: true, targetEnabled: true, health: 'DEGRADED', quota: 'NEAR_LIMIT' },
};

function RoutingAdvicePagePreview() {
  const [mounted, setMounted] = useState(true);
  return <div className="routing-advice-preview-harness">
    <nav><b>LOCAL QA HARNESS</b><span>MOCK ONLY · no API calls</span><button type="button" onClick={() => setMounted((value) => !value)}>{mounted ? "离开此页" : "返回建议页"}</button><output data-testid="mock-call-count">mock calls: {adapter?.callCount || 0}</output></nav>
    {mounted ? <RoutingAdvicePage adapter={adapter} validationFacts={validationFacts} /> : <main>页面已离开；待处理结果不应更新此处状态。</main>}
  </div>;
}

window.__routingAdvicePreview = Object.freeze({ adapter, getCallCount: () => adapter?.callCount || 0, getCandidateTestCallCount: () => adapter?.candidateTestCallCount || 0 });
createRoot(document.getElementById("root")).render(<RoutingAdvicePagePreview />);
