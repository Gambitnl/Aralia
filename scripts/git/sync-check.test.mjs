/** Distinguish TypeScript configuration syntax from strict runtime JSON. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { command } from './nightly-snapshot.mjs';

test('sync gate accepts TypeScript comments but rejects malformed runtime JSON', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aralia-sync-json-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  command('git', ['init', '-b', 'master', root]);
  fs.writeFileSync(path.join(root, 'tsconfig.json'), '{ // config intent\n "compilerOptions": { "strict": true, }, }');
  const check = () => spawnSync(process.execPath, [path.resolve('scripts/git/sync-check.cjs')], { cwd: root, encoding: 'utf8' });
  assert.equal(check().status, 0);
  fs.mkdirSync(path.join(root, 'public/data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'public/data/spell.json'), '{ // not valid JSON\n "id": "example" }');
  const result = check();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid JSON in public/);
});
