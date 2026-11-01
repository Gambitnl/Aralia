// WF-G246: an audit must correct the durable task scope, not only a chat relay.
// Disposable fixtures preserve earlier intent and verify delivery, not spell counts.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from './controlNotice.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createAgoraServer } from './server.mjs';
import { run } from './client.mjs';
import { buildPrompt } from './orchestrate.mjs';

function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'agora-scope-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.mkdirSync(path.join(root,'docs'));
  const file='docs/audit.md',quote='Reviewed fixture scope includes four synthetic effect families.';
  fs.writeFileSync(path.join(root,file),'# Synthetic audit\n'+quote+'\n');
  const notice={id:'audit-v1',fromTask:'agora-source',oldScope:'Only two synthetic effect families',
    scope:quote,observedAt:new Date().toISOString(),audit:{file,quote}};
  const tasks=[{id:notice.fromTask,campaignId:'demo',state:'done',body:'Read-only audit.',refs:[file]},
    {id:'agora-target',campaignId:'demo',state:'claimed',body:notice.oldScope,createdBy:'author',claimedBy:'worker',deps:['dep'],refs:['ref'],history:[{action:'created'}]},
    {id:'agora-unlisted',campaignId:'demo',state:'blocked',body:notice.oldScope},
    {id:'agora-closed',campaignId:'demo',state:'done',body:notice.oldScope},
    {id:'agora-unrelated',campaignId:'other',state:'open',body:notice.oldScope}];
  const calls=[],options={};
  const run=async args=>{
    calls.push(args); await options.before?.(args,tasks);
    if(args[0]==='whoami')return {code:0,live:true,agent:{role:options.role||'orchestrator'}};
    if(args[0]==='campaign')return {code:0,view:{campaign:{id:'demo'}}};
    if(args[0]==='tasks')return {code:0,tasks:structuredClone(tasks)};
    if(args[0]==='say')return {code:0};
    const task=tasks.find(item=>item.id===args[2]);
    if(args[1]==='show')return {code:0,task:structuredClone(task)};
    if(args[1]==='edit'){
      task.body+='\nconcurrent claimant note\n'+args[args.indexOf('--append-body')+1];
      await options.afterAppend?.(task);
      return {code:options.lost?1:0,task:structuredClone(task)};
    }
    throw new Error('Unexpected scope fixture command: '+args.join(' '));
  };
  return {root,notice,tasks,calls,options,run,plan:{campaignId:'demo',packets:[]}};
}
const writes=b=>b.calls.filter(args=>args[0]==='say'||args[1]==='edit');
const publish=(b,extra={})=>api.publishScopeNotice(b.plan,b.notice,{repoRoot:b.root,run:b.run,...extra});

test('WF246: current unique linked citation, exact scope and fresh observation are required before writes',async t=>{
  const b=fixture(t);
  for(const amend of [{id:'bad/id'},{scope:b.notice.oldScope},{observedAt:'2026-02-30T00:00:00.000Z'},
    {observedAt:new Date(Date.now()-86400001).toISOString()},{observedAt:new Date(Date.now()+120000).toISOString()},
    {audit:{file:'../outside.md',quote:b.notice.audit.quote}},{audit:{file:'docs/missing.md',quote:'Missing quote'}},
    {audit:{...b.notice.audit,quote:'Absent quote'}},{audit:{...b.notice.audit,unexpected:true}},{unexpected:true}]){
    await assert.rejects(()=>api.publishScopeNotice(b.plan,{...b.notice,...amend},{repoRoot:b.root,run:b.run}));
    assert.equal(b.calls.length,0);
  }
  fs.appendFileSync(path.join(b.root,b.notice.audit.file),b.notice.audit.quote);
  await assert.rejects(()=>publish(b),/unresolved/); assert.equal(b.calls.length,0);
});

test('WF246: dry sweep includes unlisted siblings and reports done matches without changing any record',async t=>{
  const b=fixture(t),before=structuredClone(b.tasks);
  const result=await publish(b,{dryRun:true});
  assert.deepEqual(result.targets.map(x=>x.id),['agora-target','agora-unlisted']);
  assert.deepEqual(result.closedMatches,['agora-closed']); assert.deepEqual(b.tasks,before); assert.equal(writes(b).length,0);
});

test('WF246: append preserves concurrent notes, claimant, dependencies, refs, history and completed work; explicit repeat is idempotent',async t=>{
  const b=fixture(t),before=structuredClone(b.tasks);
  const result=await publish(b); assert.equal(result.appended.length,2); assert.equal(result.broadcast,true);
  const task=b.tasks[1]; assert.ok(task.body.startsWith(before[1].body)); assert.match(task.body,/concurrent claimant note/);
  assert.match(task.body,/AUDIT SCOPE CORRECTION/); assert.match(task.body,/SOURCE-CITATION:/);
  assert.ok(task.body.includes(b.notice.scope)); assert.match(task.body,/no additional files or commands/);
  for(const key of ['createdBy','claimedBy','deps','refs','history','state'])assert.deepEqual(task[key],before[1][key]);
  for(const index of [0,3,4])assert.deepEqual(b.tasks[index],before[index]);
  task.state='done'; const after=structuredClone(b.tasks),count=writes(b).length;
  const repeat=await publish(b); assert.equal(repeat.alreadyPresent.length,2); assert.equal(repeat.broadcast,false);
  assert.deepEqual(b.tasks,after); assert.equal(writes(b).length,count);
  b.notice.scope+=' Explicitly changed wording.';
  await assert.rejects(()=>publish(b),/different content/); assert.equal(writes(b).length,count);
});

test('WF246: worker role, missing audit linkage and campaign-wide conflicts refuse before mutation',async t=>{
  for(const amend of [b=>{b.options.role='worker';},b=>{b.tasks[0].refs=[];},
    b=>{b.tasks[0].campaignId='other';},b=>{b.tasks[2].body+='\nAUDIT SCOPE CORRECTION [demo/audit-v1] different';}]){
    const b=fixture(t); amend(b); await assert.rejects(()=>publish(b)); assert.equal(writes(b).length,0);
  }
  const empty=fixture(t); empty.tasks.splice(1,2);
  await assert.rejects(()=>publish(empty),/no unfinished matching/); assert.equal(writes(empty).length,0);
});

test('WF246: source, target or audit changes after snapshot stop before an unsafe append',async t=>{
  for(const change of [b=>{b.tasks[1].state='done';},b=>{b.tasks[1].body='Rewritten scope';},
    b=>{b.tasks[0].refs=[];},b=>{fs.appendFileSync(path.join(b.root,b.notice.audit.file),'\nNew audit finding');}]){
    const b=fixture(t); let changed=false;
    b.options.before=args=>{if(args[0]==='task'&&args[1]==='show'&&!changed){changed=true;change(b);}};
    await assert.rejects(()=>publish(b)); assert.equal(writes(b).length,0);
  }
});

test('WF246: audit drift during append reports durable partial history but never broadcasts success or retries',async t=>{
  const b=fixture(t); b.options.afterAppend=()=>fs.appendFileSync(path.join(b.root,b.notice.audit.file),'\nChanged during append');
  await assert.rejects(()=>publish(b),error=>{assert.equal(error.receipt.appended.length,1);assert.match(error.message,/audit source changed/);return true;});
  assert.equal(b.calls.filter(args=>args[1]==='edit').length,1); assert.equal(b.calls.some(args=>args[0]==='say'),false);
  assert.match(b.tasks[1].body,/AUDIT SCOPE CORRECTION/);
});

test('WF246: lost response requires inspection; explicit resume avoids duplicate appended history',async t=>{
  const b=fixture(t); b.options.lost=true;
  await assert.rejects(()=>publish(b),/no automatic retry/);
  assert.equal(b.calls.filter(args=>args[1]==='edit').length,1); assert.equal(b.calls.some(args=>args[0]==='say'),false);
  b.options.lost=false; const resumed=await publish(b);
  assert.deepEqual(resumed.alreadyPresent,['agora-target']); assert.deepEqual(resumed.appended,['agora-unlisted']);
  assert.equal(b.tasks[1].body.split('AUDIT SCOPE CORRECTION [demo/audit-v1] sha256=').length,2);
});

test('WF246: snapshot-present correction removed before current read never earns an already-present receipt',async t=>{
  const b=fixture(t); await publish(b); const count=writes(b).length;
  let changed=false;
  b.options.before=args=>{if(args[0]==='task'&&args[1]==='show'&&!changed){changed=true;b.tasks[1].body=b.notice.oldScope;}};
  await assert.rejects(()=>publish(b),/disappeared since sweep/);assert.equal(writes(b).length,count);
});

test('WF246: completion or campaign drift during append stops success broadcast with an applied receipt',async t=>{
  for(const change of [task=>{task.state='done';},task=>{task.campaignId='other';}]){
    const b=fixture(t);b.options.afterAppend=change;
    await assert.rejects(()=>publish(b),error=>{assert.equal(error.receipt.appended.length,1);assert.match(error.message,/during append/);return true;});
    assert.equal(b.calls.filter(args=>args[1]==='edit').length,1);assert.equal(b.calls.some(args=>args[0]==='say'),false);
  }
});

test('WF246: private native CLI sweep preserves a concurrent claimant append and survives isolated persistence reload',async t=>{
  const b=fixture(t),dir=path.join(b.root,'server'); let app=createAgoraServer({dir});
  const listen=async port=>{await new Promise(resolve=>app.listen(port||0,resolve));return `http://127.0.0.1:${app.server.address().port}`;};
  try{
    const baseUrl=await listen(),env={...process.env,AGORA_AGENT_ID:'scope-proof',AGORA_DIR:path.join(b.root,'identity')},context={env,baseUrl};
    const call=async args=>{const result=await run(args,context);assert.equal(result.code,0,result.lines?.join('\n'));return result;};
    await call(['register','scope-proof','--pet','cyberman','--role','orchestrator','--session','synthetic-scope-proof']);
    const campaign=await call(['campaign','claim','scope-proof','--role','lead','--scope','Synthetic audit metadata only','--path','.agent/scratch/scope-proof']);
    const ids={};
    for(const [key,body]of Object.entries({source:'Synthetic audit only',target:b.notice.oldScope,unlisted:b.notice.oldScope,closed:b.notice.oldScope,unrelated:'Unrelated brief'})){
      const args=['task','new',key,'--campaign',campaign.campaign.id,'--body',body];
      if(key==='source')args.push('--ref',b.notice.audit.file);
      ids[key]=(await call(args)).task.id;
    }
    await call(['task','claim',ids.target]); await call(['task','done',ids.closed,'--result','Historical synthetic fixture only']);
    const plan={wave:'scope-proof',pet:'cyberman',campaignId:campaign.campaign.id,baseUrl,packets:[{id:'PK-source',handle:'scope-source',agent:'claude',pet:'dream-girl',scope:'Synthetic audit only',files:['docs/audit.md'],taskIds:[ids.source]}]},notice={...b.notice,fromTask:ids.source};
    const planFile=path.join(b.root,'plan.json'),noticeFile=path.join(b.root,'notice.json');
    fs.writeFileSync(planFile,JSON.stringify(plan));fs.writeFileSync(noticeFile,JSON.stringify(notice));
    const execute=(...flags)=>promisify(execFile)(process.execPath,[fileURLToPath(new URL('./orchestrate.mjs',import.meta.url)),
      'scope-notice',planFile,noticeFile,...flags],{env,cwd:b.root,timeout:15000});
    const before=app.store.listTasks(); const dry=JSON.parse((await execute('--dry')).stdout);
    assert.equal(dry.targets.length,2);assert.deepEqual(app.store.listTasks(),before);
    let wrote=false;
    const concurrent=async(args,ctx)=>{if(args[1]==='edit'&&!wrote){wrote=true;await call(['task','edit',ids.target,'--append-body','Native claimant note after sweep']);}return run(args,ctx);};
    const result=await api.publishScopeNotice(plan,notice,{env,repoRoot:b.root,run:concurrent});assert.equal(result.appended.length,2);
    const after=app.store.listTasks();assert.match(after.find(x=>x.id===ids.target).body,/Native claimant note after sweep/);
    for(const key of ['source','closed','unrelated'])assert.deepEqual(after.find(x=>x.id===ids[key]),before.find(x=>x.id===ids[key]));
    const target=after.find(x=>x.id===ids.target),old=before.find(x=>x.id===ids.target);
    for(const key of ['claimedBy','createdBy','deps','refs','state'])assert.deepEqual(target[key],old[key]);
    await app.close(); app=createAgoraServer({dir});await listen(Number(new URL(baseUrl).port));
    const repeat=JSON.parse((await execute()).stdout);assert.equal(repeat.alreadyPresent.length,2);assert.equal(repeat.appended.length,0);assert.equal(repeat.broadcast,false);
    assert.deepEqual(app.store.listTasks(),after);assert.equal(app.store.listAgents().filter(x=>x.status!=='retired').length,1);
  }finally{await app.close();}
});

test('WF246: both prompt variants and author/worker/protocol instructions require durable current audit scope',()=>{
  for(const agent of ['claude','codex']){
    const prompt=buildPrompt({wave:'scope',campaignId:'demo',packets:[]},{id:'PK-scope',handle:'scope-worker',agent,pet:'cyberman',scope:'Metadata fixture',files:[]},{taskId:'agora-target'});
    assert.match(prompt,/AUDIT SCOPE CORRECTIONS \(WF-G246\)/);assert.match(prompt,/does not grant/);
  }
  for(const name of ['AGENT.md','ORCHESTRATOR.md','PROTOCOL.md'])assert.match(fs.readFileSync(new URL('./'+name,import.meta.url),'utf8'),/WF-G246/);
});

test('WF246: a reviewed scope correction has a first-class durable delivery path',()=>{
  assert.equal(typeof api.publishScopeNotice,'function');
  assert.equal(typeof api.scopeNoticeBody,'function');
});
