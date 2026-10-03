/**
 * This file proves that the shared world reducer owns dungeon lifecycle persistence.
 *
 * It dispatches the public entry, progress, retreat, completion, and revisit actions against a
 * normal mock GameState. The same progress action now carries per-level parchment discovery and
 * compact child identity/parent-return evidence. Completion also updates the established ecology list, so danger and
 * raid-pressure consumers do not diverge from the expedition ledger.
 *
 * Called by: the focused dungeon lifecycle Vitest verification lane.
 * Depends on: worldReducer, the canonical dungeon identity helper, and the shared state factory.
 */

// ============================================================================
// Test Dependencies
// ============================================================================

import { describe, expect, it } from 'vitest';
import { worldReducer } from '../worldReducer';
import { createMockGameState } from '../../../utils/core/factories';
import { canonicalDungeonId } from '../../../systems/worldforge/dungeon/world/deriveIdentity';

// ============================================================================
// Reducer Lifecycle Contract
// ============================================================================

describe('worldReducer dungeon lifecycle', () => {
  it('keeps one canonical receipt through progress, retreat, completion, and revisit', () => {
    const seedPath = 'wf:42/cell:751/dungeon:reducer-proof';
    const identity = { dungeonId: canonicalDungeonId(seedPath), seedPath };
    const childSeedPath = `${seedPath}/level:1`;
    let state = createMockGameState();

    // Entry creates the only receipt. Each later action addresses that same canonical dungeon id.
    state = {
      ...state,
      ...worldReducer(state, { type: 'DUNGEON_ENTERED', payload: { identity } }),
    };
    state = {
      ...state,
      ...worldReducer(state, {
        type: 'DUNGEON_PROGRESS_RECORDED',
        payload: {
          dungeonId: identity.dungeonId,
          progress: {
            clearedEncounterIds: ['encounter:gate'],
            openedRouteIds: ['route:gate'],
            claimedTreasureIds: ['treasure:gate-key'],
            objectives: { 'objective:open-gate': 'completed' },
            exploredCellKeysByLevel: { 'level:0': ['8,9', '9,9'] },
            levelVisits: {
              'level:1': {
                levelId: 'level:1',
                depth: 1,
                identity: {
                  dungeonId: canonicalDungeonId(childSeedPath),
                  seedPath: childSeedPath,
                },
                parentLevelId: 'level:0',
                entryCellKey: '3,4',
                parentReturnCellKey: '20,22',
              },
            },
          },
        },
      }),
    };
    state = {
      ...state,
      ...worldReducer(state, {
        type: 'DUNGEON_RETREATED',
        payload: { dungeonId: identity.dungeonId },
      }),
    };
    state = {
      ...state,
      ...worldReducer(state, {
        type: 'DUNGEON_COMPLETED',
        payload: { dungeonId: identity.dungeonId },
      }),
    };
    state = {
      ...state,
      ...worldReducer(state, { type: 'DUNGEON_ENTERED', payload: { identity } }),
    };

    const record = state.dungeonExpeditions?.[identity.dungeonId];
    expect(record).toMatchObject({
      identity,
      visitPhase: 'active',
      completion: 'completed',
      visitCount: 2,
      hasRevisited: true,
    });
    expect(record?.progress).toEqual({
      clearedEncounterIds: ['encounter:gate'],
      openedRouteIds: ['route:gate'],
      claimedTreasureIds: ['treasure:gate-key'],
      objectives: { 'objective:open-gate': 'completed' },
      exploredCellKeysByLevel: { 'level:0': ['8,9', '9,9'] },
      levelVisits: {
        'level:1': {
          levelId: 'level:1',
          depth: 1,
          identity: {
            dungeonId: canonicalDungeonId(childSeedPath),
            seedPath: childSeedPath,
          },
          parentLevelId: 'level:0',
          entryCellKey: '3,4',
          parentReturnCellKey: '20,22',
        },
      },
    });
    expect(state.clearedDungeons).toEqual([seedPath]);
  });

  it('refuses progress, retreat, or completion before canonical entry', () => {
    const state = createMockGameState();

    expect(
      worldReducer(state, {
        type: 'DUNGEON_PROGRESS_RECORDED',
        payload: { dungeonId: 'missing', progress: { openedRouteIds: ['route:orphan'] } },
      }),
    ).toEqual({});
    expect(
      worldReducer(state, { type: 'DUNGEON_RETREATED', payload: { dungeonId: 'missing' } }),
    ).toEqual({});
    expect(
      worldReducer(state, { type: 'DUNGEON_COMPLETED', payload: { dungeonId: 'missing' } }),
    ).toEqual({});
  });
});
