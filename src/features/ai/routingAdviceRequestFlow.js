const ROUTING_ADVICE_ERROR_CODE = "ROUTING_ADVICE_REQUEST_FAILED";
const SAFE_CODE = /^[A-Z][A-Z0-9_]{1,79}$/;

function projectError(error) {
  const candidate = error && typeof error === "object" ? error.code : null;
  return { code: typeof candidate === "string" && SAFE_CODE.test(candidate) ? candidate : ROUTING_ADVICE_ERROR_CODE };
}

function snapshot(status, data = null, error = null) {
  return Object.freeze({ status, data, error });
}

/**
 * Local UI request-state seam for route-advice reanalysis.
 * An adapter is injected by the caller; this module never performs network I/O.
 */
export function createRoutingAdviceRequestFlow({ adapter = null, initialData = null } = {}) {
  const connected = Boolean(adapter && typeof adapter.reanalyze === "function");
  const listeners = new Set();
  let current = snapshot(connected ? "IDLE" : "NOT_CONNECTED", initialData);
  let generation = 0;
  let inFlight = false;

  const publish = (next) => {
    current = next;
    for (const listener of listeners) listener(current);
    return current;
  };

  return Object.freeze({
    getSnapshot: () => current,
    subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("listener must be a function");
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async reanalyze(filters = {}) {
      if (!connected) return { accepted: false, reason: "NOT_CONNECTED", snapshot: current };
      if (inFlight) return { accepted: false, reason: "IN_FLIGHT", snapshot: current };

      const requestGeneration = ++generation;
      inFlight = true;
      publish(snapshot("LOADING", current.data));
      try {
        const data = await adapter.reanalyze(filters);
        if (requestGeneration !== generation) return { accepted: false, stale: true, snapshot: current };
        publish(snapshot("SUCCESS", data));
        return { accepted: true, stale: false, snapshot: current };
      } catch (error) {
        if (requestGeneration !== generation) return { accepted: false, stale: true, snapshot: current };
        publish(snapshot("ERROR", current.data, projectError(error)));
        return { accepted: true, stale: false, snapshot: current };
      } finally {
        if (requestGeneration === generation) inFlight = false;
      }
    },
    invalidate() {
      generation += 1;
      inFlight = false;
      publish(snapshot(connected ? "IDLE" : "NOT_CONNECTED"));
    },
  });
}
