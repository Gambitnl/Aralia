/**
 * This file proves the live healing/temp-HP transaction validates before cost.
 *
 * Canonical spell records provide targeting and payment. The assertions cover
 * cumulative live state, capped and downed healing, non-stacking temporary HP,
 * and every pre-payment rejection required by CS22.
 */

import { describe, expect, it } from 'vitest';
import type { BattleMapData, BattleMapTile, CombatCharacter, TurnState } from '../../../../types/combat';
import type { Spell } from '../../../../types';
import healingWordData from '../../../../data/spells/level-1/healing-word.json';
import { createMockCombatCharacter } from '../../../../utils/core';
import {
  createHitPointSpellAction,
  resolveHitPointAction,
  type HitPointActionDefinition,
} from '../healingTemporaryHitPointResolution';

const HEALING_WORD = healingWordData as Spell;

function createTile(x: number, y: number): BattleMapTile {
  return {
    id: `${x}-${y}`,
    coordinates: { x, y },
    terrain: 'grass',
    elevation: 0,
    movementCost: 1,
    blocksLoS: false,
    blocksMovement: false,
    decoration: null,
    effects: [],
  };
}

function createMap(): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let x = 0; x < 12; x += 1) {
    for (let y = 0; y < 12; y += 1) tiles.set(`${x}-${y}`, createTile(x, y));
  }
  return { dimensions: { width: 12, height: 12 }, tiles, theme: 'forest', seed: 22 };
}

function createTurn(currentCharacterId: string): TurnState {
  return {
    currentTurn: 1,
    turnOrder: ['healer', 'ally'],
    currentCharacterId,
    phase: 'action',
    actionsThisTurn: [],
  };
}

function createActors(): CombatCharacter[] {
  return [
    createMockCombatCharacter({
      id: 'healer',
      name: 'Healer',
      team: 'player',
      position: { x: 5, y: 5 },
      spellSlots: { level_1: { current: 3, max: 3 } },
    }),
    createMockCombatCharacter({
      id: 'ally',
      name: 'Ally',
      team: 'player',
      position: { x: 6, y: 5 },
      currentHP: 12,
      maxHP: 24,
      tempHP: 0,
    }),
  ];
}

function actor(characters: CombatCharacter[], id: string): CombatCharacter {
  const found = characters.find(character => character.id === id);
  if (!found) throw new Error(`Missing hit-point transaction actor ${id}.`);
  return found;
}

function healingInput(characters = createActors()) {
  const healer = actor(characters, 'healer');
  return {
    characters,
    mapData: createMap(),
    turnState: createTurn('healer'),
    casterId: 'healer',
    targetId: 'ally',
    action: createHitPointSpellAction(HEALING_WORD, healer, 1),
    mode: 'healing' as const,
    amounts: [20],
  };
}

// ============================================================================
// Accepted Transactions
// ============================================================================
// Payment and HP changes appear in the same returned roster. Downed cleanup is
// asserted here because it is part of the shared healing helper, not UI prose.
// ============================================================================

describe('resolveHitPointAction', () => {
  it('caps healing, pays the live Bonus Action and slot, and accumulates from live HP', () => {
    const result = resolveHitPointAction(healingInput());
    const healer = actor(result.characters, 'healer');
    const ally = actor(result.characters, 'ally');

    expect(result).toMatchObject({ status: 'resolved', appliedAmount: 12 });
    expect(ally.currentHP).toBe(24);
    expect(healer.actionEconomy.bonusAction.used).toBe(true);
    expect(healer.spellSlots?.level_1?.current).toBe(2);
  });

  it('heals a downed player and clears only the canonical dying state', () => {
    const characters = createActors();
    const downed = actor(characters, 'ally');
    downed.currentHP = 0;
    downed.deathSaves = { successes: 1, failures: 2, isStable: false };
    downed.statusEffects.push({ id: 'unconscious', name: 'Unconscious', type: 'debuff', description: '', duration: 999, icon: '' });
    downed.statusEffects.push({ id: 'bless', name: 'Bless', type: 'buff', description: '', duration: 3, icon: '' });
    downed.conditions = [{ name: 'Unconscious', duration: { type: 'permanent' }, appliedTurn: 1 }];
    const result = resolveHitPointAction({ ...healingInput(characters), amounts: [8] });
    const healed = actor(result.characters, 'ally');

    expect(healed.currentHP).toBe(8);
    expect(healed.deathSaves).toBeUndefined();
    expect(healed.statusEffects.map(effect => effect.name)).toEqual(['Bless']);
    expect(healed.conditions).toEqual([]);
  });

  it('keeps a larger temp pool, replaces it with a larger offer, and pays once', () => {
    const action: HitPointActionDefinition = {
      name: 'Ward',
      targeting: { type: 'single', range: 60, validTargets: ['creatures'], lineOfSight: true, maxTargets: 1 },
      cost: { type: 'action', spellSlotLevel: 1 },
    };
    const result = resolveHitPointAction({
      ...healingInput(),
      action,
      mode: 'temporary_hit_points',
      amounts: [8, 5, 12],
    });

    expect(result.temporaryHitPointSteps).toEqual([8, 8, 12]);
    expect(actor(result.characters, 'ally')).toMatchObject({ currentHP: 12, tempHP: 12 });
    expect(actor(result.characters, 'healer').actionEconomy.action.used).toBe(true);
    expect(actor(result.characters, 'healer').spellSlots?.level_1?.current).toBe(2);
  });

  // ========================================================================
  // Pre-Payment Rejections
  // ========================================================================
  // Every case keeps the original roster identity. This is stronger than
  // checking equal values: the resolver did not manufacture changed copies.
  // ========================================================================

  it.each([
    ['off turn', (input: ReturnType<typeof healingInput>) => ({ ...input, turnState: createTurn('ally') }), 'off_turn'],
    ['spent bonus action', (input: ReturnType<typeof healingInput>) => {
      actor(input.characters, 'healer').actionEconomy.bonusAction.used = true;
      return input;
    }, 'unaffordable_cost'],
    ['empty slot pool', (input: ReturnType<typeof healingInput>) => {
      actor(input.characters, 'healer').spellSlots!.level_1!.current = 0;
      return input;
    }, 'unaffordable_cost'],
    ['invalid Undead target', (input: ReturnType<typeof healingInput>) => {
      actor(input.characters, 'ally').creatureTypes = ['Undead'];
      return input;
    }, 'invalid_target:target_filter_failed'],
  ])('rejects %s before HP or resources mutate', (_label, arrange, reason) => {
    const input = arrange(healingInput());
    const beforeHp = actor(input.characters, 'ally').currentHP;
    const beforeSlots = actor(input.characters, 'healer').spellSlots?.level_1?.current;
    const result = resolveHitPointAction(input);

    expect(result).toMatchObject({ status: 'rejected', reason });
    expect(result.characters).toBe(input.characters);
    expect(actor(result.characters, 'ally').currentHP).toBe(beforeHp);
    expect(actor(result.characters, 'healer').spellSlots?.level_1?.current).toBe(beforeSlots);
  });
});
