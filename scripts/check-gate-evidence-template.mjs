import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const standardPath = path.join(root, "docs", "GSO_GATE_EVIDENCE_STANDARD.md");
const templatePath = path.join(root, "docs", "templates", "gate-evidence-comment.md");
const failureStandardPath = path.join(root, "docs", "GSO_FAILURE_HANDLING_STANDARD.md");
const failureTemplatePath = path.join(root, "docs", "templates", "failure-handling-comment.md");
const developmentStandardPath = path.join(root, "docs", "GSO_DEVELOPMENT_ENTRY_STANDARD.md");
const developmentTemplatePath = path.join(root, "docs", "templates", "development-entry-checklist.md");

const [standard, template, failureStandard, failureTemplate, developmentStandard, developmentTemplate] = await Promise.all([
  fs.readFile(standardPath, "utf8"),
  fs.readFile(templatePath, "utf8"),
  fs.readFile(failureStandardPath, "utf8"),
  fs.readFile(failureTemplatePath, "utf8"),
  fs.readFile(developmentStandardPath, "utf8"),
  fs.readFile(developmentTemplatePath, "utf8"),
]);

const requiredStandardTerms = [
  "## 2. Gate name standard",
  "## 3. Status definitions",
  "## 4. Conditions required before merging a PR",
  "## 5. Issue comment standard format",
  "## 6. Artifact naming rules",
  "## 7. SHA-256 and digest recording rules",
  "## 8. GitHub Actions run recording rules",
  "## 9. Runner recording rules",
  "## 10. Project Board status rules",
  "## 11. Prohibited behavior after a failure",
  "## 12. Merge admission and final output contract",
  "Build",
  "dependency-cruiser",
  "Knip",
  "Playwright Smoke",
  "BackstopJS Visual",
  "axe-core Accessibility",
];

const requiredTemplateTerms = [
  "## Final State",
  "- PR:",
  "- Merge Commit:",
  "- Actions Run:",
  "- Runner:",
  "## Gate Summary",
  "## Artifact Table",
  "| Artifact Name | Artifact ID | Direct Link | SHA-256 / digest | Expires / Retention |",
  "## Known Warnings / Existing Baseline",
  "## Project Board Status",
  "## Next Safe Unit",
  "FINAL_STATE=",
];

const requiredFailureStandardTerms = [
  "## 2. Status handling flows",
  "### FAILED",
  "### BLOCKED",
  "### WARNING",
  "### PASS",
  "## 3. First response after a Gate failure",
  "## 4. Failure evidence preservation rules",
  "## 5. No-merge rules",
  "## 6. Failure type classification",
  "## 7. Conditions for retrying CI",
  "## 8. Conditions for updating or resubmitting a PR",
  "## 9. Scenarios requiring user authorization",
  "## 10. Scenarios requiring server root operations",
  "## 11. Project Board state transitions",
  "## 12. Issue comment format",
  "## 13. Conditions for restoring PASS",
  "## 14. Prohibited behavior and Next Safe Unit",
  "CODE",
  "ENVIRONMENT",
  "PERMISSION",
  "USER_APPROVAL",
  "UNKNOWN",
];

const requiredFailureTemplateTerms = [
  "## Failure State",
  "## Failed Gate",
  "## Actions Run",
  "## Commit",
  "## Runner",
  "## Failure Type",
  "## Evidence",
  "## Immediate Action",
  "## Required Owner",
  "## Project Board Target Status",
  "## Retry Condition",
  "## Next Safe Unit",
  "CODE / ENVIRONMENT / PERMISSION / USER_APPROVAL / UNKNOWN",
];

const requiredDevelopmentStandardTerms = [
  "## 2. Entry decision",
  "## 3. Required Issue fields",
  "## 4. Scope and Out of Scope",
  "## 5. Allowed and forbidden files",
  "## 6. UI freeze and authorization",
  "## 7. Mandatory Gates",
  "## 8. PR merge admission",
  "## 9. Evidence requirements",
  "## 10. Issue comments",
  "## 11. Project Board states",
  "## 12. User authorization",
  "## 13. BLOCKED conditions and recovery",
  "## 14. Center-specific recovery standards",
  "Worker resources center",
  "AI intelligent model center",
  "Product center",
];

const requiredDevelopmentTemplateTerms = [
  "## Issue ID",
  "## Center / Module",
  "## Task Name",
  "## Scope",
  "## Out of Scope",
  "## Allowed Files",
  "## Forbidden Files",
  "## Frozen UI Impact",
  "## Required Gates",
  "## Expected Evidence",
  "## User Authorization Required: YES / NO",
  "## Risk Level: LOW / MEDIUM / HIGH",
  "## Entry Decision: ALLOWED / BLOCKED",
  "## Next Safe Unit",
];

const missing = [
  ...requiredStandardTerms
    .filter((term) => !standard.includes(term))
    .map((term) => `${path.relative(root, standardPath)}: ${term}`),
  ...requiredTemplateTerms
    .filter((term) => !template.includes(term))
    .map((term) => `${path.relative(root, templatePath)}: ${term}`),
  ...requiredFailureStandardTerms
    .filter((term) => !failureStandard.includes(term))
    .map((term) => `${path.relative(root, failureStandardPath)}: ${term}`),
  ...requiredFailureTemplateTerms
    .filter((term) => !failureTemplate.includes(term))
    .map((term) => `${path.relative(root, failureTemplatePath)}: ${term}`),
  ...requiredDevelopmentStandardTerms
    .filter((term) => !developmentStandard.includes(term))
    .map((term) => `${path.relative(root, developmentStandardPath)}: ${term}`),
  ...requiredDevelopmentTemplateTerms
    .filter((term) => !developmentTemplate.includes(term))
    .map((term) => `${path.relative(root, developmentTemplatePath)}: ${term}`),
];

if (missing.length > 0) {
  console.error("Gate evidence contract is missing required content:");
  for (const item of missing) console.error(`- ${item}`);
  process.exit(1);
}

console.log("GSO gate evidence, failure-handling, and development-entry contracts: PASS");
