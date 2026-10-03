// tools/agora/client.orchestration.test.mjs
// CLI tests for the orchestrator-upgrade commands: task new --dep/--priority/--ref,
// task next, task done --result, tasks --ready.
//   node --test "tools/agora/*.test.mjs"

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createAgoraServer } from './server.mjs';
import { run } from './client.mjs';

let app;
let serverDir;
let clientDir;
let baseUrl;
let env;

before(async () => {
  serverDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-cli-orch-srv-'));
  clientDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-cli-orch-id-'));
  app = createAgoraServer({ dir: serverDir });
  await new Promise((resolve) => app.listen(0, resolve));
  const port = app.server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
  env = { AGORA_DIR: clientDir, AGORA_AGENT_ID: 'orchestration-test', AGORA_PET: 'gf-sd' };
});

after(async () => {
  if (app) await app.close();
  for (const d of [serverDir, clientDir]) {
    if (d) fs.rmSync(d, { recursive: true, force: true });
  }
});

function cli(argv, extra = {}) {
  return run(argv, { env, baseUrl, ...extra });
}

test('WF-G293: task show discloses an empty legacy body instead of silently omitting it', async () => {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-wfg293-show-'));
  const fixture = createAgoraServer({ dir: path.join(fixtureDir, 'server') });
  try {
    await new Promise((resolve) => fixture.listen(0, resolve));
    const url = `http://127.0.0.1:${fixture.server.address().port}`;
    const scoped = { AGORA_DIR: path.join(fixtureDir, 'client'), AGORA_AGENT_ID: 'legacy-show', AGORA_PET: 'gf-sd' };
    const call = (argv) => run(argv, { env: scoped, baseUrl: url });
    assert.equal((await call(['register', 'legacy-author', '--session', 'wfg293-show-test'])).code, 0);
    const made = await call(['task', 'new', 'legacy title-only task']);
    assert.equal(made.code, 0, made.lines.join('\n'));
    const shown = await call(['task', 'show', made.task.id]);
    assert.equal(shown.code, 0);
    assert.match(shown.lines.join('\n'), /BODY EMPTY.*no instructions/i);
  } finally {
    await fixture.close();
    const target = path.resolve(fixtureDir);
    assert.ok(target.startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test('orchestration flow: deps + priority + next + done --result + ready view', async () => {
  const reg = await cli(['register', 'orch-cli', '--note', 'cli orchestration test']);
  assert.equal(reg.code, 0);

  // Create a prep task and a gated, high-priority build task referencing a gap.
  const a = await cli(['task', 'new', 'prep the fixtures', '--id-only']);
  assert.equal(a.code, 0);
  const aId = a.lines[0];

  const b = await cli([
    'task', 'new', 'build the feature',
    '--dep', aId, '--priority', '8', '--ref', 'spells:G12', '--id-only',
  ]);
  assert.equal(b.code, 0);
  assert.deepEqual(b.task.deps, [{ id: aId, type: 'blocks' }]);
  assert.equal(b.task.priority, 8);
  assert.deepEqual(b.task.refs, ['spells:G12']);

  // Ready queue: only the dep-free prep task.
  let ready = await cli(['tasks', '--ready']);
  assert.equal(ready.tasks.length, 1);
  assert.equal(ready.tasks[0].title, 'prep the fixtures');

  // Worker pulls it, completes it with a recorded result.
  const next = await cli(['task', 'next']);
  assert.equal(next.task.id, aId);
  const done = await cli(['task', 'done', aId, '--result', 'fixtures staged; 4 tests green']);
  assert.equal(done.code, 0);
  assert.equal(done.task.result, 'fixtures staged; 4 tests green');

  // The gated task is now the ready head; `tasks` shows the recorded result.
  ready = await cli(['tasks', '--ready']);
  assert.equal(ready.tasks[0].title, 'build the feature');
  const board = await cli(['tasks']);
  assert.match(board.lines.join('\n'), /result: fixtures staged; 4 tests green/);

  // Drain: next claims the build task, then reports an empty queue.
  const next2 = await cli(['task', 'next']);
  assert.equal(next2.task.title, 'build the feature');
  const dry = await cli(['task', 'next']);
  assert.equal(dry.task, null);
  assert.match(dry.lines.join('\n'), /no ready tasks/);
});

test('task next can pull from one campaign or category lane', async () => {
  const filterEnv = { ...env, AGORA_AGENT_ID: 'cli-filter-worker' };
  const filterCli = (argv) => run(argv, { env: filterEnv, baseUrl });
  await filterCli(['register', 'cli-filter-worker']);

  for (const [id, suffix] of [['cli-lane-a', 'a'], ['cli-lane-b', 'b']]) {
    const claim = await filterCli([
      'campaign', 'claim', id,
      '--role', 'lead',
      '--path', `tmp/cli-filter-${suffix}`,
    ]);
    assert.equal(claim.code, 0);
  }
  const laneA = await filterCli([
    'task', 'new', 'CLI lane A',
    '--campaign', 'cli-lane-a', '--category', 'backend', '--priority', '100',
  ]);
  const laneB = await filterCli([
    'task', 'new', 'CLI lane B',
    '--campaign', 'cli-lane-b', '--category', 'frontend', '--priority', '200',
  ]);

  const byCampaign = await filterCli(['task', 'next', '--campaign', 'cli-lane-a']);
  assert.equal(byCampaign.task.id, laneA.task.id);
  const byCategory = await filterCli(['task', 'next', '--category', 'frontend']);
  assert.equal(byCategory.task.id, laneB.task.id);
  const dryLane = await filterCli(['task', 'next', '--campaign', 'cli-lane-a']);
  assert.equal(dryLane.task, null);
});

test('campaign commands: lead claims, overlap conflicts, list view, and task namespace', async () => {
  const leadEnv = { ...env, AGORA_AGENT_ID: 'campaign-cli-lead' };
  const rivalEnv = { ...env, AGORA_AGENT_ID: 'campaign-cli-rival' };
  const leadCli = (argv) => run(argv, { env: leadEnv, baseUrl });
  const rivalCli = (argv) => run(argv, { env: rivalEnv, baseUrl });

  await leadCli(['register', 'campaign-cli-lead']);
  await rivalCli(['register', 'campaign-cli-rival']);

  // The lead command records the owning scope on the board.
  const claim = await leadCli([
    'campaign', 'claim', 'cli-governance',
    '--role', 'lead',
    '--scope', 'Agora CLI governance',
    '--glob', 'tools/agora/**',
    '--wave', 'cli-wave',
  ]);
  assert.equal(claim.code, 0);
  // D-W: the id is a code; the name a person typed is kept and still resolves.
  assert.equal(claim.campaign.name, 'cli-governance');
  assert.match(claim.campaign.id, /^agora-[0-9a-f]{4}$/);

  // A rival lead sees a hard conflict before any tasks are seeded.
  const conflict = await rivalCli([
    'campaign', 'claim', 'cli-rival',
    '--role', 'lead',
    '--scope', 'competing CLI wave',
    '--path', 'tools/agora/client.mjs',
  ]);
  assert.equal(conflict.code, 1);
  assert.match(conflict.lines.join('\n'), /overlaps active lead campaign/);

  const task = await leadCli([
    'task', 'new', 'campaign-scoped task',
    '--campaign', 'cli-governance',
    '--wave', 'cli-wave',
  ]);
  assert.equal(task.code, 0);
  assert.equal(task.task.campaignId, claim.campaign.id);

  const listed = await leadCli(['campaigns']);
  assert.equal(listed.code, 0);
  assert.match(listed.lines.join('\n'), /cli-governance/);
  assert.match(listed.lines.join('\n'), /lead/);
  // D-AA: the listing used to print `owner:online`, which answered a question
  // that could not be answered — a session always ends, so every campaign
  // eventually read "owner gone" whether or not anyone had abandoned it. The
  // line now reports the durable owner and whether anyone is ON it.
  //
  // This campaign was claimed by a session holding NO seat, so it has no
  // durable owner and can never be attended. Saying so is the honest reading
  // of every campaign claimed before seats existed.
  assert.match(listed.lines.join('\n'), /no seat — UNATTENDED/);
  assert.doesNotMatch(listed.lines.join('\n'), /owner:/);
});

test('cli: --dep <id>:<type> names a type, and task dep-types lists all ten', async () => {
  await cli(['register', 'deptype-cli', '--note', 'typed dep cli test']);

  const list = await cli(['task', 'dep-types']);
  assert.equal(list.code, 0);
  assert.equal(list.depTypes.length, 10);
  assert.equal(list.depTypes.filter((d) => d.blocking).length, 4);

  const base = await cli(['task', 'new', 'the original approach', '--id-only']);
  const baseId = base.lines[0];

  // A colon names the type. Task ids hold no colon, so the split is safe.
  const later = await cli([
    'task', 'new', 'the replacement', '--dep', `${baseId}:supersedes`, '--id-only',
  ]);
  assert.equal(later.code, 0);
  assert.deepEqual(later.task.deps, [{ id: baseId, type: 'supersedes' }]);

  // A bare id still means what it always meant.
  const gated = await cli(['task', 'new', 'waits on the original', '--dep', baseId, '--id-only']);
  assert.deepEqual(gated.task.deps, [{ id: baseId, type: 'blocks' }]);

  // A wrong type fails at the CLI too, rather than becoming the default edge.
  const bad = await cli(['task', 'new', 'bad', '--dep', `${baseId}:depends-on`, '--id-only']);
  assert.equal(bad.code, 1);
});

// --- WF-G169 / WF-G171: the campaign decision on the command line ----------

/** A daemon in `required` intake mode with its own client identity store, so
 *  the shared `app` above keeps the legacy behavior the older CLI tests need. */
async function withStrictCli(body, { campaignIntake = 'required' } = {}) {
  const srvDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-cli-intake-srv-'));
  const idDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-cli-intake-id-'));
  const strict = createAgoraServer({ dir: srvDir, campaignIntake });
  await new Promise((resolve) => strict.listen(0, resolve));
  const url = `http://127.0.0.1:${strict.server.address().port}`;
  const strictEnv = { AGORA_DIR: idDir, AGORA_AGENT_ID: 'strict-cli-test', AGORA_PET: 'gf-sd' };
  const call = (argv, extra = {}) => run(argv, { env: strictEnv, baseUrl: url, ...extra });
  try {
    await body(call, { idDir });
  } finally {
    await strict.close();
    for (const d of [srvDir, idDir]) fs.rmSync(d, { recursive: true, force: true });
  }
}

test('WF-G171: task new demands a campaign decision and takes --standalone --reason', async () => {
  await withStrictCli(async (call) => {
    assert.equal((await call(['register', 'cli-intake', '--note', 'intake test'])).code, 0);

    // Neither flag: the daemon refuses, and the message names both ways out.
    const bare = await call(['task', 'new', 'no decision']);
    assert.equal(bare.code, 1);
    assert.match(bare.lines.join('\n'), /explicit campaign decision/);

    // --standalone without --reason never leaves the client.
    const silent = await call(['task', 'new', 'silent opt-out', '--standalone']);
    assert.equal(silent.code, 1);
    assert.match(silent.lines.join('\n'), /--standalone needs --reason/);

    // Both at once is incoherent, so it is refused before the round trip.
    const both = await call([
      'task', 'new', 'both', '--standalone', '--campaign', 'anything', '--reason', 'why',
    ]);
    assert.equal(both.code, 1);
    assert.match(both.lines.join('\n'), /not both/);

    // The supported opt-out, and the board echoes the decision back.
    const alone = await call([
      'task', 'new', 'lone repair', '--standalone', '--reason', 'one-off repair, no effort owns it',
      '--body', 'Repair the one-off issue and record the result.',
    ]);
    assert.equal(alone.code, 0, alone.lines.join('\n'));
    assert.equal(alone.task.campaignId, '');
    assert.equal(alone.task.campaignDecision.kind, 'standalone');
    assert.match(alone.lines.join('\n'), /standalone — one-off repair/);

    // task show says the membership was decided, not merely missing.
    const shown = await call(['task', 'show', alone.task.id]);
    assert.equal(shown.code, 0);
    assert.match(shown.lines.join('\n'), /campaign: standalone — one-off repair/);
  });
});

test('WF-G279/WF-G298: task new warns on absent body and ref paths, except declared creates', async () => {
  await withStrictCli(async (call) => {
    assert.equal((await call(['register', 'cli-path-check', '--note', 'path warning test'])).code, 0);
    const misplacedLock = await call([
      'lock', 'src/hooks/combat/useBattleMap.ts', '--reason', 'verify WF-G279 lock path',
    ]);
    assert.equal(misplacedLock.code, 0, misplacedLock.lines.join('\n'));
    assert.match(misplacedLock.lines.join('\n'), /!! src\/hooks\/combat\/useBattleMap\.ts.*does not exist.*src\/hooks\/useBattleMap\.ts/);
    assert.equal((await call(['unlock', misplacedLock.lock.id])).code, 0);
    const idOnlyLock = await call([
      'lock', 'src/hooks/combat/useBattleMap.ts', '--reason', 'verify id-only lock warning', '--id-only',
    ]);
    assert.equal(idOnlyLock.code, 0, idOnlyLock.lines.join('\n'));
    assert.deepEqual(idOnlyLock.lines, [idOnlyLock.lock.id]);
    assert.match((idOnlyLock.stderrLines || []).join('\n'), /src\/hooks\/combat\/useBattleMap\.ts.*does not exist.*src\/hooks\/useBattleMap\.ts/);
    const stale = await call([
      'task', 'new', 'repair map paths', '--standalone', '--reason', 'path verification probe',
      '--body', 'Edit src/hooks/combat/useBattleMap.ts near line 248.',
      '--ref', 'src/components/BattleMap3D',
    ]);
    assert.equal(stale.code, 0, stale.lines.join('\n'));
    assert.match(stale.lines.join('\n'), /WARNING:.*src\/hooks\/combat\/useBattleMap\.ts.*does not exist/);
    assert.match(stale.lines.join('\n'), /WARNING:.*src\/components\/BattleMap3D.*does not exist/);
    const directoryRef = await call([
      'task', 'new', 'verify trailing slash ref', '--standalone', '--reason', 'path verification probe',
      '--ref', 'src/components/BattleMap3D/',
    ]);
    assert.equal(directoryRef.code, 0, directoryRef.lines.join('\n'));
    assert.match(directoryRef.lines.join('\n'), /WARNING: ref "src\/components\/BattleMap3D" does not exist/);
    const spacedRef = await call([
      'task', 'new', 'verify spaced ref', '--standalone', '--reason', 'path verification probe',
      '--ref', 'tools/agora/new file.ts',
    ]);
    assert.equal(spacedRef.code, 0, spacedRef.lines.join('\n'));
    assert.deepEqual(spacedRef.lines.filter((line) => line.startsWith('WARNING:')), [
      'WARNING: ref "tools/agora/new file.ts" does not exist in this checkout (WF-G81/WF-G279/WF-G298). Fix the path or declare CREATES: / EXPECTED-ABSENT: in --body when intentional.',
    ]);
    const lint = await call(['task', 'lint', stale.task.id]);
    assert.equal(lint.code, 1);
    assert.deepEqual(lint.lint.missingPaths.sort(), [
      'src/components/BattleMap3D', 'src/hooks/combat/useBattleMap.ts',
    ]);
    const idOnlyTask = await call([
      'task', 'new', 'verify id-only warning', '--standalone', '--reason', 'path verification probe',
      '--ref', 'src/components/BattleMap3D', '--id-only',
    ]);
    assert.equal(idOnlyTask.code, 0, idOnlyTask.lines.join('\n'));
    assert.deepEqual(idOnlyTask.lines, [idOnlyTask.task.id]);
    assert.match((idOnlyTask.stderrLines || []).join('\n'), /src\/components\/BattleMap3D.*does not exist/);

    const creates = await call([
      'task', 'new', 'create new map file', '--standalone', '--reason', 'path verification probe',
      '--body', 'CREATES: src/hooks/combat/newMapProbe.ts', '--ref', 'src/hooks/combat/newMapProbe.ts',
    ]);
    assert.equal(creates.code, 0, creates.lines.join('\n'));
    assert.doesNotMatch(creates.lines.join('\n'), /WARNING:.*newMapProbe/);
  });
});

test('WF-G169: task campaign moves a task and both reads agree', async () => {
  await withStrictCli(async (call) => {
    assert.equal((await call([
      'register', 'cli-move-orch', '--role', 'orchestrator', '--session', 'thread-cli-move',
    ])).code, 0);
    assert.equal((await call(['campaign', 'claim', 'keel-cli', '--scope', 'k', '--path', 'src/keel'])).code, 0);
    assert.equal((await call(['campaign', 'claim', 'mast-cli', '--scope', 'm', '--path', 'src/mast'])).code, 0);

    const made = await call(['task', 'new', 'plank', '--campaign', 'keel-cli',
      '--body', 'Repair the plank and verify campaign membership.', '--id-only']);
    assert.equal(made.code, 0, made.lines.join('\n'));
    const id = made.task.id;

    // Usage is refused without a reason, because the move goes on the record.
    const noReason = await call(['task', 'campaign', id, 'mast-cli']);
    assert.equal(noReason.code, 1);
    assert.match(noReason.lines.join('\n'), /Usage: task campaign/);

    const moved = await call([
      'task', 'campaign', id, 'mast-cli', '--reason', 'review found the right effort',
    ]);
    assert.equal(moved.code, 0, moved.lines.join('\n'));
    assert.match(moved.lines.join('\n'), /Moved .* -> /);
    assert.equal(moved.task.campaignId, moved.task.campaignId);

    // task show and campaign show report the same membership.
    const shown = await call(['task', 'show', id]);
    assert.match(shown.lines.join('\n'), /campaign: /);
    const view = await call(['campaign', 'show', 'mast-cli']);
    assert.equal(view.code, 0, view.lines.join('\n'));
    assert.match(view.lines.join('\n'), new RegExp(id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

    // Standalone is a supported destination from the command line too.
    const loosed = await call([
      'task', 'campaign', id, '--standalone', '--reason', 'split out of the effort',
    ]);
    assert.equal(loosed.code, 0, loosed.lines.join('\n'));
    assert.equal(loosed.task.campaignId, '');
    const after = await call(['task', 'show', id]);
    assert.match(after.lines.join('\n'), /campaign: standalone — split out of the effort/);
  });
});

test('WF-G316: task id filtering never matches another task result', async () => {
  await withStrictCli(async (call) => {
    assert.equal((await call(['register', 'cli-dependency-poll', '--note', 'dependency poll test'])).code, 0);
    const completed = await call([
      'task', 'new', 'completed work', '--standalone', '--reason', 'dependency poll test',
      '--body', 'Complete this fixture task before polling the dependency.',
    ]);
    const waiting = await call([
      'task', 'new', 'unfinished dependency', '--standalone', '--reason', 'dependency poll test',
      '--body', 'Remain open while the other fixture task completes.',
    ]);
    assert.equal(completed.code, 0);
    assert.equal(waiting.code, 0);
    assert.equal((await call(['task', 'claim', completed.task.id])).code, 0);
    assert.equal((await call([
      'task', 'done', completed.task.id, '--result', `Filed follow-up ${waiting.task.id}`,
    ])).code, 0);

    const notDone = await call(['tasks', '--state', 'done', '--id', waiting.task.id]);
    assert.equal(notDone.code, 0, notDone.lines.join('\n'));
    assert.deepEqual(notDone.tasks, []);
    assert.doesNotMatch(notDone.lines.join('\n'), /Filed follow-up/);

    const actual = await call(['tasks', '--id', waiting.task.id]);
    assert.equal(actual.code, 0, actual.lines.join('\n'));
    assert.deepEqual(actual.tasks.map((task) => task.id), [waiting.task.id]);
    assert.match(actual.lines.join('\n'), /\[open\]/);

    const done = await call(['tasks', '--state', 'done', '--id', completed.task.id]);
    assert.equal(done.code, 0, done.lines.join('\n'));
    assert.deepEqual(done.tasks.map((task) => task.id), [completed.task.id]);

    const ambiguous = await call(['tasks', '--id', 'agora-']);
    assert.equal(ambiguous.code, 1);
    assert.match(ambiguous.lines.join('\n'), /ambiguous task id/);
    assert.equal((await call(['tasks', '--id', 'no-such-task'])).code, 1);
    assert.equal((await call(['tasks', '--id'])).code, 1);
  });
});

test('WF-G230: task show does not label a claimed task not ready', async () => {
  await withStrictCli(async (call) => {
    assert.equal((await call(['register', 'cli-readiness', '--note', 'readiness marker test'])).code, 0);
    const blocker = await call([
      'task', 'new', 'prep work', '--standalone', '--reason', 'readiness marker test',
      '--body', 'Prepare the fixture before the follow-up task.',
    ]);
    const gated = await call([
      'task', 'new', 'follow-up work', '--standalone', '--reason', 'readiness marker test',
      '--dep', blocker.task.id, '--body', 'Wait for prep work, then run the follow-up.',
    ]);
    assert.equal(blocker.code, 0);
    assert.equal(gated.code, 0);

    const open = await call(['task', 'show', gated.task.id]);
    assert.match(open.lines[0], /\[open\].*not ready: 1 unmet dep/);

    assert.equal((await call(['task', 'claim', blocker.task.id])).code, 0);
    const claimed = await call(['task', 'show', blocker.task.id]);
    assert.match(claimed.lines[0], /\[claimed\]/);
    assert.doesNotMatch(claimed.lines[0], /not ready/);
  });
});

test('WF-G234/WF-G322: file evidence survives task completion and reports stored length', async () => {
  await withStrictCli(async (call, { idDir }) => {
    assert.equal((await call(['register', 'cli-evidence', '--note', 'evidence file test'])).code, 0);
    const made = await call([
      'task', 'new', 'record exact evidence', '--standalone', '--reason', 'evidence file test',
      '--body', 'Record exact result evidence from the fixture file.',
    ]);
    assert.equal(made.code, 0);
    const id = made.task.id;
    assert.equal((await call(['task', 'claim', id])).code, 0);

    const proof = `StatusMarker gained a \`color\` field.\n${'x'.repeat(2000)}\nExact end.`;
    const proofPath = path.join(idDir, 'proof with spaces.txt');
    fs.writeFileSync(proofPath, proof, 'utf8');
    const reason = 'Completed after checking the \`color\` field.';
    const reasonPath = path.join(idDir, 'reason.txt');
    fs.writeFileSync(reasonPath, reason, 'utf8');

    const missing = await call(['task', 'done', id, '--result-file', `${proofPath}.missing`]);
    assert.equal(missing.code, 1);
    assert.match(missing.lines.join('\n'), /cannot read.*result-file/);
    assert.equal((await call(['task', 'show', id])).task.state, 'claimed');

    const conflict = await call(['task', 'done', id, '--result', 'inline', '--result-file', proofPath]);
    assert.equal(conflict.code, 1);
    assert.match(conflict.lines.join('\n'), /choose either --result or --result-file/);
    const reasonConflict = await call(['task', 'done', id, '--reason', 'inline', '--reason-file', reasonPath]);
    assert.equal(reasonConflict.code, 1);
    assert.match(reasonConflict.lines.join('\n'), /choose either --reason or --reason-file/);
    const emptyPath = path.join(idDir, 'empty-proof.txt');
    fs.writeFileSync(emptyPath, '', 'utf8');
    const empty = await call(['task', 'done', id, '--result-file', emptyPath]);
    assert.equal(empty.code, 1);
    assert.match(empty.lines.join('\n'), /result-file.*is empty/);

    const closed = await call(['task', 'done', id, '--result-file', proofPath, '--reason-file', reasonPath]);
    assert.equal(closed.code, 0, closed.lines.join('\n'));
    assert.equal(closed.task.result, proof);
    assert.match(closed.lines.join('\n'), new RegExp(`result: ${Buffer.byteLength(proof, 'utf8')} UTF-8 bytes stored; exact match`));
    const shown = await call(['task', 'show', id]);
    assert.equal(shown.task.result, proof);
    assert.equal(shown.task.history.at(-1).reason, reason);

    const blocked = await call([
      'task', 'new', 'block with file reason', '--standalone', '--reason', 'evidence file test',
      '--body', 'Record a blocked reason from the fixture file.',
    ]);
    assert.equal(blocked.code, 0);
    const state = await call(['task', 'state', blocked.task.id, 'blocked', '--reason-file', reasonPath]);
    assert.equal(state.code, 0, state.lines.join('\n'));
    assert.equal(state.task.history.at(-1).reason, reason);

    const stateTask = await call([
      'task', 'new', 'state with file result', '--standalone', '--reason', 'evidence file test',
      '--body', 'Complete this fixture task with a result file.',
    ]);
    assert.equal(stateTask.code, 0);
    assert.equal((await call(['task', 'claim', stateTask.task.id])).code, 0);
    const stateDone = await call(['task', 'state', stateTask.task.id, 'done', '--result-file', proofPath]);
    assert.equal(stateDone.code, 0, stateDone.lines.join('\n'));
    assert.equal(stateDone.task.result, proof);
    assert.match(stateDone.lines.join('\n'), /UTF-8 bytes stored; exact match/);
  });
});

test('WF-G302: worker task show routes missing campaign repair to an authorized role', async () => {
  await withStrictCli(async (call) => {
    assert.equal((await call(['register', 'cli-worker-campaign-hint', '--note', 'campaign hint test'])).code, 0);
    const made = await call(['task', 'new', 'legacy task without campaign']);
    assert.equal(made.code, 0, made.lines.join('\n'));
    const shown = await call(['task', 'show', made.task.id]);
    assert.equal(shown.code, 0, shown.lines.join('\n'));
    assert.match(shown.lines.join('\n'), /campaign: NONE RECORDED/);
    assert.match(shown.lines.join('\n'), /An orchestrator\/master\/human can run: task campaign/);
    assert.match(shown.lines.join('\n'), /workers should ask one to do so/);
    assert.doesNotMatch(shown.lines.join('\n'), /NONE RECORDED — set one with:/);
  }, { campaignIntake: 'legacy' });
});
