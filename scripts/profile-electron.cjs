// Run after npm run build. Uses installed Electron and an existing Playwright runtime.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output/performance', new Date().toISOString().replace(/[:.]/g,'-'));
fs.mkdirSync(output, {recursive:true});
const playwrightPath = process.env.PLAYWRIGHT_RUNTIME || path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { _electron: electron } = require(playwrightPath);
const pause = ms => new Promise(resolve=>setTimeout(resolve,ms));
const startupRuns = Number(process.env.MR_PERF_STARTUP_RUNS || 3);
if (![1,2,3].includes(startupRuns)) throw new Error('Startup runs must be 1–3');
const sampleMs = Number(process.env.MR_PERF_SAMPLE_MS || 5000);
if (!Number.isFinite(sampleMs) || sampleMs < 5000 || sampleMs > 30000) throw new Error('Sample interval must be 5000–30000 ms');
async function snapshot(app) {
  return app.evaluate(({app,BrowserWindow}) => ({ at:Date.now(),processes:app.getAppMetrics(),windows:BrowserWindow.getAllWindows().map(w=>({id:w.id,visible:w.isVisible(),url:w.webContents.getURL()})),fixture:{requests:global.__performanceFixture.requests.length,blocked:global.__performanceFixture.blocked} }));
}
async function sample(app,label) {
  await pause(3000);
  const before=await snapshot(app);
  await pause(sampleMs);
  const after=await snapshot(app);
  const old=new Map(before.processes.map(p=>[p.pid,p]));
  const elapsed=(after.at-before.at)/1000;
  const rows=after.processes.map(p=>{
    const prior=old.get(p.pid);const cpu=p.cpu?.cumulativeCPUUsage;const oldCPU=prior?.cpu?.cumulativeCPUUsage;
    return {pid:p.pid,type:p.type,name:p.name||'',cpuOneCorePercent:typeof cpu==='number'&&typeof oldCPU==='number'?(cpu-oldCPU)/elapsed*100:null,workingSetMiB:p.memory.workingSetSize/1024,privateMiB:typeof p.memory.privateBytes==='number'?p.memory.privateBytes/1024:null};
  });
  const total={cpuOneCorePercent:rows.every(p=>p.cpuOneCorePercent!==null)?rows.reduce((n,p)=>n+p.cpuOneCorePercent,0):null,workingSetMiB:rows.reduce((n,p)=>n+p.workingSetMiB,0),privateMiB:rows.every(p=>p.privateMiB!==null)?rows.reduce((n,p)=>n+p.privateMiB,0):null};
  const result={label,elapsedSeconds:elapsed,total,processes:rows,requestsDuringSample:after.fixture.requests-before.fixture.requests,windows:after.windows,rawBefore:before,rawAfter:after};
  console.log(JSON.stringify({phase:label,elapsedSeconds:elapsed,...total,processes:rows.length,requestsDuringSample:result.requestsDuringSample}));
  return result;
}
async function launch(index){
 const start=performance.now();
 const env={...process.env,NODE_ENV:'production',MR_PERF_PROFILE:path.join(output,`profile-${index}`)};delete env.ELECTRON_RUN_AS_NODE;
 const app=await electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:[path.join(root,'scripts/profile-electron-main.cjs')],cwd:root,env,timeout:30000});
 app.process().stdout?.on('data',data=>fs.appendFileSync(path.join(output,`electron-${index}.log`),data));
 app.process().stderr?.on('data',data=>fs.appendFileSync(path.join(output,`electron-${index}.log`),data));
 const dashboard=app.windows().find(page=>page.url().includes('renderer/index.html')) || await app.waitForEvent('window',{predicate:page=>page.url().includes('renderer/index.html'),timeout:30000});
 if(!dashboard)throw new Error('Dashboard window not found');
 await dashboard.waitForFunction(()=>window.electronAPI && document.body.textContent.includes('My Reviews'));
 await dashboard.getByRole('button',{name:'My Reviews 50',exact:true}).waitFor({timeout:30000});
 await dashboard.getByRole('button',{name:'All Open 200',exact:true}).waitFor();
 // Include the real splash lifecycle; usable means the OS window is visible.
 await app.evaluate(async({BrowserWindow})=>{const end=Date.now()+10000;while(Date.now()<end){if(BrowserWindow.getAllWindows().some(w=>!w.webContents.getURL().includes('splash')&&w.isVisible()))return;await new Promise(r=>setTimeout(r,25));}throw new Error('Dashboard stayed hidden');});
 const startupMs=performance.now()-start;
 console.log(JSON.stringify({startupRun:index,startupMs}));
 return {app,dashboard,startupMs};
}
(async()=>{
 const result={measuredAt:new Date().toISOString(),platform:process.platform,osRelease:os.release(),cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,totalSystemMemoryGiB:os.totalmem()/1024**3,sampleMs,method:'Full unpackaged Electron production dist, real main/preload/IPC/client/scheduler, deterministic read-only fixtures; warm filesystem, fresh isolated profiles.',startupMs:[],mrUsableMs:[],phases:[]};
 for(let i=1;i<=startupRuns;i++){
  let app;
  try{
   const launched=await launch(i);app=launched.app;const dashboard=launched.dashboard;result.startupMs.push(launched.startupMs);
   if(i<startupRuns)continue;
   result.versions=await app.evaluate(()=>process.versions);
   await dashboard.screenshot({path:path.join(output,'dashboard.png')});
   result.phases.push(await sample(app,'dashboard-visible'));
   const windows=[];
   for(let iid=1;iid<=3;iid++){
    const start=performance.now();const pending=app.waitForEvent('window');
    await dashboard.evaluate(iid=>window.electronAPI.openMRWindow(2,iid),iid);
    const page=await pending;windows.push(page);
    await page.getByRole('textbox',{name:'Comment',exact:true}).waitFor();
    await page.locator('.w-md-editor').waitFor();
    await page.waitForFunction(()=>{const field=document.querySelector('textarea[aria-label="Comment"]');return field&&!field.disabled});
    result.mrUsableMs.push(performance.now()-start);
    if(iid===1){
      await page.getByRole('textbox',{name:'Comment',exact:true}).fill('Performance fixture draft');
      await page.getByRole('button',{name:'Insert emoji',exact:true}).scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(output,'mr-default-markdown.png')});
      result.phases.push(await sample(app,'dashboard-and-one-mr'));
    }
   }
   result.phases.push(await sample(app,'dashboard-and-three-mrs'));
   await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.hide()));
   result.phases.push(await sample(app,'all-four-windows-hidden-to-tray'));
   fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(result,null,2));
   const page=windows[0];
   await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('mrIid=1'))?.show());
   await page.bringToFront();
   await page.getByRole('button',{name:'Insert emoji',exact:true}).click();
   await page.getByRole('button',{name:'😀',exact:true}).first().waitFor({timeout:10000});
   await page.screenshot({path:path.join(output,'mr-smile-picker.png')});
   await page.getByRole('button',{name:'😀',exact:true}).first().click();
   const value=await page.getByRole('textbox',{name:'Comment',exact:true}).inputValue();
   if(!value.includes('😀'))throw new Error('Emoji icon did not insert character');
   result.emojiInserted=true;
   result.fixture=await app.evaluate(()=>global.__performanceFixture);
  }finally{if(app)await app.close();fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(result,null,2));}
 }
 console.log('RESULTS '+path.join(output,'results.json'));
})().catch(error=>{console.error(error);process.exitCode=1});
