# WORKER FINAL EXECUTION SPEC — 2026-10-07

## 0. 唯一权威任务 / 队列规则

**AUTHORITATIVE_REVISION**

`WKR-20261007-088-FINAL-COMPLETE-EXECUTION-SPEC`

从本文件生效起：

- 继续原 **Worker开发** thread，不新建 Work。
- 不从零开始。
- WKR-080～WKR-087 仅作为历史，不再逐条消费。
- 它们所有仍有效要求已全部收敛到本文件。
- 已经真实 PASS 且未受当前代码变更影响的 Gate 保留。
- 用户已清空旧 Worker 队列；后续只消费 WKR-088。
- 不允许为同一内容再生成 089/090 等重复 revision。
- 除 VPS-CHINA 真正需要用户在远程机器执行 Zero-Touch 命令的时刻外，禁止 WAIT_PM。

执行状态固定：

```
priority = HIGHEST
execution_mode = LATEST_ONLY_BATCHED_REAL_WIRING_E2E
safe_next_action_exists = true
stop_allowed = false
```

消费后必须立即写入：

```
last_consumed_pm_task_revision =
WKR-20261007-088-FINAL-COMPLETE-EXECUTION-SPEC

pm_task_state = ACKED/RUNNING
current_batch_sequence = B00
```

---

# 1. Worker UI 唯一锁定基线 — P0 前置 Gate

基线文件：

`control/WORKER_UI_LOCK_BASELINE_20261007.json`

Baseline ID：

`WORKER_UI_LOCK_BASELINE_20261007`

用户本人确认的首页：

`http://127.0.0.1:5173/ui-v2/worker-resources?workerVisualFixture=1`

唯一 Vite / Source Workspace：

`C:\Users\DELL\Documents\Codex\VITE_UI_SANDBOX_WORKER_TEST`

锁定截图：

`C:\GSO\visual-audit\worker-lock-home\WORKER_UI_LOCK_HOME_1536x864.png`

Viewport：

`1536 × 864`

SHA256：

`0fc0bb93fcc2e9a9d7a2ac9b92ed3e27dacbaf3ec184f00c1c7796ef223952f4`

## B00 — UI_LOCK_BASELINE_CONFIRM

在任何功能接线前必须：

1. 读取 `WORKER_UI_LOCK_BASELINE_20261007.json`
2. 确认当前 Vite root 与 Source Workspace 正确
3. 打开锁定首页 route
4. 以 1536×864 截图
5. 与锁定基线比对
6. 确认以下结构均为同一版本：
   - Sidebar
   - Header
   - KPI cards
   - Map
   - Country/City/right-side list
   - Resource table
   - Filters/Search
   - Action buttons
   - Card/Input/Dropdown/Table geometry
   - Typography/theme/spacing
   - Drawer/Modal placement
7. 输出 `BASELINE_MATCH=PASS/FAIL`

### B00 PASS 条件

- route 正确
- Vite root 正确
- Source Workspace 正确
- 没有第二套 Shell
- 没有旧 Worker UI
- P0 visual regression = 0
- P1 visual regression = 0
- `BASELINE_MATCH=PASS`

### WRONG_UI_BASELINE Gate

任意 Batch 如果发现：

- 进入旧 route
- 进入旧 fixture/UI
- 使用错误 workspace
- 出现第二套 Worker 页面
- AI 改动破坏 Worker baseline

立即：

```
WRONG_UI_BASELINE=true
Batch=FAIL
```

禁止在错误页面继续接线。

---

# 2. UI 锁定内容与可替换内容

## 2.1 不允许改变

- 页面结构
- Sidebar / Header
- KPI Card 布局
- Map/List/Table 组合
- Card/Input/Dropdown/Button 几何
- 字号/间距/主题/信息层级
- Drawer/Modal 位置和交互结构
- 已锁定导航结构
- Global → Country → City → Resource Detail 体验
- 当前 Dark Theme

## 2.2 功能阶段允许替换

- Visual Fixture 假数据
- KPI 数值
- Resource records
- Heartbeat
- Runtime
- Package
- Agent
- Logs
- Progress
- API/DB 实际值

原则：

`Fixture data → REAL data`

但：

`Visual Geometry / Layout / Interaction Contract 不变`

---

# 3. 全局功能接线规则

每个 Batch 固定流水线：

```
SOURCE AUDIT
→ REUSE EXISTING CODE
→ MINIMAL WIRING
→ REAL API/DB
→ 5173 VISIBLE CHANGE
→ MOUSE/KEYBOARD
→ CONSOLE
→ NETWORK
→ DB READBACK
→ VISUAL REGRESSION
→ PASS/FAIL
→ EVIDENCE
→ NEXT BATCH
```

## 3.1 Reuse First

必须：

- 优先复用已有 Service
- 优先复用已有 API
- 优先复用已有 DB
- 优先复用已有 Adapter
- 优先保留旧 PASS Gate

只有真实 E2E 证明能力不存在时，才做最小新增开发。

禁止：

- 重写已有能力
- 新建第二套页面
- 新建第二套 Shell
- 为新 UI 另造一套重复后端
- 无关大重构
- 因一个 Batch 失败重跑全部历史 Batch

---

# 4. 127.0.0.1:5173 Visibility Gate

唯一用户验收面：

`http://127.0.0.1:5173`

每个功能必须证明：

```
REAL Runtime/Backend
→ REAL API/DB
→ Frontend Adapter/State
→ Locked Worker UI @5173
→ Visible State Change
```

以下情况一律 FAIL：

- API PASS，但 5173 没变化
- DB PASS，但页面没变化
- Agent 真实变化，但页面仍旧状态
- 页面显示 Fixture/Mock 代替真实状态
- 页面只能靠刷新开发工具才能看见状态

必须在 5173 可见：

- Loading
- Saving
- Success
- Error
- Downloading
- Installing
- Verifying
- Registering
- Heartbeat Online/Offline
- Ready
- Failed
- Retry
- Timeout
- Progress
- Bulk Import progress/result
- Logs refresh/pause
- Archive/Restore/Delete
- RDP/Test Connection

每个 Batch Evidence 必须记录：

- page_url
- visible_before
- visible_after
- visible_state_change
- screenshot_before
- screenshot_after
- frontend_data_source
- api_request/result
- db_readback
- visible_match=true/false

`visible_match=false → Batch FAIL`

---

# 5. Fixture Cleanup / Real Runtime Gate

## B01 — FIXTURE_RESIDUE_ZERO

真实功能测试前：

- workerVisualFixture 不得影响真实运行路径
- fixture residue = 0
- no mock fallback
- no synthetic persisted data
- real adapter active
- real API active
- real DB active

Visual Fixture 能力可以保留为显式 local visual review 模式，但功能 Gate 不能使用它。

### B01 PASS

- Fixture 开关关闭后真实数据正常
- Network 指向真实 API
- DB 路径真实
- 页面无隐藏 mock fallback
- 5173 显示真实数据

---

# 6. Auth / Session

## B02 — AUTH_SESSION_HEALTH

测试：

- 正常认证
- 401
- 403
- reload
- session persistence
- Auth headers / CSRF（适用时）
- token/session expiry（适用时）

### PASS

- 合法 session 正常
- 未授权状态符合契约
- 认证错误不破坏 locked UI
- 可恢复

---

# 7. 真实 VPS 硬门槛

所有 VPS 功能必须使用真实机器。

## VPS-JKT

固定：

- Logical Name: `VPS-JKT`
- 实际机器：当前电脑
- Machine Identity: `DESKTOP-09EROIC`

必须真实验证：

- Registration
- Worker Agent
- Heartbeat
- Runtime
- Package
- Logs
- RDP/Test Connection（适用）
- Center UI readback
- API/DB readback

## VPS-CHINA

固定：

- Logical Name: `VPS-CHINA`
- 用户第二台真实 VPS
- 本轮 Zero-Touch 主验收对象

必须从真实未注册/未 Ready 状态通过 Zero-Touch 开通。

禁止：

- Fake Ready
- DB 直接改 Ready
- Mock Heartbeat
- Mock Agent
- Mock Runtime
- Synthetic Logs
- 用 VPS-JKT 替代 VPS-CHINA
- 只证明命令生成，不实机执行

---

# 8. 人工式鼠标/键盘强制 Gate

功能接线完成 ≠ PASS。

必须通过真实 headed browser / 可见浏览器进行人工式输入事件。

必须覆盖（按控件适用）：

- Mouse click
- Double-click
- Hover
- Scroll
- Keyboard typing
- Tab
- Shift+Tab
- Enter
- Esc
- ArrowUp/ArrowDown
- Space
- Ctrl+A
- Backspace/Delete
- Copy/Paste
- Multi-select
- Select All
- File picker/upload
- Drawer/Modal Cancel/Confirm
- Pagination
- Sort
- Filter
- Search
- Retry
- Back/Breadcrumb

禁止作为唯一 PASS 证据：

- handler 直接调用
- JS setState
- JS setValue
- document.querySelector(...).click()
- unit test
- API-only test

允许 Playwright/CUA，但必须：

- headed / visible
- 走真实 browser input event chain
- 页面真实变化可见

建立 `HUMAN_INPUT_MATRIX`。

---

# 9. 已锁定交互/字段契约

必须继续保持：

1. Global → Country → City → Resource Detail
2. Map/List/KPI 同源
3. 非 TOP 国家城市中文
4. 地图/城市列表/Breadcrumb/Detail 入口中文一致
5. Bulk Import 最后一步城市中文
6. Resource Address 支持：
   - IP:PORT
   - DOMAIN:PORT
   - 原有无端口格式
7. Provider：
   - Logo + Name 可点击
   - 新标签打开
   - provider website/admin URL
   - 自定义 provider 使用 provider_website_url
8. Provider Logo/Name/Card 几何保持 locked UI
9. “更多服务商”保持已锁交互：
   - 未点不出现
   - 点后只出现扩展 Panel/Drawer
   - 主页面不重复注入列表
   - Cancel/Close 恢复
   - Confirm 后才提交
10. 无无关 route jump
11. 无第二套 Shell
12. 无白色默认 Dropdown
13. 未触发 Drawer/Modal 不默认显示

---

# 10. PHASE 1 — 首页 / Map / Drill-down

## B10 — HOME_KPI_WIRING

范围：

- KPI
- Refresh
- Provider filter
- Country filter
- Status filter
- Search

测试：

- mouse
- typing
- Tab
- Enter
- refresh

PASS：

- KPI = real API
- Filter/Search 真正影响结果
- Refresh 更新真实数据
- no fixture leakage
- visible_match=true

## B11 — GLOBAL_MAP_AND_LIST_SYNC

范围：

- Global map
- Country marker/node
- Resource list
- KPI

PASS：

- 同一 Source of Truth
- 数量一致
- 状态一致
- 无重复资源
- marker/list row 可点击
- hover 正常

## B12 — COUNTRY_DRILLDOWN

Flow：

`Global → Country`

测试：

- Click country
- Search/Filter
- Back
- Breadcrumb
- State persistence

PASS：

- Country data 正确
- route 正确
- 返回状态合理

## B13 — CITY_DRILLDOWN

Flow：

`Country → City`

测试：

- City marker
- City list
- 中文城市名
- Back/Breadcrumb

PASS：

- Map/List 中文一致
- 数量/状态一致
- City resource set 正确

## B14 — CITY_TO_RESOURCE_DETAIL

分别测试：

- Marker → Detail
- List Row → Detail

PASS：

- 两者进入同一 Resource ID
- route 正确

---

# 11. PHASE 2 — Resource List / Detail / Edit

## B20 — RESOURCE_LIST_CORE

范围：

- Columns
- Chips
- Provider
- Country/City/Type
- Search
- Filter
- Sort
- Pagination

PASS：

所有控件对真实数据有效。

## B21 — MULTISELECT_AND_SELECT_ALL

范围：

- Row checkbox
- Multi-select
- Select All
- Selected summary

Human：

- mouse
- Space
- keyboard focus

PASS：

- selection set 正确
- count 正确
- 不误选

## B22 — ROW_ACTIONS

逐一测试所有 Row Action：

- Mouse
- Arrow Keys
- Enter
- Esc

PASS：

- 每个 action 有正确目标
- 无 dead action

## B23 — RESOURCE_DETAIL_READ

必须显示真实：

- Identity
- Network
- Runtime
- Agent
- RPA_INSTANCE
- Heartbeat
- Install
- RDP
- Logs entry

PASS：

- API field mapping 正确
- VPS-JKT 可读
- VPS-CHINA 开通后可读

## B24 — RESOURCE_EDIT_OPEN_CANCEL

Flow：

- Open Edit
- Load current value
- Modify
- Cancel
- Dirty Confirm

PASS：

Cancel 后 DB 不变。

## B25 — RESOURCE_EDIT_VALIDATION

测试：

- Required
- Invalid format
- IP/domain/port
- Boundary
- Ctrl+A
- Backspace/Delete
- Paste

PASS：

合法 IP:PORT / DOMAIN:PORT 不误报。

## B26 — RESOURCE_EDIT_SAVE_READBACK

Flow：

`Edit → Save → Saving → Success/Error → Reload → DB Readback`

PASS：

- REAL API write
- DB persisted
- reload 一致
- 5173 visible
- baseline 无回归

---

# 12. PHASE 3 — Add Resource / Zero-Touch

## B30 — ADD_VPS_STEP1

测试所有字段：

- Provider
- Country
- City
- Address
- Validation
- Next/Back

PASS：

mouse + keyboard 正常。

## B31 — ADD_VPS_STEP2

范围：

- Zero-Touch UI
- Package/runtime options
- Copy
- Regenerate
- Download

PASS：

所有控件可用。

## B32 — ZERO_TOUCH_COMMAND_GENERATION

主目标：

`VPS-CHINA`

PASS：

- Command 真实生成
- resource/session identity 正确
- token 合理
- secret 不过度暴露

## B33 — ZERO_TOUCH_INSTALL_TRIGGER

必须在 VPS-CHINA 实机执行。

Flow：

- PowerShell/CMD 执行
- 真实下载
- 真实安装
- 真实进程
- 真实网络
- 5173 Progress

PASS：

- 实机证据
- Center 同步可见
- 非 fake progress

## B34 — ZERO_TOUCH_STATE_MACHINE

主链路必须真实走：

`Installing → Registering → Heartbeat → Ready`

安全验证：

- Failed
- Retry
- Blocked
- Timeout（可安全触发时）

PASS：

状态来自真实 Agent/Runtime。

## B35 — OFFLINE_INSTALL

只有当前 scope 需要时验证。

不得替代 B33/B34。

## B36 — ADD_MOBILE

测试 Mobile Add Resource：

- Fields
- Validation
- Save
- API/DB

## B37 — RDP_TEST_CONNECTION

状态：

`Idle → Testing → Success/Failure → Retry`

PASS：

真实连接结果 + 5173 反馈。

---

# 13. PHASE 4 — Package / Runtime

## B40 — VPS_PACKAGE

真实验证：

- Software
- Dependency
- Version
- Enabled/Disabled

VPS-JKT / VPS-CHINA 按适用验证。

## B41 — MOBILE_PACKAGE

Mobile 对应能力。

## B42 — PACKAGE_INSTALL_UPDATE

Flow：

- Install
- Update
- Retry

PASS：

真实安装/更新 + readback。

## B43 — PACKAGE_VALIDATION_ERROR

安全验证：

- Dependency conflict
- Invalid version
- Network failure

PASS：

UI/API error 一致且可恢复。

---

# 14. PHASE 5 — Bulk Import

## B50 — BULK_UPLOAD

范围：

- Template
- Drag&Drop
- File picker
- Selected file

Human mouse/keyboard。

## B51 — BULK_PREVIEW

覆盖：

- Valid
- Invalid
- Duplicate
- 中文城市
- IP:PORT
- DOMAIN:PORT

PASS：

Preview validator 与 Import parser 一致。

## B52 — BULK_PREVIEW_CONTROLS

范围：

- Search
- Filter
- Pagination
- 100 rows
- 500 rows
- 1000 rows
- Sticky header/body/footer

PASS：

大数据量可操作。

## B53 — BULK_IMPORT_EXECUTE

范围：

- Import
- Cancel
- Confirm

PASS：

- REAL API
- Cancel 不写 DB

## B54 — BULK_PROGRESS

状态：

- Running
- Partial
- Success
- Failed
- Canceled
- Timeout

PASS：

真实状态且 5173 可见。

## B55 — BULK_RESULT_READBACK

PASS：

- Success/Failure count reconcile
- DB reconcile
- Resource List reconcile

---

# 15. PHASE 6 — Ready / Registration

## B60 — READY_VPS

必须同时覆盖真实：

- VPS-JKT
- VPS-CHINA

字段：

- Registration
- Heartbeat
- Runtime
- Package
- Agent

PASS：

真实状态。

## B61 — READY_MOBILE

Mobile Ready 流程（如在当前 scope）。

## B62 — READY_RETRY_RECOVERY

验证：

- Warning
- Failure
- Retry
- Recovery

PASS：

真实可恢复。

## B63 — READY_NAVIGATION

测试：

- Back
- Next
- Detail

PASS：

route 正确。

---

# 16. PHASE 7 — Logs

## B70 — WORKER_LOGS
## B71 — RUNTIME_LOGS
## B72 — RPA_LOGS
## B73 — INSTALL_INIT_LOGS
## B74 — BUSINESS_AGENT_LOGS
## B75 — CUSTOMER_MESSAGE_MONITOR_LOGS

每个 Batch 必测：

- Filter
- Refresh
- Auto-scroll
- Pause
- Download
- Empty
- Loading
- Error
- mouse
- keyboard

PASS：

- REAL log source
- 禁止 synthetic log PASS
- Download 内容正确（适用）

---

# 17. PHASE 8 — Lifecycle

## B80 — ARCHIVE
## B81 — RESTORE
## B82 — DELETE_SINGLE
## B83 — BULK_DELETE
## B84 — EXPORT

每项：

- mouse
- keyboard
- Risk Confirm
- Cancel
- Confirm
- Success/Failure
- API
- DB Readback

破坏性测试优先使用 disposable/recoverable resource record，不要无必要破坏唯一真实节点身份。

---

# 18. PHASE 9 — 全局 Human Input Sweep

## B90 — BUTTON_LINK_TAB_SWEEP

所有 Button / Link / Tab。

PASS：

无 dead control。

## B91 — DROPDOWN_MENU_SWEEP

所有 Dropdown/Menu：

- click
- ArrowUp/Down
- Enter
- Esc

PASS：

Open/Select/Close 正常，Dark UI 不回归。

## B92 — FORM_KEYBOARD_SWEEP

所有 Input/Textarea：

- typing
- Tab
- Shift+Tab
- Ctrl+A
- Backspace/Delete
- Paste

PASS：

Focus/Order/Value/Validation 正确。

## B93 — MODAL_DRAWER_SWEEP

所有 Modal/Drawer：

- Open
- Esc
- Cancel
- Confirm
- Close
- Focus return

PASS：

- 未触发不出现
- 无重复主页面内容
- Cancel 不提交
- Confirm 才提交

## B94 — TABLE_INTERACTION_SWEEP

所有：

- Sort
- Pagination
- Row Action
- Select
- Select All

PASS：

真实状态正确。

## B95 — ACCESSIBILITY_FOCUS_SWEEP

验证：

- Keyboard reachability
- Visible focus
- Tab order
- Disabled behavior

PASS：

关键流程键盘可达。

---

# 19. PHASE 10 — Locked UI Regression

## B100 — LOCKED_UI_REGRESSION

功能接线完成后与 B00 baseline 比对。

PASS：

- P0 visual regression = 0
- P1 visual regression = 0
- Shell/Layout/Interaction Contract 与锁定版一致
- Minor only → Punch List

---

# 20. PHASE 11 — 最终端到端 E2E

## B110 — E2E_FLOW_1_DISCOVERY_TO_DETAIL

`Home → Search/Filter → Country → City → Resource Detail → Back`

PASS：

真实数据 + 真实输入 + route/state 正确。

## B111 — E2E_FLOW_2_EDIT

`Search → Detail → Edit → Validation → Save → Reload → DB Readback`

PASS：

完整 write/readback + 5173。

## B112 — E2E_FLOW_3_ADD_VPS

**主对象固定 VPS-CHINA**

`Add Resource → Step1 → Step2 → Zero-Touch Command → VPS-CHINA 实机执行 → Download/Install → Register → Heartbeat → Verify → Ready → DB Readback → 5173 Resource Detail`

PASS：

VPS-CHINA 真正 Zero-Touch 开通。

### 唯一允许 NEED_USER_INPUT 的节点

只有当：

- Zero-Touch command 已生成
- command 已验证
- VPS-CHINA 已准备好

才允许：

`NEED_USER_INPUT=true`

只请求用户做一件事：

**在 VPS-CHINA PowerShell/CMD 粘贴并执行命令。**

## B113 — E2E_FLOW_4_BULK_IMPORT

`Upload → Preview → Fix Invalid → Import → Progress → Result → Resource List → DB Readback`

## B114 — E2E_FLOW_5_LOGS

`Resource → Logs → Filter → Pause/Resume → Download`

## B115 — E2E_FLOW_6_LIFECYCLE

`Archive → Verify → Restore → Verify → Delete/Bulk Delete`

## B116 — E2E_FLOW_7_RDP

`Real VPS → Test → Success/Failure → Retry`

## B117 — E2E_FLOW_8_ERROR_RECOVERY

安全验证：

- Auth error
- Timeout
- API error
- Partial success
- Retry

PASS：

用户可恢复，数据不损坏。

## B118 — FINAL_CROSS_CENTER_SHELL_REGRESSION

只验证：

AI 开发没有破坏 Worker locked UI。

禁止在本 Worker task 重做统一 Shell。

---

# 21. B119 — FINAL CLOSEOUT HARD GATE

必须全部 PASS：

```
UI_LOCKED_BASELINE_PRESERVED = true
fixture_residue = 0
REAL_TEST_DATA = PASS

VPS_JKT_REAL_NODE = PASS
VPS_CHINA_REAL_NODE = PASS
VPS_CHINA_ZERO_TOUCH_REAL_PROVISIONING = PASS
TWO_REAL_NODE_CENTER_READBACK = PASS

BROWSER = PASS
HUMAN_MOUSE_KEYBOARD = PASS
CONSOLE_BLOCKING_ERRORS = 0
NETWORK = PASS
REAL_API = PASS
DB_WRITE_READBACK = PASS
AUTH_SECURITY = PASS
VALIDATION = PASS
ERROR_RETRY_TIMEOUT = PASS
RESPONSIVE = PASS

ALL_USER_VISIBLE_FUNCTIONS_VISIBLE_ON_5173 = PASS
REAL_VPS_STATE_VISIBLE_ON_5173 = PASS
ZERO_TOUCH_PROGRESS_VISIBLE_ON_5173 = PASS
NO_BACKEND_ONLY_PASS = true

P0 = 0
P1 = 0
```

只有全部满足，才能：

`WORKER_RESOURCE_CENTER = FINAL ACCEPTED / CLOSED`

---

# 22. 强制输出矩阵

## A. BATCH_MATRIX

对 B00～B119：

- Batch
- Route
- Source files
- Reused code
- New code
- API
- DB
- 5173 before
- 5173 after
- Human input
- Console
- Network
- Regression
- PASS/FAIL
- Evidence

## B. HUMAN_INPUT_MATRIX

每个关键控件：

- Route
- Control
- Type
- Mouse
- Keyboard
- Expected
- Actual
- PASS/FAIL
- Evidence

## C. E2E_FLOW_MATRIX

B110～B118：

- Steps
- Real resource
- API
- DB
- Browser
- Human input
- Result
- Evidence

## D. REAL_VPS_MATRIX

两行：

- VPS-JKT
- VPS-CHINA

字段：

- Machine identity
- Resource ID
- Registration
- Agent
- Heartbeat
- Runtime
- Package
- Zero-Touch
- Install
- Logs
- RDP/Connection
- API
- DB
- 5173 readback
- Human input
- PASS/FAIL
- Evidence

## E. 5173_VISIBILITY_MATRIX

每个真实可见状态：

- Runtime/backend event
- API/DB evidence
- 5173 route/state
- visible delay
- PASS/FAIL

---

# 23. Batch 状态与停止规则

每个 Batch 完成后自动进入下一个 Batch。

在 B112 的 VPS-CHINA 实机执行点之前：

```
NEED_USER_INPUT=false
safe_next_action_exists=true
stop_allowed=false
```

禁止：

- WAIT_PM
- 中途自行停止
- 把 API PASS 当页面 PASS
- 把代码存在当功能 PASS
- 把 fixture 当真实 PASS
- 把 handler 当 Human Input PASS
- 因一个 Batch 失败重跑全部项目

失败：

- 只修当前 Batch/受影响依赖
- 其他 PASS 保持

最终以 B119 为唯一关闭 Gate。
