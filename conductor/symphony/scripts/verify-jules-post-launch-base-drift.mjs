import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { TaskIntakeStore } from '../dist/task-intake.js';

// This verifier protects the Jules launch-source boundary.
//
// A Jules session starts from the repository state that existed when the handoff
// was prepared or launched. If origin/master moves afterward, Symphony must not
// imply that Jules automatically received those later task docs or tracker
// changes. The dashboard should keep the session active, but it must surface a
// post-launch drift warning that points to explicit update channels.

const execFileAsync = promisify(execFile);
const roots = [];

async function git(cwd, args) {
  return execFileAsync('git', ['-C', cwd, ...args], {
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
  });
}

async function makeSyncedRepo() {
  const root = await mkdtemp(join(tmpdir(), 'symphony-post-launch-drift-'));
  const remote = join(root, 'remote.git');
  const local = join(root, 'local');
  roots.push(root);

  await execFileAsync('git', ['init', '--bare', remote]);
  await execFileAsync('git', ['clone', remote, local]);
  await git(local, ['config', 'user.name', 'Symphony Verifier']);
  await git(local, ['config', 'user.email', 'symphony-verifier@example.test']);
  await writeFile(join(local, 'README.md'), '# Jules base drift fixture\n', 'utf8');
  await git(local, ['add', 'README.md']);
  await git(local, ['commit', '-m', 'base commit for launched Jules session']);
  await git(local, ['branch', '-M', 'master']);
  await git(local, ['push', '-u', 'origin', 'master']);

  return { root, local };
}

try {
  const repo = await makeSyncedRepo();
  const storePath = join(repo.root, 'task-drafts.json');
  const store = new TaskIntakeStore({
    repoRoot: repo.local,
    storePath,
  });

  // Prepare a normal handoff first so the stored git preflight captures the
  // original origin/master commit that Jules would have cloned.
  const draftSnapshot = await store.createDraft({
    title: 'Spell Phase 1 Package Fixture Drift',
    body: 'Launch a Jules session, then move origin/master to prove later tracker edits do not arrive automatically.',
    expectedFiles: ['docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md'],
    verificationCommands: ['npm.cmd run validate:spells'],
  });
  const promoted = await store.promoteDraft(draftSnapshot.drafts[0].id, { requireLinearIssue: false });
  const launchedBase = promoted.handoffs[0].gitPreflight.remoteCommit;
  assert.ok(launchedBase);

  // Mark the handoff as already launched, matching the real Package 9 failure
  // mode where re-staging would not update the running Jules clone.
  const stored = JSON.parse(await readFile(storePath, 'utf8'));
  stored.handoffs[0] = {
    ...stored.handoffs[0],
    status: 'sent_to_jules',
    julesSessionId: 'post-launch-drift-session',
    julesSessionUrl: 'https://jules.google.com/session/post-launch-drift-session',
    julesState: 'IN_PROGRESS',
    launchedAt: '2026-05-25T12:00:00.000Z',
  };
  await writeFile(storePath, `${JSON.stringify(stored, null, 2)}\n`, 'utf8');

  // Move origin/master after launch to simulate a tracker/doc PR landing while
  // Jules is already running from its isolated checkout.
  await writeFile(join(repo.local, 'README.md'), '# Jules base drift fixture\n\nTracker update after launch.\n', 'utf8');
  await git(repo.local, ['add', 'README.md']);
  await git(repo.local, ['commit', '-m', 'move origin after Jules launch']);
  await git(repo.local, ['push', 'origin', 'master']);

  const snapshot = await store.snapshot();
  const handoff = snapshot.handoffs[0];

  assert.equal(handoff.status, 'sent_to_jules');
  assert.equal(handoff.julesSessionId, 'post-launch-drift-session');
  assert.ok(handoff.baseCommitDrift);
  assert.equal(handoff.baseCommitDrift.phase, 'post_launch');
  assert.equal(handoff.baseCommitDrift.requiredAction, 'send_post_launch_update');
  assert.equal(handoff.baseCommitDrift.stagedRemoteCommit, launchedBase);
  assert.notEqual(handoff.baseCommitDrift.currentRemoteCommit, launchedBase);
  assert.match(handoff.baseCommitDrift.summary, /will not receive later tracker or workflow edits automatically/i);
  assert.ok(handoff.baseCommitDrift.updateChannels.includes('visible Jules message'));
  assert.ok(handoff.baseCommitDrift.updateChannels.includes('bounded [Jules feedback] PR comment'));
} finally {
  await Promise.all(roots.map(root => rm(root, { recursive: true, force: true })));
}
