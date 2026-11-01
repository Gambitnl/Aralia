// Prove the fleet uses complete published bytes while source is mid-write.
// All corruption, Git commits and board mutations stay in disposable fixtures.
// The no-retry check deliberately throws AFTER a request, catching duplicate work.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createAgoraServer } from './server.mjs';
import { publishClient, clientReleaseStatus, RELEASE_FILES, CLIENT_EXPORTS } from './client-release.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

test('WF260: stable entry refuses recovery flags before an accepted legacy release can release any lock',async()=>{
  const f=fixture(),calls=[];
  const server=http.createServer((req,res)=>{calls.push([req.method,req.url]);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({locks:[{id:'owned'},{id:'sibling'}]}));});
  try{
    const current=await publishClient({repoRoot:f.root}),manifest=structuredClone(current.manifest);
    delete manifest.files['lockSnapshots.mjs'];
    // Model the old no-positional unlock behavior, without adding recovery
    // support. This accepted legacy module must never receive these commands.
    const bytes=Buffer.from('export async function run(argv){const base=argv[argv.indexOf("--url")+1];const body=await(await fetch(base+"/locks")).json();for(const l of body.locks)await fetch(base+"/locks/"+l.id,{method:"DELETE"});return{code:0,lines:["legacy release-all"]};}\n');
    manifest.files['client-runtime.mjs']=crypto.createHash('sha256').update(bytes).digest('hex');
    const id=crypto.createHash('sha256').update(JSON.stringify(manifest)).digest('hex'),dir=path.join(f.root,'.agent/agora/client-releases',id);fs.mkdirSync(dir);
    for(const name of Object.keys(manifest.files))fs.copyFileSync(path.join(current.directory,name),path.join(dir,name));
    fs.writeFileSync(path.join(dir,'client-runtime.mjs'),bytes);fs.writeFileSync(path.join(dir,'release.json'),JSON.stringify(manifest));
    fs.writeFileSync(path.join(f.root,'.agent/agora/client-current.json'),JSON.stringify({version:1,id}));assert.equal(clientReleaseStatus(f.root).id,id);
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    for(const argv of [['unlock','--revert','owned.txt'],['unlock','--restore','owned.txt'],['unlock','--lock-id','owned'],['lock','--restore','owned.txt']]){
      const result=await execute(f.entry,[...argv,'--url','http://127.0.0.1:'+server.address().port],{},os.tmpdir());
      assert.equal(result.code,1,result.stdout+result.stderr);assert.equal(calls.length,0,'legacy delegation must be refused before any HTTP request');
    }
  }finally{await new Promise(resolve=>server.close(resolve));f.cleanup();}
});

test('WF260: immutable native recovery preserves dirty bytes, shrinks only the selected target and ignores torn helper source',async()=>{
  const f=fixture(),app=createAgoraServer({dir:path.join(f.root,'server'),seatRosterPath:null});
  try{
    execFileSync('git',['init','-q',f.root]);fs.writeFileSync(path.join(f.root,'.gitignore'),'.agent/\n');
    const baseline=Buffer.from('pre-existing dirty work\r\n'),bad=Buffer.from('fixture bad edit');
    fs.writeFileSync(path.join(f.root,'owned.txt'),baseline);fs.writeFileSync(path.join(f.root,'sibling.txt'),'peer bytes');
    const release=await publishClient({repoRoot:f.root});assert.ok(release.manifest.files['lockSnapshots.mjs']);
    await new Promise(resolve=>app.listen(0,resolve));const url='http://127.0.0.1:'+app.server.address().port,env={AGORA_AGENT_ID:'native-recovery-fixture'};
    const call=args=>execute(f.entry,[...args,'--url',url],env,os.tmpdir());
    assert.equal((await call(['register','native-recovery-fixture','--pet','dream-girl'])).code,0);
    const grant=await call(['lock','owned.txt','sibling.txt','--id-only']);assert.equal(grant.code,0,grant.stdout+grant.stderr);assert.match(grant.stdout.trim(),/^[a-f0-9-]{36}$/);
    const lockState=()=>JSON.stringify(app.store.listLocks().map(({holderIdleMs,...lock})=>lock));
    fs.writeFileSync(path.join(f.root,'owned.txt'),bad);const before=lockState();
    const stale=await call(['unlock','--revert','owned.txt','--expect-current','0'.repeat(64)]);assert.equal(stale.code,1);assert.equal(lockState(),before);
    assert.deepEqual(fs.readFileSync(path.join(f.root,'owned.txt')),bad);
    fs.writeFileSync(path.join(f.source,'lockSnapshots.mjs'),'incomplete source edit');
    const expected=crypto.createHash('sha256').update(bad).digest('hex');
    const restored=await call(['unlock','--revert','owned.txt','--expect-current',expected]);assert.equal(restored.code,0,restored.stdout+restored.stderr);
    assert.deepEqual(fs.readFileSync(path.join(f.root,'owned.txt')),baseline);assert.equal(fs.readFileSync(path.join(f.root,'sibling.txt'),'utf8'),'peer bytes');
    const remaining=app.store.listLocks();assert.equal(remaining.length,1);assert.deepEqual(remaining[0].paths,['sibling.txt']);
    assert.equal(clientReleaseStatus(f.root).id,release.id,'torn helper cannot be auto-promoted');
    const manifest=JSON.parse(fs.readFileSync(path.join(f.root,'.agent/agora/locksnap',grant.stdout.trim(),'snapshot.json'),'utf8'));assert.equal(manifest.payload.files.length,2);
    assert.equal(fs.existsSync(path.join(release.directory,'.agent')),false,'recovery data belongs to the checkout, not release copies');
  }finally{await app.close();f.cleanup();}
});

test('WF294: actual immutable CLI checks address owners using GET only and remains isolated from mutable helpers',async()=>{
  const f=fixture(),calls=[],file='public/idea-board/records.json',url='https://example.com/current-source';
  const record={file,recordId:'IB-0008',sourceId:'SRC-0042',addressField:'url',url};
  const base={state:'open',createdAt:10,history:[],refs:[file],title:'Review exact source'};
  const tasks=[{...base,id:'agora-wrong-owner',body:'Review IB-0001 address '+url+' in '+file},
    {...base,id:'agora-verified-owner',body:'Review IB-0008 / SRC-0042 address '+url+' in '+file+'\nREFERENCE-ONLY: SOURCE-RECORD: '+JSON.stringify(record)}];
  const app=http.createServer((req,res)=>{calls.push([req.method,req.url]);res.setHeader('Content-Type','application/json');res.end(JSON.stringify(req.url==='/agents'?{agents:[]}:{tasks}));});
  try{
    fs.mkdirSync(path.dirname(path.join(f.root,file)),{recursive:true});fs.writeFileSync(path.join(f.root,file),JSON.stringify({records:[{id:'IB-0008',sources:[{id:'SRC-0042',url}]}],excludedSources:[]}));
    const release=await publishClient({repoRoot:f.root});assert.ok(release.manifest.files['recordSourceProvenance.mjs']);
    await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));const baseUrl='http://127.0.0.1:'+app.address().port,before=JSON.stringify(tasks);
    for(const[id,code]of [['agora-wrong-owner',1],['agora-verified-owner',0]]){const r=await execute(f.entry,['task','lint',id,'--url',baseUrl,'--token','fixture'],{},os.tmpdir());assert.equal(r.code,code,r.stdout+r.stderr);assert.match(r.stdout,/WF-G294/);}
    assert.equal(JSON.stringify(tasks),before);assert.ok(calls.every(call=>call[0]==='GET'));
    fs.writeFileSync(path.join(f.source,'recordSourceProvenance.mjs'),'incomplete source edit');
    const valid=await execute(f.entry,['task','lint','agora-verified-owner','--url',baseUrl,'--token','fixture'],{},os.tmpdir());assert.equal(valid.code,0,valid.stdout+valid.stderr);
    fs.appendFileSync(path.join(release.directory,'recordSourceProvenance.mjs'),'\n// private release corruption');assert.throws(()=>clientReleaseStatus(f.root),/damaged.*recordSourceProvenance/);
  }finally{await new Promise(resolve=>app.close(resolve));f.cleanup();}
});

test('WF267: immutable native client checks current sibling/new provenance with GET-only requests',async()=>{
  const f=fixture(),calls=[];
  const target='public/data/target.json',source='public/data/sibling.json';
  const record={file:target,field:['frequency'],value:'each_turn',origin:{kind:'existing',file:source,field:['frequency'],reason:'Private sibling has the same reviewed authored cadence.'}};
  const base={state:'open',createdAt:10,history:[],refs:[target],title:'Choose cadence'};
  const tasks=[{...base,id:'agora-missing',body:'Set "frequency": "invented" in '+target},
    {...base,id:'agora-cited',body:'Set "frequency": "each_turn" in '+target+'\nREFERENCE-ONLY: DATA-VALUE: '+JSON.stringify(record)},
    {...base,id:'agora-new',body:'Set "frequency": "new_cadence" in '+target+'\nREFERENCE-ONLY: DATA-VALUE: '+JSON.stringify({...record,value:'new_cadence',origin:{kind:'new',reason:'Private author deliberately adds a distinct cadence; runtime proof remains required.'}})}];
  const app=http.createServer((req,res)=>{calls.push([req.method,req.url]);res.setHeader('Content-Type','application/json');res.end(JSON.stringify(req.url==='/agents'?{agents:[]}:{tasks}));});
  try{
    fs.mkdirSync(path.join(f.root,'public/data'),{recursive:true});fs.writeFileSync(path.join(f.root,target),'{"frequency":"old"}');fs.writeFileSync(path.join(f.root,source),'{"frequency":"each_turn"}');
    const released=await publishClient({repoRoot:f.root});assert.ok(released.manifest.files['dataValueProvenance.mjs']);
    await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+app.address().port,before=JSON.stringify(tasks);
    for(const[id,code]of [['agora-missing',1],['agora-cited',0],['agora-new',0]]){const r=await execute(f.entry,['task','lint',id,'--url',url,'--token','private-fixture'],{},os.tmpdir());assert.equal(r.code,code,r.stdout+r.stderr);assert.match(r.stdout,/WF-G267/);}
    assert.equal(JSON.stringify(tasks),before);assert.ok(calls.every(call=>call[0]==='GET'));
    fs.writeFileSync(path.join(f.root,'tools/agora/dataValueProvenance.mjs'),'incomplete source edit');
    const r=await execute(f.entry,['task','lint','agora-cited','--url',url,'--token','private-fixture'],{},os.tmpdir());assert.equal(r.code,0,r.stdout+r.stderr);
    fs.appendFileSync(path.join(released.directory,'dataValueProvenance.mjs'),'\n// private corrupt release');assert.throws(()=>clientReleaseStatus(f.root),/damaged.*dataValueProvenance/);
  }finally{await new Promise(resolve=>app.close(resolve));f.cleanup();}
});

test('WF-G285: immutable native client warns on legacy filtered board and refuses stale review without writes', async () => {
  const f=fixture();
  const target={id:'freshness-target',title:'Review sweep',body:'Review the current work.',refs:['src/shared.ts'],state:'open',createdAt:10,ready:true,history:[]};
  const source={id:'freshness-source',title:'Sibling handler work',refs:['src/shared.ts'],state:'done',createdAt:1,history:[{action:'state',state:'done',at:20}]};
  const tasks=[target,source],calls=[];
  const app=http.createServer((req,res)=>{calls.push([req.method,req.url]);res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify(req.url==='/agents'?{agents:[]}:req.url.startsWith('/tasks?')?{tasks:[target]}:{tasks}));});
  try{
    fs.mkdirSync(path.join(f.root,'src'));fs.writeFileSync(path.join(f.root,'src/shared.ts'),'export {};\n');
    const published=await publishClient({repoRoot:f.root});assert.ok(published.manifest.files['taskFreshness.mjs']);
    await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
    const base='http://127.0.0.1:'+app.address().port;
    const native=args=>execute(f.entry,[...args,'--url',base,'--token','private-fixture'],{},os.tmpdir());
    const before=JSON.stringify(tasks);
    for(const args of [['task','show',target.id],['tasks','--ready'],['task','lint',target.id]]){
      const r=await native(args);assert.match(r.stdout,/COUNTS UNVERIFIED.*freshness-source/);assert.equal(r.code,args.includes('lint')?1:0,r.stdout+r.stderr);
    }
    assert.equal(JSON.stringify(tasks),before);assert.ok(calls.every(x=>x[0]==='GET'));assert.ok(calls.some(x=>x[1]==='/tasks?ready=1'));
    const review={taskId:target.id,sourceTask:source.id,completedAt:20,historyIndex:0,refs:['src/shared.ts'],proof:'Read-only fixture measurement returned 14 remaining items.'};
    target.history.push({action:'note',at:30,reason:'COUNT-REVIEW: '+JSON.stringify(review)});
    const checked=await native(['task','lint',target.id]);assert.equal(checked.code,0,checked.stdout+checked.stderr);assert.match(checked.stdout,/review recorded.*authored evidence/);
    source.history.push({action:'state',state:'done',at:40});
    const stale=await native(['task','lint',target.id]);assert.equal(stale.code,1);assert.match(stale.stdout,/COUNTS UNVERIFIED/);
    fs.appendFileSync(path.join(published.directory,'taskFreshness.mjs'),'\n// corrupt private fixture\n');
    assert.throws(()=>clientReleaseStatus(f.root),/damaged.*taskFreshness/);
  }finally{await new Promise(resolve=>app.close(resolve));f.cleanup();}
});

test('WF-G285: known eight-source release is still valid, arbitrary missing helpers are not', async () => {
  const f=fixture();
  try{
    const published=await publishClient({repoRoot:f.root});
    const manifest=structuredClone(published.manifest);delete manifest.files['taskFreshness.mjs'];delete manifest.files['dataValueProvenance.mjs'];delete manifest.files['recordSourceProvenance.mjs'];delete manifest.files['lockSnapshots.mjs'];
    const id=crypto.createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
    const dir=path.join(f.root,'.agent/agora/client-releases',id);fs.mkdirSync(dir);
    for(const name of Object.keys(manifest.files))fs.copyFileSync(path.join(published.directory,name),path.join(dir,name));
    fs.writeFileSync(path.join(dir,'release.json'),JSON.stringify(manifest));
    fs.writeFileSync(path.join(f.root,'.agent/agora/client-current.json'),JSON.stringify({version:1,id}));
    assert.equal(clientReleaseStatus(f.root).id,id);
  }finally{f.cleanup();}
});

test('WF-G285: actual published reason-only task edit records exact review without rewriting the brief', async () => {
  const f=fixture(),app=createAgoraServer({dir:path.join(f.root,'server'),seatRosterPath:null});
  try{
    fs.mkdirSync(path.join(f.root,'src'));fs.writeFileSync(path.join(f.root,'src/shared.ts'),'export {};\n');
    await publishClient({repoRoot:f.root});await new Promise(resolve=>app.listen(0,resolve));
    const owner=app.store.registerAgent({handle:'review-fixture-owner',petSlug:'dream-girl'});
    const source=app.store.createTask({agentId:owner.id,title:'Sibling',body:'Private fixture',refs:['src/shared.ts']});
    const target=app.store.createTask({agentId:owner.id,title:'Count brief',body:'Original brief.',refs:['src/shared.ts']});
    app.store.setTaskState({agentId:owner.id,taskId:source.id,state:'done',result:'Private fixture completion'});
    const before=app.store.listTasks().find(t=>t.id===target.id),event=before.referenceFreshness.completions[0];assert.ok(event);
    const review={taskId:target.id,sourceTask:source.id,completedAt:event.at,historyIndex:event.historyIndex,refs:event.sharedRefs,proof:'Private fixture read-only measurement returned 14 remaining items.'};
    const result=await execute(f.entry,['task','edit',target.id,'--reason','COUNT-REVIEW: '+JSON.stringify(review),'--url','http://127.0.0.1:'+app.server.address().port,'--token',owner.token],{},os.tmpdir());
    assert.equal(result.code,0,result.stdout+result.stderr);
    const after=app.store.listTasks().find(t=>t.id===target.id);assert.equal(after.referenceFreshness.status,'review_recorded');
    for(const field of ['body','title','state','claimedBy','refs','deps','createdBy','ready'])assert.deepEqual(after[field],before[field],field);
    assert.equal(after.history.length,before.history.length+1);assert.equal(after.history.at(-1).action,'note');
  }finally{await app.close();f.cleanup();}
});

test('WF283: actual immutable client checks current union and enum members without mutating board or source', async () => {
  const f = fixture(), app = createAgoraServer({ dir: path.join(f.root, 'server'), seatRosterPath: null });
  try {
    // The private checkout needs its own real parser dependency, not a missing-
    // package failure that would falsely look like a rejected member mismatch.
    const require = createRequire(import.meta.url), parser = require.resolve('typescript');
    const dependency = path.join(f.root, 'node_modules/typescript'); fs.mkdirSync(dependency, { recursive: true });
    fs.copyFileSync(parser, path.join(dependency, 'typescript.js'));
    fs.writeFileSync(path.join(dependency, 'package.json'), JSON.stringify({ name: 'typescript', main: 'typescript.js' }));
    fs.mkdirSync(path.join(f.root, 'src')); const file = path.join(f.root, 'src/village.ts');
    const quote = 'export type Cultural = "shrine" | "garden";';
    const enumeration = 'export enum Phase { Ready = "idle", Busy = 2 }';
    const source = quote + '\nexport type Civic = "gatehouse";\n' + enumeration;
    fs.writeFileSync(file, source);
    const release = await publishClient({ repoRoot: f.root });
    await new Promise(resolve => app.listen(0, resolve));
    const owner = app.store.registerAgent({ handle: 'members-release-proof', petSlug: 'gf-sd' });
    const claim = { file: 'src/village.ts', symbol: 'Cultural', kind: 'string-union', quote, members: ['shrine', 'garden'] };
    const make = value => app.store.createTask({ agentId: owner.id, title: 'Verify sourced member names', body: 'REFERENCE-ONLY: SOURCE-MEMBERS: ' + JSON.stringify(value) });
    const wrong = make({ ...claim, members: [...claim.members, 'gatehouse'] }), good = make(claim);
    const enumGood = make({ ...claim, symbol: 'Phase', kind: 'enum', quote: enumeration, members: ['Ready', 'Busy'] });
    const enumWrong = make({ ...claim, symbol: 'Phase', kind: 'enum', quote: enumeration, members: ['idle', 'Busy'] });
    const before = app.store.listTasks();
    fs.writeFileSync(path.join(f.source, 'taskLint.mjs'), 'throw new Error("mutable helper unavailable");');
    const args = id => ['task', 'lint', id, '--token', owner.token, '--url', 'http://127.0.0.1:' + app.server.address().port];
    for (const task of [wrong, enumWrong]) {
      const result = await execute(f.entry, args(task.id), { AGORA_AGENT_ID: owner.handle }, os.tmpdir());
      assert.equal(result.code, 1, result.stdout + result.stderr); assert.match(result.stdout + result.stderr, /member mismatch: missing .*extra/);
    }
    for (const task of [good, enumGood]) {
      const result = await execute(f.entry, args(task.id), { AGORA_AGENT_ID: owner.handle }, os.tmpdir());
      assert.equal(result.code, 0, result.stdout + result.stderr); assert.match(result.stdout, /SOURCE MEMBERS \(WF-G283\)/);
    }
    fs.writeFileSync(file, source.replace('"garden"', '"park"'));
    const stale = await execute(f.entry, args(good.id), { AGORA_AGENT_ID: owner.handle }, os.tmpdir());
    assert.equal(stale.code, 1); assert.match(stale.stdout + stale.stderr, /stale or ambiguous quote/);
    assert.deepEqual(app.store.listTasks(), before); assert.deepEqual(app.store.listLocks(), []);
    assert.equal(clientReleaseStatus(f.root).id, release.id);
  } finally { await app.close(); f.cleanup(); }
});

test('WF256: immutable helper preserves title ownership and the real claim warns without granting locks', async () => {
  const f = fixture(), app = createAgoraServer({ dir: path.join(f.root, 'server'), seatRosterPath: null });
  try {
    fs.mkdirSync(path.join(f.root, 'src'));
    fs.writeFileSync(path.join(f.root, 'src/detail.ts'), 'export const Detail = () => sharedBonus();\n');
    const published = await publishClient({ repoRoot: f.root });
    const helper = await import(pathToFileURL(path.join(published.directory, 'taskLint.mjs')).href);
    const task = { title: 'Repair src/one.ts and detail display', body: 'TITLE-TARGET: ' + JSON.stringify({
      label: 'detail display', file: 'src/detail.ts', quote: 'export const Detail = () => sharedBonus();' }) };
    assert.deepEqual(helper.extractTaskOwnershipPaths(task), [
      { ref: 'src/one.ts', sources: ['title'] }, { ref: 'src/detail.ts', sources: ['title-target'] },
    ]);
    assert.equal(helper.inspectTaskTitleTargets(task, { repoRoot: f.root }).issues.length, 0);
    fs.writeFileSync(path.join(f.source, 'taskLint.mjs'), 'throw new Error("mutable helper unavailable");\n');
    await new Promise(resolve => app.listen(0, resolve));
    const agent = app.store.registerAgent({ handle: 'title-release-proof', petSlug: 'gf-sd' });
    const created = app.store.createTask({ agentId: agent.id, ...task });
    const result = await execute(f.entry, ['task', 'claim', created.id, '--token', agent.token,
      '--url', 'http://127.0.0.1:' + app.server.address().port], { AGORA_AGENT_ID: 'title-release-proof' }, f.root);
    assert.equal(result.code, 0, result.stdout + result.stderr);
    assert.match(result.stderr, /src\/one\.ts \(title\).*not covered/);
    assert.match(result.stderr, /src\/detail\.ts \(title-target\).*not covered/);
    assert.deepEqual(app.store.listLocks(), [], 'an advisory warning never grants ownership');
    assert.equal(app.store.listTasks().find(item => item.id === created.id).claimedBy, agent.id);
    assert.equal(fs.readFileSync(path.join(f.root, 'src/detail.ts'), 'utf8'), 'export const Detail = () => sharedBonus();\n');
  } finally { await app.close(); f.cleanup(); }
});

test('WF325: actual immutable client lints contradictory dedup acceptance without rewriting task records', async () => {
  const f = fixture(), app = createAgoraServer({ dir: path.join(f.root, 'server'), seatRosterPath: null });
  try {
    const contract = { canonical: 'shared table', canonicalCount: 1, obsolete: 'legacy switch', obsoleteCount: 0,
      consumers: ['first view', 'second view'], verification: 'Both consumers delegate and preserve fallback behavior.' };
    const published = await publishClient({ repoRoot: f.root });
    const helper = await import(pathToFileURL(path.join(published.directory, 'taskLint.mjs')).href);
    assert.equal(helper.inspectDedupAcceptance('DEDUP-ACCEPTANCE: ' + JSON.stringify(contract)).issues.length, 0);
    await new Promise(resolve => app.listen(0, resolve));
    const owner = app.store.registerAgent({ handle: 'dedup-release-proof', petSlug: 'gf-sd' });
    const bad = app.store.createTask({ agentId: owner.id, title: 'One status-icon function, not two', body: 'ACCEPTANCE: grep legacy-switch src/ returns ONE hit' });
    const good = app.store.createTask({ agentId: owner.id, title: 'Deduplicate shared table', body: 'DEDUP-ACCEPTANCE: ' + JSON.stringify(contract) });
    const before = app.store.listTasks();
    fs.writeFileSync(path.join(f.source, 'taskLint.mjs'), 'throw new Error("mutable helper unavailable");\n');
    const args = id => ['task', 'lint', id, '--token', owner.token, '--url', 'http://127.0.0.1:' + app.server.address().port];
    const refused = await execute(f.entry, args(bad.id), { AGORA_AGENT_ID: owner.handle }, f.root);
    assert.equal(refused.code, 1, refused.stdout + refused.stderr); assert.match(refused.stdout + refused.stderr, /WF-G325/);
    const accepted = await execute(f.entry, args(good.id), { AGORA_AGENT_ID: owner.handle }, f.root);
    assert.equal(accepted.code, 0, accepted.stdout + accepted.stderr); assert.match(accepted.stdout, /exactly one.*zero/);
    assert.deepEqual(app.store.listTasks(), before, 'lint is read-only, not task acceptance');
    assert.deepEqual(app.store.listLocks(), []);
  } finally { await app.close(); f.cleanup(); }
});

test('WF272: real immutable client rejects wrong-file and existing-field premises without rewriting the private board', async () => {
  const f = fixture(), app = createAgoraServer({ dir: path.join(f.root, 'server'), seatRosterPath: null });
  try {
    fs.mkdirSync(path.join(f.root, 'src'));
    fs.writeFileSync(path.join(f.root, 'src/consumer.ts'), 'const subclassId = "existing";\n');
    fs.writeFileSync(path.join(f.root, 'src/movement.ts'), 'export function findPath() {}\n');
    const release = await publishClient({ repoRoot: f.root });
    await new Promise(resolve => app.listen(0, resolve));
    const owner = app.store.registerAgent({ handle: 'symbol-release-proof', petSlug: 'gf-sd' });
    const make = (file, symbol, expect) => app.store.createTask({ agentId: owner.id, title: 'Verify exact symbol', body: 'SYMBOL-CHECK: ' + JSON.stringify({ file, symbol, expect }) });
    const wrong = make('src/consumer.ts', 'findPath', 'present'), stale = make('src/consumer.ts', 'subclassId', 'absent'), good = make('src/movement.ts', 'findPath', 'present');
    const before = app.store.listTasks();
    fs.writeFileSync(path.join(f.source, 'taskLint.mjs'), 'throw new Error("mutable helper unavailable");\n');
    const args = id => ['task', 'lint', id, '--token', owner.token, '--url', 'http://127.0.0.1:' + app.server.address().port];
    for (const task of [wrong, stale]) {
      const result = await execute(f.entry, args(task.id), { AGORA_AGENT_ID: owner.handle }, os.tmpdir());
      assert.equal(result.code, 1, result.stdout + result.stderr); assert.match(result.stdout + result.stderr, /WF-G272/);
    }
    const accepted = await execute(f.entry, args(good.id), { AGORA_AGENT_ID: owner.handle }, os.tmpdir());
    assert.equal(accepted.code, 0, accepted.stdout + accepted.stderr); assert.match(accepted.stdout, /literal.*not semantic/);
    assert.deepEqual(app.store.listTasks(), before); assert.deepEqual(app.store.listLocks(), []);
    assert.equal(clientReleaseStatus(f.root).id, release.id);
  } finally { await app.close(); f.cleanup(); }
});

test('WF307: immutable native lint detects sibling block growth while retaining task records', async () => {
  const f = fixture(), app = createAgoraServer({ dir: path.join(f.root, 'server'), seatRosterPath: null });
  try {
    fs.mkdirSync(path.join(f.root, 'src')); const file = path.join(f.root, 'src/attack.ts');
    fs.writeFileSync(file, '// BEGIN\nbaseAttack();\n// END');
    const release = await publishClient({ repoRoot: f.root });
    const api = await import(pathToFileURL(path.join(release.directory, 'taskLint.mjs')).href);
    const review = api.captureSourceReview({ id: 'attack-review', file: 'src/attack.ts', start: '// BEGIN', end: '// END', symbols: ['baseAttack'], reason: 'Review the current fixture attack.' }, { repoRoot: f.root });
    await new Promise(resolve => app.listen(0, resolve)); const owner = app.store.registerAgent({ handle: 'review-release-proof', petSlug: 'gf-sd' });
    const task = app.store.createTask({ agentId: owner.id, title: 'Replace fixture block', body: 'SOURCE-REVIEW: ' + JSON.stringify(review) });
    const args = ['task', 'lint', task.id, '--token', owner.token, '--url', 'http://127.0.0.1:' + app.server.address().port];
    assert.equal((await execute(f.entry, args, { AGORA_AGENT_ID: owner.handle }, os.tmpdir())).code, 0);
    fs.writeFileSync(file, '// BEGIN\nbaseAttack();\nsiblingRider();\n// END');
    fs.writeFileSync(path.join(f.source, 'taskLint.mjs'), 'throw new Error("mutable helper unavailable");'); const before = app.store.listTasks();
    const changed = await execute(f.entry, args, { AGORA_AGENT_ID: owner.handle }, os.tmpdir());
    assert.equal(changed.code, 1); assert.match(changed.stdout + changed.stderr, /WF-G307.*|changed.*reconcile/);
    assert.deepEqual(app.store.listTasks(), before); assert.deepEqual(app.store.listLocks(), []);
  } finally { await app.close(); f.cleanup(); }
});

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-release-'));
  const source = path.join(root, 'tools', 'agora');
  fs.mkdirSync(source, { recursive: true });
  for (const name of [...RELEASE_FILES, 'client.mjs', 'client-release.mjs', 'agents.json']) {
    fs.copyFileSync(path.join(here, name), path.join(source, name));
  }
  return {
    root, source, entry: path.join(source, 'client.mjs'),
    cleanup() {
      assert.equal(path.dirname(root), path.resolve(os.tmpdir()), 'cleanup remains inside fixture temp root');
      assert.match(path.basename(root), /^agora-release-/);
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

function execute(file, args, env = {}, cwd = path.dirname(file)) {
  return new Promise((resolve, reject) => {
    const childEnv = { ...process.env, ...env };
    delete childEnv.AGORA_DIR; // Exercise the real checkout-relative default identity.
    const child = spawn(process.execPath, [file, ...args], { env: childEnv, cwd, windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => { child.kill(); reject(new Error('fixture command timed out')); }, 30000);
    child.stdout.on('data', (bytes) => { stdout += bytes; });
    child.stderr.on('data', (bytes) => { stderr += bytes; });
    child.once('error', (error) => { clearTimeout(timeout); reject(error); });
    child.once('close', (code) => { clearTimeout(timeout); resolve({ code, stdout, stderr }); });
  });
}

test('WF-G284: old seven-source release remains readable but incomplete or damaged graphs are refused', async () => {
  const f = fixture();
  try {
    const current = await publishClient({ repoRoot: f.root });
    const manifest = structuredClone(current.manifest); delete manifest.files['testBaseline.mjs']; delete manifest.files['taskFreshness.mjs']; delete manifest.files['dataValueProvenance.mjs']; delete manifest.files['recordSourceProvenance.mjs']; delete manifest.files['lockSnapshots.mjs'];
    const id = crypto.createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
    const dir = path.join(f.root, '.agent/agora/client-releases', id); fs.mkdirSync(dir);
    for (const name of Object.keys(manifest.files)) fs.copyFileSync(path.join(current.directory, name), path.join(dir, name));
    fs.writeFileSync(path.join(dir, 'release.json'), JSON.stringify(manifest));
    fs.writeFileSync(path.join(f.root, '.agent/agora/client-current.json'), JSON.stringify({ version: 1, id }));
    assert.equal(clientReleaseStatus(f.root).id, id);
    fs.appendFileSync(path.join(dir, 'client-runtime.mjs'), '\n// damaged fixture\n'); assert.throws(() => clientReleaseStatus(f.root), /damaged/);
    fs.copyFileSync(path.join(current.directory, 'client-runtime.mjs'), path.join(dir, 'client-runtime.mjs'));
    const incomplete = structuredClone(manifest); delete incomplete.files['gapAppend.mjs'];
    const badId = crypto.createHash('sha256').update(JSON.stringify(incomplete)).digest('hex');
    const badDir = path.join(f.root, '.agent/agora/client-releases', badId); fs.mkdirSync(badDir); fs.writeFileSync(path.join(badDir, 'release.json'), JSON.stringify(incomplete));
    fs.writeFileSync(path.join(f.root, '.agent/agora/client-current.json'), JSON.stringify({ version: 1, id: badId })); assert.throws(() => clientReleaseStatus(f.root), /manifest does not match/);
  } finally { f.cleanup(); }
});

test('WF-G284: published CLI stores baseline verbatim and refuses stale evidence without extra tasks', async () => {
  const f = fixture(), app = createAgoraServer({ dir: path.join(f.root, 'server'), seatRosterPath: null });
  try {
    const { captureTestBaseline, baselineTaskText } = await import('./testBaseline.mjs'); const start = Date.now() - 1000;
    fs.writeFileSync(path.join(f.root, 'owned.test.js'), 'export {};\n');
    const report = { startTime: start, success: false, numPendingTestSuites: 0, numTotalTests: 1, numFailedTests: 1, numPassedTests: 0,
      testResults: [{ name: path.join(f.root, 'owned.test.js'), endTime: start + 10, status: 'failed', message: '', assertionResults: [{ fullName: 'old failure', status: 'failed', failureMessages: ['retained diagnostic'] }] }] };
    const receipt = captureTestBaseline(report, { repoRoot: f.root, command: 'vitest run owned.test.js' }), expected = baselineTaskText(receipt, { repoRoot: f.root });
    const file = path.join(f.root, 'receipt.json'); fs.writeFileSync(file, JSON.stringify(receipt));
    await publishClient({ repoRoot: f.root }); await new Promise(resolve => app.listen(0, resolve));
    const owner = app.store.registerAgent({ handle: 'published-baseline-owner', petSlug: 'dream-girl' });
    const args = ['task', 'new', 'Published baseline', '--standalone', '--reason', 'Private proof', '--body', 'Original instructions.', '--test-baseline', file, '--token', owner.token, '--url', 'http://127.0.0.1:' + app.server.address().port];
    const created = await execute(f.entry, args, { AGORA_AGENT_ID: owner.handle }, os.tmpdir()); assert.equal(created.code, 0, created.stdout + created.stderr);
    const task = app.store.listTasks()[0]; assert.equal(task.body, 'Original instructions.\n\n' + expected); assert.equal(task.creatorAgent.id, owner.id);
    const original = fs.readFileSync(file, 'utf8'); receipt.capturedAt -= 3 * 60 * 60 * 1000; fs.writeFileSync(file, JSON.stringify(receipt));
    const refused = await execute(f.entry, args, { AGORA_AGENT_ID: owner.handle }, os.tmpdir()); assert.equal(refused.code, 1); assert.match(refused.stdout, /No task was created/);
    assert.equal(app.store.listTasks().length, 1); fs.writeFileSync(file, original);
  } finally { await app.close(); f.cleanup(); }
});

test('WF-G352: actual immutable published CLI shows edit fields without rewriting task GET history', async () => {
  const f = fixture(), app = createAgoraServer({ dir: path.join(f.root, 'server'), seatRosterPath: null });
  try {
    await publishClient({ repoRoot: f.root }); await new Promise(resolve => app.listen(0, resolve));
    const owner = app.store.registerAgent({ handle: 'history-owner', petSlug: 'dream-girl' });
    const created = app.store.createTask({ agentId: owner.id, title: 'Original title', body: 'Original brief', refs: ['original-ref'] });
    assert.equal(app.store.editTask({ taskId: created.id, agentId: owner.id, fields: { title: 'Intermediate title', body: 'Revised brief', refs: ['revised-ref'] }, reason: 'Recorded authoring repair' }).ok, true);
    assert.equal(app.store.editTask({ taskId: created.id, agentId: owner.id, fields: { title: 'Latest title' }, reason: 'Later title only' }).ok, true);
    const base = 'http://127.0.0.1:' + app.server.address().port;
    const readTask = async () => { const response = await fetch(base + '/tasks/' + created.id); assert.equal(response.status, 200); return response.text(); };
    const before = await readTask();
    const result = await execute(f.entry, ['task', 'show', created.id, '--url', base, '--token', owner.token], { AGORA_AGENT_ID: owner.handle }, os.tmpdir());
    assert.equal(result.code, 0, result.stdout + result.stderr);
    const history = result.stdout.split('history (last 3):')[1]; assert.ok(history);
    assert.match(history, /edit fields: title, body, refs/); assert.match(history, /previous="Original title"/);
    assert.match(history, /previous="Intermediate title"/); assert.match(history, /edit-time new=not recorded/);
    assert.match(history, /current="Latest title" \(current snapshot, not edit-time\)/);
    assert.doesNotMatch(history, /\[object Object\]|edit-time new="Latest title"/);
    assert.equal(await readTask(), before, 'GET history and all task metadata remain byte-equivalent after inspection');
    assert.equal(app.store.listTasks().length, 1);
  } finally { await app.close(); f.cleanup(); }
});

test('WF-G212: actual published CLI distinguishes tracking text and untracked files without weakening conflicts', async () => {
  const f = fixture();
  const app = createAgoraServer({ dir: path.join(f.root, 'server'), seatRosterPath: null });
  try {
    const git = (...args) => execFileSync('git', ['-c', 'core.fsmonitor=false', ...args], { cwd: f.root, stdio: 'ignore' });
    git('init', '-q'); git('config', 'user.email', 'fixture@example.test'); git('config', 'user.name', 'Disposable fixture');
    fs.mkdirSync(path.join(f.root, 'src'));
    const base = '/**\n * Current unfinished intent.\n */\nexport const value = 1;\n';
    const tracked = path.join(f.root, 'src/tracked.ts'), untracked = path.join(f.root, 'src/new.ts');
    fs.writeFileSync(tracked, base); git('add', 'src/tracked.ts'); git('commit', '-qm', 'fixture baseline');
    const changed = base.replace(' */', ' * (tracked in Agora task agora-3098).\n */');
    fs.writeFileSync(tracked, changed); fs.writeFileSync(untracked, 'export {};\n');
    await publishClient({ repoRoot: f.root });
    await new Promise(resolve => app.listen(0, resolve));
    const owner = app.store.registerAgent({ handle: 'tracking-owner', petSlug: 'gf-sd' });
    const waiter = app.store.registerAgent({ handle: 'tracking-waiter', petSlug: 'dream-girl' });
    const call = (agent, args) => execute(f.entry, [...args, '--token', agent.token, '--url', 'http://127.0.0.1:' + app.server.address().port], { AGORA_AGENT_ID: agent.handle }, f.root);
    const granted = await call(owner, ['lock', 'src/tracked.ts', 'src/new.ts']);
    assert.equal(granted.code, 0, granted.stdout + granted.stderr);
    assert.match(granted.stdout, /src\/tracked\.ts.*tracking-marker text only.*agora-3098/);
    assert.match(granted.stdout, /src\/new\.ts is untracked before your lock.*git diff shows NOTHING/);
    assert.match(granted.stdout, /Git cannot identify who made the change/);
    assert.doesNotMatch(granted.stdout + granted.stderr, /sibling's in-flight work|run git diff/);
    const conflict = await call(waiter, ['lock', 'src/tracked.ts', 'src/new.ts']);
    assert.equal(conflict.code, 1); assert.match(conflict.stdout + conflict.stderr, /no locks acquired/i);
    assert.doesNotMatch(conflict.stdout + conflict.stderr, /tracking-marker text only/);
    assert.equal(app.store.listLocks().length, 1); assert.equal(app.store.listLocks()[0].agentId, owner.id);
    await call(owner, ['unlock', app.store.listLocks()[0].id]);
    fs.writeFileSync(tracked, changed.replace('value = 1', 'value = 2'));
    const ordinary = await call(waiter, ['lock', 'src/tracked.ts']);
    assert.equal(ordinary.code, 0, ordinary.stdout + ordinary.stderr);
    assert.match(ordinary.stdout, /preserve any existing changes/); assert.doesNotMatch(ordinary.stdout, /tracking-marker text only/);
    assert.equal(fs.readFileSync(tracked, 'utf8'), changed.replace('value = 1', 'value = 2'));
    assert.equal(fs.readFileSync(untracked, 'utf8'), 'export {};\n');
    await call(waiter, ['retire']); await call(owner, ['retire']); assert.equal(app.store.listLocks().length, 0);
  } finally { await app.close(); f.cleanup(); }
});

test('WF-G279: published entry warns on undeclared missing paths and accepts bounded creation intent', async () => {
  const f = fixture();
  const app = createAgoraServer({ dir: path.join(f.root, 'server'), seatRosterPath: null });
  try {
    const git = (...args) => execFileSync('git', args, { cwd: f.root, stdio: 'ignore' });
    git('init', '-q');
    git('config', 'user.email', 'fixture@example.test');
    git('config', 'user.name', 'Disposable fixture');
    fs.mkdirSync(path.join(f.root, 'src'));
    fs.writeFileSync(path.join(f.root, 'src/existing.ts'), 'export {};\n');
    git('add', 'src/existing.ts');
    git('commit', '-qm', 'fixture baseline');
    await publishClient({ repoRoot: f.root });
    await new Promise(resolve => app.listen(0, resolve));
    const agent = app.store.registerAgent({ handle: 'creation-fixture', petSlug: 'gf-sd' });
    const call = argv => execute(f.entry, [...argv, '--token', agent.token,
      '--url', 'http://127.0.0.1:' + app.server.address().port], { AGORA_AGENT_ID: 'creation-fixture' }, f.root);
    const normal = await call(['lock', 'src/ghost.ts']);
    assert.equal(normal.code, 0, normal.stdout + normal.stderr);
    assert.match(normal.stdout, /src\/ghost.ts.*does not exist.*WF-G279/);
    const idOnly = await call(['lock', 'src/id-ghost.ts', '--id-only']);
    assert.equal(idOnly.code, 0);
    assert.match(idOnly.stdout.trim(), /^[a-f0-9-]{36}$/);
    assert.match(idOnly.stderr, /WF-G279/);
    const intentional = await call(['lock', 'src/intentional.ts', '--creates', path.join(f.root, 'src/intentional.ts'), '--id-only']);
    assert.equal(intentional.code, 0, intentional.stdout + intentional.stderr);
    assert.match(intentional.stdout.trim(), /^[a-f0-9-]{36}$/);
    assert.doesNotMatch(intentional.stderr, /WF-G279|does not exist/);
    const partial = await call(['lock', 'src/new-one.ts', 'src/new-two.ts', '--partial',
      '--creates', 'src/new-one.ts', '--creates', 'src/new-two.ts']);
    assert.equal(partial.code, 0, partial.stdout + partial.stderr);
    assert.match(partial.stdout, /2 acquired/);
    assert.doesNotMatch(partial.stdout + partial.stderr, /WF-G279|does not exist/);
    const stale = await call(['lock', 'src/existing.ts', '--creates', 'src/existing.ts']);
    assert.equal(stale.code, 0);
    assert.match(stale.stdout, /already exists despite --creates/);
    const before = app.store.listLocks().length;
    for (const flags of [['--creates'], ['--creates', 'src/not-owned.ts'], ['--creates', 'src/*.ts'],
      ['--renew', idOnly.stdout.trim(), '--creates', 'src/id-ghost.ts']]) {
      const invalid = await call(['lock', 'src/invalid.ts', ...flags]);
      assert.equal(invalid.code, 1, invalid.stdout + invalid.stderr);
      assert.equal(app.store.listLocks().length, before, 'bad declaration sends no lock mutation');
    }
    assert.equal(fs.readFileSync(path.join(f.root, 'src/existing.ts'), 'utf8'), 'export {};\n');
    for (const name of ['ghost', 'id-ghost', 'intentional', 'new-one', 'new-two', 'invalid']) {
      assert.equal(fs.existsSync(path.join(f.root, 'src', name + '.ts')), false, 'intent never writes a file');
    }
  } finally { await app.close(); f.cleanup(); }
});

test('WF-G297: published client queues once and prints holder waiters plus durable availability', async () => {
  const f = fixture();
  const app = createAgoraServer({ dir: path.join(f.root, 'server'), seatRosterPath: null });
  try {
    await publishClient({ repoRoot: f.root });
    await new Promise(resolve => app.listen(0, resolve));
    const url = 'http://127.0.0.1:' + app.server.address().port;
    const env = handle => ({ AGORA_AGENT_ID: handle });
    const call = (handle, argv) => execute(f.entry, [...argv, '--url', url], env(handle), f.root);
    for (const [handle, pet] of [['published-holder', 'gf-sd'], ['published-waiter', 'dream-girl']]) {
      const result = await call(handle, ['register', handle, '--pet', pet]);
      assert.equal(result.code, 0, result.stdout + result.stderr);
    }
    assert.equal((await call('published-holder', ['lock', 'src/published-queue.ts'])).code, 0);
    const queued = await call('published-waiter', ['lock', '--queue', 'src/published-queue.ts', '--reason', 'published proof']);
    assert.equal(queued.code, 1);
    assert.match(queued.stdout, /Reservation queued:.*#1/);
    assert.equal(app.store.listReservations().length, 1);
    const beat = await call('published-holder', ['heartbeat', '--count', '1']);
    assert.equal(beat.code, 0, beat.stdout + beat.stderr);
    assert.match(beat.stdout, /FILE QUEUE: #1 published-waiter.*published proof/);
    const released = await call('published-holder', ['unlock', '--mine']);
    assert.equal(released.code, 0, released.stdout + released.stderr);
    assert.match(released.stdout, /published-waiter.*available to attempt, not locked/);
    const inbox = await call('published-waiter', ['inbox']);
    assert.match(inbox.stdout, /FILE QUEUE.*available to attempt/);
    assert.equal((await call('published-waiter', ['lock', 'src/published-queue.ts'])).code, 0);
    assert.equal(app.store.listReservations().length, 0);
  } finally { await app.close(); f.cleanup(); }
});

test('WF-G243: published client links a newly locked file to the real reaped worker trail', async () => {
  const f = fixture();
  let now = 5000000;
  const { createStore } = await import('./store.mjs');
  const app = createAgoraServer({ dir: path.join(f.root, 'server'), seatRosterPath: null,
    storeFactory: ({ dir }) => createStore({ dir, now: () => now, presenceTtlMs: 1000, presenceDropMs: 5000, seatRosterPath: null }) });
  try {
    await publishClient({ repoRoot: f.root });
    const doomed = app.store.registerAgent({ handle: 'published-doomed', petSlug: 'gf-sd' });
    const task = app.store.createTask({ agentId: doomed.id, title: 'Published recovery fixture' });
    app.store.claimTask({ taskId: task.id, agentId: doomed.id });
    app.store.acquireLock({ agentId: doomed.id, paths: ['src/interrupted.ts'] });
    now += 20000;
    app.store.sweepExpired();
    const reader = app.store.registerAgent({ handle: 'published-reader', petSlug: 'gf-sd' });
    await new Promise(resolve => app.listen(0, resolve));
    const result = await execute(f.entry, ['lock', 'src/interrupted.ts', '--id-only', '--token', reader.token,
      '--url', 'http://127.0.0.1:' + app.server.address().port], { AGORA_AGENT_ID: 'published-reader' }, os.tmpdir());
    assert.equal(result.code, 0, result.stdout + result.stderr);
    assert.match(result.stdout.trim(), /^[a-f0-9-]{36}$/);
    assert.match(result.stderr, /WF-G243.*reaped from published-doomed/);
    assert.ok(result.stderr.includes(`retrace ${task.id}`));
    assert.equal(app.store.listLocks().filter(l => l.agentId === reader.id).length, 1);
  } finally { await app.close(); f.cleanup(); }
});

test('WF-G288: published client lint reads the checkout schema, not its release directory or caller cwd', async () => {
  const f = fixture();
  const app = createAgoraServer({ dir: path.join(f.root, 'server') });
  try {
    const schema = path.join(f.root, 'public', 'planmap', 'topics.schema.json');
    fs.mkdirSync(path.dirname(schema), { recursive: true });
    fs.copyFileSync(path.join(here, '../../public/planmap/topics.schema.json'), schema);
    await publishClient({ repoRoot: f.root });
    const agent = app.store.registerAgent({ handle: 'roadmap-lint-fixture', petSlug: 'gf-sd' });
    const invalid = app.store.createTask({ agentId: agent.id, title: 'Invalid roadmap assignment fixture',
      body: 'Set Plan Map topic status to blocked.' });
    const valid = app.store.createTask({ agentId: agent.id, title: 'Valid roadmap assignment fixture',
      body: 'Set Plan Map topic status to active. Set Agora task status to blocked.' });
    await new Promise(resolve => app.listen(0, resolve));
    const url = 'http://127.0.0.1:' + app.server.address().port;
    const call = id => execute(f.entry, ['task', 'lint', id, '--url', url, '--token', agent.token],
      { AGORA_AGENT_ID: 'roadmap-lint-fixture' }, os.tmpdir());
    const rejected = await call(invalid.id);
    assert.equal(rejected.code, 1, rejected.stdout + rejected.stderr);
    assert.match(rejected.stdout, /INVALID PLAN MAP STATUS ASSIGNMENTS/);
    assert.match(rejected.stdout, /parked, specced, active, done, superseded/);
    const accepted = await call(valid.id);
    assert.equal(accepted.code, 0, accepted.stdout + accepted.stderr);
    assert.equal(app.store.listTasks().find(t => t.id === invalid.id).body, invalid.body, 'lint never rewrites the task');
  } finally { await app.close(); f.cleanup(); }
});

test('WF-G351: published lint distinguishes completed facts from creation intent without mutations', async () => {
  const f = fixture();
  const app = createAgoraServer({ dir: path.join(f.root, 'server'), seatRosterPath: null });
  try {
    fs.mkdirSync(path.join(f.root, 'src'));
    const present = path.join(f.root, 'src/present.ts');
    fs.writeFileSync(present, 'export const alreadyCreated = true;\n');
    const bytes = fs.readFileSync(present);
    const release = await publishClient({ repoRoot: f.root });
    const agent = app.store.registerAgent({ handle: 'marker-lint-fixture', petSlug: 'gf-sd' });
    const cases = [
      ['Completed facts', 'CREATED: src/present.ts\nCREATED FILE: src/present.ts', 0, /clean/, /STALE CREATES|NEW PATHS/],
      ['Future files', 'NEW FILES [reviewed]: src/new.ts\nCREATE (reviewed): src/other.ts', 0, /NEW PATHS \(2\)/],
      ['Stale future intent', 'CREATES (reviewed): src/present.ts', 1, /STALE CREATES \(1\)/],
      ['Missing completed fact', 'CREATED: src/missing.ts', 1, /MISSING PATHS \(1\)/, /NEW PATHS/],
    ];
    const tasks = cases.map(([title, body]) => app.store.createTask({ agentId: agent.id, title, body }));
    const before = structuredClone(app.store.listTasks());
    await new Promise(resolve => app.listen(0, resolve));
    const url = 'http://127.0.0.1:' + app.server.address().port;
    for (const [index, [, , code, required, forbidden]] of cases.entries()) {
      // Use another cwd so the immutable client must retain the checkout origin.
      const result = await execute(f.entry, ['task', 'lint', tasks[index].id, '--url', url, '--token', agent.token],
        { AGORA_AGENT_ID: 'marker-lint-fixture' }, os.tmpdir());
      assert.equal(result.code, code, result.stdout + result.stderr);
      assert.match(result.stdout, required);
      if (forbidden) assert.doesNotMatch(result.stdout, forbidden);
    }
    assert.deepEqual(app.store.listTasks(), before, 'lint preserves every body, state, and history');
    assert.deepEqual(fs.readFileSync(present), bytes);
    for (const file of ['new.ts', 'other.ts', 'missing.ts']) {
      assert.equal(fs.existsSync(path.join(f.root, 'src', file)), false, 'lint never creates a file');
    }
    assert.equal(clientReleaseStatus(f.root).id, release.id);
  } finally { await app.close(); f.cleanup(); }
});

test('WF-G240/245: parallel registrations and one task mutation survive torn source and helper writes', async () => {
  const f = fixture();
  const app = createAgoraServer({ dir: path.join(f.root, 'server'), campaignIntake: 'required' });
  let writer;
  try {
    const release = await publishClient({ repoRoot: f.root });
    fs.mkdirSync(path.join(f.root, 'src'));
    fs.writeFileSync(path.join(f.root, 'src', 'releaseTarget.ts'), 'export const releaseTarget = 1;\n');
    fs.mkdirSync(path.join(f.root, 'docs', 'projects', 'probe'), { recursive: true });
    fs.writeFileSync(path.join(f.root, 'docs', 'projects', 'probe', 'GAPS.md'),
      '| Gap ID | Status | Gap | Next action |\n|---|---|---|---|\n| GG-999 | open | Fixture gap | Verify checkout root |\n');
    await new Promise((resolve) => app.listen(0, resolve));
    const baseUrl = `http://127.0.0.1:${app.server.address().port}`;
    let turn = 0;
    writer = setInterval(() => {
      // Alternate an invalid parse with a valid but incomplete runtime. Neither
      // is eligible for publication simply because a worker arrives now.
      fs.writeFileSync(path.join(f.source, 'client-runtime.mjs'), ++turn % 2
        ? 'export async function run(\n'
        : 'export async function run() { classificationForSurface("x"); }\n');
      fs.writeFileSync(path.join(f.source, 'identity-policy.mjs'), 'export const halfWritten = ;\n');
    }, 5);
    const handles = ['release-probe-1', 'release-probe-2', 'release-probe-3'];
    const registered = await Promise.all(handles.map((handle) => execute(f.entry,
      ['register', handle, '--pet', 'gf-sd', '--url', baseUrl], { AGORA_AGENT_ID: handle }, f.root)));
    for (const result of registered) assert.equal(result.code, 0, result.stdout + result.stderr);
    const env = { AGORA_AGENT_ID: handles[0] };
    const creation = await execute(f.entry, ['task', 'new', 'Published client creates this task once',
      '--standalone', '--reason', 'isolated release fixture', '--body',
      'Verify that the published client performs exactly one task mutation while source is being written.',
      '--ref', 'src/releaseTarget.ts',
      '--url', baseUrl], env, f.root);
    assert.equal(creation.code, 0, creation.stdout + creation.stderr);
    const board = await (await fetch(`${baseUrl}/tasks`)).json();
    assert.equal(board.tasks.length, 1, 'no duplicated task event from a torn source read');
    const importedEntry = path.join(f.source, 'orchestrator-import-probe.mjs');
    fs.writeFileSync(importedEntry,
      'import {run} from "./client.mjs"; const r = await run(["tasks"], {baseUrl:process.argv[2]}); '
      + 'console.log(JSON.stringify({code:r.code,count:r.tasks.length})); process.exitCode=r.code;\n');
    const imported = await execute(importedEntry, [baseUrl], env, f.root);
    assert.equal(imported.code, 0, imported.stderr);
    assert.equal(JSON.parse(imported.stdout).count, 1, 'orchestrator-style imports use the protected entry too');
    const lint = await execute(f.entry, ['task', 'lint', board.tasks[0].id, '--url', baseUrl], env, f.root);
    assert.equal(lint.code, 0, lint.stdout + lint.stderr);
    const intake = await execute(f.entry, ['onboard', 'release-intake', '--pet', 'gf-sd',
      '--gaps', 'docs/projects', '--url', baseUrl], { AGORA_AGENT_ID: 'release-intake' }, f.root);
    assert.equal(intake.code, 0, intake.stdout + intake.stderr);
    assert.match(intake.stdout, /1 open gap\(s\)/, 'intake reads the checkout, not the snapshot directory');
    const who = await execute(f.entry, ['whoami', '--live', '--url', baseUrl], env, f.root);
    assert.equal(who.code, 0, who.stdout + who.stderr);
    assert.match(who.stdout, /current \(online\)/);
    assert.ok(fs.existsSync(path.join(f.root, '.agent', 'agora', `client-identity.${handles[0]}.json`)));
    assert.equal(fs.existsSync(path.join(release.directory, '.agent')), false, 'snapshot does not redirect identity storage');
    assert.equal(clientReleaseStatus(f.root).id, release.id, 'source changes never promote themselves');
  } finally {
    clearInterval(writer);
    await app.close();
    f.cleanup();
  }
});

test('a rejected syntax or missing-export publication preserves the working release', async () => {
  const f = fixture();
  try {
    const original = await publishClient({ repoRoot: f.root });
    fs.writeFileSync(path.join(f.source, 'client-runtime.mjs'), 'export const broken = ;\n');
    await assert.rejects(publishClient({ repoRoot: f.root }));
    assert.equal(clientReleaseStatus(f.root).id, original.id);
    fs.writeFileSync(path.join(f.source, 'client-runtime.mjs'), 'export async function run() {}\n');
    await assert.rejects(publishClient({ repoRoot: f.root }));
    assert.equal(clientReleaseStatus(f.root).id, original.id);
    const helpers = await Promise.all([1, 2, 3].map(() => execute(f.entry, ['help'], {}, f.root)));
    for (const help of helpers) assert.equal(help.code, 0, help.stderr);
    assert.match(helpers[0].stdout, /Usage: node tools\/agora\/client.mjs/);
  } finally { f.cleanup(); }
});

test('source changing during validation is not published', async () => {
  const f = fixture();
  let writer;
  try {
    const original = await publishClient({ repoRoot: f.root });
    // A separate process can write while the publisher's synchronous Node
    // syntax/import checks run. Wait for the staging directory, not a timer guess.
    const code = `const fs=require('node:fs');const path=require('node:path');`
      + `const root=${JSON.stringify(f.root)}, source=${JSON.stringify(f.source)};`
      + `const timer=setInterval(()=>{if(fs.readdirSync(path.join(root,'.agent','agora','client-releases'))`
      + `.some(n=>n.startsWith('.staging-'))){fs.appendFileSync(path.join(source,'client-runtime.mjs'),`
      + `${JSON.stringify('\n// changed during publication\n')});clearInterval(timer);}},5);console.log('ready');`;
    writer = spawn(process.execPath, ['-e', code], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((resolve, reject) => {
      writer.stdout.once('data', resolve);
      writer.once('error', reject);
      writer.once('close', (code) => { if (code) reject(new Error('fixture writer failed')); });
    });
    await assert.rejects(publishClient({ repoRoot: f.root }), /source changed during publish/);
    assert.equal(clientReleaseStatus(f.root).id, original.id);
  } finally { writer?.kill(); f.cleanup(); }
});

test('WF-G245: a runtime error after a successful mutation is returned once, never retried', async () => {
  const f = fixture();
  let requests = 0;
  const server = http.createServer((_request, response) => { requests++; response.end('stored'); });
  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}/mutation`;
    // Deliberately publish a faulty test-only command with the complete API.
    // Publication checks modules/exports, not every command's business behavior.
    const helpers = CLIENT_EXPORTS.filter((key) => key !== 'run')
      .map((key) => `export function ${key}() {}`).join('\n');
    fs.writeFileSync(path.join(f.source, 'client-runtime.mjs'), helpers
      + '\nexport async function run(argv) { await fetch(argv[0], {method:"POST"}); throw new ReferenceError("classificationForSurface is not defined"); }\n');
    await publishClient({ repoRoot: f.root });
    const result = await execute(f.entry, [url], {}, f.root);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /not retried.*classificationForSurface/);
    assert.equal(requests, 1, 'the launcher does not duplicate a mutation after an error');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    f.cleanup();
  }
});

test('a clean clone bootstraps committed bytes even when its worktree runtime is broken', async () => {
  const f = fixture();
  try {
    const git = (args) => execFileSync('git', ['-c', 'core.fsmonitor=false', ...args], {
      cwd: f.root, stdio: ['ignore', 'pipe', 'pipe'],
    });
    git(['init', '-q']);
    git(['add', 'tools']);
    git(['-c', 'user.name=Release Fixture', '-c', 'user.email=fixture@example.invalid',
      '-c', 'core.hooksPath=', 'commit', '-qm', 'fixture known-good client']);
    fs.writeFileSync(path.join(f.source, 'client-runtime.mjs'), 'export const midEdit = ;\n');
    const helpers = await Promise.all([1, 2, 3].map(() => execute(f.entry, ['help'], {}, f.root)));
    for (const help of helpers) assert.equal(help.code, 0, help.stderr);
    assert.match(clientReleaseStatus(f.root).manifest.source, /^git:[a-f0-9]{40}$/);
    assert.match(helpers[0].stdout, /Usage: node tools\/agora\/client.mjs/);
  } finally { f.cleanup(); }
});

test('a damaged release fails closed rather than using mutable source or a traversal pointer', async () => {
  const f = fixture();
  try {
    const release = await publishClient({ repoRoot: f.root });
    fs.appendFileSync(path.join(release.directory, 'client-runtime.mjs'), '\n// cache corruption\n');
    const result = await execute(f.entry, ['help'], {}, f.root);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /published client release is damaged/);
    fs.writeFileSync(path.join(f.root, '.agent', 'agora', 'client-current.json'), JSON.stringify({version:1,id:'../escape'}));
    assert.throws(() => clientReleaseStatus(f.root), /invalid client release pointer/);
  } finally { f.cleanup(); }
});
