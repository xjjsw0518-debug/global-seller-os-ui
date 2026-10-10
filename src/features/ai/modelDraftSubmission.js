/** Synchronous duplicate-submit gate for async draft saves. */
export function createModelDraftSubmissionGate() {
  let inFlight = false;
  return Object.freeze({
    get inFlight() { return inFlight; },
    acquire() {
      if (inFlight) return false;
      inFlight = true;
      return true;
    },
    release() { inFlight = false; },
  });
}
