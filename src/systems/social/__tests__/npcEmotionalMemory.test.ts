/**
 * @file src/systems/social/__tests__/npcEmotionalMemory.test.ts
 * Integration tests for the NPC Grudge & Bond System.
 *
 * These drive the real reducer (`npcReducer`) over a real `GameState.npcMemory`
 * slice rather than calling the model helpers in isolation, so each test proves
 * the marker survives the dispatch path an encounter would actually use.
 */

import { describe, it, expect } from 'vitest';
import { npcReducer } from '../../../state/reducers/npcReducer';
import type { AppAction } from '../../../state/actionTypes';
import type { GameState } from '../../../types';
import { createEmptyMemory } from '../../../utils/world/memoryUtils';
import {
  createEmotionalMarker,
  deriveEmotionalEffects,
  getEmotionalMarkers,
  getEmotionalStanding,
  effectiveIntensity,
  describeEmotionalMemory,
  GRUDGE_HALF_LIFE_DAYS,
  BOND_HALF_LIFE_DAYS,
  BOND_DIALOGUE_THRESHOLD,
  BOND_QUEST_HOOK_THRESHOLD,
} from '../npcEmotionalMemory';

const MERCHANT = 'npc-merchant-brannic';
const GUARD = 'npc-guard-selle';

/** A minimal but real state slice: two NPCs with canonical empty memories. */
const makeState = (): GameState =>
  ({
    npcMemory: {
      [MERCHANT]: createEmptyMemory(),
      [GUARD]: createEmptyMemory(),
    },
  }) as unknown as GameState;

/** Applies actions in sequence, folding each reducer patch back into state. */
const dispatchAll = (state: GameState, actions: AppAction[]): GameState =>
  actions.reduce((acc, action) => ({ ...acc, ...npcReducer(acc, action) }), state);

const record = (npcId: string, marker: ReturnType<typeof createEmotionalMarker>): AppAction => ({
  type: 'RECORD_NPC_EMOTIONAL_MARKER',
  payload: { npcId, marker },
});

describe('NPC Grudge & Bond System', () => {
  it('persists grudges across encounters and raises combat aggression', () => {
    // Encounter 1 (day 5): the player kills the guard's friend.
    let state = dispatchAll(makeState(), [
      record(GUARD, createEmotionalMarker('killed_friend', 5, { subjectId: 'npc-sworn-brother' })),
    ]);

    // Encounter 2 (day 8): an unrelated interaction with the merchant. The guard's
    // memory must not be disturbed by other NPCs being updated.
    state = dispatchAll(state, [record(MERCHANT, createEmotionalMarker('generous_gift', 8))]);

    const markers = getEmotionalMarkers(state.npcMemory[GUARD]);
    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({
      type: 'grudge',
      trigger: 'killed_friend',
      intensity: 9,
      created_at: 5,
      subjectId: 'npc-sworn-brother',
    });

    // Encounter 3 (day 12): the guard meets the player again, still furious.
    const effects = deriveEmotionalEffects(state.npcMemory[GUARD], 12);
    expect(effects.standing.grudge).toBeGreaterThan(7);
    expect(effects.standing.bond).toBe(0);
    expect(effects.combatAggression).toBeGreaterThan(0.7);
    expect(effects.willInitiateHostility).toBe(true);

    // The merchant's own marker is untouched and is a bond, not a grudge.
    expect(getEmotionalMarkers(state.npcMemory[MERCHANT])).toHaveLength(1);
    expect(deriveEmotionalEffects(state.npcMemory[MERCHANT], 12).standing.grudge).toBe(0);
  });

  it('unlocks bond dialogue and quest hooks as bond triggers accumulate', () => {
    // Day 1: a small gift (intensity 3) is below the dialogue threshold.
    let state = dispatchAll(makeState(), [record(MERCHANT, createEmotionalMarker('generous_gift', 1))]);
    let effects = deriveEmotionalEffects(state.npcMemory[MERCHANT], 1);
    expect(effects.standing.bond).toBeCloseTo(3, 5);
    expect(effects.standing.bond).toBeLessThan(BOND_DIALOGUE_THRESHOLD);
    expect(effects.unlocksUniqueDialogue).toBe(false);
    expect(effects.unlocksQuestHooks).toBe(false);

    // Day 2: finishing their quest (5) pushes past unique dialogue but that alone
    // would already clear the quest-hook bar, so check both gates move together.
    state = dispatchAll(state, [record(MERCHANT, createEmotionalMarker('completed_quest', 2))]);
    effects = deriveEmotionalEffects(state.npcMemory[MERCHANT], 2);
    expect(effects.standing.bond).toBeGreaterThanOrEqual(BOND_QUEST_HOOK_THRESHOLD);
    expect(effects.unlocksUniqueDialogue).toBe(true);
    expect(effects.unlocksQuestHooks).toBe(true);

    // Day 3: saving their life caps the standing at the 10 ceiling.
    state = dispatchAll(state, [record(MERCHANT, createEmotionalMarker('saved_life', 3))]);
    expect(getEmotionalStanding(state.npcMemory[MERCHANT], 3).bond).toBe(10);

    // The AI prompt line reflects the strongest live marker first.
    const lines = describeEmotionalMemory(state.npcMemory[MERCHANT], 3);
    expect(lines[0]).toContain('BOND');
    expect(lines[0]).toContain('You saved their life.');
  });

  it('halves grudges every 30 game days and bonds every 90', () => {
    const day = 100;
    const state = dispatchAll(makeState(), [
      record(GUARD, createEmotionalMarker('threatened_family', day)), // grudge, intensity 8
      record(MERCHANT, createEmotionalMarker('saved_life', day)), // bond, intensity 9
    ]);

    const grudge = getEmotionalMarkers(state.npcMemory[GUARD])[0];
    const bond = getEmotionalMarkers(state.npcMemory[MERCHANT])[0];

    // One half-life each.
    expect(effectiveIntensity(grudge, day + GRUDGE_HALF_LIFE_DAYS)).toBeCloseTo(4, 5);
    expect(effectiveIntensity(bond, day + BOND_HALF_LIFE_DAYS)).toBeCloseTo(4.5, 5);

    // Two half-lives each.
    expect(effectiveIntensity(grudge, day + 2 * GRUDGE_HALF_LIFE_DAYS)).toBeCloseTo(2, 5);
    expect(effectiveIntensity(bond, day + 2 * BOND_HALF_LIFE_DAYS)).toBeCloseTo(2.25, 5);

    // Over the SAME 90-day span the grudge fades far faster than the bond, which
    // is the design point: injuries cool, kindness lingers.
    const grudgeAfter90 = effectiveIntensity(grudge, day + 90);
    const bondAfter90 = effectiveIntensity(bond, day + 90);
    expect(grudgeAfter90).toBeCloseTo(1, 5);
    expect(bondAfter90).toBeCloseTo(4.5, 5);
    expect(grudgeAfter90).toBeLessThan(bondAfter90);

    // Decay never runs backwards before the marker existed.
    expect(effectiveIntensity(grudge, day - 10)).toBe(8);
  });

  it('marks prices up for a grudging merchant and down for a bonded one', () => {
    const state = dispatchAll(makeState(), [
      record(MERCHANT, createEmotionalMarker('stole_from_them', 20)), // grudge 5
      record(GUARD, createEmotionalMarker('defended_honor', 20)), // bond 6
    ]);

    const wronged = deriveEmotionalEffects(state.npcMemory[MERCHANT], 20);
    const befriended = deriveEmotionalEffects(state.npcMemory[GUARD], 20);

    // NOTE: the task body says grudges "decrease shop prices"; implemented as the
    // intent (a grudging merchant charges the player MORE) and flagged in the result.
    expect(wronged.shopPriceMultiplier).toBeCloseTo(1.15, 4); // 1 + 5 * 0.03
    expect(befriended.shopPriceMultiplier).toBeCloseTo(0.88, 4); // 1 - 6 * 0.02
    expect(wronged.shopPriceMultiplier).toBeGreaterThan(befriended.shopPriceMultiplier);

    // A neutral NPC with no markers trades at face value.
    const neutral = deriveEmotionalEffects(createEmptyMemory(), 20);
    expect(neutral.shopPriceMultiplier).toBe(1);
    expect(neutral.combatAggression).toBe(0);
    expect(neutral.unlocksUniqueDialogue).toBe(false);

    // As the grudge decays the markup relaxes back toward neutral.
    const later = deriveEmotionalEffects(state.npcMemory[MERCHANT], 20 + 3 * GRUDGE_HALF_LIFE_DAYS);
    expect(later.shopPriceMultiplier).toBeLessThan(wronged.shopPriceMultiplier);
    expect(later.shopPriceMultiplier).toBeGreaterThan(1);
  });

  it('reinforces repeat offenses, prunes forgotten markers, and survives a save round trip', () => {
    // Two thefts on the same merchant must not become two markers.
    let state = dispatchAll(makeState(), [
      record(MERCHANT, createEmotionalMarker('stole_from_them', 10)),
      record(MERCHANT, createEmotionalMarker('stole_from_them', 40)),
    ]);

    const markers = getEmotionalMarkers(state.npcMemory[MERCHANT]);
    expect(markers).toHaveLength(1);
    // Day-10 grudge of 5 has halved to 2.5 by day 40, then +5 for the new theft.
    expect(markers[0].intensity).toBeCloseTo(7.5, 5);
    expect(markers[0].created_at).toBe(40);

    // A stale, trivial bond that should be forgotten, next to the live grudge.
    state = dispatchAll(state, [
      record(GUARD, createEmotionalMarker('generous_gift', 0, { decay_rate: 1 })),
    ]);
    expect(getEmotionalMarkers(state.npcMemory[GUARD])).toHaveLength(1);

    state = dispatchAll(state, [{ type: 'PRUNE_NPC_EMOTIONAL_MARKERS', payload: { gameDay: 60 } }]);
    expect(getEmotionalMarkers(state.npcMemory[GUARD])).toHaveLength(0);
    expect(getEmotionalMarkers(state.npcMemory[MERCHANT])).toHaveLength(1);

    // Pruning again changes nothing, so the store keeps its reference.
    const before = state.npcMemory;
    state = dispatchAll(state, [{ type: 'PRUNE_NPC_EMOTIONAL_MARKERS', payload: { gameDay: 60 } }]);
    expect(state.npcMemory).toBe(before);

    // Markers are plain data: they serialize and reload without losing behavior.
    const reloaded = JSON.parse(JSON.stringify(state.npcMemory)) as GameState['npcMemory'];
    expect(deriveEmotionalEffects(reloaded[MERCHANT], 60)).toEqual(
      deriveEmotionalEffects(state.npcMemory[MERCHANT], 60)
    );

    // Recording against an unregistered NPC is a no-op, not a crash.
    expect(
      npcReducer(state, record('npc-does-not-exist', createEmotionalMarker('saved_life', 60)))
    ).toEqual({});
  });
});
