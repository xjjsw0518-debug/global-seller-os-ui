import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const jsx = readFileSync(new URL("./RoutingAdvicePage.jsx", import.meta.url), "utf8");
const css = readFileSync(new URL("./routing-advice-page.css", import.meta.url), "utf8");

test("A34 keeps category beside detail title and avoids an extra risk row", () => {
  const headerStart = jsx.indexOf('className="routing-advice__detail-header"');
  const contentStart = jsx.indexOf('className="routing-advice__detail-content"');
  const header = jsx.slice(headerStart, contentStart);
  assert.ok(header.includes('id="routing-advice-detail-title"'));
  assert.ok(header.includes('className="routing-advice__detail-type"'));
  assert.ok(header.includes('selected.category || "UNKNOWN"'));
  assert.ok(!header.includes("routing-advice__risk-pill"));
  assert.ok(!jsx.includes('className="routing-advice__detail-risk"'));
  assert.ok(jsx.includes('riskLabels[item.risk]'));
  assert.ok(jsx.includes('className="routing-advice__detail-problem"'));
  assert.ok(jsx.includes('className="routing-advice__route-recommendation"'));
});

test("A34 route cards show model and side-specific unknown share without worker/runtime rows", () => {
  const routeStart = jsx.indexOf('data-testid="advice-route-comparison"');
  const effectsStart = jsx.indexOf('data-testid="advice-estimated-effects"');
  const route = jsx.slice(routeStart, effectsStart);
  assert.equal((route.match(/className="routing-advice__traffic-share"/g) || []).length, 2);
  assert.ok(route.includes("当前流量占比"));
  assert.ok(route.includes("建议流量占比"));
  assert.ok(route.includes("当前模型"));
  assert.ok(route.includes("目标模型"));
  assert.ok(route.includes('selected.current.trafficShare ?? "UNKNOWN"'));
  assert.ok(route.includes('selected.recommended.trafficShare ?? "UNKNOWN"'));
  assert.ok(!route.includes("selected.current.worker"));
  assert.ok(!route.includes("selected.current.runtime"));
  assert.ok(jsx.includes('data-testid="advice-config-comparison"'));
});

test("A34 effect cards use exact cost, success, latency order and preserve unknown values", () => {
  const cost = jsx.indexOf('["预计节省成本", "UNKNOWN"]');
  const success = jsx.indexOf('["预计成功率", "UNKNOWN"]');
  const latency = jsx.indexOf('["预计延迟变化", "UNKNOWN"]');
  assert.ok(cost >= 0 && cost < success && success < latency);
  assert.ok(css.includes("grid-template-columns:minmax(0,1.44fr) minmax(0,1fr) minmax(0,1fr)"));
  assert.ok(css.includes(".routing-advice__drawer>.routing-advice__detail-header>button{width:32px;height:32px"));
  assert.ok(css.includes(".routing-advice__drawer>.routing-advice__detail-header>button:focus-visible{outline:2px"));
});

test("A34 keeps configuration and candidate tools behind explicit local test mode", () => {
  assert.ok(jsx.includes('get("routingAdviceTestMode") === "1"'));
  assert.ok(jsx.includes('isRoutingAdviceTestMode && <section className="routing-advice__test-mode"'));
  assert.ok(jsx.includes('data-testid="advice-full-config"'));
  assert.ok(jsx.includes('data-testid="candidate-connection-test"'));
  assert.ok(jsx.includes('data-testid="advice-detail-cancel"'));
  assert.ok(jsx.includes('data-testid="advice-detail-apply"'));
  assert.ok(jsx.includes('disabled aria-disabled="true"'));
});

test("A34 detail scrolls content, anchors actions, and adapts at narrow widths", () => {
  assert.ok(css.includes('.routing-advice__drawer{display:flex;flex-direction:column'));
  assert.ok(css.includes('.routing-advice__detail-content{flex:1;min-height:0;overflow:auto'));
  assert.ok(css.includes('.routing-advice__detail-actions{display:flex;flex:none'));
  assert.ok(css.includes('@media(max-width:520px)'));
  assert.ok(css.includes('.routing-advice__route-compare{grid-template-columns:1fr}'));
});
