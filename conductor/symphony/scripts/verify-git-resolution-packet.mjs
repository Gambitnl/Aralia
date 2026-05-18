import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { TaskIntakeStore } from '../dist/task-intake.js';

// This verifier protects the read-only Git resolution packet.
//
// The packet is the stage-level evidence Symphony needs before a human,
// foreman, or dashboard can decide how to repair a blocked Jules launch base.
// It must name the actual commits and files without pulling, pushing, stashing,
// deleting, or otherwise mutating the user's checkout.

const execFileAsync = promisify(execFile);
const root = await mkdtemp(join(tmpdir(), 'symphony-git-resolution-'));
const remote = join(root, 'remote.git');
const local = join(root, 'local');
const collaborator = join(root, 'collaborator');

async function git(cwd, args) {
  return execFileAsync('git', ['-C', cwd, ...args], {
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
  });
}

async function configureUser(cwd) {
  await git(cwd, ['config', 'user.name', 'Symphony Verifier']);
  await git(cwd, ['config', 'user.email', 'symphony-verifier@example.test']);
}

try {
  await execFileAsync('git', ['init', '--bare', remote]);
  await execFileAsync('git', ['clone', remote, local]);
  await configureUser(local);

  await writeFile(join(local, 'README.md'), '# Sync base\n', 'utf8');
  await git(local, ['add', 'README.md']);
  await git(local, ['commit', '-m', 'base commit for sync packet']);
  await git(local, ['branch', '-M', 'master']);
  await git(local, ['push', '-u', 'origin', 'master']);

  await execFileAsync('git', ['clone', remote, collaborator]);
  await configureUser(collaborator);
  await writeFile(join(collaborator, 'REMOTE.md'), 'remote-only work\n', 'utf8');
  await git(collaborator, ['add', 'REMOTE.md']);
  await git(collaborator, ['commit', '-m', 'remote-only update for sync packet']);
  await git(collaborator, ['push', 'origin', 'master']);

  await writeFile(join(local, 'LOCAL.md'), 'local-only work\n', 'utf8');
  await git(local, ['add', 'LOCAL.md']);
  await git(local, ['commit', '-m', 'local-only update for sync packet']);

  await writeFile(join(local, 'README.md'), '# Sync base\n\ntracked local edit\n', 'utf8');
  await mkdir(join(local, 'scratch', 'nested'), { recursive: true });
  await writeFile(join(local, 'scratch', 'nested', 'artifact.txt'), 'nested untracked proof\n', 'utf8');

  const store = new TaskIntakeStore({
    repoRoot: local,
    storePath: join(root, 'task-drafts.json'),
  });

  const preflight = await store.runGitSyncPreflight();
  const packet = preflight.resolutionPacket;

  assert.equal(preflight.ok, false);
  assert.ok(packet, 'preflight should include a read-only resolutionPacket');
  assert.equal(packet.mutatesGit, false);
  assert.equal(packet.baseBranch, 'master');
  assert.equal(packet.remoteBranch, 'origin/master');
  assert.match(packet.summary, /1 local-only commit/);
  assert.match(packet.summary, /1 remote-only commit/);
  assert.match(packet.summary, /1 tracked change/);
  assert.match(packet.summary, /1 untracked file/);

  assert.equal(packet.localCommits.length, 1);
  assert.match(packet.localCommits[0].message, /local-only update for sync packet/);
  assert.match(packet.localCommits[0].side, /local/);

  assert.equal(packet.remoteCommits.length, 1);
  assert.match(packet.remoteCommits[0].message, /remote-only update for sync packet/);
  assert.match(packet.remoteCommits[0].side, /remote/);

  assert.deepEqual(packet.trackedFiles.map(file => file.path), ['README.md']);
  assert.equal(packet.trackedFiles[0].status.trim(), 'M');
  assert.deepEqual(packet.untrackedFiles.map(file => file.path), ['scratch/nested/artifact.txt']);
  assert.equal(packet.untrackedFiles[0].status, '??');

  assert.ok(packet.commands.inspectDivergence.includes('log --oneline --left-right'));
  assert.ok(packet.commands.fullStatus.includes('--untracked-files=all'));
  assert.match(packet.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
} finally {
  await rm(root, { recursive: true, force: true });
}
