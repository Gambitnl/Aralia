import { describe, it, expect } from 'vitest';
import { SpellIntegrityValidator } from '../../SpellIntegrityValidator';
import { Spell } from '../../../../../types/spells';

// Split from SpellIntegrityValidator.test.ts — suite overview lives in ./spellFixtures.ts.

describe('SpellIntegrityValidator', () => {

  // -------------------------------------------------------------------------
  // Unit tests: Ritual Sync rule
  // -------------------------------------------------------------------------
  // Ritual casting is represented in both the boolean rule field and the tag
  // list used by spellbook filters. These tests keep the validator from letting
  // the two player-facing surfaces drift apart.
  describe('Rule: Ritual Sync', () => {

    it('fails if ritual tag is missing', () => {
      const badSpell = {
        id: 'ritual-without-tag',
        ritual: true,
        duration: { concentration: false },
        tags: ['utility']
      } as unknown as Spell;

      const errors = SpellIntegrityValidator.validate(badSpell);
      expect(errors).toContain('Ritual Mismatch: ritual is true but \'tags\' is missing "ritual"');
    });

    it('passes if ritual sync is correct', () => {
      const goodSpell = {
        id: 'ritual-with-tag',
        ritual: true,
        duration: { concentration: false },
        tags: ['utility', 'ritual']
      } as unknown as Spell;

      expect(SpellIntegrityValidator.validate(goodSpell)).toHaveLength(0);
    });
  });
});
