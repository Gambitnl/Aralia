import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { filterReviewedMonolithicClearance } from '../../src/systems/spells/validation/spellIntegrityClearances';
import { checkSpellIntegrity, runSpellIntegrity, SPELL_INTEGRITY_RULES } from '../validateSpellIntegrity';

const REPO_SPELLS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public/data/spells');
const temporaryRoots: string[] = [];

function temporarySpellRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spell-integrity-test-'));
  temporaryRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('spell integrity CLI gate', () => {
  it('runs all 11 mechanical rules over the current spell corpus', () => {
    const result = checkSpellIntegrity(REPO_SPELLS);
    expect(SPELL_INTEGRITY_RULES).toHaveLength(11);
    expect(result.scanned).toBeGreaterThan(400);
    expect(result.checked).toBe(result.scanned);
    expect(result.failures).toEqual([]);
    expect(result.cleared.map((entry) => entry.spellId)).toEqual(
      expect.arrayContaining(['light', 'enhance-ability']),
    );
  });

  it('prints the rule names and fails for an actual concentration mismatch', () => {
    const root = temporarySpellRoot();
    const levelDir = path.join(root, 'level-1');
    fs.mkdirSync(levelDir);
    const bless = JSON.parse(fs.readFileSync(path.join(REPO_SPELLS, 'level-1', 'bless.json'), 'utf8'));
    bless.tags = bless.tags.filter((tag: string) => tag !== 'concentration');
    fs.writeFileSync(path.join(levelDir, 'bless.json'), JSON.stringify(bless));

    const lines: string[] = [];
    expect(runSpellIntegrity(root, (line) => lines.push(line))).toBe(false);
    const output = lines.join('\n');
    for (const rule of SPELL_INTEGRITY_RULES) expect(output).toContain(rule);
    expect(output).toContain('Concentration Mismatch');
    expect(output).toContain('FAIL: 1 mechanically checked, 1 failing file(s).');
  });

  it('clears only the reviewed monolithic rule and never other errors', () => {
    const errors = ['Monolithic Effect Description', 'Concentration Mismatch'];
    expect(filterReviewedMonolithicClearance({ id: 'light' }, errors)).toEqual(['Concentration Mismatch']);
    expect(filterReviewedMonolithicClearance({ id: 'unreviewed-spell' }, errors)).toEqual(errors);
  });

  it('fails closed on an empty corpus or invalid JSON', () => {
    const root = temporarySpellRoot();
    expect(runSpellIntegrity(root, () => {})).toBe(false);
    fs.writeFileSync(path.join(root, 'broken.json'), '{');
    const result = checkSpellIntegrity(root);
    expect(result.scanned).toBe(1);
    expect(result.checked).toBe(0);
    expect(result.failures[0].issues[0]).toContain('Parse or validator error');
  });
});
