// WF-G266 fixtures prove durable pending acceptance, not a game's appearance.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from './visualAcceptance.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {createAgoraServer} from './server.mjs';
import {run} from './client.mjs';
import {packetTaskBody,buildPrompt,buildVisualProofStep,seedPlan,waveStatus,reconcileGaps} from './orchestrate.mjs';
import {reconcileBoardToPlanmap} from './planmap-reconcile-lib.mjs';
import {visualReviewDeliveryIssue} from './visualTaskKind.mjs';
import {analyzePacketOwnership,checkPacketLaunchLocks} from './packetOwnership.mjs';

const owner={agentId:'11111111-1111-4111-8111-111111111111',handle:'visual-owner'};
function fixture(){
  const plan={wave:'visual-fixture',campaignId:'demo',pet:'cyberman',packets:[{id:'PK-build',agent:'claude',handle:'build-owner',pet:'dream-girl',scope:'Build the fixture and inspect/tune its rendered appearance',files:['.agent/scratch/wfg266/widget.html']}]};
  const input={id:'review-v1',packetId:'PK-build',buildAcceptance:'Mount the fixture and prove its focused unit behavior',reviewer:owner,
    visualProof:{url:'http://localhost:4319/',acceptance:'Inspect the synthetic fixture and tune its reviewed constants'},tuningFiles:['.agent/scratch/wfg266/tuning.json']};
  const tasks=[],calls=[],options={};
  const run=async args=>{
    calls.push(args);await options.before?.(args,tasks);
    if(args[0]==='whoami')return {code:0,live:true,agent:{role:options.role||'orchestrator'}};
    if(args[0]==='campaign')return {code:0,view:{campaign:{id:'demo'}}};
    if(args[0]==='agents')return {code:0,agents:[{id:owner.agentId,handle:options.wrongOwner?'another-handle':owner.handle,status:'online'}]};
    if(args[0]==='tasks')return {code:0,tasks:structuredClone(tasks)};
    if(args[1]==='new'){
      const task={id:'agora-'+(tasks.length+1),title:args[2],body:args[args.indexOf('--body')+1],campaignId:'demo',state:'open',createdBy:'coordinator',claimedBy:null,
        refs:args.flatMap((v,i)=>v==='--ref'?[args[i+1]]:[]),deps:args.flatMap((v,i)=>v==='--dep'?[args[i+1]]:[]),history:[{action:'created'}]};
      tasks.push(task);return {code:options.lostCreation?1:0,task:structuredClone(task)};
    }
    const task=tasks.find(x=>x.id===args[2]);
    if(args[1]==='show')return {code:0,task:structuredClone(task)};
    if(args[1]==='edit'){
      task.body+='\nconcurrent author note\n'+args[args.indexOf('--append-body')+1];task.history.push({action:'edited'});
      return {code:options.lostAppend?1:0,task:structuredClone(task)};
    }
    throw new Error('unexpected visual fixture '+args.join(' '));
  };
  return {plan,input,tasks,calls,options,run};
}
const mutateCalls=b=>b.calls.filter(args=>args[1]==='new'||args[1]==='edit');
const create=(b,extra={})=>api.createVisualSplit(b.plan,b.input,{run:b.run,taskBody:packetTaskBody,...extra});

test('WF266: invalid split/reviewer/surface/files and existing assignments refuse before writes',async()=>{
  for(const amendment of [{id:'bad/id'},{packetId:'absent'},{buildAcceptance:''},{reviewer:{agentId:'orchestrator',handle:'orchestrator'}},
    {reviewer:{...owner,handle:'orchestrator'}},{visualProof:{url:'https://example.com/',acceptance:'Inspect'}},
    {tuningFiles:['../outside']},{tuningFiles:['src/*.ts']},{tuningFiles:['src/a.ts','src/a.ts']},{extra:true}]){
    const b=fixture();Object.assign(b.input,amendment);await assert.rejects(()=>create(b));assert.equal(b.calls.length,0);
  }
  const assigned=fixture();assigned.plan.packets[0].taskIds=['agora-build'];await assert.rejects(()=>create(assigned),/already assigned/);assert.equal(assigned.calls.length,0);
  for(const options of [{role:'worker'},{wrongOwner:true}]){const b=fixture();Object.assign(b.options,options);await assert.rejects(()=>create(b));assert.equal(mutateCalls(b).length,0);}
});

test('WF266: dry review creates no tasks; paired tasks separate acceptance and preserve pending visual work after build done',async()=>{
  const b=fixture();const dry=await create(b,{dryRun:true});assert.equal(dry.dryRun,true);assert.equal(b.tasks.length,0);
  const result=await create(b);assert.equal(b.tasks.length,2);assert.equal(result.linked,true);
  const [build,review]=b.tasks;assert.deepEqual(review.deps,[build.id]);assert.equal(review.state,'open');
  assert.match(build.body,/REFERENCE-ONLY: Original combined purpose/);assert.match(build.body,/Build.*fixture/i);assert.match(build.body,/VISUAL-HANDOFF:/);
  assert.match(review.body,/VISUAL-REVIEW:/);assert.match(review.body,/visual-owner/);assert.deepEqual(review.refs,[b.input.tuningFiles[0],'task:'+build.id]);
  build.state='done';build.result='Synthetic unit proof only, visual review pending '+review.id;
  const status=waveStatus(result.tracking,b.tasks);assert.equal(status.complete,false);assert.equal(status.pending.length,1);assert.equal(status.done.length,1);
  const before=structuredClone(b.tasks),count=mutateCalls(b).length;
  const repeat=await create(b);assert.equal(repeat.created.length,0);assert.deepEqual(b.tasks,before);assert.equal(mutateCalls(b).length,count);
});

test('WF266: current metadata gate rejects lost/mismatched/completed/wrong-owner reviews and nonblocking dependencies',async()=>{
  for(const amend of [b=>{b.tasks.pop();},b=>{b.tasks[1].state='done';},b=>{b.tasks[1].campaignId='other';},
    b=>{b.tasks[1].claimedBy='another-agent';},b=>{b.tasks[1].deps=[];},b=>{b.tasks[1].deps=[{id:b.tasks[0].id,type:'discovered-from'}];},
    b=>{b.tasks[1].refs=[];},b=>{b.tasks[1].body=b.tasks[1].body.replace('VISUAL-REVIEW:','REMOVED-REVIEW:');}]){
    const b=fixture(),r=await create(b);amend(b);
    assert.throws(()=>api.inspectVisualHandoff(r.packet,b.tasks[0],b.tasks),/WF-G266/);
  }
  const b=fixture(),r=await create(b);
  assert.throws(()=>api.inspectVisualHandoff({...r.packet,scope:'Old combined scope'},b.tasks[0],b.tasks),/build-only/);
  assert.throws(()=>api.inspectVisualHandoff({...r.packet,visualHandoff:undefined},b.tasks[0],b.tasks),/omits/);
  assert.throws(()=>api.validateVisualPacket({...r.packet,taskIds:[]}),/assigned/);
  assert.throws(()=>buildVisualProofStep({...r.packet,taskIds:[]}),/assigned/);
  for(const agent of ['claude','codex']){
    const prompt=buildPrompt(b.plan,{...r.packet,agent},{taskId:r.buildTask});assert.match(prompt,/SEPARATE VISUAL ACCEPTANCE \(WF-G266\)/);assert.match(prompt,/Build-only acceptance/);assert.ok(prompt.includes(r.reviewTask));
  }
  assert.doesNotMatch(buildVisualProofStep(r.packet),/No visualProof URL/);
  const queuedPlan={...b.plan,packets:[r.packet]},fetchImpl=async url=>({ok:true,json:async()=>String(url).endsWith('/locks')?{locks:[]}:{tasks:b.tasks}});
  const initial=await checkPacketLaunchLocks(queuedPlan,r.packet,{taskId:r.buildTask,fetchImpl});assert.equal(initial.ok,true,initial.errors.join('\n'));
  b.tasks[1].deps=[];
  assert.equal((await checkPacketLaunchLocks(queuedPlan,r.packet,{taskId:r.buildTask,fetchImpl})).ok,false);
  await assert.rejects(()=>seedPlan(queuedPlan),/already exist/);
});

test('WF266: author, worker and protocol docs preserve the separate pending acceptance and explicit-resume limits',()=>{
  for(const name of ['AGENT.md','ORCHESTRATOR.md','PROTOCOL.md'])assert.match(fs.readFileSync(new URL('./'+name,import.meta.url),'utf8'),/WF-G266/);
  const author=fs.readFileSync(new URL('./ORCHESTRATOR.md',import.meta.url),'utf8');
  assert.match(author,/both\s+returned `tracking` IDs/);assert.match(author,/cross-request transaction/);assert.match(author,/split-visual <plan.json> <split.json> --dry/);
});

test('WF266: a different review packet cannot bypass the durable reviewer identity, scope and proof',async()=>{
  const b=fixture(),r=await create(b);b.tasks[0].state='done';
  const wrong={id:'PK-review',scope:'Perform review',handle:'another-worker',files:b.input.tuningFiles,taskIds:[r.reviewTask]};
  assert.throws(()=>api.inspectVisualHandoff(wrong,b.tasks[1],b.tasks),/WF-G266/);
  const valid={...r.reviewPacket,agent:'codex',pet:'cyberman'};
  assert.equal(api.inspectVisualHandoff(valid,b.tasks[1],b.tasks).followUpTask,r.reviewTask);
  for(const amendment of [{handle:'another-worker'},{scope:'different acceptance'},{files:[]},
    {files:[...valid.files,'src/unowned.ts']},{visualProof:{...valid.visualProof,url:'http://localhost:5555/'}},{taskIds:[r.reviewTask,r.buildTask]}]){
    assert.throws(()=>api.inspectVisualHandoff({...valid,...amendment},b.tasks[1],b.tasks),/WF-G266/);
  }
  const prompt=buildPrompt({...b.plan,packets:[valid]},valid,{taskId:r.reviewTask});
  assert.match(prompt,/EXISTING REVIEWER HANDOFF/);assert.match(prompt,/original current session/);
  assert.doesNotMatch(prompt,/client\.mjs register/);assert.match(prompt,/Do not register a replacement/);assert.match(prompt,/Do not retire/);
  b.tasks[1].claimedBy='another-agent';
  assert.throws(()=>api.inspectVisualHandoff(valid,b.tasks[1],b.tasks),/another identity/);
});

test('WF266: explicit inspection-only reviewer packet does not acquire tuning files',async()=>{
  const b=fixture();b.input.tuningFiles=[];const r=await create(b);b.tasks[0].state='done';
  const packet={...r.reviewPacket,agent:'codex',pet:'cyberman'};
  assert.deepEqual(packet.files,[]);
  assert.equal(analyzePacketOwnership({...b.plan,packets:[packet]},b.tasks,[]).ok,true);
  assert.match(buildPrompt(b.plan,packet,{taskId:r.reviewTask}),/none; inspection only/);
});

test('WF266: prerequisite packet dependencies remain blocking on the new build, or missing identities refuse before creation',async()=>{
  const b=fixture();b.plan.packets[0].after=['PK-prep'];
  b.plan.packets.push({id:'PK-prep',scope:'Prepare fixture',handle:'prep-owner',agent:'claude',pet:'nous-girl',files:['.agent/scratch/wfg266/prep.txt'],taskIds:['agora-prerequisite']});
  b.tasks.push({id:'agora-prerequisite',campaignId:'demo',state:'open',body:'Prerequisite',refs:[],deps:[]});
  const r=await create(b);assert.deepEqual(b.tasks.find(task=>task.id===r.buildTask).deps,['agora-prerequisite']);
  const missing=fixture();missing.plan.packets[0].after=['PK-absent'];await assert.rejects(()=>create(missing),/prerequisite/);assert.equal(mutateCalls(missing).length,0);
  b.tasks.find(task=>task.id===r.buildTask).deps=[];
  assert.throws(()=>api.inspectVisualHandoff(r.packet,b.tasks.find(task=>task.id===r.buildTask),b.tasks),/blocking prerequisite/);
  await assert.rejects(()=>create(b),/lost its blocking prerequisite/);
});

test('WF266: blocked or missing visual acceptance is not wave completion',async()=>{
  const b=fixture(),r=await create(b);b.tasks[0].state='done';b.tasks[1].state='blocked';
  assert.equal(waveStatus(r.tracking,b.tasks).complete,false);
  assert.equal(waveStatus({[b.plan.packets[0].id]:r.buildTask},b.tasks).complete,false,'durable build link exposes omitted review tracking');
  b.tasks[1].state='done';b.tasks[1].claimedBy=owner.agentId;
  assert.equal(waveStatus(r.tracking,b.tasks).complete,true);
  b.tasks[0].body=b.tasks[0].body.replace('VISUAL-HANDOFF:','REMOVED-HANDOFF:');
  assert.equal(waveStatus(r.tracking,b.tasks).complete,false,'review declaration still exposes lost build handoff');
  b.tasks[1].state='open';
  assert.equal(waveStatus({[b.plan.packets[0].id]:r.buildTask},b.tasks).complete,false,'reverse review link exposes lost build handoff even when review tracking was omitted');
  b.tasks[1].state='done';
  b.tasks[1].body=b.tasks[1].body.replace('VISUAL-REVIEW:','REMOVED-REVIEW:');
  assert.equal(waveStatus(r.tracking,b.tasks).complete,false,'explicit visual tracking cannot silently become ordinary completion');
});

test('WF266: uncertain task creation and append require explicit resume without duplication or lost notes',async()=>{
  for(const key of ['lostCreation','lostAppend']){
    const b=fixture();b.options[key]=true;
    await assert.rejects(()=>create(b),error=>{assert.ok(error.receipt);assert.match(error.message,/no automatic retry/);return true;});
    assert.equal(b.tasks.length,key==='lostCreation'?1:2);
    b.options[key]=false;const r=await create(b);assert.equal(r.linked,true);assert.equal(b.tasks.length,2);
    const count=mutateCalls(b).length;await create(b);assert.equal(mutateCalls(b).length,count);
    assert.match(b.tasks[0].body,/concurrent author note/);
  }
  const b=fixture();await create(b);b.input.visualProof.acceptance+=' Changed scope.';
  const count=mutateCalls(b).length;await assert.rejects(()=>create(b),/conflicting/);assert.equal(mutateCalls(b).length,count);
});

test('WF266: private native CLI leaves visual review pending/ready after build completion and persists the pair',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'agora-visual-'));let app=createAgoraServer({dir:path.join(root,'server')});
  const listen=async port=>{await new Promise(resolve=>app.listen(port||0,resolve));return `http://127.0.0.1:${app.server.address().port}`;};
  try{
    const baseUrl=await listen(),env={...process.env,AGORA_AGENT_ID:'visual-owner',AGORA_DIR:path.join(root,'identity')};
    const call=async args=>{const r=await run(args,{env,baseUrl});assert.equal(r.code,0,r.lines?.join('\n'));return r;};
    await call(['register','visual-owner','--role','orchestrator','--pet','cyberman','--session','synthetic-visual-session']);
    const registered=await call(['whoami','--live']);
    const campaign=await call(['campaign','claim','visual-proof','--role','lead','--scope','Synthetic task metadata only','--path','.agent/scratch/wfg266']);
    const b=fixture();b.plan.baseUrl=baseUrl;b.plan.campaignId=campaign.campaign.id;b.input.reviewer={agentId:registered.agent.id,handle:'visual-owner'};
    const planFile=path.join(root,'plan.json'),inputFile=path.join(root,'input.json');fs.writeFileSync(planFile,JSON.stringify(b.plan));fs.writeFileSync(inputFile,JSON.stringify(b.input));
    const execute=(...flags)=>promisify(execFile)(process.execPath,[fileURLToPath(new URL('./orchestrate.mjs',import.meta.url)),'split-visual',planFile,inputFile,...flags],{env,timeout:15000});
    const before=app.store.listTasks();assert.equal(JSON.parse((await execute('--dry')).stdout).dryRun,true);assert.deepEqual(app.store.listTasks(),before);
    const receipt=JSON.parse((await execute()).stdout);assert.equal(receipt.linked,true);assert.equal(receipt.created.length,2);
    assert.equal((await run(['task','claim',receipt.reviewTask],{env,baseUrl})).code,1,'visual review cannot start before blocking build dependency');
    await call(['task','claim',receipt.buildTask]);await call(['task','done',receipt.buildTask,'--result','Synthetic build unit proof only; visual acceptance pending '+receipt.reviewTask]);
    const tasks=app.store.listTasks(),review=tasks.find(x=>x.id===receipt.reviewTask);assert.equal(review.state,'open');
    assert.equal(waveStatus(receipt.tracking,tasks).complete,false);
    const assigned={...b.plan,packets:[receipt.packet]};const report=analyzePacketOwnership(assigned,tasks,[]);assert.equal(report.ok,true,report.errors.join('\n'));
    await app.close();app=createAgoraServer({dir:path.join(root,'server')});await listen(Number(new URL(baseUrl).port));
    const repeat=JSON.parse((await execute()).stdout);assert.equal(repeat.created.length,0);assert.deepEqual(app.store.listTasks(),tasks);
    assert.equal((await call(['task','claim',receipt.reviewTask])).task.state,'claimed');
  }finally{await app.close();assert.equal(path.dirname(root),fs.realpathSync(os.tmpdir()));fs.rmSync(root,{recursive:true,force:true});}
});
test('WF266: paired task authoring and current handoff checks exist',()=>{
  assert.equal(typeof api.createVisualSplit,'function');
  assert.equal(typeof api.inspectVisualHandoff,'function');
});

test('WF266: review retains canonical delivery refs, not build-owned paths; build done does not reconcile gaps',async()=>{
  const b=fixture();
  b.plan.packets[0].refs=['planmap:forests/named-forests','workflow:WF-G266','.agent/scratch/wfg266/widget.html'];
  const r=await create(b);
  const build=b.tasks.find(task=>task.id===r.buildTask),review=b.tasks.find(task=>task.id===r.reviewTask);
  assert.ok(review.refs.includes('planmap:forests/named-forests'));
  assert.ok(review.refs.includes('workflow:WF-G266'));
  assert.equal(review.refs.includes('.agent/scratch/wfg266/widget.html'),false);
  const gaps=[{id:'WF-G266',project:'workflow',status:'open',file:'tools/agora/WORKFLOW_GAPS.md'}];
  build.state='done';
  assert.equal(reconcileGaps([build],gaps).staleOpen.length,0);
  review.state='done';review.claimedBy=owner.agentId;
  assert.equal(reconcileGaps([build,review],gaps).staleOpen.length,1);
  review.refs.push('workflow:WF-G247');
  review.state='open';
  assert.throws(()=>api.inspectVisualHandoff(r.packet,build,b.tasks),/canonical delivery refs/);
  const expanded=[...gaps,{id:'WF-G247',project:'workflow',status:'open',file:'tools/agora/WORKFLOW_GAPS.md'}];
  review.state='done';
  const held=reconcileGaps([build,review],expanded);
  assert.equal(held.staleOpen.length,0);assert.equal(held.invalidVisual.length,1);
  review.refs=review.refs.filter(ref=>ref!=='workflow:WF-G247');
  review.state='open';review.refs=review.refs.filter(ref=>!ref.startsWith('planmap:'));
  assert.throws(()=>api.inspectVisualHandoff(r.packet,build,b.tasks),/lost canonical delivery ref/);
});

test('WF266: completed progress and both projections hold broken dependencies or tuning refs',async()=>{
  const b=fixture(),prep={id:'agora-prep',campaignId:'demo',state:'done',refs:[],deps:[]};
  b.tasks.push(prep);b.plan.packets.unshift({id:'prep',taskIds:[prep.id]});
  b.plan.packets[1].after=['prep'];
  b.plan.packets[1].refs=['planmap:forests/named-forests','workflow:WF-G266'];
  const r=await create(b),build=b.tasks.find(t=>t.id===r.buildTask),review=b.tasks.find(t=>t.id===r.reviewTask);
  build.state='done';review.state='done';review.claimedBy=owner.agentId;
  const gaps=[{id:'WF-G266',project:'workflow',status:'open',file:'tools/agora/WORKFLOW_GAPS.md'}];
  const data=()=>({topics:[{id:'forests',status:'specced',features:[{title:'Named forests',status:'specced'}]}]});
  const valid=data();reconcileBoardToPlanmap(valid,b.tasks);
  assert.equal(valid.topics[0].features[0].status,'done');
  assert.equal(reconcileGaps(b.tasks,gaps).staleOpen.length,1);
  assert.equal(waveStatus(r.tracking,b.tasks).complete,true);
  for(const amend of [
    (ts,bu,re)=>{re.deps=[];},
    (ts,bu,re)=>{re.deps=[{id:bu.id,type:'discovered-from'}];},
    (ts,bu,re)=>{re.deps.push({id:'agora-other',type:'unknown-type'});},
    (ts,bu)=>{bu.deps.push({id:'agora-other',type:'unknown-type'});},
    (ts,bu)=>{bu.deps=[];},
    ts=>{ts.splice(ts.findIndex(t=>t.id===prep.id),1);},
    ts=>{ts.push({...prep});},
    ts=>{ts.find(t=>t.id===prep.id).campaignId='other';},
    ts=>{ts.find(t=>t.id===prep.id).state='open';},
    (ts,bu,re)=>{re.refs=re.refs.filter(ref=>ref!==b.input.tuningFiles[0]);},
    (ts,bu,re)=>{re.claimedBy=null;},
  ]){
    const ts=structuredClone(b.tasks),bu=ts.find(t=>t.id===build.id),re=ts.find(t=>t.id===review.id);
    amend(ts,bu,re);assert.ok(visualReviewDeliveryIssue(re,ts,gaps));
    const map=data();reconcileBoardToPlanmap(map,ts);
    assert.equal(map.topics[0].features[0].status,'active');
    const report=reconcileGaps(ts,gaps);
    assert.equal(report.staleOpen.length,0);assert.equal(report.invalidVisual.length,1);
    assert.equal(waveStatus(r.tracking,ts).complete,false);
  }
  // No tuning refs are required when inspection-only is explicitly declared.
  const record={...r.visualHandoff,tuningFiles:[]};
  build.body=build.body.replace(api.visualHandoffLine(r.visualHandoff),api.visualHandoffLine(record));
  review.body=review.body.replace(api.visualReviewLine(r.visualHandoff),api.visualReviewLine(record));
  review.refs=review.refs.filter(ref=>ref!==b.input.tuningFiles[0]);
  assert.equal(visualReviewDeliveryIssue(review,b.tasks,gaps),null);
});
