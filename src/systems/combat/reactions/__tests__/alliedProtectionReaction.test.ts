/**
 * This file proves allied Interception discovery, choice, order, and claims.
 *
 * It uses live combat actors and map sight instead of preview labels. The tests
 * cover accept, decline, duplicate delivery, explicit selection among multiple
 * responders, and every canonical eligibility rejection before payment.
 *
 * Exercises: alliedProtectionReaction.
 * Depends on: companionProtectionReaction and shared combat factories.
 */

import { describe, expect, it, vi } from 'vitest';
import type { BattleMapData, BattleMapTile, CombatCharacter } from '../../../../types/combat';
import { resetEconomy } from '../../../../utils/combat/actionEconomyUtils';
import { createMockCombatCharacter } from '../../../../utils/core';
import {
  getAlliedProtectionClaimId,
  resolveAlliedProtectionReactionWindow,
} from '../alliedProtectionReaction';

// ============================================================================
// Two-Protector Fixture
// ============================================================================
// Both companions are adjacent to the ward and can see the attacker. The turn
// order deliberately puts protector B first so array order cannot decide.
// ============================================================================

function makeMap(blockerColumnX?: number): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let y = 0; y < 12; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const blocked = blockerColumnX === x;
      tiles.set(`${x}-${y}`, {
        id: `${x}-${y}`,
        coordinates: { x, y },
        terrain: blocked ? 'wall' : 'floor',
        elevation: 0,
        movementCost: blocked ? 0 : 5,
        blocksMovement: blocked,
        blocksLoS: blocked,
        decoration: null,
        effects: [],
      });
    }
  }
  return { dimensions: { width: 16, height: 12 }, tiles, theme: 'dungeon', seed: 38 };
}

function companion(id: string, ownerId: string, position: { x: number; y: number }): CombatCharacter {
  return resetEconomy(createMockCombatCharacter({
    id,
    name: id === 'protector-a' ? 'Amber Guardian' : 'Blue Guardian',
    team: 'player',
    position,
    level: 5,
    isSummon: true,
    summonMetadata: { casterId: ownerId, spellId: 'primal-companion', initiativePolicy: 'shared' },
    feats: ['interception_style'],
    equipment: {
      shield: {
        itemId: `${id}-shield`, itemName: 'Guardian Shield', slot: 'OffHand',
        magicStatus: 'nonmagical', properties: ['shield'],
      },
    },
  }));
}

function makeActors(): {
  owner: CombatCharacter;
  protectorA: CombatCharacter;
  protectorB: CombatCharacter;
  ward: CombatCharacter;
  attacker: CombatCharacter;
} {
  const owner = resetEconomy(createMockCombatCharacter({
    id: 'owner', name: 'Ranger Owner', team: 'player', position: { x: 2, y: 3 },
  }));
  return {
    owner,
    protectorA: companion('protector-a', owner.id, { x: 5, y: 5 }),
    protectorB: companion('protector-b', owner.id, { x: 6, y: 4 }),
    ward: resetEconomy(createMockCombatCharacter({
      id: 'ward', name: 'Protected Ally', team: 'player', position: { x: 6, y: 5 },
      currentHP: 30, maxHP: 30,
    })),
    attacker: resetEconomy(createMockCombatCharacter({
      id: 'attacker', name: 'Hostile Attacker', team: 'enemy', position: { x: 9, y: 5 },
    })),
  };
}

function input(overrides: Partial<Parameters<typeof resolveAlliedProtectionReactionWindow>[0]> = {}) {
  const actors = makeActors();
  return {
    characters: [actors.owner, actors.protectorA, actors.protectorB, actors.ward, actors.attacker],
    turnOrder: [actors.attacker.id, actors.protectorB.id, actors.owner.id, actors.protectorA.id, actors.ward.id],
    mapData: makeMap(),
    attacker: actors.attacker,
    protectedTarget: actors.ward,
    hitEventId: 'hit-38',
    claimedEventIds: new Set<string>(),
    attack: { isHit: true, damage: 14, damageType: 'Slashing' },
    reductionRng: () => 0.55,
    ...overrides,
  };
}

describe('allied protection responder choice and ownership', () => {
  it('orders every eligible responder and spends only the explicitly selected one', async () => {
    const requestReaction = vi.fn(async (_attackerId, _targetId, _trigger, options) => {
      expect(options.map(option => option.id)).toEqual([
        'interception:protector-b',
        'interception:protector-a',
      ]);
      return 'interception:protector-a';
    });
    const result = await resolveAlliedProtectionReactionWindow(input({ requestReaction }));

    expect(result).toMatchObject({
      outcome: 'resolved', selectedProtectorId: 'protector-a',
      incomingDamage: 14, totalReduction: 9, finalDamage: 5,
    });
    expect(result.characters.find(actor => actor.id === 'protector-a')?.actionEconomy.reaction.used).toBe(true);
    expect(result.characters.find(actor => actor.id === 'protector-b')?.actionEconomy.reaction.used).toBe(false);
    expect(result.characters.find(actor => actor.id === 'owner')?.actionEconomy.reaction.used).toBe(false);
    expect(result.characters.find(actor => actor.id === 'ward')?.actionEconomy.reaction.used).toBe(false);
    expect(result.characters.find(actor => actor.id === 'ward')?.currentHP).toBe(30);
  });

  it('supports explicit decline without damage reduction or any Reaction cost', async () => {
    const result = await resolveAlliedProtectionReactionWindow(input({
      requestReaction: vi.fn().mockResolvedValue(null),
    }));

    expect(result).toMatchObject({ outcome: 'declined', finalDamage: 14, totalReduction: 0 });
    expect(result.characters.every(actor => actor.actionEconomy.reaction.used === false)).toBe(true);
  });

  it('claims a stable hit id before replay can prompt or spend again', async () => {
    const requestReaction = vi.fn().mockResolvedValue('interception:protector-a');
    const claimId = getAlliedProtectionClaimId('hit-38');
    const result = await resolveAlliedProtectionReactionWindow(input({
      claimedEventIds: new Set([claimId]),
      requestReaction,
    }));

    expect(result).toMatchObject({ outcome: 'duplicate_event', claimId, finalDamage: 14 });
    expect(requestReaction).not.toHaveBeenCalled();
    expect(result.characters.every(actor => actor.actionEconomy.reaction.used === false)).toBe(true);
  });
});

describe('allied protection atomic eligibility rejection', () => {
  it.each([
    ['miss', (actors: ReturnType<typeof makeActors>) => actors, makeMap(), { isHit: false, damage: 14, damageType: 'Slashing' }, 'attack_missed'],
    ['zero damage', (actors: ReturnType<typeof makeActors>) => actors, makeMap(), { isHit: true, damage: 0, damageType: 'Slashing' }, 'no_incoming_damage'],
    ['wrong attacker sight', (actors: ReturnType<typeof makeActors>) => actors, makeMap(7), { isHit: true, damage: 14, damageType: 'Slashing' }, 'attacker_not_visible'],
    ['out of range', (actors: ReturnType<typeof makeActors>) => ({ ...actors, ward: { ...actors.ward, position: { x: 10, y: 9 } } }), makeMap(), { isHit: true, damage: 14, damageType: 'Slashing' }, 'protected_target_out_of_range'],
    ['incapacitated', (actors: ReturnType<typeof makeActors>) => ({ ...actors, protectorA: { ...actors.protectorA, conditions: [{ name: 'Incapacitated', source: 'test', duration: { type: 'rounds', value: 1 }, appliedTurn: 0 }] }, protectorB: { ...actors.protectorB, conditions: [{ name: 'Incapacitated', source: 'test', duration: { type: 'rounds', value: 1 }, appliedTurn: 0 }] } }), makeMap(), { isHit: true, damage: 14, damageType: 'Slashing' }, 'protector_incapacitated'],
    ['spent Reaction', (actors: ReturnType<typeof makeActors>) => ({ ...actors, protectorA: { ...actors.protectorA, actionEconomy: { ...actors.protectorA.actionEconomy, reaction: { used: true, remaining: 0 } } }, protectorB: { ...actors.protectorB, actionEconomy: { ...actors.protectorB.actionEconomy, reaction: { used: true, remaining: 0 } } } }), makeMap(), { isHit: true, damage: 14, damageType: 'Slashing' }, 'protector_reaction_unavailable'],
    ['missing equipment', (actors: ReturnType<typeof makeActors>) => ({ ...actors, protectorA: { ...actors.protectorA, equipment: {} }, protectorB: { ...actors.protectorB, equipment: {} } }), makeMap(), { isHit: true, damage: 14, damageType: 'Slashing' }, 'protector_missing_weapon_or_shield'],
    ['missing feature', (actors: ReturnType<typeof makeActors>) => ({ ...actors, protectorA: { ...actors.protectorA, feats: [] }, protectorB: { ...actors.protectorB, feats: [] } }), makeMap(), { isHit: true, damage: 14, damageType: 'Slashing' }, 'protector_missing_interception'],
  ] as const)('rejects %s before prompt, cost, or reduction', async (_label, update, mapData, attack, reason) => {
    const actors = update(makeActors());
    const requestReaction = vi.fn();
    const result = await resolveAlliedProtectionReactionWindow(input({
      characters: [actors.owner, actors.protectorA, actors.protectorB, actors.ward, actors.attacker],
      attacker: actors.attacker,
      protectedTarget: actors.ward,
      mapData,
      attack,
      requestReaction,
    }));

    expect(result.outcome).toBe('no_eligible_responder');
    expect(result.candidates.map(candidate => candidate.reason)).toContain(reason);
    expect(result.finalDamage).toBe(Math.max(0, attack.damage));
    expect(requestReaction).not.toHaveBeenCalled();
    expect(result.characters.find(actor => actor.id === actors.ward.id)?.currentHP).toBe(30);
  });
});
