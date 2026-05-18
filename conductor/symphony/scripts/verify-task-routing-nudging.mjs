import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { TaskIntakeStore } from '../dist/task-intake.js';

// This verifier protects Symphony's task-tracker and task-nudger role.
//
// Symphony should not blindly send every draft to Jules. It should classify
// whether a draft is better for a local Codex agent or for Jules, expose a
// pause-aware next action, and avoid dispatching anything while GitHub sync is
// blocked.

const execFileAsync = promisify(execFile);

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

async function makeSyncedRepo(prefix) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  const remote = join(root, 'remote.git');
  const local = join(root, 'local');

  await execFileAsync('git', ['init', '--bare', remote]);
  await execFileAsync('git', ['clone', remote, local]);
  await configureUser(local);
  await writeFile(join(local, 'README.md'), '# Routing fixture\n', 'utf8');
  await git(local, ['add', 'README.md']);
  await git(local, ['commit', '-m', 'base commit for routing fixture']);
  await git(local, ['branch', '-M', 'master']);
  await git(local, ['push', '-u', 'origin', 'master']);

  return { root, local };
}

const roots = [];

try {
  const small = await makeSyncedRepo('symphony-small-routing-');
  roots.push(small.root);
  const smallStore = new TaskIntakeStore({
    repoRoot: small.local,
    storePath: join(small.root, 'task-drafts.json'),
  });
  const smallSnapshot = await smallStore.createDraft({
    title: 'Fix dashboard wording typo',
    body: 'Small copy-only dashboard edit. This should be quicker as local Codex work than a Jules cloud handoff.',
    expectedFiles: ['conductor/symphony/public/dashboard.js'],
    verificationCommands: ['npm.cmd run build'],
  });

  assert.equal(smallSnapshot.preflight.ok, true);
  assert.equal(smallSnapshot.taskRouting.route, 'local_agent');
  assert.equal(smallSnapshot.taskRouting.nextAction.code, 'assign_local_agent');
  assert.equal(smallSnapshot.taskRouting.nextAction.pauseSeconds, 0);
  assert.match(smallSnapshot.taskRouting.summary, /local Codex agent/i);
  assert.ok(smallSnapshot.taskRouting.reasons.some(reason => /small/i.test(reason)));

  const broad = await makeSyncedRepo('symphony-jules-routing-');
  roots.push(broad.root);
  const broadStore = new TaskIntakeStore({
    repoRoot: broad.local,
    storePath: join(broad.root, 'task-drafts.json'),
  });
  const broadSnapshot = await broadStore.createDraft({
    title: 'Plan multi-stage Jules handoff for encounter systems',
    body: 'Ask Jules to make a plan first, then tackle a multi-file implementation that touches encounter generation, docs, tests, and dashboard evidence.',
    expectedFiles: [
      'src/systems/encounters/generator.ts',
      'src/data/bestiary/index.ts',
      'docs/encounters.md',
      'conductor/symphony/public/dashboard.js',
    ],
    verificationCommands: ['npm.cmd run build', 'npm.cmd run test'],
  });

  assert.equal(broadSnapshot.preflight.ok, true);
  assert.equal(broadSnapshot.taskRouting.route, 'jules_plan');
  assert.equal(broadSnapshot.taskRouting.nextAction.code, 'send_to_jules');
  assert.equal(broadSnapshot.taskRouting.nextAction.pauseSeconds, 300);
  assert.match(broadSnapshot.taskRouting.summary, /Jules plan/i);
  assert.ok(broadSnapshot.taskRouting.reasons.some(reason => /multi-file/i.test(reason)));

  const blocked = await makeSyncedRepo('symphony-blocked-routing-');
  roots.push(blocked.root);
  await writeFile(join(blocked.local, 'README.md'), '# Routing fixture\n\nlocal edit\n', 'utf8');
  const blockedStore = new TaskIntakeStore({
    repoRoot: blocked.local,
    storePath: join(blocked.root, 'task-drafts.json'),
  });
  const blockedSnapshot = await blockedStore.createDraft({
    title: 'Small task blocked by Git',
    body: 'Small edit, but the GitHub sync gate is blocked so no Jules or local agent should start yet.',
    expectedFiles: ['README.md'],
    verificationCommands: ['npm.cmd run build'],
  });

  assert.equal(blockedSnapshot.preflight.ok, false);
  assert.equal(blockedSnapshot.taskRouting.route, 'blocked');
  assert.equal(blockedSnapshot.taskRouting.nextAction.code, 'wait');
  assert.equal(blockedSnapshot.taskRouting.nextAction.pauseSeconds, 0);
  assert.match(blockedSnapshot.taskRouting.summary, /GitHub sync gate/i);
  assert.ok(blockedSnapshot.taskRouting.reasons.some(reason => /blocked/i.test(reason)));
} finally {
  await Promise.all(roots.map(root => rm(root, { recursive: true, force: true })));
}
