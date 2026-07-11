import { describe, it, expect } from 'vitest';
import { SpellIntegrityValidator } from '../../SpellIntegrityValidator';
import { Spell } from '../../../../../types/spells';

// Split from SpellIntegrityValidator.test.ts — suite overview lives in ./spellFixtures.ts.

describe('SpellIntegrityValidator', () => {

  // -------------------------------------------------------------------------
  // Unit tests: Duration Progression Integrity rule
  // -------------------------------------------------------------------------
  // Duration progression records permanence and extension paths that matter to
  // player-facing summaries and future runtime state. These tests keep the
  // validator strict enough to reject malformed rows without narrowing valid
  // future permanence mechanics to one spell family.
  describe('Rule: Duration Progression Integrity', () => {

    it('fails if a duration progression trigger is unknown', () => {
      const badSpell = {
        id: 'unknown-duration-progression-trigger',
        duration: { concentration: false },
        tags: [],
        durationProgression: [
          {
            trigger: 'monthly_reroll',
            requiredCasts: 3,
            cadence: 'daily',
            sameTargetRequired: true,
            sameLocationRequired: 'not_applicable',
            sameConfigurationRequired: 'not_applicable',
            requiresFullConcentration: 'not_applicable',
            outcomeDuration: 'until_dispelled',
            dispellable: true,
            notes: 'Invalid trigger for regression coverage.'
          }
        ]
      } as unknown as Spell;

      const errors = SpellIntegrityValidator.validate(badSpell);
      expect(errors).toContain('Duration Progression Invalid: entry 0 uses unknown trigger "monthly_reroll"');
    });

    it('fails if repeated casts do not name a stable repeated context', () => {
      const badSpell = {
        id: 'unstable-repeated-duration-progression',
        duration: { concentration: false },
        tags: [],
        durationProgression: [
          {
            trigger: 'repeated_casts',
            requiredCasts: 30,
            cadence: 'daily',
            sameTargetRequired: 'not_applicable',
            sameLocationRequired: 'not_applicable',
            sameConfigurationRequired: 'not_applicable',
            requiresFullConcentration: 'not_applicable',
            outcomeDuration: 'until_dispelled',
            dispellable: true,
            notes: 'Repeated casting must identify what stays the same.'
          }
        ]
      } as unknown as Spell;

      const errors = SpellIntegrityValidator.validate(badSpell);
      expect(errors).toContain('Duration Progression Invalid: entry 0 repeated_casts must require the same target, location, or configuration');
    });

    it('fails if full-duration concentration progression is attached to a non-concentration spell', () => {
      const badSpell = {
        id: 'full-duration-without-concentration',
        duration: { concentration: false },
        tags: [],
        durationProgression: [
          {
            trigger: 'full_duration_concentration',
            requiredCasts: 'not_applicable',
            cadence: 'not_applicable',
            sameTargetRequired: 'not_applicable',
            sameLocationRequired: 'not_applicable',
            sameConfigurationRequired: 'not_applicable',
            requiresFullConcentration: true,
            outcomeDuration: 'non_dispellable_permanent',
            dispellable: false,
            notes: 'The progression says full concentration, but the spell does not.'
          }
        ]
      } as unknown as Spell;

      const errors = SpellIntegrityValidator.validate(badSpell);
      expect(errors).toContain('Duration Progression Mismatch: entry 0 requires full concentration but spell duration is not concentration');
    });

    it('passes recognized repeated-cast and full-concentration progression rows', () => {
      const goodSpell = {
        id: 'valid-duration-progression',
        duration: { concentration: true },
        tags: ['concentration'],
        durationProgression: [
          {
            trigger: 'repeated_casts',
            requiredCasts: 365,
            cadence: 'daily',
            sameTargetRequired: 'not_applicable',
            sameLocationRequired: true,
            sameConfigurationRequired: 'not_applicable',
            requiresFullConcentration: 'not_applicable',
            outcomeDuration: 'permanent',
            dispellable: false,
            notes: 'Daily same-location casting makes this spell permanent.'
          },
          {
            trigger: 'full_duration_concentration',
            requiredCasts: 'not_applicable',
            cadence: 'not_applicable',
            sameTargetRequired: 'not_applicable',
            sameLocationRequired: 'not_applicable',
            sameConfigurationRequired: 'not_applicable',
            requiresFullConcentration: true,
            outcomeDuration: 'non_dispellable_permanent',
            dispellable: false,
            notes: 'Maintaining concentration for the full duration makes this permanent.'
          }
        ]
      } as unknown as Spell;

      expect(SpellIntegrityValidator.validate(goodSpell)).toHaveLength(0);
    });
  });
});
