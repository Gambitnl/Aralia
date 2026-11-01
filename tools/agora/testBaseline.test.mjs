// Private reporter fixtures prove failure attribution limits, never repo acceptance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { captureTestBaseline, validateTestBaseline, baselineTaskText, compareTestBaseline, readTestJson } from './testBaseline.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), now = Date.now();
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-test-baseline-'));
  t.after(() => { assert.equal(path.dirname(root), path.resolve(os.tmpdir())); assert.match(path.basename(root), /^agora-test-baseline-/); fs.rmSync(root, { recursive: true, force: true }); }); return root;
}
function report(root, start = now - 100, statuses = ['failed', 'passed'], message = 'existing failure') {
  return { startTime: start, success: !statuses.includes('failed'), numPendingTestSuites: 0, numTotalTests: statuses.length,
    numFailedTests: statuses.filter(status => status === 'failed').length, numPassedTests: statuses.filter(status => status === 'passed').length,
    testResults: [{ name: path.join(root, 'src/owned.test.ts'), startTime: start, endTime: start + 10, status: statuses.includes('failed') ? 'failed' : 'passed', message: '',
      assertionResults: statuses.map((status, index) => ({ fullName: 'case ' + index, status, failureMessages: status === 'failed' ? [message] : [] })) }] };
}
test('WF284: fresh known-red evidence names files/identities without changing the report', t => {
  const root = fixture(t), raw = report(root), original = JSON.stringify(raw);
  const receipt = captureTestBaseline(raw, { repoRoot: root, command: 'npx vitest run src --pool=threads', now });
  assert.equal(validateTestBaseline(receipt, { repoRoot: root, now }), receipt);
  const text = baselineTaskText(receipt, { repoRoot: root, now }); assert.match(text, /Known failing files: src\/owned.test.ts/); assert.match(text, /case 0/);
  assert.match(text, /Never subtract a whole red file/); assert.equal(JSON.stringify(raw), original);
});
test('WF284: inherited failures remain red and a new failure in the same red file is a regression', t => {
  const root = fixture(t), receipt = captureTestBaseline(report(root), { repoRoot: root, command: 'vitest run src', now });
  const after = report(root, now + 10, ['failed', 'failed']); const delta = compareTestBaseline(receipt, after, { repoRoot: root, command: receipt.command, now: now + 100 });
  assert.equal(delta.inheritedFailures.length, 1); assert.equal(delta.regressions.length, 1); assert.equal(delta.acceptanceGreen, false); assert.equal(delta.fullSuiteSuccess, false);
  const changed = compareTestBaseline(receipt, report(root, now + 10, ['failed', 'passed'], 'different failure'), { repoRoot: root, command: receipt.command, now: now + 100 });
  assert.equal(changed.inheritedFailures.length, 0); assert.equal(changed.regressions.length, 1);
});
test('WF284: missing/skipped tests cannot turn a reduced result into green acceptance', t => {
  const root = fixture(t), receipt = captureTestBaseline(report(root), { repoRoot: root, command: 'vitest run src', now });
  const omitted = compareTestBaseline(receipt, report(root, now + 10, ['passed']), { repoRoot: root, command: receipt.command, now: now + 100 });
  assert.equal(omitted.fullSuiteSuccess, true); assert.equal(omitted.acceptanceGreen, false); assert.equal(omitted.missingTests.length, 1);
  const skipped = compareTestBaseline(receipt, report(root, now + 10, ['skipped', 'passed']), { repoRoot: root, command: receipt.command, now: now + 100 });
  assert.equal(skipped.acceptanceGreen, false); assert.equal(skipped.resolvedFailures.length, 0); assert.equal(skipped.unverifiedTests.length, 1);
  const green = compareTestBaseline(receipt, report(root, now + 10, ['passed', 'passed']), { repoRoot: root, command: receipt.command, now: now + 100 });
  assert.equal(green.acceptanceGreen, true); assert.equal(green.resolvedFailures.length, 1);
});
test('WF284: stale, forged summary, mismatched scope, duplicated tests and incomplete totals fail closed', t => {
  const root = fixture(t), receipt = captureTestBaseline(report(root), { repoRoot: root, command: 'vitest run src', now });
  assert.throws(() => validateTestBaseline(receipt, { repoRoot: root, now: now + 3 * 60 * 60 * 1000 }), /older than two hours/);
  const forged = structuredClone(receipt); forged.summary.failures = []; assert.throws(() => validateTestBaseline(forged, { repoRoot: root, now }), /inconsistent/);
  assert.throws(() => compareTestBaseline(receipt, report(root, now + 10), { repoRoot: root, command: 'vitest run other', now: now + 100 }), /Commands differ/);
  const outside = report(root); outside.testResults[0].name = path.join(root, '../other.test.ts'); assert.throws(() => captureTestBaseline(outside, { repoRoot: root, command: receipt.command, now }), /outside/);
  const duplicate = report(root); duplicate.testResults[0].assertionResults[1].fullName = 'case 0'; assert.throws(() => captureTestBaseline(duplicate, { repoRoot: root, command: receipt.command, now }), /duplicate test/);
  const totals = report(root); totals.numFailedTests = 0; assert.throws(() => captureTestBaseline(totals, { repoRoot: root, command: receipt.command, now }), /totals contradict/);
  assert.throws(() => compareTestBaseline(receipt, report(root, now - 10), { repoRoot: root, command: receipt.command, now: now + 100 }), /predates/);
});
test('WF284: suite-hook failures and unreadable/oversized evidence remain visible', t => {
  const root = fixture(t), raw = report(root, now - 100, ['skipped', 'skipped']); raw.success = false; raw.testResults[0].status = 'failed'; raw.testResults[0].message = 'beforeEach timed out';
  const receipt = captureTestBaseline(raw, { repoRoot: root, command: 'vitest run src', now }); assert.equal(receipt.summary.failures[0].kind, 'suite');
  assert.match(baselineTaskText(receipt, { repoRoot: root, now }), /beforeEach timed out/);
  const emptyHook = report(root, now - 100, []); emptyHook.success = false; emptyHook.testResults[0].status = 'failed'; emptyHook.testResults[0].message = 'collection failed';
  const emptyReceipt = captureTestBaseline(emptyHook, { repoRoot: root, command: 'vitest run src', now });
  const emptyAfter = report(root, now + 10, []); const emptyComparison = compareTestBaseline(emptyReceipt, emptyAfter, { repoRoot: root, command: emptyReceipt.command, now: now + 100 });
  assert.equal(emptyComparison.acceptanceGreen, false, 'a zero-test pass does not prove repaired collection');
  const file = path.join(root, 'bad.json'); fs.writeFileSync(file, Buffer.from([0xff])); assert.throws(() => readTestJson(file));
  fs.writeFileSync(file, 'x'.repeat(2 * 1024 * 1024 + 1)); assert.throws(() => readTestJson(file), /at most2MiB/);
});
test('WF284: actual isolated Vitest JSON capture/compare keeps inherited and new failures distinct', t => {
  const root = fixture(t), testFile = path.join(root, 'owned.test.js'), config = path.join(root, 'vitest.config.mjs');
  fs.writeFileSync(config, 'export default { test: { globals: true, include: ["owned.test.js"], maxWorkers: 1 } };\n');
  const source = "test('inherited failure', () => { expect(1).toBe(2); });\ntest('owned passing assertion', () => { expect(1).toBe(1); });\n";
  fs.writeFileSync(testFile, source);
  const command = 'vitest run owned.test.js --pool=threads';
  const runVitest = name => {
    const output = path.join(root, name); const run = spawnSync(process.execPath, [path.resolve(here, '../../node_modules/vitest/vitest.mjs'), 'run', 'owned.test.js', '--root', root, '--config', config, '--pool=threads', '--reporter=json', '--outputFile', output], { cwd: root, encoding: 'utf8', timeout: 60000, windowsHide: true });
    assert.equal(run.status, 1, run.stdout + run.stderr); return output;
  };
  const pre = runVitest('pre.json'), receiptFile = path.join(root, 'receipt.json');
  const capture = spawnSync(process.execPath, [path.join(here, 'testBaseline.mjs'), 'capture', '--report', pre, '--command', command, '--root', root, '--output', receiptFile], { encoding: 'utf8', timeout: 30000 });
  assert.equal(capture.status, 0, capture.stdout + capture.stderr); assert.match(capture.stdout, /Known failing files: owned.test.js/);
  const receipt = readTestJson(receiptFile), before = fs.readFileSync(receiptFile, 'utf8');
  fs.writeFileSync(testFile, source.replace('expect(1).toBe(1)', 'expect(1).toBe(3)'));
  const post = runVitest('post.json');
  const compare = spawnSync(process.execPath, [path.join(here, 'testBaseline.mjs'), 'compare', '--baseline', receiptFile, '--report', post, '--command', command, '--root', root], { encoding: 'utf8', timeout: 30000 });
  assert.equal(compare.status, 1, compare.stdout + compare.stderr); const delta = JSON.parse(compare.stdout);
  assert.equal(delta.inheritedFailures.length, 1); assert.equal(delta.regressions.length, 1); assert.equal(delta.acceptanceGreen, false);
  assert.equal(fs.readFileSync(receiptFile, 'utf8'), before); assert.equal(receipt.summary.failures.length, 1);
});
