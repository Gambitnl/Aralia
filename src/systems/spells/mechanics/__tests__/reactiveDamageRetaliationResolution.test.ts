/**
 * This file proves the post-HP Hellish Rebuke transaction in isolation.
 *
 * The fixture starts after triggering damage has already changed HP. Tests
 * therefore catch any accidental second application while also covering choice,
 * event identity, targeting, resources, save order, defenses, and downing.
 *
 * Exercises: reactiveDamageRetaliationResolution.
 * Depends on: real line of sight, action economy, save, defense, and HP helpers.
 */

import { describe, expect, it } from 'vitest';
import type { SpellSlots } from '../../../../types';
import type { BattleMapData, BattleMapTile, CombatCharacter } from '../../../../types/combat';
import { resetEconomy } from '../../../../utils/combat/actionEconomyUtils';
import { createMockCombatCharacter } from '../../../../utils/core';
import {
  HELLISH_REBUKE_BASE_LEVEL,
  HELLISH_REBUKE_RANGE_FEET,
  getReactiveDamageRetaliationEligibility,
  resolveReactiveDamageRetaliation,
  type ReactiveDamageEvent,
} from '../reactiveDamageRetaliationResolution';

const ATTACKER_ID = 'reactive-test-attacker';
const RETALIATOR_ID = 'reactive-test-retaliator';
const EVENT_ID = 'reactive-test-event-1';

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
      const blocked = blockingPosition?.x === x && blockingPosition.y === y;
      const tile = makeTile(x, y, blocked);
      tiles.set(tile.id, tile);
    }
  }
  return { dimensions: { width: 16, height: 12 }, tiles, theme: 'dungeon', seed: 36 };
}

function makeLevelOneSpellSlots(current = 1): SpellSlots {
  return {
    level_1: { current, max: 1 },
    level_2: { current: 0, max: 0 },
    level_3: { current: 0, max: 0 },
    level_4: { current: 0, max: 0 },
    level_5: { current: 0, max: 0 },
    level_6: { current: 0, max: 0 },
    level_7: { current: 0, max: 0 },
    level_8: { current: 0, max: 0 },
    level_9: { current: 0, max: 0 },
  };
}

function makeActors(): { attacker: CombatCharacter; retaliator: CombatCharacter } {
  const attacker = resetEconomy(createMockCombatCharacter({
    id: ATTACKER_ID,
    name: 'Blade Initiate',
    position: { x: 7, y: 5 },
    team: 'player',
    currentHP: 30,
    maxHP: 30,
  }));
  attacker.stats.dexterity = 10;
  attacker.savingThrowProficiencies = [];

  // HP 28 is already the post-damage state described by makeEvent(). The
  // resolver must preserve it rather than subtracting the triggering 8 again.
  const retaliator = resetEconomy(createMockCombatCharacter({
    id: RETALIATOR_ID,
    name: 'Infernal Adept',
    position: { x: 2, y: 5 },
    team: 'enemy',
    level: 5,
    currentHP: 28,
    maxHP: 36,
    spellcastingAbility: 'charisma',
    spellSlots: makeLevelOneSpellSlots(),
  }));
  retaliator.stats.charisma = 16;
  return { attacker, retaliator };
}

function makeEvent(overrides: Partial<ReactiveDamageEvent> = {}): ReactiveDamageEvent {
  return {
    id: EVENT_ID,
    boundary: 'post_hp',
    sourceCharacterId: ATTACKER_ID,
    targetCharacterId: RETALIATOR_ID,
    isHit: true,
    rawDamage: 8,
    finalDamage: 8,
    damageType: 'Slashing',
    hpBefore: 36,
    hpAfter: 28,
    tempHPBefore: 0,
    tempHPAfter: 0,
    targetDownedAfter: false,
    targetIncapacitatedAfter: false,
    ...overrides,
  };
}

function fixedDie(face: number, sides: number): () => number {
  return () => (face - 0.5) / sides;
}

function resolve(overrides: Partial<Parameters<typeof resolveReactiveDamageRetaliation>[0]> = {}) {
  return resolveReactiveDamageRetaliation({
    ...makeActors(),
    mapData: makeMap(),
    event: makeEvent(),
    choice: 'accept',
    damageRng: fixedDie(6, 10),
    saveRng: fixedDie(5, 20),
    ...overrides,
  });
}

// ============================================================================
// Boundary, Choice, And Stable Identity
// ============================================================================

describe('reactive damage post-HP ownership', () => {
  it('reads canonical range/level and never reapplies the triggering hit', () => {
    const result = resolve();

    expect(HELLISH_REBUKE_RANGE_FEET).toBe(60);
    expect(HELLISH_REBUKE_BASE_LEVEL).toBe(1);
    expect(result).toMatchObject({
      outcome: 'resolved',
      triggeringDamage: { raw: 8, final: 8, hpBefore: 36, hpAfter: 28 },
      retaliator: { currentHP: 28 },
      attacker: { currentHP: 18 },
      retaliation: { rolledDamage: 12, damageAfterSave: 12, finalDamage: 12 },
    });
    expect(result.retaliator.actionEconomy.reaction.used).toBe(true);
    expect(result.retaliator.spellSlots?.level_1.current).toBe(0);
  });

  it('preserves both resources on decline and claims the event once', () => {
    const declined = resolve({ choice: 'decline' });

    expect(declined).toMatchObject({
      outcome: 'declined',
      reason: 'declined',
      attacker: { currentHP: 30 },
      retaliator: { currentHP: 28 },
      resolvedEventIds: [EVENT_ID],
    });
    expect(declined.retaliator.actionEconomy.reaction.used).toBe(false);
    expect(declined.retaliator.spellSlots?.level_1.current).toBe(1);
  });

  it('makes a duplicate event a complete no-op', () => {
    const first = resolve();
    const duplicate = resolveReactiveDamageRetaliation({
      attacker: first.attacker,
      retaliator: first.retaliator,
      mapData: makeMap(),
      event: makeEvent(),
      choice: 'accept',
      resolvedEventIds: first.resolvedEventIds,
      damageRng: fixedDie(6, 10),
      saveRng: fixedDie(5, 20),
    });

    expect(duplicate.reason).toBe('duplicate_event');
    expect(duplicate.attacker.currentHP).toBe(18);
    expect(duplicate.retaliator.currentHP).toBe(28);
    expect(duplicate.retaliator.spellSlots?.level_1.current).toBe(0);
  });

  it('rejects mismatched source/target ownership before payment', () => {
    const result = resolve({ event: makeEvent({ sourceCharacterId: 'wrong-source' }) });
    expect(result.reason).toBe('invalid_event_ownership');
    expect(result.retaliator.actionEconomy.reaction.used).toBe(false);
  });
});

// ============================================================================
// Eligibility Without A False Prompt
// ============================================================================

describe('reactive damage eligibility boundaries', () => {
  it.each([
    ['miss', makeEvent({ id: 'miss', isHit: false }), 'attack_missed'],
    ['zero damage', makeEvent({ id: 'zero', finalDamage: 0, hpAfter: 36 }), 'no_triggering_damage'],
    ['downed', makeEvent({ id: 'downed', hpAfter: 0, targetDownedAfter: true }), 'retaliator_downed'],
    ['incapacitated', makeEvent({ id: 'incap', targetIncapacitatedAfter: true }), 'retaliator_incapacitated'],
  ] as const)('rejects %s from post-HP event facts', (_label, event, reason) => {
    const result = resolve({ event });
    expect(result.reason).toBe(reason);
    expect(result.attacker.currentHP).toBe(30);
    expect(result.retaliator.actionEconomy.reaction.used).toBe(false);
  });

  it('rejects beyond 60 feet, blocked sight, a spent Reaction, and an empty slot', () => {
    const actors = makeActors();
    const far = resolve({ attacker: { ...actors.attacker, position: { x: 15, y: 5 } } });
    const blocked = resolve({ mapData: makeMap({ x: 4, y: 5 }) });
    const spent = resolve({
      retaliator: {
        ...actors.retaliator,
        actionEconomy: {
          ...actors.retaliator.actionEconomy,
          reaction: { ...actors.retaliator.actionEconomy.reaction, used: true },
        },
      },
    });
    const empty = resolve({
      retaliator: { ...actors.retaliator, spellSlots: makeLevelOneSpellSlots(0) },
    });

    expect(far.reason).toBe('attacker_out_of_range');
    expect(blocked.reason).toBe('attacker_not_visible');
    expect(spent.reason).toBe('reaction_or_slot_unavailable');
    expect(empty.reason).toBe('reaction_or_slot_unavailable');
    expect([far, blocked, spent, empty].every(result => result.attacker.currentHP === 30)).toBe(true);
  });

  it('allows mapless combat but rejects a populated map with missing actor tiles', () => {
    const actors = makeActors();
    const mapless = getReactiveDamageRetaliationEligibility({
      ...actors,
      mapData: null,
      event: makeEvent(),
    });
    const incomplete = getReactiveDamageRetaliationEligibility({
      ...actors,
      mapData: { ...makeMap(), tiles: new Map() },
      event: makeEvent(),
    });

    expect(mapless.eligible).toBe(true);
    expect(incomplete.reason).toBe('missing_map_tile');
  });
});

// ============================================================================
// Save, Defense, And Retaliation Downing
// ============================================================================

describe('reactive damage retaliation pipeline', () => {
  it('halves a successful Dexterity save before Fire resistance', () => {
    const actors = makeActors();
    const result = resolve({
      attacker: { ...actors.attacker, resistances: ['Fire'] },
      saveRng: fixedDie(18, 20),
    });

    expect(result.retaliation).toMatchObject({
      saveSucceeded: true,
      rolledDamage: 12,
      damageAfterSave: 6,
      finalDamage: 3,
      defense: 'resistance',
    });
  });

  it('applies immunity and shared attacker downing after the save', () => {
    const actors = makeActors();
    const immune = resolve({ attacker: { ...actors.attacker, immunities: ['Fire'] } });
    const fragile = resolve({ attacker: { ...actors.attacker, currentHP: 10, maxHP: 10 } });

    expect(immune.retaliation).toMatchObject({ finalDamage: 0, defense: 'immunity' });
    expect(fragile.retaliation).toMatchObject({ finalDamage: 12, hpAfter: 0, attackerDowned: true });
    expect(fragile.attacker.conditions?.map(condition => condition.name)).toContain('Unconscious');
  });
});
