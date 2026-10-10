# AI-017 Add Model Visual QA

- Source of truth: `C:\Users\DELL\Documents\Codex\2026-10-04\ai-work-windows-work-7-ui\outputs\AI017\reference\UI_MANIFEST.json` and frozen `01_Step1_选择模型_更多厂商与自定义入口.png` through `06_模型添加并启用成功.png`.
- Target viewport: 1536×864 at `http://127.0.0.1:5173/ai-center/models/add`.
- Intended verification states: Step 1 default / More drawer / tentative / cancel / confirm; Step 2 idle / testing / success / failure / timeout / auth / rate-limit; Step 3 capabilities / quota-cost / routing / draft / enable / success / readback.
- Prior implementation captures: `outputs/AI017/step1`, `outputs/AI017/step2`, `outputs/AI017/step3`, `outputs/AI017/parent`.
- Comparison artifacts: `outputs/AI017/comparison/*_SIDE_BY_SIDE.png`; latest observed Step 3 comparison shows major content-density and region-width differences. Formal page close remains below the 85% requirement; parent baseline is 73.431109%, and P1 findings remain open for parent, connection, and capabilities.
- Confirmed no-obvious-overflow observations before current blocker: Step 2 health checks fit after footer relocation; Step 3 preview and footer no longer overlap. These are fixture-only visual observations, not functional acceptance.
- Current implementation screenshot could not be refreshed after the latest CSS HMR because the canonical Vite page is now covered by a compile-error overlay from the out-of-scope Worker-owned `BulkImportV3.jsx` (JSX closing-tag error around line 625). The unverified Add Model macro-width candidate was rolled back. Do not edit Worker source under this AI task.
- Current defect severity: P0=0 observed; P1=OPEN (visual threshold and no-obvious-defect gate not met; canonical Vite overlay blocks fresh screenshot verification).
- Prior iteration/fix: corrected AddModelPage JSX so its module returned HTTP 200; adjusted Step 2 form density and moved desktop wizard actions below the preview; shortened duplicate preview details. All previous accepted AI011 and AI015 gates remain preserved.

final result: blocked
