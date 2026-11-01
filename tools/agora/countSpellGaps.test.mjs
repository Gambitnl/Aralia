// Read-only counting proof: pure summaries plus the real validator on private
// mutable corpora. Fixtures change; shared spell data and runtime never do.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { summarizeSpellGaps } from './countSpellGaps.mjs';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('WF-G343: named gaps count files, not repeated issues, and preserve gate failures/clearances', () => {
  const result = { scanned: 3, checked: 3, cleared: [{ file: 'light.json', spellId: 'light' }], failures: [
    { file: 'two.json', issues: ['Upcast Gap: first', 'Upcast Gap: duplicate', 'Enchantment Gap: missing filter'] },
    { file: 'one.json', issues: ['Upcast Gap: missing scaling'] },
    { file: 'other.json', issues: ['Concentration Mismatch'] },
  ] };
  const receipt = summarizeSpellGaps(result, { measuredAt: '2026-10-09T00:00:00.000Z' });
  assert.deepEqual(receipt.counts, { 'Enchantment Gap': 1, 'Upcast Gap': 2 });
  assert.deepEqual(receipt.gapFiles['Upcast Gap'], ['one.json', 'two.json']);
  assert.equal(receipt.complete, true); assert.equal(receipt.mechanicalGatePass, false);
  assert.deepEqual(receipt.reviewedClearances, result.cleared);
  assert.deepEqual(receipt.failures, result.failures);
});

test('WF-G343: empty, unchecked and malformed canonical results cannot claim zero gaps', () => {
  for (const [scanned, checked] of [[0, 0], [2, 1]]) {
    const receipt = summarizeSpellGaps({ scanned, checked, failures: [], cleared: [] });
    assert.equal(receipt.complete, false); assert.equal(receipt.counts, null);
    assert.equal(receipt.gapFiles, null); assert.equal(receipt.mechanicalGatePass, false);
  }
  for (const result of [{}, { scanned: 1, checked: 2, failures: [], cleared: [] },
    { scanned: 1, checked: 1, failures: [{ file: 'x', issues: [null] }], cleared: [] }]) {
    assert.throws(() => summarizeSpellGaps(result), /Invalid canonical/);
  }
});

test('WF-G343: actual CLI remeasures changed fixtures and refuses incomplete corpora without writes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-count-source-'));
  const command = ['--import', 'tsx', 'tools/agora/countSpellGaps.mjs', '--root', root];
  const run = () => {
    const result = spawnSync(process.execPath, command, { cwd: repo, encoding: 'utf8', timeout: 30000 });
    assert.equal(result.signal, null, result.stderr);
    return { code: result.status, receipt: JSON.parse(result.stdout) };
  };
  try {
    const original = fs.readFileSync(path.join(repo, 'public/data/spells/level-0/fire-bolt.json'), 'utf8');
    const dirty = JSON.parse(original);
    // Keep the schema's required unrestricted defaults; only the school and
    // scaling change, so this measures mechanical gaps rather than parse errors.
    dirty.school = 'Enchantment';
    dirty.higherLevels = 'Damage grows when a higher spell slot is used.';
    for (const effect of dirty.effects) delete effect.scaling;
    const file = path.join(root, 'probe.json');
    const bytes = JSON.stringify(dirty);
    fs.writeFileSync(file, bytes);
    const before = run();
    assert.equal(before.code, 0, JSON.stringify(before.receipt)); assert.equal(before.receipt.complete, true);
    assert.deepEqual(before.receipt.counts, { 'Enchantment Gap': 1, 'Upcast Gap': 1 });
    assert.equal(fs.readFileSync(file, 'utf8'), bytes, 'measurement never repairs data');
    fs.writeFileSync(file, original);
    const repaired = run();
    assert.equal(repaired.code, 0);
    assert.deepEqual(repaired.receipt.counts, { 'Enchantment Gap': 0, 'Upcast Gap': 0 });
    assert.equal(fs.readFileSync(file, 'utf8'), original);
    fs.writeFileSync(path.join(root, 'broken.json'), '{');
    const incomplete = run();
    assert.equal(incomplete.code, 2); assert.equal(incomplete.receipt.complete, false);
    assert.equal(incomplete.receipt.counts, null);
    assert.match(incomplete.receipt.failures.find(item => item.file === 'broken.json').issues[0], /Parse or validator error/);
    assert.deepEqual(fs.readdirSync(root).sort(), ['broken.json', 'probe.json']);
    const badArgs = spawnSync(process.execPath, [...command.slice(0, 3), '--unknown'], { cwd: repo, encoding: 'utf8' });
    assert.equal(badArgs.status, 2); assert.match(JSON.parse(badArgs.stdout).error, /Usage/);
  } finally {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    fs.rmSync(root, { recursive: true, force: true });
  }
});
