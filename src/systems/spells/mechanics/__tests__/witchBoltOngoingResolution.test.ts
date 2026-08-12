/**
 * This file proves Witch Bolt's ongoing resolver changes real combat state.
 *
 * The tests cover initial Action/slot payment, attack and HP damage, owner-linked
 * concentration, later-turn Bonus Action damage, optional skipping, unavailable
 * resources, range, Total Cover, concentration loss, duration expiry, and
 * preservation of an unrelated Mage Armor effect.
 */

import { describe, expect, it } from 'vitest';
import type { BattleMapData, BattleMapTile, CombatCharacter } from '../../../../types/combat';
import { createMockCombatCharacter } from '../../../../utils/core';
import { resetEconomy } from '../../../../utils/combat/actionEconomyUtils';
import {
  establishWitchBoltLink,
  resolveWitchBoltInitialCast,
  resolveWitchBoltLaterTurn,
  WITCH_BOLT_DURATION_ROUNDS,
  WITCH_BOLT_RANGE_FEET,
} from '../witchBoltOngoingResolution';

// ============================================================================
// Canonical Combat Fixture
// ============================================================================
// A complete floor map lets the production line-of-sight helper inspect every
// tile. One optional wall and one distant target expose both arc break rules.
// ============================================================================

const CASTER_ID = 'witch-bolt-caster';
const TARGET_ID = 'witch-bolt-target';
const STARTED_TURN = 3;
const LATER_TURN = 4;

function makeTile(x: number, y: number, blocksLoS = false): BattleMapTile {
  return {
    id: `${x}-${y}`,
    coordinates: { x, y },
    terrain: blocksLoS ? 'wall' : 'floor',
    elevation: 0,
    movementCost: blocksLoS ? 0 : 5,
    blocksMovement: blocksLoS,
    blocksLoS,
    decoration: null,
    effects: [],
  };
}

function makeMap(blockingPosition?: { x: number; y: number }): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let y = 0; y < 12; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const blocksLoS = blockingPosition?.x === x && blockingPosition.y === y;
      const tile = makeTile(x, y, blocksLoS);
      tiles.set(tile.id, tile);
    }
  }

  return {
    dimensions: { width: 16, height: 12 },
    tiles,
    theme: 'dungeon',
    seed: 12,
  };
}

function makeActors(): CombatCharacter[] {
  const caster = createMockCombatCharacter({
    id: CASTER_ID,
    name: 'Storm Binder',
    level: 5,
    position: { x: 3, y: 5 },
    team: 'player',
    spellcastingAbility: 'intelligence',
    spellSlots: { level_1: { current: 1, max: 1 } },
  });
  caster.stats.intelligence = 18;

  const target = createMockCombatCharacter({
    id: TARGET_ID,
    name: 'Arc Target',
    position: { x: 9, y: 5 },
    team: 'enemy',
    currentHP: 60,
    maxHP: 60,
    armorClass: 15,
    baseAC: 15,
    activeEffects: [{
      id: 'unrelated-mage-armor',
      spellId: 'mage-armor',
      casterId: TARGET_ID,
      sourceName: 'Mage Armor',
      type: 'buff',
      duration: { type: 'hours', value: 8 },
      startTime: 0,
    }],
  });

  return [caster, target];
}

function fixedD12(face: number): () => number {
  return () => (face - 0.5) / 12;
}

function findCharacter(characters: CombatCharacter[], id: string): CombatCharacter {
  const character = characters.find(candidate => candidate.id === id);
  if (!character) throw new Error(`Missing Witch Bolt test actor ${id}.`);
  return character;
}

function makeLinkedActors(): CombatCharacter[] {
  const actors = makeActors();
  const caster = findCharacter(actors, CASTER_ID);
  const target = findCharacter(actors, TARGET_ID);
  const laterTurnCaster = resetEconomy({
    ...caster,
    spellSlots: { level_1: { current: 0, max: 1 } },
  });
  const previouslyDamagedTarget = { ...target, currentHP: 48 };

  return establishWitchBoltLink({
    characters: [laterTurnCaster, previouslyDamagedTarget],
    casterId: CASTER_ID,
    targetId: TARGET_ID,
    startedTurn: STARTED_TURN,
  });
}

// ============================================================================
// Initial Cast And Later-Turn Choice
// ============================================================================
// These checks pin the structured Action/Bonus Action distinction and the two
// separate damage formulas without introducing a scenario-owned rule table.
// ============================================================================

describe('witchBoltOngoingResolution resource and damage path', () => {
  it('reads the canonical 60-foot, one-minute spell boundaries', () => {
    expect(WITCH_BOLT_RANGE_FEET).toBe(60);
    expect(WITCH_BOLT_DURATION_ROUNDS).toBe(10);
  });

  it('pays the initial Action and slot, deals initial damage, and establishes the linked arc', () => {
    const result = resolveWitchBoltInitialCast({
      characters: makeActors(),
      mapData: makeMap(),
      casterId: CASTER_ID,
      targetId: TARGET_ID,
      startedTurn: STARTED_TURN,
      d20Roll: 15,
      damageRng: fixedD12(6),
    });
    const caster = findCharacter(result.characters, CASTER_ID);
    const target = findCharacter(result.characters, TARGET_ID);

    expect(result).toMatchObject({
      outcome: 'established',
      reason: 'initial_hit',
      damage: 12,
      distanceFeet: 30,
      remainingRounds: 10,
    });
    expect(caster.actionEconomy.action.used).toBe(true);
    expect(caster.actionEconomy.bonusAction.used).toBe(false);
    expect(caster.spellSlots?.level_1.current).toBe(0);
    expect(caster.concentratingOn).toMatchObject({
      spellId: 'witch-bolt',
      sustainCost: { actionType: 'bonus_action', optional: true },
    });
    expect(target.currentHP).toBe(48);
    expect(target.statusEffects.map(effect => effect.name)).toContain('Witch Bolt Arc');
    expect(target.activeEffects?.map(effect => effect.spellId)).toEqual([
      'mage-armor',
      'witch-bolt',
    ]);
  });

  it('spends the later-turn Bonus Action and applies automatic repeat damage', () => {
    const result = resolveWitchBoltLaterTurn({
      characters: makeLinkedActors(),
      mapData: makeMap(),
      casterId: CASTER_ID,
      targetId: TARGET_ID,
      currentTurn: LATER_TURN,
      choice: 'activate',
      damageRng: fixedD12(6),
    });
    const caster = findCharacter(result.characters, CASTER_ID);
    const target = findCharacter(result.characters, TARGET_ID);

    expect(result).toMatchObject({
      outcome: 'activated',
      reason: 'repeat_damage',
      damage: 6,
      remainingRounds: 9,
    });
    expect(caster.actionEconomy.action.used).toBe(false);
    expect(caster.actionEconomy.bonusAction.used).toBe(true);
    expect(target.currentHP).toBe(42);
  });

  it('skips the optional Bonus Action without damage, payment, or ending the arc', () => {
    const linked = makeLinkedActors();
    const result = resolveWitchBoltLaterTurn({
      characters: linked,
      mapData: makeMap(),
      casterId: CASTER_ID,
      targetId: TARGET_ID,
      currentTurn: LATER_TURN,
      choice: 'skip',
    });
    const caster = findCharacter(result.characters, CASTER_ID);
    const target = findCharacter(result.characters, TARGET_ID);

    expect(result).toMatchObject({
      outcome: 'skipped',
      reason: 'skipped_optional_action',
      damage: 0,
    });
    expect(caster.actionEconomy.bonusAction.used).toBe(false);
    expect(caster.concentratingOn?.spellId).toBe('witch-bolt');
    expect(target.currentHP).toBe(48);
  });

  it('rejects repeat damage when the Bonus Action is already unavailable and keeps the arc', () => {
    const linked = makeLinkedActors().map(character => (
      character.id === CASTER_ID
        ? {
            ...character,
            actionEconomy: {
              ...character.actionEconomy,
              bonusAction: { used: true, remaining: 0 },
            },
          }
        : character
    ));
    const result = resolveWitchBoltLaterTurn({
      characters: linked,
      mapData: makeMap(),
      casterId: CASTER_ID,
      targetId: TARGET_ID,
      currentTurn: LATER_TURN,
      choice: 'activate',
      damageRng: fixedD12(6),
    });

    expect(result).toMatchObject({
      outcome: 'rejected',
      reason: 'action_unavailable',
      damage: 0,
    });
    expect(findCharacter(result.characters, CASTER_ID).concentratingOn?.spellId)
      .toBe('witch-bolt');
    expect(findCharacter(result.characters, TARGET_ID).currentHP).toBe(48);
  });
});

// ============================================================================
// Arc Breaks And Selective Cleanup
// ============================================================================
// Each ending removes Witch Bolt's status, active effect, and concentration
// pointer while retaining the unrelated Mage Armor active effect.
// ============================================================================

describe('witchBoltOngoingResolution ending boundaries', () => {
  function expectCleanArc(resultCharacters: CombatCharacter[]) {
    const caster = findCharacter(resultCharacters, CASTER_ID);
    const target = findCharacter(resultCharacters, TARGET_ID);
    expect(caster.concentratingOn).toBeUndefined();
    expect(target.statusEffects.map(effect => effect.sourceSpellId)).not.toContain('witch-bolt');
    expect(target.activeEffects?.map(effect => effect.spellId)).toEqual(['mage-armor']);
  }

  it('keeps the arc at the exact 60-foot boundary', () => {
    const characters = makeLinkedActors().map(character => (
      character.id === TARGET_ID
        ? { ...character, position: { x: 15, y: 5 } }
        : character
    ));
    const result = resolveWitchBoltLaterTurn({
      characters,
      mapData: makeMap(),
      casterId: CASTER_ID,
      targetId: TARGET_ID,
      currentTurn: LATER_TURN,
      choice: 'skip',
    });

    expect(result).toMatchObject({
      outcome: 'skipped',
      reason: 'skipped_optional_action',
      distanceFeet: 60,
    });
    expect(findCharacter(result.characters, CASTER_ID).concentratingOn?.spellId)
      .toBe('witch-bolt');
  });

  it('ends and cleans the arc beyond the boundary while preserving Mage Armor', () => {
    const characters = makeLinkedActors().map(character => {
      if (character.id === CASTER_ID) return { ...character, position: { x: 2, y: 5 } };
      if (character.id === TARGET_ID) return { ...character, position: { x: 15, y: 5 } };
      return character;
    });
    const result = resolveWitchBoltLaterTurn({
      characters,
      mapData: makeMap(),
      casterId: CASTER_ID,
      targetId: TARGET_ID,
      currentTurn: LATER_TURN,
      choice: 'activate',
    });

    expect(result).toMatchObject({
      outcome: 'ended',
      reason: 'target_out_of_range',
      distanceFeet: 65,
      cleanup: { statusEffects: 1, activeEffects: 1, concentrationLinks: 1 },
    });
    expectCleanArc(result.characters);
  });

  it('ends at Total Cover before spending the Bonus Action or dealing damage', () => {
    const result = resolveWitchBoltLaterTurn({
      characters: makeLinkedActors(),
      mapData: makeMap({ x: 6, y: 5 }),
      casterId: CASTER_ID,
      targetId: TARGET_ID,
      currentTurn: LATER_TURN,
      choice: 'activate',
      damageRng: fixedD12(6),
    });

    expect(result).toMatchObject({
      outcome: 'ended',
      reason: 'target_has_total_cover',
      damage: 0,
    });
    expect(findCharacter(result.characters, CASTER_ID).actionEconomy.bonusAction.used)
      .toBe(false);
    expectCleanArc(result.characters);
  });

  it('cleans the target link after concentration is lost', () => {
    const characters = makeLinkedActors().map(character => (
      character.id === CASTER_ID
        ? { ...character, concentratingOn: undefined }
        : character
    ));
    const result = resolveWitchBoltLaterTurn({
      characters,
      mapData: makeMap(),
      casterId: CASTER_ID,
      targetId: TARGET_ID,
      currentTurn: LATER_TURN,
      choice: 'skip',
    });

    expect(result).toMatchObject({ outcome: 'ended', reason: 'concentration_lost' });
    expectCleanArc(result.characters);
  });

  it('expires and cleans the arc at the one-minute boundary', () => {
    const result = resolveWitchBoltLaterTurn({
      characters: makeLinkedActors(),
      mapData: makeMap(),
      casterId: CASTER_ID,
      targetId: TARGET_ID,
      currentTurn: STARTED_TURN + WITCH_BOLT_DURATION_ROUNDS,
      choice: 'skip',
    });

    expect(result).toMatchObject({ outcome: 'ended', reason: 'duration_expired' });
    expectCleanArc(result.characters);
  });
});
