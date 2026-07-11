import { describe, it, expect } from 'vitest';
import { SpellIntegrityValidator } from '../../SpellIntegrityValidator';
import { Spell } from '../../../../../types/spells';

// Split from SpellIntegrityValidator.test.ts — suite overview lives in ./spellFixtures.ts.

describe('SpellIntegrityValidator', () => {

  // -------------------------------------------------------------------------
  // Unit tests: Mode Choice Integrity rule
  // -------------------------------------------------------------------------
  // Mode-choice menus are player-facing UI metadata and command-routing data.
  // These tests keep option labels, counts, and payload indexes aligned without
  // requiring every menu to route through direct effect indexes.
  describe('Rule: Mode Choice Integrity', () => {

    it('fails if optionCount no longer matches the option list', () => {
      const badSpell = {
        id: 'mode-choice-count-drift',
        duration: { concentration: false },
        tags: [],
        effects: [],
        modeChoice: {
          type: 'choose_one',
          timing: 'on_cast',
          optionCount: 2,
          optionsSource: 'modeChoice.options',
          options: [
            { label: 'Only Option', summary: 'Only one option remains.' }
          ]
        }
      } as unknown as Spell;

      const errors = SpellIntegrityValidator.validate(badSpell);
      expect(errors).toContain('Mode Choice Invalid: optionCount 2 does not match options length 1');
    });

    it('fails if a mode option points at a missing effect index', () => {
      const badSpell = {
        id: 'mode-choice-bad-effect-index',
        duration: { concentration: false },
        tags: [],
        effects: [
          {
            type: 'UTILITY',
            description: 'A valid utility branch.'
          }
        ],
        modeChoice: {
          type: 'choose_one',
          timing: 'on_cast',
          optionCount: 1,
          optionsSource: 'effects',
          options: [
            { label: 'Missing Effect', summary: 'Points outside effects.', effectIndices: [1] }
          ]
        }
      } as unknown as Spell;

      const errors = SpellIntegrityValidator.validate(badSpell);
      expect(errors).toContain('Mode Choice Invalid: option 0 points at missing effect index 1');
    });

    it('passes if mode options are summary-only or point at existing payload rows', () => {
      const goodSpell = {
        id: 'mode-choice-valid',
        duration: { concentration: false },
        tags: [],
        effects: [
          {
            type: 'UTILITY',
            description: 'First valid utility branch.',
            controlOptions: [
              { name: 'Control Branch', effect: 'Use this control branch.' }
            ]
          },
          {
            type: 'UTILITY',
            description: 'Second valid utility branch.'
          }
        ],
        modeChoice: {
          type: 'choose_one',
          timing: 'on_cast',
          optionCount: 3,
          optionsSource: 'mixed',
          options: [
            { label: 'Summary Only', summary: 'The option is described directly in the menu.' },
            { label: 'Effect Branch', summary: 'The option routes to an effect.', effectIndices: [1] },
            { label: 'Control Branch', summary: 'The option routes to a control option.', controlOptionIndices: [0] }
          ]
        },
        aiContext: {
          playerInputRequired: true
        }
      } as unknown as Spell;

      expect(SpellIntegrityValidator.validate(goodSpell)).toHaveLength(0);
    });

    it('fails if controlOptions-backed mode choices do not require player input', () => {
      const badSpell = {
        id: 'control-options-mode-choice-missing-player-input',
        duration: { concentration: false },
        tags: [],
        effects: [{
          type: 'UTILITY',
          description: 'A command-style control branch.',
          controlOptions: [{
            name: 'Approach',
            effect: 'approach'
          }]
        }],
        modeChoice: {
          type: 'choose_one',
          timing: 'on_cast',
          optionCount: 1,
          optionsSource: 'controlOptions',
          options: [{
            label: 'Approach',
            summary: 'The target approaches.',
            controlOptionIndices: [0]
          }]
        },
        aiContext: {
          playerInputRequired: false
        }
      } as unknown as Spell;

      // Command-style spells can have structurally valid controlOptions but
      // still fail at runtime if the top-level spell metadata says no player
      // input is needed. The integrity rule keeps the UI/input path aligned
      // with the command execution contract.
      const errors = SpellIntegrityValidator.validate(badSpell);
      expect(errors).toContain('Mode Choice Invalid: controlOptions-backed modeChoice requires aiContext.playerInputRequired true');
    });
  });
});
