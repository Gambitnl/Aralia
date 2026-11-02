/**
 * Exercise the actual production-debt CLI in disposable Git checkouts. These
 * fixtures prove CI rejects added debt and baseline updates cannot restore room
 * for debt that was already removed. No application or shared Git index changes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { countSource, isProductionSource, validateBaseline } = require('./debt-summary.cjs');
const cli = fileURLToPath(new URL('./debt-summary.cjs', import.meta.url));

function git(root, args) {
  const result = spawnSync('git', ['-c', 'core.fsmonitor=false', ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}
async function fixture(t, source = 'export const value: any = {} as any;\n') {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aralia-debt-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.mkdir(path.join(root, 'scripts/quality'), { recursive: true });
  await fs.writeFile(path.join(root, 'src/value.ts'), source);
  git(root, ['init', '--quiet']);
  git(root, ['add', 'src/value.ts']);
  return root;
}
function run(root, option = '--ratchet') {
  return spawnSync(process.execPath, [cli, option], { cwd: root, encoding: 'utf8' });
}

test('syntax counts actual any types and comment directives, not literal examples', async () => {
  const source = [
    'const message = "as any // eslint-disable @ts-ignore";',
    'const template = '+String.fromCharCode(96)+'// @ts-nocheck'+String.fromCharCode(96)+';',
    'const pattern = /eslint-disable|@ts-ignore/;',
    'const view = <span>as any // eslint-disable @ts-ignore</span>;',
    '// Documentation mentions as any and @ts-ignore without issuing a directive.',
    '// eslint-disable-next-line example',
    'export const value: any = {} as any;',
    '/* @ts-ignore reason */',
    '// @ts-expect-error reason',
    '// @ts-nocheck',
  ].join('\n');
  assert.deepEqual(await countSource(source, 'src/view.tsx'), {
    anyType: 2, anyAssertion: 1, eslintDisable: 1, tsIgnore: 1, tsExpectError: 1, tsNoCheck: 1,
  });
  assert.equal((await countSource('export const x = <any>{};', 'src/value.ts')).anyAssertion, 1);
});

test('inventory includes declarations and generated production, excludes explicit tests and mocks', () => {
  for (const file of ['src/value.ts', 'src/a.d.ts', 'src/a.generated.ts', 'src/view.jsx', 'src/a.mts']) assert.ok(isProductionSource(file), file);
  for (const file of ['scripts/x.ts', 'src/a.test.ts', 'src/a.spec.tsx', 'src/a.test-d.ts', 'src/__tests__/x.ts', 'src/__mocks__/x.ts', 'src/tests/x.ts']) assert.equal(isProductionSource(file), false, file);
});

test('the CI command rejects a deliberately added production assertion and refuses baseline inflation', async t => {
  const root = await fixture(t);
  assert.equal(run(root, '--ratchet-update').status, 0);
  assert.equal(run(root).status, 0);
  await fs.appendFile(path.join(root, 'src/value.ts'), 'export const regression = {} as any;\n');
  git(root, ['add', 'src/value.ts']);
  const failed = run(root);
  assert.equal(failed.status, 1, failed.stderr);
  assert.match(failed.stdout, /INCREASE src\/value.ts anyAssertion: 2 > 1/);
  const baseline = await fs.readFile(path.join(root, 'scripts/quality/debt-baseline.json'), 'utf8');
  assert.equal(run(root, '--ratchet-update').status, 1);
  assert.equal(await fs.readFile(path.join(root, 'scripts/quality/debt-baseline.json'), 'utf8'), baseline);
});

test('a reduction must lower the baseline and removed debt cannot return', async t => {
  const root = await fixture(t);
  assert.equal(run(root, '--ratchet-update').status, 0);
  await fs.writeFile(path.join(root, 'src/value.ts'), 'export const value = {};\n');
  git(root, ['add', 'src/value.ts']);
  assert.equal(run(root).status, 1);
  assert.match(run(root).stdout, /allowances can shrink/);
  assert.equal(run(root, '--ratchet-update').status, 0);
  assert.equal(run(root).status, 0);
  await fs.appendFile(path.join(root, 'src/value.ts'), 'export const regression = {} as any;\n');
  git(root, ['add', 'src/value.ts']);
  assert.equal(run(root).status, 1);
});

test('a new tracked production file has zero allowance; ignored, untracked and test files do not change CI inventory', async t => {
  const root = await fixture(t);
  assert.equal(run(root, '--ratchet-update').status, 0);
  await fs.writeFile(path.join(root, '.gitignore'), 'src/ignored.ts\n');
  for (const file of ['ignored.ts', 'untracked.ts', 'example.test.ts', 'new.generated.ts']) await fs.writeFile(path.join(root, 'src', file), 'export const x = {} as any;\n');
  git(root, ['add', 'src/example.test.ts']);
  assert.equal(run(root).status, 0);
  git(root, ['add', 'src/new.generated.ts']);
  assert.equal(run(root).status, 1);
  assert.match(run(root).stdout, /INCREASE src\/new.generated.ts/);
});

test('missing or malformed baselines and an empty inventory fail closed', async t => {
  const root = await fixture(t);
  assert.equal(run(root).status, 1);
  await fs.writeFile(path.join(root, 'scripts/quality/debt-baseline.json'), '{}');
  assert.equal(run(root).status, 1);
  assert.equal(run(root, '--ratchet-update').status, 1);
  assert.throws(() => validateBaseline({ schemaVersion: 1, policy: 'staged-production-src-v1', files: { 'src/x.ts': { anyType: -1 } } }), /Invalid debt baseline entry/);
  git(root, ['rm', '--cached', 'src/value.ts']);
  assert.equal(run(root).status, 1);
});

test('quality lane is required, ratchet failures block it, and the broad scan remains advisory', async () => {
  const ci = await fs.readFile(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const lane = ci.slice(ci.indexOf('  quality-scan:'), ci.indexOf('  required:'));
  assert.match(lane, /run: node scripts\/quality\/debt-summary.cjs --ratchet/);
  assert.doesNotMatch(lane.slice(0, lane.indexOf('    steps:')), /continue-on-error/);
  assert.doesNotMatch(lane.slice(lane.indexOf('      - name: Enforce'), lane.indexOf('      - run: npm --silent')), /continue-on-error/);
  assert.match(lane, /quality-scan.json\n        continue-on-error: true/);
  assert.match(ci, /needs: \[policy, typecheck, build, lint, validate, test, heavy-tests, node-tests, quality-scan\]/);
});


test('unstaged peer changes never enter a capture; staging them makes the check fail', async t => {
  const root = await fixture(t);
  await fs.appendFile(path.join(root, 'src/value.ts'), 'export const peer = {} as any;\n');
  assert.equal(run(root, '--ratchet-update').status, 0);
  const baseline = JSON.parse(await fs.readFile(path.join(root, 'scripts/quality/debt-baseline.json'), 'utf8'));
  assert.equal(baseline.files['src/value.ts'].anyAssertion, 1);
  assert.equal(run(root).status, 0);
  git(root, ['add', 'src/value.ts']);
  assert.equal(run(root).status, 1);
});


test('bulk index blobs preserve Unicode byte lengths and paths with spaces', async t => {
  const root = await fixture(t, 'export const label = "café 🌿";\n');
  await fs.writeFile(path.join(root, 'src/écho file.ts'), 'export const value: any = "🌿" as any;\n');
  git(root, ['add', 'src/écho file.ts']);
  assert.equal(run(root, '--ratchet-update').status, 0);
  const baseline = JSON.parse(await fs.readFile(path.join(root, 'scripts/quality/debt-baseline.json'), 'utf8'));
  assert.equal(baseline.files['src/écho file.ts'].anyType, 2);
  assert.equal(run(root).status, 0);
});
