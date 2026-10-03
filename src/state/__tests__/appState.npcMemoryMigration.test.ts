import { describe, expect, it } from 'vitest';
import { appReducer } from '../appState';
import {
  GamePhase,
  GoalStatus,
  SuspicionLevel,
  type GameState,
  type KnownFact,
  type NpcMemory,
} from '../../types';
import { createMockGameState } from '../../utils/core/factories';

/**
 * This file protects the deliberately narrow NPC-memory migration performed
 * when a saved game loads.
 *
 * The fixture combines a legacy NPC whose known facts are plain strings with a
 * current NPC carrying the full canonical memory shape. It proves that only the
 * known-fact compatibility fields change while social state and history survive.
 *
 * Called by: the focused Vitest state suite.
 * Depends on: appReducer's LOAD_GAME_SUCCESS path and the shared memory types.
 */

// ============================================================================
// LOAD_GAME_SUCCESS NPC-Memory Migration Fixture
// ============================================================================
// One load covers both accepted save generations so future migrations cannot
// quietly expand this lane into broad NPC-memory normalization.
// ============================================================================

describe('LOAD_GAME_SUCCESS NPC-memory migration policy', () => {
  it('migrates legacy strings and backfills structured facts without rewriting canonical memory', () => {
    const loadedGameTime = new Date(Date.UTC(351, 0, 4, 9, 30, 0));

    // These references represent current canonical state outside knownFacts.
    // Keeping the exact references after load proves this lane neither rebuilds
    // nor defaults social state, lightweight facts, or interaction history.
    const goals: NpcMemory['goals'] = [{
      id: 'goal-protect-market',
      description: 'Protect the night market',
      status: GoalStatus.Active,
    }];
    const lightweightFacts = ['The player paid their debt'];
    const interactions: NonNullable<NpcMemory['interactions']> = [{
      id: 'interaction-trade-1',
      date: 991,
      type: 'trade',
      summary: 'Bought winter supplies',
      attitudeChange: 2,
      significance: 4,
      witnesses: ['npc-witness'],
      emotion: 'trust',
    }];
    const discussedTopics = { winter_supplies: 991 };

    // Structured facts exercise a full backfill, a partial backfill, and a
    // fully current record that must pass through unchanged.
    const needsBoth: KnownFact = {
      id: 'fact-ritual',
      text: 'The player completed the warding ritual',
      source: 'witnessed',
      sourceNpcId: 'npc-witness',
      isPublic: false,
      timestamp: 880,
      strength: 8,
      lifespan: 30,
      factKey: 'player_completed_warding_ritual',
    };
    const needsSignificance: KnownFact = {
      id: 'fact-debt',
      text: 'The player paid their debt',
      source: 'direct',
      isPublic: true,
      timestamp: 900,
      strength: 3,
      lifespan: 90,
      sourceDiscoveryId: 'discovery-debt-ledger',
      confidence: 0.95,
    };
    const alreadyCanonical: KnownFact = {
      id: 'fact-market',
      text: 'The player protects the night market',
      source: 'told_by_player',
      isPublic: false,
      timestamp: 940,
      strength: 6,
      lifespan: 120,
      confidence: 0.4,
      significance: 9,
    };

    const currentMemory: NpcMemory = {
      disposition: -17,
      knownFacts: [needsBoth, needsSignificance, alreadyCanonical],
      suspicion: SuspicionLevel.Suspicious,
      goals,
      facts: lightweightFacts,
      lastInteractionTimestamp: 995,
      interactions,
      attitude: 23,
      discussedTopics,
      lastInteractionDate: '351-01-04T09:15:00Z',
    };

    // Legacy string facts intentionally violate today's GameState type. The
    // one boundary cast models serialized saves without weakening production types.
    const legacyMemory = {
      disposition: 12,
      knownFacts: ['The player knows the old watchword'],
      suspicion: SuspicionLevel.Unaware,
      goals: [],
      facts: ['The player arrived before dawn'],
      lastInteractionTimestamp: 700,
      interactions: [],
      lastInteractionDate: 700,
    };
    const npcMemory = {
      'npc-legacy': legacyMemory,
      'npc-current': currentMemory,
    } as unknown as GameState['npcMemory'];
    const loadedState = createMockGameState({
      phase: GamePhase.PLAYING,
      gameTime: loadedGameTime,
      npcMemory,
    });

    const result = appReducer(createMockGameState({ phase: GamePhase.MAIN_MENU }), {
      type: 'LOAD_GAME_SUCCESS',
      payload: loadedState,
    });

    // Legacy strings become complete canonical facts and then receive the same
    // strength-derived optional values as older structured records.
    expect(result.npcMemory['npc-legacy'].knownFacts).toEqual([
      {
        id: expect.any(String),
        text: 'The player knows the old watchword',
        source: 'direct',
        isPublic: true,
        timestamp: loadedGameTime.getTime(),
        strength: 5,
        lifespan: 999,
        confidence: 0.5,
        significance: 5,
      },
    ]);

    // Structured facts keep all saved identity and content. Missing optional
    // values alone are derived from strength, while supplied values win.
    const migratedFacts = result.npcMemory['npc-current'].knownFacts;
    expect(migratedFacts).toEqual([
      { ...needsBoth, confidence: 0.8, significance: 8 },
      { ...needsSignificance, significance: 3 },
      alreadyCanonical,
    ]);
    expect(migratedFacts[2]).toBe(alreadyCanonical);

    // Every canonical memory field outside knownFacts remains the loaded value
    // and reference; this lane must never become a general defaulting pass.
    const migratedCurrentMemory = result.npcMemory['npc-current'];
    expect(migratedCurrentMemory.disposition).toBe(-17);
    expect(migratedCurrentMemory.suspicion).toBe(SuspicionLevel.Suspicious);
    expect(migratedCurrentMemory.goals).toBe(goals);
    expect(migratedCurrentMemory.facts).toBe(lightweightFacts);
    expect(migratedCurrentMemory.lastInteractionTimestamp).toBe(995);
    expect(migratedCurrentMemory.interactions).toBe(interactions);
    expect(migratedCurrentMemory.attitude).toBe(23);
    expect(migratedCurrentMemory.discussedTopics).toBe(discussedTopics);
    expect(migratedCurrentMemory.lastInteractionDate).toBe('351-01-04T09:15:00Z');
  });
});
