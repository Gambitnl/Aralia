// WF-G276: a removal recipe needs comparison evidence, not an unsupported
// assurance that two values match. Fixtures never delete game data or execute
// a declared comparison command; clean authoring is not semantic acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as lint from './taskLint.mjs';
import {lintTask,formatLintReport} from './taskLint.mjs';
import {validatePlan,buildPrompt,seedPlan} from './orchestrate.mjs';
import {analyzePacketOwnership,checkPacketLaunchLocks,inspectPacketValueEquivalence} from './packetOwnership.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {publishClient,RELEASE_FILES} from './client-release.mjs';
import {createAgoraServer} from './server.mjs';

const lintOptions={fileExists:()=>true,ignoredPaths:()=>[],grepSrc:()=>true,basenameExists:()=>true,grepTypes:()=>[],checkFileFields:()=>[]};
test('WF276: original unprobed redundancy assertion is not a clean removal brief',()=>{
 const body="Delete the limitedUses re-attachment: the re-attachment is now redundant rather than wrong.";
 const report=lintTask({title:'Audit resource handling',body},lintOptions);
 assert.equal(report.clean,false);assert.match(formatLintReport(report).join('\n'),/WF-G276/);
});

const pending=()=>({claim:'Healing resource re-attachment comparison',left:'parser resource maxUses and resetOn',right:'leaf resource maxUses and resetOn',state:'unverified',reason:'Neither value path has been compared under current source.',probe:'Proposed focused comparison of both value paths and canonical resource limits.'});
const reported=()=>({claim:'Healing resource re-attachment comparison',left:'parser resource maxUses and resetOn',right:'leaf resource maxUses and resetOn',state:'reported_equal',probe:'node compare-resource-values.mjs --both-paths',evidence:'Ignored comparison receipt names the two outputs, fields and consumers reviewed.',observedAt:new Date().toISOString()});
const line=item=>'VALUE-EQUIVALENCE: '+JSON.stringify(item);
const packet=()=>({id:'VE-1',handle:'equivalence-worker',pet:'dream-girl',agent:'claude',scope:'Investigate resource delivery',files:['tools/agora/taskLint.mjs','tools/agora/taskLint.test.mjs']});
const plan=p=>({wave:'equivalence-'+process.pid+'-'+Date.now(),pet:'gf-sd',packets:[p]});

test('WF276: reported and unverified states remain distinct, bounded and explicit',()=>{
 for(const item of [pending(),reported()]){
  const report=lint.inspectValueEquivalence({body:line(item)});assert.deepEqual(report.issues,[]);assert.equal(report.declarations[0].state,item.state);
  const text=formatLintReport(lintTask({title:'Investigate resource delivery',body:line(item)},lintOptions)).join('\n');
  assert.match(text,/not semantic equality or deletion permission/);
  if(item.state==='unverified')assert.match(text,/unverified.*PROBE BEFORE DELETING/);
 }
 const bad=[{}, {...pending(),left:pending().right},{...reported(),probe:''},{...reported(),evidence:'TODO'},
  {...reported(),observedAt:new Date(Date.now()-86400001).toISOString()}, {...reported(),observedAt:new Date(Date.now()+600000).toISOString()},
  {...pending(),state:'verified'},{...pending(),evidence:'same'},{...pending(),extra:true},{...pending(),reason:'x'.repeat(2049)}];
 for(const item of bad)assert(lint.inspectValueEquivalence({body:line(item)}).issues.length,JSON.stringify(item));
 for(const body of ['VALUE-EQUIVALENCE: []','VALUE-EQUIVALENCE: {',line(pending())+'\n'+line(pending()),Array(33).fill(line(pending())).join('\n')])assert(lint.inspectValueEquivalence({body}).issues.length);
});

test('WF276: good metadata does not excuse another live claim or promote historical evidence',()=>{
 const claim='Delete the re-attachment because both code paths return the same value.';
 for(const task of [{body:line(reported())+'\n'+claim},{title:claim,body:line(pending())}])assert(lint.inspectValueEquivalence(task).issues.length);
 assert.deepEqual(lint.inspectValueEquivalence({body:'SNAPSHOT: '+claim+'\n'+line(pending())}).issues,[]);
});

test('WF276: comparison metadata grants no ownership, count obligations or verification commands',()=>{
 const item={...pending(),left:'src/unowned-old.ts correction',right:'src/unowned-new.ts parser',probe:'node generate 99 spells src/unowned-command.ts'};
 const p={...packet(),guidance:line(item)};const prompt=buildPrompt(plan(p),p);
 assert.deepEqual(lint.extractTaskOwnershipPaths({body:line(item)}),[]);
 const report=lintTask({title:'Investigate values',body:line(item)},lintOptions);
 assert.deepEqual(report.countSourceCheck.claims,[]);assert.deepEqual(report.pendingDiscoveries,[]);assert.deepEqual(report.dedupAcceptance.issues,[]);
 assert(!prompt.includes('Guidance:\n'+line(item)));assert.match(prompt,/unverified comparison permits investigation only/);assert.match(prompt,/no declared command executes automatically/);
 assert.equal(inspectPacketValueEquivalence(p).declarations.length,1);
 for(const valueEquivalence of ['bad',[{}],Array(33).fill(item)])assert.throws(()=>validatePlan(plan({...packet(),valueEquivalence})),/WF-G276/);
});

test('WF276: unsafe seeding has no effects; unresolved state persists once in durable briefs and both prompts',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'agora-equivalence-seed-')),app=createAgoraServer({dir:path.join(root,'store'),seatRosterPath:null});
 try{
  await new Promise(resolve=>app.listen(0,resolve));const p={...packet(),guidance:'Delete the re-attachment; it is redundant rather than wrong.'},candidate={...plan(p),baseUrl:'http://127.0.0.1:'+app.server.address().port};
  const snapshot=()=>({agents:app.store.listAgents(),campaigns:app.store.listCampaigns(),tasks:app.store.listTasks(),locks:app.store.listLocks()}),before=snapshot();
  await assert.rejects(()=>seedPlan(candidate,{env:{AGORA_DIR:path.join(root,'identity')}}),/WF-G276/);assert.deepEqual(snapshot(),before);
  delete p.guidance;p.valueEquivalence=[pending()];assert.equal(validatePlan(candidate),true);
  const seeded=await seedPlan(candidate,{env:{AGORA_DIR:path.join(root,'identity')}}),task=app.store.listTasks().find(t=>t.id===seeded[p.id]);
  assert.equal(task.body.split('\n').filter(l=>l.startsWith('VALUE-EQUIVALENCE:')).length,1);assert(task.body.includes(line(pending())));
  assert.equal(lint.inspectValueEquivalence(task).unverified.length,1);assert.deepEqual(app.store.listLocks(),[]);
  for(const agent of ['claude','codex']){
   const prompt=buildPrompt(candidate,{...p,agent},{taskId:task.id});assert(prompt.includes(line(pending())));assert.match(prompt,/unverified comparison permits investigation only/);
  }
 }finally{await app.close();assert.equal(path.dirname(root),path.resolve(os.tmpdir()));fs.rmSync(root,{recursive:true,force:true});}
});

test('WF276: task comparison state cannot disappear or change between partition and queued launch',async()=>{
 const p={...packet(),taskIds:['agora-dead.1'],valueEquivalence:[pending()]},task={id:'agora-dead.1',title:'Investigate values',body:line(pending()),refs:[],state:'open'};
 const candidate=plan(p);assert.equal(analyzePacketOwnership(candidate,[task],[]).ok,true);
 for(const body of ['',line({...pending(),reason:'Different unresolved scope'}),'Delete the old output because it is identical.']){
  const changed={...task,body};const check=analyzePacketOwnership(candidate,[changed],[]);assert.equal(check.ok,false);assert.match(check.errors.join('\n'),/WF-G276/);
  const calls=[],fetchImpl=async url=>{calls.push(url);return{ok:true,json:async()=>url.endsWith('/locks')?{locks:[]}:{tasks:[changed]}};};
  const fresh=await checkPacketLaunchLocks(candidate,p,{fetchImpl,taskId:task.id});assert.equal(fresh.ok,false);assert.match(fresh.errors.join('\n'),/WF-G276/);assert.equal(calls.length,2);
 }
});

const here=path.dirname(fileURLToPath(import.meta.url));
for(const [label,body]of [
 ['incidental review','Delete the limitedUses re-attachment: it is now redundant rather than wrong. Verify formatting afterward.'],
 ['negated probe','Do not probe; delete the limitedUses re-attachment because both code paths return the same value.'],
 ['split premise','Both code paths return the same value.\nDelete the limitedUses re-attachment.'],
])test('WF276 review: '+label+' cannot authorize an unprobed deletion',async()=>{
 const report=lintTask({title:'Investigate resource delivery',body},lintOptions);assert.equal(report.clean,false);
 const p={...packet(),guidance:body};assert.throws(()=>validatePlan(plan(p)),/WF-G276/);
 const current={...packet(),taskIds:['agora-dead.1']},task={id:'agora-dead.1',title:'Investigate resource delivery',body,refs:[],state:'open'};
 assert.equal(analyzePacketOwnership(plan(current),[task],[]).ok,false);
 const fetchImpl=async url=>({ok:true,json:async()=>url.endsWith('/locks')?{locks:[]}:{tasks:[task]}});
 const fresh=await checkPacketLaunchLocks(plan(current),current,{fetchImpl,taskId:task.id});assert.equal(fresh.ok,false);assert.match(fresh.errors.join('\n'),/WF-G276/);
});
function execute(file,args,env,cwd){return new Promise((resolve,reject)=>{
 const child=spawn(process.execPath,[file,...args],{env:{...process.env,...env},cwd,windowsHide:true});let stdout='',stderr='';
 const timeout=setTimeout(()=>{child.kill();reject(Error('fixture CLI timeout'));},30000);
 child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);child.once('error',e=>{clearTimeout(timeout);reject(e);});child.once('close',code=>{clearTimeout(timeout);resolve({code,stdout,stderr});});
});}
test('WF276: native immutable CLI refuses the original premise read-only and retains explicit unresolved evidence',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'agora-equivalence-native-')),source=path.join(root,'tools/agora');fs.mkdirSync(source,{recursive:true});
 for(const f of [...RELEASE_FILES,'client.mjs','client-release.mjs','agents.json'])fs.copyFileSync(path.join(here,f),path.join(source,f));
 const app=createAgoraServer({dir:path.join(root,'store'),seatRosterPath:null});
 try{
  await publishClient({repoRoot:root});await new Promise(resolve=>app.listen(0,resolve));const url='http://127.0.0.1:'+app.server.address().port,env={AGORA_AGENT_ID:'comparison-fixture',AGORA_DIR:path.join(root,'identity')};
  const call=args=>execute(path.join(source,'client.mjs'),[...args,'--url',url],env,os.tmpdir());
  assert.equal((await call(['register','comparison-fixture','--pet','dream-girl'])).code,0);
  const created=await call(['task','new','Compare resource values','--standalone','--reason','disposable authoring proof','--body','Delete the re-attachment; it is redundant rather than wrong.']);assert.equal(created.code,0,created.stdout+created.stderr);
  const task=app.store.listTasks()[0],before=JSON.stringify(app.store.listTasks()),locks=JSON.stringify(app.store.listLocks());
  const result=await call(['task','lint',task.id]);assert.equal(result.code,1,result.stdout+result.stderr);assert.match(result.stdout,/WF-G276/);
  assert.equal(JSON.stringify(app.store.listTasks()),before);assert.equal(JSON.stringify(app.store.listLocks()),locks);
  // Exercise the real orchestrator commands, not only imported preflight.
  // This plan can never launch a worker: the live task's premise must stop it.
  const candidate={...plan({...packet(),taskIds:[task.id]}),baseUrl:url},planFile=path.join(root,'plan.json');fs.writeFileSync(planFile,JSON.stringify(candidate));
  for(const args of [['partition',planFile],['prompt',planFile,'VE-1'],['dispatch',planFile,'VE-1']]){
   const refusal=await execute(path.join(here,'orchestrate.mjs'),args,env,path.resolve(here,'../..'));
   assert.equal(refusal.code,1,refusal.stdout+refusal.stderr);assert.match(refusal.stdout+refusal.stderr,/WF-G276/);
   assert.equal(JSON.stringify(app.store.listTasks()),before);assert.equal(JSON.stringify(app.store.listLocks()),locks);
  }
  const edited=await call(['task','edit',task.id,'--body',line(pending()),'--reason','Author labels original assertion unverified before investigation']);assert.equal(edited.code,0,edited.stdout+edited.stderr);
  const durable=JSON.stringify(app.store.listTasks());fs.writeFileSync(path.join(source,'taskLint.mjs'),'export const torn = ;');
  const current=await call(['task','lint',task.id]);assert.equal(current.code,0,current.stdout+current.stderr);assert.match(current.stdout,/unverified.*PROBE BEFORE DELETING/);assert.equal(JSON.stringify(app.store.listTasks()),durable);
  assert(app.store.listTasks()[0].history.some(h=>h.action==='edit'),'author history retained');assert.deepEqual(app.store.listLocks(),[]);
 }finally{await app.close();assert.equal(path.dirname(root),path.resolve(os.tmpdir()));fs.rmSync(root,{recursive:true,force:true});}
});
