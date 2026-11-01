// Private board fixtures prove durable delivery without altering live packets
// or shared test controls. Failure receipts must not trigger mutation retries.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createAgoraServer } from './server.mjs';
import { run } from './client.mjs';
import { buildPrompt } from './orchestrate.mjs';
import { controlNoticeRecipients, controlNoticeBody, publishControlNotice } from './controlNotice.mjs';
import * as noticeApi from './controlNotice.mjs';

test('WF307: reviewed current symbols append durably without losing a concurrent sibling brief', async () => {
  const { captureSourceReview, inspectSourceReviews } = await import('./taskLint.mjs');
  let source = '// BEGIN\nbaseAttack();\n// END';
  const input = { id: 'review-v1', file: 'src/attack.ts', start: '// BEGIN', end: '// END', symbols: ['baseAttack'], reason: 'Reviewed initial attack.' };
  const first = captureSourceReview(input, { readSource: () => source });
  const b = fakeBoard(); b.tasks[0].body += '\nSOURCE-REVIEW: ' + JSON.stringify(first);
  source = source.replace('baseAttack();', 'baseAttack();\nsiblingRider();'); const original = b.tasks[0].body;
  const next = { ...input, id: 'review-v2', taskId: b.tasks[0].id, supersedes: first.id, symbols: ['baseAttack', 'siblingRider'], reason: 'Preserve the newly landed sibling rider during replacement.' };
  const receipt = await noticeApi.publishSourceReview(plan(), next, { run: b.run, readSource: () => source });
  assert.deepEqual(receipt.appended, ['agora-a']); assert.ok(b.tasks[0].body.startsWith(original)); assert.match(b.tasks[0].body, /concurrent claimant note/);
  assert.equal(inspectSourceReviews(b.tasks[0], { readSource: () => source }).issues.length, 0);
  const writes = b.calls.filter(args => args[0] === 'task').length;
  const repeat = await noticeApi.publishSourceReview(plan(), next, { run: b.run, readSource: () => source });
  assert.deepEqual(repeat.alreadyPresent, ['agora-a']); assert.equal(b.calls.filter(args => args[0] === 'task').length, writes);
  assert.equal(receipt.review.symbols.includes('siblingRider'), true);
});

test('WF307: unknown append outcomes, stale id reuse, workers and closed tasks do not cause retries', async () => {
  const source = '// BEGIN\nbaseAttack();\n// END';
  const input = { id: 'review-v1', taskId: 'agora-a', file: 'src/attack.ts', start: '// BEGIN', end: '// END', symbols: ['baseAttack'], reason: 'Reviewed current attack.' };
  const worker = fakeBoard({ role: 'worker' }); await assert.rejects(() => noticeApi.publishSourceReview(plan(), input, { run: worker.run, readSource: () => source }), /live orchestrator/);
  assert.equal(worker.calls.some(args => args[0] === 'task'), false);
  const closed = fakeBoard(); closed.tasks[0].state = 'done'; await assert.rejects(() => noticeApi.publishSourceReview(plan(), input, { run: closed.run, readSource: () => source }), /unfinished/);
  const b = fakeBoard(); const wrapped = async args => { const result = await b.run(args); return args[0] === 'task' ? { code: 1 } : result; };
  await assert.rejects(() => noticeApi.publishSourceReview(plan(), input, { run: wrapped, readSource: () => source }), /no automatic retry/);
  assert.equal(b.calls.filter(args => args[0] === 'task').length, 1); assert.match(b.tasks[0].body, /SOURCE-REVIEW:/);
  const retry = await noticeApi.publishSourceReview(plan(), input, { run: b.run, readSource: () => source }); assert.deepEqual(retry.alreadyPresent, ['agora-a']);
  await assert.rejects(() => noticeApi.publishSourceReview(plan(), { ...input, reason: 'Different review under the same id.' }, { run: b.run, readSource: () => source }), /different content/);
  await assert.rejects(() => noticeApi.publishSourceReview(plan(), input, { run: b.run, readSource: () => source.replace('baseAttack();', 'baseAttack();\nsiblingRider();') }), /changed/);
  const dry = fakeBoard(); const before = structuredClone(dry.tasks);
  const result = await noticeApi.publishSourceReview(plan(), input, { run: dry.run, readSource: () => source, dryRun: true }); assert.equal(result.dryRun, true); assert.deepEqual(dry.tasks, before);
});

test('WF307: wrong targets and source drift during durable append refuse without retry', async () => {
  let source = '// BEGIN\nbaseAttack();\n// END';
  const input = { id: 'review-v1', taskId: 'agora-a', file: 'src/attack.ts', start: '// BEGIN', end: '// END', symbols: ['baseAttack'], reason: 'Preserve the current attack.' };
  for (const change of [b => { b.tasks[0].campaignId = 'another'; }, b => { b.tasks.shift(); }]) {
    const b = fakeBoard(); change(b);
    await assert.rejects(() => noticeApi.publishSourceReview(plan(), input, { run: b.run, readSource: () => source }), /unfinished/);
    assert.equal(b.calls.some(args => args[0] === 'task' || args[0] === 'say'), false);
  }
  const b = fakeBoard(), prior = b.tasks[0].body;
  const run = async args => { const result = await b.run(args); if (args[0] === 'task') source += '\n// END'; return result; };
  await assert.rejects(() => noticeApi.publishSourceReview(plan(), input, { run, readSource: () => source }), /source changed.*no automatic retry/);
  assert.equal(b.calls.filter(args => args[0] === 'task').length, 1);
  assert.equal(b.calls.some(args => args[0] === 'say'), false);
  assert.ok(b.tasks[0].body.startsWith(prior)); assert.match(b.tasks[0].body, /SOURCE-REVIEW:/);
});

const notice = { id: 'roller-control-v1', fromPacket: 'PK-a', oldControl: 'Math.random spy',
  replacement: 'explicit decision fixture', affectedTests: ['src/tests/b.test.ts'], evidence: 'fixture observed old control no longer pins the result' };
function plan() {
  return { wave: 'notice-fixture', campaignId: 'agora-demo', pet: 'cyberman', packets: [
    { id: 'PK-a', handle: 'notice-a', agent: 'claude', pet: 'dream-girl', scope: 'retire control', files: ['src/core.ts'], taskIds: ['agora-a'] },
    { id: 'PK-b', handle: 'notice-b', agent: 'claude', pet: 'nous-girl', scope: 'repair tests', files: ['src/tests/b.test.ts'], taskIds: ['agora-b'] },
    { id: 'PK-c', handle: 'notice-c', agent: 'claude', pet: 'soldier-boy', scope: 'unrelated', files: ['src/tests/c.test.ts'], taskIds: ['agora-c'] },
  ] };
}
function fakeBoard(options = {}) {
  const tasks = plan().packets.map(p => ({ id: p.taskIds[0], body: `original ${p.id}`, campaignId: 'agora-demo', state: 'open' }));
  const calls = [];
  const run = async args => {
    calls.push(args);
    if (args[0] === 'whoami') return { code: 0, live: true, agent: { role: options.role || 'orchestrator' } };
    if (args[0] === 'campaign') return { code: 0, view: { campaign: { id: 'agora-demo' } } };
    if (args[0] === 'tasks') return { code: 0, tasks: structuredClone(tasks) };
    if (args[0] === 'task') {
      const target = tasks.find(t => t.id === args[2]);
      if (options.failOn === target.id) return { code: 1 };
      // Model an edit landing AFTER snapshot and BEFORE the server append.
      target.body += '\nconcurrent claimant note';
      target.body += '\n' + args[args.indexOf('--append-body') + 1];
      return { code: 0, task: structuredClone(target) };
    }
    if (args[0] === 'say') return { code: options.failBroadcast ? 1 : 0 };
    throw new Error('unexpected command');
  };
  return { tasks, calls, run };
}

// Rulings are recorded decisions, not permission inferred from a coordinator's
// role. Fixtures label synthetic choices and only mutate isolated task metadata.
const ruling = { id: 'fixture-ruling-v1', taskId: 'agora-target', sourceTask: 'agora-source',
  sourceReference: 'synthetic question sheet Q1', ruling: 'Fixture decision: use the shared palette.',
  oldInstruction: 'Keep the fixture color in the old table.', replacement: 'Use the fixture shared palette instead.',
  evidence: 'Synthetic metadata only; not a product ruling.', observedAt: '2026-10-09T21:00:00.000Z',
  blocker: { at: 10, reason: 'Awaiting synthetic Q1 decision' } };
function rulingBoard(options = {}) {
  const tasks = [{ id: ruling.sourceTask, campaignId: 'agora-demo', state: 'done', body: '', result: ruling.ruling, history: [] },
    { id: ruling.taskId, campaignId: 'agora-demo', state: 'blocked', body: 'Original brief. ' + ruling.oldInstruction,
      createdBy: 'original-author', claimedBy: 'original-worker', deps: ['preserved-dep'], refs: ['preserved-ref'],
      history: [{ at: 10, state: 'blocked', reason: ruling.blocker.reason }] },
    { id: 'agora-unrelated', campaignId: 'agora-demo', state: 'open', body: 'Unrelated' }];
  const calls = []; const target = tasks[1];
  const run = async args => {
    calls.push(args);
    if (args[0] === 'whoami') return { code: 0, live: true, agent: { role: options.role || 'orchestrator' } };
    if (args[0] === 'campaign') return { code: 0, view: { campaign: { id: 'agora-demo' } } };
    if (args[0] === 'tasks') return { code: 0, tasks: structuredClone(tasks) };
    if (args[0] === 'say') return { code: options.failBroadcast ? 1 : 0 };
    if (args[1] === 'lint') return { code: options.badLint ? 1 : 0, lint: { clean: !options.badLint } };
    if (args[1] === 'show') return { code: 0, task: structuredClone(tasks.find(t => t.id === args[2])) };
    if (args[1] === 'edit') {
      target.body += '\nconcurrent claimant note\n' + args[args.indexOf('--append-body') + 1];
      options.afterAppend?.(target, tasks);
      return { code: options.appendResponseLost ? 1 : 0, task: structuredClone(target), lint: { clean: !options.badLint } };
    }
    if (args[1] === 'state') {
      assert.match(target.body, /SUPERSEDED BY RULING/, 'body reconciliation precedes reopening');
      if (options.failState) return { code: 1 };
      target.state = args[3]; target.history.push({ at: 20, action: 'state', state: args[3], reason: args[args.indexOf('--reason') + 1] });
      return { code: options.stateResponseLost ? 1 : 0, task: structuredClone(target) };
    }
    throw new Error('Unexpected ruling fixture call ' + args.join(' '));
  };
  return { tasks, calls, run, target };
}
const rulingWrites = board => board.calls.filter(args => args[0] === 'say' || (args[0] === 'task' && args[1] !== 'show'));

test('WF323: invalid declarations fail before calls; unverified sources, role, blockers and targets refuse before writes', async () => {
  for (const amendment of [{ id: 'bad/id' }, { taskId: '' }, { sourceTask: '' }, { sourceReference: '' },
    { ruling: '' }, { oldInstruction: '' }, { replacement: ruling.oldInstruction }, { evidence: '' },
    { observedAt: '2026-02-30T20:00:00.000Z' }, { blocker: { at: 10, reason: '' } },
    { blocker: { at: NaN, reason: 'x' } }, { blocker: { ...ruling.blocker, typo: true } }, { extra: true }]) {
    const b = rulingBoard(); await assert.rejects(() => noticeApi.publishRulingUnblock(plan(), { ...ruling, ...amendment }, { run: b.run }));
    assert.equal(b.calls.length, 0);
  }
  for (const amend of [b => { b.tasks[0].result = 'different decision'; }, b => { b.tasks[0].campaignId = 'other'; },
    b => { b.target.campaignId = 'other'; }, b => { b.target.body = 'No invalidated instruction'; },
    b => { b.target.state = 'done'; }, b => { b.target.state = 'open'; },
    b => { b.target.history.push({ at: 11, state: 'blocked', reason: 'new blocker' }); },
    b => { b.tasks.shift(); }, b => { b.tasks.splice(1, 1); }]) {
    const b = rulingBoard(); amend(b);
    await assert.rejects(() => noticeApi.publishRulingUnblock(plan(), ruling, { run: b.run })); assert.equal(rulingWrites(b).length, 0);
  }
  const worker = rulingBoard({ role: 'worker' });
  await assert.rejects(() => noticeApi.publishRulingUnblock(plan(), ruling, { run: worker.run }), /live orchestrator/);
  assert.equal(rulingWrites(worker).length, 0);
});

test('WF323: dry review accepts a quote in body, result or history; no task or broadcast mutations', async () => {
  for (const field of ['body', 'result', 'history']) {
    const b = rulingBoard(); b.tasks[0].result = '';
    if (field === 'history') b.tasks[0].history = [{ reason: ruling.ruling }]; else b.tasks[0][field] = ruling.ruling;
    const before = structuredClone(b.tasks);
    const receipt = await noticeApi.publishRulingUnblock(plan(), ruling, { run: b.run, dryRun: true });
    assert.equal(receipt.dryRun, true); assert.equal(receipt.reopened, false); assert.equal(rulingWrites(b).length, 0);
    assert.deepEqual(b.tasks, before);
  }
});

test('WF323: durable reconciliation preserves brief, concurrent notes, provenance and unrelated tasks before reopening', async () => {
  const b = rulingBoard(), before = structuredClone(b.tasks);
  const receipt = await noticeApi.publishRulingUnblock(plan(), ruling, { run: b.run });
  assert.equal(receipt.appended, true); assert.equal(receipt.reopened, true); assert.equal(receipt.broadcast, true);
  assert.equal(b.target.state, 'open'); assert.ok(b.target.body.startsWith(before[1].body));
  assert.match(b.target.body, /concurrent claimant note/); assert.match(b.target.body, /SUPERSEDED BY RULING/);
  assert.ok(b.target.body.includes(ruling.sourceReference)); assert.ok(b.target.body.includes(ruling.ruling));
  for (const key of ['id', 'createdBy', 'claimedBy', 'deps', 'refs']) assert.deepEqual(b.target[key], before[1][key]);
  assert.deepEqual(b.tasks[0], before[0]); assert.deepEqual(b.tasks[2], before[2]);
  assert.deepEqual(b.target.history.slice(0, before[1].history.length), before[1].history);
  assert.equal(b.calls.filter(args => args[1] === 'edit').every(args => args.includes('--append-body') && !args.includes('--body')), true);
  for (const state of ['claimed', 'done', 'blocked']) {
    b.target.state = state;
    if (state === 'blocked') b.target.history.push({ at: 30, state, reason: 'A later unrelated blocker' });
    const current = structuredClone(b.tasks), calls = b.calls.length;
    const repeat = await noticeApi.publishRulingUnblock(plan(), ruling, { run: b.run });
    assert.equal(repeat.alreadyApplied, true); assert.equal(repeat.reopened, false); assert.equal(repeat.broadcast, false);
    assert.deepEqual(b.tasks, current); assert.equal(rulingWrites({ calls: b.calls.slice(calls) }).length, 0);
  }
});

test('WF323: conflicting marker or changed blocker after append stops; no state mutation or automatic retry', async () => {
  const conflict = rulingBoard(); conflict.target.body += '\n' + noticeApi.rulingNoticeBody('agora-demo', { ...ruling, replacement: 'Different guidance' }).body;
  await assert.rejects(() => noticeApi.publishRulingUnblock(plan(), ruling, { run: conflict.run }), /different content/);
  assert.equal(rulingWrites(conflict).length, 0);
  for (const afterAppend of [target => { target.history.push({ at: 11, state: 'blocked', reason: 'New blocker' }); },
    target => { target.body = 'Reconciliation was removed'; }, target => { target.state = 'claimed'; },
    (_target, tasks) => { tasks[0].result = 'The source quote changed'; }]) {
    const b = rulingBoard({ afterAppend });
    await assert.rejects(() => noticeApi.publishRulingUnblock(plan(), ruling, { run: b.run }), error => {
      assert.equal(error.receipt.reopened, false); assert.match(error.message, /inspect|Inspect/); return true;
    });
    assert.equal(b.calls.filter(args => args[1] === 'state').length, 0);
  }
});

test('WF323: ambiguous append/state failures expose receipts; explicit resume never duplicates or resets later state', async () => {
  for (const key of ['appendResponseLost', 'failState', 'stateResponseLost', 'failBroadcast', 'badLint']) {
    const options = { [key]: true }, b = rulingBoard(options);
    await assert.rejects(() => noticeApi.publishRulingUnblock(plan(), ruling, { run: b.run }), error => {
      assert.ok(error.receipt); assert.match(error.message, /no automatic retry/); return true;
    });
    assert.equal(b.calls.filter(args => args[1] === 'edit').length, 1);
    assert.ok(b.calls.filter(args => args[1] === 'state').length <= 1);
    if (key === 'badLint') {
      await assert.rejects(() => noticeApi.publishRulingUnblock(plan(), ruling, { run: b.run }), /brief lint fails/);
      assert.equal(b.target.state, 'blocked'); assert.equal(b.calls.filter(args => args[1] === 'state').length, 0);
    }
    options[key] = false;
    const resumed = await noticeApi.publishRulingUnblock(plan(), ruling, { run: b.run });
    assert.equal(b.calls.filter(args => args[1] === 'edit').length, 1);
    assert.equal(b.target.state, 'open');
    if (key === 'stateResponseLost' || key === 'failBroadcast') assert.equal(resumed.alreadyApplied, true);
  }
});

test('WF323: both worker variants and docs require the ruling/source/body/history self-check without granting authority', () => {
  for (const agent of ['claude', 'codex']) {
    const p = plan(), prompt = buildPrompt(p, { ...p.packets[1], agent }, { taskId: 'agora-b' });
    assert.match(prompt, /OWNER RULINGS \(WF-G323\)/); assert.match(prompt, /SUPERSEDED BY RULING/);
    assert.match(prompt, /body.*history.*source/); assert.match(prompt, /does not grant files or commands/);
  }
  const worker = fs.readFileSync(new URL('./AGENT.md', import.meta.url), 'utf8');
  const author = fs.readFileSync(new URL('./ORCHESTRATOR.md', import.meta.url), 'utf8');
  assert.match(worker, /Owner rulings \(WF-G323\)/);
  assert.match(author, /ruling-unblock <plan.json> <ruling.json> --dry/);
  assert.match(author, /not a cross-request transaction/); assert.match(author, /does not infer human approval/);
});

test('WF323: private real CLI reconciles before unblock, preserves concurrent edits and survives isolated restart', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-ruling-unblock-'));
  const serverDir = path.join(root, 'server'); let app = createAgoraServer({ dir: serverDir });
  const listen = async (port = 0) => { await new Promise(resolve => app.listen(port, resolve)); return `http://127.0.0.1:${app.server.address().port}`; };
  try {
    const baseUrl = await listen(), env = { ...process.env, AGORA_AGENT_ID: 'ruling-orch', AGORA_DIR: path.join(root, 'identity') };
    const ctx = { env, baseUrl };
    const call = async args => { const result = await run(args, ctx); assert.equal(result.code, 0, result.lines?.join('\n')); return result; };
    await call(['register', 'ruling-orch', '--pet', 'cyberman', '--role', 'orchestrator', '--session', 'fixture-ruling-session']);
    const campaign = await call(['campaign', 'claim', 'ruling-proof', '--scope', 'Synthetic metadata only', '--role', 'lead', '--path', '.agent/scratch/ruling-proof']);
    const p = plan(); p.baseUrl = baseUrl; p.campaignId = campaign.campaign.id;
    const source = await call(['task', 'new', 'Synthetic ruling source', '--campaign', p.campaignId, '--body', ruling.ruling]);
    const target = await call(['task', 'new', 'Synthetic blocked task', '--campaign', p.campaignId, '--body', ruling.oldInstruction]);
    await call(['task', 'claim', target.task.id]);
    const blocked = await call(['task', 'state', target.task.id, 'blocked', '--reason', ruling.blocker.reason]);
    const event = blocked.task.history.at(-1);
    const n = { ...ruling, sourceTask: source.task.id, taskId: target.task.id, blocker: { at: event.at, reason: event.reason } };
    const planFile = path.join(root, 'plan.json'), noticeFile = path.join(root, 'ruling.json');
    fs.writeFileSync(planFile, JSON.stringify(p)); fs.writeFileSync(noticeFile, JSON.stringify(n));
    const execute = async (flags = []) => promisify(execFile)(process.execPath,
      [path.join(path.dirname(fileURLToPath(import.meta.url)), 'orchestrate.mjs'), 'ruling-unblock', planFile, noticeFile, ...flags],
      { env, timeout: 30000, maxBuffer: 2 * 1024 * 1024 });
    const before = app.store.listTasks(); assert.equal(JSON.parse((await execute(['--dry'])).stdout).dryRun, true);
    assert.deepEqual(app.store.listTasks(), before);
    const concurrent = async (args, context) => {
      if (args[1] === 'edit') await call(['task', 'edit', target.task.id, '--append-body', 'Concurrent claimant evidence']);
      return run(args, context);
    };
    const applied = await noticeApi.publishRulingUnblock(p, n, { env, run: concurrent }); assert.equal(applied.reopened, true);
    const after = app.store.listTasks(), changed = after.find(t => t.id === target.task.id);
    assert.match(changed.body, /Concurrent claimant evidence/); assert.equal(changed.state, 'open');
    assert.deepEqual(after.find(t => t.id === source.task.id), before.find(t => t.id === source.task.id));
    for (const key of ['createdBy', 'claimedBy', 'deps', 'refs']) assert.deepEqual(changed[key], blocked.task[key]);
    const stateIndex = changed.history.findIndex(entry => entry.state === 'open' && /SUPERSEDED BY RULING/.test(entry.reason || ''));
    assert.ok(stateIndex > 0); assert.equal(changed.history[stateIndex - 1].action, 'edit');
    await app.close(); app = createAgoraServer({ dir: serverDir }); await listen(Number(new URL(baseUrl).port));
    const repeat = JSON.parse((await execute()).stdout); assert.equal(repeat.alreadyApplied, true); assert.equal(repeat.reopened, false);
    assert.deepEqual(app.store.listTasks(), after); assert.equal(app.store.listAgents().length, 1);
  } finally { await app.close(); assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir())); fs.rmSync(root, { recursive: true, force: true }); }
});

// Capability corrections sweep exact current body text across a campaign, not
// only packets that happen to be listed in one coordinator's plan.
const capability = { id: 'capture-claim-v1', fromTask: 'agora-a',
  oldClaim: 'Headless capture cannot prove this surface.',
  replacement: 'Use the reviewed capture path only after checking the actual adapter and rendered surface.',
  observedAt: '2026-10-09T20:00:00.000Z', conditions: 'Isolated fixture; no claim about the current host GPU.',
  evidence: 'Source task records scoped counterevidence; this test verifies delivery, not adapter correctness.' };
function capabilityBoard(options = {}) {
  const board = fakeBoard(options);
  board.tasks[0].body = 'source evidence only';
  board.tasks[1].body = capability.oldClaim;
  board.tasks[1].state = 'claimed';
  board.tasks[1].claimedBy = 'worker-original';
  board.tasks[1].refs = ['preserved-ref'];
  board.tasks[1].deps = ['preserved-dependency'];
  board.tasks.push({ id: 'agora-unlisted', campaignId: 'agora-demo', state: 'blocked', body: capability.oldClaim });
  board.tasks.push({ id: 'agora-closed', campaignId: 'agora-demo', state: 'done', body: capability.oldClaim });
  board.tasks.push({ id: 'agora-other-campaign', campaignId: 'agora-other', state: 'open', body: capability.oldClaim });
  return board;
}

test('WF334: dry sweep includes unlisted unfinished siblings and reports completed matches without writes', async () => {
  const board = capabilityBoard();
  const before = structuredClone(board.tasks);
  const result = await noticeApi.publishCapabilityNotice(plan(), capability, { run: board.run, dryRun: true });
  assert.deepEqual(result.targets.map(t => t.id), ['agora-b', 'agora-unlisted']);
  assert.deepEqual(result.closedMatches, ['agora-closed']);
  assert.deepEqual(result.appended, []);
  assert.equal(board.calls.filter(args => ['task', 'say'].includes(args[0])).length, 0);
  assert.deepEqual(board.tasks, before);
});

test('WF334: schemas, role, exact origin/campaign and notice conflicts fail before mutation', async () => {
  for (const bad of [{ ...capability, id: 'bad/key' }, { ...capability, fromTask: '' },
    { ...capability, oldClaim: '' }, { ...capability, replacement: capability.oldClaim },
    { ...capability, observedAt: 'tomorrow' }, { ...capability, observedAt: '2026-02-30T20:00:00.000Z' },
    { ...capability, conditions: '' }, { ...capability, evidence: '' }, { ...capability, typo: 'ignored?' }]) {
    const board = capabilityBoard();
    await assert.rejects(() => noticeApi.publishCapabilityNotice(plan(), bad, { run: board.run }));
    assert.equal(board.calls.length, 0);
  }
  for (const change of [
    b => { b.tasks[0].campaignId = 'agora-other'; },
    b => { b.tasks[0].id = 'agora-missing'; },
    b => { b.tasks[1].body = noticeApi.capabilityNoticeBody('agora-demo', { ...capability, replacement: 'different scoped claim' }).body; },
  ]) {
    const board = capabilityBoard(); change(board);
    await assert.rejects(() => noticeApi.publishCapabilityNotice(plan(), capability, { run: board.run }));
    assert.equal(board.calls.filter(args => ['task', 'say'].includes(args[0])).length, 0);
  }
  const worker = capabilityBoard({ role: 'worker' });
  await assert.rejects(() => noticeApi.publishCapabilityNotice(plan(), capability, { run: worker.run }), /live orchestrator/);
  assert.equal(worker.calls.length, 1);
  const reused = capabilityBoard();
  reused.tasks[1].body = noticeApi.capabilityNoticeBody('agora-demo', capability).body;
  await assert.rejects(() => noticeApi.publishCapabilityNotice(plan(), { ...capability, oldClaim: 'New nonmatching wording' },
    { run: reused.run }), /already has different content/);
  assert.equal(reused.calls.filter(args => ['task', 'say'].includes(args[0])).length, 0);
  const noMatches = capabilityBoard();
  for (const task of noMatches.tasks) task.body = 'no matching claim';
  await assert.rejects(() => noticeApi.publishCapabilityNotice(plan(), capability, { run: noMatches.run }), /no unfinished matching tasks/);
  assert.equal(noMatches.calls.filter(args => ['task', 'say'].includes(args[0])).length, 0);
});

test('WF334: durable correction preserves brief, concurrent notes, claimant and permissions; rerun is explicit and idempotent', async () => {
  const board = capabilityBoard();
  const before = structuredClone(board.tasks);
  const result = await noticeApi.publishCapabilityNotice(plan(), capability, { run: board.run });
  assert.deepEqual(result.appended, ['agora-b', 'agora-unlisted']);
  assert.equal(result.broadcast, true);
  const corrected = board.tasks.find(t => t.id === 'agora-b');
  assert.ok(corrected.body.startsWith(before[1].body));
  assert.match(corrected.body, /concurrent claimant note/);
  assert.match(corrected.body, /CAPABILITY CLAIM CORRECTION/);
  assert.match(corrected.body, /supersedes the matching capability claim.*stated conditions/);
  assert.match(corrected.body, /2026-10-09T20:00:00.000Z/);
  assert.match(corrected.body, /Ownership and command limits are unchanged/);
  assert.deepEqual({ ...corrected, body: before[1].body }, before[1]);
  for (const original of before.filter(t => !result.appended.includes(t.id))) {
    assert.deepEqual(board.tasks.find(t => t.id === original.id), original);
  }
  assert.ok(board.calls.filter(args => args[0] === 'task').every(args => args.includes('--append-body') && !args.includes('--body')));
  corrected.state = 'done';
  const completedSnapshot = structuredClone(board.tasks);
  const repeat = await noticeApi.publishCapabilityNotice(plan(), capability, { run: board.run });
  assert.deepEqual(repeat.alreadyPresent, ['agora-b', 'agora-unlisted']);
  assert.deepEqual(repeat.appended, []);
  assert.equal(repeat.broadcast, false);
  assert.deepEqual(board.tasks, completedSnapshot);
});

test('WF334: uncertain delivery exposes receipts and never retries; explicit resume verifies the stored block', async () => {
  const board = capabilityBoard();
  let uncertain = true;
  const responseLost = async args => {
    const result = await board.run(args);
    if (args[0] === 'task' && args[2] === 'agora-unlisted' && uncertain) return { code: 1 };
    return result;
  };
  await assert.rejects(() => noticeApi.publishCapabilityNotice(plan(), capability, { run: responseLost }), error => {
    assert.deepEqual(error.receipt.appended, ['agora-b']);
    assert.deepEqual(error.receipt.closedMatches, ['agora-closed']);
    assert.match(error.message, /may have been applied.*no automatic retry/);
    return true;
  });
  assert.equal(board.calls.filter(args => args[0] === 'task' && args[2] === 'agora-unlisted').length, 1);
  assert.equal(board.calls.filter(args => args[0] === 'say').length, 0);
  uncertain = false;
  const resume = await noticeApi.publishCapabilityNotice(plan(), capability, { run: responseLost });
  assert.deepEqual(resume.appended, []);
  assert.deepEqual(resume.alreadyPresent, ['agora-b', 'agora-unlisted']);
  assert.equal(resume.broadcast, false);
});

test('WF334: both worker prompts and docs require durable scoped corrections, not historical capability inference', () => {
  for (const agent of ['claude', 'codex']) {
    const prompt = buildPrompt(plan(), { ...plan().packets[1], agent });
    assert.match(prompt, /CAPABILITY CLAIM CORRECTIONS \(WF-G334\)/);
    assert.match(prompt, /re-read task show before verification\/completion/);
    assert.match(prompt, /stated conditions only/);
    assert.match(prompt, /does not grant commands, files or runtime acceptance/);
  }
  const worker = fs.readFileSync(new URL('./AGENT.md', import.meta.url), 'utf8');
  const orchestrator = fs.readFileSync(new URL('./ORCHESTRATOR.md', import.meta.url), 'utf8');
  assert.match(worker, /Capability claim corrections \(WF-G334\)/);
  assert.match(orchestrator, /capability-notice <plan.json> <notice.json> --dry/);
  assert.match(orchestrator, /Exact text is not a semantic search/);
  assert.match(orchestrator, /One coordinator must serialize/);
});

test('WF334: real CLI sweeps campaign outside packets; dry run, concurrent edit and persisted rerun preserve records', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-capability-notice-'));
  const serverDir = path.join(root, 'server'), idDir = path.join(root, 'identity');
  let app = createAgoraServer({ dir: serverDir });
  const listen = async (port = 0) => {
    await new Promise(resolve => app.listen(port, resolve));
    return `http://127.0.0.1:${app.server.address().port}`;
  };
  try {
    const baseUrl = await listen();
    const env = { ...process.env, AGORA_DIR: idDir, AGORA_AGENT_ID: 'capability-orch' };
    const context = { env, baseUrl };
    assert.equal((await run(['register', 'capability-orch', '--pet', 'cyberman', '--role', 'orchestrator',
      '--session', 'fixture-capability-notice-session'], context)).code, 0);
    const campaign = await run(['campaign', 'claim', 'capability-proof', '--role', 'lead', '--scope', 'isolated metadata proof',
      '--wave', 'capability-fixture', '--path', '.agent/scratch/capability-fixture'], context);
    assert.equal(campaign.code, 0);
    const ids = {};
    for (const [key, body] of Object.entries({ source: 'read-only observed counterevidence',
      sibling: capability.oldClaim, unlisted: capability.oldClaim, closed: capability.oldClaim, unrelated: 'unrelated brief' })) {
      const created = await run(['task', 'new', key, '--campaign', campaign.campaign.id, '--body', body], context);
      assert.equal(created.code, 0); ids[key] = created.task.id;
    }
    assert.equal((await run(['task', 'done', ids.closed, '--result', 'completed historical fixture; do not reopen'], context)).code, 0);
    const p = { ...plan(), baseUrl, campaignId: campaign.campaign.id,
      packets: [{ ...plan().packets[0], taskIds: [ids.source] }] };
    const n = { ...capability, fromTask: ids.source };
    const planFile = path.join(root, 'plan.json'), noticeFile = path.join(root, 'notice.json');
    fs.writeFileSync(planFile, JSON.stringify(p)); fs.writeFileSync(noticeFile, JSON.stringify(n));
    const cli = fileURLToPath(new URL('./orchestrate.mjs', import.meta.url));
    const execute = (...flags) => promisify(execFile)(process.execPath, [cli, 'capability-notice', planFile, noticeFile, ...flags], { env, timeout: 10000 });
    const before = app.store.listTasks();
    const dry = await execute('--dry');
    assert.deepEqual(JSON.parse(dry.stdout).targets.map(t => t.id).sort(), [ids.sibling, ids.unlisted].sort());
    assert.deepEqual(JSON.parse(dry.stdout).closedMatches, [ids.closed]);
    assert.deepEqual(app.store.listTasks(), before);
    const concurrentRun = async (args, ctx) => {
      if (args[0] === 'task' && args[2] === ids.unlisted) {
        assert.equal((await run(['task', 'edit', ids.unlisted, '--append-body', 'claimant note after sweep snapshot'], ctx)).code, 0);
      }
      return run(args, ctx);
    };
    const result = await noticeApi.publishCapabilityNotice(p, n, { env, run: concurrentRun });
    assert.equal(result.appended.length, 2);
    const after = app.store.listTasks();
    assert.match(after.find(t => t.id === ids.unlisted).body, /claimant note after sweep snapshot/);
    for (const key of ['source', 'closed', 'unrelated']) {
      assert.deepEqual(after.find(t => t.id === ids[key]), before.find(t => t.id === ids[key]));
    }
    await app.close(); app = createAgoraServer({ dir: serverDir }); await listen(Number(new URL(baseUrl).port));
    const repeat = await execute();
    assert.deepEqual(JSON.parse(repeat.stdout).appended, []);
    assert.equal(JSON.parse(repeat.stdout).alreadyPresent.length, 2);
    assert.equal(JSON.parse(repeat.stdout).broadcast, false);
    assert.deepEqual(app.store.listTasks().map(t => [t.id, t.body]), after.map(t => [t.id, t.body]));
    assert.equal(app.store.listAgents().filter(a => a.status !== 'retired').length, 1);
    assert.doesNotMatch(repeat.stderr, /workers will create their own tasks/);
  } finally {
    await app.close();
    assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir()));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('WF305: every inventoried test maps to one owner; unrelated packet stays excluded', () => {
  const p = plan();
  const prepared = controlNoticeRecipients(p, { ...notice, affectedTests: ['.\\src\\tests\\b.test.ts', 'src/tests/b.test.ts'] });
  assert.deepEqual(prepared.packets.map(p => p.id), ['PK-a', 'PK-b']);
  assert.deepEqual(prepared.notice.affectedTests, ['src/tests/b.test.ts']);
  p.packets[1].files = ['src/tests/**'];
  assert.deepEqual(controlNoticeRecipients(p, notice).packets.map(p => p.id), ['PK-a', 'PK-b']);
});

test('WF305: malformed, unowned and multiply owned notice inputs refuse before calls', async () => {
  for (const bad of [{ ...notice, id: 'bad/id' }, { ...notice, affectedTests: [] },
    { ...notice, affectedTests: ['../escape.test.ts'] }, { ...notice, affectedTests: ['src/tests/*.test.ts'] },
    { ...notice, replacement: notice.oldControl }, { ...notice, ignoredField: 'typo' }]) {
    const board = fakeBoard();
    await assert.rejects(() => publishControlNotice(plan(), bad, { run: board.run }));
    assert.equal(board.calls.length, 0);
  }
  const p = plan();
  assert.throws(() => controlNoticeRecipients(p, { ...notice, affectedTests: ['src/missing.test.ts'] }), /0 packet owners/);
  p.packets[2].files.push('src/tests/b.test.ts');
  assert.throws(() => controlNoticeRecipients(p, notice), /2 packet owners/);
});

test('WF305: atomic append preserves concurrent body edits; rerun skips exact notices and broadcast', async () => {
  const board = fakeBoard();
  const result = await publishControlNotice(plan(), notice, { run: board.run });
  assert.deepEqual(result.appended, ['agora-a', 'agora-b']);
  assert.equal(result.broadcast, true);
  for (const id of result.appended) {
    const body = board.tasks.find(t => t.id === id).body;
    assert.match(body, /original PK-/);
    assert.match(body, /concurrent claimant note/);
    assert.match(body, /Math.random spy/);
    assert.match(body, /explicit decision fixture/);
  }
  assert.equal(board.tasks[2].body, 'original PK-c');
  const editCalls = board.calls.filter(args => args[0] === 'task');
  assert.ok(editCalls.every(args => args.includes('--append-body') && !args.includes('--body')));
  const before = structuredClone(board.tasks);
  const repeat = await publishControlNotice(plan(), notice, { run: board.run });
  assert.deepEqual(repeat.appended, []);
  assert.deepEqual(repeat.alreadyPresent, ['agora-a', 'agora-b']);
  assert.equal(repeat.broadcast, false);
  assert.deepEqual(board.tasks, before);
  assert.equal(board.calls.filter(args => args[0] === 'say').length, 1);
});

test('WF305: all-recipient preflight checks roles, done tasks, campaign and immutable notice conflicts', async () => {
  for (const amend of [
    b => { b.tasks[1].state = 'done'; },
    b => { b.tasks[1].campaignId = 'agora-other'; },
    b => { b.tasks.pop(); b.tasks.splice(1, 1); },
    b => { b.tasks[1].body = controlNoticeBody('agora-demo', { ...notice, replacement: 'different' }).body; },
  ]) {
    const b = fakeBoard(); amend(b);
    await assert.rejects(() => publishControlNotice(plan(), notice, { run: b.run }));
    assert.equal(b.calls.filter(args => ['task', 'say'].includes(args[0])).length, 0);
  }
  const b = fakeBoard({ role: 'worker' });
  await assert.rejects(() => publishControlNotice(plan(), notice, { run: b.run }), /live orchestrator/);
  assert.equal(b.calls.length, 1);
});

test('WF305: dry run is read-only and partial failure exposes receipts without retry/broadcast', async () => {
  const dry = fakeBoard();
  const receipt = await publishControlNotice(plan(), notice, { run: dry.run, dryRun: true });
  assert.equal(receipt.targets.length, 2);
  assert.deepEqual(receipt.appended, []);
  assert.equal(dry.calls.filter(args => ['task', 'say'].includes(args[0])).length, 0);
  const failed = fakeBoard({ failOn: 'agora-b' });
  await assert.rejects(() => publishControlNotice(plan(), notice, { run: failed.run }), error => {
    assert.deepEqual(error.receipt.appended, ['agora-a']);
    assert.match(error.message, /may have been applied.*no automatic retry/);
    return true;
  });
  assert.equal(failed.calls.filter(args => args[0] === 'task' && args[2] === 'agora-b').length, 1);
  assert.equal(failed.calls.filter(args => args[0] === 'say').length, 0);
  const broadcast = fakeBoard({ failBroadcast: true });
  await assert.rejects(() => publishControlNotice(plan(), notice, { run: broadcast.run }), error => {
    assert.deepEqual(error.receipt.appended, ['agora-a', 'agora-b']);
    assert.equal(error.receipt.broadcast, false);
    return true;
  });
});

test('WF305: worker prompts require durable publication and re-reading notices before verification', () => {
  for (const agent of ['claude', 'codex']) {
    const p = plan(), packet = { ...p.packets[1], agent };
    const prompt = buildPrompt(p, packet, { taskId: 'agora-b' });
    assert.match(prompt, /SHARED CONTROL CHANGES \(WF-G305\)/);
    assert.match(prompt, /before the retiring packet closes/);
    assert.match(prompt, /re-read task show before verification\/completion/);
    assert.match(prompt, /notice never widens your files or command permissions/);
  }
});

test('WF305: worker and orchestrator docs state durable delivery and concurrency limits', () => {
  const worker = fs.readFileSync(new URL('./AGENT.md', import.meta.url), 'utf8');
  const orchestrator = fs.readFileSync(new URL('./ORCHESTRATOR.md', import.meta.url), 'utf8');
  assert.match(worker, /Shared control changes \(WF-G305\)/);
  assert.match(worker, /re-read `task show` before running verification/);
  assert.match(orchestrator, /control-notice <plan.json> <notice.json> --dry/);
  assert.match(orchestrator, /One coordinator must serialize/);
  assert.match(orchestrator, /does not enforce\s+cross-process uniqueness/);
});

test('WF305: real CLI appends durable notices to private tasks, preserves claimant edits and survives restart', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-control-notice-'));
  const serverDir = path.join(root, 'server'), idDir = path.join(root, 'identity');
  let app = createAgoraServer({ dir: serverDir });
  const listen = async (port = 0) => {
    await new Promise(resolve => app.listen(port, resolve));
    return `http://127.0.0.1:${app.server.address().port}`;
  };
  try {
    const baseUrl = await listen();
    const env = { ...process.env, AGORA_DIR: idDir, AGORA_AGENT_ID: 'notice-orch' };
    const registration = await run(['register', 'notice-orch', '--pet', 'cyberman', '--role', 'orchestrator',
      '--session', 'fixture-control-notice-session'], { env, baseUrl });
    assert.equal(registration.code, 0, registration.lines?.join('\n'));
    const campaign = await run(['campaign', 'claim', 'notice-proof', '--role', 'lead', '--scope', 'isolated source-free notice fixture',
      '--wave', 'notice-fixture', '--path', '.agent/scratch/notice-fixture'], { env, baseUrl });
    assert.equal(campaign.code, 0, campaign.lines?.join('\n'));
    const p = plan(); p.baseUrl = baseUrl; p.campaignId = campaign.campaign.id;
    for (const packet of p.packets) {
      const created = await run(['task', 'new', packet.id, '--campaign', p.campaignId, '--body', `original ${packet.id}`], { env, baseUrl });
      assert.equal(created.code, 0);
      packet.taskIds = [created.task.id];
    }
    const sibling = p.packets[1].taskIds[0], other = p.packets[2].taskIds[0];
    const runWithConcurrentEdit = async (args, context) => {
      if (args[0] === 'task' && args[2] === sibling) {
        assert.equal((await run(['task', 'edit', sibling, '--append-body', 'claimant note after notice snapshot'], context)).code, 0);
      }
      return run(args, context);
    };
    const result = await publishControlNotice(p, notice, { env, run: runWithConcurrentEdit });
    assert.equal(result.appended.length, 2);
    assert.equal(result.broadcast, true);
    const beforeRestart = app.store.listTasks();
    assert.equal(beforeRestart.find(t => t.id === other).body, 'original PK-c');
    assert.match(beforeRestart.find(t => t.id === sibling).body, /claimant note after notice snapshot/);
    await app.close();
    app = createAgoraServer({ dir: serverDir });
    const restoredUrl = await listen(Number(new URL(baseUrl).port));
    assert.deepEqual(app.store.listTasks().map(t => [t.id, t.body]), beforeRestart.map(t => [t.id, t.body]));
    // Run the real command through its current scoped identity, not a fresh
    // registration or the plan's unrelated per-wave identity directory. A new
    // CLI process also avoids reusing a socket closed by the private restart.
    const planFile = path.join(root, 'plan.json'), noticeFile = path.join(root, 'notice.json');
    fs.writeFileSync(planFile, JSON.stringify({ ...p, baseUrl: restoredUrl }));
    fs.writeFileSync(noticeFile, JSON.stringify(notice));
    const cli = fileURLToPath(new URL('./orchestrate.mjs', import.meta.url));
    const repeat = await promisify(execFile)(process.execPath, [cli, 'control-notice', planFile, noticeFile], { env, timeout: 10_000 });
    assert.match(repeat.stdout, /"appended": \[\]/);
    assert.match(repeat.stdout, /"alreadyPresent": \[/);
    assert.match(repeat.stdout, /"broadcast": false/);
    assert.doesNotMatch(repeat.stderr, /workers will create their own tasks/);
    const command = await promisify(execFile)(process.execPath, [cli, 'control-notice', planFile, noticeFile, '--dry'], { env, timeout: 10_000 });
    assert.match(command.stdout, /"dryRun": true/);
    assert.match(command.stdout, /"present": true/);
    assert.equal(app.store.listAgents().filter(a => a.status !== 'retired').length, 1);
  } finally {
    await app.close();
    assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir()));
    fs.rmSync(root, { recursive: true, force: true });
  }
});
