// Harness entry point only: production app code runs unchanged in an isolated profile.
const fs = require('node:fs');
const path = require('node:path');
const { app, session, Notification } = require('electron');
const root = path.resolve(__dirname, '..');
const profile = process.env.MR_PERF_PROFILE;
if (!profile || !path.resolve(profile).startsWith(path.join(root, 'output', 'performance') + path.sep)) {
  throw new Error('MR_PERF_PROFILE must be a child of output/performance');
}
fs.mkdirSync(profile, { recursive: true });
app.setPath('userData', profile);
app.setAppPath(root);
// Do not alter Windows login registration, show desktop notifications, or touch
// the installed app's fixed lock file/named pipe during an isolated benchmark.
app.setLoginItemSettings = () => {};
app.getLoginItemSettings = () => ({ openAtLogin: false, wasOpenedAsHidden: false, wasOpenedAtLogin: false });
Notification.prototype.show = () => {};
const singletonPath = require.resolve(path.join(root, 'dist/main/single-instance.js'));
require.cache[singletonPath] = { id: singletonPath, filename: singletonPath, loaded: true, exports: {
  acquireSingleInstanceChannel: async () => true,
  setSecondInstanceHandler: () => {},
  cleanupSingleInstanceChannelSync: () => {},
  cleanupSingleInstanceChannel: async () => {},
}};
const avatar = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#c65b19"/><text x="7" y="22" fill="white">QA</text></svg>');
const user = { id: 7, name: 'Fixture Reviewer', username: 'fixture', avatar_url: avatar, web_url: 'https://fixture.invalid/users/7' };
function mr(i) {
  return { id: 1000+i, iid: i, project_id: 2, references: { full: `platform/review-manager!${i}` }, title: `Review ${i}: reliable synchronization and reviewer experience`, description: '## Review summary\n\nA production renderer performance fixture with **Markdown** formatting.\n\n- Preserve user drafts\n- Avoid redundant refreshes\n- Keep the reviewer focused', state: 'opened', created_at: '2026-09-01T10:00:00Z', updated_at: '2026-09-19T02:00:00Z', author: user, assignees: [], reviewers: [user], source_branch: `feature/review-${i}`, target_branch: 'main', web_url: `https://fixture.invalid/projects/2/merge_requests/${i}`, approvals_required: 1, approvals_left: 1, draft: false, has_conflicts: false, detailed_merge_status: 'mergeable', sha: 'fixture-head-'+i, head_pipeline: { id: i, status: 'success' }, labels: [{name:'frontend',color:'#ff7900',text_color:'#ffffff'}], user: { can_merge: true } };
}
const all = Array.from({ length: 200 }, (_, i) => mr(i+1));
const discussions = Array.from({ length: 10 }, (_, i) => ({ id: `thread-${i}`, individual_note: false, notes: [{ id:i+1,body:`Review observation ${i+1}: verify the behavior with representative data.`,author:user,created_at:'2026-09-19T02:00:00Z',updated_at:'2026-09-19T02:00:00Z',system:false,resolvable:false,resolved:false,type:null }] }));
const changes = Array.from({ length: 20 }, (_, i) => ({ new_path:`src/modules/module-${i+1}.ts`,old_path:`src/modules/module-${i+1}.ts`,a_mode:'100644',b_mode:'100644',new_file:false,renamed_file:false,deleted_file:false,diff:'@@ -1,20 +1,20 @@\n'+Array.from({length:20},(_,line)=>line===5?' const updated = true;':` const line${line} = ${line};`).join('\n') }));
global.__performanceFixture = { requests: [], blocked: [] };
global.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  const method = init.method || 'GET';
  if (url.origin !== 'https://fixture.invalid' || method !== 'GET') {
    global.__performanceFixture.blocked.push({ method, url: url.origin + url.pathname });
    throw new Error('Performance harness blocks all external requests and mutations');
  }
  const pathname = url.pathname.replace('/api/v4', '');
  global.__performanceFixture.requests.push(pathname);
  await new Promise(resolve => setTimeout(resolve, 12));
  let result;
  if (pathname === '/user') result = user;
  else if (pathname === '/groups') result = [];
  else if (pathname === '/merge_requests') {
    const list = url.searchParams.has('author_id') ? [] : url.searchParams.has('reviewer_id') ? all.slice(0,50) : all;
    const perPage = Number(url.searchParams.get('per_page') || 100);
    const page = Number(url.searchParams.get('page') || 1);
    result = list.slice((page-1)*perPage,page*perPage);
  } else if (/\/merge_requests\/\d+\/pipelines$/.test(pathname)) result = [{ id:1, status:'success' }];
  else if (/\/merge_requests\/\d+\/approvals$/.test(pathname)) result = { approved_by:[] };
  else if (/\/merge_requests\/\d+\/changes$/.test(pathname)) result = { changes };
  else if (/\/merge_requests\/\d+\/discussions$/.test(pathname)) result = Number(url.searchParams.get('page') || 1) === 1 ? discussions : [];
  else if (/\/merge_requests\/\d+\/award_emoji$/.test(pathname)) result = [];
  else if (/\/merge_requests\/\d+$/.test(pathname)) result = mr(Number(pathname.split('/').pop()));
  else if (/\/pipelines\/\d+\/jobs$/.test(pathname)) result = [];
  else throw new Error('Unhandled fixture GET: '+pathname);
  return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type':'application/json' } });
};
// Other transports must never reach a real server, including updater/relay paths.
for (const name of ['node:http','node:https']) {
  const transport = require(name);
  transport.request = transport.get = () => { throw new Error('External network disabled by performance harness'); };
}
app.whenReady().then(() => {
  session.defaultSession.webRequest.onBeforeRequest({ urls:['http://*/*','https://*/*','ws://*/*','wss://*/*'] }, (details, callback) => {
    global.__performanceFixture.blocked.push({ method: details.method, url: details.url });
    callback({ cancel:true });
  });
});
fs.writeFileSync(path.join(profile,'config.json'),JSON.stringify({gitlabUrl:'https://fixture.invalid',encryptedToken:'plain:'+Buffer.from('fixture-token-not-a-secret').toString('base64'),webhookEnabled:false,webhookUseTunnel:false,webhookPublicUrl:'',launchAtStartup:false,launchAtStartupDefaultApplied:true,hasRunBefore:true,lastSeenVersion:app.getVersion(),refreshIntervalMinutes:5,notifyOnMyMRMerged:false,notifyOwnerGroupIds:[],projectIds:[]}));
require(path.join(root,'dist/main/index.js'));
