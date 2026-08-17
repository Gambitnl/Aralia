/**
 * This file proves the Assassin Assassinate roll modifiers and the disguise/
 * poisoner kit proficiency merge.
 */

import { describe, expect, it } from 'vitest';
import type { CombatCharacter } from '../../../types/combat';
import { createMockCombatCharacter } from '../../core';
import {
  ASSASSINATE_FEATURE_ID,
  ASSASSINS_TOOLS_FEATURE_ID,
  calculateAssassinateModifiers,
  mergeAssassinToolProficiencies,
} from '../assassinUtils';

function createAssassin(): CombatCharacter {
  return createMockCombatCharacter({
    id: 'assassin',
    name: 'Assassin',
    team: 'player',
    abilities: [
      { id: ASSASSINATE_FEATURE_ID, name: 'Assassinate', description: 'Advantage against foes who have not acted; a hit against a surprised creature is critical.', type: 'utility', cost: { type: 'free' }, targeting: 'self', range: 0, effects: [] },
      { id: ASSASSINS_TOOLS_FEATURE_ID, name: "Assassin's Tools", description: 'Gain a disguise kit, poisoner\'s kit, and proficiency with them.', type: 'utility', cost: { type: 'free' }, targeting: 'self', range: 0, effects: [] },
    ],
  });
}

describe('tool proficiencies', () => {
  it('merges the disguise kit and poisoner kit without duplicating', () => {
    expect(mergeAssassinToolProficiencies()).toEqual(['disguise_kit', 'poisoners_kit']);
    expect(mergeAssassinToolProficiencies(['thieves_tools', 'disguise_kit']))
      .toEqual(['thieves_tools', 'disguise_kit', 'poisoners_kit']);
  });
});

describe('Assassinate modifiers', () => {
  it('grants advantage against a target that has not acted this round', () => {
    const assassin = createAssassin();
    expect(calculateAssassinateModifiers(assassin, { hasActedThisRound: false, isSurprised: false }))
      .toEqual({ advantage: true, criticalOnHit: false });
  });

  it('turns a hit against a surprised target into a critical', () => {
    const assassin = createAssassin();
    expect(calculateAssassinateModifiers(assassin, { hasActedThisRound: true, isSurprised: true }))
      .toEqual({ advantage: false, criticalOnHit: true });
  });

  it('grants nothing to a non-Assassin rogue', () => {
    const rogue = createMockCombatCharacter({ id: 'rogue', name: 'Rogue', team: 'player' });
    expect(calculateAssassinateModifiers(rogue, { hasActedThisRound: false, isSurprised: true }))
      .toEqual({ advantage: false, criticalOnHit: false });
  });
});
