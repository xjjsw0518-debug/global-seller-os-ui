ROADMAP_REVISION: WCR-20261004-001
FUNCTION_ID: F04_OVERVIEW_KPI_MAP_COMPLETE_FLOW
TASK_REVISION: WKR-20261005-030
BATCH: B115_F04_MOBILE_BASELINE_READONLY
STATUS: RESPONSIVE_BASELINE_READONLY_PASS_F04_UI_GAP_REMAINS

ACK: WKR-20261005-030 已消费一次；不重复 F01/F02/F03/B88 Gate。

BROWSER_BASELINE:
- 390×844 canonical Vite Worker 页面 headless/read-only：login HTTP 200、page HTTP 200；document/body width=390，无横向溢出；1 资源行；KPI cards=0、Map elements=0。
- mutation=0；secret/cookie 未输出或持久化。截图 `outputs/f04/b113/worker-overview-readonly-390x844.png`；脱敏记录 `outputs/f04/b113/WKR-030-mobile-page-readonly.json`。
- 这是当前缺口前的窄屏基线，不能计作 F04 视觉/功能 Gate PASS。
- 1440×900 读回同样显示 KPI/Map 隐藏、overview GET=200、无 console/request errors；证据 `outputs/f04/b113/WKR-030-canonical-page-readonly.json`。

IMPLEMENTATION:
- Worker-only map-data adapter + Overview/Map identity/count/geography model已实现；定向测试 26 PASS/0 FAIL。
- 同一稳定 VPS UUID 集合与权威计数吻合才算 consistent；country/city仅按真实字段分组；无坐标不落点；pulse保持 UNKNOWN，不伪造 online。
- staging 认证读回、heartbeat freshness 定义及镜像/source hashes见 `outputs/f04/b110/WKR-030-live-contract-readback.json`。

SHARED_LOCK:
- 精确 F04 shared lock请求已写 Result；F03锁012为 CLOSED。尚未获得 F04 App.jsx/vite.config.mjs 写许可，因此未写这些共享文件。
- 请求范围：`src/App.jsx` Worker-only Overview/KPI/Map branches (`KpiStrip`, `SummaryPanel`, `TopList`, `ResourceMap`, `AppV2` fetch/refresh/render)；`vite.config.mjs` 精确 map-data 与 workers 两个 staging GET proxy到18765，无 catch-all、不更改 AI proxy。

NEXT_ACTION: 读取最新 PM_TO_WORKER_TASK.md与共享锁状态；没有更新Revision时，继续在 Worker feature source内复核真实 DTO模型及证据一致性，等待共享锁期间不空转。NEED_USER_INPUT=false。

### F05-B3共享参考列轨道重构已落源
UPDATED_AT_UTC: 2026-10-06T16:19:29.4369577Z
TASK_REVISION: WKR-20261006-073-DOT-TTY-WAKE-ONCE。
SOURCE_WORKSPACE: C:\Users\DELL\Documents\Codex\VITE_UI_SANDBOX_WORKER_TEST；VITE_PID=71736；VITE_ROOT与workspace一致；PAGE_URL=http://127.0.0.1:5173/ui-v2/worker-resources/bulk-import。
CHANGED_FILES: C:\Users\DELL\Documents\Codex\VITE_UI_SANDBOX_WORKER_TEST\src\BulkImportV3.jsx；before SHA256=2FBC285178BD14B4F376287963DF631D696A19233CAB0133D984A7E7AA65269D，after=471EE6A38BFFEDD0B569C8C387E9C72F032035C384DF5BD8F5A402FADF9E2CD0。Diff=C:\Users\DELL\Documents\Codex\VITE_UI_SANDBOX_WORKER_TEST\outputs\f05\wkr073-region-reconstruction\b3-shared-reference-colgroup.diff。
REGION_MATRIX: C:\Users\DELL\Documents\Codex\VITE_UI_SANDBOX_WORKER_TEST\outputs\f05\wkr070-ai-style-reconstruction\r2-macro-geometry-region-error-matrix.json；Table integrated error proxy=7,784,947（全区域最高），基线Table ROI SSIM=42.5860%、MAE=19.0208；Full=46.4979%、MAE=16.9203。
BUNDLE: 仅更改Table视图轨道定义：引用13个冻结Reference x-anchor构成百分比HTML colgroup，table-layout:fixed取消intrinsic sizing；删除逐列nth-child宽度，保持原生table、颜色/边线/行纹理、数据、选择/分页回调及API/DB接线。
STATUS: 源码刚改，Build和一次canonical截图/Overlay/Diff/指标/Console basic待执行；UI_PROGRESS_CREDIT=0，NEED_USER_INPUT=false。

## WKR-20261007-084-REAL-VPS-ZEROTOUCH-HARD-GATE
- 已消费并 ACK；当前批次仍为 B00（1536×864当前锁定UI基线证据待补），未越过批次顺序。
- VPS-JKT（DESKTOP-09EROIC）和 VPS-CHINA 两台真实节点是强制条件；VPS-CHINA Zero-Touch 真实开通不得由 Fixture/Mock/假状态代替。真实设备状态待对应批次采集。
- B112 才生成并验证专用命令，到达远程执行点后才向用户请求一次执行协作。
- 详见 `outputs/wkr084/result.md` 与 `outputs/wkr084/REAL_VPS_MATRIX.csv`。
