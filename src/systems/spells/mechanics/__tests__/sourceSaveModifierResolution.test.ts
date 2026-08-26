/**
 * This file proves the source-condition vocabulary of the spell save-modifier
 * resolver: which authored tokens execute, how they are normalized, and which
 * tokens stay deliberately inert because another subsystem owns them.
 *
 * Exercises: systems/spells/mechanics/sourceSaveModifierResolution.
 */
import { describe, expect, it } from 'vitest';
import { resolveSourceSaveAdvantageModifiers } from '../sourceSaveModifierResolution';
import { createMockCombatCharacter } from '@/utils/core';
import type { CombatCharacter } from '@/types/combat';

const makeCharacter = (
  id: string,
  team: CombatCharacter['team'],
  overrides: Partial<CombatCharacter> = {}
): CombatCharacter => createMockCombatCharacter({
  id,
  name: id,
  team,
  creatureTypes: ['Humanoid'],
  conditions: [],
  statusEffects: [],
  ...overrides
});

const caster = makeCharacter('caster', 'player');
const enemy = makeCharacter('enemy', 'enemy');
const ally = makeCharacter('ally', 'player');

describe('resolveSourceSaveAdvantageModifiers source conditions', () => {
  it('executes every authored fighting predicate against the team boundary', () => {
    const tokens = [
      'caster_fighting_target',
      'caster_or_allies_fighting_target',
      'caster_or_companions_fighting_target',
      'fighting_caster_or_allies'
    ];

    for (const condition of tokens) {
      expect(
        resolveSourceSaveAdvantageModifiers([{ type: 'advantage', condition }], caster, enemy)
      ).toEqual([{ type: 'advantage', context: 'saving_throw', source: condition }]);

      // The same token on a same-team target is a miss, not a rule.
      expect(
        resolveSourceSaveAdvantageModifiers([{ type: 'advantage', condition }], caster, ally)
      ).toEqual([]);
    }
  });

  it('normalizes casing and padding the way the save-outcome resolver does', () => {
    expect(
      resolveSourceSaveAdvantageModifiers(
        [{ type: 'advantage', condition: '  Fighting_Caster_Or_Allies ' }],
        caster,
        enemy
      )
    ).toHaveLength(1);
  });

  it('leaves caster_says_true_name to the summoning subsystem that already executes it', () => {
    // summon-greater-demon authors this token, and commands/effects/utility/summons.ts
    // applies its Disadvantage from the caster's trueNameSpoken input. Reading it here
    // as well would apply the same Disadvantage twice.
    expect(
      resolveSourceSaveAdvantageModifiers(
        [{ modifier: 'disadvantage', condition: 'caster_says_true_name' }],
        caster,
        enemy
      )
    ).toEqual([]);
  });

  it('leaves unmodeled prose inert', () => {
    expect(
      resolveSourceSaveAdvantageModifiers(
        [{ type: 'advantage', condition: 'The target has Advantage if some unmodeled narrative fact is true.' }],
        caster,
        enemy
      )
    ).toEqual([]);
  });

  it('applies a modifier that carries no source condition at all', () => {
    expect(
      resolveSourceSaveAdvantageModifiers(
        [{ type: 'disadvantage', reason: 'Structured filter only' }],
        caster,
        enemy
      )
    ).toEqual([{ type: 'disadvantage', context: 'saving_throw', source: 'Structured filter only' }]);
  });
});
