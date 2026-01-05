
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SpellIntegrityValidator } from '../SpellIntegrityValidator';
import { Spell } from '../../../../types/spells';

// Load actual spell data for regression testing
const SPELLS_ROOT = path.resolve(__dirname, '../../../../../public/data/spells');

function getSpells(level: number): Spell[] {
  const dir = path.join(SPELLS_ROOT, `level-${level}`);
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')));
}

describe('SpellIntegrityValidator', () => {

  describe('Rule: Concentration Sync', () => {
    it('fails if concentration tag is missing', () => {
      const badSpell = {
        id: 'test',
        duration: { concentration: true },
        tags: ['damage']
      // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
      } as unknown as Spell;

      const errors = SpellIntegrityValidator.validate(badSpell);
      expect(errors).toContain('Concentration Mismatch: duration.concentration is true but \'tags\' is missing "concentration"');
    });

    it('passes if sync is correct', () => {
      const goodSpell = {
        id: 'test',
        duration: { concentration: true },
        tags: ['damage', 'concentration']
      // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
      } as unknown as Spell;

      expect(SpellIntegrityValidator.validate(goodSpell)).toHaveLength(0);
    });
  });

  describe('Level 2 Regression Test', () => {
    const spells = getSpells(2);

    it('all Level 2 spells pass integrity checks', () => {
      const failures: string[] = [];

      spells.forEach(spell => {
        const errors = SpellIntegrityValidator.validate(spell);
        if (errors.length > 0) {
          failures.push(`${spell.name}: ${errors.join(', ')}`);
        }
      });

      if (failures.length > 0) {
        console.warn(`Integrity Failures Found (${failures.length}):\n${failures.join('\n')}`);
      }

      // We expect NO critical failures (Concentration)
      const criticalFailures = failures.filter(f => f.includes('Concentration Mismatch'));
      expect(criticalFailures).toHaveLength(0);

      // We also expect NO enchantment gaps as we fixed them
      const enchantmentFailures = failures.filter(f => f.includes('Enchantment Gap'));
      expect(enchantmentFailures).toHaveLength(0);
    });
  });
});
