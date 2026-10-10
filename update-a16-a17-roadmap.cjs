const fs = require('node:fs');
const p = 'C:/Users/DELL/Documents/Codex/VITE_UI_SANDBOX_WORKER_TEST/src/features/ai/IMPLEMENTATION-ROADMAP.md';
const oldA = '- A16 add-model regression: 23/23 real local Chromium mock checks passed.';
const oldB = '- A17 edit-model regression: 10/10 real local Chromium mock checks passed; the shared menu now has five items including A23/A24.';
let content = fs.readFileSync(p, 'utf8');
if (!content.includes(oldA) || !content.includes(oldB)) throw new Error('Expected lines not found; no write performed.');
const replacement = [
  '- Add-model form subset regression (unnumbered): 23/23 real local Chromium mock checks passed; this covers only fields and behavior currently implemented.',
  '- Edit-model regression (unnumbered): 10/10 real local Chromium mock checks passed; the shared menu now has five items including A23/A24.',
  '- A16 full historical-field alignment: BLOCKED / NOT COMPLETE. Historical inventory calls for a separate display name, Provider model discovery, endpoint mode, input/output pricing, pricing/billing mode, RPM/TPM/RPD, free allowance/month budget/thresholds, capability and strategy controls, draft persistence, and test-then-enable. Current Add Model mock exposes only Provider, model ID, base URL, API-key presence, type, context length, and one demo CNY quota. Historical backend notes do not verify the current API/schema, so do not invent these fields or payloads. Current isolated adapter accepts only provider/model/baseUrl/type/context/quota/secretConfigured; no raw key, real request, or persistence.',
  '- A17 Add Model route consistency: BLOCKED / NOT RUN pending an authoritative route contract. Current approved route list has `/ai-center/models` but no `/ai-center/models/add`; a historical inventory proposes `/ai-center/models/add`. Current Add button opens a dialog without changing the URL. Do not change shared routing until the expected route is confirmed.',
  '- Native Provider select Escape reproduction: with a dirty Add Model dialog and the Provider select focused/open, one trusted Escape closed the browser-native option popup while the dialog remained open and the draft stayed intact (`dialogOpen:true`, `discardPromptOpen:false`, Provider `OpenAI`, model `Escape dropdown draft`). The probe only observed trusted Control+A app events; it did not establish second-Escape/discard behavior.'
].join('\n');
content = content.replace(`${oldA}\n${oldB}`, replacement);
if (content.includes(oldA) || content.includes(oldB)) throw new Error('Replacement did not fully apply; no write performed.');
fs.writeFileSync(p, content, 'utf8');
console.log('Updated AI roadmap checkpoint labels and A16/A17 blockers.');
