const SUCCESS_STATES = new Set(["draft", "enabled"]);
const AREAS = new Set(["capabilities", "quota", "routing"]);
const CONNECTION_STATES = new Set(["idle", "testing", "success", "failure", "timeout", "auth", "rate-limit"]);

export function parseAddModelFixtureParams(search = "") {
  const query = search instanceof URLSearchParams ? search : new URLSearchParams(String(search || ""));
  const requestedStep = Number(query.get("aiVisualStep"));
  const requestedArea = query.get("aiVisualArea");
  const requestedSuccess = query.get("aiVisualSuccess");
  const requestedConnectionState = String(query.get("aiVisualConnectionState") || "").toLowerCase();
  return Object.freeze({
    step: [1, 2, 3].includes(requestedStep) ? requestedStep : 1,
    area: AREAS.has(requestedArea) ? requestedArea : "capabilities",
    success: SUCCESS_STATES.has(requestedSuccess) ? requestedSuccess : null,
    connectionState: CONNECTION_STATES.has(requestedConnectionState) ? requestedConnectionState : null,
  });
}

export function createAddModelFixtureSuccessRecord(visualFixture, success) {
  if (!visualFixture || !SUCCESS_STATES.has(success)) return null;
  const enabled = success === "enabled";
  return {
    enabled,
    dbReadback: false,
    model: {
      id: "visual-fixture-gpt5",
      enabled,
      model: {
        display_name: visualFixture.displayName,
        model_vendor: visualFixture.vendorId,
        model_id: visualFixture.modelId,
        capabilities: [...visualFixture.capabilities],
      },
      quota_settings: { monthly_quota: visualFixture.quota.monthlyQuota },
      routing_strategy: { cost_strategy: "BALANCED", route_priority: 1 },
      connection: { access_provider_id: visualFixture.accessProvider },
    },
  };
}

export function projectAddModelResultState(savedRecord, connectionHealth = "UNTESTED") {
  const saved = savedRecord?.model || {};
  const recordEnabled = savedRecord?.enabled === true;
  const readbackEnabled = saved?.enabled === true;
  const enabled = recordEnabled && readbackEnabled;
  const savedRoute = saved.routing_strategy || {};
  return Object.freeze({
    enabled,
    stateConsistent: recordEnabled === readbackEnabled,
    connectionStatus: enabled ? "READY" : connectionHealth,
    routingActive: enabled,
    routeSummary: enabled ? (savedRoute.cost_strategy || "FIXED_MODEL") : "草稿 · 未参与路由",
  });
}

export function projectAddModelPreviewState({ step = 1, hasSavedModel = false, savedEnabled = false, connectionHealth = "UNTESTED" } = {}) {
  const normalizedStep = [1, 2, 3].includes(Number(step)) ? Number(step) : 1;
  const enabled = hasSavedModel && savedEnabled === true;
  return Object.freeze({
    step: normalizedStep,
    enabled,
    connectionStatus: enabled ? "READY" : connectionHealth,
    routingActive: enabled,
  });
}
