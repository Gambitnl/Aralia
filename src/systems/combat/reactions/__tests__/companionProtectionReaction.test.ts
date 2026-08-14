/**
 * This file proves the production companion-protection transaction.
 *
 * It covers canonical Interception damage reduction, independent owner and
 * companion Reactions, ownership, team, range, sight, incapacitation, spent
 * economy, equipment, and nonqualifying attacks without using preview labels.
 *
 * Exercises: companionProtectionReaction.
 * Depends on: shared combat-character factories and a complete battle map.
 */

import { describe, expect, it } from 'vitest';
import type { BattleMapData, BattleMapTile, CombatCharacter } from '../../../../types/combat';
import { resetEconomy } from '../../../../utils/combat/actionEconomyUtils';
import { createMockCombatCharacter } from '../../../../utils/core';
import {
  INTERCEPTION_STYLE_DESCRIPTION,
  INTERCEPTION_STYLE_NAME,
  resolveCompanionProtectionReduction,
  resolveCompanionProtectionReaction,
} from '../companionProtectionReaction';

// ============================================================================
// Four-Actor Combat Fixture
// ============================================================================
// The owner, owned guardian, allied ward, and hostile attacker remain distinct.
// One optional wall and exact actor positions isolate every rejection gate.
// ============================================================================

function makeMap(blocker?: { x: number; y: number }): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let y = 0; y < 12; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const blocks = blocker?.x === x && blocker.y === y;
      tiles.set(`${x}-${y}`, {
        id: `${x}-${y}`,
        coordinates: { x, y },
        terrain: blocks ? 'wall' : 'floor',
        elevation: 0,
        movementCost: blocks ? 0 : 5,
        blocksMovement: blocks,
        blocksLoS: blocks,
        decoration: null,
        effects: [],
      });
    }
  }
  return { dimensions: { width: 16, height: 12 }, tiles, theme: 'dungeon', seed: 38 };
}

function makeActors(): {
  owner: CombatCharacter;
  protector: CombatCharacter;
  protectedTarget: CombatCharacter;
  attacker: CombatCharacter;
} {
  const owner = resetEconomy(createMockCombatCharacter({
    id: 'owner', name: 'Ranger Owner', team: 'player', position: { x: 2, y: 3 },
  }));
  const protector = resetEconomy(createMockCombatCharacter({
    id: 'protector', name: 'Guardian Companion', team: 'player', position: { x: 5, y: 5 }, level: 5,
    isSummon: true,
    summonMetadata: { casterId: owner.id, spellId: 'primal-companion', initiativePolicy: 'shared' },
    feats: ['interception_style'],
    equipment: {
      shield: {
        itemId: 'guardian-shield', itemName: 'Guardian Shield', slot: 'OffHand',
        magicStatus: 'nonmagical', properties: ['shield'],
      },
    },
  }));
  const protectedTarget = resetEconomy(createMockCombatCharacter({
    id: 'ward', name: 'Protected Ally', team: 'player', position: { x: 6, y: 5 },
    currentHP: 30, maxHP: 30,
  }));
  const attacker = resetEconomy(createMockCombatCharacter({
    id: 'attacker', name: 'Hostile Attacker', team: 'enemy', position: { x: 9, y: 5 },
  }));
  return { owner, protector, protectedTarget, attacker };
}

function resolve(
  overrides: Partial<ReturnType<typeof makeActors>> = {},
  mapData = makeMap(),
  attack = { isHit: true, damage: 14, damageType: 'Slashing' },
) {
  const actors = { ...makeActors(), ...overrides };
  return resolveCompanionProtectionReaction({
    ...actors,
    mapData,
    attack,
    reductionRng: () => 0.55,
  });
}

// ============================================================================
// Successful Protection And Independent Economy
// ============================================================================
// A fixed d10 face of 6 plus level-5 proficiency 3 reduces 14 damage to 5.
// Only the owned companion pays, while the owner and attacker remain untouched.
// ============================================================================

describe('companion protection successful resolution', () => {
  it('reads canonical Interception and spends only the companion Reaction', () => {
    const result = resolve();

    expect(INTERCEPTION_STYLE_NAME).toBe('Interception Fighting Style');
    expect(INTERCEPTION_STYLE_DESCRIPTION).toContain('1d10 + your Proficiency Bonus');
    expect(result).toMatchObject({
      outcome: 'resolved',
      reason: 'resolved',
      distanceFeet: 5,
      lineOfSight: true,
      incomingDamage: 14,
      reductionRoll: 6,
      proficiencyBonus: 3,
      totalReduction: 9,
      finalDamage: 5,
      protectedHPBefore: 30,
      protectedHPAfter: 25,
    });
    expect(result.protector.actionEconomy.reaction.used).toBe(true);
    expect(result.owner.actionEconomy.reaction.used).toBe(false);
    expect(result.attacker.actionEconomy.reaction.used).toBe(false);
  });

  it('allows an owned companion to protect its owner', () => {
    // Move the owner beside the companion, then use that same owner as the
    // protected ally. Ownership remains valid while only the companion pays.
    const actors = makeActors();
    const owner = {
      ...actors.owner,
      position: { x: 6, y: 5 },
      currentHP: 30,
      maxHP: 30,
    };
    const result = resolve({ ...actors, owner, protectedTarget: owner });

    expect(result).toMatchObject({
      outcome: 'resolved',
      reason: 'resolved',
      totalReduction: 9,
      finalDamage: 5,
      protectedHPBefore: 30,
      protectedHPAfter: 25,
    });
    expect(result.protector.actionEconomy.reaction.used).toBe(true);
    expect(result.owner.currentHP).toBe(25);
    expect(result.owner).toBe(result.protectedTarget);
    expect(result.owner.actionEconomy.reaction.used).toBe(false);
  });

  it('can spend the selected Reaction and return reduced pre-HP damage', () => {
    const actors = makeActors();
    const result = resolveCompanionProtectionReduction({
      ...actors,
      mapData: makeMap(),
      attack: { isHit: true, damage: 14, damageType: 'Slashing' },
      reductionRng: () => 0.55,
    });

    expect(result).toMatchObject({ outcome: 'resolved', finalDamage: 5, protectedHPAfter: 30 });
    expect(result.protectedTarget.currentHP).toBe(30);
    expect(result.protector.actionEconomy.reaction.used).toBe(true);
  });
});

// ============================================================================
// Qualification And Cost Rejections
// ============================================================================
// Every failure keeps both reaction ledgers ready and target HP unchanged.
// The reason identifies the exact fact a reaction chooser would need to show.
// ============================================================================

describe('companion protection rejection boundaries', () => {
  it('rejects a companion trying to protect itself', () => {
    // Interception protects another creature. Reusing the protector as the
    // target must fail before damage or its Reaction can change.
    const actors = makeActors();
    const result = resolve({ ...actors, protectedTarget: actors.protector });

    expect(result.reason).toBe('not_distinct_actors');
    expect(result.protector.actionEconomy.reaction.used).toBe(false);
    expect(result.protectedTarget.currentHP).toBe(actors.protector.currentHP);
    expect(result.totalReduction).toBe(0);
  });

  it.each([
    ['miss', (actors: ReturnType<typeof makeActors>) => actors, makeMap(), { isHit: false, damage: 14, damageType: 'Slashing' }, 'attack_missed'],
    ['no damage', (actors: ReturnType<typeof makeActors>) => actors, makeMap(), { isHit: true, damage: 0, damageType: 'Slashing' }, 'no_incoming_damage'],
    ['wrong owner', (actors: ReturnType<typeof makeActors>) => ({ ...actors, protector: { ...actors.protector, summonMetadata: { ...actors.protector.summonMetadata!, casterId: 'someone-else' } } }), makeMap(), { isHit: true, damage: 14, damageType: 'Slashing' }, 'protector_not_owned_by_owner'],
    ['non-allied target', (actors: ReturnType<typeof makeActors>) => ({ ...actors, protectedTarget: { ...actors.protectedTarget, team: 'enemy' as const } }), makeMap(), { isHit: true, damage: 14, damageType: 'Slashing' }, 'protected_target_not_allied'],
    ['out of range', (actors: ReturnType<typeof makeActors>) => ({ ...actors, protectedTarget: { ...actors.protectedTarget, position: { x: 8, y: 5 } } }), makeMap(), { isHit: true, damage: 14, damageType: 'Slashing' }, 'protected_target_out_of_range'],
    // The ally stays visible and adjacent while the wall at 7,5 blocks the
    // protector's sight to the attacker. Interception watches the attacker.
    ['attacker out of sight', (actors: ReturnType<typeof makeActors>) => actors, makeMap({ x: 7, y: 5 }), { isHit: true, damage: 14, damageType: 'Slashing' }, 'attacker_not_visible'],
    ['incapacitated', (actors: ReturnType<typeof makeActors>) => ({ ...actors, protector: { ...actors.protector, conditions: [{ name: 'Incapacitated', source: 'test', duration: { type: 'rounds', value: 1 }, appliedTurn: 0 }] } }), makeMap(), { isHit: true, damage: 14, damageType: 'Slashing' }, 'protector_incapacitated'],
    ['spent Reaction', (actors: ReturnType<typeof makeActors>) => ({ ...actors, protector: { ...actors.protector, actionEconomy: { ...actors.protector.actionEconomy, reaction: { used: true, remaining: 0 } } } }), makeMap(), { isHit: true, damage: 14, damageType: 'Slashing' }, 'protector_reaction_unavailable'],
  ] as const)('rejects %s without effect or payment', (_label, update, mapData, attack, reason) => {
    const actors = update(makeActors());
    const result = resolve(actors, mapData, attack);

    expect(result.reason).toBe(reason);
    expect(result.protectedTarget.currentHP).toBe(30);
    expect(result.owner.actionEconomy.reaction.used).toBe(false);
    if (reason !== 'protector_reaction_unavailable') {
      expect(result.protector.actionEconomy.reaction.used).toBe(false);
    }
    expect(result.totalReduction).toBe(0);
  });
});
