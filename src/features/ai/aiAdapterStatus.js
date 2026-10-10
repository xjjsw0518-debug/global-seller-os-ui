const valueOf = (v) => String(v ?? "").trim().toUpperCase();

/** Map adapter failures to safe UI copy without echoing server/provider text. */
export function presentAiAdapterFailure(error) {
  const code = valueOf(error?.code || error?.errorCode || error?.state);
  const status = Number(error?.status ?? error?.statusCode ?? 0);
  const mock = error?.mock === true || code.startsWith("MOCK_");
  let state = "UNKNOWN_FAILURE";
  let retryable = false;
  if (code === "AI_LOGO_ASSET_API_NOT_CONNECTED" || code === "API_NOT_CONNECTED") state = "NOT_CONNECTED";
  else if (/CREDENTIAL_EXPIRED|TOKEN_EXPIRED|API_KEY_EXPIRED/.test(code)) state = "CREDENTIAL_EXPIRED";
  else if (status === 401 || /UNAUTHORIZED|AUTH_REQUIRED/.test(code)) state = "AUTH_REQUIRED";
  else if (status === 403 || /FORBIDDEN|PERMISSION_DENIED/.test(code)) state = "PERMISSION_DENIED";
  else if (status === 408 || status === 504 || /TIMEOUT|TIMED_OUT|ETIMEDOUT|ECONNABORTED/.test(code) || valueOf(error?.name) === "TIMEOUTERROR") { state = "NETWORK_TIMEOUT"; retryable = true; }
  else if (/NETWORK|ENETUNREACH|ECONNREFUSED|ERR_NETWORK/.test(code) || valueOf(error?.name) === "NETWORKERROR") { state = "NETWORK_UNAVAILABLE"; retryable = true; }
  else if (status >= 500 || /SERVICE_UNAVAILABLE|SERVICE_FAILURE|SERVER_ERROR|INTERNAL_ERROR/.test(code)) { state = "SERVICE_FAILURE"; retryable = true; }
  else if (code.startsWith("MOCK_") && /SAVE|CREATE|UPDATE|LIST|CONNECTION|TEST/.test(code)) state = "MOCK_OPERATION_FAILURE";

  const copy = {
    NOT_CONNECTED: "The server adapter is not connected; no server save was confirmed.",
    CREDENTIAL_EXPIRED: "The adapter reported an expired credential; its value was not read or displayed.",
    AUTH_REQUIRED: "The adapter reported that authentication is required; no sign-in state was verified here.",
    PERMISSION_DENIED: "The adapter reported insufficient permission; no role or permission was changed.",
    NETWORK_TIMEOUT: "The request timed out; completion is unconfirmed. Retry only after checking the current state.",
    NETWORK_UNAVAILABLE: "The network request could not be confirmed; the saved state is unknown.",
    SERVICE_FAILURE: "The service reported a failure; the saved state is unconfirmed.",
    MOCK_OPERATION_FAILURE: "The local mock simulated an operation failure; no server operation occurred.",
    UNKNOWN_FAILURE: "The operation failed with an unclassified adapter error; the resulting state is unconfirmed.",
  };
  return {
    state,
    code: code || "UNCLASSIFIED_ADAPTER_ERROR",
    status: Number.isFinite(status) && status > 0 ? status : null,
    retryable,
    source: mock ? "LOCAL_MOCK" : "ADAPTER_RESPONSE_UNVERIFIED",
    productionVerified: false,
    message: `${mock ? "Local mock: " : "Adapter response: "}${copy[state]}`,
  };
}

/** Null/invalid quota and cost stay unknown; never coerce them to zero. */
export function presentUnknownAmount(value) {
  if (value == null || value === "") return { known: false, value: null, label: "UNKNOWN" };
  const number = Number(value);
  if (!Number.isFinite(number)) return { known: false, value: null, label: "UNKNOWN" };
  return { known: true, value: number, label: String(number) };
}
