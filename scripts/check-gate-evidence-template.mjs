import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const standardPath = path.join(root, "docs", "GSO_GATE_EVIDENCE_STANDARD.md");
const templatePath = path.join(root, "docs", "templates", "gate-evidence-comment.md");

const [standard, template] = await Promise.all([
  fs.readFile(standardPath, "utf8"),
  fs.readFile(templatePath, "utf8"),
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

const missing = [
  ...requiredStandardTerms
    .filter((term) => !standard.includes(term))
    .map((term) => `${path.relative(root, standardPath)}: ${term}`),
  ...requiredTemplateTerms
    .filter((term) => !template.includes(term))
    .map((term) => `${path.relative(root, templatePath)}: ${term}`),
];

if (missing.length > 0) {
  console.error("Gate evidence contract is missing required content:");
  for (const item of missing) console.error(`- ${item}`);
  process.exit(1);
}

console.log("GSO gate evidence standard and comment template contract: PASS");
