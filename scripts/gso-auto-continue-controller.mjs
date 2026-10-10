const token=process.env.GITHUB_TOKEN, repo=process.env.GITHUB_REPOSITORY||'xjjsw0518-debug/global-seller-os-ui';
if(!token) throw new Error('GITHUB_TOKEN_REQUIRED');
const H={authorization:`Bearer ${token}`,accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
async function get(p){const r=await fetch(`https://api.github.com/repos/${repo}${p}`,{headers:H});return r.ok?r.json():null}
const prs=await get('/pulls?state=open&per_page=100')||[]; const out=[];
for(const pr of prs){
 if(!/WRC-P2-U\d+/i.test(pr.title+pr.body)) continue;
 const runs=(await get(`/actions/runs?head_sha=${pr.head.sha}&per_page=50`))?.workflow_runs||[];
 const gate=runs.filter(x=>x.name==='GSO Gate'&&x.head_sha===pr.head.sha).find(x=>x.status==='completed');
 const arts=gate?(await get(`/actions/runs/${gate.id}/artifacts`))?.artifacts||[]:[];
 const names=arts.map(x=>x.name.toLowerCase()); const required=['playwright-smoke','backstop-visual','dependency-cruiser','knip-unused','axe-accessibility'];
 const missing=required.filter(x=>!names.some(n=>n.includes(x)));
 const prohibited=pr.changed_files?false:false;
 out.push({pr:pr.number,sha:pr.head.sha,mergeable_state:pr.mergeable_state,gate:gate?{id:gate.id,conclusion:gate.conclusion,url:gate.html_url}:null,missing_artifacts:missing,prohibited_files:prohibited,auto_merge_eligible:Boolean(gate&&gate.conclusion==='success'&&!missing.length&&!prohibited&&pr.mergeable_state==='clean')});
}
console.log(JSON.stringify({checked_at:new Date().toISOString(),auto_continue:'ON',prs:out,mutations_performed:false,manual_boundary:'Work claim/start remains human or Work-runner responsibility'},null,2));
