/**
 * This file proves Interception is part of normal DamageCommand resolution.
 *
 * It verifies that the shared command discovers ordered allied responders,
 * waits for explicit selection or decline, reduces damage before HP, spends
 * only the chosen protector's Reaction, and claims a stable hit so replaying a
 * new command instance cannot prompt or apply any part of the hit twice.
 *
 * Exercises: DamageCommand and alliedProtectionReaction.
 * Depends on: live combat factories, map sight, and shared HP resolution.
 */

import { describe, expect, it, vi } from 'vitest';
import type { BattleMapData, BattleMapTile, CombatCharacter } from '../../../types/combat';
import type { DamageEffect } from '../../../types/spells';
import { resetEconomy } from '../../../utils/combat/actionEconomyUtils';
import {
  createMockCombatCharacter,
  createMockCombatState,
  createMockCommandContext,
} from '../../../utils/core';
import { DamageCommand } from '../DamageCommand';

// ============================================================================
// Normal Attack Fixture
// ============================================================================
// Damage and Interception use independent deterministic sources: 14d1 yields
// fourteen incoming damage, while d10 face six plus proficiency prevents nine.
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

function makeCompanion(id: string, ownerId: string, position: { x: number; y: number }): CombatCharacter {
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

function fixture(blockerColumnX?: number) {
  const owner = resetEconomy(createMockCombatCharacter({
    id: 'owner', name: 'Ranger Owner', team: 'player', position: { x: 2, y: 3 },
  }));
  const protectorA = makeCompanion('protector-a', owner.id, { x: 5, y: 5 });
  const protectorB = makeCompanion('protector-b', owner.id, { x: 6, y: 4 });
  const ward = resetEconomy(createMockCombatCharacter({
    id: 'ward', name: 'Protected Ally', team: 'player', position: { x: 6, y: 5 },
    currentHP: 30, maxHP: 30,
  }));
  const attacker = resetEconomy(createMockCombatCharacter({
    id: 'attacker', name: 'Hostile Attacker', team: 'enemy', position: { x: 9, y: 5 },
  }));
  const characters = [owner, protectorA, protectorB, ward, attacker];
  const state = createMockCombatState({
    characters,
    mapData: makeMap(blockerColumnX),
    combatLog: [],
    turnState: {
      currentTurn: 1,
      turnOrder: [attacker.id, protectorB.id, owner.id, protectorA.id, ward.id],
      currentCharacterId: attacker.id,
      phase: 'resolution',
      actionsThisTurn: [],
    },
  });
  const effect: DamageEffect = {
    type: 'DAMAGE',
    damage: { dice: '14d1', type: 'Slashing' },
    trigger: { type: 'immediate' },
    condition: { type: 'hit' },
  };
  return { owner, protectorA, protectorB, ward, attacker, state, effect };
}

function character(characters: CombatCharacter[], id: string): CombatCharacter {
  const found = characters.find(actor => actor.id === id);
  if (!found) throw new Error(`Missing normal-damage fixture actor ${id}.`);
  return found;
}

describe('DamageCommand allied Interception window', () => {
  it('selects one ordered responder, applies reduced HP damage, and ignores duplicate delivery', async () => {
    const actors = fixture();
    const requestReaction = vi.fn(async (_attackerId, _targetId, _trigger, options) => {
      expect(options.map(option => option.id)).toEqual([
        'interception:protector-b',
        'interception:protector-a',
      ]);
      return 'interception:protector-a';
    });
    const context = createMockCommandContext({
      spellId: 'normal-weapon-hit',
      spellName: 'Attack',
      caster: actors.attacker,
      targets: [actors.ward],
      weaponProperties: ['melee'],
      damageRng: () => 0,
      reactionRng: () => 0.55,
      damageEventId: 'stable-hit-38',
      requestReaction,
    });

    const first = await new DamageCommand(actors.effect, context).execute(actors.state);
    expect(character(first.characters, actors.ward.id).currentHP).toBe(25);
    expect(character(first.characters, actors.protectorA.id).actionEconomy.reaction.used).toBe(true);
    expect(character(first.characters, actors.protectorB.id).actionEconomy.reaction.used).toBe(false);
    expect(character(first.characters, actors.owner.id).actionEconomy.reaction.used).toBe(false);
    expect(character(first.characters, actors.ward.id).actionEconomy.reaction.used).toBe(false);
    expect(first.combatLog).toContainEqual(expect.objectContaining({
      id: 'stable-hit-38:ward:allied-protection-claim',
      data: expect.objectContaining({ outcome: 'resolved', finalDamage: 5 }),
    }));

    // A newly constructed command with the same delivered hit id proves the
    // claim is state-owned rather than hidden in one command object instance.
    const replay = await new DamageCommand(actors.effect, context).execute(first);
    expect(character(replay.characters, actors.ward.id).currentHP).toBe(25);
    expect(requestReaction).toHaveBeenCalledTimes(1);
    expect(replay.combatLog).toHaveLength(first.combatLog.length);
  });

  it('applies full damage after explicit decline without spending any actor Reaction', async () => {
    const actors = fixture();
    const result = await new DamageCommand(actors.effect, createMockCommandContext({
      spellId: 'declined-hit', spellName: 'Attack', caster: actors.attacker, targets: [actors.ward],
      weaponProperties: ['melee'], damageRng: () => 0, reactionRng: () => 0.55,
      damageEventId: 'declined-hit-38', requestReaction: vi.fn().mockResolvedValue(null),
    })).execute(actors.state);

    expect(character(result.characters, actors.ward.id).currentHP).toBe(16);
    expect(result.characters.every(actor => actor.actionEconomy.reaction.used === false)).toBe(true);
    expect(result.combatLog.find(entry => entry.id === 'declined-hit-38:ward:allied-protection-claim')?.data)
      .toMatchObject({ outcome: 'declined', finalDamage: 14 });
  });

  it('uses protector-to-attacker sight and rejects atomically when that lane is blocked', async () => {
    const actors = fixture(7);
    const requestReaction = vi.fn();
    const result = await new DamageCommand(actors.effect, createMockCommandContext({
      spellId: 'hidden-attacker-hit', spellName: 'Attack', caster: actors.attacker, targets: [actors.ward],
      weaponProperties: ['melee'], damageRng: () => 0, damageEventId: 'hidden-attacker-hit-38',
      requestReaction,
    })).execute(actors.state);

    expect(requestReaction).not.toHaveBeenCalled();
    expect(character(result.characters, actors.ward.id).currentHP).toBe(16);
    expect(result.combatLog.find(entry => entry.id === 'hidden-attacker-hit-38:ward:allied-protection-claim')?.message)
      .toContain('attacker_not_visible');
    expect(result.characters.every(actor => actor.actionEconomy.reaction.used === false)).toBe(true);
  });
});
