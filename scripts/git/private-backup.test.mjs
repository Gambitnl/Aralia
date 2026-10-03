/** Verify cloud-copy exclusions and safe removal without touching source files. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { eligible, prepare, redactCopy } from './private-backup.mjs';
import { storageReasons } from './backup-policy.mjs';

test('cloud copy excludes credentials, profiles, caches, media and oversized text', () => {
  for (const file of ['aralia/.env', 'aralia/.env.local', 'aralia/auth.json', 'aralia/.agent/scratch/nightly-save/restic-last.jsonl', 'aralia/node_modules/test.js', 'aralia/cdp-profile/Preferences.json', 'aralia/frame.png']) assert.equal(eligible(file, 100), false, file);
  assert.equal(eligible('aralia/large.json', 6 * 1024 * 1024), false);
  assert.equal(eligible('aralia/.agent/scratch/research.md', 100), true);
  assert.equal(eligible('aralia/src/ignored-tool.tsx', 100), true);
});

test('redaction changes only the backup copy and refuses source-tree paths', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aralia-redact-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const target = path.join(dir, 'copy'); fs.mkdirSync(target);
  const source = path.join(dir, 'source.txt'), copy = path.join(target, 'source.txt');
  fs.writeFileSync(source, 'one\r\nfixture-secret\r\nthree\r\n'); fs.copyFileSync(source, copy);
  redactCopy(target, [{ File: copy, StartLine: 2, EndLine: 2, RuleID: 'fixture' }]);
  assert.ok(!fs.readFileSync(copy, 'utf8').includes('fixture-secret'));
  assert.ok(fs.readFileSync(source, 'utf8').includes('fixture-secret'));
  assert.throws(() => redactCopy(target, [{ File: source, StartLine: 2, EndLine: 2 }]), /outside/);
});

test('copy updates and removes stale backup files while preserving sources and git metadata', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aralia-private-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const source = path.join(dir, 'source'), target = path.join(dir, 'aralia-private-source');
  fs.mkdirSync(source); fs.mkdirSync(path.join(target, '.git'), { recursive: true });
  fs.writeFileSync(path.join(source, 'tool.ts'), 'one'); fs.writeFileSync(path.join(source, '.env'), 'SECRET=fixture');
  const config = { privateGitDir: target, privateSources: [{ name: 'aralia', path: source }] };
  assert.equal(prepare(config).files, 1);
  assert.equal(fs.readFileSync(path.join(target, 'aralia/tool.ts'), 'utf8'), 'one');
  fs.unlinkSync(path.join(source, 'tool.ts')); prepare(config);
  assert.equal(fs.existsSync(path.join(target, 'aralia/tool.ts')), false);
  assert.equal(fs.existsSync(path.join(target, '.git')), true);
  assert.equal(fs.readFileSync(path.join(source, '.env'), 'utf8'), 'SECRET=fixture');
});

test('storage limits stop growth without expiring protected versions', () => {
  assert.deepEqual(storageReasons({ bytes: 90, freeBytes: 30, maxBytes: 100, minFreeBytes: 20 }), []);
  assert.equal(storageReasons({ bytes: 100, freeBytes: 30, maxBytes: 100, minFreeBytes: 20 }).length, 1);
  assert.equal(storageReasons({ bytes: 90, freeBytes: 10, maxBytes: 100, minFreeBytes: 20 }).length, 1);
});

test('the private copy refuses growth over its own budget and leaves source intact', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aralia-budget-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const source = path.join(dir, 'source'); fs.mkdirSync(source);
  fs.writeFileSync(path.join(source, 'large.txt'), 'keep this source');
  assert.throws(() => prepare({ privateGitDir: path.join(dir, 'aralia-private-source'), privateSources: [{ name: 'source', path: source }], privateMaxBytes: 5 }), /disk budget/);
  assert.equal(fs.readFileSync(path.join(source, 'large.txt'), 'utf8'), 'keep this source');
});
