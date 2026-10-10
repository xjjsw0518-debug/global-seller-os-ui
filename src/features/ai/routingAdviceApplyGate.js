const PREVIEWABLE = new Set(["MOCK_VALIDATED", "MOCK_WARNING"]);
const zeroMutations = Object.freeze({ policy: 0, router: 0, runtime: 0 });

/** UI-only safety gate. No apply or rollback transport exists in this module. */
export function getRoutingAdviceActionAvailability(cart, preflight) {
  const previewOnlyEnabled = Boolean(
    cart && Array.isArray(cart.items) && cart.items.length > 0
    && Number.isInteger(cart.version)
    && preflight && preflight.cartVersion === cart.version
    && PREVIEWABLE.has(preflight.status)
    && Array.isArray(preflight.blockers) && preflight.blockers.length === 0
  );
  return Object.freeze({
    previewOnlyEnabled,
    apply: Object.freeze({ enabled: false, state: "NOT_CONNECTED" }),
    rollback: Object.freeze({ enabled: false, state: "SNAPSHOT_UNKNOWN" }),
    effectiveRouteVersion: "UNKNOWN",
  });
}

/** Creates a transient UI receipt for reviewing a proposal; never a version/apply record. */
export function createRoutingAdvicePreviewOnlyReceipt(cart, preflight, confirmedAt = Date.now()) {
  const availability = getRoutingAdviceActionAvailability(cart, preflight);
  if (!availability.previewOnlyEnabled || !Number.isFinite(confirmedAt)) return null;
  return Object.freeze({
    scope: "PREVIEW_ONLY",
    source: "LOCAL_SYNTHETIC_FIXTURE",
    cartVersion: cart.version,
    itemCount: cart.items.length,
    confirmedAt,
    effectiveRouteVersion: "UNKNOWN",
    effectiveConfigChanged: false,
    mutationCounters: zeroMutations,
  });
}
