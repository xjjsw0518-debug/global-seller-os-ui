const owner = process.env.GITHUB_REPOSITORY_OWNER || 'xjjsw0518-debug';
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'global-seller-os-ui';
const token = process.env.GITHUB_TOKEN;
const now = Date.now();
const staleMinutes = Number(process.env.AUTO_LOOP_STALE_MINUTES || 120);
const statusPath = process.env.AUTO_LOOP_STATUS_PATH || 'public/dev-status.json';
const api = async (path) => { if (!token) return null; const r = await fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {headers:{authorization:`Bearer ${token}`,accept:'application/vnd.github+json'}}); return r.ok ? r.json() : null; };
const issues = await api('/issues?state=open&per_page=100') || [];
const prs = await api('/pulls?state=open&per_page=100') || [];
const running = issues.filter(i => /RUNNING|running/i.test(i.labels?.map?.(x=>x.name).join(' ') || i.title));
const stale = running.filter(i => now - Date.parse(i.updated_at) > staleMinutes * 60000).map(i=>({number:i.number,title:i.title,state:'STALE'}));
const prChecks = await Promise.all(prs.map(async pr => ({number:pr.number,url:pr.html_url,sha:pr.head.sha,mergeable:pr.mergeable_state, runs:(await api(`/actions/runs?head_sha=${pr.head.sha}&per_page=20`))?.workflow_runs || []})));
const gate = prChecks.map(p=>({...p, gateRuns:p.runs.filter(r=>r.name==='GSO Gate')}));
let status = null; try { status = JSON.parse(await (await fetch(new URL(`../../${statusPath}`, import.meta.url))).text()); } catch {}
const blockedApproval = issues.some(i => /BLOCKED_USER_APPROVAL_REQUIRED/i.test(i.body || '') || i.labels?.some?.(x=>x.name==='status:blocked'));
const report = {checked_at:new Date(now).toISOString(),state:process.env.AUTO_LOOP_MODE||'ON',running_count:running.length,stale,prs:gate,blocked_user_approval_required:blockedApproval,status_fresh:status ? (now-Date.parse(status.last_updated) <= staleMinutes*60000) : false,ready_queue:issues.filter(i=>/READY/i.test(i.body||'')).slice(0,3).map(i=>i.number),automatic_mutations:false};
console.log(JSON.stringify(report,null,2));
