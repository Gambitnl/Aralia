/**
 * This file proves the normal post-damage reaction queue around Hellish Rebuke.
 *
 * It covers discovery from character abilities, explicit accept/decline,
 * pre-prompt rejection, stable duplicate IDs, and depth-first nested ordering.
 * The resolver's focused tests own the detailed save and defense arithmetic.
 *
 * Exercises: postDamageReactionQueue.
 * Depends on: canonical spell ability creation and real combat character state.
 */

import { describe, expect, it, vi } from 'vitest';
import hellishRebukeData from '@/data/spells/level-1/hellish-rebuke.json';
import type { PlayerCharacter, SpellSlots } from '../../../../types';
import type { BattleMapData, BattleMapTile, CombatCharacter, CombatLogEntry } from '../../../../types/combat';
import type { Spell } from '../../../../types/spells';
import { createAbilityFromSpell } from '../../../../utils/character/spellAbilityFactory';
import { resetEconomy } from '../../../../utils/combat/actionEconomyUtils';
import { createMockCombatCharacter } from '../../../../utils/core';
import { resolvePostDamageReactionQueue } from '../postDamageReactionQueue';

const HELLISH_REBUKE = hellishRebukeData as unknown as Spell;

function makeSlots(current = 1): SpellSlots {
  return {
    level_1: { current, max: 1 }, level_2: { current: 0, max: 0 },
    level_3: { current: 0, max: 0 }, level_4: { current: 0, max: 0 },
    level_5: { current: 0, max: 0 }, level_6: { current: 0, max: 0 },
    level_7: { current: 0, max: 0 }, level_8: { current: 0, max: 0 },
    level_9: { current: 0, max: 0 },
  };
}

function makeActor(id: string, x: number, hp: number, ownsRebuke: boolean): CombatCharacter {
  const actor = resetEconomy(createMockCombatCharacter({
    id,
    name: id,
    position: { x, y: 1 },
    team: id === 'attacker' ? 'player' : 'enemy',
    level: 5,
    currentHP: hp,
    maxHP: 36,
    spellcastingAbility: 'charisma',
    spellSlots: makeSlots(),
  }));
  actor.stats.charisma = 16;
  actor.stats.dexterity = 10;
  actor.savingThrowProficiencies = [];
  actor.abilities = ownsRebuke
    ? [createAbilityFromSpell(HELLISH_REBUKE, actor as unknown as PlayerCharacter)]
    : [];
  return actor;
}

function makeMap(blocked = false): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let x = 0; x < 16; x += 1) {
    const wall = blocked && x === 3;
    const tile: BattleMapTile = {
      id: `${x}-1`, coordinates: { x, y: 1 }, terrain: wall ? 'wall' : 'floor',
      elevation: 0, movementCost: wall ? 0 : 5, blocksMovement: wall,
      blocksLoS: wall, decoration: null, effects: [],
    };
    tiles.set(tile.id, tile);
  }
  return { dimensions: { width: 16, height: 3 }, tiles, theme: 'dungeon', seed: 36 };
}

function makeDamageLog(overrides: Partial<NonNullable<CombatLogEntry['data']>> = {}): CombatLogEntry {
  return {
    id: 'damage-event-1',
    timestamp: 1,
    type: 'damage',
    message: 'attacker damages retaliator',
    characterId: 'retaliator',
    targetIds: ['retaliator'],
    data: {
      damageEventBoundary: 'post_hp',
      sourceCharacterId: 'attacker',
      targetCharacterId: 'retaliator',
      hitConfirmed: true,
      rawDamage: 8,
      finalDamage: 8,
      damageType: 'Slashing',
      hitPointsBefore: 36,
      hitPointsAfter: 28,
      temporaryHitPointsBefore: 0,
      temporaryHitPointsAfter: 0,
      targetDownedAfter: false,
      targetIncapacitatedAfter: false,
      ...overrides,
    },
  };
}

function fixedDie(face: number, sides: number): () => number {
  return () => (face - 0.5) / sides;
}

// ============================================================================
// Discovery, Choice, And Duplicate Ownership
// ============================================================================

describe('post-damage reaction queue choices', () => {
  it('discovers an owned Hellish Rebuke, prompts once, and resolves accepted damage', async () => {
    const requestReaction = vi.fn().mockResolvedValue('hellish-rebuke');
    const result = await resolvePostDamageReactionQueue({
      characters: [makeActor('attacker', 7, 30, false), makeActor('retaliator', 2, 28, true)],
      combatLog: [makeDamageLog()],
      mapData: makeMap(),
      processedEventIds: new Set(),
      requestReaction,
      damageRng: fixedDie(6, 10),
      saveRng: fixedDie(5, 20),
    });

    expect(requestReaction).toHaveBeenCalledWith(
      'attacker', 'retaliator', 'on_take_damage',
      [expect.objectContaining({ id: 'hellish-rebuke' })],
    );
    expect(result.characters.find(actor => actor.id === 'attacker')?.currentHP).toBe(18);
    expect(result.characters.find(actor => actor.id === 'retaliator')).toMatchObject({ currentHP: 28 });
    expect(result.characters.find(actor => actor.id === 'retaliator')?.actionEconomy.reaction.used).toBe(true);
    expect(result.logEntries[0].message).toContain('accepts Hellish Rebuke');
  });

  it('preserves resources and retaliation HP on explicit decline', async () => {
    const requestReaction = vi.fn().mockResolvedValue(null);
    const result = await resolvePostDamageReactionQueue({
      characters: [makeActor('attacker', 7, 30, false), makeActor('retaliator', 2, 28, true)],
      combatLog: [makeDamageLog()], mapData: makeMap(), processedEventIds: new Set(), requestReaction,
    });
    const retaliator = result.characters.find(actor => actor.id === 'retaliator');

    expect(result.receipts[0].reason).toBe('declined');
    expect(result.characters.find(actor => actor.id === 'attacker')?.currentHP).toBe(30);
    expect(retaliator?.actionEconomy.reaction.used).toBe(false);
    expect(retaliator?.spellSlots?.level_1.current).toBe(1);
  });

  it('claims the stable event before await and makes later delivery a no-op', async () => {
    const processedEventIds = new Set<string>();
    const requestReaction = vi.fn().mockResolvedValue('hellish-rebuke');
    const first = await resolvePostDamageReactionQueue({
      characters: [makeActor('attacker', 7, 30, false), makeActor('retaliator', 2, 28, true)],
      combatLog: [makeDamageLog()], mapData: makeMap(), processedEventIds, requestReaction,
      damageRng: fixedDie(6, 10), saveRng: fixedDie(5, 20),
    });
    const duplicate = await resolvePostDamageReactionQueue({
      characters: first.characters,
      combatLog: [makeDamageLog()], mapData: makeMap(), processedEventIds, requestReaction,
    });

    expect(requestReaction).toHaveBeenCalledTimes(1);
    expect(duplicate.receipts).toEqual([]);
    expect(duplicate.logEntries).toEqual([]);
    expect(duplicate.duplicateEventIds).toEqual(['damage-event-1']);
    expect(duplicate.characters.find(actor => actor.id === 'attacker')?.currentHP).toBe(18);
  });
});

// ============================================================================
// Rejection Before Prompt And Depth-First Nesting
// ============================================================================

describe('post-damage reaction queue ordering', () => {
  it('does not prompt for empty slot, invalid range, or blocked line of sight', async () => {
    const requestReaction = vi.fn().mockResolvedValue('hellish-rebuke');
    const emptyRetaliator = { ...makeActor('retaliator', 2, 28, true), spellSlots: makeSlots(0) };
    const farAttacker = makeActor('attacker', 15, 30, false);

    const empty = await resolvePostDamageReactionQueue({
      characters: [makeActor('attacker', 7, 30, false), emptyRetaliator],
      combatLog: [makeDamageLog()], mapData: makeMap(), processedEventIds: new Set(), requestReaction,
    });
    const far = await resolvePostDamageReactionQueue({
      characters: [farAttacker, makeActor('retaliator', 2, 28, true)],
      combatLog: [makeDamageLog()], mapData: makeMap(), processedEventIds: new Set(), requestReaction,
    });
    const blocked = await resolvePostDamageReactionQueue({
      characters: [makeActor('attacker', 7, 30, false), makeActor('retaliator', 2, 28, true)],
      combatLog: [makeDamageLog()], mapData: makeMap(true), processedEventIds: new Set(), requestReaction,
    });

    expect(requestReaction).not.toHaveBeenCalled();
    expect(empty.receipts[0].reason).toBe('reaction_or_slot_unavailable');
    expect(far.receipts[0].reason).toBe('attacker_out_of_range');
    expect(blocked.receipts[0].reason).toBe('attacker_not_visible');
  });

  it('places nested retaliation immediately before later sibling events', async () => {
    const prompts: string[] = [];
    const requestReaction = vi.fn(async (_source: string, target: string) => {
      prompts.push(target);
      return 'hellish-rebuke';
    });
    const sibling = {
      ...makeDamageLog({ sourceCharacterId: 'attacker', targetCharacterId: 'spectator' }),
      id: 'damage-event-2',
      characterId: 'spectator',
      targetIds: ['spectator'],
    };
    const spectator = makeActor('spectator', 4, 28, false);
    const result = await resolvePostDamageReactionQueue({
      characters: [makeActor('attacker', 7, 30, true), makeActor('retaliator', 2, 28, true), spectator],
      combatLog: [makeDamageLog(), sibling],
      mapData: makeMap(), processedEventIds: new Set(), requestReaction,
      damageRng: fixedDie(6, 10), saveRng: fixedDie(5, 20),
    });

    // The target of the root event reacts first. Its Fire damage creates a
    // derived event for the original attacker, which reacts before the queued
    // sibling event is inspected.
    expect(prompts).toEqual(['retaliator', 'attacker']);
    expect(result.receipts.map(receipt => [receipt.retaliator.id, receipt.reason])).toEqual([
      ['retaliator', 'resolved'],
      ['attacker', 'resolved'],
      ['retaliator', 'reaction_or_slot_unavailable'],
    ]);
    expect(result.processedEventIds).toEqual([
      'damage-event-1',
      'damage-event-1:hellish-rebuke:retaliator',
      'damage-event-1:hellish-rebuke:retaliator:hellish-rebuke:attacker',
      'damage-event-2',
    ]);
    expect(result.logEntries[0].id).toContain('damage-event-1:hellish-rebuke:retaliator');
    expect(result.logEntries[1].id).toContain('damage-event-1:hellish-rebuke:retaliator:hellish-rebuke:attacker');
  });
});
