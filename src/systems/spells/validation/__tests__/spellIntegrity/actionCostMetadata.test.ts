import { describe, it, expect } from 'vitest';
import { SpellIntegrityValidator } from '../../SpellIntegrityValidator';
import { Spell } from '../../../../../types/spells';

/**
 * This file proves that spell action-cost metadata remains internally consistent.
 *
 * The spell integrity suite calls the production validator with representative
 * good and bad spell records. These cases protect casting costs, sustained
 * effects, and granted actions while preserving the older numeric reactive-cost
 * shape that some unfinished spell systems still use.
 */

// Split from SpellIntegrityValidator.test.ts — suite overview lives in ./spellFixtures.ts.

describe('SpellIntegrityValidator', () => {

  // -------------------------------------------------------------------------
  // Unit tests: Action Cost Metadata Integrity rule
  // -------------------------------------------------------------------------
  // Created-object and sustained-hazard spells often expose their runtime
  // economy through casting combat costs, trigger sustain costs, or granted
  // follow-up actions. These tests keep that metadata internally usable without
  // claiming a full object-lifecycle engine exists.
  describe('Rule: Action Cost Metadata Integrity', () => {

    it('fails if casting combat cost drifts away from the casting unit', () => {
      const badSpell = {
        id: 'combat-cost-unit-drift',
        castingTime: {
          value: 1,
          unit: 'bonus_action',
          combatCost: {
            type: 'action',
            condition: ''
          }
        },
        duration: { concentration: false },
        tags: [],
        effects: []
      } as unknown as Spell;

      const errors = SpellIntegrityValidator.validate(badSpell);
      expect(errors).toContain('Action Cost Mismatch: castingTime.unit "bonus_action" does not match combatCost.type "action"');
    });

    it('fails if sustain cost optional is not boolean', () => {
      const badSpell = {
        id: 'bad-sustain-cost',
        castingTime: {
          value: 1,
          unit: 'action',
          combatCost: {
            type: 'action',
            condition: ''
          }
        },
        duration: { concentration: false },
        tags: [],
        effects: [
          {
            type: 'UTILITY',
            description: 'A sustained utility effect.',
            trigger: {
              type: 'on_caster_action',
              sustainCost: {
                actionType: 'bonus_action',
                optional: 'sometimes'
              }
            }
          }
        ]
      } as unknown as Spell;

      const errors = SpellIntegrityValidator.validate(badSpell);
      expect(errors).toContain('Action Cost Invalid: effect 0 sustainCost.optional must be boolean');
    });

    it('preserves legacy numeric sustain costs on reactive effects', () => {
      // Older reactive spell rows use a number rather than an action descriptor.
      // This fixture proves the action-metadata audit leaves that supported shape
      // alone instead of treating it as a malformed modern action cost.
      const legacyReactiveSpell = {
        id: 'legacy-reactive-sustain-cost',
        castingTime: {
          value: 1,
          unit: 'reaction'
        },
        duration: { concentration: false },
        tags: [],
        effects: [
          {
            type: 'REACTIVE',
            trigger: {
              type: 'on_caster_action',
              sustainCost: 1
            },
            description: 'A legacy reactive effect with a numeric sustain cost.'
          }
        ]
      } as unknown as Spell;

      const actionCostErrors = SpellIntegrityValidator.validate(legacyReactiveSpell)
        .filter(error => error.startsWith('Action Cost'));

      expect(actionCostErrors).toHaveLength(0);
    });

    it('fails if a granted action has no action label', () => {
      const badSpell = {
        id: 'bad-granted-action',
        castingTime: {
          value: 1,
          unit: 'action',
          combatCost: {
            type: 'action',
            condition: ''
          }
        },
        duration: { concentration: false },
        tags: [],
        effects: [
          {
            type: 'UTILITY',
            description: 'A utility effect with a malformed granted action.',
            trigger: {
              type: 'immediate'
            },
            grantedActions: [
              {
                type: 'bonus_action',
                action: '',
                frequency: 'each_turn'
              }
            ]
          }
        ]
      } as unknown as Spell;

      const errors = SpellIntegrityValidator.validate(badSpell);
      expect(errors).toContain('Action Cost Invalid: effect 0 granted action 0 must include a non-empty action label');
    });

    it('passes valid casting, sustain, and granted-action cost metadata', () => {
      const goodSpell = {
        id: 'valid-action-cost-metadata',
        castingTime: {
          value: 1,
          unit: 'bonus_action',
          combatCost: {
            type: 'bonus_action',
            condition: ''
          }
        },
        duration: { concentration: true },
        tags: ['concentration'],
        effects: [
          {
            type: 'UTILITY',
            description: 'A valid sustained utility effect.',
            trigger: {
              type: 'on_caster_action',
              sustainCost: {
                actionType: 'bonus_action',
                optional: false
              }
            },
            grantedActions: [
              {
                type: 'bonus_action',
                action: 'Move Object',
                frequency: 'each_turn',
                rangeLimit: 30
              }
            ]
          }
        ]
      } as unknown as Spell;

      expect(SpellIntegrityValidator.validate(goodSpell)).toHaveLength(0);
    });
  });
});
