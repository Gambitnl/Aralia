/**
 * This file proves that the three rider extra strikes are REAL attacks: each
 * one is built through AbilityCommandFactory, run through CommandExecutor, and
 * reports the hit or miss the command itself published. Every assertion on a
 * hit, a miss, or damage here reads a command-produced fact; none of them is
 * synthesized by the rider modules or by this suite.
 */

import { describe, expect, it } from 'vitest';
import type { Ability, CombatCharacter, CombatState } from '../../../types/combat';
import { createMockCombatCharacter, createMockCombatState } from '../../../utils/core';
import { bindPrimalBeast, PRIMAL_COMPANION_FEATURE_ID } from '../../../utils/combat/beastMasterUtils';
import { HUNTER_PREY_FEATURE_ID } from '../../../utils/combat/hunterUtils';
import {
  resolveBeastsStrikeAttack,
  resolveGiantKillerStrike,
  resolveHordeBreakerStrike,
  selectHordeBreakerSecondaryTarget,
} from '../riderExtraStrikes';

// A d20 source of 0.999 lands on 20 and a source of 0 lands on 1, so every
// attack below either certainly hits or certainly misses without the suite
// asserting the outcome it wants.
const ALWAYS_HITS = { attackRollRng: () => 0.999, damageRng: () => 0.999 };
const ALWAYS_MISSES = { attackRollRng: () => 0, damageRng: () => 0 };

const HUNTERS_PREY_ABILITY: Ability = {
  id: HUNTER_PREY_FEATURE_ID,
  name: "Hunter's Prey",
  description: 'Choose one Hunter option.',
  type: 'utility',
  cost: { type: 'free' },
  targeting: 'self',
  range: 0,
  effects: [],
};

const LONGSWORD: Ability = {
  id: 'longsword',
  name: 'Longsword',
  description: 'A martial melee weapon.',
  type: 'attack',
  cost: { type: 'action' },
  targeting: 'single_enemy',
  range: 1,
  effects: [{ type: 'damage', dice: '1d8+3', damageType: 'slashing' }],
  weapon: {
    id: 'longsword',
    name: 'Longsword',
    damageDice: '1d8',
    damageType: 'slashing',
    properties: [],
  } as unknown as Ability['weapon'],
  isProficient: true,
};

function createHunter(choice: 'horde_breaker' | 'giant_killer'): CombatCharacter {
  return createMockCombatCharacter({
    id: 'hunter',
    name: 'Hunter',
    team: 'player',
    level: 3,
    position: { x: 0, y: 0 },
    stats: { strength: 16 } as CombatCharacter['stats'],
    abilities: [HUNTERS_PREY_ABILITY, LONGSWORD],
    hunterPreyChoice: choice,
  });
}

function createEnemy(overrides: Partial<CombatCharacter>): CombatCharacter {
  return createMockCombatCharacter({
    team: 'enemy',
    currentHP: 30,
    maxHP: 30,
    armorClass: 12,
    baseAC: 12,
    ...overrides,
  });
}

function stateOf(characters: CombatCharacter[]): CombatState {
  return createMockCombatState({ characters });
}

describe('Horde Breaker', () => {
  const originalTarget = () => createEnemy({ id: 'goblin-a', name: 'Goblin A', position: { x: 1, y: 0 } });
  // Within 5 feet of the ORIGINAL target, which is the rule — it need not be
  // adjacent to the Hunter's other victim in any other sense.
  const secondTarget = () => createEnemy({ id: 'goblin-b', name: 'Goblin B', position: { x: 2, y: 0 } });

  it('picks a second creature within 5 feet of the original target', () => {
    const state = stateOf([createHunter('horde_breaker'), originalTarget(), secondTarget()]);

    const picked = selectHordeBreakerSecondaryTarget(state, {
      rangerId: 'hunter',
      originalTargetId: 'goblin-a',
    });
    expect(picked?.id).toBe('goblin-b');
  });

  it('leaves a creature beyond 5 feet of the original target unpicked', () => {
    const distant = createEnemy({ id: 'goblin-far', name: 'Far Goblin', position: { x: 6, y: 0 } });
    const state = stateOf([createHunter('horde_breaker'), originalTarget(), distant]);

    expect(selectHordeBreakerSecondaryTarget(state, {
      rangerId: 'hunter',
      originalTargetId: 'goblin-a',
    })).toBeUndefined();
  });

  it('fires once per turn and lands a command-produced attack result', async () => {
    const state = stateOf([createHunter('horde_breaker'), originalTarget(), secondTarget()]);

    const first = await resolveHordeBreakerStrike(state, {
      rangerId: 'hunter',
      originalTargetId: 'goblin-a',
      secondaryTargetId: 'goblin-b',
      abilityId: 'longsword',
      randomSources: ALWAYS_HITS,
    });

    expect(first.resolved).toBe(true);
    expect(first.secondaryTargetId).toBe('goblin-b');
    // The hit is the command's own published attack result, not a rider claim.
    expect(first.attackResult?.targetId).toBe('goblin-b');
    expect(first.attackResult?.isHit).toBe(true);
    expect(first.logEntries.length).toBeGreaterThan(0);

    const struck = first.state.characters.find(character => character.id === 'goblin-b');
    expect(struck?.currentHP).toBeLessThan(30);
    // The original target is untouched: the extra attack is a separate swing.
    expect(first.state.characters.find(character => character.id === 'goblin-a')?.currentHP).toBe(30);

    const second = await resolveHordeBreakerStrike(first.state, {
      rangerId: 'hunter',
      originalTargetId: 'goblin-a',
      secondaryTargetId: 'goblin-b',
      abilityId: 'longsword',
      randomSources: ALWAYS_HITS,
    });
    expect(second.resolved).toBe(false);
    expect(second.riderFailure).toBe('already_used_this_turn');
    expect(second.attackResult).toBeUndefined();
  });

  it('refuses a second target standing beyond 5 feet of the first', async () => {
    const distant = createEnemy({ id: 'goblin-far', name: 'Far Goblin', position: { x: 6, y: 0 } });
    const state = stateOf([createHunter('horde_breaker'), originalTarget(), distant]);

    const result = await resolveHordeBreakerStrike(state, {
      rangerId: 'hunter',
      originalTargetId: 'goblin-a',
      secondaryTargetId: 'goblin-far',
      abilityId: 'longsword',
      randomSources: ALWAYS_HITS,
    });
    expect(result.riderFailure).toBe('secondary_out_of_reach');
    // The ledger is untouched, so a legal Horde Breaker is still available.
    expect(result.state.characters.find(character => character.id === 'hunter')?.featUsageThisTurn ?? [])
      .not.toContain(HUNTER_PREY_FEATURE_ID);
  });
});

describe('Giant Killer', () => {
  const ogre = () => createEnemy({
    id: 'ogre',
    name: 'Ogre',
    position: { x: 1, y: 0 },
    stats: { size: 'Large' } as CombatCharacter['stats'],
  });

  it('spends the reaction and strikes back when a Large attacker misses', async () => {
    const state = stateOf([createHunter('giant_killer'), ogre()]);

    const result = await resolveGiantKillerStrike(state, {
      rangerId: 'hunter',
      targetId: 'ogre',
      targetMissedRangerThisTurn: true,
      abilityId: 'longsword',
      randomSources: ALWAYS_HITS,
    });

    expect(result.resolved).toBe(true);
    expect(result.attackResult?.targetId).toBe('ogre');
    expect(result.attackResult?.isHit).toBe(true);

    const hunter = result.state.characters.find(character => character.id === 'hunter');
    expect(hunter?.actionEconomy.reaction.used).toBe(true);
    expect(result.state.characters.find(character => character.id === 'ogre')?.currentHP).toBeLessThan(30);
  });

  it('reports a miss the command rolled rather than inventing damage', async () => {
    const armored = createEnemy({
      id: 'ogre',
      name: 'Ogre',
      position: { x: 1, y: 0 },
      armorClass: 25,
      baseAC: 25,
      stats: { size: 'Large' } as CombatCharacter['stats'],
    });
    const state = stateOf([createHunter('giant_killer'), armored]);

    const result = await resolveGiantKillerStrike(state, {
      rangerId: 'hunter',
      targetId: 'ogre',
      targetMissedRangerThisTurn: true,
      abilityId: 'longsword',
      randomSources: ALWAYS_MISSES,
    });

    expect(result.resolved).toBe(true);
    expect(result.attackResult?.isHit).toBe(false);
    expect(result.state.characters.find(character => character.id === 'ogre')?.currentHP).toBe(30);
  });

  it('declines a Medium attacker, an attacker that hit, and a spent reaction', async () => {
    const medium = createEnemy({ id: 'ogre', name: 'Bandit', position: { x: 1, y: 0 } });
    expect((await resolveGiantKillerStrike(stateOf([createHunter('giant_killer'), medium]), {
      rangerId: 'hunter', targetId: 'ogre', targetMissedRangerThisTurn: true, abilityId: 'longsword',
    })).riderFailure).toBe('target_too_small');

    expect((await resolveGiantKillerStrike(stateOf([createHunter('giant_killer'), ogre()]), {
      rangerId: 'hunter', targetId: 'ogre', targetMissedRangerThisTurn: false, abilityId: 'longsword',
    })).riderFailure).toBe('no_recent_miss');

    const spentHunter: CombatCharacter = {
      ...createHunter('giant_killer'),
      actionEconomy: {
        ...createHunter('giant_killer').actionEconomy,
        reaction: { used: true, remaining: 0 },
      },
    };
    expect((await resolveGiantKillerStrike(stateOf([spentHunter, ogre()]), {
      rangerId: 'hunter', targetId: 'ogre', targetMissedRangerThisTurn: true, abilityId: 'longsword',
    })).riderFailure).toBe('no_reaction');
  });
});

describe("Beast's Strike", () => {
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
        description: 'Summon a loyal beast companion.',
        type: 'utility',
        cost: { type: 'action' },
        targeting: 'self',
        range: 0,
        effects: [],
      }],
    });
  }

  function createBeast(): CombatCharacter {
    return bindPrimalBeast(
      createRanger(),
      createMockCombatCharacter({ id: 'beast', name: 'Beast', team: 'player', position: { x: 1, y: 0 } }),
      'land',
    );
  }

  it('grants the companion a command-produced strike on an adjacent target', async () => {
    const target = createEnemy({ id: 'goblin', name: 'Goblin', position: { x: 2, y: 0 } });
    const state = stateOf([createRanger(), createBeast(), target]);

    const result = await resolveBeastsStrikeAttack(state, {
      beastId: 'beast',
      targetId: 'goblin',
      randomSources: ALWAYS_HITS,
    });

    expect(result.resolved).toBe(true);
    expect(result.ability?.id).toBe('primal_beast_strike');
    expect(result.attackResult?.targetId).toBe('goblin');
    expect(result.attackResult?.isHit).toBe(true);
    expect(result.state.characters.find(character => character.id === 'goblin')?.currentHP).toBeLessThan(30);
  });

  it('deals nothing on a command-rolled miss', async () => {
    const target = createEnemy({
      id: 'goblin', name: 'Goblin', position: { x: 2, y: 0 }, armorClass: 25, baseAC: 25,
    });
    const state = stateOf([createRanger(), createBeast(), target]);

    const result = await resolveBeastsStrikeAttack(state, {
      beastId: 'beast',
      targetId: 'goblin',
      randomSources: ALWAYS_MISSES,
    });

    expect(result.resolved).toBe(true);
    expect(result.attackResult?.isHit).toBe(false);
    expect(result.state.characters.find(character => character.id === 'goblin')?.currentHP).toBe(30);
  });

  it('refuses a target outside the beast reach and a striker that is no beast', async () => {
    const far = createEnemy({ id: 'goblin', name: 'Goblin', position: { x: 8, y: 0 } });
    expect((await resolveBeastsStrikeAttack(stateOf([createRanger(), createBeast(), far]), {
      beastId: 'beast', targetId: 'goblin',
    })).riderFailure).toBe('target_out_of_reach');

    const unboundBeast = createMockCombatCharacter({
      id: 'beast', name: 'Stray Dog', team: 'player', position: { x: 1, y: 0 },
    });
    const adjacent = createEnemy({ id: 'goblin', name: 'Goblin', position: { x: 2, y: 0 } });
    expect((await resolveBeastsStrikeAttack(stateOf([createRanger(), unboundBeast, adjacent]), {
      beastId: 'beast', targetId: 'goblin',
    })).riderFailure).toBe('not_a_primal_beast');
  });
});
