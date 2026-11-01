// WF-G295: authoring, retained packet metadata and fresh queued checks share the
// owning validator. These fixtures never rewrite the live research corpus.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {generateSourceTask} from '../../scripts/idea-board/source-task.mjs';
import {inspectPacketSourceRewrites,assertTaskSourceRewrites,sourceRewritePromptBlock} from './sourceRewritePreflight.mjs';
import {IDEA_BOARD_FILE} from './recordSourceProvenance.mjs';
import {createAgoraServer} from './server.mjs';
import {seedPlan,buildPrompt} from './orchestrate.mjs';
import {validateOwnershipDeclarations,analyzePacketOwnership,checkPacketLaunchLocks} from './packetOwnership.mjs';
const raw=fs.readFileSync(IDEA_BOARD_FILE,'utf8');
const baseline=JSON.parse(raw),ri=baseline.records.findIndex(record=>record.id==='IB-0008');
const source=baseline.records[ri].sources[0],destination=baseline.records[ri].sources[1];
const reason='Parent reviewed this exact proposed primary URL; validator acceptance is not reachability.';
function packet(readSource=()=>raw){
  const brief=generateSourceTask([source.url],{readSource,rewrites:[{from:source.url,to:'https://example.com/wf295-source-probe',reason}]});
  return {id:'WF295-private',handle:'wf295-not-worker',agent:'claude',pet:'dream-girl',files:[IDEA_BOARD_FILE],scope:brief.title,...brief};
}
const task=p=>({title:p.title,body:p.body});

test('WF295: authoring refuses sibling, other-record and excluded collisions before producing an edit brief',()=>{
  for(const to of [destination.url,baseline.records.find((_,i)=>i!==ri).sources[0].url,baseline.excludedSources[0].url]){
    assert.throws(()=>generateSourceTask([source.url],{readSource:()=>raw,rewrites:[{from:source.url,to,reason}]}),error=>{
      assert.match(error.message,/WF-G295.*collision.*parent reconciliation/);assert.ok(error.report.collisions[0].owners.length>=2);return true;
    });
  }
  assert.throws(()=>generateSourceTask([baseline.excludedSources[0].url],{rewrites:[{from:baseline.excludedSources[0].url,to:'https://example.com/new',reason}]}),/excluded.*human rulings/);
  assert.equal(fs.readFileSync(IDEA_BOARD_FILE,'utf8'),raw);
});

test('WF295: authoring emits exact positions, current IDs, from-values and new-value reasons from one read',()=>{
  let reads=0;const p=packet(()=>{reads++;return raw;});assert.equal(reads,1);
  assert.deepEqual(p.dataEdits[0].field,['records',ri,'sources',0,'url']);
  assert.equal(p.sourceRecords[0].sourceId,source.id);assert.equal(p.sourceRewrites[0].from,source.url);
  assert.doesNotThrow(()=>inspectPacketSourceRewrites(p));assert.doesNotThrow(()=>assertTaskSourceRewrites(p,task(p)));
  assert.ok(sourceRewritePromptBlock(p).includes('REFERENCE-ONLY: SOURCE-REWRITE: '+JSON.stringify(p.sourceRewrites[0])));
  assert.doesNotThrow(()=>validateOwnershipDeclarations({packets:[p]}));
});

test('WF295: known primary DATA-EDIT cannot omit the source-rewrite probe; excluded edits preserve rulings',()=>{
  const p=packet();delete p.sourceRewrites;assert.throws(()=>inspectPacketSourceRewrites(p),/both be retained/);
  const excluded=packet();excluded.dataEdits[0].field=['excludedSources',0,'url'];assert.throws(()=>inspectPacketSourceRewrites(excluded),/human ruling/);
  const absent=packet();delete absent.dataEdits;assert.throws(()=>inspectPacketSourceRewrites(absent),/both be retained/);
});

test('WF295: queued source changes and changed positions need explicit parent reconciliation',()=>{
  const p=packet(),changed=structuredClone(baseline);changed.records[ri].sources.reverse();
  assert.throws(()=>inspectPacketSourceRewrites(p,{readSource:()=>JSON.stringify(changed)}),/positions differ/);
  const stale=structuredClone(baseline);stale.records[ri].sources[0].url='https://example.com/current-changed';
  assert.throws(()=>inspectPacketSourceRewrites(p,{readSource:()=>JSON.stringify(stale)}),/Stale from-value/);
  const colliding=structuredClone(baseline);colliding.records[ri].sources[1].url=p.sourceRewrites[0].to;
  assert.throws(()=>inspectPacketSourceRewrites(p,{readSource:()=>JSON.stringify(colliding)}),/collision/);
});

test('WF295: durable task cannot remove or replace the retained batch or data edits',()=>{
  const p=packet();
  for(const pattern of [/^REFERENCE-ONLY: SOURCE-REWRITE:.*$/m,/^REFERENCE-ONLY: DATA-EDIT:.*$/m])assert.throws(()=>assertTaskSourceRewrites(p,{...task(p),body:p.body.replace(pattern,'')}),/retained in both/);
  assert.throws(()=>assertTaskSourceRewrites({...p,sourceRewrites:[]},task(p)),/retained in both/);
  assert.throws(()=>assertTaskSourceRewrites(p,{...task(p),body:p.body.replace('wf295-source-probe','unreviewed')}),/retained in both/);
});

test('WF295: missing ownership, identity, invalid declarations and unavailable source are not proof',()=>{
  const p=packet();
  for(const changed of [{...p,files:[]},{...p,sourceRecords:[]},{...p,sourceRewrites:[{...p.sourceRewrites[0],approved:true}]},{...p,dataEdits:[{...p.dataEdits[0],from:'https://example.com/stale'}]}])assert.throws(()=>inspectPacketSourceRewrites(changed),/WF-G295/);
  for(const readSource of [()=>null,()=>'{',()=>{throw new Error('unavailable');},()=> ' '.repeat(2*1024*1024+1)])assert.throws(()=>inspectPacketSourceRewrites(p,{readSource}),/WF-G295/);
  assert.throws(()=>assertTaskSourceRewrites(p,{body:'SOURCE-REWRITE: {'}),/WF-G295/);
  assert.throws(()=>assertTaskSourceRewrites(p,{body:'x'.repeat(262145)}),/WF-G295/);
});

test('WF295: recognized source-rewrite prose requires declarations; identity-only and history remain readable',()=>{
  const p={id:'prose',files:[IDEA_BOARD_FILE],scope:'Rewrite source URL fields to their final destination'};
  assert.throws(()=>inspectPacketSourceRewrites(p),/pre-probed/);
  assert.doesNotThrow(()=>inspectPacketSourceRewrites({...p,scope:'Review source identity',guidance:'HISTORY: Rewrite source URL fields to their final destination'}));
  assert.doesNotThrow(()=>inspectPacketSourceRewrites({...p,scope:'Review current research identity'}));
  assert.doesNotThrow(()=>generateSourceTask([source.url]));
});

test('WF295: duplicate durable edits cannot hide a missing complete-batch member',()=>{
  const sources=baseline.records[ri].sources.slice(0,2);
  const brief=generateSourceTask(sources.map(s=>s.url),{rewrites:sources.map((s,i)=>({from:s.url,to:'https://example.com/wf295-batch-'+i,reason}))});
  const p={...brief,id:'batch',files:[IDEA_BOARD_FILE],scope:brief.title};
  const lines=p.body.split('\n'),edits=lines.filter(line=>line.startsWith('REFERENCE-ONLY: DATA-EDIT:'));
  const changed={...task(p),body:lines.map(line=>line===edits[1]?edits[0]:line).join('\n')};
  assert.throws(()=>assertTaskSourceRewrites(p,changed),/WF-G295/);
});

test('WF295: ordinary plural URL/address prescriptions cannot bypass the recognized grammar',()=>{
  for(const scope of ['Rewrite source URLs to their final destinations','Update primary addresses to their final destinations'])assert.throws(()=>inspectPacketSourceRewrites({id:'plural',files:[IDEA_BOARD_FILE],scope}),/WF-G295.*pre-probed/);
});

test('WF295: native source-task CLI prints safe drafts but refuses collisions without corpus writes',()=>{
  const run=to=>spawnSync(process.execPath,['scripts/idea-board/source-task.mjs','--rewrite',source.url,to,'--reason',reason],{encoding:'utf8'});
  const safe=run('https://example.com/wf295-native');assert.equal(safe.status,0,safe.stderr);assert.equal(JSON.parse(safe.stdout).sourceRewrites.length,1);
  const unsafe=run(destination.url);assert.equal(unsafe.status,1);assert.match(unsafe.stderr,/collision.*SRC-.*parent reconciliation/);assert.equal(unsafe.stdout,'');
  assert.equal(fs.readFileSync(IDEA_BOARD_FILE,'utf8'),raw);
});

test('WF295: private HTTP partition, seed and dispatch refuse collisions before effects; safe seed retains queued evidence',async()=>{
  const p=packet(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'agora-rewrite-proof-')),app=createAgoraServer({dir:path.join(dir,'board')});
  await new Promise(resolve=>app.listen(0,resolve));const baseUrl='http://127.0.0.1:'+app.server.address().port;
  const env={...process.env,AGORA_DIR:path.join(dir,'identity'),AGORA_AGENT_ID:'rewrite-proof',CODEX_THREAD_ID:'019f33f1-a4f0-76d0-b679-8e2928e640b7'};
  const snapshot=()=>JSON.stringify({agents:app.store.listAgents(),tasks:app.store.listTasks(),campaigns:app.store.listCampaigns(),locks:app.store.listLocks()});
  try{
    const plan={baseUrl,wave:'wf295-private',pet:'gf-sd',packets:[p]},file=path.join(dir,'plan.json');
    const invalid=structuredClone(p);invalid.sourceRewrites[0].to=destination.url;invalid.dataEdits[0].to=destination.url;invalid.dataValues[0].value=destination.url;
    fs.writeFileSync(file,JSON.stringify({...plan,packets:[invalid]}));const before=snapshot();
    for(const command of ['partition','seed','dispatch']){
      const r=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['tools/agora/orchestrate.mjs',command,file],{env});let log='';child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d);child.once('error',reject);child.once('close',code=>resolve({code,log}));});
      assert.equal(r.code,1,r.log);assert.match(r.log,/WF-G295.*collision/);assert.equal(snapshot(),before);
    }
    const seeded=await seedPlan(plan,{env}),durable=app.store.listTasks().find(t=>t.id===seeded[p.id]);assert.ok(durable);
    const line='REFERENCE-ONLY: SOURCE-REWRITE: '+JSON.stringify(p.sourceRewrites[0]);assert.ok(durable.body.includes(line));
    const ownership=analyzePacketOwnership({packets:[{...p,taskIds:[durable.id]}]},[durable]);assert.equal(ownership.ok,true,ownership.errors.join('\n'));
    for(const agent of ['claude','codex'])for(const taskId of [undefined,durable.id])assert.ok(buildPrompt(plan,{...p,agent},{taskId}).includes(line));
    let tasks=[durable];const fetchImpl=async url=>({ok:true,json:async()=>url.endsWith('/locks')?{locks:[]}:{tasks}});
    assert.equal((await checkPacketLaunchLocks(plan,p,{taskId:durable.id,fetchImpl})).ok,true);
    tasks=[{...durable,body:durable.body.replace(line,'')}];assert.equal((await checkPacketLaunchLocks(plan,p,{taskId:durable.id,fetchImpl})).ok,false);
    tasks=[{...durable,body:durable.body.replace(/^REFERENCE-ONLY: DATA-EDIT:.*$/m,'')}];assert.equal((await checkPacketLaunchLocks(plan,p,{taskId:durable.id,fetchImpl})).ok,false);
    assert.throws(()=>buildPrompt(plan,invalid),/WF-G295.*collision/);
    assert.equal(fs.readFileSync(IDEA_BOARD_FILE,'utf8'),raw);
  }finally{
    await app.close();assert.equal(path.dirname(dir),fs.realpathSync(os.tmpdir()));assert.match(path.basename(dir),/^agora-rewrite-proof-/);fs.rmSync(dir,{recursive:true,force:true});
  }
});
