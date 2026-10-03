/**
 * This file proves the Hunter's Prey choice persistence and each option's
 * subclass-aware combat transaction (Colossus Slayer, Giant Killer, Horde Breaker).
 */

import { describe, expect, it } from 'vitest';
import type { CombatCharacter } from '../../../types/combat';
import { createMockCombatCharacter, createMockCombatState } from '../../core';
import {
  applyHunterPreyChoice,
  getHunterPreyChoice,
  HUNTER_PREY_FEATURE_ID,
  isHunterPreyChoice,
  resolveColossusSlayer,
  resolveGiantKillerReaction,
  resolveHordeBreaker,
} from '../hunterUtils';

function createHunter(choice?: string): CombatCharacter {
  const base = createMockCombatCharacter({
    id: 'hunter',
    name: 'Hunter',
    team: 'player',
    position: { x: 0, y: 0 },
    abilities: [{
      id: HUNTER_PREY_FEATURE_ID,
      name: "Hunter's Prey",
      description: 'Choose Colossus Slayer, Giant Killer, or Horde Breaker.',
      type: 'utility',
      cost: { type: 'action' },
      targeting: 'self',
      range: 0,
      effects: [],
    }],
  });
  return choice ? applyHunterPreyChoice(base, choice) : base;
}

describe('choice catalog and persistence', () => {
  it('recognizes the three canonical choices and rejects unknown ids', () => {
    expect(isHunterPreyChoice('colossus_slayer')).toBe(true);
    expect(isHunterPreyChoice('giant_killer')).toBe(true);
    expect(isHunterPreyChoice('horde_breaker')).toBe(true);
    expect(isHunterPreyChoice('dragon_slayer')).toBe(false);
  });

  it('persists a valid choice and leaves an invalid one untouched', () => {
    const base = createMockCombatCharacter({ id: 'ranger', name: 'Ranger' });
    const chosen = applyHunterPreyChoice(base, 'giant_killer');
    expect(getHunterPreyChoice(chosen)).toBe('giant_killer');

    const rejected = applyHunterPreyChoice(base, 'bogus');
    expect(getHunterPreyChoice(rejected)).toBeUndefined();
  });
});

describe('Colossus Slayer', () => {
  it('adds 1d8 when the target is below max HP and this turn is unused', () => {
    const result = resolveColossusSlayer(
      createHunter('colossus_slayer'),
      { currentHP: 12, maxHP: 20 },
      false,
      () => 0.999, // pins the d8 at 8
    );
    expect(result.eligible).toBe(true);
    expect(result.bonusDamage).toBe(8);
  });

  it('rejects a full-HP target, a used turn, and a wrong choice', () => {
    const hunter = createHunter('colossus_slayer');
    expect(resolveColossusSlayer(hunter, { currentHP: 20, maxHP: 20 }, false).reason)
      .toBe('target_not_below_max');
    expect(resolveColossusSlayer(hunter, { currentHP: 10, maxHP: 20 }, true).reason)
      .toBe('already_used_this_turn');

    const other = createHunter('giant_killer');
    expect(resolveColossusSlayer(other, { currentHP: 10, maxHP: 20 }, false).reason)
      .toBe('wrong_choice');
  });
});

describe('Giant Killer', () => {
  it('spends the reaction to attack an adjacent Large+ creature that missed', () => {
    const hunter = createHunter('giant_killer');
    const ogre = createMockCombatCharacter({
      id: 'ogre',
      name: 'Ogre',
      team: 'enemy',
      position: { x: 1, y: 0 },
      stats: { strength: 16, dexterity: 10, constitution: 16, intelligence: 5, wisdom: 7, charisma: 7, baseInitiative: 0, speed: 30, cr: '2', size: 'Large' },
    });
    const state = createMockCombatState({ characters: [hunter, ogre] });

    const result = resolveGiantKillerReaction(state, {
      rangerId: 'hunter',
      targetId: 'ogre',
      targetMissedRangerThisTurn: true,
    });

    expect(result.resolved).toBe(true);
    const spent = result.state.characters.find(c => c.id === 'hunter');
    expect(spent?.actionEconomy.reaction.used).toBe(true);
  });

  it('rejects a too-small, out-of-reach, or non-missing target', () => {
    const hunter = createHunter('giant_killer');
    const goblin = createMockCombatCharacter({
      id: 'goblin',
      name: 'Goblin',
      team: 'enemy',
      position: { x: 1, y: 0 },
      stats: { strength: 8, dexterity: 14, constitution: 10, intelligence: 10, wisdom: 8, charisma: 8, baseInitiative: 0, speed: 30, cr: '1/4', size: 'Small' },
    });
    const state = createMockCombatState({ characters: [hunter, goblin] });

    expect(resolveGiantKillerReaction(state, {
      rangerId: 'hunter', targetId: 'goblin', targetMissedRangerThisTurn: true,
    }).failure).toBe('target_too_small');

    const farOgre = createMockCombatCharacter({
      id: 'ogre',
      name: 'Ogre',
      team: 'enemy',
      position: { x: 5, y: 0 },
      stats: { strength: 16, dexterity: 10, constitution: 16, intelligence: 5, wisdom: 7, charisma: 7, baseInitiative: 0, speed: 30, cr: '2', size: 'Large' },
    });
    const farState = createMockCombatState({ characters: [hunter, farOgre] });
    expect(resolveGiantKillerReaction(farState, {
      rangerId: 'hunter', targetId: 'ogre', targetMissedRangerThisTurn: true,
    }).failure).toBe('target_out_of_reach');

    const nearOgre = createMockCombatState({
      characters: [hunter, createMockCombatCharacter({
        id: 'ogre', name: 'Ogre', team: 'enemy', position: { x: 1, y: 0 },
        stats: { strength: 16, dexterity: 10, constitution: 16, intelligence: 5, wisdom: 7, charisma: 7, baseInitiative: 0, speed: 30, cr: '2', size: 'Large' },
      })],
    });
    expect(resolveGiantKillerReaction(nearOgre, {
      rangerId: 'hunter', targetId: 'ogre', targetMissedRangerThisTurn: false,
    }).failure).toBe('no_recent_miss');
  });
});

describe('Horde Breaker', () => {
  it('grants an extra attack against a different adjacent target once per turn', () => {
    const hunter = createHunter('horde_breaker');
    const original = createMockCombatCharacter({ id: 'wolf-a', name: 'Wolf A', team: 'enemy', position: { x: 1, y: 0 } });
    const secondary = createMockCombatCharacter({ id: 'wolf-b', name: 'Wolf B', team: 'enemy', position: { x: 2, y: 0 } });
    const state = createMockCombatState({ characters: [hunter, original, secondary] });

    const result = resolveHordeBreaker(state, {
      rangerId: 'hunter',
      originalTargetId: 'wolf-a',
      secondaryTargetId: 'wolf-b',
      alreadyUsedThisTurn: false,
    });

    expect(result.resolved).toBe(true);
    expect(result.secondaryTargetId).toBe('wolf-b');
  });

  it('rejects a used turn, a too-distant secondary, or a wrong choice', () => {
    const hunter = createHunter('horde_breaker');
    const original = createMockCombatCharacter({ id: 'wolf-a', name: 'Wolf A', team: 'enemy', position: { x: 1, y: 0 } });
    const far = createMockCombatCharacter({ id: 'wolf-b', name: 'Wolf B', team: 'enemy', position: { x: 5, y: 0 } });
    const state = createMockCombatState({ characters: [hunter, original, far] });

    expect(resolveHordeBreaker(state, {
      rangerId: 'hunter', originalTargetId: 'wolf-a', secondaryTargetId: 'wolf-b', alreadyUsedThisTurn: true,
    }).failure).toBe('already_used_this_turn');

    expect(resolveHordeBreaker(state, {
      rangerId: 'hunter', originalTargetId: 'wolf-a', secondaryTargetId: 'wolf-b', alreadyUsedThisTurn: false,
    }).failure).toBe('secondary_out_of_reach');

    const other = createHunter('colossus_slayer');
    const otherState = createMockCombatState({ characters: [other, original, far] });
    expect(resolveHordeBreaker(otherState, {
      rangerId: 'hunter', originalTargetId: 'wolf-a', secondaryTargetId: 'wolf-b', alreadyUsedThisTurn: false,
    }).failure).toBe('wrong_choice');
  });
});
