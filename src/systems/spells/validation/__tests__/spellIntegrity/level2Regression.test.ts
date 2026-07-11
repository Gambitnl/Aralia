import { describe, it, expect } from 'vitest';
import { SpellIntegrityValidator } from '../../SpellIntegrityValidator';
import { filterReviewedMonolithicClearance, getSpells } from './spellFixtures';

// Split from SpellIntegrityValidator.test.ts — suite overview lives in ./spellFixtures.ts.

describe('SpellIntegrityValidator', () => {

  // -------------------------------------------------------------------------
  // Regression test: all Level 2 spells (hard failure gate)
  // -------------------------------------------------------------------------
  // This test loads every Level 2 spell from disk and validates them all.
  // Concentration and Enchantment targeting are treated as hard failures here
  // because those issues were fully remediated — any new file that reintroduces
  // them should immediately fail CI.
  //
  // Monolithic Effect warnings are NOT hard-gated here; they appear in the
  // Systematic test below.
  describe('Level 2 Regression Test', () => {
    const spells = getSpells(2);

    it('all Level 2 spells pass integrity checks', () => {
      const failures: string[] = [];

      // Run every Level 2 spell through the validator and collect all failures.
      spells.forEach(spell => {
        const errors = filterReviewedMonolithicClearance(spell, SpellIntegrityValidator.validate(spell));
        if (errors.length > 0) {
          failures.push(`${spell.name}: ${errors.join(', ')}`);
        }
      });

      // Print the full failure list to the console for visibility even when
      // only certain categories are being hard-asserted below.
      if (failures.length > 0) {
        console.warn(`Integrity Failures Found (${failures.length}):\n${failures.join('\n')}`);
      }

      // HARD GATE: No Concentration mismatches allowed. This was fully remediated.
      const criticalFailures = failures.filter(f => f.includes('Concentration Mismatch'));
      expect(criticalFailures).toHaveLength(0);

      // HARD GATE: No Enchantment targeting gaps allowed. This was fully remediated.
      const enchantmentFailures = failures.filter(f => f.includes('Enchantment Gap'));
      expect(enchantmentFailures).toHaveLength(0);

      // HARD GATE: No blank or generic effect descriptions allowed. G8/G9 were
      // fully remediated, and future opaque descriptions should fail locally.
      const descriptionFailures = failures.filter(f => f.includes('Effect Description'));
      expect(descriptionFailures).toHaveLength(0);
    });

    it('keeps Hold Person Humanoid restriction on the effect-level Paralyzed payload', () => {
      const holdPerson = spells.find(spell => spell.id === 'hold-person');
      const paralyzedEffect = holdPerson?.effects.find(effect =>
        effect.type === 'STATUS_CONDITION'
        && effect.statusCondition?.name === 'Paralyzed'
      );

      // The top-level target picker already says Hold Person can only choose a
      // Humanoid. The effect row must repeat that creature gate so future
      // multi-target, delayed, or retargeted execution paths do not apply the
      // Paralyzed condition to a non-Humanoid after initial selection.
      expect(paralyzedEffect?.condition.targetFilter?.creatureTypes).toContain('Humanoid');
    });
  });
});
