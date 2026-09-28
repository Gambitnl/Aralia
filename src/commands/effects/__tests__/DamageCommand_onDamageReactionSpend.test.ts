/**
 * This file proves the on-damage racial reaction costs the Reaction it claims.
 *
 * agora-db71.23 — the `on_target_takes_damage` block in DamageCommand offered
 * Stone's Endurance without ever reading `actionEconomy.reaction`, so a dwarf
 * could halve every hit it took in a round. The offer is now gated on an unspent
 * Reaction and acceptance spends it, mirroring `offerFailedSaveReactions`.
 *
 * Exercises: DamageCommand's racial reaction window.
 * Depends on: shared command fixtures and the real damage/HP pipeline.
 */

import { describe, expect, it, vi } from 'vitest';
import type { DamageEffect } from '../../../types/spells';
import type { CombatCharacter, CombatState, RacialReaction } from '../../../types/combat';
import { createMockCombatCharacter, createMockCombatState, createMockCommandContext } from '../../../utils/core';
import { DamageCommand } from '../DamageCommand';

/** The shape `data/races/racialTraits.ts` emits for Stone's Endurance. */
const STONES_ENDURANCE: RacialReaction = {
  id: 'dwarf__stones_endurance__reaction',
  name: "Stone's Endurance",
  description:
    'When you take damage, you can use your reaction to roll a d12 and add your Constitution modifier, reducing the damage by that total.',
  trigger: { type: 'on_target_takes_damage' },
  condition: { type: 'always' },
  effect: {
    type: 'DEFENSIVE',
    defenseType: 'damage_reduction',
    damageReduction: {
      dice: '4d1',
      abilityModifier: undefined,
      addProficiencyBonus: false,
      appliesTo: 'damage_taken',
      frequency: 'every_time'
    }
  }
} as unknown as RacialReaction;

/** A flat 8-point hit: `8d1` removes the dice from the assertion. */
const FLAT_HIT: DamageEffect = {
  type: 'DAMAGE',
  damage: { dice: '8d1', type: 'Bludgeoning' },
  trigger: { type: 'immediate' },
  condition: { type: 'always' },
};

const makeDwarf = (): CombatCharacter => createMockCombatCharacter({
  id: 'dwarf',
  name: 'Dwarf',
  team: 'player',
  currentHP: 40,
  maxHP: 40,
  tempHP: 0,
  modifiers: { advantage: [], disadvantage: [], bonuses: [], reactions: [STONES_ENDURANCE] }
});

describe('DamageCommand on-damage racial reaction', () => {
  it('reduces the first hit of the round and never offers the second', async () => {
    const attacker = createMockCombatCharacter({ id: 'attacker', name: 'Attacker', team: 'enemy' });
    const dwarf = makeDwarf();
    const requestReaction = vi.fn().mockResolvedValue(STONES_ENDURANCE.id);
    const buildContext = (target: CombatCharacter) => createMockCommandContext({
      spellId: 'normal-attack',
      spellName: 'Attack',
      caster: attacker,
      targets: [target],
      damageRng: () => 0,
      requestReaction,
    });

    let state: CombatState = createMockCombatState({
      characters: [attacker, dwarf],
      combatLog: [],
    });

    // First hit: 8 damage, reduced by the 4-point reaction => 4 lost.
    state = await new DamageCommand(FLAT_HIT, buildContext(dwarf)).execute(state);
    const afterFirst = state.characters.find(character => character.id === 'dwarf')!;
    expect(requestReaction).toHaveBeenCalledTimes(1);
    expect(afterFirst.currentHP).toBe(36);
    expect(afterFirst.actionEconomy.reaction.used).toBe(true);
    expect(afterFirst.actionEconomy.reaction.remaining).toBe(0);
    expect(state.combatLog.some(entry => entry.message.includes("Stone's Endurance"))).toBe(true);

    // Second hit in the same round: the Reaction is spent, so no offer and the
    // full 8 points land.
    state = await new DamageCommand(FLAT_HIT, buildContext(afterFirst)).execute(state);
    const afterSecond = state.characters.find(character => character.id === 'dwarf')!;
    expect(requestReaction).toHaveBeenCalledTimes(1);
    expect(afterSecond.currentHP).toBe(28);
    expect(
      state.combatLog.filter(entry => entry.message.includes("Stone's Endurance"))
    ).toHaveLength(1);
  });

  it('leaves the Reaction unspent when the player declines', async () => {
    const attacker = createMockCombatCharacter({ id: 'attacker', name: 'Attacker', team: 'enemy' });
    const dwarf = makeDwarf();
    const requestReaction = vi.fn().mockResolvedValue(null);

    const state = await new DamageCommand(FLAT_HIT, createMockCommandContext({
      spellId: 'normal-attack',
      spellName: 'Attack',
      caster: attacker,
      targets: [dwarf],
      damageRng: () => 0,
      requestReaction,
    })).execute(createMockCombatState({ characters: [attacker, dwarf], combatLog: [] }));

    const after = state.characters.find(character => character.id === 'dwarf')!;
    expect(requestReaction).toHaveBeenCalledTimes(1);
    expect(after.currentHP).toBe(32);
    expect(after.actionEconomy.reaction.used).toBe(false);
  });

  it('never offers the trait to a creature whose Reaction is already spent', async () => {
    const attacker = createMockCombatCharacter({ id: 'attacker', name: 'Attacker', team: 'enemy' });
    const dwarf = makeDwarf();
    dwarf.actionEconomy = {
      ...dwarf.actionEconomy,
      reaction: { used: true, remaining: 0 }
    };
    const requestReaction = vi.fn().mockResolvedValue(STONES_ENDURANCE.id);

    const state = await new DamageCommand(FLAT_HIT, createMockCommandContext({
      spellId: 'normal-attack',
      spellName: 'Attack',
      caster: attacker,
      targets: [dwarf],
      damageRng: () => 0,
      requestReaction,
    })).execute(createMockCombatState({ characters: [attacker, dwarf], combatLog: [] }));

    expect(requestReaction).not.toHaveBeenCalled();
    expect(state.characters.find(character => character.id === 'dwarf')!.currentHP).toBe(32);
  });
});
