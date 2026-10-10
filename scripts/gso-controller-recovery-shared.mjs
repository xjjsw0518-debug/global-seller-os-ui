import { spawnSync } from 'node:child_process';

function runGit(repoRoot, args) {
  const result = spawnSync('git', ['-C', repoRoot, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30_000,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`GIT_FAILED:${args[0]}:${result.status ?? result.error?.code ?? 'UNKNOWN'}`);
  }
  return result.stdout || '';
}

// Parse NUL-delimited porcelain without stripping the leading XY status columns.
// For renames/copies, include both paths so neither side can evade a whitelist.
export function parseGitPorcelainChangedPaths(rawStatus) {
  if (typeof rawStatus !== 'string') throw new Error('GIT_PORCELAIN_OUTPUT_INVALID');
  if (!rawStatus) return [];
  if (!rawStatus.endsWith('\0')) throw new Error('GIT_PORCELAIN_RECORD_NOT_TERMINATED');
  const entries = rawStatus.slice(0, -1).split('\0');
  const paths = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const xy = entry.slice(0, 2);
    if (entry.length < 4 || entry[2] !== ' ' || !/^[ MARCUDT?!]{2}$/.test(xy)) {
      throw new Error('GIT_PORCELAIN_RECORD_INVALID');
    }
    const path = entry.slice(3);
    if (!path) throw new Error('GIT_PORCELAIN_PATH_MISSING');
    paths.push(path);
    if (xy.includes('R') || xy.includes('C')) {
      const originalPath = entries[++index];
      if (!originalPath) throw new Error('GIT_PORCELAIN_RENAME_SOURCE_MISSING');
      paths.push(originalPath);
    }
  }
  return [...new Set(paths)];
}

export function changedPaths(repoRoot) {
  return parseGitPorcelainChangedPaths(runGit(repoRoot, [
    'status', '--porcelain=v1', '-z', '--untracked-files=all',
  ]));
}

export function applyControllerDevStatus(current, binding) {
  const {
    now,
    repository,
    issueNumber,
    taskId,
    taskName,
    owner,
    nextActionInstruction,
    pr,
    headSha,
    gate,
  } = binding;
  const item = {
    id: taskId,
    name: taskName,
    status: 'FINAL_GATE_PENDING',
    owner,
    evidence: `Issue #${issueNumber}; PR #${pr.number}; preliminary exact-head GSO Gate ${gate.run_id}`,
    next_step: 'Review and merge the PR only after its final status-update head passes the full GSO Gate.',
  };
  return {
    ...current,
    overall_status: current.overall_status,
    current_step: `${taskId} PR #${pr.number} passed its development Gate; final status-head Gate pending`,
    last_updated: now,
    auto_loop: {
      ...(current.auto_loop || {}),
      status: current.auto_loop?.status,
      current_running_issue: null,
      ready_queue: (current.auto_loop?.ready_queue || []).filter((entry) => entry !== taskId),
      last_controller_check: now,
      last_recovery_action: `Windows bridge created PR #${pr.number}; no automatic merge was attempted.`,
      user_approval_required: false,
    },
    latest_actions_run: {
      name: `GSO Gate ${gate.run_id}`,
      url: gate.html_url,
      status: 'SUCCESS',
      head_sha: headSha,
    },
    completed: (current.completed || []).filter((entry) => entry.id !== taskId),
    in_progress: [...(current.in_progress || []).filter((entry) => entry.id !== taskId), item],
    todo: (current.todo || []).filter((entry) => entry.id !== taskId),
    next_safe_unit: `Review the bounded ${taskId} PR and its final exact-head Gate; do not auto-merge.`,
    next_action: {
      id: `${taskId}-PR-REVIEW`,
      status: 'READY',
      issue_number: issueNumber,
      issue_url: `https://github.com/${repository}/issues/${issueNumber}`,
      pr_number: pr.number,
      pr_url: pr.html_url,
      instruction: nextActionInstruction,
      requires_manual_prompt_copying: false,
      requires_work_session_start: false,
    },
  };
}
