import test from "node:test";
import assert from "node:assert/strict";
import {
  AI_READBACK_OUTPUT_SCHEMA,
  AI_READBACK_QUERY_DEFINITIONS,
  AI_READBACK_STOP_CONDITIONS,
  buildAiReadbackPrecheckPlan,
} from "./ai-model-readback-precheck.mjs";

const manifest = () => ({
  dialect: "postgresql",
  schema: "ai_readonly",
  schemaVerified: true,
  readOnlyRoleConfirmed: true,
  writePrivilegesAbsent: true,
  tables: Object.fromEntries(AI_READBACK_QUERY_DEFINITIONS.map((definition) => [definition.tableKey, {
    table: `v_${definition.tableKey.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}`,
    columns: Object.fromEntries(definition.columns.map((column) => [column, column])),
  }])),
});

test("AI-C11 stops without schema, readonly role, write denial or identity parameters", () => {
  const result = buildAiReadbackPrecheckPlan({ manifest: {}, parameters: {} });
  assert.equal(result.state, "BLOCKED");
  for (const code of ["DB_DIALECT_UNSUPPORTED_OR_MISSING", "DB_SCHEMA_MANIFEST_UNVERIFIED", "DB_READONLY_ROLE_UNCONFIRMED", "DB_WRITE_PRIVILEGES_PRESENT_OR_UNKNOWN", "PROVIDER_ID_REQUIRED", "MODEL_ID_REQUIRED", "TABLE_OR_COLUMN_MAPPING_MISSING"]) {
    assert.ok(result.blockers.includes(code), code);
  }
  assert.equal(result.executesSql, false);
  assert.equal(result.opensDatabaseConnection, false);
  assert.equal(result.readsSecrets, false);
});

test("AI-C11 emits only parameterized, explicit, single-identity SELECT templates", () => {
  const result = buildAiReadbackPrecheckPlan({ manifest: manifest(), parameters: { providerId: "provider-1", modelId: "model-1" } });
  assert.equal(result.state, "PLAN_READY");
  assert.equal(result.queries.length, AI_READBACK_QUERY_DEFINITIONS.length);
  for (const query of result.queries) {
    assert.match(query.sql, /^SELECT /);
    assert.doesNotMatch(query.sql, /SELECT\s+\*/i);
    assert.match(query.sql, /:provider_id/);
    assert.match(query.sql, /:model_id/);
    assert.match(query.sql, /LIMIT 2$/);
    assert.doesNotMatch(query.sql, /\b(?:INSERT|UPDATE|DELETE|MERGE|ALTER|DROP|CREATE|GRANT|REVOKE|TRUNCATE|CALL|EXEC)\b/i);
    assert.deepEqual(query.parameterNames, ["provider_id", "model_id"]);
    assert.equal(query.duplicatePolicy, "STOP");
  }
  assert.equal(JSON.stringify(result).includes("provider-1"), false);
  assert.equal(JSON.stringify(result).includes("model-1"), false);
});

test("AI-C11 rejects unapproved identifiers and publishes a non-sensitive output schema", () => {
  const unsafe = manifest();
  unsafe.tables.modelRegistry.table = "model_registry; DROP TABLE models";
  const result = buildAiReadbackPrecheckPlan({ manifest: unsafe, parameters: { providerId: "p", modelId: "m" } });
  assert.equal(result.state, "BLOCKED");
  assert.ok(result.blockers.includes("TABLE_OR_COLUMN_IDENTIFIER_INVALID"));
  assert.equal(AI_READBACK_OUTPUT_SCHEMA.sensitive_fields_removed, true);
  assert.ok(AI_READBACK_STOP_CONDITIONS.includes("TARGET_RECORD_NOT_UNIQUE"));
});
