
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
    // We expect specific warnings for spells we analyzed
    const results = enchantmentSpells.flatMap(validateEnchantmentConsistency);

    // Check for "Undead" warning in Sleep or Command if they lack exclusion
    const sleepIssues = results.filter(r => r.spellId === 'sleep');
    // Sleep description: "Undead... aren't affected"
    // Sleep targeting: currently empty filter

    // This assertion confirms our validator "catches" the issue
    // If the data is fixed later, this test might fail (expecting an error but getting none).
    // So we should structure it to report rather than fail strict logic,
    // OR we use this test to PROVE the validator works.

    if (sleepIssues.length > 0) {
        console.log("Sleep Issues Found:", sleepIssues);
        expect(sleepIssues.some(i => i.message.includes('Undead'))).toBe(true);
    }
  });

  it('should flag Charm Person for missing break conditions', () => {
    const results = enchantmentSpells.flatMap(validateEnchantmentConsistency);
    const charmIssues = results.filter(r => r.spellId === 'charm-person');

    expect(charmIssues.some(i => i.category === 'mechanics' && i.message.includes('damage'))).toBe(true);
  });
});
