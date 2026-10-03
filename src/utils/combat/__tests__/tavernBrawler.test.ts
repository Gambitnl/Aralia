/**
 * @file tavernBrawler.test.ts
 * Proof for agora-4325.2: the three Tavern Brawler riders are real.
 *
 * 1. Improvised Weapon proficiency — a non-weapon object in the main hand is
 *    still a proficient attack for a feat holder.
 * 2. Unarmed Strike damage — 1d4 + Strength instead of the flat 1 + Strength.
 * 3. The post-hit shove — OFFERED after an unarmed or improvised hit, free to
 *    take, and refused when the feat, the hit, or the reach is missing.
 */
import { describe, expect, it } from 'vitest';
import type { BattleMapData, BattleMapTile, CombatCharacter } from '../../../types/combat';
import type { Item } from '../../../types';
import {
  hasTavernBrawler,
  isImprovisedWeapon,
  getUnarmedStrikeDamageFormula,
  TAVERN_BRAWLER_FEAT_ID,
  createPlayerCombatCharacter,
} from '../combatUtils';
import {
  buildTavernBrawlerShoveOffer,
  resolveTavernBrawlerShove,
} from '../shoveUtils';
import {
  createMockCombatCharacter,
  createMockCombatState,
  createMockGameState,
  createMockPlayerCharacter,
} from '../../core';

// ============================================================================
// Fixtures
// ============================================================================

function createMap(): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let y = 0; y < 3; y += 1) {
    for (let x = 0; x < 5; x += 1) {
      tiles.set(`${x}-${y}`, {
        id: `${x}-${y}`,
        coordinates: { x, y },
        terrain: 'floor',
        elevation: 0,
        movementCost: 5,
        blocksLoS: false,
        blocksMovement: false,
        decoration: null,
        effects: [],
      });
    }
  }
  return { dimensions: { width: 5, height: 3 }, tiles, theme: 'dungeon', seed: 4325 };
}

const barStool: Item = {
  id: 'bar_stool',
  name: 'Bar Stool',
  description: 'Three legs, one grudge.',
  type: 'misc',
  damageDice: '1d4',
} as unknown as Item;

// ============================================================================
// Rider 1 — Improvised Weapon proficiency
// ============================================================================

describe('Tavern Brawler: Improvised Weapon proficiency', () => {
  it('counts a non-weapon object as an improvised weapon', () => {
    expect(isImprovisedWeapon(barStool)).toBe(true);
    expect(isImprovisedWeapon({ ...barStool, type: 'weapon' } as Item)).toBe(false);
    expect(isImprovisedWeapon({ ...barStool, type: 'weapon', category: 'Improvised Weapon' } as Item)).toBe(true);
    expect(isImprovisedWeapon(undefined)).toBe(false);
  });

  it('makes the improvised attack proficient only for a feat holder', () => {
    const withoutFeat = createMockPlayerCharacter({
      feats: [],
      equippedItems: { MainHand: barStool },
    });
    const withFeat = createMockPlayerCharacter({
      feats: [TAVERN_BRAWLER_FEAT_ID],
      equippedItems: { MainHand: barStool },
    });

    const plainAttack = createPlayerCombatCharacter(withoutFeat).abilities.find(a => a.id === 'attack_main');
    const brawlerAttack = createPlayerCombatCharacter(withFeat).abilities.find(a => a.id === 'attack_main');

    expect(plainAttack?.isProficient).toBe(false);
    expect(brawlerAttack?.isProficient).toBe(true);
  });
});

// ============================================================================
// Rider 2 — 1d4 + Strength Unarmed Strike
// ============================================================================

describe('Tavern Brawler: Unarmed Strike damage', () => {
  it('keeps the flat 1 + Strength formula without the feat', () => {
    expect(getUnarmedStrikeDamageFormula({ feats: [] }, 3)).toBe('4');
    expect(getUnarmedStrikeDamageFormula({ feats: ['healer'] }, 0)).toBe('1');
  });

  it('raises the formula to 1d4 + Strength with the feat', () => {
    expect(getUnarmedStrikeDamageFormula({ feats: [TAVERN_BRAWLER_FEAT_ID] }, 3)).toBe('1d4+3');
    expect(getUnarmedStrikeDamageFormula({ feats: [TAVERN_BRAWLER_FEAT_ID] }, 0)).toBe('1d4');
    expect(getUnarmedStrikeDamageFormula({ feats: [TAVERN_BRAWLER_FEAT_ID] }, -1)).toBe('1d4-1');
  });

  it('publishes the upgraded formula on the generated Unarmed Strike ability', () => {
    const brawler = createMockPlayerCharacter({
      feats: [TAVERN_BRAWLER_FEAT_ID],
      equippedItems: {},
    });
    const unarmed = createPlayerCombatCharacter(brawler).abilities.find(a => a.id === 'unarmed_strike');

    expect(unarmed).toBeDefined();
    expect(unarmed?.attackType).toBe('unarmed');
    expect(unarmed?.effects[0].dice).toMatch(/^1d4/);
  });

  it('reads the feat off the character', () => {
    expect(hasTavernBrawler({ feats: [TAVERN_BRAWLER_FEAT_ID] })).toBe(true);
    expect(hasTavernBrawler({ feats: [] })).toBe(false);
    expect(hasTavernBrawler(undefined)).toBe(false);
  });
});

// ============================================================================
// Rider 3 — free post-hit 5-foot shove
// ============================================================================

describe('Tavern Brawler: post-hit shove offer', () => {
  const makeActors = (feats: string[]) => {
    const base = createMockCombatCharacter();
    const shover: CombatCharacter = createMockCombatCharacter({
      id: 'brawler',
      name: 'Brawler',
      level: 5,
      position: { x: 1, y: 1 },
      feats,
      stats: { ...base.stats, strength: 16, size: 'Medium' },
    });
    const target: CombatCharacter = createMockCombatCharacter({
      id: 'mark',
      name: 'Mark',
      position: { x: 2, y: 1 },
      stats: { ...base.stats, strength: 8, dexterity: 8, size: 'Medium' },
    });
    return { shover, target };
  };

  it('offers a free 5-foot push after an unarmed hit', () => {
    const { shover, target } = makeActors([TAVERN_BRAWLER_FEAT_ID]);

    const offer = buildTavernBrawlerShoveOffer({ shover, target, attackKind: 'unarmed', isHit: true });

    expect(offer).toEqual({
      source: 'tavern_brawler',
      shoverId: 'brawler',
      targetId: 'mark',
      attackKind: 'unarmed',
      choice: 'push',
      distanceFeet: 5,
      costsAttack: false,
    });
  });

  it('offers nothing without the feat, on a miss, or on a non-qualifying attack', () => {
    const withFeat = makeActors([TAVERN_BRAWLER_FEAT_ID]);
    const withoutFeat = makeActors([]);

    expect(buildTavernBrawlerShoveOffer({ ...withoutFeat, attackKind: 'unarmed', isHit: true })).toBeNull();
    expect(buildTavernBrawlerShoveOffer({ ...withFeat, attackKind: 'unarmed', isHit: false })).toBeNull();
    expect(buildTavernBrawlerShoveOffer({ ...withFeat, attackKind: null, isHit: true })).toBeNull();
  });

  it('offers nothing when the target is out of the 5-foot reach', () => {
    const { shover, target } = makeActors([TAVERN_BRAWLER_FEAT_ID]);
    const distant = { ...target, position: { x: 4, y: 1 } };

    expect(buildTavernBrawlerShoveOffer({ shover, target: distant, attackKind: 'improvised', isHit: true })).toBeNull();
  });

  it('pushes the target without spending an attack when the offer is taken', () => {
    const { shover, target } = makeActors([TAVERN_BRAWLER_FEAT_ID]);
    const state = createMockCombatState({
      characters: [shover, target],
      mapData: createMap(),
      turnState: {
        currentTurn: 1,
        turnOrder: [shover.id, target.id],
        currentCharacterId: shover.id,
        phase: 'action',
        actionsThisTurn: [],
      },
    });

    const offer = buildTavernBrawlerShoveOffer({ shover, target, attackKind: 'unarmed', isHit: true });
    expect(offer).not.toBeNull();

    const result = resolveTavernBrawlerShove({
      offer: offer!,
      state,
      gameState: createMockGameState(),
      saveAbility: 'Strength',
      // A minimal roll fails the save, so the push resolves.
      rng: () => 0.01,
    });

    expect(result.attempted).toBe(true);
    expect(result.attackSpent).toBe(false);
    expect(result.shoveSucceeded).toBe(true);
    expect(result.reason).toBe('resolved_push');
    // The Attack action is untouched: the feat's shove is free.
    const shoverAfter = result.state.characters.find(c => c.id === 'brawler');
    expect(shoverAfter?.actionEconomy.action.remaining).toBe(shover.actionEconomy.action.remaining);

    const targetAfter = result.state.characters.find(c => c.id === 'mark');
    expect(targetAfter?.position).toEqual({ x: 3, y: 1 });
  });
});
