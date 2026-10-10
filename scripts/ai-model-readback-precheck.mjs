const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const AI_READBACK_PARAMETERS = Object.freeze(["provider_id", "model_id"]);

export const AI_READBACK_QUERY_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "provider_identity",
    tableKey: "providerModelProjection",
    columns: Object.freeze(["provider_id", "model_id", "provider_display_name", "provider_type", "provider_enabled", "credential_configured", "updated_at"]),
  }),
  Object.freeze({
    id: "model_registry",
    tableKey: "modelRegistry",
    columns: Object.freeze(["model_registry_id", "provider_id", "model_id", "display_name", "model_vendor", "model_identity_type", "enabled", "updated_at"]),
  }),
  Object.freeze({
    id: "connection_metadata",
    tableKey: "modelConnection",
    columns: Object.freeze(["provider_id", "model_id", "endpoint_mode", "connection_type", "auth_type", "deployment_type", "region", "health_status", "updated_at"]),
  }),
  Object.freeze({
    id: "quota_budget",
    tableKey: "modelQuota",
    columns: Object.freeze(["provider_id", "model_id", "rpm", "tpm", "rpd", "monthly_quota", "monthly_budget", "monthly_cost_limit", "free_quota", "warning_threshold_percent", "updated_at"]),
  }),
  Object.freeze({
    id: "cost_currency",
    tableKey: "modelCost",
    columns: Object.freeze(["provider_id", "model_id", "input_cost", "output_cost", "currency", "cost_source", "updated_at"]),
  }),
  Object.freeze({
    id: "routing",
    tableKey: "modelRouting",
    columns: Object.freeze(["provider_id", "model_id", "route_priority", "route_weight", "fallback_model_id", "cost_strategy", "health_threshold", "auto_routing", "updated_at"]),
  }),
  Object.freeze({
    id: "capability_evidence",
    tableKey: "modelCapability",
    columns: Object.freeze(["provider_id", "model_id", "capability_code", "verification_status", "evidence_source", "verification_method", "updated_at"]),
  }),
]);

export const AI_READBACK_OUTPUT_SCHEMA = Object.freeze({
  provider_id: "string:redacted",
  model_id: "string:redacted",
  query_id: "string",
  row_count: "integer",
  state: "READY|NOT_AVAILABLE|DUPLICATE|BLOCKED",
  fields: "object:non-sensitive-only",
  sensitive_fields_removed: true,
});

export const AI_READBACK_STOP_CONDITIONS = Object.freeze([
  "DB_DIALECT_UNSUPPORTED_OR_MISSING",
  "DB_SCHEMA_MANIFEST_UNVERIFIED",
  "DB_READONLY_ROLE_UNCONFIRMED",
  "DB_WRITE_PRIVILEGES_PRESENT_OR_UNKNOWN",
  "PROVIDER_ID_REQUIRED",
  "MODEL_ID_REQUIRED",
  "TABLE_OR_COLUMN_MAPPING_MISSING",
  "TABLE_OR_COLUMN_IDENTIFIER_INVALID",
  "TARGET_RECORD_NOT_UNIQUE",
]);

const quoteIdentifier = (value) => {
  if (!IDENTIFIER.test(String(value || ""))) throw new TypeError("TABLE_OR_COLUMN_IDENTIFIER_INVALID");
  return `"${value}"`;
};

function validateManifest(manifest, parameters) {
  const blockers = [];
  if (manifest?.dialect !== "postgresql") blockers.push("DB_DIALECT_UNSUPPORTED_OR_MISSING");
  if (manifest?.schemaVerified !== true) blockers.push("DB_SCHEMA_MANIFEST_UNVERIFIED");
  if (manifest?.readOnlyRoleConfirmed !== true) blockers.push("DB_READONLY_ROLE_UNCONFIRMED");
  if (manifest?.writePrivilegesAbsent !== true) blockers.push("DB_WRITE_PRIVILEGES_PRESENT_OR_UNKNOWN");
  if (!String(parameters?.providerId || "").trim()) blockers.push("PROVIDER_ID_REQUIRED");
  if (!String(parameters?.modelId || "").trim()) blockers.push("MODEL_ID_REQUIRED");
  if (!manifest?.schema || !IDENTIFIER.test(String(manifest.schema))) blockers.push("TABLE_OR_COLUMN_IDENTIFIER_INVALID");
  for (const definition of AI_READBACK_QUERY_DEFINITIONS) {
    const mapping = manifest?.tables?.[definition.tableKey];
    if (!mapping?.table || !mapping?.columns) {
      blockers.push("TABLE_OR_COLUMN_MAPPING_MISSING");
      continue;
    }
    const identifiers = [mapping.table, ...definition.columns.map((column) => mapping.columns[column])];
    if (identifiers.some((identifier) => !IDENTIFIER.test(String(identifier || "")))) blockers.push("TABLE_OR_COLUMN_IDENTIFIER_INVALID");
  }
  return [...new Set(blockers)];
}

function buildQuery(definition, manifest) {
  const mapping = manifest.tables[definition.tableKey];
  const columns = definition.columns.map((logical) => `${quoteIdentifier(mapping.columns[logical])} AS ${quoteIdentifier(logical)}`);
  const providerColumn = quoteIdentifier(mapping.columns.provider_id);
  const modelColumn = quoteIdentifier(mapping.columns.model_id);
  return `SELECT ${columns.join(", ")} FROM ${quoteIdentifier(manifest.schema)}.${quoteIdentifier(mapping.table)} WHERE ${providerColumn} = :provider_id AND ${modelColumn} = :model_id LIMIT 2`;
}

export function buildAiReadbackPrecheckPlan({ manifest, parameters } = {}) {
  const blockers = validateManifest(manifest, parameters);
  if (blockers.length) {
    return Object.freeze({
      state: "BLOCKED",
      blockers: Object.freeze(blockers),
      queries: Object.freeze([]),
      parameterNames: AI_READBACK_PARAMETERS,
      executesSql: false,
      opensDatabaseConnection: false,
      readsSecrets: false,
    });
  }
  const queries = AI_READBACK_QUERY_DEFINITIONS.map((definition) => Object.freeze({
    id: definition.id,
    sql: buildQuery(definition, manifest),
    parameterNames: AI_READBACK_PARAMETERS,
    maxRows: 2,
    duplicatePolicy: "STOP",
    outputColumns: definition.columns,
  }));
  return Object.freeze({
    state: "PLAN_READY",
    blockers: Object.freeze([]),
    queries: Object.freeze(queries),
    parameterNames: AI_READBACK_PARAMETERS,
    outputSchema: AI_READBACK_OUTPUT_SCHEMA,
    executesSql: false,
    opensDatabaseConnection: false,
    readsSecrets: false,
  });
}
