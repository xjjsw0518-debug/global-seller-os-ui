import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const U00E_FINAL_STATE = 'FINAL_STATE=WRC_P2_U00E_ROUTE_AUDIT_READY';
export const U00F_MARKER = '<!-- gso-auto-loop:WRC-P2-U00F -->';
export const U00F_RESUME_MARKER = '<!-- gso-auto-loop:WRC-P2-U00F:resume -->';
export const U00E_TRANSITION_MARKER = '<!-- gso-auto-loop:WRC-P2-U00E:transitioned -->';

const U00F_TITLE = '[WRC-P2-U00F] Define standalone resource-list API contract (deferred decision)';
const U00F_NAME = 'WRC-P2-U00F — Define standalone resource-list API contract (deferred decision)';
const U00F_INSTRUCTION = [
  'Continue from WRC-P2-U00E into WRC-P2-U00F as a contract-decision unit only.',
  'Record standalone resource-list API as DEFERRED for the current phase and continue to reuse overview/map-data.',
  'Define future pagination, filtering, sorting, query, response, error, and authorization semantics.',
  'Do not modify business UI/code, add a backend route, change the frontend read path, call a business-write API, or change BackstopJS baselines or Gate thresholds.',
].join(' ');

export function hasU00ECompletion(issue, comments = []) {
  return [issue?.body, ...comments.map((comment) => comment?.body)]
    .filter(Boolean)
    .some((text) => text.includes(U00E_FINAL_STATE));
}

export function buildU00FIssueBody(sourceIssueUrl) {
  return `${U00F_MARKER}
## Status

\`READY\`

## Trigger evidence

- Source: ${sourceIssueUrl}
- Completion marker: \`${U00E_FINAL_STATE}\`
- Decision from U00E: the standalone resource-list endpoint is not part of the current frontend read path; \`overview\` and \`map-data\` already provide the required resources data.

## Scope

- Decide whether a standalone resource-list API is needed in a future phase.
- Keep it \`DEFERRED\` for the current phase.
- Document future pagination, filtering, sorting, query, response, error-code, and authorization semantics.
- Confirm that the current phase continues to reuse \`overview\` and \`map-data\`.

## Prohibited changes

- No business UI or business-code changes.
- No backend route or frontend read-path changes.
- No database, container, service, secret, root, or business-write API operations.
- No BackstopJS baseline or Gate-threshold changes.

## Controller resume instruction

${U00F_INSTRUCTION}

The GitHub controller publishes this next action, but it cannot start or wake a stopped Codex Work session. A Work-capable platform runner must claim this READY issue.
`;
}

export function applyU00FStatus(status, { now, issueNumber, issueUrl }) {
  const completed = [...(status.completed || [])];
  const u00e = {
    id: 'WRC-P2-U00E',
    name: 'Worker standalone resource-list route audit',
    status: 'PASS',
    owner: 'GSO Automation',
    evidence: U00E_FINAL_STATE,
    next_step: U00F_NAME,
  };
  const completedIndex = completed.findIndex((item) => item.id === u00e.id);
  if (completedIndex === -1) completed.push(u00e);
  else completed[completedIndex] = u00e;

  const todo = [...(status.todo || [])].filter((item) => item.id !== 'WRC-P2-U00F');
  todo.push({
    id: 'WRC-P2-U00F',
    name: U00F_NAME,
    status: 'READY',
    owner: 'GSO Automation',
    evidence: `GitHub Issue #${issueNumber}`,
    next_step: 'A Work-capable runner may claim the contract-decision unit; no business coding is authorized.',
  });

  const issuesToResolve = (status.issues_to_resolve || []).map((item) =>
    item.id === 'worker-resource-list-route'
      ? {
          ...item,
          status: 'DEFERRED',
          evidence: 'U00E route audit: overview/map-data are the active read contract',
          next_step: `Resolve the future API contract in GitHub Issue #${issueNumber}; do not add a route in the current phase.`,
        }
      : item,
  );

  return {
    ...status,
    overall_status: 'READY',
    current_step: U00F_NAME,
    last_updated: now,
    auto_loop: {
      ...(status.auto_loop || {}),
      status: 'ON',
      batch: 'wrc-p2-resource-contract',
      current_running_issue: null,
      ready_queue: ['WRC-P2-U00F'],
      last_controller_check: now,
      last_recovery_action: 'Detected WRC-P2-U00E completion and published the WRC-P2-U00F next action.',
      user_approval_required: false,
      resume_instruction: U00F_INSTRUCTION,
      platform_auto_start_supported: false,
    },
    completed,
    todo,
    issues_to_resolve: issuesToResolve,
    next_action: {
      id: 'WRC-P2-U00F',
      status: 'READY',
      issue_number: issueNumber,
      issue_url: issueUrl,
      instruction: U00F_INSTRUCTION,
      requires_manual_prompt_copying: false,
      requires_work_session_start: true,
    },
    next_safe_unit: U00F_NAME,
  };
}

class GitHubClient {
  constructor({ owner, repo, token, fetchImpl = fetch }) {
    this.base = `https://api.github.com/repos/${owner}/${repo}`;
    this.token = token;
    this.fetch = fetchImpl;
  }

  async request(method, path, body, { allowNotFound = false } = {}) {
    const response = await this.fetch(`${this.base}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.token}`,
        accept: 'application/vnd.github+json',
        'content-type': 'application/json',
        'x-github-api-version': '2022-11-28',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (allowNotFound && response.status === 404) return null;
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`GitHub API ${method} ${path} failed (${response.status}): ${detail.slice(0, 500)}`);
    }
    if (response.status === 204) return null;
    return response.json();
  }

  get(path) { return this.request('GET', path); }
  post(path, body) { return this.request('POST', path, body); }
  patch(path, body) { return this.request('PATCH', path, body); }
  put(path, body) { return this.request('PUT', path, body); }
  delete(path, options) { return this.request('DELETE', path, undefined, options); }
}

async function ensureComment(client, issueNumber, marker, body) {
  const comments = await client.get(`/issues/${issueNumber}/comments?per_page=100`);
  const existing = comments.find((comment) => comment.body?.includes(marker));
  if (existing) return { comment: existing, created: false };
  const comment = await client.post(`/issues/${issueNumber}/comments`, { body: `${marker}\n${body}` });
  return { comment, created: true };
}

async function writeDevStatus(client, defaultBranch, now, nextIssue) {
  const path = 'public/dev-status.json';
  const file = await client.get(`/contents/${path}?ref=${encodeURIComponent(defaultBranch)}`);
  const current = JSON.parse(Buffer.from(file.content.replace(/\s/g, ''), 'base64').toString('utf8'));
  const updated = applyU00FStatus(current, {
    now,
    issueNumber: nextIssue.number,
    issueUrl: nextIssue.html_url,
  });
  if (current.next_action?.id === 'WRC-P2-U00F') return { changed: false };
  const result = await client.put(`/contents/${path}`, {
    message: 'chore: publish WRC-P2-U00F next action',
    content: Buffer.from(`${JSON.stringify(updated, null, 2)}\n`, 'utf8').toString('base64'),
    sha: file.sha,
    branch: defaultBranch,
  });
  return { changed: true, commit: result.commit };
}

export async function runController({ env = process.env, fetchImpl = fetch, now = new Date() } = {}) {
  const owner = env.GITHUB_REPOSITORY_OWNER || env.GITHUB_REPOSITORY?.split('/')[0] || 'xjjsw0518-debug';
  const repo = env.GITHUB_REPOSITORY?.split('/')[1] || 'global-seller-os-ui';
  const token = env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is required');

  const client = new GitHubClient({ owner, repo, token, fetchImpl });
  const checkedAt = now.toISOString();
  const staleMinutes = Number(env.AUTO_LOOP_STALE_MINUTES || 120);
  const repository = await client.get('');
  const issues = await client.get('/issues?state=all&per_page=100');
  const openIssues = issues.filter((issue) => issue.state === 'open' && !issue.pull_request);
  const prs = await client.get('/pulls?state=open&per_page=100');
  const sourceIssue = issues.find((issue) => !issue.pull_request && /WRC-P2-U00(?:\]|\b)/.test(issue.title));
  const sourceComments = sourceIssue ? await client.get(`/issues/${sourceIssue.number}/comments?per_page=100`) : [];
  const completionDetected = hasU00ECompletion(sourceIssue, sourceComments);
  const mutations = [];
  let nextIssue = issues.find((issue) => !issue.pull_request && issue.body?.includes(U00F_MARKER));

  if (completionDetected) {
    if (!nextIssue) {
      nextIssue = await client.post('/issues', {
        title: U00F_TITLE,
        body: buildU00FIssueBody(sourceIssue.html_url),
      });
      mutations.push(`created_issue_${nextIssue.number}`);
    } else if (nextIssue.state !== 'open') {
      nextIssue = await client.patch(`/issues/${nextIssue.number}`, { state: 'open' });
      mutations.push(`reopened_issue_${nextIssue.number}`);
    }

    const resume = await ensureComment(
      client,
      nextIssue.number,
      U00F_RESUME_MARKER,
      `AUTO_LOOP_NEXT_ACTION_READY\n\n${U00F_INSTRUCTION}\n\nNo manual prompt rewriting or copying is required. A Work-capable runner still has to claim/start this issue because GitHub Actions cannot wake a stopped Codex Work session.`,
    );
    if (resume.created) mutations.push(`commented_issue_${nextIssue.number}`);

    const transition = await ensureComment(
      client,
      sourceIssue.number,
      U00E_TRANSITION_MARKER,
      `Auto-Loop detected \`${U00E_FINAL_STATE}\` and published the next safe unit in #${nextIssue.number}. No Worker business coding was started.`,
    );
    if (transition.created) mutations.push(`commented_issue_${sourceIssue.number}`);

    if (sourceIssue.labels?.some((label) => label.name === 'status:blocked')) {
      await client.delete(`/issues/${sourceIssue.number}/labels/${encodeURIComponent('status:blocked')}`, { allowNotFound: true });
      mutations.push(`cleared_stale_blocker_${sourceIssue.number}`);
    }

    const statusWrite = await writeDevStatus(client, repository.default_branch, checkedAt, nextIssue);
    if (statusWrite.changed) {
      mutations.push('updated_dev_status');
      await client.post('/actions/workflows/gso-gate.yml/dispatches', { ref: repository.default_branch });
      mutations.push('dispatched_gso_gate');
    }
  }

  const running = openIssues.filter((issue) => /RUNNING|running/i.test(issue.labels?.map((label) => label.name).join(' ') || issue.title));
  const stale = running
    .filter((issue) => now.getTime() - Date.parse(issue.updated_at) > staleMinutes * 60000)
    .map((issue) => ({ number: issue.number, title: issue.title, state: 'STALE' }));
  const prChecks = await Promise.all(prs.map(async (pr) => ({
    number: pr.number,
    url: pr.html_url,
    sha: pr.head.sha,
    mergeable: pr.mergeable_state,
    runs: (await client.get(`/actions/runs?head_sha=${pr.head.sha}&per_page=20`)).workflow_runs || [],
  })));

  return {
    checked_at: checkedAt,
    state: env.AUTO_LOOP_MODE || 'ON',
    completion_marker: U00E_FINAL_STATE,
    completion_detected: completionDetected,
    next_issue: nextIssue ? { number: nextIssue.number, url: nextIssue.html_url, state: nextIssue.state } : null,
    running_count: running.length,
    stale,
    prs: prChecks.map((pr) => ({ ...pr, gateRuns: pr.runs.filter((run) => run.name === 'GSO Gate') })),
    blocked_user_approval_required: completionDetected
      ? false
      : openIssues.some((issue) => /BLOCKED_USER_APPROVAL_REQUIRED/i.test(issue.body || '') || issue.labels?.some((label) => label.name === 'status:blocked')),
    automatic_mutations: mutations.length > 0,
    mutations,
    platform_auto_start_supported: false,
  };
}

async function main() {
  const report = await runController();
  console.log(JSON.stringify(report, null, 2));
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) await main();
