import { describe, it, expect } from 'vitest';
import { SpellIntegrityValidator } from '../../SpellIntegrityValidator';
import { Spell } from '../../../../../types/spells';

// Split from SpellIntegrityValidator.test.ts — suite overview lives in ./spellFixtures.ts.

describe('SpellIntegrityValidator', () => {

  // -------------------------------------------------------------------------
  // Unit tests: Effect Target Filter Completeness rule
  // -------------------------------------------------------------------------
  // These tests keep direct-target spell restrictions visible at the validator
  // layer, not only in the all-spell corpus test. If a spell says "only
  // Humanoids" at target selection time, a direct effect that acts on that same
  // target should carry the same filter or be explicitly classified elsewhere.
  describe('Rule: Effect Target Filter Completeness', () => {

    it('fails if a direct restricted effect omits the spell-level creature filter', () => {
      const badSpell = {
        id: 'direct-restricted-effect-filter-gap',
        duration: { concentration: false },
        tags: [],
        school: 'Enchantment',
        targeting: {
          type: 'single',
          filter: {
            creatureTypes: ['Humanoid']
          }
        },
        effects: [
          {
            type: 'UTILITY',
            description: 'Directly charms the selected Humanoid target.',
            condition: {
              type: 'save',
              targetFilter: {
                creatureTypes: []
              }
            }
          }
        ]
      } as unknown as Spell;

      const errors = SpellIntegrityValidator.validate(badSpell);
      expect(errors).toContain('Effect Target Filter Gap: effect 0 does not repeat spell-level creatureTypes restriction');
    });

    it('exposes the classified residual restricted-filter mismatches as validator-owned data', () => {
      // The production validator owns this list because spell JSON validation
      // and the corpus regression must agree about which remaining mismatches
      // are semantic exceptions rather than direct data omissions.
      expect(SpellIntegrityValidator.getClassifiedRestrictedFilterMismatchKeys()).toContain('plant-growth:0:creatureTypes');
    });

    it('exposes reasons for classified residual restricted-filter mismatches', () => {
      // Future validation, audit, and UI/debug surfaces need to explain why a
      // residual mismatch is classified. A bare allowlist key is not enough for
      // a human reviewer to know whether the row is plant/object targeting,
      // chosen-kind aura behavior, repair targeting, or form-choice eligibility.
      const shapechangeDetail = SpellIntegrityValidator
        .getClassifiedRestrictedFilterMismatchDetails()
        .find(detail => detail.key === 'shapechange:0:excludeCreatureTypes');

      expect(shapechangeDetail).toMatchObject({
        key: 'shapechange:0:excludeCreatureTypes',
        category: 'form-choice eligibility'
      });
      expect(shapechangeDetail?.reason).toContain('chosen form');
    });

    it('treats Huge-or-smaller size text as equivalent to concrete creature sizes', () => {
      const sizeEquivalentSpell = {
        id: 'huge-or-smaller-size-equivalence',
        duration: { concentration: false },
        tags: [],
        school: 'Conjuration',
        targeting: {
          type: 'area',
          filter: {
            sizes: ['Huge or smaller for ongoing movement damage']
          }
        },
        effects: [
          {
            type: 'DAMAGE',
            description: 'Ongoing wave damage affects Huge or smaller creatures.',
            condition: {
              type: 'save',
              targetFilter: {
                sizes: ['Huge', 'Large', 'Medium', 'Small', 'Tiny']
              }
            }
          }
        ]
      } as unknown as Spell;

      const errors = SpellIntegrityValidator.validate(sizeEquivalentSpell);
      expect(errors).not.toContain('Effect Target Filter Gap: effect 0 does not repeat spell-level sizes restriction');
    });
  });
});
