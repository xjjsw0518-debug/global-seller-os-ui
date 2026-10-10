const RISKS = ["HIGH", "MEDIUM", "LOW", "UNKNOWN"];
const text = (value) => typeof value === "string" && value.trim() ? value.trim() : null;

function itemError(code) {
  return { accepted: false, error: { code } };
}

/** Local-only proposal cart. Items are inert and never change effective routing. */
export function createRoutingAdviceChangeCart() {
  let version = 0;
  let nextId = 1;
  let items = [];

  const getSnapshot = () => {
    const riskCounts = Object.fromEntries(RISKS.map((risk) => [risk, items.filter((item) => item.risk === risk).length]));
    return Object.freeze({
      state: items.length ? "HAS_ITEMS" : "EMPTY",
      version,
      items: Object.freeze(items.map((item) => Object.freeze({ ...item }))),
      summary: Object.freeze({
        itemCount: items.length,
        riskCounts: Object.freeze(riskCounts),
        estimatedMonthlySavings: null,
        costStatus: "UNKNOWN",
      }),
      readOnlyEffectiveConfig: true,
      mutationCounters: Object.freeze({ policy: 0, router: 0, runtime: 0 }),
      source: "LOCAL_SYNTHETIC_FIXTURE",
    });
  };

  return Object.freeze({
    getSnapshot,
    add(proposal) {
      if (!proposal || typeof proposal !== "object" || Array.isArray(proposal)) return itemError("INVALID_CHANGE");
      const recommendationId = text(proposal.recommendationId);
      const targetKey = text(proposal.targetKey);
      const actionField = text(proposal.actionField);
      const proposedValue = text(proposal.proposedValue);
      const currentValue = text(proposal.currentValue);
      const risk = RISKS.includes(proposal.risk) ? proposal.risk : "UNKNOWN";
      if (!recommendationId || recommendationId.length > 160 || !targetKey || targetKey.length > 240
        || !actionField || actionField.length > 80 || !proposedValue || proposedValue.length > 160) {
        return itemError("INVALID_CHANGE");
      }

      const exact = items.some((item) => item.targetKey === targetKey && item.actionField === actionField && item.proposedValue === proposedValue);
      if (exact) return itemError("DUPLICATE_CHANGE");
      const conflicting = items.some((item) => item.targetKey === targetKey && item.actionField === actionField);
      if (conflicting) return itemError("CHANGE_CONFLICT");

      const item = Object.freeze({
        changeId: `mock-change-${nextId++}`,
        recommendationId,
        candidateFingerprint: text(proposal.candidateFingerprint),
        targetKey,
        actionField,
        currentValue,
        proposedValue,
        risk,
        eligible: typeof proposal.eligible === "boolean" ? proposal.eligible : null,
        requiredCapability: text(proposal.requiredCapability),
        connectionTestRequired: typeof proposal.connectionTestRequired === "boolean" ? proposal.connectionTestRequired : null,
        source: "LOCAL_SYNTHETIC_FIXTURE",
      });
      items = [...items, item];
      version += 1;
      return { accepted: true, item, snapshot: getSnapshot() };
    },
    remove(changeId) {
      const index = items.findIndex((item) => item.changeId === changeId);
      if (index < 0) return { removed: false, error: { code: "CHANGE_NOT_FOUND" }, snapshot: getSnapshot() };
      items = items.filter((item) => item.changeId !== changeId);
      version += 1;
      return { removed: true, snapshot: getSnapshot() };
    },
  });
}
