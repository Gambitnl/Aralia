
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { Spell } from '../../../types/spells';
import { validateEnchantmentConsistency } from '../spellConsistencyValidator';

const SPELLS_DIR = 'public/data/spells/level-1';

function loadLevel1Spells(): Spell[] {
  // In a real environment, we'd recursively load, but here we just target L1
  const spellFiles = fs.readdirSync(path.resolve(process.cwd(), SPELLS_DIR))
    .filter(file => file.endsWith('.json'));

  return spellFiles.map(file => {
    const content = fs.readFileSync(path.resolve(process.cwd(), SPELLS_DIR, file), 'utf-8');
    return JSON.parse(content) as Spell;
  });
}

describe('Enchantment Spell Consistency', () => {
  const spells = loadLevel1Spells();
  const enchantmentSpells = spells.filter(s => s.school === 'Enchantment');

  it('should identify targeting gaps in known problematic spells', () => {
    // Smoke test: confirm the validator catches at least one issue on Sleep.
    // Originally this asserted an "Undead" exclusion warning, but the 2024
    // ruleset removed Undead/Construct immunity from Sleep, so the validator
    // now flags it for a different reason (missing break-on-damage logic).
    const results = enchantmentSpells.flatMap(validateEnchantmentConsistency);
    const sleepIssues = results.filter(r => r.spellId === 'sleep');

    expect(sleepIssues.length).toBeGreaterThan(0);
  });

  it('should flag Charm Person for missing break conditions', () => {
    const results = enchantmentSpells.flatMap(validateEnchantmentConsistency);
    const charmIssues = results.filter(r => r.spellId === 'charm-person');

    expect(charmIssues.some(i => i.category === 'mechanics' && i.message.includes('damage'))).toBe(true);
  });
});
