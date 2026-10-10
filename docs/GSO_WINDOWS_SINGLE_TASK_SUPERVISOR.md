# GSO Windows 单任务常驻调度器（MVP）

这是 Windows Terminal 内一次启动、只跟踪一个 GitHub Issue、持续检查并自动启动已有 Codex Controller 的最小实现。进程独立于 ChatGPT Work 窗口。

## 已实现

- 绑定一个明确仓库、Issue 和已审查的 EXECUTE Manifest。轮询频率与允许的授权启动次数设有上限。
- 只读取受保护本机 stateDir 的新授权文件和 GitHub 上的可信任务状态。没有有效新授权，保持等待；不会签发新授权。
- 找到唯一、版本匹配的新授权时，先记录不可重复分发的持久 ledger，然后启动已有 Windows Executor。原 Executor 负责模型调用、文件验证、PR 和 Gate。
- Controller 成功交付至 PR_REVIEW_REQUIRED 时停止；BLOCKED、失败、未知状态、授权歧义或预算耗尽时停止，绝不重复调用已经使用过的模型授权。
- 单实例锁、独立日志与 heartbeat；不会触及已停止的 Work、已完成的 PR #36 或 Issue #21 旧 Journal。

## Windows 一次启动

必须在独立 Windows Terminal / PowerShell 中运行，不能把它作为 ChatGPT Work 进程的子任务。

先编辑配置文件，绑定经过审查的单一新任务及对应 Manifest。仓库的示例配置特意使用历史 BLOCKED 的 Issue #21，只可用于预检，不能用旧授权重新执行它。

只读配置预检：

    powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\start-gso-single-task-supervisor.ps1" -RepoRoot "C:\path\to\global-seller-os-ui" -TaskConfig "C:\path\to\global-seller-os-ui\control\local-bridge\single-task-supervisor.example.json"

新任务已有单独执行授权且检查通过后，才可在相同命令末尾加 -Run：

    powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\start-gso-single-task-supervisor.ps1" -RepoRoot "C:\path\to\global-seller-os-ui" -TaskConfig "C:\path\to\reviewed-task.json" -Run

- Windows 需要 Node.js、Git 和可用的现有 Codex CLI/GitHub Controller 登录。
- 即使关闭 Work 窗口，独立 Windows Terminal 仍可保持进程运行。
- Ctrl+C 停止下一轮轮询；若 Executor 子进程已启动，不要未经核实强制删除授权回执或恢复锁。

## 实际状态位置

Supervisor 沿用 Executor 的仓库外状态目录（通常位于 Windows LOCALAPPDATA 下），使用以下相对文件：

- single-task/issue-N/heartbeat.json：当前等待/停止信息。
- single-task/issue-N/dispatch-ledger.json：发车登记与已使用授权 ID。
- single-task/logs/run-HASH.log：Executor 的本机日志。
- locks/single-task-N.lock：排他执行锁。

异常退出后必须先核验真实子进程、Ledger、一次性授权回执、Controller Journal 和 GitHub 状态，不能简单删除锁或复用授权。当前崩溃恢复为 fail-closed，而不是未经核验的自动重启。

## 明确不包含

这个初版是“自动发现已授权任务 + 持续等待 + 自动发起一个已审查的 Executor 调用”。并不是无限 Codex 自主推理循环：每次模型调用仍需要原 Controller 支持的独立、新鲜授权。

尚未实现 Windows 开机自启、无人干预的崩溃重启、同一任务内部的多轮 Codex 修复预算或已 BLOCKED 的 PR #36 Controller-only 最终恢复。后续需要分别实施与验收。

严禁重放历史 Issue #21 的模型授权、自动合并 PR、启动另一个 Issue 或将本 MVP 的通过等同于真实无人值守的端到端验收。
