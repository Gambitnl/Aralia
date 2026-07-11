import { describe, it, expect } from 'vitest';
import { SpellIntegrityValidator } from '../../SpellIntegrityValidator';
import { Spell } from '../../../../../types/spells';

// Split from SpellIntegrityValidator.test.ts — suite overview lives in ./spellFixtures.ts.

describe('SpellIntegrityValidator', () => {

  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // Unit tests: Light Metadata Integrity rule
  // -------------------------------------------------------------------------
  // Light effects create map artifacts that the turn manager can now expire.
  // These tests keep the data contract tight enough for runtime and UI surfaces
  // to know where the light attaches and how much light it actually emits.
  describe('Rule: Light Metadata Integrity', () => {

    it('fails if a light utility effect has no light payload', () => {
      const badSpell = {
        id: 'light-without-payload',
        duration: { concentration: false },
        tags: [],
        effects: [
          {
            type: 'UTILITY',
            utilityType: 'light',
            description: 'Creates light but omits the map-light payload.',
            trigger: { type: 'immediate' },
            condition: { type: 'always' }
          }
        ]
      } as unknown as Spell;

      const errors = SpellIntegrityValidator.validate(badSpell);
      expect(errors).toContain('Light Metadata Invalid: effect 0 utilityType light must include a light payload');
    });

    it('fails if a light utility effect emits no light or uses an unknown attachment', () => {
      const badSpell = {
        id: 'light-without-radius',
        duration: { concentration: false },
        tags: [],
        effects: [
          {
            type: 'UTILITY',
            utilityType: 'light',
            description: 'Claims to create light but has no emitted radius.',
            trigger: { type: 'immediate' },
            condition: { type: 'always' },
            light: {
              brightRadius: 0,
              dimRadius: 0,
              attachedTo: 'somewhere_else'
            }
          }
        ]
      } as unknown as Spell;

      const errors = SpellIntegrityValidator.validate(badSpell);
      expect(errors).toContain('Light Metadata Invalid: effect 0 utilityType light must emit bright or dim light');
      expect(errors).toContain('Light Metadata Invalid: effect 0 attachedTo must be caster, target, or point');
    });

    it('passes valid bright or dim light utility payloads', () => {
      const goodSpell = {
        id: 'valid-light-metadata',
        duration: { concentration: false },
        tags: [],
        effects: [
          {
            type: 'UTILITY',
            utilityType: 'light',
            description: 'Creates dim light at a chosen point.',
            trigger: { type: 'immediate' },
            condition: { type: 'always' },
            light: {
              brightRadius: 0,
              dimRadius: 10,
              attachedTo: 'point'
            }
          }
        ]
      } as unknown as Spell;

      expect(SpellIntegrityValidator.validate(goodSpell)).toHaveLength(0);
    });
  });
});
