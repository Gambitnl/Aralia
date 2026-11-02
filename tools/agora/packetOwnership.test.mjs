import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  analyzePacketOwnership,
  checkPlanOwnership,
  checkPacketLaunchLocks,
  formatLockSnapshot,
  formatPacketOwnershipReport,
  handoffPromptBlock,
  packetTaskIds,
  validateOwnershipDeclarations,
  ignoredPacketPaths,
  ignoredTestHomeErrors,
  localTestHomePromptBlock,
  forwarderOnlyPromptBlock,
} from './packetOwnership.mjs';
import { createAgoraServer } from './server.mjs';
import { buildPrompt, seedPlan } from './orchestrate.mjs';
import * as packetRules from './packetOwnership.mjs';
import { captureUnchangedUnionContext } from './unionConsumerOwnership.mjs';
import { inspectProductionCallers, productionCallerPromptBlock, productionFollowUpLine } from './productionCallerOwnership.mjs';
import {buildIdeaSourceTask,collectIdeaSourceIdentities,IDEA_BOARD_FILE} from './recordSourceProvenance.mjs';

// WF-G295: identity and value provenance alone cannot make a colliding rewrite
// executable. This uses current read-only data and never changes either source.
test('WF295: a fully attributed rewrite still fails before authoring when its destination is already owned',()=>{
  const data=JSON.parse(fs.readFileSync(IDEA_BOARD_FILE,'utf8'));
  const ri=data.records.findIndex(r=>r.id==='IB-0008'),record=data.records[ri];
  const [source,destination]=record.sources;
  const field=['records',ri,'sources',0,'url'];
  const reason='Parent reviewed the proposed destination; this does not override uniqueness.';
  const packet={id:'WF295-collision',scope:'Update primary source URL',files:[IDEA_BOARD_FILE],
    sourceRecords:buildIdeaSourceTask(data,[source.url]).sourceRecords,
    sourceRewrites:[{recordId:record.id,sourceId:source.id,from:source.url,to:destination.url,reason}],
    dataEdits:[{file:IDEA_BOARD_FILE,field,from:source.url,to:destination.url}],
    dataValues:[{file:IDEA_BOARD_FILE,field,value:destination.url,origin:{kind:'new',reason}}]};
  assert.throws(()=>validateOwnershipDeclarations({packets:[packet]}),/WF-G295.*collision/);
});

test('WF294: real private HTTP preflight refuses wrong identity before effects; valid seed and late checks retain it',async()=>{
  const beforeCorpus=fs.readFileSync(IDEA_BOARD_FILE,'utf8'),data=JSON.parse(beforeCorpus);
  const source=collectIdeaSourceIdentities(data).find(entry=>entry.recordId==='IB-0008'&&!entry.excluded&&entry.addressField==='url');assert.ok(source);
  const brief=buildIdeaSourceTask(data,[source.url]),record=brief.sourceRecords[0];
  const packet={id:'WF294-private',handle:'wf294-not-worker',agent:'claude',pet:'dream-girl',scope:brief.body.split('\n')[0],files:[IDEA_BOARD_FILE],sourceRecords:[{...record,recordId:'IB-0001'}]};
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'agora-record-owner-')),app=createAgoraServer({dir:path.join(dir,'board')});
  await new Promise(resolve=>app.listen(0,resolve));const baseUrl='http://127.0.0.1:'+app.server.address().port;
  const env={...process.env,AGORA_DIR:path.join(dir,'identity'),AGORA_AGENT_ID:'record-owner-proof',CODEX_THREAD_ID:'019f33f1-a4f0-76d0-b679-8e2928e640b7'};
  const snapshot=()=>JSON.stringify({agents:app.store.listAgents(),tasks:app.store.listTasks(),campaigns:app.store.listCampaigns(),locks:app.store.listLocks()});
  try{
    const plan={baseUrl,wave:'wf294-private',pet:'gf-sd',packets:[packet]},file=path.join(dir,'plan.json');fs.writeFileSync(file,JSON.stringify(plan));const before=snapshot();
    for(const command of ['partition','seed','dispatch']){
      const r=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(path.dirname(fileURLToPath(import.meta.url)),'orchestrate.mjs'),command,file],{env});let log='';child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d);child.once('error',reject);child.once('close',code=>resolve({code,log}));});
      assert.equal(r.code,1,r.log);assert.match(r.log,/WF-G294.*owner differs/);assert.equal(snapshot(),before,'refuse before any seed, presence, campaign or worker effect');
    }
    packet.sourceRecords=[record];const seeded=await seedPlan(plan,{env}),task=app.store.listTasks().find(t=>t.id===seeded[packet.id]);assert.ok(task);
    const line='REFERENCE-ONLY: SOURCE-RECORD: '+JSON.stringify(record);assert.ok(task.body.includes(line));
    assert.equal(analyzePacketOwnership({packets:[{...packet,taskIds:[task.id]}]},[task]).ok,true);
    for(const agent of ['claude','codex'])for(const taskId of [undefined,task.id])assert.ok(buildPrompt(plan,{...packet,agent},{taskId}).includes(line),'exact metadata in '+agent+' '+(taskId?'seeded':'unseeded'));
    let tasks=[task];const fetchImpl=async url=>({ok:true,json:async()=>url.endsWith('/locks')?{locks:[]}:{tasks}});
    assert.equal((await checkPacketLaunchLocks(plan,packet,{taskId:task.id,fetchImpl})).ok,true);
    tasks=[{...task,body:task.body.replace(line,'SOURCE-RECORD: '+JSON.stringify({...record,recordId:'IB-0001'}))}];assert.equal((await checkPacketLaunchLocks(plan,packet,{taskId:task.id,fetchImpl})).ok,false);
    tasks=[{...task,body:task.body+'\nSOURCE-RECORD: '+JSON.stringify({...record,addressField:'archiveUrl'})}];assert.equal((await checkPacketLaunchLocks(plan,packet,{taskId:task.id,fetchImpl})).ok,false);
    tasks=[{...task,body:'Review sources without the prior binding.'}];assert.equal((await checkPacketLaunchLocks(plan,packet,{taskId:task.id,fetchImpl})).ok,false,'a queued durable task cannot drop required source identity');
    assert.throws(()=>validateOwnershipDeclarations({packets:[{...packet,files:['tools/agora/taskLint.mjs']}]}),/source-record target is not owned/);
    assert.equal(fs.readFileSync(IDEA_BOARD_FILE,'utf8'),beforeCorpus);
  }finally{await app.close();assert.equal(path.dirname(dir),fs.realpathSync(os.tmpdir()));assert.match(path.basename(dir),/^agora-record-owner-/);fs.rmSync(dir,{recursive:true,force:true});}
});

test('WF267: an explicit task data literal must name current provenance before partition',()=>{
  const file='public/data/spells/level-3/animate-dead.json';
  const task={id:'agora-provenance',title:'Repair cadence',body:'Add "timing": "each_caster_turn" to '+file,refs:[file]};
  const packet={id:'data-values',scope:'Repair cadence',files:[file],taskIds:[task.id]};
  const report=analyzePacketOwnership({packets:[packet]},[task]);assert.equal(report.ok,false);assert.ok(report.errors.some(error=>/WF-G267/.test(error)),report.errors.join('\n'));
});

test('WF267: private HTTP seed/dispatch fail before effects; valid seed retains exact provenance and queued launches recheck it',async()=>{
  const target='public/data/spells/level-3/animate-dead.json',source='public/data/spells/level-6/create-undead.json';
  const record={file:target,field:['effects',1,'grantedActions',0,'frequency'],value:'each_turn',origin:{kind:'existing',file:source,field:['effects',0,'grantedActions',0,'frequency'],reason:'Current sibling expresses the same parent-reviewed authored command cadence.'}};
  const packet={id:'WF267-fixture',handle:'wf267-fixture-not-worker',agent:'claude',pet:'dream-girl',scope:'Set "frequency": "each_turn" in '+target+' effects[1].grantedActions[0].frequency',files:[target]};
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'agora-provenance-cli-')),app=createAgoraServer({dir:path.join(dir,'board')});
  await new Promise(resolve=>app.listen(0,resolve));const baseUrl='http://127.0.0.1:'+app.server.address().port;
  const env={...process.env,AGORA_DIR:path.join(dir,'identity'),AGORA_AGENT_ID:'provenance-proof',CODEX_THREAD_ID:'019f33f1-a4f0-76d0-b679-8e2928e640b7'};
  const beforeData=[fs.readFileSync(target,'utf8'),fs.readFileSync(source,'utf8')];
  const snapshot=()=>JSON.stringify({agents:app.store.listAgents(),tasks:app.store.listTasks(),campaigns:app.store.listCampaigns(),locks:app.store.listLocks()});
  try{
    const plan={baseUrl,wave:'wf267-private-proof',pet:'gf-sd',packets:[packet]},file=path.join(dir,'plan.json');fs.writeFileSync(file,JSON.stringify(plan));const before=snapshot();
    for(const command of ['partition','seed','dispatch']){
      const r=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(path.dirname(fileURLToPath(import.meta.url)),'orchestrate.mjs'),command,file],{env});let log='';child.stdout.on('data',d=>{log+=d;});child.stderr.on('data',d=>{log+=d;});child.once('error',reject);child.once('close',code=>resolve({code,log}));});
      assert.equal(r.code,1,r.log);assert.match(r.log,/WF-G267/);assert.equal(snapshot(),before,'no effect before provenance reconciliation');
    }
    packet.dataValues=[record];const seeded=await seedPlan(plan,{env}),task=app.store.listTasks().find(item=>item.id===seeded[packet.id]);assert.ok(task);assert.match(task.body,/REFERENCE-ONLY: DATA-VALUE:/);
    assert.equal(analyzePacketOwnership({packets:[{...packet,taskIds:[task.id]}]},[task]).ok,true);
    for(const agent of ['claude','codex'])for(const taskId of [undefined,task.id]){
      const prompt=buildPrompt(plan,{...packet,agent},{taskId});assert.match(prompt,/DATA VALUE PROVENANCE \(WF-G267\)/);
      assert.ok(prompt.includes('REFERENCE-ONLY: DATA-VALUE: '+JSON.stringify(record)),'exact provenance in '+agent+' '+(taskId?'seeded':'unseeded')+' prompt');
    }
    let tasks=[task];const fetchImpl=async url=>({ok:true,json:async()=>url.endsWith('/locks')?{locks:[]}:{tasks}});
    assert.equal((await checkPacketLaunchLocks(plan,packet,{taskId:task.id,fetchImpl})).ok,true);
    tasks=[{...task,body:task.body.replace('"each_turn"','"changed_cadence"')}];assert.equal((await checkPacketLaunchLocks(plan,packet,{taskId:task.id,fetchImpl})).ok,false);
    assert.throws(()=>validateOwnershipDeclarations({packets:[{...packet,files:['tools/agora/taskLint.mjs']}]}),/data target is not owned/);
    assert.deepEqual([fs.readFileSync(target,'utf8'),fs.readFileSync(source,'utf8')],beforeData,'source evidence stays read-only');
  }finally{await app.close();assert.equal(path.dirname(dir),fs.realpathSync(os.tmpdir()));assert.match(path.basename(dir),/^agora-provenance-cli-/);fs.rmSync(dir,{recursive:true,force:true});}
});

// WF-G255: pure-module ownership must not masquerade as production delivery.
test('WF255: an explicit wiring packet cannot omit its production caller audit', () => {
  const packet = { id: 'missing-caller', scope: 'Wire buildWitnessDialogueContext into dialogue', files: ['src/services/dialogueService.ts'] };
  assert.throws(() => validateOwnershipDeclarations({ packets: [packet] }), /WF-G255.*productionCallers/);
});

test('WF255: a live wiring task cannot bypass preflight through a vague packet scope', () => {
  const packet = { id: 'missing-task-caller', scope: 'Repair the module', files: ['tools/agora/packetOwnership.mjs'], taskIds: ['agora-f255'] };
  const task = { id: 'agora-f255', title: 'Wire witness context into dialogue', body: 'Wire buildWitnessDialogueContext into dialogue', refs: ['src/services/dialogueService.ts'] };
  const report = analyzePacketOwnership({ packets: [packet] }, [task]);
  assert.ok(report.errors.some(message => /WF-G255.*productionCallers/.test(message)), report.errors.join('\n'));
});

function productionFixture() {
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
  const module='src/services/dialogueService.ts',caller='src/hooks/useDialogueSystem.ts';
  const route={id:'witness-dialogue',module:{file:module,symbol:'buildNpcDialoguePromptContext',quote:'export function buildNpcDialoguePromptContext('},
    callers:[{file:caller,symbol:'useDialogueSystem',quote:'export const useDialogueSystem = (',relation:'existing',reason:'Current production controller directly calls the complete prompt builder.',delivery:'owned'}],
    state:{field:'npcMemory',quote:'export const useDialogueSystem = (\n    gameState: GameState,',relation:'existing',reason:'Controller receives canonical GameState; full-state parameter delivery remains parent reviewed.'},
    review:'Read-only current-source audit of the historical witness wiring: this controller holds GameState and calls the service builder; runtime behavior is not executed by this fixture.'};
  const files=['src/services/dialogueService.*','src/services/__tests__/dialogueService*.test.*','src/hooks/useDialogueSystem.*','src/hooks/__tests__/useDialogueSystem*.test.*'];
  return {root,route,packet:{id:'PK-production',handle:'production-fixture',agent:'claude',pet:'dream-girl',scope:'Wire witness context into dialogue',files,productionCallers:[route],unionReviews:unchangedFixtureUnions(files)}};
}

test('WF255: queued launch refreshes seeded metadata and unfinished dependent caller tasks',async()=>{
  const {packet}=productionFixture(),taskId='agora-queued';
  const task={id:taskId,title:'Wire witness into dialogue',state:'claimed',campaignId:'campaign',body:productionCallerPromptBlock(packet)};
  let tasks=[task],reads=0;
  const fetchImpl=async url=>({ok:true,json:async()=>url.endsWith('/locks')?{locks:[]}:(reads++,{tasks})});
  const launch=()=>checkPacketLaunchLocks({baseUrl:'http://fixture'},packet,{taskId,fetchImpl});
  assert.equal((await launch()).ok,true);
  tasks=[{...task,body:'PRODUCTION-CALLER: broken'}];assert.equal((await launch()).ok,false,'changed seeded metadata must be checked again');
  const deferred=structuredClone(packet);deferred.files=deferred.files.filter(file=>!file.startsWith('src/hooks/'));deferred.taskIds=[taskId];
  Object.assign(deferred.productionCallers[0].callers[0],{delivery:'deferred',followUpTask:'agora-follow'});
  const entry=deferred.productionCallers[0],caller=entry.callers[0];
  const follow={id:'agora-follow',state:'open',campaignId:'campaign',refs:[caller.file],deps:[{id:taskId,type:'blocks'}],body:productionFollowUpLine(entry,caller)};
  tasks=[{...task,body:productionCallerPromptBlock(deferred)},follow];
  const splitLaunch=()=>checkPacketLaunchLocks({baseUrl:'http://fixture'},deferred,{taskId,fetchImpl});
  assert.equal((await splitLaunch()).ok,true);tasks[1]={...follow,deps:[]};assert.equal((await splitLaunch()).ok,false,'lost blocking edge must stop queued launch');
  assert.equal(reads,4,'fresh tasks before every launch');
});

test('WF255: current historical caller chain passes; briefs and every prompt retain declarations and limits',()=>{
  const {packet}=productionFixture();const report=analyzePacketOwnership({packets:[packet]});
  assert.equal(report.ok,true,formatPacketOwnershipReport(report));assert.equal(report.productionCallers[0].stateSyntaxVerified,true);
  assert.match(formatPacketOwnershipReport(report),/PRODUCTION CALLER.*useDialogueSystem/);
  for(const agent of ['claude','codex'])for(const taskId of [undefined,'agora-build']){
    const prompt=buildPrompt({wave:'production-proof',packets:[packet]},{...packet,agent},{taskId});assert.ok(prompt.includes('REFERENCE-ONLY: PRODUCTION-CALLER: '+JSON.stringify(packet.productionCallers[0])));assert.match(prompt,/Planned\/deferred wiring remains incomplete/);
  }
  const task={id:'agora-build',title:'Integration metadata',body:productionCallerPromptBlock(packet),refs:[]};
  const revised={...packet,scope:'Metadata audit',taskIds:[task.id],productionCallers:[]};
  const dropped=analyzePacketOwnership({packets:[revised]},[task]);assert.ok(dropped.errors.some(message=>/retained exactly/.test(message)));
});

test('WF255: real private HTTP partition/seed/dispatch stop before effects; a valid seed preserves the current caller record',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'agora-prod-cli-')),app=createAgoraServer({dir:path.join(dir,'board')});
  await new Promise(resolve=>app.listen(0,resolve));const baseUrl='http://127.0.0.1:'+app.server.address().port;
  const env={...process.env,AGORA_DIR:path.join(dir,'identity'),AGORA_AGENT_ID:'production-proof',CODEX_THREAD_ID:'019f33f1-a4f0-76d0-b679-8e2928e640b7'};
  const snapshot=()=>JSON.stringify({agents:app.store.listAgents(),tasks:app.store.listTasks(),campaigns:app.store.listCampaigns(),locks:app.store.listLocks()});
  try {
    const {packet}=productionFixture();delete packet.productionCallers;
    const plan={baseUrl,wave:'production-proof',pet:'gf-sd',packets:[packet]},file=path.join(dir,'plan.json');fs.writeFileSync(file,JSON.stringify(plan));const before=snapshot();
    for(const command of ['partition','seed','dispatch']){
      const result=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(path.dirname(fileURLToPath(import.meta.url)),'orchestrate.mjs'),command,file],{env});let log='';child.stdout.on('data',d=>{log+=d;});child.stderr.on('data',d=>{log+=d;});child.once('error',reject);child.once('close',code=>resolve({code,log}));});
      assert.equal(result.code,1,command+result.log);assert.match(result.log,/WF-G255.*productionCallers/);assert.equal(snapshot(),before,'no board write or worker launch before caller audit');
    }
    packet.productionCallers=productionFixture().packet.productionCallers;
    const seeded=await seedPlan(plan,{env});const task=app.store.listTasks().find(item=>item.id===seeded[packet.id]);assert.ok(task);assert.match(task.body,/REFERENCE-ONLY: PRODUCTION-CALLER:/);
    assert.equal(task.state,'open');assert.equal(analyzePacketOwnership({packets:[{...packet,taskIds:[task.id]}]},[task]).ok,true);
    const malformed={...packet,productionCallers:[]};assert.throws(()=>buildPrompt(plan,malformed),/WF-G255/);
    assert.equal(inspectProductionCallers(packet,app.store.listTasks()).length,1);
  } finally {await app.close();assert.equal(path.dirname(dir),fs.realpathSync(os.tmpdir()));assert.match(path.basename(dir),/^agora-prod-cli-/);fs.rmSync(dir,{recursive:true,force:true});}
});

// These pre-existing metadata fixtures deliberately change no finite unions.
// Author that premise explicitly so the new gate cannot mask their older checks.
function unchangedFixtureUnions(files) {
  return [...new Set(fs.globSync(files))].map(file => file.replaceAll('\\','/')).filter(file => file.startsWith('src/') && /\.[jt]sx?$/.test(file) && !/\.d\.ts$/.test(file))
    .map(file => captureUnchangedUnionContext(file, 'Metadata-only regression fixture: finite union contracts deliberately remain unchanged; preserve the separately tested ownership obligation.')).filter(Boolean);
}

test('WF283: existing task member premises cannot bypass the partition gate or grant quoted files', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const dir = fs.mkdtempSync(path.join(root, '.agent/scratch/wf283-task-'));
  try {
    const file = path.relative(root, path.join(dir, 'vocabulary.ts')).replaceAll('\\', '/');
    const quote = 'export type Cultural = "shrine" | "garden";';
    fs.writeFileSync(path.join(root, file), quote + '\nexport type Civic = "gatehouse";');
    const value = { file, symbol: 'Cultural', kind: 'string-union', quote, members: ['shrine', 'garden'] };
    const p = { packets: [{ id: 'members', files: ['tools/agora/taskLint.mjs'], taskIds: ['agora-f283'] }] };
    const task = members => ({ id: 'agora-f283', title: 'Verify vocabulary', refs: [], body: 'REFERENCE-ONLY: SOURCE-MEMBERS: ' + JSON.stringify({ ...value, members }) });
    const bad = analyzePacketOwnership(p, [task([...value.members, 'gatehouse'])]);
    assert.ok(bad.errors.some(message => /WF-G283/.test(message))); assert.equal(bad.ok, false);
    const good = analyzePacketOwnership(p, [task(value.members)]);
    assert.equal(good.ok, true, formatPacketOwnershipReport(good));
    assert.ok(!formatPacketOwnershipReport(good).includes('unowned ' + file));
  } finally { assert.equal(path.dirname(dir), path.join(root, '.agent/scratch')); assert.match(path.basename(dir), /^wf283-task-/); fs.rmSync(dir, { recursive: true, force: true }); }
});

// Read-only premise checks use private JSON, never rewrite the game corpus.
test('WF237: registry-backed omitted wiring fails, deliberate ownership and exact sibling handoffs pass', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
  const role = (file,change=true) => ({file,quote:fs.readFileSync(path.join(root,file),'utf8').slice(0,160),change,...(!change?{reason:'Current caller remains unchanged; inspect it before accepting dependent integration.'}:{})});
  const routes = [
    {id:'inventory-route',kind:'ui',action:'MOVE_ITEM_TO_CONTAINER',relation:'planned',reason:'Registry-backed planned delivery audit, not recovered historical packet or runtime proof.',payloadFields:['itemId','containerId'],metadataExpectation:{isUiToggle:true},roles:{stateType:role('src/state/actionTypes.ts'),reducer:role('src/state/reducers/characterReducer.ts'),uiType:role('src/types/actions.ts'),metadata:role('src/types/actions.ts'),handler:role('src/hooks/actions/actionHandlers.ts'),emitter:role('src/components/CharacterSheet/Overview/InventoryList.tsx')}},
    {id:'enemy-payload',kind:'payload',action:'END_BATTLE',relation:'planned',reason:'Registry-backed builder ownership obligation; current helper is not executed.',payloadFields:['finalEnemyState'],builderExport:'createBattleEndActions',roles:{stateType:role('src/state/actionTypes.ts'),reducer:role('src/state/reducers/characterReducer.ts'),builder:role('src/utils/combat/battleEndActions.ts'),caller:role('src/App.tsx',false)}},
  ];
  const companions = files => [...new Set(files.flatMap(file => {
    const directory=path.posix.dirname(file),stem=path.posix.basename(file,path.posix.extname(file)),result=[file];
    const twin=file.replace(/\.[jt]sx?$/,'.d.ts');if(fs.existsSync(path.join(root,twin)))result.push(twin);
    for(const dir of [directory,directory+'/__tests__'])if(fs.existsSync(path.join(root,dir)))for(const name of fs.readdirSync(path.join(root,dir)))if(name.startsWith(stem)&&/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(name))result.push(dir+'/'+name);
    return result;
  }))];
  const unchanged=unchangedFixtureUnions(routes.flatMap(route=>Object.values(route.roles).map(role=>role.file)));
  const original={packets:[{id:'PK-17',files:companions(['src/state/actionTypes.ts','src/state/reducers/characterReducer.ts','src/components/CharacterSheet/Overview/InventoryList.tsx']),actionWiring:routes,unionReviews:unchanged}]};
  const before=structuredClone(original),failed=analyzePacketOwnership(original,[]);
  for(const file of ['src/types/actions.ts','src/hooks/actions/actionHandlers.ts','src/utils/combat/battleEndActions.ts'])assert.ok(failed.errors.some(error=>error.includes(file)&&error.includes('outside')));
  assert.deepEqual(original,before);
  const corrected=structuredClone(original);corrected.packets[0].files=companions([...new Set(routes.flatMap(route=>Object.values(route.roles).filter(role=>role.change).map(role=>role.file)))]);
  assert.equal(analyzePacketOwnership(corrected,[]).ok,true);
  const sibling=structuredClone(corrected),owned=companions(['src/types/actions.ts','src/hooks/actions/actionHandlers.ts','src/utils/combat/battleEndActions.ts']);
  sibling.packets[0].files=sibling.packets[0].files.filter(file=>!owned.includes(file));
  sibling.packets[0].handoffs=['src/types/actions.ts','src/hooks/actions/actionHandlers.ts','src/utils/combat/battleEndActions.ts'].map(ref=>({ref,toPacket:'PK-wire',expectedBreakage:'Dependent action delivery remains incomplete until this owning sibling lands and integration is verified.'}));
  sibling.packets.push({id:'PK-wire',files:owned,unionReviews:unchanged});
  assert.equal(analyzePacketOwnership(sibling,[]).ok,true);
  sibling.packets[0].handoffs[0].toPacket='PK-wrong';assert.throws(()=>analyzePacketOwnership(sibling,[]),/handoff/);
  const task={id:'agora-route',body:'REFERENCE-ONLY: ACTION-WIRING: '+JSON.stringify(routes[0])};
  const dropped={packets:[{id:'PK-doc',files:['tools/agora/AGENT.md'],taskIds:[task.id]}]};
  assert.match(formatPacketOwnershipReport(analyzePacketOwnership(dropped,[task])),/WF-G237/);
});

function dataPremiseFixture(check) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-data-premise-'));
  const text = JSON.stringify({ nested: { sizes: ['Huge or smaller'] }, nil: null, falseValue: false, zero: 0,
    'a.b': { 'a/b': { '': ['old'] } } });
  fs.writeFileSync(path.join(root, 'input.json'), text);
  const packet = { id: 'data-fixture', scope: 'review existing data', files: ['input.json'],
    dataEdits: [{ file: 'input.json', field: ['nested', 'sizes'], from: ['Huge or smaller'], to: ['Large or smaller'] }] };
  try { check(root, packet); assert.equal(fs.readFileSync(path.join(root, 'input.json'), 'utf8'), text); }
  finally { assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir())); fs.rmSync(root, { recursive: true, force: true }); }
}

test('WF327: recorded current values pass; missing from-values remain verification obligations, not inferred declarations', () => {
  dataPremiseFixture((root, packet) => {
    const recorded = packetRules.inspectPacketDataEdits(packet, { repoRoot: root });
    assert.deepEqual(recorded[0].current, ['Huge or smaller']);
    assert.equal(recorded[0].needsVerification, false);
    delete packet.dataEdits[0].from;
    const pending = packetRules.inspectPacketDataEdits(packet, { repoRoot: root });
    assert.equal(pending[0].needsVerification, true);
    assert.equal(Object.hasOwn(pending[0], 'from'), false);
    assert.deepEqual(pending[0].current, ['Huge or smaller']);
    assert.deepEqual(packetRules.inspectPacketDataEdits({ files: ['input.json'] }, { repoRoot: root }), []);
  });
});

test('WF327: stale, literal no-op, malformed, unowned and duplicate field prescriptions refuse without writes', () => {
  dataPremiseFixture((root, packet) => {
    const edit = packet.dataEdits[0];
    for (const amendment of [{ from: ['obsolete'] }, { to: ['Huge or smaller'] }, { field: [] }, { field: ['missing'] },
      { field: ['nested', 'sizes', 'length'] }, { to: undefined }, { to: NaN }, { file: '../input.json' },
      { file: '/input.json' }, { file: 'C:/input.json' }, { file: '*.json' }, { file: '{a,b}.json' }, { file: 'unowned.json' }, { typo: 'ignored?' }]) {
      assert.throws(() => packetRules.inspectPacketDataEdits({ ...packet, dataEdits: [{ ...edit, ...amendment }] },
        { repoRoot: root }), /WF-G327/);
    }
    assert.throws(() => packetRules.inspectPacketDataEdits({ ...packet, dataEdits: 'not-an-array' }, { repoRoot: root }), /WF-G327/);
    assert.throws(() => packetRules.inspectPacketDataEdits({ ...packet, dataEdits: [edit, edit] }, { repoRoot: root }), /duplicate/);
    fs.writeFileSync(path.join(root, 'bad.json'), 'not json');
    assert.throws(() => packetRules.inspectPacketDataEdits({ ...packet, files: ['bad.json'],
      dataEdits: [{ ...edit, file: 'bad.json' }] }, { repoRoot: root }), /WF-G327.*JSON/);
  });
});

test('WF327: structured key paths retain dots, slashes, empty keys, null, false, zero and real array indices', () => {
  dataPremiseFixture((root, packet) => {
    const edits = [{ file: 'input.json', field: ['a.b', 'a/b', '', 0], from: 'old', to: 'new' },
      { file: 'input.json', field: ['nil'], from: null, to: false },
      { file: 'input.json', field: ['falseValue'], from: false, to: true },
      { file: 'input.json', field: ['zero'], from: 0, to: 1 }];
    assert.deepEqual(packetRules.inspectPacketDataEdits({ ...packet, dataEdits: edits }, { repoRoot: root }).map(e => e.current),
      ['old', null, false, 0]);
    assert.throws(() => packetRules.inspectPacketDataEdits({ ...packet, dataEdits: [{ ...edits[0], field: ['__proto__'] }] },
      { repoRoot: root }), /existing JSON field/);
  });
});

test('WF327: an owned lexical path does not authorize reading through a link outside the repository', () => {
  dataPremiseFixture((root, packet) => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-data-outside-'));
    try {
      fs.writeFileSync(path.join(outside, 'input.json'), JSON.stringify({ nested: { sizes: ['Huge or smaller'] } }));
      fs.symlinkSync(outside, path.join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
      assert.throws(() => packetRules.inspectPacketDataEdits({ ...packet, files: ['linked/input.json'],
        dataEdits: [{ ...packet.dataEdits[0], file: 'linked/input.json' }] }, { repoRoot: root }), /outside.*repository/);
    } finally {
      fs.unlinkSync(path.join(root, 'linked'));
      assert.equal(path.dirname(outside), fs.realpathSync(os.tmpdir())); fs.rmSync(outside, { recursive: true, force: true });
    }
  });
});

test('WF-G333: direct ownership analysis refuses descriptive or placeholder owned targets', () => {
  for (const file of ['discover: the settings UI component', 'discover the settings type', 'find the reducer',
    'locate: the production caller', 'maybe SystemMenu.tsx', 'TBD', 'TODO: choose a surface', 'src/<chosen-ui>.tsx']) {
    assert.throws(() => analyzePacketOwnership({ packets: [{ id: 'PK-unresolved', files: [file] }] }), /WF-G333/, file);
  }
  const packet = { id: 'PK-known', files: ['tools/agora/deliberate-new.mjs'] };
  assert.equal(analyzePacketOwnership({ packets: [packet] }).ok, true, 'literal new-file intent remains available');
  packet.scope = 'DISCOVERY-REQUIRED: choose a settings location';
  assert.throws(() => validateOwnershipDeclarations({ packets: [packet] }), /WF-G333/);
});

const bridge = 'src/utils/combat/combatUtils.ts';

// The current game chain is read-only evidence; this packet never launches a worker.
const weatherLeaf = 'src/components/BattleMap/vfx/environmentEffects.tsx';
const weatherParent = 'src/components/BattleMap/vfx/VFXSystem.tsx';
const weatherFiles = source => {
  const files = [source], twin = source.replace('.tsx', '.d.ts');
  if (fs.existsSync(twin)) files.push(twin);
  const directory = path.posix.dirname(source), stem = path.posix.basename(source, '.tsx');
  for (const dir of [directory, directory + '/__tests__']) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) if (file.startsWith(stem) && /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file)) files.push(dir + '/' + file);
  }
  return files;
};
const weatherMount = { leaf: weatherLeaf, parent: weatherParent, symbol: 'AmbientWeather', relation: 'existing', delivery: 'owned' };

// Read current shared contracts without changing game files or launching workers.
// Fixtures that name live source find their paths at test time, so a source move
// cannot break them: src/types/combat.ts became a barrel over src/types/combat/*.ts,
// and a fixed contract path no longer matched the declaration file the analyzer reports.
const liveSourceFiles = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const file = path.posix.join(dir, entry.name);
  return entry.isDirectory() ? liveSourceFiles(file) : /\.[cm]?[jt]sx?$/.test(entry.name) ? [file] : [];
});
const declaringFile = (symbol, dir) => {
  const declaration = new RegExp('^export\\s+(?:interface|type|class|enum)\\s+' + symbol + '\\b', 'm');
  const found = liveSourceFiles(dir).filter(file => declaration.test(fs.readFileSync(file, 'utf8')));
  assert.equal(found.length, 1, symbol + ' must have exactly one declaration file under ' + dir + ': ' + found.join(', '));
  return found[0];
};
const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const combatCaller = 'src/hooks/combat/useActionExecutor.ts';
const combatContract = declaringFile('CombatLogEntry', 'src/types');
const sharedContractFiles = source => {
  const files = [source], twin = source.replace(/\.[^.]+$/, '.d.ts');
  if (fs.existsSync(twin)) files.push(twin);
  const directory = path.posix.dirname(source), stem = path.posix.basename(source, path.posix.extname(source));
  for (const dir of [directory, directory + '/__tests__']) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) if (file.startsWith(stem) && /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file)) files.push(dir + '/' + file);
  }
  return files;
};

test('WF228: partition exposes current imported type contracts, packet owners and holders without file grants', () => {
  const packet = { id: 'PK-combat', handle: 'combat-read-fixture', files: sharedContractFiles(combatCaller) };
  const before = JSON.stringify(packet), bytes = fs.readFileSync(combatCaller);
  const unassigned = analyzePacketOwnership({ packets: [packet] });
  assert.equal(unassigned.ok, true, 'ordinary type imports do not imply an edit or required handoff');
  const candidate = unassigned.sharedTypes?.entries.find(item => item.source === combatCaller && item.file === combatContract);
  assert.ok(candidate, 'current direct imported CombatLogEntry contract must be visible');
  assert.equal(candidate.ownership, 'unassigned'); assert.deepEqual(candidate.owners, []);
  assert.ok(candidate.symbols.includes('CombatLogEntry'));
  const owner = { id: 'PK-types', handle: 'type-owner-fixture', files: sharedContractFiles(combatContract), unionReviews:unchangedFixtureUnions(sharedContractFiles(combatContract)) };
  const lock = { id: 'type-fixture-lock', agentId: 'type-holder-fixture', paths: [combatContract], globs: [], reason: 'fixture only' };
  const report = analyzePacketOwnership({ packets: [packet, owner] }, [], [lock]);
  const owned = report.sharedTypes.entries.find(item => item.source === combatCaller && item.file === combatContract);
  assert.equal(owned.ownership, 'sibling'); assert.equal(owned.owners[0].packetId, owner.id);
  assert.equal(owned.owners[0].handle, owner.handle); assert.equal(owned.locks[0].agentId, lock.agentId);
  assert.match(formatPacketOwnershipReport(report), new RegExp('SHARED TYPE.*useActionExecutor.*' + escapeRegExp(combatContract)));
  assert.match(formatPacketOwnershipReport(report), /type-owner-fixture/);
  assert.match(formatPacketOwnershipReport(report), /not.*edit permission/i);
  assert.equal(JSON.stringify(packet), before); assert.deepEqual(fs.readFileSync(combatCaller), bytes);
});

test('WF228: both worker variants retain advisory type observations and stop unowned type-change improvisation', () => {
  const packet = { id: 'PK-combat', handle: 'combat-prompt-fixture', agent: 'claude', pet: 'dream-girl',
    scope: 'Metadata-only shared type audit', files: sharedContractFiles(combatCaller) };
  const plan = { wave: 'shared-type-proof', packets: [packet] }, report = analyzePacketOwnership(plan);
  for (const agent of ['claude', 'codex']) for (const seeded of [false, true]) {
    const prompt = buildPrompt(plan, { ...packet, agent }, { ...(seeded ? { taskId: 'agora-type-proof' } : {}),
      lockSnapshot: report.lockSnapshot, sharedTypes: report.sharedTypes });
    assert.match(prompt, /SHARED TYPE DEPENDENCIES \(WF-G228\)/);
    assert.match(prompt, /CombatLogEntry/); assert.match(prompt, /unassigned/);
    assert.match(prompt, /SHARED TYPE CHANGES \(WF-G228\)/);
    assert.match(prompt, /do not silently encode|Do not silently encode/);
    assert.match(prompt, /not.*edit permission/i);
  }
  assert.match(buildPrompt(plan, packet), /audit not supplied/i);
});

test('WF228: real isolated partition/prompt CLI is read-only and seeded briefs preserve reference-only observations', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-shared-cli-'));
  const app = createAgoraServer({ dir: path.join(dir, 'board'), seatRosterPath: null });
  const here = path.dirname(fileURLToPath(import.meta.url));
  const bytes = new Map([combatCaller, combatContract].map(file => [file, fs.readFileSync(file)]));
  await new Promise(resolve => app.listen(0, resolve));
  const baseUrl = 'http://127.0.0.1:' + app.server.address().port;
  const env = { ...process.env, AGORA_DIR: path.join(dir, 'identity'), AGORA_AGENT_ID: 'shared-type-proof',
    CODEX_THREAD_ID: '019f33f1-a4f0-76d0-b679-8e2928e640b7' };
  const snapshot = () => JSON.stringify({ agents: app.store.listAgents(), campaigns: app.store.listCampaigns(),
    tasks: app.store.listTasks(), locks: app.store.listLocks() });
  const execute = args => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(here, 'orchestrate.mjs'), ...args], { env, windowsHide: true });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('shared-type fixture CLI timed out')); }, 60000);
    child.stdout.on('data', data => { stdout += data; }); child.stderr.on('data', data => { stderr += data; });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
  });
  try {
    const packet = { id: 'PK-combat', handle: 'shared-combat-fixture', agent: 'claude', pet: 'dream-girl',
      scope: 'Metadata-only imported contract proof', files: sharedContractFiles(combatCaller) };
    const owner = { id: 'PK-types', handle: 'shared-owner-fixture', agent: 'claude', pet: 'ramanujan',
      scope: 'Metadata-only contract owner proof', files: sharedContractFiles(combatContract), unionReviews:unchangedFixtureUnions(sharedContractFiles(combatContract)) };
    // Each private board has unique task ids. Never reuse an old board's seed map.
    const plan = { baseUrl, wave: 'shared-types-cli-proof-' + path.basename(dir), pet: 'gf-sd', packets: [packet, owner] };
    const file = path.join(dir, 'plan.json'); fs.writeFileSync(file, JSON.stringify(plan));
    const before = snapshot();
    const partition = await execute(['partition', file]);
    assert.equal(partition.code, 0, partition.stdout + partition.stderr);
    assert.match(partition.stdout, new RegExp('SHARED TYPE.*PK-combat.*' + escapeRegExp(combatContract)));
    assert.match(partition.stdout, /PK-types \(shared-owner-fixture\)/);
    const prompt = await execute(['prompt', file, packet.id]);
    assert.equal(prompt.code, 0, prompt.stdout + prompt.stderr);
    assert.match(prompt.stdout, /SHARED TYPE DEPENDENCIES \(WF-G228\)/);
    assert.match(prompt.stdout, /CombatLogEntry/); assert.match(prompt.stdout, /shared-owner-fixture/);
    assert.equal(snapshot(), before, 'partition and prompt perform no board writes or worker launch');
    const seeded = await execute(['seed', file]); assert.equal(seeded.code, 0, seeded.stdout + seeded.stderr);
    const task = app.store.listTasks().find(task => task.title.startsWith('PK-combat:'));
    assert.ok(task); assert.match(task.body, /REFERENCE-ONLY: SHARED-TYPE:/);
    assert.match(task.body, /CombatLogEntry/); assert.match(task.body, /shared-owner-fixture/);
    const { extractTaskOwnershipPaths } = await import('./taskLint.mjs');
    assert.ok(!extractTaskOwnershipPaths(task).some(item => item.ref === combatContract));
    assert.equal(app.store.listLocks().length, 0); assert.equal(app.store.listAgents().length, 1, 'only the fixture orchestrator is registered');
    for (const [source, prior] of bytes) assert.deepEqual(fs.readFileSync(source), prior);
  } finally {
    const seed = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.agent/scratch/orchestrate', 'seed-shared-types-cli-proof-' + path.basename(dir) + '.json');
    assert.equal(path.dirname(seed), path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.agent/scratch/orchestrate'));
    if (fs.existsSync(seed)) fs.unlinkSync(seed);
    await app.close(); assert.equal(path.dirname(dir), fs.realpathSync(os.tmpdir())); fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('WF214: a declared current mount point must be owned; the real 3D importer passes and the false 2D parent refuses', () => {
  const packet = { id: 'PK-weather', files: weatherFiles(weatherLeaf), mountPoints: [weatherMount], unionReviews:unchangedFixtureUnions([...weatherFiles(weatherLeaf),...weatherFiles(weatherParent)]) };
  assert.throws(() => analyzePacketOwnership({ packets: [packet] }), /WF-G214/);
  packet.files.push(...weatherFiles(weatherParent));
  const before = JSON.stringify(packet), report = analyzePacketOwnership({ packets: [packet] });
  assert.equal(report.ok, true); assert.equal(report.mountPoints[0].importVerified, true);
  assert.match(formatPacketOwnershipReport(report), /MOUNT POINT.*environmentEffects.*VFXSystem/);
  assert.equal(JSON.stringify(packet), before);
  const falseParent = 'src/components/BattleMap/BattleMap.tsx';
  assert.throws(() => analyzePacketOwnership({ packets: [{ ...packet, files: [...packet.files, falseParent],
    mountPoints: [{ ...weatherMount, parent: falseParent }] }] }), /WF-G214.*runtime import/);
});

test('WF214: declared mount intent is retained in both seeded/unseeded worker variants, not a visual acceptance claim', () => {
  const packet = { id: 'PK-weather', handle: 'weather-fixture', agent: 'claude', pet: 'dream-girl', scope: 'Mount ownership metadata proof only',
    files: [...weatherFiles(weatherLeaf), ...weatherFiles(weatherParent)], mountPoints: [weatherMount], unionReviews:unchangedFixtureUnions([...weatherFiles(weatherLeaf),...weatherFiles(weatherParent)]) };
  for (const external of [false, true]) for (const seeded of [false, true]) {
    const prompt = buildPrompt({ wave: 'mount-proof', packets: [packet] }, { ...packet, external }, seeded ? { taskId: 'agora-proof' } : {});
    assert.match(prompt, /MOUNT POINTS \(WF-G214\)/); assert.match(prompt, /environmentEffects\.tsx/);
    assert.match(prompt, /not.*rendered.*acceptance/i);
    assert.match(prompt, /Missing or contradictory mount declarations require parent reconciliation/);
  }
  const bare = { ...packet }; delete bare.mountPoints;
  for (const external of [false, true]) assert.match(buildPrompt({ wave: 'missing-mount', packets: [bare] }, { ...bare, external }), /MOUNT DELIVERY \(WF-G214\)/);
});

test('WF214: partition/seed/dispatch reject false current mount claims without board writes or launch; seeded task retains valid intent', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-mount-cli-'));
  const app = createAgoraServer({ dir: path.join(dir, 'board') });
  await new Promise(resolve => app.listen(0, resolve));
  const baseUrl = 'http://127.0.0.1:' + app.server.address().port;
  const env = { ...process.env, AGORA_DIR: path.join(dir, 'identity'), AGORA_AGENT_ID: 'mount-proof',
    CODEX_THREAD_ID: '019f33f1-a4f0-76d0-b679-8e2928e640b7' };
  const snapshot = () => JSON.stringify({ agents: app.store.listAgents(), campaigns: app.store.listCampaigns(),
    tasks: app.store.listTasks(), locks: app.store.listLocks() });
  try {
    const falseParent = 'src/components/BattleMap/BattleMap.tsx';
    const packet = { id: 'PK-weather', handle: 'weather-fixture', agent: 'claude', pet: 'dream-girl', scope: 'Metadata-only mount ownership proof',
      files: [...weatherFiles(weatherLeaf), ...weatherFiles(weatherParent), falseParent],
      mountPoints: [{ ...weatherMount, parent: falseParent }], unionReviews:unchangedFixtureUnions([...weatherFiles(weatherLeaf),...weatherFiles(weatherParent),falseParent]) };
    const plan = { baseUrl, wave: 'mount-proof', pet: 'gf-sd', packets: [packet] };
    const before = snapshot(), file = path.join(dir, 'plan.json'); fs.writeFileSync(file, JSON.stringify(plan));
    for (const command of ['partition', 'seed', 'dispatch']) {
      const result = await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [path.join(path.dirname(fileURLToPath(import.meta.url)), 'orchestrate.mjs'), command, file], { env });
        let log = ''; child.stdout.on('data', data => { log += data; }); child.stderr.on('data', data => { log += data; });
        child.once('error', reject); child.once('close', code => resolve({ code, log }));
      });
      assert.equal(result.code, 1, command + result.log); assert.match(result.log, /WF-G214.*runtime import/);
      assert.equal(snapshot(), before, 'no source claim triggers board writes or worker launch');
    }
    packet.files = [...weatherFiles(weatherLeaf), ...weatherFiles(weatherParent)]; packet.mountPoints = [weatherMount];
    const seeded = await seedPlan(plan, { env });
    const task = app.store.listTasks().find(item => item.id === seeded[packet.id]);
    assert.ok(task); assert.match(task.body, /MOUNT POINTS \(WF-G214\)/); assert.match(task.body, /AmbientWeather/);
    assert.equal(task.state, 'open'); assert.match(task.body, /not rendered integration acceptance/);
    const declared = analyzePacketOwnership({ packets: [{ ...packet, taskIds: [task.id] }] }, [task]);
    assert.equal(declared.ok, true);
  } finally {
    await app.close(); assert.equal(path.dirname(dir), fs.realpathSync(os.tmpdir())); fs.rmSync(dir, { recursive: true, force: true });
  }
});

const actorFacade = 'src/components/BattleMap/characters/CharacterActor.tsx';
const actorImplementation = 'src/components/BattleMap/characters/characterActor/CharacterActor.tsx';
const actorState = 'src/components/BattleMap/characters/useFresnelRim.ts';
// Keep the pre-existing declaration/test gates satisfied while isolating the
// new forwarding-target requirement; these fixtures still grant no edits.
const actorFacadeFiles = [actorFacade, actorFacade.replace('.tsx', '.d.ts'),
  'src/components/BattleMap/characters/__tests__/CharacterActor.*.test.tsx'];
const actorImplementationFiles = [actorImplementation, actorImplementation.replace('.tsx', '.d.ts')];

test('WF-G247: owning a facade alone fails; implementation ownership or explicit sibling handoff clears it', () => {
  const packet = { id: 'PK-actor', files: [...actorFacadeFiles] };
  const plan = { packets: [packet] };
  const before = JSON.stringify(plan);
  const report = analyzePacketOwnership(plan);
  assert.equal(report.ok, false);
  assert.match(formatPacketOwnershipReport(report), /FORWARDER PK-actor .*CharacterActor.* -> .*characterActor/);
  assert.match(report.errors.join('\n'), /implementation behind owned forwarder, WF-G247/);
  assert.equal(JSON.stringify(plan), before, 'no silent expansion of permissions');
  packet.files.push(...actorImplementationFiles);
  assert.equal(analyzePacketOwnership(plan).ok, true);
  packet.files = [...actorFacadeFiles];
  plan.packets.push({ id: 'PK-implementation', files: [...actorImplementationFiles] });
  assert.equal(analyzePacketOwnership(plan).ok, false, 'disjoint sibling alone is not a handoff');
  packet.handoffs = [{ ref: actorImplementation, toPacket: 'PK-implementation', expectedBreakage: 'Actor behavior repair lands in sibling' }];
  assert.equal(analyzePacketOwnership(plan).ok, true);
});

test('WF-G247: facade-only edits need exact valid declarations and do not waive body/state obligations', () => {
  const packet = { id: 'PK-api', handle: 'facade-only', pet: 'dream-girl', agent: 'claude',
    files: [...actorFacadeFiles], forwarderOnly: [{ file: actorFacade, reason: 'Compatibility export only' }] };
  const plan = { wave: 'facade-api', packets: [packet] };
  assert.equal(analyzePacketOwnership(plan).ok, true);
  assert.match(forwarderOnlyPromptBlock(packet), /not downstream implementation or private hook state/);
  for (const external of [true, false]) assert.match(buildPrompt(plan, { ...packet, external }, { taskId: 'agora-fixture.1' }), /FACADE-ONLY EDITS/);
  packet.taskIds = ['agora-fixture'];
  const task = { id: 'agora-fixture', body: 'Update ' + actorState, refs: [actorImplementation] };
  const report = analyzePacketOwnership(plan, [task]);
  assert.ok(report.errors.some(error => error.includes(actorState)));
  assert.ok(report.errors.some(error => error.includes(actorImplementation)));
  packet.files.push(actorState, ...actorImplementationFiles);
  assert.equal(analyzePacketOwnership(plan, [task]).ok, true);
  for (const declarations of [null, {}, [{ file: actorFacade, reason: '' }],
    [{ file: 'src/*.tsx', reason: 'too broad' }], [packet.forwarderOnly[0], packet.forwarderOnly[0]]]) {
    assert.throws(() => validateOwnershipDeclarations({ packets: [{ ...packet, forwarderOnly: declarations }] }), /forwarderOnly/);
  }
  assert.match(analyzePacketOwnership({ packets: [{ id: 'PK-stale', files: [], forwarderOnly: packet.forwarderOnly }] }).errors.join('\n'), /stale or unowned/);
  assert.match(analyzePacketOwnership({ packets: [{ id: 'PK-state', files: [actorState],
    forwarderOnly: [{ file: actorState, reason: 'Not a facade' }] }] }).errors.join('\n'), /stale or unowned/);
});

test('WF-G247: partition, seed and dispatch refuse facade-only behavior packets before writes or worker launch', async () => {
  const reads = [];
  const server = createServer((request, response) => {
    reads.push(request.method + ' ' + request.url);
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ locks: [] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-wfg247-cli-'));
  try {
    const plan = { baseUrl: 'http://127.0.0.1:' + server.address().port, wave: 'forwarder-fixture', pet: 'dream-girl',
      packets: [{ id: 'PK-actor', handle: 'facade-fixture', pet: 'dream-girl', agent: 'claude',
        scope: 'Read-only packet validation fixture', files: [actorFacade] }] };
    await assert.rejects(() => seedPlan(plan), /WF-G247/);
    assert.deepEqual(reads, ['GET /locks']);
    const planFile = path.join(fixtureDir, 'plan.json');
    fs.writeFileSync(planFile, JSON.stringify(plan));
    for (const command of ['partition', 'seed', 'dispatch']) {
      reads.length = 0;
      const result = await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ['tools/agora/orchestrate.mjs', command, planFile],
          { cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), windowsHide: true });
        let output = '';
        child.stdout.on('data', chunk => { output += chunk; });
        child.stderr.on('data', chunk => { output += chunk; });
        child.once('error', reject);
        child.once('close', code => resolve({ code, output }));
      });
      assert.equal(result.code, 1, command + ': ' + result.output);
      assert.match(result.output, /implementation behind owned forwarder, WF-G247/);
      assert.deepEqual(reads, ['GET /locks'], command + ' refuses before mutation/launch');
    }
  } finally {
    assert.ok(path.resolve(fixtureDir).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    await new Promise(resolve => server.close(resolve));
  }
});

test('WF-G258: ignored source needs an ignored same-packet test, never an unowned or tracked test', () => {
  const source = 'src/ignored/worker.ts';
  const local = '.agent/scratch/fixture/worker.test.ts';
  const tracked = 'src/ignored/__tests__/worker.test.ts';
  const sources = new Set([source]);
  const ignored = new Set([source, local]);
  const packet = { id: 'PK-local', files: [source] };
  assert.match(ignoredTestHomeErrors(packet, sources, ignored).join('\n'), /gitignored source.*localTestHomes.*WF-G258/);
  packet.localTestHomes = [{ source, test: tracked }];
  packet.files.push(tracked);
  assert.match(ignoredTestHomeErrors(packet, sources, ignored).join('\n'), /must be gitignored AND owned/);
  packet.localTestHomes = [{ source, test: local }];
  assert.equal(ignoredTestHomeErrors(packet, sources, ignored).length, 1, 'ignored but unowned is not enough');
  packet.files.push(local);
  assert.deepEqual(ignoredTestHomeErrors(packet, sources, ignored), []);
  packet.localTestHomes[0].source = 'src/not-owned.ts';
  assert.match(ignoredTestHomeErrors(packet, sources, ignored).join('\n'), /stale localTestHomes source/);
});

test('WF-G258: declared local test homes validate syntax and never grant new file ownership', () => {
  const packet = { id: 'PK-local', files: ['src/ignored/worker.ts'],
    localTestHomes: [{ source: 'src/ignored/worker.ts', test: '.agent/scratch/worker.test.ts' }] };
  const plan = { packets: [packet] };
  assert.doesNotThrow(() => validateOwnershipDeclarations(plan));
  const prompt = localTestHomePromptBlock(packet);
  assert.match(prompt, /worker\.ts -> .*worker\.test\.ts/);
  assert.match(prompt, /require your own lock.*do not prove clean-clone CI/);
  assert.deepEqual(packet.files, ['src/ignored/worker.ts']);
  for (const homes of [null, {}, [{ source: '../src/a.ts', test: '.agent/x.test.ts' }],
    [{ source: 'src/a.ts', test: '.agent/x.ts' }], [{ source: 'src/a.ts', test: '.agent/*.test.ts' }],
    [packet.localTestHomes[0], packet.localTestHomes[0]]]) {
    packet.localTestHomes = homes;
    assert.throws(() => validateOwnershipDeclarations(plan), /localTestHomes/);
  }
});

test('WF-G258: real voxel ignore rules block dispatch; explicit local test ownership clears the gate', async () => {
  const source = 'src/workers/voxelMesher.worker.ts';
  const local = 'tests/VoxelLogic.test.ts';
  const ignored = ignoredPacketPaths([source, local, 'tools/agora/orchestrate.mjs']);
  assert.ok(ignored.has(source) && ignored.has(local));
  assert.equal(ignored.has('tools/agora/orchestrate.mjs'), false);
  const packet = { id: 'PK-local', handle: 'local-test-fixture', pet: 'dream-girl', agent: 'claude',
    scope: 'Read-only ignored-module packet fixture', files: [source] };
  const plan = { wave: 'local-test-fixture', pet: 'gf-sd', packets: [packet] };
  const report = analyzePacketOwnership(plan);
  assert.equal(report.ok, false);
  assert.match(formatPacketOwnershipReport(report), /gitignored source.*voxelMesher.*WF-G258/);
  const reads = [];
  const server = createServer((request, response) => {
    reads.push(request.method + ' ' + request.url);
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ locks: [] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    plan.baseUrl = 'http://127.0.0.1:' + server.address().port;
    await assert.rejects(() => seedPlan(plan), /gitignored source.*WF-G258/);
    assert.deepEqual(reads, ['GET /locks'], 'refuse before any board writes');
    const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-wfg258-cli-'));
    try {
      const planFile = path.join(fixtureDir, 'plan.json');
      fs.writeFileSync(planFile, JSON.stringify(plan));
      for (const command of ['partition', 'seed', 'dispatch']) {
        reads.length = 0;
        const result = await new Promise((resolve, reject) => {
          const child = spawn(process.execPath, ['tools/agora/orchestrate.mjs', command, planFile],
            { cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), windowsHide: true });
          let output = '';
          child.stdout.on('data', chunk => { output += chunk; });
          child.stderr.on('data', chunk => { output += chunk; });
          child.once('error', reject);
          child.once('close', code => resolve({ code, output }));
        });
        assert.equal(result.code, 1, command + ': ' + result.output);
        assert.match(result.output, /gitignored source.*WF-G258/);
        assert.deepEqual(reads, ['GET /locks'], command + ' only observes, no board writes or worker launch');
      }
    } finally {
      assert.ok(path.resolve(fixtureDir).startsWith(path.resolve(os.tmpdir()) + path.sep));
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
    packet.localTestHomes = [{ source, test: local }];
    packet.files.push(local);
    const success = analyzePacketOwnership(plan);
    assert.equal(success.ok, true, formatPacketOwnershipReport(success));
    for (const external of [false, true]) {
      const prompt = buildPrompt(plan, { ...packet, external }, { taskId: 'agora-local.1' });
      assert.match(prompt, /LOCAL-ONLY TEST HOMES.*WF-G258/);
      assert.ok(prompt.includes(source + ' -> ' + local));
      assert.match(prompt, /lock src\/workers\/voxelMesher\.worker\.ts tests\/VoxelLogic\.test\.ts/);
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});
const leaves = [
  'src/components/DesignPreview/steps/raceDomain/leaves/chthonicTieflingRaceLeaf.tsx',
  'src/components/DesignPreview/steps/raceDomain/leaves/fallenAasimarRaceLeaf.tsx',
  'src/components/DesignPreview/steps/raceDomain/leaves/firbolgRaceLeaf.tsx',
  'src/components/DesignPreview/steps/raceDomain/leaves/copperDragonbornRaceLeaf.tsx',
];
const boardTasks = [
  { id: 'agora-ddb7', refs: [leaves[0]] },
  { id: 'agora-0ad6', refs: leaves.slice(1) },
];

test('WF-G330: observations retain complete public lock scopes, expiry and provenance without implying permission', async () => {
  const paths = Array.from({ length: 10 }, (_, i) => 'src/wfg330/held-' + i + '.ts');
  const expiresAt = Date.parse('2026-10-09T18:00:00Z');
  const lock = { id: 'full-lock', agentId: 'worker-330', paths, globs: ['docs/held/**'],
    reason: 'full ten-file lock', expiresAt, token: 'DO-NOT-COPY' };
  const report = await checkPlanOwnership({ packets: [], baseUrl: 'http://fixture' }, {
    fetchImpl: async () => ({ ok: true, json: async () => ({ locks: [lock], bearer: 'DO-NOT-COPY' }) }),
  });
  assert.equal(report.lockSnapshot.source, 'live daemon');
  assert.ok(report.lockSnapshot.observedAt >= Date.now() - 1000);
  assert.deepEqual(report.lockSnapshot.locks[0].paths, paths);
  assert.deepEqual(report.lockSnapshot.locks[0].globs, ['docs/held/**']);
  const text = formatPacketOwnershipReport(report);
  for (const file of paths) assert.ok(text.includes(file));
  assert.match(text, /worker-330.*docs\/held\/\*\*.*2026-10-09T18:00:00\.000Z/);
  assert.match(text, /Advisory snapshot only; re-read locks/);
  assert.doesNotMatch(text, /DO-NOT-COPY/);
  lock.paths.push('src/later-change.ts');
  assert.equal(report.lockSnapshot.locks[0].paths.length, 10, 'the observation is a copy, not mutable board data');
  assert.match(formatLockSnapshot(), /none supplied.*NOT evidence/);
  assert.match(formatLockSnapshot(analyzePacketOwnership({ packets: [] }, [], []).lockSnapshot), /supplied, observed unknown/);
});

test('WF-G330: a queued packet refreshes its own conflicts without rejecting a disjoint sibling lock', async () => {
  const plan = { baseUrl: 'http://fixture', packets: [] };
  const packet = { id: 'PK-next', files: ['src/wfg330/next.ts'] };
  let calls = 0;
  const fetchImpl = async () => ({ ok: true, json: async () => ({ locks: [{
    id: 'new-lock-' + ++calls, agentId: 'worker-330',
    paths: [calls === 1 ? 'src/wfg330/sibling.ts' : 'src/wfg330/next.ts'], globs: [], expiresAt: Date.now() + 60000,
  }] }) });
  const first = await checkPacketLaunchLocks(plan, packet, { fetchImpl });
  assert.equal(first.ok, true);
  assert.ok(formatLockSnapshot(first.lockSnapshot).includes('sibling.ts'));
  const second = await checkPacketLaunchLocks(plan, packet, { fetchImpl });
  assert.equal(second.ok, false);
  assert.equal(calls, 2, 'no stale observation reused at launch');
  assert.match(formatPacketOwnershipReport(second), /PK-next.*next\.ts.*new-lock-2.*worker-330/);
  await assert.rejects(() => checkPacketLaunchLocks(plan, packet, {
    fetchImpl: async () => ({ ok: true, json: async () => ({ locks: [{ id: 'broken', agentId: 'peer', paths: 'src/wfg330/next.ts' }] }) }),
  }), /malformed lock scope.*cannot prove/);
});

test('WF-G330: CLI prompt carries all lock paths; late launch conflict refuses prompt output and board writes', async () => {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-wfg330-cli-'));
  const requests = [];
  let conflictOnSecondRead = false;
  const paths = Array.from({ length: 10 }, (_, i) => 'src/wfg330/peer-' + i + '.ts');
  const server = createServer((request, response) => {
    requests.push(request.method + ' ' + request.url);
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ locks: [{ id: 'full-peer-lock', agentId: 'peer-330',
      paths: conflictOnSecondRead && requests.length > 1 ? [...paths, 'src/wfg330/owned.ts'] : paths,
      globs: ['docs/wfg330/**'], expiresAt: Date.parse('2026-10-09T18:00:00Z'), reason: 'full scope' }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const handle = 'wfg330-' + path.basename(fixtureDir);
    const plan = { wave: handle, pet: 'gf-sd', baseUrl: 'http://127.0.0.1:' + server.address().port,
      packets: [{ id: 'PK-next', handle, pet: 'dream-girl', agent: 'claude',
        scope: 'Live lock observation fixture only', files: ['src/wfg330/owned.ts'] }] };
    const planFile = path.join(fixtureDir, 'plan.json');
    fs.writeFileSync(planFile, JSON.stringify(plan));
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
    const run = command => new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['tools/agora/orchestrate.mjs', command, planFile, 'PK-next'], { cwd: repoRoot });
      let output = '';
      child.stdout.on('data', chunk => { output += chunk; });
      child.stderr.on('data', chunk => { output += chunk; });
      child.once('error', reject);
      child.once('close', code => resolve({ code, output }));
    });
    const prompt = await run('prompt');
    assert.equal(prompt.code, 0, prompt.output);
    for (const file of paths) assert.ok(prompt.output.includes(file));
    assert.match(prompt.output, /live daemon, observed.*\d{4}-\d{2}-\d{2}T/);
    assert.match(prompt.output, /peer-330.*2026-10-09T18:00:00\.000Z/);
    assert.deepEqual(requests, ['GET /locks']);
    requests.length = 0;
    conflictOnSecondRead = true;
    const dispatch = await run('dispatch');
    assert.equal(dispatch.code, 1, dispatch.output);
    assert.match(dispatch.output, /PK-next.*owned\.ts.*full-peer-lock.*peer-330/);
    assert.deepEqual(requests, ['GET /locks', 'GET /locks'], 'refresh just before launch, no board mutation');
    assert.equal(fs.existsSync(path.join(repoRoot, '.agent/scratch/orchestrate', handle + '.prompt.txt')), false);
    assert.doesNotMatch(dispatch.output, /dispatched|Dispatch it via the Agent tool/);
  } finally {
    await new Promise(resolve => server.close(resolve));
    const target = path.resolve(fixtureDir);
    assert.ok(target.startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(target, { recursive: true, force: true });
  }
});

function historicalPlan() {
  return {
    packets: [
      { id: 'PK-02', files: [bridge], issues: ['agora-ddb7', 'agora-0ad6'] },
    ],
  };
}

test('WF-G263: tracked source declarations belong to the same packet, without auto-expansion or a sibling handoff', () => {
  const source = 'src/assets/icons/BeltIcon.tsx';
  const twin = 'src/assets/icons/BeltIcon.d.ts';
  assert.ok(fs.existsSync(source) && fs.existsSync(twin));
  assert.equal(execFileSync('git', ['-c', 'core.fsmonitor=false', 'ls-files', '--', twin], { encoding: 'utf8' }).trim(), twin);
  const plan = { packets: [{ id: 'PK-twin', files: [source] }] };
  const report = analyzePacketOwnership(plan);
  assert.equal(report.ok, false);
  assert.match(formatPacketOwnershipReport(report), /tracked declaration twin.*BeltIcon\.d\.ts.*same packet.*WF-G263/);
  assert.deepEqual(plan.packets[0].files, [source]);
  plan.packets.push({ id: 'PK-declaration', files: [twin] });
  plan.packets[0].handoffs = [{ ref: twin, toPacket: 'PK-declaration', expectedBreakage: 'Update the declaration' }];
  assert.equal(analyzePacketOwnership(plan).ok, false, 'a handoff is not a same-packet source contract');
  plan.packets.splice(1);
  delete plan.packets[0].handoffs;
  plan.packets[0].files.push(twin);
  assert.equal(analyzePacketOwnership(plan).ok, true);
  const globbed = { packets: [{ id: 'PK-glob', files: ['src/assets/icons/BeltIcon.*'] }] };
  assert.equal(analyzePacketOwnership(globbed).ok, true, 'one owned glob can cover source and twin');
  assert.equal(analyzePacketOwnership({ packets: [{ id: 'PK-new', files: ['src/wfg-untracked-source.tsx'] }] }).ok, true,
    'do not invent an untracked or absent declaration obligation');
});

test('WF-G263: direct seed refuses the missing declaration before writes; widened prompt locks both files', async () => {
  const reads = [];
  const server = createServer((request, response) => {
    reads.push(request.method + ' ' + request.url);
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ locks: [] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const plan = { wave: 'declaration-twin-fixture', pet: 'gf-sd',
      baseUrl: 'http://127.0.0.1:' + server.address().port,
      packets: [{ id: 'PK-twin', handle: 'declaration-worker', pet: 'dream-girl', agent: 'claude',
        scope: 'Declaration ownership fixture only', files: ['src/assets/icons/BeltIcon.tsx'] }] };
    await assert.rejects(() => seedPlan(plan), /tracked declaration twin.*WF-G263/);
    assert.deepEqual(reads, ['GET /locks'], 'only live ownership observation, no board mutation');
    plan.packets[0].files.push('src/assets/icons/BeltIcon.d.ts');
    const prompt = buildPrompt(plan, plan.packets[0], { taskId: 'agora-declaration-fixture.1' });
    assert.match(prompt, /lock src\/assets\/icons\/BeltIcon\.tsx src\/assets\/icons\/BeltIcon\.d\.ts/);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('WF-G263: partition, seed and dispatch CLI refuse missing twins before board writes or worker launch', async () => {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-wfg263-cli-'));
  const app = createAgoraServer({ dir: path.join(fixtureDir, 'server'), seatRosterPath: null });
  try {
    await new Promise(resolve => app.listen(0, resolve));
    const plan = { wave: 'wfg263-cli', pet: 'gf-sd',
      baseUrl: 'http://127.0.0.1:' + app.server.address().port,
      packets: [{ id: 'PK-twin', handle: 'wfg263-worker', pet: 'dream-girl', agent: 'claude',
        scope: 'Tracked declaration ownership fixture', files: ['src/assets/icons/BeltIcon.tsx'] }] };
    const planFile = path.join(fixtureDir, 'plan.json');
    fs.writeFileSync(planFile, JSON.stringify(plan));
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
    for (const command of ['partition', 'seed', 'dispatch']) {
      const result = await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ['tools/agora/orchestrate.mjs', command, planFile], { cwd: repoRoot });
        let output = '';
        child.stdout.on('data', chunk => { output += chunk; });
        child.stderr.on('data', chunk => { output += chunk; });
        child.once('error', reject);
        child.once('close', code => resolve({ code, output }));
      });
      assert.equal(result.code, 1, command + ': ' + result.output);
      assert.match(result.output, /tracked declaration twin.*BeltIcon\.d\.ts.*WF-G263/);
      assert.deepEqual(app.store.listTasks(), [], command + ' must not create tasks');
      assert.deepEqual(app.store.listCampaigns(), [], command + ' must not claim a campaign');
      assert.deepEqual(app.store.listAgents(), [], command + ' must not register an agent');
      assert.deepEqual(app.store.listLocks(), [], command + ' must not acquire edit access');
    }
  } finally {
    await app.close();
    const target = path.resolve(fixtureDir);
    assert.ok(target.startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test('WF307: changed explicit block reviews fail claimed-task preflight', async () => {
  const { captureSourceReview } = await import('./taskLint.mjs');
  const first = captureSourceReview({ id: 'fixture-block', file: 'tools/agora/taskLint.mjs', start: 'export function inspectSymbolChecks(', end: '/** Resolve literal evidence against current bytes;', symbols: ['inspectSymbolChecks'], reason: 'Read-only current helper review.' });
  const task = { id: 'agora-review', title: 'Review block', body: 'SOURCE-REVIEW: ' + JSON.stringify({ ...first, sha256: '0'.repeat(64) }) };
  const plan = { packets: [{ id: 'PK-review', files: ['docs/owned.md'], taskIds: [task.id] }] };
  assert.match(formatPacketOwnershipReport(analyzePacketOwnership(plan, [task])), /WF-G307/);
  task.body = 'SOURCE-REVIEW: ' + JSON.stringify(first); assert.equal(analyzePacketOwnership(plan, [task]).ok, true);
});

test('WF272: stale claimed-task symbol premises block preflight without granting checked files', () => {
  const declaration = { file: 'tools/agora/taskLint.mjs', symbol: 'NonexistentWf272CallSite', expect: 'present' };
  const task = { id: 'agora-symbol', title: 'Review exact premise', body: 'SYMBOL-CHECK: ' + JSON.stringify(declaration) };
  const plan = { packets: [{ id: 'PK-symbol', files: ['docs/owned.md'], taskIds: [task.id] }] };
  const report = analyzePacketOwnership(plan, [task]); assert.equal(report.ok, false);
  assert.match(formatPacketOwnershipReport(report), /WF-G272.*|symbol premise/);
  declaration.expect = 'absent'; task.body = 'SYMBOL-CHECK: ' + JSON.stringify(declaration);
  assert.equal(analyzePacketOwnership(plan, [task]).ok, true, 'a verified read premise grants no implicit edit target');
});

test('WF325: claimed task acceptance contradictions fail the same ownership preflight', () => {
  const plan = { packets: [{ id: 'PK-dedup', files: ['src/shared.ts'], taskIds: ['agora-dedup'] }] };
  const task = { id: 'agora-dedup', title: 'One status-icon function, not two', body: 'ACCEPTANCE: grep legacy-switch src/ returns ONE hit' };
  const report = analyzePacketOwnership(plan, [task]); assert.equal(report.ok, false);
  assert.match(formatPacketOwnershipReport(report), /WF-G325/);
  task.body = 'DEDUP-ACCEPTANCE: ' + JSON.stringify({ canonical: 'shared definition', canonicalCount: 1, obsolete: 'legacy switch', obsoleteCount: 0,
    consumers: ['first view', 'second view'], verification: 'Both delegate to shared definition and fallback remains correct.' });
  assert.equal(analyzePacketOwnership(plan, [task]).ok, true);
});

// WF256 title obligations do not enlarge a worker packet, even when the title
// looks like a short human summary rather than the detailed body instructions.
test('WF256: two literal title targets reject a half packet and require a real sibling handoff', () => {
  const task = { id: 'agora-title', title: 'Repair src/title-one.ts and src/title-two.ts', body: '', refs: [] };
  const packet = { id: 'PK-title', files: ['src/title-one.ts'], taskIds: [task.id] };
  const plan = { packets: [packet] };
  const failed = analyzePacketOwnership(plan, [task]);
  assert.equal(failed.ok, false); assert.match(formatPacketOwnershipReport(failed), /title-two\.ts.*task title/);
  assert.deepEqual(packet.files, ['src/title-one.ts']);
  packet.files.push('src/title-two.ts'); assert.equal(analyzePacketOwnership(plan, [task]).ok, true);
  packet.files.pop(); plan.packets.push({ id: 'PK-detail', files: ['src/title-two.ts'] });
  assert.equal(analyzePacketOwnership(plan, [task]).ok, false);
  packet.handoffs = [{ taskId: task.id, ref: 'src/title-two.ts', toPacket: 'PK-detail', expectedBreakage: 'Detail owner must land the second title obligation.' }];
  assert.equal(analyzePacketOwnership(plan, [task]).ok, true);
  packet.handoffs[0].toPacket = 'PK-wrong';
  assert.throws(() => analyzePacketOwnership(plan, [task]), /handoff/);
  delete packet.handoffs; task.title = 'Repair Detail.tsx';
  assert.match(formatPacketOwnershipReport(analyzePacketOwnership(plan, [task])), /Detail\.tsx.*qualify|qualify.*Detail\.tsx/);
});

test('WF256: conceptual surfaces use current quote evidence and still require all mapped owners', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-title-target-'));
  try {
    fs.writeFileSync(path.join(root, 'skills.ts'), 'export const Skills = () => sharedBonus();\n');
    fs.writeFileSync(path.join(root, 'detail.ts'), 'export const Detail = () => sharedBonus();\n');
    // Absolute root tokens are normalized by the existing task path checker;
    // citation files remain repository-relative, under ignored disposable proof.
    const sourceRoot = fs.mkdtempSync(path.resolve(hereRoot(), '.agent/scratch/wfg256/concept-test-'));
    const relative = path.relative(hereRoot(), sourceRoot).replace(/\\/g, '/');
    try {
      fs.copyFileSync(path.join(root, 'skills.ts'), path.join(sourceRoot, 'skills.ts'));
      fs.copyFileSync(path.join(root, 'detail.ts'), path.join(sourceRoot, 'detail.ts'));
      const skills = relative + '/skills.ts', detail = relative + '/detail.ts';
      const task = { id: 'agora-concept', title: 'Implement CharacterSheet Skills tab and detail display',
        body: [{ label: 'Skills tab', file: skills, quote: 'export const Skills = () => sharedBonus();' },
          { label: 'detail display', file: detail, quote: 'export const Detail = () => sharedBonus();' }]
          .map(item => 'TITLE-TARGET: ' + JSON.stringify(item)).join('\n') };
      const packet = { id: 'PK-concept', files: [skills], taskIds: [task.id] }, plan = { packets: [packet] };
      const missing = analyzePacketOwnership(plan, [task]); assert.equal(missing.ok, false);
      assert.match(formatPacketOwnershipReport(missing), /detail\.ts.*title target/);
      packet.files.push(detail); const covered = analyzePacketOwnership(plan, [task]); assert.equal(covered.ok, true, covered.errors.join('\n'));
      assert.equal(covered.titleTargets.length, 2); assert.match(formatPacketOwnershipReport(covered), /Skills tab.*skills\.ts/);
      fs.writeFileSync(path.join(sourceRoot, 'detail.ts'), 'export const Detail = () => stale();\n');
      assert.match(formatPacketOwnershipReport(analyzePacketOwnership(plan, [task])), /quoted source is missing/);
    } finally { assert.ok(sourceRoot.startsWith(path.resolve(hereRoot(), '.agent/scratch/wfg256') + path.sep)); fs.rmSync(sourceRoot, { recursive: true, force: true }); }
  } finally { assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir())); fs.rmSync(root, { recursive: true, force: true }); }
});

function hereRoot() { return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'); }

test('WF256: actual partition, seed and dispatch reject title-only omissions with GET requests only', async () => {
  const requests = [], server = createServer((request, response) => {
    requests.push(request.method + ' ' + request.url); response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(request.url === '/locks' ? { locks: [] } : { tasks: [
      { id: 'agora-title', title: 'Repair src/title-one.ts and src/title-two.ts', refs: [], body: '' },
    ] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-title-cli-'));
  try {
    const plan = { wave: 'title-fixture', pet: 'gf-sd', baseUrl: 'http://127.0.0.1:' + server.address().port,
      packets: [{ id: 'PK-title', handle: 'title-fixture', agent: 'claude', pet: 'dream-girl', scope: 'Title fixture', files: ['src/title-one.ts'], taskIds: ['agora-title'] }] };
    const file = path.join(root, 'plan.json'); fs.writeFileSync(file, JSON.stringify(plan));
    for (const command of ['partition', 'seed', 'dispatch']) {
      requests.length = 0;
      const result = await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ['tools/agora/orchestrate.mjs', command, file], { cwd: hereRoot(), windowsHide: true });
        let output = ''; child.stdout.on('data', bytes => { output += bytes; }); child.stderr.on('data', bytes => { output += bytes; });
        child.once('error', reject); child.once('close', code => resolve({ code, output }));
      });
      assert.equal(result.code, 1, result.output); assert.match(result.output, /title-two\.ts.*task title/);
      assert.deepEqual(requests, ['GET /tasks', 'GET /locks']);
    }
  } finally { await new Promise(resolve => server.close(resolve)); assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir())); fs.rmSync(root, { recursive: true, force: true }); }
});

test('WF-G265/WF-G280: body-only obligations require ownership or an explicit sibling handoff', () => {
  const plan = { packets: [
    { id: 'PK-one', files: ['src/wfg-owner.ts'], taskIds: ['agora-body'] },
    { id: 'PK-two', files: ['src/wfg-sibling.ts'] },
  ] };
  const tasks = [{ id: 'agora-body', refs: ['src/wfg-owner.ts'],
    body: 'DO: update src/wfg-sibling.ts:1108.\nREFERENCE-ONLY: docs/evidence.md\nEXPECTED-ABSENT: src/deleted.ts' }];
  const failure = analyzePacketOwnership(plan, tasks);
  assert.equal(failure.ok, false);
  assert.match(formatPacketOwnershipReport(failure), /PK-one task agora-body.*wfg-sibling\.ts.*task body/);
  assert.deepEqual(plan.packets[0].files, ['src/wfg-owner.ts'], 'preflight does not grant extra paths');
  plan.packets[0].handoffs = [{ ref: 'src/wfg-sibling.ts', toPacket: 'PK-two',
    taskId: 'agora-body', expectedBreakage: 'Sibling owner must land the dependent change before acceptance.' }];
  const covered = analyzePacketOwnership(plan, tasks);
  assert.equal(covered.ok, true, formatPacketOwnershipReport(covered));
  assert.equal(covered.checkedRefs, 2);
});

test('body creates and deletes still need edit ownership even when declared absent', () => {
  const plan = { packets: [{ id: 'PK-body', files: ['src/wfg-owned.ts'], taskIds: ['agora-body'] }] };
  const tasks = [{ id: 'agora-body', body: 'ABSENT: src/wfg-new.ts\nCREATES: src/wfg-new.ts\nDELETES: src/wfg-old.ts' }];
  const report = analyzePacketOwnership(plan, tasks);
  assert.equal(report.ok, false);
  assert.match(formatPacketOwnershipReport(report), /wfg-new\.ts/);
  assert.match(formatPacketOwnershipReport(report), /wfg-old\.ts/);
});

test('body mismatch blocks partition, seed and dispatch before any board mutation', async () => {
  const requests = [];
  const server = createServer((request, response) => {
    requests.push(request.method + ' ' + request.url);
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(request.url === '/locks' ? { locks: [] } : { tasks: [
      { id: 'agora-body', refs: ['src/wfg-owned.ts'], body: 'DO: edit src/wfg-sibling.ts:1108' },
    ] }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-body-ownership-'));
  try {
    const plan = { wave: 'body-ownership-fixture', pet: 'gf-sd',
      baseUrl: 'http://127.0.0.1:' + server.address().port,
      packets: [{ id: 'PK-body', handle: 'wfg-body-worker', agent: 'claude', pet: 'dream-girl',
        scope: 'Body ownership fixture', files: ['src/wfg-owned.ts'], taskIds: ['agora-body'] }] };
    const planFile = path.join(fixtureDir, 'plan.json');
    fs.writeFileSync(planFile, JSON.stringify(plan));
    for (const command of ['partition', 'seed', 'dispatch']) {
      requests.length = 0;
      const result = await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ['tools/agora/orchestrate.mjs', command, planFile],
          { cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..') });
        let output = '';
        child.stdout.on('data', (chunk) => { output += chunk; });
        child.stderr.on('data', (chunk) => { output += chunk; });
        child.once('error', reject);
        child.once('close', (code) => resolve({ code, output }));
      });
      assert.equal(result.code, 1, command + ': ' + result.output);
      assert.match(result.output, /wfg-sibling\.ts.*task body/);
      assert.deepEqual(requests, ['GET /tasks', 'GET /locks'], 'read-only refusal for ' + command);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    const target = path.resolve(fixtureDir);
    assert.ok(target.startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test('WF-G209: a source packet must also own its existing sibling regression test', () => {
  const source = 'src/services/EntityResolverService.ts';
  const siblingTest = 'src/services/__tests__/EntityResolverService.test.ts';
  const generationTest = 'src/services/__tests__/EntityResolverServiceGeneration.test.ts';
  assert.ok(fs.existsSync(source));
  assert.ok(fs.existsSync(siblingTest));
  assert.ok(fs.existsSync(generationTest));
  const plan = { packets: [{ id: 'PK-10', files: [source], unionReviews:unchangedFixtureUnions([source]) }] };
  const missing = analyzePacketOwnership(plan);
  assert.equal(missing.ok, false);
  assert.match(formatPacketOwnershipReport(missing), /PK-10.*EntityResolverService\.ts.*EntityResolverService\.test\.ts.*same packet/);
  assert.match(formatPacketOwnershipReport(missing), /EntityResolverServiceGeneration\.test\.ts.*same packet/);

  plan.packets[0].files.push(siblingTest);
  assert.equal(analyzePacketOwnership(plan).ok, false, 'generation coverage is still unowned');
  plan.packets[0].files.push(generationTest);
  assert.equal(analyzePacketOwnership(plan).ok, true);
  plan.packets[0].files.splice(1);
  plan.packets.push({ id: 'PK-tests', files: [siblingTest] });
  assert.match(formatPacketOwnershipReport(analyzePacketOwnership(plan)), /same packet/);
});

test('WF-G209: named sibling tests also count as existing regression coverage', () => {
  const plan = { packets: [{ id: 'PK-combat', files: [bridge] }] };
  const report = analyzePacketOwnership(plan);
  assert.equal(report.ok, false);
  assert.match(formatPacketOwnershipReport(report), /combatUtils\.devPlaytest\.test\.ts/);
  assert.match(formatPacketOwnershipReport(report), /combatUtils\.subclassAndTerrain\.test\.ts/);
});

test('WF-G225 reproduces the live PK-02 mismatch from its claimed task refs', () => {
  const report = analyzePacketOwnership(historicalPlan(), boardTasks);
  assert.deepEqual(packetTaskIds(historicalPlan().packets[0]), ['agora-ddb7', 'agora-0ad6']);
  assert.equal(report.ok, false);
  assert.equal(report.checkedTasks, 2);
  assert.equal(report.errors.filter((message) => message.includes('outside its owned files:')).length, 4);
  for (const file of leaves) assert.ok(formatPacketOwnershipReport(report).includes(file));
  assert.match(formatPacketOwnershipReport(report), /no sibling packet owns it/);
});

test('a sibling may own the refs only with an explicit breakage handoff in the prompt', () => {
  const plan = historicalPlan();
  plan.packets[0].files.push('src/utils/combat/__tests__/combatUtils*.test.ts');
  plan.packets.push({ id: 'PK-leaves', files: [
    ...leaves,
    ...leaves.map((file) => file.replace('/leaves/', '/leaves/__tests__/').replace(/\.tsx$/, '.test.tsx')),
  ] });
  plan.packets[1].unionReviews = unchangedFixtureUnions(plan.packets[1].files);
  const withoutHandoff = analyzePacketOwnership(plan, boardTasks);
  assert.equal(withoutHandoff.ok, false);
  assert.match(formatPacketOwnershipReport(withoutHandoff), /owned by PK-leaves; add an explicit handoff/);

  plan.packets[0].handoffs = leaves.map((ref) => ({
    ref,
    toPacket: 'PK-leaves',
    expectedBreakage: 'Leaf tests remain red until PK-leaves removes duplicate defenses.',
  }));
  const withHandoff = analyzePacketOwnership(plan, boardTasks);
  assert.equal(withHandoff.ok, true, formatPacketOwnershipReport(withHandoff));
  assert.equal(withHandoff.findings.filter((item) => item.status === 'delegated').length, 4);
  assert.match(handoffPromptBlock(plan.packets[0]), /sibling packet PK-leaves/);
  assert.match(handoffPromptBlock(plan.packets[0]), /Leaf tests remain red/);
});

test('a direct packet file ref outside ownership is checked without a live task lookup', async () => {
  const plan = { packets: [{ id: 'PK-1', files: [bridge], refs: [leaves[0]] }] };
  const report = await checkPlanOwnership(plan, {
    boardLocks: [],
    fetchImpl: () => { throw new Error('should not fetch tasks'); },
  });
  assert.equal(report.ok, false);
  assert.equal(report.checkedTasks, 0);
  assert.ok(report.errors.some((message) => /packet refs names/.test(message)));
});

test('WF-G317: a new packet cannot claim a file already locked by an earlier wave', () => {
  const scene = 'src/components/BattleMap/BattleMap3DGpuScene.tsx';
  const nodes = 'src/systems/entities3d/three/gpu/toonNodes.ts';
  const plan = {
    packets: [{ id: 'W14-B', files: [scene, nodes] }],
  };
  const locks = [
    { id: 'deb614de', agentId: 'w13-gpu-nameplates', reason: 'W13-C', paths: [scene], globs: [] },
    { id: 'glob-lock', agentId: 'w13-gpu-nameplates', reason: 'W13-C', paths: [], globs: ['src/systems/entities3d/three/gpu/*.ts'] },
  ];
  const report = analyzePacketOwnership(plan, [], locks);
  assert.equal(report.ok, false);
  assert.equal(report.errors.filter((message) => message.includes('active Agora lock')).length, 2);
  assert.match(formatPacketOwnershipReport(report), /W14-B.*BattleMap3DGpuScene\.tsx.*deb614de.*w13-gpu-nameplates/);
  assert.match(formatPacketOwnershipReport(report), /W14-B.*toonNodes\.ts.*glob-lock/);
});

test('WF-G317: sibling packet globs and exact files are overlapping ownership', () => {
  const scene = 'src/components/BattleMap/BattleMap3DGpuScene.tsx';
  const plan = {
    packets: [
      { id: 'W13-C', files: ['src/components/BattleMap/*.tsx'], unionReviews:unchangedFixtureUnions(['src/components/BattleMap/*.tsx']) },
      { id: 'W14-B', files: [scene] },
    ],
  };
  const report = analyzePacketOwnership(plan);
  assert.equal(report.ok, false);
  assert.match(formatPacketOwnershipReport(report), /W13-C.*W14-B/);
});

test('a packet glob satisfies its own task file reference', () => {
  const scene = 'src/components/BattleMap/BattleMap3DGpuScene.tsx';
  const plan = { packets: [{ id: 'W14-B', files: [
    'src/components/BattleMap/*.tsx',
    'src/components/BattleMap/*.d.ts',
    'src/components/BattleMap/__tests__/*.test.*',
  ], unionReviews:unchangedFixtureUnions(['src/components/BattleMap/*.tsx']), taskIds: ['agora-317a'], forwarderOnly: [{ file: 'src/components/BattleMap/CombatLog.tsx',
    reason: 'Glob ownership fixture only; no CombatLog behavior edits' }] }] };
  const report = analyzePacketOwnership(plan, [{ id: 'agora-317a', refs: [scene] }]);
  assert.equal(report.ok, true, formatPacketOwnershipReport(report));
});

test('WF-G317: partition reads live locks even when the plan claims no existing tasks', async () => {
  const calls = [];
  const plan = { baseUrl: 'http://localhost:4319', packets: [{ id: 'W14-B', files: [bridge] }] };
  const report = await checkPlanOwnership(plan, {
    fetchImpl: async (url) => {
      calls.push(url);
      return { ok: true, json: async () => ({ locks: [{ id: 'lock-1', agentId: 'other', paths: [bridge], globs: [] }] }) };
    },
  });
  assert.deepEqual(calls, ['http://localhost:4319/locks']);
  assert.equal(report.ok, false);
  assert.match(formatPacketOwnershipReport(report), /W14-B.*lock-1/);
});

test('WF-G317: an unavailable or malformed lock list blocks dispatch', async () => {
  const plan = { baseUrl: 'http://localhost:4319', packets: [{ id: 'W14-B', files: [bridge] }] };
  await assert.rejects(
    () => checkPlanOwnership(plan, { fetchImpl: async () => { throw new Error('offline'); } }),
    /could not reach live Agora locks: offline/,
  );
  await assert.rejects(
    () => checkPlanOwnership(plan, { fetchImpl: async () => ({ ok: true, json: async () => ({}) }) }),
    /no locks array/,
  );
});

test('missing or multiply claimed live tasks fail rather than silently narrowing coverage', () => {
  const plan = historicalPlan();
  assert.ok(analyzePacketOwnership(plan, []).errors.some((message) => /absent from the live board/.test(message)));
  plan.packets.push({ id: 'PK-other', files: ['src/other.ts'], taskIds: ['agora-ddb7'] });
  assert.match(formatPacketOwnershipReport(analyzePacketOwnership(plan, boardTasks)), /claimed by both PK-02 and PK-other/);
});

test('handoffs must name a real sibling owner and cannot be stale', () => {
  const plan = historicalPlan();
  plan.packets.push({ id: 'PK-owner', files: [leaves[0]], unionReviews:unchangedFixtureUnions([leaves[0]]) });
  plan.packets.push({ id: 'PK-other', files: ['src/other.ts'] });
  plan.packets[0].handoffs = [{
    ref: leaves[0], toPacket: 'PK-other', expectedBreakage: 'the leaf test remains red',
  }];
  const report = analyzePacketOwnership(plan, boardTasks);
  assert.equal(report.ok, false);
  assert.match(formatPacketOwnershipReport(report), /handoff names PK-other/);
  assert.match(formatPacketOwnershipReport(report), /unused or stale handoff/);

  plan.packets[0].handoffs[0].toPacket = 'PK-not-in-plan';
  assert.throws(() => validateOwnershipDeclarations(plan), /each handoff needs/);
});

test('the read-only check rejects malformed board data and accepts supplied task evidence', async () => {
  const plan = historicalPlan();
  await assert.rejects(
    () => checkPlanOwnership(plan, { fetchImpl: async () => ({ ok: true, json: async () => ({}) }) }),
    /no tasks array/,
  );
  const report = await checkPlanOwnership(plan, { boardTasks });
  assert.equal(report.checkedTasks, 2);
  assert.equal(report.ok, false);
});

test('partition CLI reports the mismatch and makes no board writes', async () => {
  const requests = [];
  const server = createServer((request, response) => {
    requests.push(request.method + ' ' + request.url);
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(request.url === '/locks' ? { locks: [] } : { tasks: boardTasks }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-wfg225-cli-'));
  try {
    const plan = {
      ...historicalPlan(),
      wave: 'wfg225-cli-fixture',
      pet: 'gf-sd',
      baseUrl: 'http://127.0.0.1:' + server.address().port,
    };
    plan.packets[0] = {
      ...plan.packets[0],
      handle: 'wfg225-worker',
      pet: 'dream-girl',
      agent: 'claude',
      scope: 'bridge packet',
    };
    const planFile = path.join(fixtureDir, 'plan.json');
    fs.writeFileSync(planFile, JSON.stringify(plan));
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
    const result = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['tools/agora/orchestrate.mjs', 'partition', planFile], {
        cwd: repoRoot,
      });
      let output = '';
      child.stdout.on('data', (chunk) => { output += chunk; });
      child.stderr.on('data', (chunk) => { output += chunk; });
      child.once('error', reject);
      child.once('close', (code) => resolve({ code, output }));
    });
    assert.equal(result.code, 1);
    assert.match(result.output, /Partition ownership: 2 claimed task\(s\), 4 file ref\(s\), \d+ error\(s\)/);
    assert.match(result.output, /PK-02 task agora-ddb7 names/);
    assert.deepEqual(requests, ['GET /tasks', 'GET /locks']);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test('WF-G209: partition and seed block a source-only packet; a widened prompt owns and locks the test', async () => {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-wfg209-live-'));
  const app = createAgoraServer({ dir: path.join(fixtureDir, 'server') });
  try {
    await new Promise((resolve) => app.listen(0, resolve));
    const source = 'src/services/EntityResolverService.ts';
    const siblingTest = 'src/services/__tests__/EntityResolverService.test.ts';
    const generationTest = 'src/services/__tests__/EntityResolverServiceGeneration.test.ts';
    const plan = {
      wave: 'wfg209-live', pet: 'gf-sd',
      baseUrl: 'http://127.0.0.1:' + app.server.address().port,
      packets: [{ id: 'PK-10', handle: 'wfg209-worker', pet: 'dream-girl', agent: 'claude',
        scope: 'Entity resolver repair', files: [source], unionReviews:unchangedFixtureUnions([source]) }],
    };
    const planFile = path.join(fixtureDir, 'plan.json');
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
    const runCommand = (command, packetId) => new Promise((resolve, reject) => {
      const child = spawn(process.execPath,
        ['tools/agora/orchestrate.mjs', command, planFile, ...(packetId ? [packetId] : [])],
        { cwd: repoRoot });
      let output = '';
      child.stdout.on('data', (chunk) => { output += chunk; });
      child.stderr.on('data', (chunk) => { output += chunk; });
      child.once('error', reject);
      child.once('close', (code) => resolve({ code, output }));
    });
    fs.writeFileSync(planFile, JSON.stringify(plan));
    for (const command of ['partition', 'seed', 'dispatch']) {
      const result = await runCommand(command);
      assert.equal(result.code, 1, command + ': ' + result.output);
      assert.match(result.output, /EntityResolverService\.test\.ts.*same packet/);
      assert.deepEqual(app.store.listTasks(), [], command + ' must not create tasks');
      assert.deepEqual(app.store.listCampaigns(), [], command + ' must not claim a campaign');
      assert.deepEqual(app.store.listAgents(), [], command + ' must not register an agent');
    }

    plan.packets[0].files.push(siblingTest);
    plan.packets[0].files.push(generationTest);
    fs.writeFileSync(planFile, JSON.stringify(plan));
    const partition = await runCommand('partition');
    assert.equal(partition.code, 0, partition.output);
    const prompt = await runCommand('prompt', 'PK-10');
    assert.equal(prompt.code, 0, prompt.output);
    assert.ok(prompt.output.includes('Owned files (edit ONLY these): `' + source + '`, `' + siblingTest + '`, `' + generationTest + '`'));
    assert.ok(prompt.output.includes('lock ' + source + ' ' + siblingTest + ' ' + generationTest));
    // Prove live seed + lock acquisition on the widened PK-10 packet (WF-G209).
    const env = { ...process.env, AGORA_DIR: path.join(fixtureDir, 'identity'), AGORA_AGENT_ID: 'wfg209-orch', CODEX_THREAD_ID: '019f33f1-a4f0-76d0-b679-8e2928e640b7' };
    const seeded = await seedPlan(plan, { env });
    assert.ok(seeded['PK-10']);
    const worker = app.store.registerAgent({ handle: 'wfg209-worker', petSlug: 'dream-girl' });
    const lockRes = app.store.acquireLock({ agentId: worker.id, paths: plan.packets[0].files, reason: 'PK-10' });
    assert.equal(lockRes.ok, true);
    assert.deepEqual(lockRes.lock.paths, [source, siblingTest, generationTest]);
  } finally {
    await app.close();
    const target = path.resolve(fixtureDir);
    assert.ok(target.startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test('WF-G262: a state-slice / save-state reducer packet requires src/types/state.ts unless owned or handed off', () => {
  const reducer = 'src/state/reducers/townReducer.ts';
  const task = {
    id: 'agora-049c',
    title: 'Wire intrigue state slice and save-state in townReducer',
    body: 'Add reducer action + save-state wiring for rumor mill in src/state/reducers/townReducer.ts.',
    refs: [reducer],
  };
  const missingType = {
    packets: [{
      id: 'PK-30',
      scope: 'reducer action + save-state wiring in src/state/reducers/townReducer.ts',
      // The reducer and every current companion test (WF-G209 needs them together);
      // a fixed test list failed when townReducer.doors and .buildingSources tests arrived.
      files: sharedContractFiles(reducer),
      actionWiringReview: {
        reason: 'Fixture tests state-slice type ownership rather than a new action route.',
        sources: [{ file: reducer, quote: fs.readFileSync(reducer, 'utf8').slice(0, 120) }],
      },
      unionReviews: unchangedFixtureUnions([reducer]),
      taskIds: [task.id],
    }],
  };
  const failed = analyzePacketOwnership(missingType, [task]);
  assert.equal(failed.ok, false);
  assert.ok(failed.errors.some((e) => e.includes('src/types/state.ts') && e.includes('WF-G262')), failed.errors.join('\n'));

  const widened = structuredClone(missingType);
  widened.packets[0].files.push('src/types/state.ts');
  widened.packets[0].unionReviews = unchangedFixtureUnions([reducer, 'src/types/state.ts']);
  const passed = analyzePacketOwnership(widened, [task]);
  assert.equal(passed.ok, true, formatPacketOwnershipReport(passed));
});

test('WF-G261: a wave-sequenced packet behind hot files requires those hot files in its owned list or an explicit handoff', () => {
  const hunter = 'src/utils/combat/hunterUtils.ts';
  const task = {
    id: 'agora-af5b',
    title: 'Hunter prey riders',
    body: 'Implement Hunter prey choice helpers in src/utils/combat/hunterUtils.ts.',
    refs: [hunter],
  };
  const blockedPlan = {
    packets: [{
      id: 'PK-33',
      scope: 'Subclass riders',
      partitionNote: 'One wave-3 packet behind every packet that owns those hot files',
      hotFiles: ['src/utils/combat/combatUtils.ts', 'src/hooks/combat/useActionExecutor.ts', 'src/utils/combat/physicsUtils.ts'],
      files: [
        hunter,
        'src/utils/combat/__tests__/hunterUtils.test.ts',
        'src/utils/combat/__tests__/hunterUtils.turnLedger.test.ts',
      ],
      unionReviews: unchangedFixtureUnions([hunter]),
      taskIds: [task.id],
    }],
  };
  const failed = analyzePacketOwnership(blockedPlan, [task]);
  assert.equal(failed.ok, false);
  for (const hot of ['src/utils/combat/combatUtils.ts', 'src/hooks/combat/useActionExecutor.ts', 'src/utils/combat/physicsUtils.ts']) {
    assert.ok(failed.errors.some((e) => e.includes(hot) && e.includes('WF-G261')), failed.errors.join('\n'));
  }
});

test('WF-G270: a task body directing a symbol read/merge in another module resolves that symbol to its defining file', () => {
  const dialogueTypes = 'src/types/dialogue.ts';
  const task = {
    id: 'agora-db71.17',
    title: 'Add cultureFamily to SpeechProfile',
    body: 'Add cultureFamily on SpeechProfile in src/types/dialogue.ts AND read it in applySpeechProfile.',
    refs: [dialogueTypes],
  };
  const plan = {
    packets: [{
      id: 'W4-D',
      scope: 'SpeechProfile cultureFamily',
      files: [dialogueTypes],
      unionReviews: unchangedFixtureUnions([dialogueTypes]),
      taskIds: [task.id],
    }],
  };
  const failed = analyzePacketOwnership(plan, [task]);
  assert.equal(failed.ok, false);
  assert.ok(
    failed.errors.some((e) => e.includes('src/systems/social/speechProfile.ts') && e.includes('applySpeechProfile') && e.includes('WF-G270')),
    failed.errors.join('\n')
  );
});

test('WF-G248: an adapter-only packet for a runtime monster spell-slot task requires its type contract and runtime consumer chain', () => {
  const adapter = 'src/data/adapters/5eTools/spellcastingAdapter.ts';
  const adapterTest = 'src/data/adapters/5eTools/__tests__/spellcastingAdapter.test.ts';
  const task = {
    id: 'agora-21c1',
    title: 'Runtime monster spell slots tracking',
    body: 'Parse monster spell slots in src/data/adapters/5eTools/spellcastingAdapter.ts for runtime monster spell slots tracking.',
    refs: [adapter],
  };
  const plan = {
    packets: [{
      id: 'PK-16',
      scope: 'Runtime monster spell slots',
      files: [adapter, adapterTest],
      unionReviews: unchangedFixtureUnions([adapter]),
      taskIds: [task.id],
    }],
  };
  const failed = analyzePacketOwnership(plan, [task]);
  assert.equal(failed.ok, false);
  assert.ok(
    failed.errors.some((e) => e.includes('src/types/ui.ts') && e.includes('WF-G248')),
    failed.errors.join('\n')
  );
  assert.ok(
    failed.errors.some((e) => e.includes('src/utils/combat/createEnemyFromMonster.ts') && e.includes('WF-G248')),
    failed.errors.join('\n')
  );
});

test('WF-G273: a task adding a new trigger case to CommandContext.requestReaction requires the inline union declaration sites', () => {
  const reactionPrompt = 'src/components/Combat/ReactionPrompt.tsx';
  const reactionPromptTest = 'src/components/Combat/__tests__/ReactionPrompt.test.tsx';
  const task = {
    id: 'agora-db71.12',
    title: 'Reaction prompt for failed saving throw',
    body: "Add a reaction prompt for a failed saving throw on CommandContext.requestReaction triggerType ('on_hit' | 'on_take_damage') in src/components/Combat/ReactionPrompt.tsx.",
    refs: [reactionPrompt],
  };
  const plan = {
    packets: [{
      id: 'W4-A',
      scope: 'Reaction prompt for failed saving throw',
      files: [reactionPrompt, reactionPromptTest],
      unionReviews: unchangedFixtureUnions([reactionPrompt]),
      taskIds: [task.id],
    }],
  };
  const failed = analyzePacketOwnership(plan, [task]);
  assert.equal(failed.ok, false);
  // The declaration sites are found at test time; a fixed list failed when the union
  // moved from useAbilityExecution.ts to abilityExecutionTypes.ts. This scan is looser
  // than the analyzer's pattern (any line whose triggerType names both cases), so a
  // site that the analyzer misses still fails here.
  const declarationSites = liveSourceFiles('src').filter(file => fs.readFileSync(file, 'utf8').split(/\r?\n/)
    .some(line => /\btriggerType\b/.test(line) && /['"]on_hit['"]/.test(line) && /['"]on_take_damage['"]/.test(line)));
  assert.ok(declarationSites.length >= 3, 'expected several inline triggerType union sites, found: ' + declarationSites.join(', '));
  for (const declFile of declarationSites) {
    assert.ok(
      failed.errors.some((e) => e.includes(declFile) && e.includes('WF-G273')),
      'expected WF-G273 error for ' + declFile + ' in:\n' + failed.errors.join('\n')
    );
  }
});

test('WF-G317: partition, seed, and dispatch refuse an earlier wave\'s live lock before writing or launching', async () => {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-wfg317-live-'));
  const app = createAgoraServer({ dir: path.join(fixtureDir, 'server') });
  try {
    await new Promise((resolve) => app.listen(0, resolve));
    const holder = app.store.registerAgent({ handle: 'w13-gpu-nameplates', petSlug: 'cyberman' });
    const owned = 'src/components/BattleMap/BattleMap3DGpuScene.tsx';
    const lock = app.store.acquireLock({ agentId: holder.id, paths: [owned], reason: 'W13-C' });
    assert.equal(lock.ok, true);
    const plan = {
      wave: 'wfg317-live', pet: 'gf-sd',
      baseUrl: 'http://127.0.0.1:' + app.server.address().port,
      packets: [{ id: 'W14-B', handle: 'w14-b', pet: 'dream-girl', agent: 'claude', scope: 'GPU follow-up', files: [owned] }],
    };
    const planFile = path.join(fixtureDir, 'plan.json');
    fs.writeFileSync(planFile, JSON.stringify(plan));
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
    const runCommand = (command) => new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['tools/agora/orchestrate.mjs', command, planFile], { cwd: repoRoot });
      let output = '';
      child.stdout.on('data', (chunk) => { output += chunk; });
      child.stderr.on('data', (chunk) => { output += chunk; });
      child.once('error', reject);
      child.once('close', (code) => resolve({ code, output }));
    });
    for (const command of ['partition', 'seed', 'dispatch']) {
      const result = await runCommand(command);
      assert.equal(result.code, 1, command + ': ' + result.output);
      assert.match(result.output, /W14-B.*BattleMap3DGpuScene\.tsx.*W13-C/);
      assert.ok(result.output.includes(holder.id), command + ' must identify the lock holder');
      assert.deepEqual(app.store.listTasks(), [], command + ' must not create tasks');
      assert.deepEqual(app.store.listCampaigns(), [], command + ' must not claim a campaign');
      assert.equal(app.store.listAgents().length, 1, command + ' must not register a second agent');
    }
  } finally {
    await app.close();
    const target = path.resolve(fixtureDir);
    assert.ok(target.startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(target, { recursive: true, force: true });
  }
});
