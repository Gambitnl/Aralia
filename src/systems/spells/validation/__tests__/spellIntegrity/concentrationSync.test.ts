import { describe, it, expect } from 'vitest';
import { SpellIntegrityValidator } from '../../SpellIntegrityValidator';
import { Spell } from '../../../../../types/spells';

// Split from SpellIntegrityValidator.test.ts — suite overview lives in ./spellFixtures.ts.

describe('SpellIntegrityValidator', () => {

  // -------------------------------------------------------------------------
  // Unit tests: Concentration Sync rule
  // -------------------------------------------------------------------------
  // These are small isolated tests using hand-crafted minimal spell objects.
  // They exist to verify the rule itself is wired correctly, independent of
  // whether any real spells are currently broken.
  describe('Rule: Concentration Sync', () => {

    it('fails if concentration tag is missing', () => {
      // This spell claims to require concentration in its duration, but its
      // tags array doesn't include the "concentration" string — a mismatch.
      const badSpell = {
        id: 'test',
        duration: { concentration: true },
        tags: ['damage']
      } as unknown as Spell;

      const errors = SpellIntegrityValidator.validate(badSpell);
      expect(errors).toContain('Concentration Mismatch: duration.concentration is true but \'tags\' is missing "concentration"');
    });

    it('passes if sync is correct', () => {
      // Both duration.concentration and the tags array agree — this is valid.
      const goodSpell = {
        id: 'test',
        duration: { concentration: true },
        tags: ['damage', 'concentration']
      } as unknown as Spell;

      expect(SpellIntegrityValidator.validate(goodSpell)).toHaveLength(0);
    });
  });
});
