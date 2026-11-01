// These syntax fixtures prove the guard sees hidden/invented exports. They do
// not substitute for running the repaired suites against production imports.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectMockContracts, mockContractAudit } from './mockContractAudit.mjs';

test('WF314: bare factories fail; both supported partial-import forms retain real exports', () => {
  const full = "vi.mock('@/utils/character/savingThrowUtils', () => ({rollSavingThrow: vi.fn()}))";
  assert.deepEqual(inspectMockContracts(full).findings.map(f => f.code), ['saving-throw-full-mock']);
  for (const source of [
    "vi.mock('@/utils/character/savingThrowUtils', async original => {const actual = await original(); return {...actual, rollSavingThrow: vi.fn()}})",
    "import { vi as control } from 'vitest'; control.mock(import('../../utils/character/savingThrowUtils'), async () => {const real = await control.importActual('../../utils/character/savingThrowUtils'); return {...real, calculateSpellDC: () => 17}})",
  ]) assert.equal(inspectMockContracts(source).findings.length, 0);
  const wrong = "vi.mock('@/utils/character/savingThrowUtils', async () => {const real = await vi.importActual('@/other'); return {...real}})";
  assert.equal(inspectMockContracts(wrong).findings[0].code, 'saving-throw-full-mock');
});

test('WF315: direct and hoisted retired exports fail, while real geometry and dice-module mocks remain', () => {
  const source = "const pins=vi.hoisted(()=>({rollDice: vi.fn(), rollDamage: vi.fn()})); vi.mock('../../../utils/combat/combatUtils', async original=>{const actual=await original(); return {...actual,...pins}})";
  assert.equal(inspectMockContracts(source).findings[0].code, 'retired-dice-export');
  assert.equal(inspectMockContracts("vi.mock('@/utils/combat', ()=>({rollD20: vi.fn()}))").findings[0].code, 'retired-dice-export');
  const repaired = "vi.mock('@/utils/combat', ()=>({getDistance:()=>5})); vi.mock('@/systems/dice/rollers', ()=>({rollDice:vi.fn()}))";
  assert.equal(inspectMockContracts(repaired).findings.length, 0);
});

test('unsupported/computed factories are review findings, not silent clean contracts', () => {
  assert.equal(inspectMockContracts("vi.mock('@/utils/combat', ()=>buildFactory())").findings[0].code, 'review-factory');
  assert.equal(inspectMockContracts("vi.mock('@/utils/combat', ()=>({...importedControls}))").findings[0].code, 'review-spread');
  assert.throws(() => inspectMockContracts('vi.mock('), /invalid test syntax/);
});

test('explicit read-only discovery preserves files, skips links, and rejects escaping/non-test scopes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mock-contract-'));
  try {
    fs.mkdirSync(path.join(root, 'tests'));
    const file = path.join(root, 'tests', 'control.test.ts');
    const body = "vi.mock('@/utils/character/savingThrowUtils',()=>({rollSavingThrow:vi.fn()}))\r\n";
    fs.writeFileSync(file, body);
    fs.writeFileSync(path.join(root, 'production.ts'), 'not a test');
    fs.symlinkSync(root, path.join(root, 'tests', 'loop'), 'junction');
    const result = mockContractAudit({ repoRoot: root, tests: ['tests'] });
    assert.equal(result.files, 1);
    assert.equal(result.findings.length, 1);
    assert.equal(fs.readFileSync(file, 'utf8'), body);
    assert.throws(() => mockContractAudit({ repoRoot: root, tests: ['production.ts'] }), /test file/);
    assert.throws(() => mockContractAudit({ repoRoot: root, tests: ['..'] }), /escapes/);
  } finally {
    assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir()));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('current commands/hooks retain actual save exports and do not mock retired combat dice exports', () => {
  const report = mockContractAudit({ tests: ['src/commands', 'src/hooks'] });
  assert.ok(report.files > 0 && report.factories > 0);
  assert.deepEqual(report.findings, []);
});
