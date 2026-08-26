/**
 * This file proves that binding a Primal Beast projects the scaled armor class
 * and the form's real movement mode onto the beast, and that the per-turn
 * command tally is cleared at the start of the ranger's turn.
 */

import { describe, expect, it } from 'vitest';
import type { CombatCharacter } from '../../../types/combat';
import { createMockCombatCharacter, createMockCombatState } from '../../core';
import {
  bindPrimalBeast,
  PRIMAL_COMPANION_FEATURE_ID,
  resetPrimalBeastCommands,
  resolveBeastCommand,
} from '../beastMasterUtils';

function createRanger(): CombatCharacter {
  return createMockCombatCharacter({
    id: 'ranger',
    name: 'Ranger',
    team: 'player',
    level: 3,
    position: { x: 0, y: 0 },
    abilities: [{
      id: PRIMAL_COMPANION_FEATURE_ID,
      name: 'Primal Companion',
      description: 'Summon a loyal beast companion that acts on your turn.',
      type: 'utility',
      cost: { type: 'action' },
      targeting: 'self',
      range: 0,
      effects: [],
    }],
  });
}

function createBeastToken(): CombatCharacter {
  return createMockCombatCharacter({ id: 'beast', name: 'Beast', team: 'player', position: { x: 1, y: 0 } });
}

describe('stat projection', () => {
  it('writes the scaled armor class onto the bound beast', () => {
    const bound = bindPrimalBeast(createRanger(), createBeastToken(), 'land');

    // 13 base + proficiency bonus 2 at ranger level 3.
    expect(bound.armorClass).toBe(15);
    expect(bound.baseAC).toBe(15);
  });

  it('gives the Sea and Sky beasts their swim and fly speeds', () => {
    const sea = bindPrimalBeast(createRanger(), createBeastToken(), 'sea');
    expect(sea.stats.speed).toBe(5);
    expect(sea.stats.extraMovementSpeeds).toEqual({ swim: 60 });

    const sky = bindPrimalBeast(createRanger(), createBeastToken(), 'sky');
    expect(sky.stats.speed).toBe(10);
    expect(sky.stats.extraMovementSpeeds).toEqual({ fly: 60 });
  });

  it('leaves a walking beast without an extra speed', () => {
    const land = bindPrimalBeast(createRanger(), createBeastToken(), 'land');
    expect(land.stats.speed).toBe(40);
    expect(land.stats.extraMovementSpeeds).toBeUndefined();
  });
});

describe('resetPrimalBeastCommands', () => {
  it('clears the per-turn tally so the beast can be commanded again next turn', () => {
    const ranger = createRanger();
    const beast = bindPrimalBeast(ranger, createBeastToken(), 'land');
    const state = createMockCombatState({ characters: [ranger, beast] });

    const commanded = resolveBeastCommand(state, { rangerId: 'ranger', beastId: 'beast' });
    expect(commanded.resolved).toBe(true);
    expect(resolveBeastCommand(commanded.state, { rangerId: 'ranger', beastId: 'beast' }).failure)
      .toBe('commands_exhausted');

    // A new turn: the tally clears and the ranger's bonus action refreshes.
    const nextTurn = resetPrimalBeastCommands({
      ...commanded.state,
      characters: commanded.state.characters.map(character => (
        character.id === 'ranger' ? ranger : character
      )),
    }, 'ranger');

    expect(nextTurn.characters.find(c => c.id === 'beast')?.summonMetadata?.commandsUsedThisTurn).toBe(0);
    expect(resolveBeastCommand(nextTurn, { rangerId: 'ranger', beastId: 'beast' }).resolved).toBe(true);
  });

  it('returns the same state when nothing is bound or nothing was spent', () => {
    const ranger = createRanger();
    const beast = bindPrimalBeast(ranger, createBeastToken(), 'land');
    const state = createMockCombatState({ characters: [ranger, beast] });

    expect(resetPrimalBeastCommands(state, 'ranger')).toBe(state);
    expect(resetPrimalBeastCommands(state, 'nobody')).toBe(state);
  });
});
