// tools/agora/client.test.mjs
// Tests for the Agora client CLI. Node built-in runner only:
//   node --test "tools/agora/*.test.mjs"
//
// Boots the REAL server in-process (createAgoraServer) on an ephemeral port in a
// fresh temp dir, points the client at it via an explicit baseUrl + AGORA_DIR env
// (so identity persistence uses the temp dir, not the repo's .agent/agora), and
// drives the happy path by calling run() directly — no subprocesses.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createAgoraServer } from './server.mjs';
import { run } from './client.mjs';
// Candidate implementations run only against private servers, never live
// coordination. Published-entry fixtures separately verify fleet delivery.
import { run as runCandidate } from './client-runtime.mjs';
import { createStore } from './store.mjs';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { buildPrompt } from './orchestrate.mjs';

// WF-G260: the recoverable baseline must be current dirty bytes, not Git HEAD.
// All corruption and restoration in this test stay in a disposable repository.
test('WF-G260: a granted file lock records current bytes and restores only its reviewed target',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'agora-lock-baseline-'));
  const app=createAgoraServer({dir:path.join(root,'state'),seatRosterPath:null});
  const current=Buffer.from('dirty peer work\r\nkept at grant\r\n'),bad=Buffer.from('corrupt edit'),sibling='unchanged sibling';
  try{
    execFileSync('git',['init','-q',root]);fs.writeFileSync(path.join(root,'.gitignore'),'.agent/\n');
    fs.writeFileSync(path.join(root,'owned.txt'),current);fs.writeFileSync(path.join(root,'sibling.txt'),sibling);
    await new Promise(resolve=>app.listen(0,resolve));
    const options={baseUrl:'http://127.0.0.1:'+app.server.address().port,repoRoot:root,env:{AGORA_DIR:path.join(root,'.agent/identity'),AGORA_AGENT_ID:'restore-fixture'}};
    assert.equal((await runCandidate(['register','restore-fixture','--pet','dream-girl'],options)).code,0);
    const granted=await runCandidate(['lock','owned.txt','--reason','Disposable recovery proof'],options);assert.equal(granted.code,0);
    assert.ok(granted.snapshot,'successful lock must capture its current file baseline');
    fs.writeFileSync(path.join(root,'owned.txt'),bad);
    const review=await runCandidate(['lock','--restore','owned.txt'],options);assert.equal(review.code,1,'inspection alone cannot overwrite');
    assert.deepEqual(fs.readFileSync(path.join(root,'owned.txt')),bad);
    assert.match(review.lines.join('\n'),/expect-current/);
    const hash=(await import('node:crypto')).createHash('sha256').update(bad).digest('hex');
    const restored=await runCandidate(['lock','--restore','owned.txt','--expect-current',hash],options);assert.equal(restored.code,0,restored.lines.join('\n'));
    assert.deepEqual(fs.readFileSync(path.join(root,'owned.txt')),current);assert.equal(fs.readFileSync(path.join(root,'sibling.txt'),'utf8'),sibling);
    assert.equal(app.store.listLocks().length,1,'restore alone retains the lock');
  }finally{await app.close();assert.equal(path.dirname(root),path.resolve(os.tmpdir()));assert.match(path.basename(root),/^agora-lock-baseline-/);fs.rmSync(root,{recursive:true,force:true});}
});

for(const misplaced of ['restore','lock-id'])test('WF-G260: misplaced --'+misplaced+' cannot become release-all',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'agora-recovery-flags-')),app=createAgoraServer({dir:path.join(dir,'state'),seatRosterPath:null});
  try{
    await new Promise(resolve=>app.listen(0,resolve));const options={baseUrl:'http://127.0.0.1:'+app.server.address().port,env:{AGORA_DIR:path.join(dir,'identity'),AGORA_AGENT_ID:'misplaced-fixture'}};
    assert.equal((await runCandidate(['register','misplaced-fixture','--pet','dream-girl'],options)).code,0);
    const owner=app.store.listAgents().find(agent=>agent.handle==='misplaced-fixture');assert.ok(owner);
    const locks=['owned.txt','sibling.txt'].map(file=>app.store.acquireLock({agentId:owner.id,paths:[file]}).lock);
    const lockState=()=>JSON.stringify(app.store.listLocks().map(({holderIdleMs,...lock})=>lock));const before=lockState();
    const reply=await runCandidate(['unlock','--'+misplaced,misplaced==='restore'?'owned.txt':locks[0].id],options);
    assert.equal(reply.code,1,reply.lines.join('\n'));assert.equal(lockState(),before);
  }finally{await app.close();assert.equal(path.dirname(dir),fs.realpathSync(os.tmpdir()));assert.match(path.basename(dir),/^agora-recovery-flags-/);fs.rmSync(dir,{recursive:true,force:true});}
});

for(const alias of ['absolute','case','recursive-glob','question-glob'])test('WF-G260: fresh peer overlap '+alias+' refuses recovery before any write',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'agora-peer-recovery-')),app=createAgoraServer({dir:path.join(root,'state'),seatRosterPath:null});
  try{
    execFileSync('git',['init','-q',root]);fs.writeFileSync(path.join(root,'.gitignore'),'.agent/\n');fs.writeFileSync(path.join(root,'owned.txt'),'grant-time peer bytes');
    await new Promise(resolve=>app.listen(0,resolve));const options={baseUrl:'http://127.0.0.1:'+app.server.address().port,repoRoot:root,env:{AGORA_DIR:path.join(root,'.agent/identity'),AGORA_AGENT_ID:'peer-guard-fixture'}};
    const registered=await runCandidate(['register','peer-guard-fixture','--pet','dream-girl'],options);assert.equal(registered.code,0);const granted=await runCandidate(['lock','owned.txt'],options);assert.equal(granted.code,0);
    const peer={id:'foreign',agentId:'peer',paths:[],globs:[]};
    if(alias==='absolute')peer.paths=[path.join(root,'owned.txt')];
    if(alias==='case')peer.paths=[process.platform==='win32'?'OWNED.TXT':'owned.txt'];
    if(alias==='recursive-glob')peer.globs=['**/owned.txt'];
    if(alias==='question-glob')peer.globs=['owne?.txt'];
    // A conflicting fresh board observation is modeled without granting an
    // impossible second lock through the real daemon's acquisition invariant.
    const locks=[...app.store.listLocks(),peer],calls=[];app.server.removeAllListeners('request');
    app.server.on('request',(req,res)=>{calls.push(req.method);res.setHeader('Content-Type','application/json');res.end(JSON.stringify(req.url==='/agents/me'?{agent:{id:registered.identity.agentId}}:{locks}));});
    const bad=Buffer.from('fixture bad edit');fs.writeFileSync(path.join(root,'owned.txt'),bad);const expected=(await import('node:crypto')).createHash('sha256').update(bad).digest('hex');
    const result=await runCandidate(['lock','--restore','owned.txt','--expect-current',expected],options);
    assert.equal(result.code,1,result.lines.join('\n'));assert.deepEqual(fs.readFileSync(path.join(root,'owned.txt')),bad);assert.ok(calls.every(method=>method==='GET'));
  }finally{await app.close();assert.equal(path.dirname(root),fs.realpathSync(os.tmpdir()));assert.match(path.basename(root),/^agora-peer-recovery-/);fs.rmSync(root,{recursive:true,force:true});}
});

test('WF-G285: legacy daemon show/list/lint warn from full cross-campaign completion board without writes', async () => {
  const tasks=[{id:'count-target',title:'Count sweep',body:'Review work.',state:'open',ready:true,createdAt:10,refs:['tools/agora/store.mjs'],history:[],campaignId:'target-campaign'},
    {id:'count-source',title:'Sibling handler fix',body:'Private proof',state:'open',createdAt:1,refs:['tools/agora/store.mjs'],history:[{action:'state',state:'done',at:20},{action:'state',state:'open',at:30}],campaignId:'other-campaign'}];
  const before=JSON.stringify(tasks),methods=[];
  const server=createServer((req,res)=>{methods.push([req.method,req.url]); res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify(req.url==='/agents'?{agents:[]}:req.url==='/tasks?ready=1'?{tasks:[tasks[0]]}:{tasks}));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const options={baseUrl:'http://127.0.0.1:'+server.address().port,env:{}};
    for(const args of [['task','show','count-target'],['tasks','--ready'],['tasks','--state','open'],['task','lint','count-target']]) {
      const reply=await runCandidate([...args,'--token','private-fixture'],options); assert.match(reply.lines.join('\n'),/COUNTS UNVERIFIED.*count-source/);
      if(args.includes('lint')){assert.equal(reply.code,1);assert.equal(reply.lint.referenceFreshness.status,'unverified');}
      else assert.equal(reply.code,0);
    }
    assert.equal(JSON.stringify(tasks),before); assert.ok(methods.every(x=>x[0]==='GET'));
    assert.ok(methods.some(x=>x[1]==='/tasks?ready=1')); assert.ok(methods.filter(x=>x[1]==='/tasks').length>=4);
  } finally {await new Promise(resolve=>server.close(resolve));}
});

test('WF-G284: intake preserves instructions and refuses invalid baselines before task creation', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-baseline-intake-'));
  const app = createAgoraServer({ dir: path.join(dir, 'state'), seatRosterPath: null });
  try {
    await new Promise(resolve => app.listen(0, resolve));
    const owner = app.store.registerAgent({ handle: 'baseline-owner', petSlug: 'dream-girl' });
    const { captureTestBaseline } = await import('./testBaseline.mjs');
    const root = path.resolve('tools/agora/../..'), start = Date.now() - 1000;
    const report = { startTime: start, success: false, numPendingTestSuites: 0, numTotalTests: 1, numFailedTests: 1, numPassedTests: 0,
      testResults: [{ name: path.join(root, 'tools/agora/client.test.mjs'), endTime: start + 10, status: 'failed', message: '', assertionResults: [{ fullName: 'known failing case', status: 'failed', failureMessages: ['existing diagnostic'] }] }] };
    const receipt = captureTestBaseline(report, { repoRoot: root, command: 'node --test tools/agora/client.test.mjs' });
    const file = path.join(dir, 'baseline.json'); fs.writeFileSync(file, JSON.stringify(receipt));
    const call = args => runCandidate(['task', 'new', 'Baseline intake', '--standalone', '--reason', 'Private fixture', '--token', owner.token, ...args], { baseUrl: 'http://127.0.0.1:' + app.server.address().port, env: {} });
    const created = await call(['--body', 'Original work instructions.', '--test-baseline', file]); assert.equal(created.code, 0);
    assert.ok(created.task.body.startsWith('Original work instructions.\n\nTEST BASELINE')); assert.match(created.task.body, /known failing case/);
    assert.equal(created.task.creatorAgent.id, owner.id);
    for (const args of [['--test-baseline', file], ['--body', 'Work', '--test-baseline'], ['--body', 'Work', '--test-baseline', path.join(dir, 'missing.json')]]) {
      const refused = await call(args); assert.equal(refused.code, 1); assert.match(refused.lines.join('\n'), /No task was created/);
    }
    receipt.capturedAt -= 3 * 60 * 60 * 1000; fs.writeFileSync(file, JSON.stringify(receipt));
    assert.equal((await call(['--body', 'Work', '--test-baseline', file])).code, 1); assert.equal(app.store.listTasks().length, 1);
  } finally { await app.close(); assert.equal(path.dirname(dir), path.resolve(os.tmpdir())); fs.rmSync(dir, { recursive: true, force: true }); }
});

// History fixtures prove presentation only. No task is edited by inspection.
test('WF-G352: named edit fields retain historical provenance and scalar transitions', async () => {
  const task = { id: 'history-fixture', title: 'Latest title', state: 'claimed', body: 'Latest brief', refs: ['latest-ref'], priority: 2,
    history: [
      { at: 1, by: 'writer', action: 'edit', fields: ['title', 'body', 'refs'], from: { title: 'Original title', body: 'Original brief', refs: ['original-ref'] } },
      { at: 2, by: 'writer', action: 'edit', fields: ['title'], from: { title: 'Intermediate title' } },
      { at: 3, by: 'writer', action: 'edit', fields: ['priority', 'design', 'flag'], from: { priority: 0, design: null, flag: false }, to: { priority: 1, design: 'Recorded design', flag: true } },
      { at: 4, by: 'writer', action: 'campaign', from: 'standalone', to: 'fixture-campaign' },
      { at: 5, by: 'writer', action: 'state', from: 'open', state: 'claimed' },
    ] };
  const before = JSON.stringify(task), methods = [];
  const server = createServer((req, res) => { methods.push(req.method); res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(req.url === '/agents' ? { agents: [] } : req.url === '/tasks' ? { tasks: [task] } : { task })); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const result = await runCandidate(['task', 'show', task.id, '--token', 'fixture'], { baseUrl: 'http://127.0.0.1:' + server.address().port, env: {} });
    assert.equal(result.code, 0); const text = result.lines.join('\n').split('history (last 5):')[1];
    assert.match(text, /edit fields: title, body, refs/);
    assert.match(text, /title: previous="Original title"; edit-time new=not recorded/);
    assert.match(text, /current="Latest title" \(current snapshot, not edit-time\)/);
    assert.match(text, /title: previous="Intermediate title"/); assert.doesNotMatch(text, /edit-time new="Latest title"/);
    assert.match(text, /refs: previous=\["original-ref"\]/);
    assert.match(text, /priority: previous=0; edit-time new=1/);
    assert.match(text, /design: previous=null; edit-time new="Recorded design"/);
    assert.match(text, /flag: previous=false; edit-time new=true/);
    assert.match(text, /campaign from standalone -> fixture-campaign/); assert.match(text, /state from open -> claimed/);
    assert.doesNotMatch(text, /\[object Object\]/); assert.equal(JSON.stringify(task), before); assert.deepEqual(result.task, task);
    assert.ok(methods.length); assert.ok(methods.every(method => method === 'GET'));
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('WF-G352: history previews bound long values and preserve legacy structured entries', async () => {
  const from = { body: 'old\n\x1b[31m\u202e' + 'x'.repeat(50000), refs: [{ ref: 'a'.repeat(50000) }] };
  const fields = ['body', 'refs', ...Array.from({ length: 10 }, (_, index) => 'legacy-' + index)];
  const task = { id: 'bounded-history', title: 'Bounded history', state: 'open', body: 'Current brief', refs: [], history: [
    { at: 1, action: 'edit', fields, from, reason: 'r'.repeat(50000) },
    { at: 2, action: 'legacy', from: { prior: false }, to: [{ next: 0 }] },
    { at: 3, action: 'legacy-null', from: null, to: false },
    { at: 4, action: 'legacy-zero', from: 0, to: 0 },
    { at: 5, action: 'legacy-target-null', from: false, to: null },
  ] };
  const before = JSON.stringify(task);
  const server = createServer((req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(req.url === '/agents' ? { agents: [] } : req.url === '/tasks' ? { tasks: [task] } : { task })); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const result = await runCandidate(['task', 'show', task.id, '--token', 'fixture'], { baseUrl: 'http://127.0.0.1:' + server.address().port, env: {} });
    assert.equal(result.code, 0); const history = result.lines.join('\n').split('history (last 5):')[1];
    assert.ok(history.length < 5000); assert.match(history, /\[truncated\]/); assert.match(history, /4 additional edited field\(s\) not shown/);
    assert.match(history, /legacy from \{"prior":false\} -> \[\{"next":0\}\]/);
    assert.match(history, /legacy-null from null -> false/); assert.match(history, /legacy-zero from 0 -> 0/);
    assert.match(history, /legacy-target-null from false -> null/);
    assert.ok(!history.includes('\x1b') && !history.includes('\u202e')); assert.doesNotMatch(history, /\[object Object\]/);
    assert.equal(JSON.stringify(task), before); assert.deepEqual(result.task, task);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('WF-G297: queued CLI conflicts, holder heartbeat/unlock and waiter inbox form one real HTTP flow', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-queue-cli-'));
  const fixture = createAgoraServer({ dir: path.join(dir, 'state'), seatRosterPath: null });
  try {
    await new Promise(resolve => fixture.listen(0, resolve));
    const url = 'http://127.0.0.1:' + fixture.server.address().port;
    const call = (handle, argv) => runCandidate(argv, { baseUrl: url,
      env: { AGORA_DIR: path.join(dir, 'identity'), AGORA_AGENT_ID: handle } });
    for (const [handle, pet] of [['queue-holder', 'gf-sd'], ['queue-first', 'dream-girl'], ['queue-second', 'cyberman']]) {
      assert.equal((await call(handle, ['register', handle, '--pet', pet])).code, 0);
    }
    const file = 'src/__queue_cli_probe__.ts';
    const held = await call('queue-holder', ['lock', file, 'src/__queue_cli_kept__.ts']);
    assert.equal(held.code, 0);
    const queued = await call('queue-first', ['lock', '--queue', file, '--reason', 'fixture repair']);
    assert.equal(queued.code, 1, 'a queued conflict is still a failed lock');
    assert.match(queued.lines.join('\n'), /Reservation queued:.*#1/);
    assert.match(queued.lines.join('\n'), /Queueing is not edit permission/);
    await call('queue-second', ['lock', file, '--queue', '--reason', 'follow-up repair']);
    const again = await call('queue-first', ['lock', file, '--queue']);
    assert.equal(again.code, 1);
    assert.match(again.lines.join('\n'), /Existing reservation retained/);
    assert.equal(fixture.store.listReservations().length, 2);
    assert.equal(fixture.store.listLocks().length, 1, 'no hidden grant in a queued conflict');
    const heartbeat = await call('queue-holder', ['heartbeat', '--count', '1']);
    assert.equal(heartbeat.code, 0);
    assert.match(heartbeat.lines.join('\n'), /FILE QUEUE: #1 queue-first.*fixture repair/);
    assert.match(heartbeat.lines.join('\n'), /FILE QUEUE: #2 queue-second.*follow-up repair/);
    const unlock = await call('queue-holder', ['unlock', file]);
    assert.equal(unlock.code, 0);
    assert.match(unlock.lines.join('\n'), /queue-first.*available to attempt, not locked/);
    assert.deepEqual(fixture.store.listLocks()[0].paths, ['src/__queue_cli_kept__.ts']);
    const inbox = await call('queue-first', ['inbox']);
    assert.match(inbox.lines.join('\n'), /FILE QUEUE.*available to attempt/);
    const first = await call('queue-first', ['lock', file]);
    assert.equal(first.code, 0);
    const finalRelease = await call('queue-first', ['unlock', first.lock.id]);
    assert.match(finalRelease.lines.join('\n'), /queue-second.*available to attempt, not locked/);
    const second = await call('queue-second', ['lock', file]);
    assert.equal(second.code, 0);
    assert.equal(fixture.store.listReservations().length, 0);
    // Partial mode queues only the reported conflict and retains its explicit
    // ACQUIRED targets; queue admission cannot change the incomplete exit code.
    const partial = await call('queue-first', ['lock', file, 'src/__queue_cli_free__.ts', '--partial', '--queue']);
    assert.equal(partial.code, 1);
    assert.equal(partial.locks.length, 1);
    assert.deepEqual(partial.locks[0].paths, ['src/__queue_cli_free__.ts']);
    assert.deepEqual(fixture.store.listReservations()[0].paths, [file]);
    const atomic = await call('queue-holder', ['lock', file, 'src/__queue_cli_atomic__.ts', '--queue']);
    assert.equal(atomic.code, 1);
    assert.equal(fixture.store.listLocks().some(l => l.paths.includes('src/__queue_cli_atomic__.ts')), false);
    assert.equal(fixture.store.listReservations().some(r => r.paths.includes('src/__queue_cli_atomic__.ts')), false);
  } finally {
    await fixture.close();
    assert.equal(path.dirname(dir), path.resolve(os.tmpdir()));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('WF-G297: queue failures never retry mutations and old daemons do not claim live notification delivery', async () => {
  for (const mode of ['unknown-reservation', 'failed-lock', 'legacy-daemon']) {
    let locks = 0;
    let reservations = 0;
    const fixture = createServer((req, res) => {
      res.setHeader('content-type', 'application/json');
      if (req.url === '/locks') {
        locks++;
        res.writeHead(mode === 'failed-lock' ? 500 : 409);
        res.end(JSON.stringify(mode === 'failed-lock' ? { error: 'lock unavailable' }
          : { conflict: { path: 'src/uncertain-queue.ts', heldBy: 'fixture-holder' } }));
      } else if (req.url === '/reservations') {
        reservations++;
        if (mode === 'unknown-reservation') res.destroy(); // mutation accepted, response lost
        else { res.writeHead(201); res.end(JSON.stringify({ reservation: { id: 'legacy-queue', position: 1, paths: ['src/uncertain-queue.ts'] } })); }
      } else res.end(JSON.stringify({ agents: [] }));
    });
    await new Promise(resolve => fixture.listen(0, '127.0.0.1', resolve));
    try {
      const result = await runCandidate(['lock', '--queue', 'src/uncertain-queue.ts', '--token', 'fixture'],
        { baseUrl: 'http://127.0.0.1:' + fixture.address().port, env: {} });
      assert.equal(result.code, 1);
      assert.equal(locks, 1);
      assert.equal(reservations, mode === 'failed-lock' ? 0 : 1);
      if (mode === 'unknown-reservation') assert.match(result.stderrLines.join('\n'), /queue outcome is unknown.*Inspect reservations before repeating/);
      if (mode === 'legacy-daemon') assert.match(result.stderrLines.join('\n'), /does not advertise file notifications/);
    } finally { await new Promise(resolve => fixture.close(resolve)); }
  }
});

test('WF-G251/WF-G252: generated overflow creates a blocked linked review without changing legacy parent membership or file access', async () => {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-overflow-contract-'));
  const fixture = createAgoraServer({ dir: path.join(fixtureDir, 'state'), seatRosterPath: null });
  try {
    await new Promise(resolve => fixture.listen(0, resolve));
    const baseUrl = 'http://127.0.0.1:' + fixture.server.address().port;
    const worker = fixture.store.registerAgent({ handle: 'overflow-worker', petSlug: 'dream-girl', sessionId: 'overflow-worker-session' });
    const lead = fixture.store.registerAgent({ handle: 'overflow-lead', role: 'orchestrator', petSlug: 'gf-sd', sessionId: 'overflow-lead-session' });
    const parent = fixture.store.createTask({ agentId: worker.id, title: 'Legacy repair fixture', body: 'DO: tools/agora/AGENT.md' });
    const membership = { campaignId: parent.campaignId, membership: parent.membership, decision: structuredClone(parent.campaignDecision) };
    const campaign = fixture.store.claimCampaign({ agentId: lead.id, campaignId: 'overflow-fixture',
      paths: ['tools/agora/AGENT.md'], scope: 'Disposable ownership contract fixture' });
    assert.equal(campaign.ok, true);
    const packet = { id: 'PK-overflow', handle: worker.handle, pet: 'dream-girl', agent: 'codex',
      scope: 'Parent owns only AGENT.md', files: ['tools/agora/AGENT.md'] };
    const prompt = buildPrompt({ wave: 'overflow-fixture', baseUrl, campaign: { id: 'overflow-fixture' } }, packet, { taskId: parent.id });
    const options = { env: { AGORA_DIR: path.join(fixtureDir, 'identity'), AGORA_AGENT_ID: worker.handle }, baseUrl };
    const call = args => run([...args, '--token', worker.token], options);
    const shown = await call(['task', 'show', parent.id]);
    assert.match(shown.lines.join('\n'), /NONE RECORDED/);
    assert.match(shown.lines.join('\n'), /workers should ask one/);
    assert.equal((await call(['task', 'claim', parent.id])).code, 0);
    const fill = line => line.replace(/<[^>]+>/g, match => ({
      '<extra file>': 'tools/agora/PROTOCOL.md', '<extra repo-relative file>': 'tools/agora/PROTOCOL.md',
      '<change and evidence>': 'Add verified API contract after parent ownership review', '<holder or none>': 'none',
      '<proof>': 'Protocol review and focused tests', '<slice>': 'owned-file proof complete',
      '<acceptance proof>': 'cross-file protocol acceptance',
    })[match] || match);
    const argsFor = (marker, replacements = {}) => {
      let line = fill(prompt.split('\n').find(item => item.includes(marker)));
      for (const [from, to] of Object.entries(replacements)) line = line.replaceAll(from, to);
      const command = line.slice(line.indexOf('client.mjs') + 'client.mjs'.length);
      return [...command.matchAll(/"([^"]*)"|([^\s]+)/g)].map(match => match[1] ?? match[2]);
    };
    const created = await call(argsFor('task new "Ownership review'));
    assert.equal(created.code, 0, created.lines.join('\n'));
    const followup = created.task;
    assert.equal(followup.campaignId, campaign.campaign.id);
    assert.equal(followup.creatorAgent.id, worker.id);
    assert.equal(followup.creatorAgent.sessionId, 'overflow-worker-session');
    assert.deepEqual(followup.deps, [{ id: parent.id, type: 'discovered-from' }]);
    assert.ok(fixture.store.listTasks({ ready: true }).some(task => task.id === followup.id), 'origin is not a completion gate');
    const blockedReview = await call(argsFor('task state "FOLLOWUP_TASK_ID_HERE"', { FOLLOWUP_TASK_ID_HERE: followup.id }));
    assert.equal(blockedReview.code, 0, blockedReview.lines.join('\n'));
    const blockedParent = await call(argsFor('task state "' + parent.id + '"', { FOLLOWUP_TASK_ID_HERE: followup.id }));
    assert.equal(blockedParent.code, 0, blockedParent.lines.join('\n'));
    const tasks = fixture.store.listTasks();
    const finalParent = tasks.find(task => task.id === parent.id);
    assert.equal(finalParent.state, 'blocked');
    assert.equal(tasks.find(task => task.id === followup.id).state, 'blocked');
    assert.deepEqual({ campaignId: finalParent.campaignId, membership: finalParent.membership, decision: finalParent.campaignDecision }, membership);
    assert.deepEqual(fixture.store.listLocks(), [], 'proposal never grants the extra file or mutates locks');
    const parentProof = await call(['task', 'show', parent.id]);
    assert.ok(parentProof.lines.some(line => line.includes('blocked reason:') && line.includes(followup.id)));
  } finally {
    await fixture.close();
    assert.ok(path.resolve(fixtureDir).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test('WF-G187/WF-G215/WF-G216: generated filing and immediate update preserve complete feedback', async () => {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-generated-feedback-'));
  const repoRoot = path.join(fixtureDir, 'repo');
  const registry = path.join(repoRoot, 'tools', 'agora', 'WORKFLOW_GAPS.md');
  fs.mkdirSync(path.dirname(registry), { recursive: true });
  // Intake writes only this disposable registry, never the shared live board.
  fs.writeFileSync(registry, [
    '---', 'schema_version: 1', 'id_prefix: WF-G', 'next_free_id: WF-G1', '---', '', '## Registry', '',
    '| Gap ID | Status | Severity | Classification | Surface | Registered by | Suggested agent | Registrant ID | Task/thread | Date | Gap | Evidence | Why it matters | Next action | Next proof | Notes |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|', '',
  ].join('\n'));
  const fixture = createAgoraServer({ dir: path.join(fixtureDir, 'state'), gapsRepoRoot: repoRoot, seatRosterPath: null });
  try {
    await new Promise(resolve => fixture.listen(0, resolve));
    const baseUrl = 'http://127.0.0.1:' + fixture.server.address().port;
    const owner = fixture.store.registerAgent({ handle: 'feedback-fixture', petSlug: 'dream-girl', sessionId: 'feedback-session' });
    const task = fixture.store.createTask({ agentId: owner.id, title: 'Generated feedback fixture',
      standalone: true, standaloneReason: 'Disposable command acceptance fixture' });
    const packet = { id: 'PK-feedback', handle: owner.handle, pet: 'dream-girl', agent: 'codex',
      scope: 'Feedback fixture only', files: ['tools/agora/AGENT.md'] };
    const prompt = buildPrompt({ wave: 'feedback-fixture', baseUrl }, packet, { taskId: task.id });
    const replacements = {
      '<workflow defect>': 'Generated fixture packet feedback needs a complete contract',
      '<observed evidence>': 'Disposable generated command fixture', '<impact>': 'Avoid first-send refusals',
      '<repair>': 'Use the reviewed packet template', '<next proof>': 'Generated feedback accepted once',
      '<repair component>': 'agora-packet-template', '<lane>': 'codex',
    };
    const command = prompt.split('\n').find(line => line.includes(' gap add '));
    const filled = command.replace(/<[^>]+>/g, match => replacements[match] || match);
    // The generated command uses only quoted values and plain flags. Test its
    // exact argument recipe through the real CLI, without invoking a shell.
    const argv = [...filled.slice(filled.indexOf(' gap add ') + 1).matchAll(/"([^"]*)"|([^\s]+)/g)]
      .map(match => match[1] ?? match[2]);
    assert.ok(argv.every(arg => !arg.includes('<')), 'no template values reach intake');
    const options = { env: { AGORA_DIR: path.join(fixtureDir, 'identity'), AGORA_AGENT_ID: owner.handle }, baseUrl };
    const result = await run([...argv, '--token', owner.token], options);
    assert.equal(result.code, 0, [...result.lines, ...(result.stderrLines || [])].join('\n'));
    assert.doesNotMatch([...result.lines, ...(result.stderrLines || [])].join('\n'), /WARNING: no --proof/);
    // No delay or manual retry: this is the exact append-then-repair sequence
    // that used to return a Windows file-open error on the second request.
    const updated = await run(['gap', 'update', result.gap.id, '--project', 'workflow', '--note',
      'Immediate generated-command update accepted', '--token', owner.token], options);
    assert.equal(updated.code, 0, updated.lines.join('\n'));
    // Reproduce the specific transient open errno without depending on a real
    // editor/scanner race. Only this private registry's next write is affected.
    const originalWrite = fs.writeFileSync;
    let registryWrites = 0;
    fs.writeFileSync = function (file, ...args) {
      if (path.resolve(String(file)) === path.resolve(registry) && ++registryWrites === 1) {
        const error = new Error('Injected transient registry open failure');
        error.code = 'UNKNOWN';
        throw error;
      }
      return originalWrite.call(this, file, ...args);
    };
    try {
      const retried = await run(['gap', 'update', result.gap.id, '--project', 'workflow', '--note',
        'Transient update recovered once', '--token', owner.token], options);
      assert.equal(retried.code, 0, retried.lines.join('\n'));
      assert.equal(registryWrites, 2, 'the same update retries its file write, not its HTTP mutation');
    } finally { fs.writeFileSync = originalWrite; }
    const stored = fs.readFileSync(registry, 'utf8');
    assert.equal((stored.match(/\| WF-G1 \|/g) || []).length, 1);
    for (const value of [owner.handle, owner.id, 'feedback-session', task.id, 'agora-packet-template',
      'Avoid first-send refusals', 'Generated feedback accepted once', 'codex',
      'Immediate generated-command update accepted', 'Transient update recovered once']) assert.ok(stored.includes(value), value);
    const invalidArgs = [...argv];
    invalidArgs[invalidArgs.indexOf('--surface') + 1] = task.id;
    const invalid = await run([...invalidArgs, '--token', owner.token], options);
    assert.equal(invalid.code, 1);
    assert.match(invalid.lines.join('\n'), /detected-during/);
    assert.equal(fs.readFileSync(registry, 'utf8'), stored, 'task-shaped Surface refusal never writes a second row');
  } finally {
    await fixture.close();
    assert.ok(path.resolve(fixtureDir).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

let app;
let serverDir;
let clientDir;
let baseUrl;
let env;

before(async () => {
  serverDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-client-srv-'));
  clientDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-client-id-'));
  app = createAgoraServer({ dir: serverDir });
  // Synchronous Git fixtures pause this in-process server's event loop. Keep
  // pooled client sockets alive across those pauses so later commands cannot
  // race the server's idle-close timer. Production socket policy is unchanged.
  app.server.keepAliveTimeout = 120_000;
  app.server.headersTimeout = 125_000;
  await new Promise((resolve) => app.listen(0, resolve));
  const port = app.server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
  // The same scoped identity is reused by the main CLI fixture.
  env = { AGORA_DIR: clientDir, AGORA_AGENT_ID: 'client-test', AGORA_PET: 'gf-sd' };
});

after(async () => {
  if (app) await app.close();
  for (const d of [serverDir, clientDir]) {
    if (d) fs.rmSync(d, { recursive: true, force: true });
  }
});

// Convenience: invoke a command with the test env + baseUrl.
function cli(argv, extra = {}) {
  return run(argv, { env, baseUrl, ...extra });
}

test('WF-G268: successful claims warn about body paths outside the actual claimant locks', async () => {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-claim-coverage-'));
  const isolated = createAgoraServer({ dir: fixtureDir });
  try {
    await new Promise(resolve => isolated.listen(0, resolve));
    const owner = isolated.store.registerAgent({ handle: 'claim-coverage', petSlug: 'dream-girl' });
    const rival = isolated.store.registerAgent({ handle: 'claim-rival', petSlug: 'cyberman' });
    isolated.store.acquireLock({ agentId: owner.id, paths: ['src/wfg-held.ts', 'src/wfg-dir'] });
    isolated.store.acquireLock({ agentId: owner.id, globs: ['src/wfg-glob/**'] });
    isolated.store.acquireLock({ agentId: rival.id, paths: ['src/wfg-rival.ts'] });
    const makeTask = body => isolated.store.createTask({ agentId: owner.id, title: 'Claim coverage fixture',
      body, standalone: true, standaloneReason: 'Disposable test fixture', refs: ['src/wfg-held.ts'] });
    const task = makeTask([
      'DO: src/wfg-held.ts src/wfg-dir/inside.ts src/wfg-glob/nested/inside.ts',
      'DO: src/wfg-missing.ts:20 src/wfg-rival.ts',
      'REFERENCE-ONLY: docs/evidence.md',
      'EXPECTED-ABSENT: src/wfg-absent.ts',
    ].join('\n'));
    const options = { env, baseUrl: 'http://127.0.0.1:' + isolated.server.address().port };
    const claim = await run(['task', 'claim', task.id, '--token', owner.token], options);
    assert.equal(claim.code, 0);
    assert.equal(claim.task.claimedBy, owner.id);
    assert.equal(claim.stderrLines.length, 2);
    assert.match(claim.stderrLines.join('\n'), /wfg-missing\.ts \(body\)/);
    assert.match(claim.stderrLines.join('\n'), /wfg-rival\.ts/);
    assert.doesNotMatch(claim.stderrLines.join('\n'), /wfg-held|wfg-dir|wfg-glob|evidence|wfg-absent/);
    const nextTask = makeTask('DO: src/wfg-next.ts');
    const next = await run(['task', 'next', '--id-only', '--token', owner.token], options);
    assert.equal(next.code, 0);
    assert.deepEqual(next.lines, [nextTask.id], 'warnings never contaminate the bare task ID');
    assert.match(next.stderrLines.join('\n'), /wfg-next\.ts/);
    assert.equal(isolated.store.listTasks().filter(item => item.claimedBy === owner.id).length, 2);
  } finally {
    await isolated.close();
    const target = path.resolve(fixtureDir);
    assert.ok(target.startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test('WF-G268: an unavailable advisory lock list cannot undo or repeat a successful claim', async () => {
  let mutations = 0;
  const task = { id: 'agora-claim-fixture', claimedBy: 'fixture-owner', state: 'claimed', body: 'DO: src/wfg-target.ts' };
  const server = createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    if (request.method === 'POST') { mutations++; response.end(JSON.stringify({ task })); }
    else if (request.url === '/locks') { response.statusCode = 503; response.end('{"error":"fixture unavailable"}'); }
    else response.end(JSON.stringify({ tasks: [task] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const claim = await run(['task', 'claim', task.id, '--token', 'fixture-token'],
      { env, baseUrl: 'http://127.0.0.1:' + server.address().port });
    assert.equal(claim.code, 0);
    assert.equal(mutations, 1);
    assert.match(claim.stderrLines.join('\n'), /claim succeeded.*could not be checked.*do not repeat/);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('happy path: register -> lock -> locks -> task -> say -> inbox', async () => {
  // --- register ---
  const reg = await cli(['register', 'tester', '--note', 'unit test agent']);
  assert.equal(reg.code, 0);
  assert.ok(reg.identity && reg.identity.token, 'register returns identity with token');
  assert.match(reg.lines.join('\n'), /Registered as "tester"/);
  const testerToken = reg.identity.token;

  // Identity persisted to the temp dir, keyed by baseUrl.
  const idFile = path.join(clientDir, 'client-identity.client-test.json');
  assert.ok(fs.existsSync(idFile), 'identity file written');
  const ids = JSON.parse(fs.readFileSync(idFile, 'utf8'));
  assert.ok(ids[baseUrl], 'identity keyed by baseUrl');
  assert.equal(ids[baseUrl].handle, 'tester');
  assert.equal(ids[baseUrl].agentId, reg.identity.agentId);
  assert.equal(ids[baseUrl].pet.slug, 'gf-sd');

  // --- whoami (local, reads the stored identity) ---
  const who = await cli(['whoami']);
  assert.equal(who.code, 0);
  assert.match(who.lines.join('\n'), /^stored identity:/);
  assert.match(who.lines.join('\n'), /handle:\s+tester/);
  assert.match(who.lines.join('\n'), /pet:.*\(gf-sd\)/);
  assert.doesNotMatch(who.lines.join('\n'), new RegExp(testerToken));

  // --- agents ---
  const agents = await cli(['agents']);
  assert.equal(agents.code, 0);
  assert.equal(agents.agents.length, 1);
  assert.equal(agents.agents[0].handle, 'tester');
  assert.equal(agents.agents[0].pet.slug, 'gf-sd');

  // --- lock (uses stored token automatically) ---
  const lock = await cli(['lock', 'src/foo.ts', '--reason', 'refactor', '--ttl', '5']);
  assert.equal(lock.code, 0);
  assert.ok(lock.lock && lock.lock.id, 'lock returns a lock id');
  assert.deepEqual(lock.lock.paths, ['src/foo.ts']);

  // Daemon state changed: a direct fetch sees the lock.
  const locksFetch = await fetch(`${baseUrl}/locks`).then((r) => r.json());
  assert.equal(locksFetch.locks.length, 1);
  assert.equal(locksFetch.locks[0].id, lock.lock.id);

  // --- locks (renders holder handle) ---
  const locks = await cli(['locks']);
  assert.equal(locks.code, 0);
  assert.equal(locks.locks.length, 1);
  assert.match(locks.lines.join('\n'), /tester/);
  assert.match(locks.lines.join('\n'), /src\/foo\.ts/);

  // --- reservations: agents can queue for files before locking them ---
  const reserve = await cli(['reserve', 'src/reserved.ts', '--reason', 'next pass', '--token', testerToken]);
  assert.equal(reserve.code, 0);
  assert.equal(reserve.reservation.position, 1);
  assert.match(reserve.lines.join('\n'), /Reservation queued/);

  const reservations = await cli(['reservations']);
  assert.equal(reservations.code, 0);
  assert.ok(reservations.reservations.some((r) => r.id === reserve.reservation.id));
  assert.match(reservations.lines.join('\n'), /#1/);
  assert.match(reservations.lines.join('\n'), /src\/reserved\.ts/);

  const unreserve = await cli(['unreserve', reserve.reservation.id, '--token', testerToken]);
  assert.equal(unreserve.code, 0);
  assert.match(unreserve.lines.join('\n'), /Released reservation/);

  // --- lock conflict: a SECOND agent locking the same path -> 409 + exit 1 ---
  const reg2 = await cli(['register', 'rival']); // overwrites identity for this baseUrl
  assert.equal(reg2.code, 0);
  assert.notEqual(reg2.identity.pet.slug, 'gf-sd', 'the already-claimed pet is substituted');
  assert.equal(reg2.identity.petSubstituted, true);
  assert.match(reg2.lines.join('\n'), /already claimed; Agora assigned/);
  const conflict = await cli(['lock', 'src/foo.ts']);
  assert.equal(conflict.code, 1, 'conflicting lock exits non-zero');
  assert.ok(conflict.conflict, 'conflict surfaced');
  assert.match(conflict.lines.join('\n'), /CONFLICT/);
  assert.match(conflict.lines.join('\n'), /tester/); // holder resolved to handle

  // WF-G296: an atomic batch grants none of its paths when just one conflicts.
  const atomic = await cli(['lock', 'src/foo.ts', 'src/atomic-free.ts']);
  assert.equal(atomic.code, 1);
  assert.match(atomic.lines.join('\n'), /No locks acquired by this atomic call/);
  assert.match(atomic.lines.join('\n'), /NOT ACQUIRED path "src\/atomic-free\.ts"/);
  const afterAtomic = await fetch(`${baseUrl}/locks`).then((r) => r.json());
  assert.equal(afterAtomic.locks.some((item) => item.paths.includes('src/atomic-free.ts')), false);

  // WF-G311/WF-G331: opt-in partial mode reports actual per-target results,
  // takes free paths/globs, and still exits non-zero for an incomplete batch.
  const partial = await cli(['lock', 'src/foo.ts', 'src/partial-free.ts', '--glob', 'src/partial/*.ts', '--partial']);
  assert.equal(partial.code, 1);
  assert.deepEqual(partial.results.map((item) => item.status), ['conflict', 'acquired', 'acquired']);
  assert.equal(partial.locks.length, 2);
  assert.match(partial.lines.join('\n'), /NOT ACQUIRED path "src\/foo\.ts"/);
  assert.match(partial.lines.join('\n'), /ACQUIRED path "src\/partial-free\.ts"/);
  assert.match(partial.lines.join('\n'), /ACQUIRED glob "src\/partial\/\*\.ts"/);
  assert.match(partial.lines.join('\n'), /Only ACQUIRED targets may be edited/);
  const afterPartial = await fetch(`${baseUrl}/locks`).then((r) => r.json());
  for (const item of partial.locks) assert.ok(afterPartial.locks.some((held) => held.id === item.id));
  assert.equal(afterPartial.locks.some((item) => item.agentId === reg2.identity.agentId && item.paths.includes('src/foo.ts')), false);

  const ambiguousPartial = await cli(['lock', 'src/not-taken.ts', '--partial', '--id-only']);
  assert.equal(ambiguousPartial.code, 1);
  assert.match(ambiguousPartial.lines.join('\n'), /cannot be combined with --id-only/);
  assert.equal((await fetch(`${baseUrl}/locks`).then((r) => r.json())).locks.some((item) => item.paths.includes('src/not-taken.ts')), false);
  assert.equal((await cli(['unlock', '--mine'])).code, 0); // rival's partial locks only

  // --- task new / claim / state (explicit --token to avoid identity churn) ---
  const tnew = await cli(['task', 'new', 'Wire the thing', '--body', 'details', '--token', testerToken]);
  assert.equal(tnew.code, 0);
  const taskId = tnew.task.id;
  assert.equal(tnew.task.state, 'open');
  assert.equal(tnew.task.creatorAgent.id, reg.identity.agentId);
  assert.equal(tnew.task.creatorAgent.handle, 'tester');

  const tclaim = await cli(['task', 'claim', taskId, '--token', testerToken]);
  assert.equal(tclaim.code, 0);
  assert.equal(tclaim.task.state, 'claimed');
  assert.equal(tclaim.task.assignedPet.kind, 'humanoid');
  assert.match(tclaim.lines.join('\n'), /pet: .+ \(.+\)/);

  const tstate = await cli(['task', 'state', taskId, 'in_progress', '--token', testerToken]);
  assert.equal(tstate.code, 0);
  assert.equal(tstate.task.state, 'in_progress');

  // Board groups by state.
  const tasks = await cli(['tasks']);
  assert.equal(tasks.code, 0);
  assert.match(tasks.lines.join('\n'), /\[in_progress\]/);
  assert.match(tasks.lines.join('\n'), /Wire the thing/);

  // Filtered board.
  const tasksFiltered = await cli(['tasks', '--state', 'open']);
  assert.equal(tasksFiltered.code, 0);
  assert.match(tasksFiltered.lines.join('\n'), /no tasks in state "open"/);

  // --- say (broadcast) ---
  const say = await cli(['say', 'hello', 'world', '--token', testerToken]);
  assert.equal(say.code, 0);
  assert.ok(say.message && say.message.seq >= 1);

  // --- say --to <handle> (handle resolved to agentId) ---
  const sayTo = await cli(['say', '--to', 'rival', 'ping', '--token', testerToken]);
  assert.equal(sayTo.code, 0);
  assert.equal(sayTo.message.to, reg2.identity.agentId, 'handle resolved to agentId');

  // --- inbox ---
  const inbox = await cli(['inbox']);
  assert.equal(inbox.code, 0);
  assert.ok(inbox.messages.length >= 1);
  assert.ok(inbox.maxSeq >= 1, 'inbox reports a max seq');
  assert.match(inbox.lines.join('\n'), /max seq/);

  // --since cursor filters out earlier messages.
  const inboxSince = await cli(['inbox', '--since', String(inbox.maxSeq)]);
  assert.equal(inboxSince.code, 0);
  assert.equal(inboxSince.messages.length, 0);

  // --- health ---
  const health = await cli(['health']);
  assert.equal(health.code, 0);
  assert.equal(health.health.ok, true);
  assert.ok(health.health.counts.locks >= 1);

  // Clean up the lock so the assertion count is self-contained.
  const unlock = await cli(['unlock', lock.lock.id, '--token', testerToken]);
  assert.equal(unlock.code, 0);
});

// ---------------------------------------------------------------------------
// Registration scope continuity
// ---------------------------------------------------------------------------
// Registration must never tell an already-onboarded agent to change the scope
// that selected its identity file. This reproduces the safe AGORA_DIR-only flow
// and proves the literal printed advice leaves the first owned lock usable.
// ---------------------------------------------------------------------------
test('onboarding without AGORA_AGENT_ID preserves its existing identity scope for the next lock', async () => {
  const continuityDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-client-scope-continuity-'));
  const continuityEnv = { AGORA_DIR: continuityDir, AGORA_PET: 'battle-damaged-idle' };
  let onboard;
  try {
    // A unique AGORA_DIR is already a safe identity scope. Onboarding should
    // tell the agent to preserve it, never to add AGORA_AGENT_ID afterward.
    onboard = await run([
      'onboard', 'scope-continuity-worker', '--session', 'thread-scope-continuity', '--legacy-unscoped',
    ], { env: continuityEnv, baseUrl });
    assert.equal(onboard.code, 0);
    const printed = onboard.lines.join('\n');
    assert.match(printed, /Keep AGORA_AGENT_ID and AGORA_DIR unchanged for later commands/);
    assert.doesNotMatch(printed, /TIP: export AGORA_AGENT_ID=/);
    assert.doesNotMatch(printed, new RegExp(onboard.identity.token));

    // Following that advice verbatim means reusing the unchanged environment.
    // The stored bearer remains private while the real server accepts the lock.
    const lock = await run([
      'lock', 'tools/agora/scope-continuity-proof.mjs', '--reason', 'scope continuity regression',
    ], { env: continuityEnv, baseUrl });
    assert.equal(lock.code, 0);
    assert.match(lock.lines.join('\n'), /Lock acquired/);
    assert.doesNotMatch(lock.lines.join('\n'), new RegExp(onboard.identity.token));
  } finally {
    // Retiring through the unchanged scope releases any owned proof lock and
    // prevents this focused case from affecting later tests in the same server.
    if (onboard?.code === 0) {
      await run(['retire'], { env: continuityEnv, baseUrl });
    }
    fs.rmSync(continuityDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Stored identity liveness diagnosis
// ---------------------------------------------------------------------------
// This isolated server uses a controlled clock so the test can prove that the
// live check reads authentication state without extending the presence lease.
// It then exercises both ways saved identity can stop authenticating: reaping
// by the server and a locally corrupted bearer token.
// ---------------------------------------------------------------------------
test('whoami --live distinguishes live, reaped, and invalid saved identity without renewing presence', async () => {
  const isolatedServerDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-whoami-live-srv-'));
  const isolatedClientDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-whoami-live-id-'));
  let currentMs = 10_000;
  const isolatedApp = createAgoraServer({
    dir: isolatedServerDir,
    storeFactory: ({ dir }) => createStore({
      dir,
      now: () => currentMs,
      presenceTtlMs: 100,
      presenceDropMs: 1_000,
    }),
  });
  try {
    await new Promise((resolve) => isolatedApp.listen(0, resolve));
    const isolatedBaseUrl = `http://127.0.0.1:${isolatedApp.server.address().port}`;
    const isolatedEnv = { AGORA_DIR: isolatedClientDir, AGORA_AGENT_ID: 'whoami-live', AGORA_PET: 'nous-girl' };

    // Registration establishes a saved token at the controlled starting time.
    const registered = await run(['register', 'whoami-live-worker'], {
      env: isolatedEnv,
      baseUrl: isolatedBaseUrl,
    });
    assert.equal(registered.code, 0);
    const initialLastSeen = isolatedApp.store.listAgents()[0].lastSeen;

    // Moving the clock makes the identity stale. A successful live check must
    // report that stored identity yet leave lastSeen at its original value.
    currentMs += 500;
    const live = await run(['whoami', '--live'], { env: isolatedEnv, baseUrl: isolatedBaseUrl });
    assert.equal(live.code, 0);
    assert.equal(live.live, true);
    assert.match(live.lines.join('\n'), /live status: current \(stale\)/);
    assert.equal(isolatedApp.store.listAgents()[0].lastSeen, initialLastSeen, 'diagnosis did not renew presence');
    assert.doesNotMatch(live.lines.join('\n'), new RegExp(registered.identity.token));

    // Once the controlled clock passes the drop horizon and the store reaps the
    // agent, the unchanged saved file must be diagnosed as no longer live.
    currentMs += 501;
    isolatedApp.store.sweepExpired();
    const reaped = await run(['whoami', '--live'], { env: isolatedEnv, baseUrl: isolatedBaseUrl });
    assert.equal(reaped.code, 1);
    assert.equal(reaped.live, false);
    assert.match(reaped.lines.join('\n'), /stored identity was reaped or retired/);
    assert.doesNotMatch(reaped.lines.join('\n'), /saved bearer is invalid/);

    // A new registration proves the same response also covers a malformed
    // local bearer while its real server-side presence remains current.
    const replacement = await run(['register', 'whoami-invalid-worker'], {
      env: isolatedEnv,
      baseUrl: isolatedBaseUrl,
    });
    assert.equal(replacement.code, 0);
    const identityFile = path.join(isolatedClientDir, 'client-identity.whoami-live.json');
    const saved = JSON.parse(fs.readFileSync(identityFile, 'utf8'));
    saved[isolatedBaseUrl].token = 'deliberately-invalid-token';
    fs.writeFileSync(identityFile, JSON.stringify(saved, null, 2) + '\n');
    const invalid = await run(['whoami', '--live'], { env: isolatedEnv, baseUrl: isolatedBaseUrl });
    assert.equal(invalid.code, 1);
    assert.equal(invalid.live, false);
    assert.match(invalid.lines.join('\n'), /stored presence exists, but its saved bearer is invalid/);
    assert.doesNotMatch(invalid.lines.join('\n'), /identity was reaped or retired/);
    assert.doesNotMatch(invalid.lines.join('\n'), /deliberately-invalid-token/);
  } finally {
    await isolatedApp.close();
    fs.rmSync(isolatedServerDir, { recursive: true, force: true });
    fs.rmSync(isolatedClientDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Task-creation onboarding failures
// ---------------------------------------------------------------------------
// These cases use an isolated identity directory and the real in-process Agora
// server. Neither failure may add a board task, and both must show the complete
// safe onboarding command instead of a generic registration hint or raw 401.
// ---------------------------------------------------------------------------
test('task new directs missing and rejected identities to safe onboarding without creating a task', async () => {
  const isolatedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-client-task-onboarding-'));
  const isolatedEnv = { AGORA_DIR: isolatedDir, AGORA_AGENT_ID: 'task-onboarding-regression' };
  try {
    const tasksBefore = await fetch(`${baseUrl}/tasks`).then((response) => response.json());

    // With no stored identity, the client stops before contacting the task endpoint.
    const missingIdentity = await run(['task', 'new', 'Must not be created'], {
      env: isolatedEnv,
      baseUrl,
    });
    assert.notEqual(missingIdentity.code, 0);
    assert.match(missingIdentity.lines.join('\n'), /onboard <handle>/);
    assert.match(missingIdentity.lines.join('\n'), /--pet <slug>/);
    assert.match(missingIdentity.lines.join('\n'), /--session <task\/thread-id>/);

    // An explicit but invalid token reaches the server, receives 401, and gets
    // the same actionable recovery command rather than exposing only the status.
    const rejectedToken = await run([
      'task', 'new', 'Also must not be created', '--token', 'invalid-task-token',
    ], { env: isolatedEnv, baseUrl });
    assert.notEqual(rejectedToken.code, 0);
    assert.match(rejectedToken.lines.join('\n'), /task new failed \(401\)/);
    assert.match(rejectedToken.lines.join('\n'), /onboard <handle>/);
    assert.match(rejectedToken.lines.join('\n'), /--pet <slug>/);
    assert.match(rejectedToken.lines.join('\n'), /--session <task\/thread-id>/);

    // The board count is the acceptance boundary: neither rejected attempt may
    // leak a task into shared coordination state.
    const tasksAfter = await fetch(`${baseUrl}/tasks`).then((response) => response.json());
    assert.equal(tasksAfter.tasks.length, tasksBefore.tasks.length);
  } finally {
    fs.rmSync(isolatedDir, { recursive: true, force: true });
  }
});

test('pet discovery works before registration and the CLI refuses petless presence', async () => {
  const pets = await run(['pets'], { env: { AGORA_DIR: clientDir }, baseUrl });
  assert.equal(pets.code, 0);
  assert.ok(pets.pets.length >= 50);
  assert.match(pets.lines.join('\n'), /^gf-sd\s+/m);

  const petlessDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-client-petless-'));
  try {
    const rejected = await run(['register', 'petless-cli-worker'], {
      env: { AGORA_DIR: petlessDir, AGORA_AGENT_ID: 'petless-cli-worker' },
      baseUrl,
    });
    assert.equal(rejected.code, 1);
    assert.match(rejected.lines.join('\n'), /--pet <slug> is required/);
    assert.equal(fs.existsSync(path.join(petlessDir, 'client-identity.petless-cli-worker.json')), false);
    const roster = await fetch(`${baseUrl}/agents`).then((response) => response.json());
    assert.equal(roster.agents.some((agent) => agent.handle === 'petless-cli-worker'), false);
  } finally {
    fs.rmSync(petlessDir, { recursive: true, force: true });
  }
});

test('CLI refuses Codex and orchestrator presence without the current task/thread id', async () => {
  const gateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-client-thread-gate-'));
  const gateEnv = { AGORA_DIR: gateDir, AGORA_AGENT_ID: 'codex-cli-thread-gate', AGORA_PET: 'gf-sd' };
  try {
    const rejected = await run(['register', 'codex-cli-thread-gate', '--model', 'gpt-5.6-sol'], {
      env: gateEnv,
      baseUrl,
    });
    assert.equal(rejected.code, 1);
    assert.match(rejected.lines.join('\n'), /task\/thread id.*required/i);
    assert.equal(fs.existsSync(path.join(gateDir, 'client-identity.codex-cli-thread-gate.json')), false);

    const accepted = await run([
      'register', 'codex-cli-thread-gate', '--model', 'gpt-5.6-sol', '--session', 'thread-cli-proof',
    ], { env: gateEnv, baseUrl });
    assert.equal(accepted.code, 0);
    assert.equal(accepted.identity.sessionId, 'thread-cli-proof');
  } finally {
    fs.rmSync(gateDir, { recursive: true, force: true });
  }
});

test('unreachable daemon -> friendly error + non-zero exit', async () => {
  // Point at a dead port; register hits the network and should fail gracefully.
  const res = await run(['agents'], { env, baseUrl: 'http://127.0.0.1:1' });
  assert.equal(res.code, 1);
  assert.match(res.lines.join('\n'), /not reachable/);
});

test('help / no command prints usage', async () => {
  const res = await run([], { env, baseUrl });
  assert.equal(res.code, 0);
  assert.match(res.lines.join('\n'), /Usage:/);
  assert.match(res.lines.join('\n'), /register <handle>/);
});

test('WF-G303: task help prints canonical task usage without daemon or identity', async () => {
  const options = { env: {}, baseUrl: 'http://127.0.0.1:1' };
  const all = await run(['task', '--help'], options);
  assert.equal(all.code, 0);
  assert.match(all.lines.join('\n'), /task checkpoint <taskId> --did/);
  assert.match(all.lines.join('\n'), /task new <title>/);
  assert.doesNotMatch(all.lines.join('\n'), /unknown task subcommand/);

  const specific = await run(['task', 'checkpoint', '--help'], options);
  assert.equal(specific.code, 0);
  assert.match(specific.lines.join('\n'), /--did "\.\.\." --next "\.\.\." \[--files/);
  assert.doesNotMatch(specific.lines.join('\n'), /task new <title>/);
});

test('heartbeat is finite by default and stops at the bounded duration', async () => {
  const reg = await cli(['register', 'worker.bounded-heartbeat']);
  assert.equal(reg.code, 0);
  let currentMs = 0;
  const res = await cli(['heartbeat', '--every', '60'], {
    heartbeatOpts: {
      defaultForMin: 1,
      now: () => currentMs,
      sleep: async (ms) => { currentMs += ms; },
    },
  });
  assert.equal(res.code, 0);
  assert.equal(res.beats, 1);
  assert.equal(res.stopped, 'duration');
  assert.match(res.lines.join('\n'), /bounded heartbeat.*at most 1 minute/);
});

test('workflow-gap client surface preserves provenance, evidence, checkpoints, and bounded ownership', async () => {
  const scopedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-client-gap-surface-'));
  const scopedEnv = { AGORA_DIR: scopedDir, AGORA_AGENT_ID: 'gap-surface', AGORA_PET: 'gf-sd' };
  try {
    const reg = await run([
      'register', 'gap-surface', '--model', 'gpt-5.3-codex-spark', '--reasoning', 'high', '--session', 'thread-gap-surface',
    ], { env: scopedEnv, baseUrl });
    assert.equal(reg.code, 0);
    assert.equal(reg.identity.reasoningEffort, 'high');

    const who = await run(['whoami'], { env: scopedEnv, baseUrl });
    assert.equal(who.code, 0);
    assert.equal('token' in who.identity, false);
    assert.doesNotMatch(who.lines.join('\n'), /token:/i);
    assert.match(who.lines.join('\n'), /reasoning:\s+high/);

    const lock = await run(['lock', 'src/gap-surface.ts', '--ttl', '1'], { env: scopedEnv, baseUrl });
    const renewed = await run(['lock', '--renew', lock.lock.id, '--ttl', '5'], { env: scopedEnv, baseUrl });
    assert.equal(renewed.code, 0);
    assert.ok(renewed.lock.expiresAt > lock.lock.expiresAt);
    const ambiguous = await run(['lock', 'src/not-a-lock.ts', '--reason', 'unquoted', 'reason'], { env: scopedEnv, baseUrl });
    assert.equal(ambiguous.code, 1);
    assert.match(ambiguous.lines.join('\n'), /quote the complete --reason/);
    const phantomPaths = await run([
      'lock', 'src/not-a-lock.ts', 'inspector', 'and', 'assignment', '--reason', 'Readable',
    ], { env: scopedEnv, baseUrl });
    assert.equal(phantomPaths.code, 1);
    assert.match(phantomPaths.lines.join('\n'), /unrecognised bare path token/);

    const task = await run(['task', 'new', 'Gap surface task'], { env: scopedEnv, baseUrl });
    await run(['task', 'claim', task.task.id], { env: scopedEnv, baseUrl });
    const started = await run(['task', 'start', task.task.id, '--result', 'inspection started'], { env: scopedEnv, baseUrl });
    assert.equal(started.code, 0);
    assert.equal(started.task.state, 'in_progress');
    assert.equal(started.task.result, 'inspection started');

    const checkpoint = await run([
      'task', 'checkpoint', task.task.id, '--did', 'one', '--next', 'two', '--files', 'a.ts', '--files', 'b.ts,c.ts',
    ], { env: scopedEnv, baseUrl });
    assert.deepEqual(checkpoint.checkpoint.files, ['a.ts', 'b.ts', 'c.ts']);
    const rejectedCheckpoint = await run([
      'task', 'checkpoint', task.task.id, '--did', 'one', '--next', 'two', '--files', 'a.ts', 'b.ts',
    ], { env: scopedEnv, baseUrl });
    assert.equal(rejectedCheckpoint.code, 1);
    assert.match(rejectedCheckpoint.lines.join('\n'), /comma-separated or repeated --files/);

    const spawns = [];
    const detached = await run(['heartbeat', '--daemonize', '--every', '600'], {
      env: scopedEnv,
      baseUrl,
      heartbeatOpts: {
        spawnDetached: (...args) => {
          spawns.push(args);
          return { pid: 4242, unref() {} };
        },
      },
    });
    assert.equal(detached.code, 0);
    assert.equal(detached.detached, true);
    assert.equal(spawns.length, 1);
    assert.equal(spawns[0][2].detached, true);
    assert.equal(spawns[0][1].includes('--daemonize'), false);
  } finally {
    fs.rmSync(scopedDir, { recursive: true, force: true });
  }
});

test('heartbeat stops when its explicit owner process exits', async () => {
  const reg = await cli(['register', 'worker.owned-heartbeat']);
  assert.equal(reg.code, 0);
  let ownerRunning = true;
  const res = await cli(['heartbeat', '--every', '1', '--count', '2', '--owner-pid', '4242'], {
    heartbeatOpts: {
      ownerAlive: () => ownerRunning,
      sleep: async () => { ownerRunning = false; },
    },
  });
  assert.equal(res.code, 0);
  assert.equal(res.beats, 1);
  assert.equal(res.stopped, 'owner_exited');
  assert.match(res.lines.join('\n'), /owner PID 4242 exited/);
});

test('heartbeat requires explicit, unambiguous lifetime mode', async () => {
  const reg = await cli(['register', 'worker.heartbeat-flags']);
  assert.equal(reg.code, 0);
  const res = await cli(['heartbeat', '--forever', '--count', '1']);
  assert.equal(res.code, 1);
  assert.equal(res.beats, 0);
  assert.match(res.lines.join('\n'), /only one of --count, --for, or --forever/);
});

test('watch connects, receives the hello event, then disconnects', { timeout: 8000 }, async () => {
  // Drive watch with maxEvents:1 so it settles on the `hello` event.
  const res = await run(['watch'], {
    env,
    baseUrl,
    watchOpts: { maxEvents: 1, timeoutMs: 5000 },
  });
  assert.equal(res.code, 0);
  assert.ok(res.events >= 1, 'received at least the hello event');
  assert.match(res.lines.join('\n'), /connected/);
});

test('AGORA_AGENT_ID scopes identity: unlock --mine cannot release another agent\'s locks from the same checkout', async () => {
  // Two concurrent agents share ONE checkout (same AGORA_DIR) but set distinct
  // AGORA_AGENT_ID values. Regression for 2026-07-04: with a shared identity
  // file, `unlock --mine` from agent B released agent A's locks mid-edit.
  const sharedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-client-shared-'));
  const envA = { AGORA_DIR: sharedDir, AGORA_AGENT_ID: 'prop-agent', AGORA_PET: 'gf-sd' };
  const envB = { AGORA_DIR: sharedDir, AGORA_AGENT_ID: 'veg-agent', AGORA_PET: 'dream-girl' };
  try {
    const regA = await run(['register', 'prop-agent'], { env: envA, baseUrl });
    const regB = await run(['register', 'veg-agent'], { env: envB, baseUrl });
    assert.equal(regA.code, 0);
    assert.equal(regB.code, 0);

    // Separate identity files, separate agentIds.
    assert.ok(fs.existsSync(path.join(sharedDir, 'client-identity.prop-agent.json')));
    assert.ok(fs.existsSync(path.join(sharedDir, 'client-identity.veg-agent.json')));
    assert.notEqual(regA.identity.agentId, regB.identity.agentId);

    // B registering did NOT clobber A: A's whoami still resolves to A.
    const whoA = await run(['whoami'], { env: envA, baseUrl });
    assert.equal(whoA.identity.agentId, regA.identity.agentId);

    // A locks a file; B runs `unlock --mine` — A's lock must survive.
    const lockA = await run(['lock', 'src/props.ts', '--reason', 'prop placement'], { env: envA, baseUrl });
    assert.equal(lockA.code, 0);
    const unlockB = await run(['unlock', '--mine'], { env: envB, baseUrl });
    assert.equal(unlockB.code, 0);
    assert.match(unlockB.lines.join('\n'), /no locks held by you/);

    const locksAfter = await fetch(`${baseUrl}/locks`).then((r) => r.json());
    assert.ok(locksAfter.locks.some((l) => l.id === lockA.lock.id), "A's lock survived B's unlock --mine");

    // A can still release its own lock.
    const unlockA = await run(['unlock', '--mine'], { env: envA, baseUrl });
    assert.equal(unlockA.code, 0);
    assert.match(unlockA.lines.join('\n'), new RegExp(lockA.lock.id));
  } finally {
    fs.rmSync(sharedDir, { recursive: true, force: true });
  }
});

test('WF-G156: unlock <a> <b> releases every named path of a multi-path lock', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-client-unlock-multi-'));
  const env = { AGORA_DIR: dir, AGORA_AGENT_ID: 'multi-unlock-agent', AGORA_PET: 'cyberman' };
  try {
    const reg = await run(['register', 'multi-unlock-agent'], { env, baseUrl });
    assert.equal(reg.code, 0);
    const lock = await run(['lock', 'src/a-multi.ts', 'src/b-multi.ts', 'src/c-multi.ts', '--reason', 'three files'], { env, baseUrl });
    assert.equal(lock.code, 0);
    const un = await run(['unlock', 'src/a-multi.ts', 'src/b-multi.ts'], { env, baseUrl });
    assert.equal(un.code, 0);
    const after = await fetch(`${baseUrl}/locks`).then((r) => r.json());
    const mine = after.locks.filter((l) => l.agentId === reg.identity.agentId);
    const held = mine.flatMap((l) => l.paths || []);
    assert.deepEqual(held, ['src/c-multi.ts'], 'only the third path stays held');
    await run(['unlock', '--mine'], { env, baseUrl });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Legacy default identity safety
// ---------------------------------------------------------------------------
// These cases keep all identity files in fresh temporary directories. The
// first proves the old shared default slot cannot be silently overwritten; the
// second proves explicit per-agent scopes still isolate destructive commands.
// ---------------------------------------------------------------------------
test('default onboarding refuses to overwrite a live identity and keeps later commands bound to the first agent', async () => {
  const defaultDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-client-default-safety-'));
  const defaultEnv = { AGORA_PET: 'king-david' };
  try {
    // A claims the unscoped default slot and owns a lock through that identity.
    const onboardA = await run(['onboard', 'legacy-default-a', '--legacy-unscoped'], {
      env: defaultEnv,
      baseUrl,
      identityDirOverride: defaultDir,
    });
    assert.equal(onboardA.code, 0);
    const lockA = await run(['lock', 'src/default-a.ts'], {
      env: defaultEnv,
      baseUrl,
      identityDirOverride: defaultDir,
    });
    assert.equal(lockA.code, 0);

    // B's second default onboarding must stop before registration, preserving
    // both the saved A identity and the live roster rather than replacing A.
    const rosterBefore = await fetch(`${baseUrl}/agents`).then((response) => response.json());
    const onboardB = await run(['onboard', 'legacy-default-b', '--pet', 'king-solomon', '--legacy-unscoped'], {
      env: defaultEnv,
      baseUrl,
      identityDirOverride: defaultDir,
    });
    assert.equal(onboardB.code, 1);
    assert.match(onboardB.lines.join('\n'), /default identity still belongs to live agent "legacy-default-a"/);
    assert.match(onboardB.lines.join('\n'), /AGORA_AGENT_ID or AGORA_DIR/);

    const defaultFile = path.join(defaultDir, 'client-identity.json');
    const saved = JSON.parse(fs.readFileSync(defaultFile, 'utf8'));
    assert.equal(saved[baseUrl].agentId, onboardA.identity.agentId);
    assert.equal(saved[baseUrl].handle, 'legacy-default-a');
    const rosterAfter = await fetch(`${baseUrl}/agents`).then((response) => response.json());
    assert.equal(rosterAfter.agents.length, rosterBefore.agents.length, 'refused onboarding did not POST a new presence');
    assert.equal(rosterAfter.agents.some((agent) => agent.handle === 'legacy-default-b'), false);

    // Since B never replaced the file, default-scope unlock and retire remain
    // authenticated as A and affect only A's lock and presence.
    const unlockA = await run(['unlock', '--mine'], {
      env: defaultEnv,
      baseUrl,
      identityDirOverride: defaultDir,
    });
    assert.equal(unlockA.code, 0);
    assert.match(unlockA.lines.join('\n'), new RegExp(lockA.lock.id));
    const retireA = await run(['retire'], {
      env: defaultEnv,
      baseUrl,
      identityDirOverride: defaultDir,
    });
    assert.equal(retireA.code, 0);
    const finalRoster = await fetch(`${baseUrl}/agents`).then((response) => response.json());
    assert.equal(finalRoster.agents.some((agent) => agent.id === onboardA.identity.agentId), false);

    // Once A is no longer live, the same default slot is reusable. This keeps
    // the safety stop bounded to real collisions instead of requiring cleanup.
    const onboardBAfterRetire = await run(['onboard', 'legacy-default-b', '--legacy-unscoped'], {
      env: defaultEnv,
      baseUrl,
      identityDirOverride: defaultDir,
    });
    assert.equal(onboardBAfterRetire.code, 0);
    const retireB = await run(['retire'], {
      env: defaultEnv,
      baseUrl,
      identityDirOverride: defaultDir,
    });
    assert.equal(retireB.code, 0);
  } finally {
    fs.rmSync(defaultDir, { recursive: true, force: true });
  }
});

test('WF-G344/WF-G345: unscoped registration is refused beside scoped identities, and a late key names the missing file', async () => {
  const sharedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-client-missed-scope-'));
  const lateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-client-late-scope-'));
  const scopedEnv = { AGORA_DIR: sharedDir, AGORA_AGENT_ID: 'wf-g344-owner', AGORA_PET: 'warrior' };
  const unscopedEnv = { AGORA_DIR: sharedDir, AGORA_PET: 'mage' };
  const legacyEnv = { AGORA_DIR: lateDir, AGORA_PET: 'dollman' };
  let scopedRegistration;
  let legacyRegistration;
  try {
    scopedRegistration = await run(['register', 'wf-g344-owner'], { env: scopedEnv, baseUrl });
    assert.equal(scopedRegistration.code, 0);
    const rosterBefore = await fetch(`${baseUrl}/agents`).then((response) => response.json());
    const refused = await run(['register', 'wf-g344-unscoped'], { env: unscopedEnv, baseUrl });
    assert.equal(refused.code, 1);
    assert.match(refused.lines.join('\n'), /AGORA_AGENT_ID is unset.*scoped identity file/);
    assert.match(refused.lines.join('\n'), /No presence was created/);
    assert.equal(fs.existsSync(path.join(sharedDir, 'client-identity.json')), false);
    const rosterAfter = await fetch(`${baseUrl}/agents`).then((response) => response.json());
    assert.equal(rosterAfter.agents.length, rosterBefore.agents.length);
    assert.equal(rosterAfter.agents.some((agent) => agent.handle === 'wf-g344-unscoped'), false);
    assert.equal((await run(['whoami'], { env: scopedEnv, baseUrl })).identity.agentId, scopedRegistration.identity.agentId);

    // Even a fresh checkout must refuse before POST. The earlier scoped-file
    // guard did not cover this case, so it silently created a stranded token.
    const freshEnv = { AGORA_PET: 'dollman' };
    const freshRoster = await fetch(`${baseUrl}/agents`).then((response) => response.json());
    const freshRefused = await run(['register', 'wf-g344-fresh'], {
      env: freshEnv, baseUrl, identityDirOverride: lateDir,
    });
    assert.equal(freshRefused.code, 1);
    assert.match(freshRefused.lines.join('\n'), /AGORA_AGENT_ID is unset/);
    assert.match(freshRefused.lines.join('\n'), /No presence was created/);
    assert.equal(fs.existsSync(path.join(lateDir, 'client-identity.json')), false);
    const afterFresh = await fetch(`${baseUrl}/agents`).then((response) => response.json());
    assert.equal(afterFresh.agents.length, freshRoster.agents.length);

    // Deliberate single-agent compatibility remains explicit. Adding a key
    // only afterward still cannot borrow its token or another agent's locks.
    legacyRegistration = await run(['register', 'wf-g344-legacy', '--legacy-unscoped'], { env: legacyEnv, baseUrl });
    assert.equal(legacyRegistration.code, 0);
    const lateEnv = { ...legacyEnv, AGORA_AGENT_ID: 'wf-g344-late' };
    const missing = await run(['lock', 'src/wf-g344-not-owned.ts'], { env: lateEnv, baseUrl });
    assert.equal(missing.code, 1);
    assert.match(missing.lines.join('\n'), /client-identity\.wf-g344-late\.json/);
    assert.match(missing.lines.join('\n'), /setting it only afterward does not move an unscoped identity/);
    const locks = await fetch(`${baseUrl}/locks`).then((response) => response.json());
    assert.equal(locks.locks.some((lock) => lock.paths.includes('src/wf-g344-not-owned.ts')), false);
  } finally {
    if (scopedRegistration?.code === 0) await run(['retire'], { env: scopedEnv, baseUrl });
    if (legacyRegistration?.code === 0) await run(['retire'], { env: legacyEnv, baseUrl });
    fs.rmSync(sharedDir, { recursive: true, force: true });
    fs.rmSync(lateDir, { recursive: true, force: true });
  }
});

test('explicit A and B scopes keep B locked and live when A unlocks and retires', async () => {
  const sharedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-client-explicit-safety-'));
  const envA = { AGORA_DIR: sharedDir, AGORA_AGENT_ID: 'explicit-a', AGORA_PET: 'mansui' };
  const envB = { AGORA_DIR: sharedDir, AGORA_AGENT_ID: 'explicit-b', AGORA_PET: 'dollman' };
  try {
    // Both explicit scopes get independent identity files and own one lock.
    const regA = await run(['register', 'explicit-safety-a'], { env: envA, baseUrl });
    const regB = await run(['register', 'explicit-safety-b'], { env: envB, baseUrl });
    assert.equal(regA.code, 0);
    assert.equal(regB.code, 0);
    const lockA = await run(['lock', 'src/explicit-a.ts'], { env: envA, baseUrl });
    const lockB = await run(['lock', 'src/explicit-b.ts'], { env: envB, baseUrl });
    assert.equal(lockA.code, 0);
    assert.equal(lockB.code, 0);

    // A may release all of A's own locks without matching B's agent id.
    const unlockA = await run(['unlock', '--mine'], { env: envA, baseUrl });
    assert.equal(unlockA.code, 0);
    assert.match(unlockA.lines.join('\n'), new RegExp(lockA.lock.id));
    const locksAfterUnlock = await fetch(`${baseUrl}/locks`).then((response) => response.json());
    assert.ok(locksAfterUnlock.locks.some((lock) => lock.id === lockB.lock.id), "B's lock survived A's unlock --mine");

    // A's retirement removes A alone. B remains present and continues to own
    // the same lock, proving the saved tokens never crossed identity scopes.
    const retireA = await run(['retire'], { env: envA, baseUrl });
    assert.equal(retireA.code, 0);
    const rosterAfterRetire = await fetch(`${baseUrl}/agents`).then((response) => response.json());
    assert.equal(rosterAfterRetire.agents.some((agent) => agent.id === regA.identity.agentId), false);
    assert.equal(rosterAfterRetire.agents.some((agent) => agent.id === regB.identity.agentId), true);
    const locksAfterRetire = await fetch(`${baseUrl}/locks`).then((response) => response.json());
    assert.ok(locksAfterRetire.locks.some((lock) => lock.id === lockB.lock.id), "B's lock survived A's retire");

    // Clean the isolated B presence so this regression leaves no state behind
    // for later tests sharing the same in-process server.
    const retireB = await run(['retire'], { env: envB, baseUrl });
    assert.equal(retireB.code, 0);
  } finally {
    fs.rmSync(sharedDir, { recursive: true, force: true });
  }
});

test('handle-claim uniqueness: registering a live agent\'s handle -> 409; --random auto-claims a free name', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-client-claim-'));
  try {
    // First agent claims "solo-worker".
    const first = await run(['register', 'solo-worker'], { env: { AGORA_DIR: dir, AGORA_AGENT_ID: 'first', AGORA_PET: 'gf-sd' }, baseUrl });
    assert.equal(first.code, 0);

    // A second agent trying the SAME live handle is refused (no silent shared identity).
    const clash = await run(['register', 'solo-worker'], { env: { AGORA_DIR: dir, AGORA_AGENT_ID: 'second', AGORA_PET: 'dream-girl' }, baseUrl });
    assert.equal(clash.code, 1);
    assert.match(clash.lines.join('\n'), /already claimed/);

    // --random claims a distinct, unique handle instead.
    const rnd = await run(['register', '--random', 'solo-worker'], { env: { AGORA_DIR: dir, AGORA_AGENT_ID: 'second', AGORA_PET: 'dream-girl' }, baseUrl });
    assert.equal(rnd.code, 0);
    assert.notEqual(rnd.identity.handle, 'solo-worker');
    assert.match(rnd.identity.handle, /^solo-worker-[0-9a-f]{6}$/);
    assert.notEqual(rnd.identity.agentId, first.identity.agentId);

    // --allow-duplicate opts out of the claim check (legacy escape hatch).
    const dup = await run(['register', 'solo-worker', '--allow-duplicate'], { env: { AGORA_DIR: dir, AGORA_AGENT_ID: 'third', AGORA_PET: 'nous-girl' }, baseUrl });
    assert.equal(dup.code, 0);
    assert.equal(dup.identity.handle, 'solo-worker');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('agent provenance: register stamps model + session id; whoami and agents surface them', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-client-prov-'));
  const e = { AGORA_DIR: dir, AGORA_AGENT_ID: 'prov', AGORA_PET: 'gf-sd' };
  try {
    const reg = await run(
      ['register', 'prov-agent', '--model', 'claude-opus-4-8', '--session', 'conv-abc123'],
      { env: e, baseUrl },
    );
    assert.equal(reg.code, 0);
    assert.equal(reg.identity.model, 'claude-opus-4-8');
    assert.equal(reg.identity.sessionId, 'conv-abc123');
    assert.ok(reg.identity.registeredAt, 'checkout timestamp returned');

    // The identity file persists them so the agent can query itself offline.
    const who = await run(['whoami'], { env: e, baseUrl });
    assert.equal(who.code, 0);
    const w = who.lines.join('\n');
    assert.match(w, /model:\s+claude-opus-4-8/);
    assert.match(w, /sessionId:\s+conv-abc123/);
    assert.match(w, /checkedIn:\s+\d{4}-\d{2}-\d{2}T/);

    // The roster shows the model + how long ago each agent checked in.
    const agents = await run(['agents'], { env: e, baseUrl });
    const holder = agents.agents.find((a) => a.handle === 'prov-agent');
    assert.ok(holder, 'agent present in roster');
    assert.equal(holder.model, 'claude-opus-4-8');
    assert.ok(holder.registeredAt, 'registeredAt exposed on the roster');
    assert.match(agents.lines.join('\n'), /\[claude-opus-4-8\]/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Board task agora-6f81 / WF-G64: short task-id prefixes on state-changing verbs.
// ---------------------------------------------------------------------------
test('task state/done accept a unique short-id prefix, ignore case, and refuse an ambiguous one', async () => {
  const reg = await cli(['register', 'prefix-tester', '--note', 'prefix test']);
  assert.equal(reg.code, 0);
  const token = reg.identity.token;
  const a = await cli(['task', 'new', 'prefix alpha', '--campaign', 'none', '--token', token]);
  const b = await cli(['task', 'new', 'prefix beta', '--campaign', 'none', '--token', token]);
  assert.equal(a.code, 0);
  assert.equal(b.code, 0);
  await cli(['task', 'claim', a.task.id, '--token', token]);

  // 1. Case does not matter: the upper-cased full id still names the task.
  const upper = await cli(['task', 'state', a.task.id.toUpperCase(), 'in_progress', '--token', token]);
  assert.equal(upper.code, 0, upper.lines.join('\n'));
  assert.equal(upper.task.id, a.task.id);

  // 2. A prefix shared by every task on the board is refused, with the candidates listed.
  const ambiguous = await cli(['task', 'state', 'agora-', 'in_progress', '--token', token]);
  assert.equal(ambiguous.code, 1);
  assert.match(ambiguous.lines.join('\n'), /ambiguous task id "agora-" matches \d+ tasks/);

  // 3. The shortest prefix that is unique on the board resolves to the full id.
  const board = await cli(['tasks']);
  assert.equal(board.code, 0);
  const all = (await (await fetch(`${baseUrl}/tasks`)).json()).tasks.map((t) => t.id);
  let prefix = a.task.id;
  while (prefix.length > 1 && all.filter((id) => id.startsWith(prefix.slice(0, -1))).length === 1) prefix = prefix.slice(0, -1);
  assert.notEqual(prefix, a.task.id, 'the board must allow at least one char to be dropped');
  const done = await cli(['task', 'done', prefix, '--result', 'prefix ok', '--token', token]);
  assert.equal(done.code, 0, done.lines.join('\n'));
  assert.equal(done.task.id, a.task.id);
  assert.equal(done.task.state, 'done');
});

// WF-G212 fixtures compare complete text, not presumed sweep authorship. Git
// commits and every file write stay inside these disposable temporary repos.
function trackingTextFixture(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-tracking-text-'));
  t.after(() => { assert.equal(path.dirname(root), path.resolve(os.tmpdir())); fs.rmSync(root, { recursive: true, force: true }); });
  const git = (...args) => execFileSync('git', ['-c', 'core.fsmonitor=false', ...args], { cwd: root, stdio: 'ignore' });
  git('init', '-q'); git('config', 'user.email', 'fixture@example.test'); git('config', 'user.name', 'Disposable fixture');
  const put = (name, bytes) => { fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true }); fs.writeFileSync(path.join(root, name), bytes); };
  for (const [name, bytes] of Object.entries(files)) put(name, bytes);
  git('add', '.'); git('commit', '-qm', 'fixture baseline');
  return { root, git, put };
}

test('WF-G212: lock advice identifies only added tracking text and states its evidence limits', async t => {
  const { dirtyInWorktree } = await import('./client-runtime.mjs');
  const base = '/**\n * Some unfinished intent.\n */\nexport const value = 1;\n';
  const f = trackingTextFixture(t, { 'tracked.ts': base });
  const changed = base.replace(' */', ' * (tracked in Agora task agora-3098).\n */') + '// tracked in Agora task agora-4fa0.62\n';
  f.put('tracked.ts', changed);
  const before = fs.readFileSync(path.join(f.root, 'tracked.ts'));
  const hint = dirtyInWorktree(['tracked.ts'], f.root, { lockGranted: true })[0];
  assert.match(hint, /added sweep-format tracking-marker text only versus HEAD after line-ending normalization/);
  assert.match(hint, /2 line\(s\), task citation\(s\) agora-3098, agora-4fa0\.62/);
  assert.match(hint, /granted this lock without a conflicting active lock, but Git cannot identify who made the change/);
  assert.match(hint, /Text comparison does not prove unchanged behavior/);
  assert.doesNotMatch(hint, /sibling's in-flight work|run git diff/);
  assert.deepEqual(fs.readFileSync(path.join(f.root, 'tracked.ts')), before);
  f.put('tracked.ts', changed.replace(/\n/g, '\r\n'));
  assert.match(dirtyInWorktree(['tracked.ts'], f.root)[0], /normalization.*EOL: CRLF/);
  f.git('add', 'tracked.ts');
  assert.match(dirtyInWorktree(['tracked.ts'], f.root)[0], /tracking-marker text only/, 'staged additions are compared with HEAD, not hidden by the index');
});

test('WF-G212: non-marker changes, missing baselines and unreadable evidence retain ordinary advice', async t => {
  const { dirtyInWorktree } = await import('./client-runtime.mjs');
  const base = 'export const value = 1;\n';
  const marker = '// (tracked in Agora task agora-3098).\n';
  const f = trackingTextFixture(t, { 'tracked.ts': base, 'existing-marker.ts': marker + base });
  for (const changed of [marker + 'export const value = 2;\n', marker + ' export const value = 1;\n',
    '// (tracked in Agora task agora-3098). extra\n' + base, 'export const value = 1; // (tracked in Agora task agora-3098).\n',
    '// (tracked in Agora task not-an-id).\n' + base, marker + base.replace(/\n/g, '\r'),
    Buffer.from(marker + base + '\0'), Buffer.concat([Buffer.from(marker + base), Buffer.from([255])]),
    marker.repeat(65) + base, marker + base + 'x'.repeat(2 * 1024 * 1024)]) {
    f.put('tracked.ts', changed);
    const hints = dirtyInWorktree(['tracked.ts'], f.root);
    assert.ok(hints.length, 'dirty evidence stays visible');
    assert.ok(hints.every(hint => !/tracking-marker text only/.test(hint)), hints.join('\n'));
    assert.match(hints.join('\n'), /preserve any existing changes/);
  }
  f.put('existing-marker.ts', marker.replace('3098', '9999') + base);
  assert.doesNotMatch(dirtyInWorktree(['existing-marker.ts'], f.root)[0], /tracking-marker text only/, 'changed existing metadata is not an addition');
  f.put('existing-marker.ts', base);
  assert.doesNotMatch(dirtyInWorktree(['existing-marker.ts'], f.root)[0], /tracking-marker text only/, 'removed metadata is not an addition');
  f.put('new.ts', marker + base);
  const untracked = dirtyInWorktree(['new.ts'], f.root)[0];
  assert.match(untracked, /is untracked before your lock/); assert.match(untracked, /git diff shows NOTHING/);
  assert.doesNotMatch(untracked, /tracking-marker text only|run git diff/);
  f.git('add', 'new.ts');
  assert.doesNotMatch(dirtyInWorktree(['new.ts'], f.root)[0], /tracking-marker text only/, 'new staged file has no HEAD baseline');
  fs.unlinkSync(path.join(f.root, 'tracked.ts'));
  assert.match(dirtyInWorktree(['tracked.ts'], f.root).join('\n'), /Check why it was removed/);
});

test('WF-G212: physical escape, symbolic targets and read failures keep preservation advice', async t => {
  const { dirtyInWorktree } = await import('./client-runtime.mjs');
  const base = 'export const value = 1;\n';
  const f = trackingTextFixture(t, { 'tracked.ts': base });
  f.put('tracked.ts', '// tracked in Agora task agora-3098\n' + base);
  const target = path.join(f.root, 'tracked.ts'), before = fs.readFileSync(target);
  for (const scenario of ['physical-escape', 'symbolic-target', 'read-failure']) {
    const name = scenario === 'physical-escape' ? 'realpathSync' : scenario === 'symbolic-target' ? 'lstatSync' : 'openSync';
    const original = fs[name];
    let reached = false;
    t.mock.method(fs, name, function (file, ...args) {
      if (file === target) {
        reached = true;
        if (scenario === 'physical-escape') return path.join(f.root, '..', 'outside.ts');
        if (scenario === 'symbolic-target') return { isSymbolicLink: () => true };
        throw Object.assign(new Error('fixture read unavailable'), { code: 'EACCES' });
      }
      return original.call(this, file, ...args);
    });
    try {
      const hints = dirtyInWorktree(['tracked.ts'], f.root);
      assert.ok(reached, scenario); assert.match(hints.join('\n'), /preserve any existing changes/);
      assert.doesNotMatch(hints.join('\n'), /tracking-marker text only/);
    } finally { t.mock.restoreAll(); }
    assert.deepEqual(fs.readFileSync(target), before);
  }
});

test('WF-G212: marker-like string text and concurrent replacement never imply semantic safety', async t => {
  const { dirtyInWorktree } = await import('./client-runtime.mjs');
  const base = 'export const note = `\nbase\n`;\n';
  const f = trackingTextFixture(t, { 'template.ts': base });
  const changed = base.replace('base\n', '// tracked in Agora task agora-3098\nbase\n');
  f.put('template.ts', changed);
  const hint = dirtyInWorktree(['template.ts'], f.root)[0];
  assert.match(hint, /tracking-marker text only/); assert.match(hint, /does not prove unchanged behavior/);
  // Replace after the bounded read but before the last path check. No stale
  // snapshot may receive the annotation-only label over the new dirty bytes.
  const original = fs.lstatSync;
  let calls = 0;
  t.mock.method(fs, 'lstatSync', function (target, ...args) {
    if (target === path.join(f.root, 'template.ts') && ++calls === 2) f.put('template.ts', changed + 'export const other = 2;\n');
    return original.call(this, target, ...args);
  });
  try { assert.doesNotMatch(dirtyInWorktree(['template.ts'], f.root)[0], /tracking-marker text only/); }
  finally { t.mock.restoreAll(); }
  assert.equal(calls, 2);
});

// WF-G129 (2026-09-09): a free lock on a dirty file must say so.
test('WF-G129: dirtyInWorktree names files that already differ from HEAD and stays silent on clean ones', async () => {
  const { dirtyInWorktree } = await import('./client-runtime.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-dirty-'));
  try {
    const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    git('init', '-q');
    git('config', 'user.email', 't@t');
    git('config', 'user.name', 't');
    fs.writeFileSync(path.join(root, 'clean.ts'), 'a\n');
    fs.writeFileSync(path.join(root, 'dirty.ts'), 'a\n');
    git('add', '.');
    git('commit', '-q', '-m', 'base');
    fs.writeFileSync(path.join(root, 'dirty.ts'), 'b\n');
    const oldWrite = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    fs.utimesSync(path.join(root, 'dirty.ts'), oldWrite, oldWrite);
    fs.writeFileSync(path.join(root, 'new.ts'), 'c\n');
    const hints = dirtyInWorktree(['clean.ts', 'dirty.ts', 'new.ts'], root);
    assert.equal(hints.length, 2, hints.join('\n'));
    assert.match(hints.find((h) => h.startsWith('dirty.ts')), /already modified/);
    assert.match(hints.find((h) => h.startsWith('new.ts')), /untracked/);
    // WF-G275: git ls-files --eol is silently empty for untracked files, so
    // the lock warning itself must report the on-disk line endings.
    assert.match(hints.find((h) => h.startsWith('new.ts')), /EOL: LF \(1 LF, 0 CRLF, 0 bare CR\)/);
    fs.writeFileSync(path.join(root, 'crlf.ts'), 'a\r\nb\r\n');
    fs.writeFileSync(path.join(root, 'mixed.ts'), 'a\nb\r\n');
    fs.writeFileSync(path.join(root, 'no-newline.ts'), 'a');
    fs.writeFileSync(path.join(root, 'binary.bin'), Buffer.from([0, 13, 10]));
    fs.writeFileSync(path.join(root, 'large.ts'), `a\n${'x'.repeat(256 * 1024)}b\r\n`);
    assert.match(dirtyInWorktree(['crlf.ts'], root)[0], /EOL: CRLF \(0 LF, 2 CRLF, 0 bare CR\)/);
    assert.match(dirtyInWorktree(['mixed.ts'], root)[0], /EOL: mixed \(1 LF, 1 CRLF, 0 bare CR\)/);
    assert.match(dirtyInWorktree(['no-newline.ts'], root)[0], /EOL: no line endings detected/);
    assert.match(dirtyInWorktree(['binary.bin'], root)[0], /EOL: unavailable \(binary-looking file\)/);
    assert.match(dirtyInWorktree(['large.ts'], root)[0], /EOL: LF \(1 LF, 0 CRLF, 0 bare CR; sampled first 262144 byte\(s\)\)/);
    assert.ok(hints.every((h) => /Git cannot identify who made the change/.test(h)), hints.join('\n'));
    assert.ok(hints.every((h) => !/sibling's in-flight work/.test(h)), hints.join('\n'));
    const granted = dirtyInWorktree(['dirty.ts'], root, { lockGranted: true });
    assert.match(granted[0], /granted this lock without a conflicting active lock/);
    assert.doesNotMatch(granted[0], /sibling's in-flight work/);
    // WF-G238: age is evidence, not an authorship claim. A days-old deferral
    // should not read as if a live sibling were editing the file right now.
    const age = Number(granted[0].match(/last written (\d+) minute\(s\) ago/)?.[1]);
    assert.ok(age >= 4000, granted[0]);
    // WF-G292: the next step must also work when a packet prohibits Git.
    assert.match(granted[0], /Read the current file before editing/i);
    assert.doesNotMatch(granted[0], /run git diff/i);
    fs.unlinkSync(path.join(root, 'dirty.ts'));
    const deleted = dirtyInWorktree(['dirty.ts'], root);
    assert.match(deleted.find((h) => /deleted before your lock/.test(h)), /Check why it was removed before recreating it/i);
    assert.deepEqual(dirtyInWorktree(['clean.ts'], root), []);
    assert.deepEqual(dirtyInWorktree([], root), []);
    // WF-G279 supersedes WF-G183's history-only guess: creation is quiet only
    // when declared. Old-path history cannot be hidden by that declaration.
    assert.match(dirtyInWorktree(['brand-new.ts'], root)[0], /does not exist.*WF-G279/);
    assert.deepEqual(dirtyInWorktree(['brand-new.ts'], root, { creates: ['brand-new.ts'] }), []);
    // WF-G279: a typo can look like a new file under an existing directory.
    // If the same filename already exists elsewhere, the lock must name the
    // real candidate instead of silently granting a false sense of ownership.
    fs.mkdirSync(path.join(root, 'src', 'hooks', 'combat'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'hooks', 'useBattleMap.ts'), 'export {};\n');
    git('add', 'src/hooks/useBattleMap.ts');
    git('commit', '-q', '-m', 'add hook');
    const misplaced = dirtyInWorktree(['src/hooks/combat/useBattleMap.ts'], root);
    assert.equal(misplaced.length, 1, misplaced.join('\n'));
    assert.match(misplaced[0], /src\/hooks\/combat\/useBattleMap\.ts.*does not exist.*src\/hooks\/useBattleMap\.ts/);
    assert.match(dirtyInWorktree(['src/hooks/combat/newModule.ts'], root)[0], /does not exist.*WF-G279/);
    assert.deepEqual(dirtyInWorktree(['src/hooks/combat/newModule.ts'], root,
      { creates: ['src/hooks/combat/newModule.ts'] }), []);
    assert.deepEqual(dirtyInWorktree(['src/hooks/combat/useBattleMap.ts'], root,
      { creates: ['src/hooks/combat/useBattleMap.ts'] }), [], 'explicit intent allows same-named new files');
    // 2. A path whose parent directory does not exist either is worth naming.
    const ghost = dirtyInWorktree(['moved/away.test.ts'], root);
    assert.equal(ghost.length, 1);
    assert.match(ghost[0], /neither does its parent directory/);
    // 3. A path a RENAME moved away is the real stale-path case, and the hint
    //    names where it went.
    git('mv', 'clean.ts', 'renamed.ts');
    git('commit', '-q', '-am', 'rename');
    const stale = dirtyInWorktree(['clean.ts'], root);
    assert.equal(stale.length, 1, stale.join(String.fromCharCode(10)));
    assert.match(stale[0], /RENAMED to renamed\.ts/);
    assert.match(dirtyInWorktree(['clean.ts'], root, { creates: ['clean.ts'] })[0], /RENAMED to renamed\.ts/);
    assert.match(dirtyInWorktree(['renamed.ts'], root, { creates: ['renamed.ts'] })[0], /already exists despite --creates/);
    // WF-G144: a path into a SIBLING checkout is checked there, not here.
    const sib = path.join(path.dirname(root), path.basename(root) + '-sibling');
    fs.mkdirSync(sib, { recursive: true });
    try {
      const sgit = (...args) => execFileSync('git', args, { cwd: sib, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      sgit('init', '-q');
      sgit('config', 'user.email', 't@t');
      sgit('config', 'user.name', 't');
      const sibName = path.basename(sib);
      // A repo with NO commits gets one summary line instead of per-file hints.
      fs.writeFileSync(path.join(sib, 'first.md'), 'x\n');
      const bare = dirtyInWorktree([`${sibName}/first.md`], root);
      assert.equal(bare.length, 1, bare.join('\n'));
      assert.match(bare[0], /has no commits/);
      sgit('add', '.');
      sgit('commit', '-q', '-m', 'base');
      fs.writeFileSync(path.join(sib, 'README.md'), 'hi\n');
      const viaSibling = dirtyInWorktree([`${sibName}/README.md`, `${sibName}/missing.md`], root);
      // Sibling missing paths need the same explicit creation intent.
      assert.equal(viaSibling.filter((h) => /does not exist/.test(h)).length, 1, viaSibling.join('\n'));
      assert.deepEqual(dirtyInWorktree([`${sibName}/missing.md`], root,
        { creates: [`${sibName}/missing.md`] }), []);
      // The sibling checkout is still the one that gets read, not this one.
      assert.match(viaSibling.find((h) => /untracked/.test(h)), /README\.md \[.*-sibling\]/);
      // A path the SIBLING has held and then lost is still named there.
      sgit('rm', '-q', 'first.md');
      sgit('commit', '-q', '-m', 'drop first');
      const lost = dirtyInWorktree([`${sibName}/first.md`], root);
      assert.equal(lost.length, 1, lost.join('\n'));
      assert.match(lost[0], /does not exist in the worktree/);
    } finally {
      fs.rmSync(sib, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('task edit: in-place correction, append-body, and note annotations (WF-G149, WF-G153)', async () => {
  const reg = await cli(['register', 'orch.task-editor', '--role', 'orchestrator', '--session', 'sess-edit-1']);
  assert.equal(reg.code, 0, reg.lines.join('\n'));
  const created = await cli(['task', 'new', 'Initial title', '--body', 'line 1']);
  assert.equal(created.code, 0);
  const taskId = created.task.id;

  // Edit title and append body (WF-G153)
  const edited = await cli(['task', 'edit', taskId, '--title', 'Updated title', '--append-body', 'line 2', '--reason', 'clarification']);
  assert.equal(edited.code, 0);
  assert.equal(edited.task.title, 'Updated title');
  assert.equal(edited.task.body, 'line 1\nline 2');

  // Reason-only annotation by orchestrator (WF-G149)
  const annotated = await cli(['task', 'edit', taskId, '--reason', 'PARKED: waiting for human']);
  assert.equal(annotated.code, 0);
  const lastHist = annotated.task.history[annotated.task.history.length - 1];
  assert.equal(lastHist.action, 'note');
  assert.equal(lastHist.reason, 'PARKED: waiting for human');
});

test('campaign list --mine and campaign show: lead + deputies with open/done counts (WF-G154)', async () => {
  const reg = await cli(['register', 'orch.camp-tester', '--role', 'orchestrator', '--session', 'sess-camp-1']);
  assert.equal(reg.code, 0);

  // Claim a lead campaign
  const claimLead = await cli(['campaign', 'claim', 'camp-lead-1', '--role', 'lead', '--scope', 'Lead scope', '--path', 'tools/agora/path-a']);
  assert.equal(claimLead.code, 0);
  const leadId = claimLead.campaign.id;

  // Claim a deputy campaign under that lead
  const claimDep = await cli(['campaign', 'claim', 'camp-dep-1', '--role', 'deputy', '--lead', leadId, '--scope', 'Deputy scope', '--path', 'tools/agora/path-a']);
  assert.equal(claimDep.code, 0);
  const depId = claimDep.campaign.id;

  // Create tasks in lead and deputy campaigns
  const tLead1 = await cli(['task', 'new', 'Lead Task 1', '--campaign', leadId]);
  assert.equal(tLead1.code, 0);
  const tLead2 = await cli(['task', 'new', 'Lead Task 2', '--campaign', leadId]);
  assert.equal(tLead2.code, 0);
  const tDep1 = await cli(['task', 'new', 'Deputy Task 1', '--campaign', depId]);
  assert.equal(tDep1.code, 0);

  // Complete one task in lead campaign
  const doneLead1 = await cli(['task', 'done', tLead1.task.id, '--result', 'proof']);
  assert.equal(doneLead1.code, 0);

  // 1. Test campaign list --mine
  const listMine = await cli(['campaign', 'list', '--mine']);
  assert.equal(listMine.code, 0);
  const listText = listMine.lines.join('\n');
  assert.match(listText, new RegExp(leadId));
  assert.match(listText, new RegExp(depId));
  assert.match(listText, /tasks: 1 open, 1 done \(2 total\)/);
  assert.match(listText, /tasks: 1 open, 0 done \(1 total\)/);

  // 2. Test campaign show <leadId>
  const showLead = await cli(['campaign', 'show', leadId]);
  assert.equal(showLead.code, 0);
  const showText = showLead.lines.join('\n');
  assert.match(showText, /deputies \(1\):/);
  assert.match(showText, new RegExp(depId));
  assert.match(showText, /tasks by state:/);
  assert.match(showText, /1 done/);
  assert.match(showText, /1 open/);
  assert.match(showText, /attended: no/);
});

test('WF-G338: numbered pet briefs register with an available catalog identity', async () => {
  const privateServerDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-numbered-pet-srv-'));
  const privateClientDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-numbered-pet-id-'));
  const privateApp = createAgoraServer({ dir: privateServerDir });
  try {
    await new Promise((resolve) => privateApp.listen(0, resolve));
    const privateUrl = `http://127.0.0.1:${privateApp.server.address().port}`;
    const assigned = [];
    for (const [index, requested] of ['chef-4', 'chef-5', 'chef-6', 'chef-7'].entries()) {
      const handle = `numbered-chef-${index + 1}`;
      const result = await run(['register', handle, '--pet', requested], {
        baseUrl: privateUrl,
        env: { AGORA_DIR: privateClientDir, AGORA_AGENT_ID: handle },
      });
      assert.equal(result.code, 0, `${requested}: ${result.lines.join('\n')}`);
      assert.match(result.lines.join('\n'), new RegExp(`Requested pet "${requested}".*registered with`));
      assigned.push(result.identity.pet.slug);
    }
    assert.deepEqual(assigned.slice(0, 3), ['chef', 'chef-2', 'chef-3']);
    assert.equal(new Set(assigned).size, 4, 'concurrent workers cannot receive the same pet');

    const invalid = await run(['register', 'unknown-family-worker', '--pet', 'not-a-family-4'], {
      baseUrl: privateUrl,
      env: { AGORA_DIR: privateClientDir, AGORA_AGENT_ID: 'unknown-family-worker' },
    });
    assert.equal(invalid.code, 1, 'unrelated unknown slugs remain invalid');
    assert.match(invalid.lines.join('\n'), /unknown petSlug/i);
    const roster = await fetch(`${privateUrl}/agents`).then((response) => response.json());
    assert.equal(roster.agents.length, 4);
  } finally {
    await privateApp.close();
    fs.rmSync(privateServerDir, { recursive: true, force: true });
    fs.rmSync(privateClientDir, { recursive: true, force: true });
  }
});

// Verify that open tasks with typed dependency objects (`{ id, type }`) format
// the dependency task ID prefix in `tasks` and `tasks --group-by-category`
// listings instead of coercing the object to `[object ` (WF-G354).
test('WF-G354: tasks listing formats typed dependency objects by id prefix instead of [object', async () => {
  const reg = await cli(['register', 'worker.dep-format', '--session', 'sess-dep-fmt-1']);
  assert.equal(reg.code, 0, reg.lines.join('\n'));

  const upstream = await cli(['task', 'new', 'Upstream prerequisite task']);
  assert.equal(upstream.code, 0, upstream.lines.join('\n'));
  const upstreamId = upstream.task.id;
  const expectedPrefix = upstreamId.slice(0, 8);

  const downstream = await cli([
    'task',
    'new',
    'Downstream task with typed dep',
    '--category',
    'tooling',
    '--dep',
    `${upstreamId}:blocks`,
  ]);
  assert.equal(downstream.code, 0, downstream.lines.join('\n'));

  const flatList = await cli(['tasks', '--state', 'open']);
  assert.equal(flatList.code, 0);
  const flatText = flatList.lines.join('\n');
  assert.doesNotMatch(flatText, /\[object /);
  assert.match(flatText, new RegExp(`\\(deps: ${expectedPrefix}\\)`));

  const groupedList = await cli(['tasks', '--state', 'open', '--group-by-category']);
  assert.equal(groupedList.code, 0);
  const groupedText = groupedList.lines.join('\n');
  assert.doesNotMatch(groupedText, /\[object /);
  assert.match(groupedText, new RegExp(`\\(deps: ${expectedPrefix}\\)`));
});

// WF-G290: a partly-applied ruling must record covered scope, uncovered scope,
// and the follow-up question without either losing landed work or closing done.
test('WF-G290: task state partial / --partial records covered scope, uncovered scope, and follow-up question', async () => {
  const reg = await cli(['register', 'worker.partial-ruling', '--session', 'sess-partial-1']);
  assert.equal(reg.code, 0, reg.lines.join('\n'));

  const created = await cli([
    'task',
    'new',
    'Repair Enchantment Gap spells with creature-type gate',
    '--standalone',
    '--reason',
    'WF-G290 regression fixture',
    '--body',
    'Apply creature-type gate ruling across the 20 Enchantment Gap spell files.',
  ]);
  assert.equal(created.code, 0, created.lines.join('\n'));
  const taskId = created.task.id;

  // Missing covered/uncovered scope is refused before mutating state.
  const missingScope = await runCandidate(['task', 'state', taskId, 'partial'], { env, baseUrl });
  assert.equal(missingScope.code, 1);
  assert.match(missingScope.lines.join('\n'), /task state partial needs both what landed/);

  const partial = await runCandidate([
    'task',
    'state',
    taskId,
    'partial',
    '--covered',
    '17 enchantment spells gated + fire-bolt upcast fixed',
    '--uncovered',
    'hex, power-word-heal, and antipathy-sympathy have no creature-type restriction in 2024 text',
    '--question',
    'Should hex, power-word-heal, and antipathy-sympathy be exempt from the creature-type gate?',
  ], { env, baseUrl });
  assert.equal(partial.code, 0, partial.lines.join('\n'));
  assert.equal(partial.task.state, 'blocked');
  assert.match(partial.lines.join('\n'), /-> \[blocked \(partial\)\]/);
  assert.match(partial.task.result, /PARTIAL RULING LANDED: 17 enchantment spells gated/);
  assert.match(partial.task.result, /UNCOVERED SCOPE: hex, power-word-heal/);
  assert.match(partial.task.result, /FOLLOW-UP QUESTION: Should hex/);

  const shown = await runCandidate(['task', 'show', taskId], { env, baseUrl });
  assert.equal(shown.code, 0);
  const shownText = shown.lines.join('\n');
  assert.match(shownText, /blocked reason: \[PARTIAL RULING\] covered: 17 enchantment spells gated/);
  assert.match(shownText, /ruling status: PARTIAL/);
});

// WF-G227, WF-G271, WF-G309: lock response reports modified date, live/recent
// holder status vs long-standing drift, and inherited scoped typecheck status.
test('WF-G227/WF-G271/WF-G309: dirtyInWorktree reports modified date, holder/drift status, and scoped typecheck errors at lock time', async () => {
  const { dirtyInWorktree } = await import('./client-runtime.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-wfg227-309-'));
  try {
    const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    git('init', '-q');
    git('config', 'user.email', 't@t');
    git('config', 'user.name', 't');
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'architectureStyle.ts'), 'export const kit = "valid";\n');
    git('add', '.');
    git('commit', '-q', '-m', 'snapshot');

    fs.writeFileSync(path.join(root, 'src', 'architectureStyle.ts'), 'export const kit: number = "keep-ashlar";\n');
    const oldDate = new Date('2026-08-26T12:00:00Z');
    fs.utimesSync(path.join(root, 'src', 'architectureStyle.ts'), oldDate, oldDate);

    // 1. Long-standing drift with no live holder (WF-G227 / WF-G271) + inherited tsc errors (WF-G309)
    const driftWarnings = dirtyInWorktree(['src/architectureStyle.ts'], root, {
      lockGranted: true,
      checkTypes: true,
      typecheckRunner: () =>
        'src/architectureStyle.ts(60,5): error TS2322: Type \'"keep-ashlar"\' is not assignable to type \'ConstructionKitId\'.\n' +
        'src/architectureStyle.ts(740,5): error TS2367: This comparison appears to be unintentional.\n',
    });
    assert.equal(driftWarnings.length, 1);
    assert.match(driftWarnings[0], /modified 2026-08-26, no live holder; long-standing working-tree drift/);
    assert.match(driftWarnings[0], /Scoped typecheck at lock time \(WF-G309\): 2 inherited error\(s\)/);
    assert.match(driftWarnings[0], /L60: error TS2322/);

    // 2. Recently touched by a named registered agent (WF-G271)
    const contendedWarnings = dirtyInWorktree(['src/architectureStyle.ts'], root, {
      lockGranted: true,
      recentHolders: {
        'src/architectureStyle.ts': 'no live holder, recently touched by w5-worldforge (agora-70a1)',
      },
      checkTypes: true,
      typecheckRunner: () => '',
    });
    assert.equal(contendedWarnings.length, 1);
    assert.match(contendedWarnings[0], /recently touched by w5-worldforge \(agora-70a1\)/);
    assert.match(contendedWarnings[0], /Scoped typecheck at lock time \(WF-G309\): 0 inherited error\(s\) \(tsc clean at lock time\)/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});


