const SAFE_CODE = /^[A-Z][A-Z0-9_]{1,79}$/;
const DEFAULT_VALIDITY_MS = 30_000;
const text = (value) => typeof value === "string" && value.trim() ? value.trim() : null;

export function routingAdviceCandidateFingerprint(candidate) {
  if (!candidate || typeof candidate !== "object") return null;
  const fields = ["recommendationId", "targetKey", "actionField", "currentValue", "proposedValue"];
  const values = fields.map((field) => text(candidate[field]));
  if (values.some((value) => !value)) return null;
  values.push(text(candidate.targetProvider) || "", text(candidate.targetModel) || "", text(candidate.currentConfigFingerprint) || "", text(candidate.proposedConfigFingerprint) || "");
  values.push(text(candidate.risk) || "UNKNOWN", candidate.eligible === true ? "eligible" : candidate.eligible === false ? "ineligible" : "eligibility-unknown", text(candidate.requiredCapability) || "", candidate.connectionTestRequired === true ? "required" : "optional");
  return JSON.stringify(values);
}

function safeErrorCode(error) {
  const code = error && typeof error === "object" ? error.code : null;
  return typeof code === "string" && SAFE_CODE.test(code) ? code : "CANDIDATE_CONNECTION_TEST_FAILED";
}

/** Candidate-scoped, injected-only request flow. It has no network behavior. */
export function createRoutingAdviceCandidateTestFlow({ adapter = null, clock = () => Date.now(), maxValidityMs = DEFAULT_VALIDITY_MS } = {}) {
  const connected = Boolean(adapter && typeof adapter.testCandidateConnection === "function");
  const validityCap = Number.isFinite(maxValidityMs) && maxValidityMs > 0 ? maxValidityMs : DEFAULT_VALIDITY_MS;
  const listeners = new Set();
  let candidateFingerprint = null;
  let current = Object.freeze({ status: connected ? "NOT_TESTED" : "NOT_CONNECTED", candidateFingerprint: null, result: null, error: null });
  let generation = 0;
  let inFlight = false;
  let expiryTimer = null;
  const evidenceByCandidate = new Map();
  const latestFingerprintByRecommendation = new Map();

  const publish = (next) => {
    current = Object.freeze(next);
    for (const listener of listeners) listener();
    return current;
  };
  const clearTimer = () => {
    if (expiryTimer !== null) clearTimeout(expiryTimer);
    expiryTimer = null;
  };
  const resetFor = (fingerprint, recommendationId = null) => {
    if (fingerprint === candidateFingerprint) return current;
    if (recommendationId) {
      const previousFingerprint = latestFingerprintByRecommendation.get(recommendationId);
      if (previousFingerprint && previousFingerprint !== fingerprint) {
        for (const [knownFingerprint, evidence] of evidenceByCandidate) {
          if (evidence.recommendationId === recommendationId) evidenceByCandidate.delete(knownFingerprint);
        }
      }
      latestFingerprintByRecommendation.set(recommendationId, fingerprint);
    }
    generation += 1;
    inFlight = false;
    clearTimer();
    candidateFingerprint = fingerprint;
    const cached = fingerprint ? evidenceByCandidate.get(fingerprint) : null;
    if (cached && cached.validUntil > clock()) {
      const next = publish({ status: "SUCCESS", candidateFingerprint: fingerprint, result: cached, error: null });
      expiryTimer = setTimeout(() => {
        if (candidateFingerprint !== fingerprint || current.status !== "SUCCESS" || current.result?.validUntil !== cached.validUntil) return;
        evidenceByCandidate.delete(fingerprint);
        publish({ status: "EXPIRED", candidateFingerprint: fingerprint, result: null, error: { code: "TEST_EVIDENCE_EXPIRED" } });
      }, Math.max(0, cached.validUntil - clock()));
      return next;
    }
    if (cached) evidenceByCandidate.delete(fingerprint);
    return publish({ status: connected ? (fingerprint ? (cached ? "EXPIRED" : "NOT_TESTED") : "NO_CANDIDATE") : "NOT_CONNECTED", candidateFingerprint: fingerprint, result: null, error: cached ? { code: "TEST_EVIDENCE_EXPIRED" } : null });
  };

  return Object.freeze({
    getSnapshot: () => current,
    subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("listener must be a function");
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    select(candidate) {
      return resetFor(routingAdviceCandidateFingerprint(candidate), text(candidate?.recommendationId));
    },
    getEvidence(fingerprint) {
      const evidence = evidenceByCandidate.get(fingerprint);
      if (!evidence) return null;
      const now = clock();
      if (!Number.isFinite(now) || !Number.isFinite(evidence.validUntil) || evidence.validUntil <= now) {
        evidenceByCandidate.delete(fingerprint);
        if (candidateFingerprint === fingerprint && current.status === "SUCCESS") {
          clearTimer();
          publish({ status: "EXPIRED", candidateFingerprint: fingerprint, result: null, error: { code: "TEST_EVIDENCE_EXPIRED" } });
        }
        return null;
      }
      return evidence;
    },
    async run(candidate) {
      if (!connected) return { accepted: false, reason: "NOT_CONNECTED", snapshot: current };
      const fingerprint = routingAdviceCandidateFingerprint(candidate);
      if (!fingerprint) return { accepted: false, reason: "INVALID_CANDIDATE", snapshot: current };
      resetFor(fingerprint, text(candidate.recommendationId));
      if (inFlight) return { accepted: false, reason: "IN_FLIGHT", snapshot: current };
      evidenceByCandidate.delete(fingerprint);
      const requestGeneration = ++generation;
      inFlight = true;
      const request = Object.freeze({
        recommendationId: text(candidate.recommendationId),
        candidateFingerprint: fingerprint,
        targetKey: text(candidate.targetKey),
        actionField: text(candidate.actionField),
        currentValue: text(candidate.currentValue),
        proposedValue: text(candidate.proposedValue),
        targetProvider: text(candidate.targetProvider),
        targetModel: text(candidate.targetModel),
        currentConfigFingerprint: text(candidate.currentConfigFingerprint),
        proposedConfigFingerprint: text(candidate.proposedConfigFingerprint),
        risk: text(candidate.risk) || "UNKNOWN",
        requiredCapability: text(candidate.requiredCapability),
        connectionTestRequired: candidate.connectionTestRequired === true,
        source: "LOCAL_SYNTHETIC_FIXTURE",
      });
      publish({ status: "LOADING", candidateFingerprint: fingerprint, result: null, error: null });
      try {
        const outcome = await adapter.testCandidateConnection(request);
        if (requestGeneration !== generation) return { accepted: false, stale: true, snapshot: current };
        if (outcome?.candidateFingerprint !== fingerprint) {
          publish({ status: "ERROR", candidateFingerprint: fingerprint, result: null, error: { code: "CANDIDATE_FINGERPRINT_MISMATCH" } });
          return { accepted: true, snapshot: current };
        }
        if (outcome?.status !== "SUCCESS") {
          const code = typeof outcome?.errorCode === "string" && SAFE_CODE.test(outcome.errorCode) ? outcome.errorCode : "CANDIDATE_CONNECTION_TEST_FAILED";
          publish({ status: "FAILURE", candidateFingerprint: fingerprint, result: null, error: { code } });
          return { accepted: true, snapshot: current };
        }
        const validForMs = outcome?.validForMs;
        if (!Number.isFinite(validForMs) || validForMs <= 0 || validForMs > validityCap) {
          publish({ status: "ERROR", candidateFingerprint: fingerprint, result: null, error: { code: "TEST_FRESHNESS_UNKNOWN" } });
          return { accepted: true, snapshot: current };
        }
        const testedAt = clock();
        const validUntil = testedAt + validForMs;
        if (!Number.isFinite(testedAt) || !Number.isFinite(validUntil) || validUntil <= testedAt) {
          publish({ status: "ERROR", candidateFingerprint: fingerprint, result: null, error: { code: "TEST_FRESHNESS_UNKNOWN" } });
          return { accepted: true, snapshot: current };
        }
        const result = Object.freeze({ status: "SUCCESS", recommendationId: text(candidate.recommendationId), candidateFingerprint: fingerprint, testedAt, validUntil, validitySource: "EXPLICIT_MOCK_WINDOW", source: "LOCAL_SYNTHETIC_FIXTURE" });
        evidenceByCandidate.set(fingerprint, result);
        publish({ status: "SUCCESS", candidateFingerprint: fingerprint, result, error: null });
        clearTimer();
        expiryTimer = setTimeout(() => {
          if (candidateFingerprint !== fingerprint || current.status !== "SUCCESS" || current.result?.validUntil !== result.validUntil) return;
          evidenceByCandidate.delete(fingerprint);
          publish({ status: "EXPIRED", candidateFingerprint: fingerprint, result: null, error: { code: "TEST_EVIDENCE_EXPIRED" } });
        }, Math.max(0, result.validUntil - clock()));
        return { accepted: true, snapshot: current };
      } catch (error) {
        if (requestGeneration !== generation) return { accepted: false, stale: true, snapshot: current };
        publish({ status: "FAILURE", candidateFingerprint: fingerprint, result: null, error: { code: safeErrorCode(error) } });
        return { accepted: true, snapshot: current };
      } finally {
        if (requestGeneration === generation) inFlight = false;
      }
    },
    invalidate() {
      generation += 1;
      inFlight = false;
      clearTimer();
      evidenceByCandidate.clear();
      latestFingerprintByRecommendation.clear();
      candidateFingerprint = null;
      publish({ status: connected ? "NOT_TESTED" : "NOT_CONNECTED", candidateFingerprint: null, result: null, error: null });
    },
  });
}
