const text = (value) => typeof value === "string" && value.trim() ? value.trim() : null;
const VALID_HEALTH = new Set(["HEALTHY", "DEGRADED", "UNHEALTHY"]);
const VALID_QUOTA = new Set(["AVAILABLE", "NEAR_LIMIT", "EXHAUSTED"]);
const safeCounts = Object.freeze({ policy: 0, router: 0, runtime: 0 });

/** Local-only preflight; reports readiness evidence but never applies proposals. */
export function validateRoutingAdviceCart(snapshot, validationFacts = {}) {
  const base = {
    source: "LOCAL_SYNTHETIC_FIXTURE",
    cartVersion: Number.isInteger(snapshot?.version) ? snapshot.version : null,
    readOnlyEffectiveConfig: true,
    effectiveConfigChanged: false,
    mutationCounters: safeCounts,
  };
  if (!snapshot || !Array.isArray(snapshot.items)) {
    return { ...base, status: "MOCK_BLOCKED", blockers: ["INVALID_CART"], warnings: [], items: [] };
  }
  if (snapshot.items.length === 0) {
    return { ...base, status: "MOCK_BLOCKED", blockers: ["EMPTY_CART"], warnings: [], items: [] };
  }

  const targetFields = new Map();
  const exactChanges = new Map();
  const pairIssues = snapshot.items.map(() => []);
  snapshot.items.forEach((item, index) => {
    const targetKey = text(item?.targetKey);
    const actionField = text(item?.actionField);
    const proposedValue = text(item?.proposedValue);
    if (!targetKey || !actionField || !proposedValue) return;
    const pair = `${targetKey}\u0000${actionField}`;
    const exact = `${pair}\u0000${proposedValue}`;
    if (exactChanges.has(exact)) {
      pairIssues[index].push("DUPLICATE_CHANGE");
      pairIssues[exactChanges.get(exact)].push("DUPLICATE_CHANGE");
    } else exactChanges.set(exact, index);
    if (targetFields.has(pair)) {
      const prior = targetFields.get(pair);
      if (snapshot.items[prior]?.proposedValue !== item.proposedValue) {
        pairIssues[index].push("CHANGE_CONFLICT");
        pairIssues[prior].push("CHANGE_CONFLICT");
      }
    } else targetFields.set(pair, index);
  });

  const projected = snapshot.items.map((item, index) => {
    const blockers = [...new Set(pairIssues[index])];
    const warnings = [];
    const required = (condition, code) => { if (!condition) blockers.push(code); };
    const facts = validationFacts && typeof validationFacts === "object" && !Array.isArray(validationFacts)
      && Object.prototype.hasOwnProperty.call(validationFacts, item?.recommendationId)
      ? validationFacts[item?.recommendationId]
      : null;

    required(Boolean(text(item?.changeId)), "CHANGE_ID_MISSING");
    required(Boolean(text(item?.recommendationId)), "RECOMMENDATION_ID_MISSING");
    required(Boolean(text(item?.targetKey)), "TARGET_MISSING");
    required(Boolean(text(item?.actionField)), "ACTION_FIELD_MISSING");
    required(Boolean(text(item?.currentValue)), "CURRENT_VALUE_UNKNOWN");
    required(Boolean(text(item?.proposedValue)), "PROPOSED_VALUE_MISSING");
    required(["HIGH", "MEDIUM", "LOW"].includes(item?.risk), "RISK_UNKNOWN");
    required(item?.eligible === true, item?.eligible === false ? "RECOMMENDATION_INELIGIBLE" : "ELIGIBILITY_UNKNOWN");
    required(typeof item?.connectionTestRequired === "boolean", "CONNECTION_TEST_REQUIREMENT_UNKNOWN");
    if (item?.connectionTestRequired === true) required(facts?.connectionTestPassed === true, "CONNECTION_TEST_REQUIRED");

    required(facts?.recommendationExists === true, facts?.recommendationExists === false ? "RECOMMENDATION_STALE_OR_MISSING" : "RECOMMENDATION_EXISTENCE_UNKNOWN");
    required(facts?.fingerprintFresh === true, facts?.fingerprintFresh === false ? "RECOMMENDATION_STALE" : "FINGERPRINT_FRESHNESS_UNKNOWN");
    required(facts?.targetEnabled === true, facts?.targetEnabled === false ? "TARGET_DISABLED" : "TARGET_ENABLED_UNKNOWN");

    if (item?.requiredCapability) required(facts?.capabilityEnabled === true, facts?.capabilityEnabled === false ? "CAPABILITY_MISSING" : "CAPABILITY_STATUS_UNKNOWN");
    if (!VALID_HEALTH.has(facts?.health)) blockers.push("HEALTH_UNKNOWN");
    else if (facts.health === "UNHEALTHY") blockers.push("TARGET_UNHEALTHY");
    else if (facts.health === "DEGRADED") warnings.push("TARGET_DEGRADED");
    if (!VALID_QUOTA.has(facts?.quota)) blockers.push("QUOTA_UNKNOWN");
    else if (facts.quota === "EXHAUSTED") blockers.push("QUOTA_EXHAUSTED");
    else if (facts.quota === "NEAR_LIMIT") warnings.push("QUOTA_NEAR_LIMIT");

    const uniqueBlockers = [...new Set(blockers)];
    return {
      changeId: text(item?.changeId) || `unknown-${index + 1}`,
      status: uniqueBlockers.length ? "BLOCKED" : warnings.length ? "WARNING" : "VALIDATED",
      blockers: uniqueBlockers,
      warnings: [...new Set(warnings)],
    };
  });

  const blockers = [...new Set(projected.flatMap((item) => item.blockers))];
  const warnings = [...new Set(projected.flatMap((item) => item.warnings))];
  return {
    ...base,
    cartVersion: Number.isInteger(snapshot.version) ? snapshot.version : null,
    status: blockers.length ? "MOCK_BLOCKED" : warnings.length ? "MOCK_WARNING" : "MOCK_VALIDATED",
    blockers,
    warnings,
    items: projected,
  };
}
