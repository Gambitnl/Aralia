// WF-G264: a quoted boundary is not runtime evidence. These fixtures test
// intake without editing game sources, running declared commands or launching workers.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as lint from './taskLint.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {captureTestBaseline} from './testBaseline.mjs';
import {validatePlan,seedPlan,buildPrompt} from './orchestrate.mjs';
import {inspectPacketRuntimeLimitations,analyzePacketOwnership,checkPacketLaunchLocks} from './packetOwnership.mjs';
import {createAgoraServer} from './server.mjs';
import {publishClient,RELEASE_FILES} from './client-release.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const options={fileExists:()=>true,ignoredPaths:()=>[],grepSrc:()=>true,basenameExists:()=>true,grepTypes:()=>[],checkFileFields:()=>[]};
const pending=()=>({claim:'Quick assembly boundary needs a probe',file:'src/utils/sandbox/quickCharacterGenerator.ts',entry:'createQuickCharacter',state:'unverified',reason:'No current executed observation supports this boundary claim.'});
const line=item=>'RUNTIME-LIMITATION: '+JSON.stringify(item);
const packet=()=>({id:'RL-1',handle:'runtime-probe',pet:'dream-girl',agent:'claude',scope:'Investigate quick assembly boundary',files:['tools/agora/taskLint.mjs','tools/agora/taskLint.test.mjs'],runtimeLimitations:[pending()]});
const plan=p=>({wave:'runtime-probe-'+process.pid+'-'+Date.now(),pet:'gf-sd',packets:[p]});
const cleanRoot=t=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'agora-runtime-proof-'));t.after(()=>{assert.equal(path.dirname(root),path.resolve(os.tmpdir()));fs.rmSync(root,{recursive:true,force:true});});return root;};
const hash=text=>createHash('sha256').update(text,'utf8').digest('hex');
function receiptFixture(t,status='failed') {
  const root=cleanRoot(t);fs.mkdirSync(path.join(root,'src'));fs.mkdirSync(path.join(root,'.proof'));
  const source='export function assemble() { return null; }\n',testSource="test('entry rejects known input', () => expect(assemble()).not.toBeNull());\n";
  fs.writeFileSync(path.join(root,'src/entry.mjs'),source);fs.writeFileSync(path.join(root,'src/entry.test.mjs'),testSource);
  const start=Date.now()-1000,report={startTime:start,success:status!=='failed',numTotalTests:1,numFailedTests:status==='failed'?1:0,numPassedTests:status==='passed'?1:0,numPendingTestSuites:0,testResults:[{name:path.join(root,'src/entry.test.mjs'),status:status==='failed'?'failed':'passed',endTime:start+10,assertionResults:[{fullName:'entry rejects known input',status,failureMessages:status==='failed'?['expected null not to be null']:[]}]}]};
  const receipt=captureTestBaseline(report,{repoRoot:root,command:'vitest run src/entry.test.mjs'});
  fs.writeFileSync(path.join(root,'.proof/receipt.json'),JSON.stringify(receipt));
  const item={claim:'Assembly returned null for the named known input',file:'src/entry.mjs',entry:'assemble',state:'cited_failure',receipt:'.proof/receipt.json',testFile:'src/entry.test.mjs',testName:'entry rejects known input',sourceSha256:hash(source),testSha256:hash(testSource),observation:'The named entry returned null; the non-null assertion failed.'};
  return {root,item,receipt};
}

test('WF264: the original source-comment limitation is not an implementation premise',()=>{
  const task={title:'Repair quick character coverage',body:'Production quick-character generation cannot resolve newly selectable races. Add a manual fallback actor.'};
  const result=lint.lintTask(task,{fileExists:()=>true,ignoredPaths:()=>[],grepSrc:()=>true,basenameExists:()=>true,grepTypes:()=>[],checkFileFields:()=>[]});
  assert.equal(result.clean,false);
  assert.match(lint.formatLintReport(result).join('\n'),/WF-G264/);
});

test('WF264: failed-run identity passes; passing, skipped, missing and suite failures do not',t=>{
  for(const status of ['failed','passed','skipped']) {
    const f=receiptFixture(t,status),report=lint.inspectRuntimeLimitations({title:'Repair observed boundary',body:line(f.item)},{repoRoot:f.root});
    assert.equal(report.issues.length===0,status==='failed',JSON.stringify(report));
  }
  const f=receiptFixture(t);assert(lint.inspectRuntimeLimitations({body:line({...f.item,testName:'other case'})},{repoRoot:f.root}).issues.length);
  const broken=structuredClone(f.receipt.report);broken.testResults[0].assertionResults=[];broken.numTotalTests=0;broken.numFailedTests=0;broken.numPassedTests=0;
  const hook=captureTestBaseline(broken,{repoRoot:f.root,command:'vitest run src/entry.test.mjs'});fs.writeFileSync(path.join(f.root,f.item.receipt),JSON.stringify(hook));
  assert.match(lint.inspectRuntimeLimitations({body:line(f.item)},{repoRoot:f.root}).issues[0].reason,/named failed assertion/);
});

test('WF264: source/test changes, stale and inconsistent receipts cannot clear a premise',t=>{
  const f=receiptFixture(t),check=()=>lint.inspectRuntimeLimitations({body:line(f.item)},{repoRoot:f.root});assert.deepEqual(check().issues,[]);
  fs.appendFileSync(path.join(f.root,f.item.file),'// later edit');assert.match(check().issues[0].reason,/source changed/);
  f.item.sourceSha256=hash(fs.readFileSync(path.join(f.root,f.item.file),'utf8'));
  fs.appendFileSync(path.join(f.root,f.item.testFile),'// different probe');assert.match(check().issues[0].reason,/source changed/);
  f.item.testSha256=hash(fs.readFileSync(path.join(f.root,f.item.testFile),'utf8'));
  assert(lint.inspectRuntimeLimitations({body:line(f.item)},{repoRoot:f.root,now:Date.now()+3*60*60*1000}).issues.length);
  const changed=structuredClone(f.receipt);changed.summary.failures=[];fs.writeFileSync(path.join(f.root,f.item.receipt),JSON.stringify(changed));assert.match(check().issues[0].reason,/inconsistent/);
  fs.writeFileSync(path.join(f.root,f.item.receipt),'not json');assert(check().issues.length);
});

test('WF264: bounded exact records and investigation-only intent, not implementation under a new label',()=>{
  const task={title:'Investigate assembly boundary',body:line(pending())};assert.deepEqual(lint.inspectRuntimeLimitations(task).issues,[]);
  for(const item of [{},{...pending(),extra:true},{...pending(),reason:'TODO'},{...pending(),file:'../outside.ts'},{...pending(),receipt:'.proof/a.json'},{...pending(),state:'verified'}, {...pending(),reason:'x'.repeat(2049)}])assert(lint.inspectRuntimeLimitations({...task,body:line(item)}).issues.length);
  for(const body of ['RUNTIME-LIMITATION: {','RUNTIME-LIMITATION: []',line(pending())+'\n'+line(pending()),Array(33).fill(line(pending())).join('\n'),line(pending())+'\nAdd a manual fallback actor.'])assert(lint.inspectRuntimeLimitations({...task,body}).issues.length);
  assert(lint.inspectRuntimeLimitations({...task,title:'Implement a fallback actor'}).issues.length);
  assert(lint.inspectRuntimeLimitations({...task,body:line(pending())+'\nProduction generation cannot resolve selected races.'}).issues.length);
  assert.deepEqual(lint.inspectRuntimeLimitations({...task,body:line(pending())+'\nSNAPSHOT: Production generation cannot resolve selected races.'}).issues,[]);
});

test('WF264 review: wrapped limitations fail and preservation prohibitions never clear a later recipe',()=>{
  const body='Production quick-character generation:\ncannot resolve newly selectable races.\nAdd a manual fallback actor.';
  assert(lint.inspectRuntimeLimitations({title:'Repair quick character coverage',body}).issues.length);
  assert.throws(()=>inspectPacketRuntimeLimitations({...packet(),runtimeLimitations:undefined,guidance:body}),/WF-G264/);
  const task={title:'Investigate assembly boundary',body:line(pending())+'\nDo not remove unfinished intent. Never create a workaround.'};assert.deepEqual(lint.inspectRuntimeLimitations(task).issues,[]);
  assert.deepEqual(lint.inspectRuntimeLimitations({...task,body:task.body+'\nDo not add, remove, or replace any production behavior.'}).issues,[]);
  for(const suffix of ['\nAdd a manual fallback actor.','; implement a fallback actor.','\nDelete: the fallback actor.','\nIMPLEMENT: a manual fallback actor.','\nDo not delete existing tests, implement a manual fallback actor.'])assert(lint.inspectRuntimeLimitations({...task,body:task.body+suffix}).issues.length);
  // Historical context cannot turn a permission statement into runtime proof.
  assert.deepEqual(lint.inspectRuntimeLimitations({body:'SNAPSHOT: Production generation was unreachable.\nThis policy does not grant permissions.'}).issues,[]);
});

test('WF264: limitation records are not edit ownership, counts or commands',()=>{
  const p={...packet(),runtimeLimitations:[{...pending(),reason:'Proposed command node delete 99 files src/unowned-command.ts, not executed.'}]};
  const report=lint.lintTask({title:p.scope,body:line(p.runtimeLimitations[0])},options);
  assert.deepEqual(lint.extractTaskOwnershipPaths({body:line(p.runtimeLimitations[0])}),[]);assert.deepEqual(report.countSourceCheck.claims,[]);assert.deepEqual(report.pendingDiscoveries,[]);
  assert.equal(report.clean,true);assert.equal(inspectPacketRuntimeLimitations(p).unverified.length,1);
  for(const runtimeLimitations of ['bad',[{}],Array(33).fill(pending())])assert.throws(()=>validatePlan(plan({...packet(),runtimeLimitations})),/WF-G264/);
});

test('WF264: native seed refuses unsupported boundary before effects, and preserves investigation state once',async t=>{
  const root=cleanRoot(t),app=createAgoraServer({dir:path.join(root,'store'),seatRosterPath:null});
  try {
    await new Promise(resolve=>app.listen(0,resolve));const p=packet(),candidate={...plan(p),baseUrl:'http://127.0.0.1:'+app.server.address().port};
    const snapshot=()=>JSON.stringify({agents:app.store.listAgents(),campaigns:app.store.listCampaigns(),tasks:app.store.listTasks(),locks:app.store.listLocks()}),before=snapshot();
    const bad={...p,runtimeLimitations:undefined,guidance:'Production generation cannot resolve selected races. Add a manual fallback actor.'};
    await assert.rejects(()=>seedPlan({...candidate,packets:[bad]},{env:{AGORA_DIR:path.join(root,'identity')}}),/WF-G264/);assert.equal(snapshot(),before);
    const seeded=await seedPlan(candidate,{env:{AGORA_DIR:path.join(root,'identity')}}),task=app.store.listTasks().find(t=>t.id===seeded[p.id]);
    assert.equal(task.body.split('\n').filter(l=>l.startsWith('RUNTIME-LIMITATION:')).length,1);const inspected=lint.inspectRuntimeLimitations(task);assert.equal(inspected.unverified.length,1,JSON.stringify(inspected));
    for(const agent of ['claude','codex']){const prompt=buildPrompt(candidate,{...p,agent},{taskId:task.id});assert(prompt.includes(line(pending())));assert.match(prompt,/Unverified state permits investigation only/);assert.match(prompt,/No declared command executes automatically/);}
  }finally{await app.close();}
});

test('WF264: partition and queued launch cannot drop or change current durable limitation records',async()=>{
  const p={...packet(),taskIds:['agora-dead.1']},task={id:'agora-dead.1',title:p.scope,body:line(pending()),refs:[],state:'open'},candidate=plan(p);
  assert.equal(analyzePacketOwnership(candidate,[task],[]).ok,true);
  for(const body of ['',line({...pending(),reason:'Another unresolved premise'}),'Production generation cannot resolve selected races.']){
    const changed={...task,body};assert.equal(analyzePacketOwnership(candidate,[changed],[]).ok,false);
    const calls=[],fetchImpl=async url=>{calls.push(url);return{ok:true,json:async()=>url.endsWith('/locks')?{locks:[]}:{tasks:[changed]}};};
    const result=await checkPacketLaunchLocks(candidate,p,{taskId:task.id,fetchImpl});assert.equal(result.ok,false);assert.match(result.errors.join('\n'),/WF-G264/);assert.equal(calls.length,2);
  }
});

function execute(file,args,env,cwd){return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[file,...args],{cwd,env:{...process.env,...env},windowsHide:true});let stdout='',stderr='';
  const timeout=setTimeout(()=>{child.kill();reject(Error('fixture command timeout'));},30000);child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
  child.once('error',e=>{clearTimeout(timeout);reject(e);});child.once('close',code=>{clearTimeout(timeout);resolve({code,stdout,stderr});});
});}

test('WF264: actual failing entry receipt clears isolated native intake, and immutable lint survives mutable corruption',async t=>{
  const root=cleanRoot(t),source=path.join(root,'tools/agora');fs.mkdirSync(source,{recursive:true});fs.mkdirSync(path.join(root,'src'));fs.mkdirSync(path.join(root,'.proof'));
  for(const file of [...RELEASE_FILES,'client.mjs','client-release.mjs','agents.json'])fs.copyFileSync(path.join(here,file),path.join(source,file));
  fs.writeFileSync(path.join(root,'src/entry.mjs'),'export function assemble() { return null; }\n');
  fs.writeFileSync(path.join(root,'src/entry.test.mjs'),"import {assemble} from './entry.mjs';\ntest('entry rejects known input', () => expect(assemble()).not.toBeNull());\n");
  const config=path.join(root,'vitest.config.mjs');fs.writeFileSync(config,'export default { test: { globals: true, include: ["src/entry.test.mjs"], maxWorkers: 1 } };\n');
  const argv=['run','src/entry.test.mjs','--root',root,'--config',config,'--pool=threads','--reporter=json','--outputFile',path.join(root,'.proof/report.json')];
  const actual=spawnSync(process.execPath,[path.resolve(here,'../../node_modules/vitest/vitest.mjs'),...argv],{cwd:root,encoding:'utf8',timeout:60000,windowsHide:true});assert.equal(actual.status,1,actual.stdout+actual.stderr);
  const receipt=captureTestBaseline(JSON.parse(fs.readFileSync(path.join(root,'.proof/report.json'),'utf8')),{repoRoot:root,command:process.execPath+' vitest.mjs '+argv.join(' ')});fs.writeFileSync(path.join(root,'.proof/receipt.json'),JSON.stringify(receipt));
  const item={claim:'Assembly returned null for the named known input',file:'src/entry.mjs',entry:'assemble',state:'cited_failure',receipt:'.proof/receipt.json',testFile:'src/entry.test.mjs',testName:'entry rejects known input',sourceSha256:hash(fs.readFileSync(path.join(root,'src/entry.mjs'),'utf8')),testSha256:hash(fs.readFileSync(path.join(root,'src/entry.test.mjs'),'utf8')),observation:'The entry returned null and the explicit non-null assertion failed.'};
  const app=createAgoraServer({dir:path.join(root,'store'),seatRosterPath:null});
  try {
    await publishClient({repoRoot:root});await new Promise(resolve=>app.listen(0,resolve));const url='http://127.0.0.1:'+app.server.address().port,env={AGORA_AGENT_ID:'runtime-fixture',AGORA_DIR:path.join(root,'identity')};
    const call=args=>execute(path.join(source,'client.mjs'),[...args,'--url',url],env,os.tmpdir());assert.equal((await call(['register','runtime-fixture','--pet','dream-girl'])).code,0);
    const original=JSON.stringify(app.store.listTasks());
    const bad=await call(['task','new','Repair assembly','--standalone','--reason','disposable proof','--body','Production generation cannot resolve selected races. Add a fallback actor.']);assert.equal(bad.code,1,bad.stdout+bad.stderr);assert.match(bad.stdout,/WF-G264/);assert.equal(JSON.stringify(app.store.listTasks()),original);
    const accepted=await call(['task','new','Repair observed assembly boundary','--standalone','--reason','disposable proof','--body',line(item)]);assert.equal(accepted.code,0,accepted.stdout+accepted.stderr);
    const task=app.store.listTasks()[0],before=JSON.stringify(app.store.listTasks());assert.equal((await call(['task','lint',task.id])).code,0);
    fs.writeFileSync(path.join(source,'taskLint.mjs'),'export const torn = ;');assert.equal((await call(['task','lint',task.id])).code,0);assert.equal(JSON.stringify(app.store.listTasks()),before);
    fs.appendFileSync(path.join(root,item.file),'// changed entry');const stale=await call(['task','lint',task.id]);assert.equal(stale.code,1,stale.stdout+stale.stderr);assert.match(stale.stdout,/source changed/);assert.equal(JSON.stringify(app.store.listTasks()),before);assert.deepEqual(app.store.listLocks(),[]);
    const legacy=await call(['task','edit',task.id,'--body','Production quick-character generation:\ncannot resolve newly selectable races.\nAdd a manual fallback actor.','--reason','Retain a legacy faulty brief for the disposable current-task preflight proof']);assert.equal(legacy.code,0,legacy.stdout+legacy.stderr);
    const durable=JSON.stringify(app.store.listTasks()),candidate={...plan({...packet(),runtimeLimitations:undefined,taskIds:[task.id]}),baseUrl:url},planFile=path.join(root,'plan.json');fs.writeFileSync(planFile,JSON.stringify(candidate));
    for(const args of [['partition',planFile],['prompt',planFile,'RL-1'],['dispatch',planFile,'RL-1']]){
      const refused=await execute(path.join(here,'orchestrate.mjs'),args,env,path.resolve(here,'../..'));assert.equal(refused.code,1,refused.stdout+refused.stderr);assert.match(refused.stdout+refused.stderr,/WF-G264/);
      assert.equal(JSON.stringify(app.store.listTasks()),durable);assert.deepEqual(app.store.listLocks(),[]);
    }
  }finally{await app.close();}
});
