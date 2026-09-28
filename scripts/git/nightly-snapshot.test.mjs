/** Disposable Git repositories prove recovery, index preservation, and publication gates. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { command, makeRunner, healthReasons, assessChanges } from './nightly-snapshot.mjs';

function fixture(t, options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aralia-save-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const remote = path.join(dir, 'remote.git'), repo = path.join(dir, 'repo');
  const git = args => command('git', ['-C', repo, ...args]);
  command('git', ['init', '--bare', remote]);
  command('git', ['init', '-b', 'master', repo]);
  git(['config', 'user.name', 'Backup Test']); git(['config', 'user.email', 'backup-test@example.invalid']);
  fs.mkdirSync(path.join(repo, 'scripts/git'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'scripts/git/commit-msg-agora-guard.cjs'), `const fs=require('fs'); if(process.argv[2]==='--hold-back-locked')fs.writeFileSync(process.argv[3],'');`);
  fs.writeFileSync(path.join(repo, 'source.txt'), 'before\n');
  git(['add', '-A']); git(['commit', '-m', 'initial']); git(['remote', 'add', 'origin', remote]); git(['push', '-u', 'origin', 'master']);
  const config = { repoPath: repo, stateDir: path.join(dir, 'state'), expectedRemote: remote,
    gitleaksPath: options.gitleaksPath || process.env.TEST_GITLEAKS_PATH,
    gitleaksConfig: process.env.TEST_GITLEAKS_CONFIG, limits: options.limits };
  return { dir, repo, remote, git, config, runner: makeRunner(config) };
}

test('health detects disabled task, stale save, failed run, and pending commits', () => {
  assert.equal(healthReasons({ taskState: 'Disabled', snapshotTime: '2026-09-01T00:00:00Z', ahead: 1,
    lastRunResult: 1, lastReceipt: { status: 'blocked', message: 'review' }, now: Date.parse('2026-10-02T00:00:00Z') }).length, 5);
  assert.deepEqual(healthReasons({ taskState: 'Ready', snapshotTime: '2026-10-01T12:00:00Z', now: Date.parse('2026-10-02T00:00:00Z') }), []);
});

test('large deletions and large binaries require review', () => {
  assert.equal(assessChanges([{ file: 'x.bin', added: '-', removed: '-', deleted: false }], { 'x.bin': 11000000 }).reasons.length, 1);
  assert.equal(assessChanges([{ file: 'x', added: '0', removed: '20000', deleted: true }], {}).reasons.length, 1);
});

test('clean tree retries a previously unpushed snapshot', async t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.repo, 'source.txt'), 'after\n');
  f.git(['add', '-A']); f.git(['commit', '-m', 'auto: daily snapshot 2026-10-01']);
  assert.equal(f.git(['status', '--porcelain']).trim(), '');
  const result = await f.runner.run();
  assert.equal(result.status, 'success');
  assert.equal(f.git(['rev-parse', 'HEAD']).trim(), f.git(['rev-parse', 'origin/master']).trim());
});

test('anomaly restores the exact pre-run staged index and leaves HEAD unchanged', async t => {
  const f = fixture(t, { limits: { deletedFiles: 1 } });
  fs.unlinkSync(path.join(f.repo, 'source.txt')); f.git(['add', '-A']);
  const before = fs.readFileSync(path.join(f.repo, '.git/index')), head = f.git(['rev-parse', 'HEAD']);
  await assert.rejects(f.runner.run(), /needs change review/);
  assert.deepEqual(fs.readFileSync(path.join(f.repo, '.git/index')), before);
  assert.equal(f.git(['rev-parse', 'HEAD']), head);
});

test('preview does not change the real index or HEAD', async t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.repo, 'new.txt'), 'pending\n');
  const before = fs.readFileSync(path.join(f.repo, '.git/index')), head = f.git(['rev-parse', 'HEAD']);
  assert.equal((await f.runner.run({ dryRun: true })).status, 'preview');
  assert.deepEqual(fs.readFileSync(path.join(f.repo, '.git/index')), before);
  assert.equal(f.git(['rev-parse', 'HEAD']), head);
});

test('a fake secret is blocked by the real scanner before commit or push', async t => {
  const f = fixture(t);
  // Generate a token-shaped fixture; well-known AWS examples are allowlisted by the scanner.
  const fake = ['gh', 'p'].join('') + '_' + crypto.randomBytes(18).toString('hex');
  fs.writeFileSync(path.join(f.repo, 'credentials.txt'), `github_token = ${fake}\n`);
  const head = f.git(['rev-parse', 'HEAD']);
  await assert.rejects(f.runner.run(), /failed \(23\)/);
  assert.equal(f.git(['rev-parse', 'HEAD']), head);
  assert.equal(f.git(['rev-parse', 'origin/master']), head);
  const report = fs.readFileSync(path.join(f.config.stateDir, 'secrets-redacted.json'), 'utf8');
  assert.ok(!report.includes(fake));
});

test('a failed push keeps a local snapshot, and the next clean run recovers', async t => {
  const f = fixture(t);
  const reject = path.join(f.remote, 'hooks/pre-receive');
  fs.writeFileSync(reject, '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  fs.writeFileSync(path.join(f.repo, 'source.txt'), 'recover me\n');
  await assert.rejects(f.runner.run(), /failed/);
  assert.equal(f.git(['status', '--porcelain']).trim(), '');
  assert.equal(f.git(['rev-list', '--count', 'origin/master..HEAD']).trim(), '1');
  fs.unlinkSync(reject);
  await f.runner.run();
  assert.equal(f.git(['rev-parse', 'HEAD']), f.git(['rev-parse', 'origin/master']));
});

test('missing scanner fails closed and restores staging', async t => {
  const f = fixture(t, { gitleaksPath: path.join(os.tmpdir(), 'missing-gitleaks.exe') });
  fs.writeFileSync(path.join(f.repo, 'source.txt'), 'must not publish\n');
  const head = f.git(['rev-parse', 'HEAD']), before = fs.readFileSync(path.join(f.repo, '.git/index'));
  await assert.rejects(f.runner.run(), /ENOENT/);
  assert.equal(f.git(['rev-parse', 'HEAD']), head);
  assert.deepEqual(fs.readFileSync(path.join(f.repo, '.git/index')), before);
});
