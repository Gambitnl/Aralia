/**
 * This file proves the production dungeon journey as one continuous state regression.
 *
 * It starts at a real Worldforge entrance, opens the canonical DungeonPlan, walks legal floor
 * cells, records one authored treasure interaction, follows the stable three-level links, and
 * reaches the generated deepest-boss objective. The test then emits the existing explicit
 * completion event, returns to the world, uses Aralia's ordinary save service, and revisits the
 * same dungeon without creating a second identity, lifecycle ledger, or storage path.
 *
 * Automatic combat and objective resolution remain outside this test because the mounted dungeon
 * does not implement them yet. Reaching and completing the stable objective is therefore recorded
 * explicitly before the authoritative DUNGEON_COMPLETED event is accepted by the world reducer.
 *
 * Called by: the focused Vitest dungeon verification lane.
 * Depends on: world entrance/runtime bridges, DungeonPlan movement and levels, the world reducer,
 * and the normal save/load service.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { AppAction } from '../../../../../state/actionTypes';
import { worldReducer } from '../../../../../state/reducers/worldReducer';
import * as SaveLoadService from '../../../../../services/saveLoadService';
import type { GameState } from '../../../../../types';
import { createMockGameState } from '../../../../../utils/core/factories';
import {
  createDungeonEntry,
  DUNGEON_ENTRY_INTERACTION_RADIUS_M,
  nearestEnterableDungeon,
  type DungeonWorldReturnContext,
} from '../../../../../components/World3D/dungeonEntryRuntime';
import { dungeonEntrancesForWindow } from '../../../bridge/dungeonEntrances';
import type { GroundDungeonEntrance } from '../../../bridge/groundChunkLoader';
import { getWorldforgeLocalForCell } from '../../../bridge/legacySubmapBridge';
import type { Cell, DungeonPlan } from '../../types';
import { canonicalDungeonId } from '../deriveIdentity';
import { enumerateDungeonSites } from '../dungeonSites';
import {
  canClaimDungeonTreasure,
  canClearDungeonEncounter,
  dungeonEncounterProgressPatch,
  dungeonObjectiveProgressPatch,
  dungeonPathBetweenCells,
  dungeonPathToTreasureInteraction,
  dungeonTreasureProgressPatch,
  findNextDungeonEncounterInteraction,
  findNextDungeonTreasureInteraction,
  moveDungeonPlayer,
  type DungeonMoveDirection,
} from '../dungeonGameplay';
import {
  buildDungeonLevelStack,
  DUNGEON_LEVEL_COUNT,
  dungeonLevelVisitReceipt,
} from '../dungeonLevels';
import {
  enterDungeonExpedition,
  type DungeonExpeditionRecord,
} from '../dungeonLifecycle';
import { dungeonCellKey } from '../dungeonMap';

// ============================================================================
// Canonical World Fixture
// ============================================================================
// The fixture asks the same world and ground bridges used by mounted play for a real entrance.
// No test-owned dungeon id, seed path, plan, objective, or level link is substituted.
// ============================================================================

const WORLD_SEED = 42;
const JOURNEY_SAVE_SLOT = 'dungeon_journey_integration';
const BROKEN_LINK_SAVE_SLOT = 'dungeon_journey_broken_link';

function realWorldEntrance(): GroundDungeonEntrance {
  const site = enumerateDungeonSites(WORLD_SEED).find((candidate) => candidate.origin === 'marker');
  if (!site) throw new Error('Dungeon journey test world has no marker-backed dungeon site.');

  const { local } = getWorldforgeLocalForCell(WORLD_SEED, site.cellId);
  const entrance = dungeonEntrancesForWindow(WORLD_SEED, local).find(
    (candidate) => candidate.sitePath === site.sitePath,
  );
  if (!entrance) throw new Error('Canonical dungeon site did not surface in its ground window.');
  return entrance;
}

function returnContextFor(entrance: GroundDungeonEntrance): DungeonWorldReturnContext {
  return {
    worldSeed: WORLD_SEED,
    cellId: entrance.cellId,
    tileX: 25,
    tileY: 16,
    xM: entrance.xM - 1.25,
    zM: entrance.zM + 0.75,
  };
}

// ============================================================================
// Journey Helpers
// ============================================================================
// These helpers apply the real reducer and one-cell movement functions. They keep the test focused
// on the player journey while preserving the same action and collision boundaries as production.
// ============================================================================

function applyWorldAction(state: GameState, action: AppAction): GameState {
  return { ...state, ...worldReducer(state, action) };
}

function directionBetween(from: Cell, to: Cell): DungeonMoveDirection {
  if (to.x === from.x && to.y === from.y - 1) return 'north';
  if (to.x === from.x + 1 && to.y === from.y) return 'east';
  if (to.x === from.x && to.y === from.y + 1) return 'south';
  if (to.x === from.x - 1 && to.y === from.y) return 'west';
  throw new Error('Canonical dungeon route contains a non-adjacent movement step.');
}

function walkCanonicalRoute(plan: DungeonPlan, start: Cell, target: Cell): Cell[] {
  const route = dungeonPathBetweenCells(plan, start, target);
  if (route.length === 0) throw new Error('Canonical dungeon journey has no legal floor route.');

  let player = { ...start };
  for (const next of route.slice(1)) {
    player = moveDungeonPlayer(plan, player, directionBetween(player, next));
    if (player.x !== next.x || player.y !== next.y) {
      throw new Error('Canonical dungeon movement rejected a planned floor step.');
    }
  }

  return route;
}

// ============================================================================
// Production Journey Regression
// ============================================================================

describe('production dungeon journey integration', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    SaveLoadService.refreshSaveSlotIndex();
  });

  it('enters, progresses, completes explicitly, exits, saves, loads, and revisits one dungeon', async () => {
    const entrance = realWorldEntrance();
    const returnContext = returnContextFor(entrance);
    const entry = createDungeonEntry(entrance, returnContext);
    const levels = buildDungeonLevelStack(entry.identity, entry.plan, WORLD_SEED);

    // Entry must carry the world-authored identity and exact return point into the canonical plan.
    expect(entry.identity).toEqual({
      dungeonId: canonicalDungeonId(entrance.sitePath),
      seedPath: entrance.sitePath,
    });
    expect(entry.returnContext).toEqual(returnContext);
    expect(levels).toHaveLength(DUNGEON_LEVEL_COUNT);
    expect(levels[0].plan).toBe(entry.plan);

    let state: GameState = { ...createMockGameState(), worldSeed: WORLD_SEED };
    state = applyWorldAction(state, {
      type: 'DUNGEON_ENTERED',
      payload: { identity: entry.identity },
    });

    // Walk the shared floor graph to one authored cache and report its stable interaction key to
    // the existing root ledger. This is the minimum currently supported gameplay interaction.
    let player = { ...levels[0].entryCell };
    const treasure = findNextDungeonTreasureInteraction(entry.plan, entry.identity, [], player);
    expect(treasure).not.toBeNull();
    if (!treasure) throw new Error('Canonical journey plan has no reachable treasure interaction.');

    const treasureRoute = dungeonPathToTreasureInteraction(entry.plan, player, treasure);
    expect(treasureRoute.length).toBeGreaterThan(1);
    player = walkCanonicalRoute(entry.plan, player, treasure.targetCell).at(-1)!;
    expect(canClaimDungeonTreasure(player, treasure)).toBe(true);
    state = applyWorldAction(state, {
      type: 'DUNGEON_PROGRESS_RECORDED',
      payload: {
        dungeonId: entry.identity.dungeonId,
        progress: dungeonTreasureProgressPatch(treasure),
      },
    });

    // Defeat one generated encounter with the same emitter the mounted preview uses. Its stable id
    // comes from the seeded spawn cell, so it must persist through save/load and the later revisit.
    const encounter = findNextDungeonEncounterInteraction(entry.plan, entry.identity, [], player);
    expect(encounter).not.toBeNull();
    if (!encounter) throw new Error('Canonical journey plan has no reachable encounter.');
    player = walkCanonicalRoute(entry.plan, player, encounter.targetCell).at(-1)!;
    expect(canClearDungeonEncounter(player, encounter)).toBe(true);
    state = applyWorldAction(state, {
      type: 'DUNGEON_PROGRESS_RECORDED',
      payload: {
        dungeonId: entry.identity.dungeonId,
        progress: dungeonEncounterProgressPatch(encounter),
      },
    });
    expect(
      state.dungeonExpeditions?.[entry.identity.dungeonId]?.progress.clearedEncounterIds,
    ).toEqual([encounter.eventId]);

    // Descend only through authored boss-room links. Every reached page stores its compact receipt,
    // opened transition id, and walked floor cells under the established lifecycle event.
    for (const level of levels) {
      const target = level.downTransition?.cell ?? level.bossObjective?.cell;
      if (!target) throw new Error(`Dungeon ${level.identity.levelId} has no onward journey target.`);
      const start = level.identity.depth === 0 ? player : level.entryCell;
      const route = walkCanonicalRoute(level.plan, start, target);
      player = route.at(-1)!;

      state = applyWorldAction(state, {
        type: 'DUNGEON_PROGRESS_RECORDED',
        payload: {
          dungeonId: entry.identity.dungeonId,
          progress: {
            openedRouteIds: level.downTransition ? [level.downTransition.id] : [],
            exploredCellKeysByLevel: {
              [level.identity.levelId]: route.map(dungeonCellKey),
            },
            levelVisits: {
              [level.identity.levelId]: dungeonLevelVisitReceipt(level),
            },
          },
        },
      });
    }

    const deepest = levels.at(-1)!;
    const objective = deepest.bossObjective;
    expect(objective).not.toBeNull();
    if (!objective) throw new Error('Deepest generated dungeon page has no stable boss objective.');
    expect(player).toEqual(objective.cell);

    // Combat is not implemented, so the test records the stable objective outcome explicitly. The
    // ledger remains incomplete until the separate authoritative completion event is dispatched;
    // reaching a preview marker alone therefore cannot silently clear the dungeon.
    state = applyWorldAction(state, {
      type: 'DUNGEON_PROGRESS_RECORDED',
      payload: {
        dungeonId: entry.identity.dungeonId,
        progress: dungeonObjectiveProgressPatch(objective.id),
      },
    });
    expect(state.dungeonExpeditions?.[entry.identity.dungeonId]?.completion).toBe('incomplete');

    state = applyWorldAction(state, {
      type: 'DUNGEON_COMPLETED',
      payload: { dungeonId: entry.identity.dungeonId },
    });
    expect(state.dungeonExpeditions?.[entry.identity.dungeonId]?.completion).toBe('completed');
    expect(state.clearedDungeons).toEqual([entry.identity.seedPath]);

    // Exit closes only the current visit. Completion, treasure, objective, route, and level
    // evidence remain in the same ledger before the ordinary save/load boundary is exercised.
    state = applyWorldAction(state, {
      type: 'DUNGEON_RETREATED',
      payload: { dungeonId: entry.identity.dungeonId },
    });
    expect(state.dungeonExpeditions?.[entry.identity.dungeonId]?.visitPhase).toBe('retreated');

    const saved = await SaveLoadService.saveGame(state, JOURNEY_SAVE_SLOT);
    expect(saved.success).toBe(true);
    const loaded = await SaveLoadService.loadGame(JOURNEY_SAVE_SLOT);
    expect(loaded.success).toBe(true);
    if (!loaded.data) throw new Error('Dungeon journey save loaded without game state.');

    const loadedRecord = loaded.data.dungeonExpeditions?.[entry.identity.dungeonId];
    expect(loadedRecord?.identity).toEqual(entry.identity);
    expect(loadedRecord?.completion).toBe('completed');
    expect(loadedRecord?.progress.claimedTreasureIds).toEqual([treasure.eventId]);
    expect(loadedRecord?.progress.clearedEncounterIds).toEqual([encounter.eventId]);
    expect(loadedRecord?.progress.objectives[objective.id]).toBe('completed');
    expect(Object.keys(loadedRecord?.progress.levelVisits ?? {})).toEqual([
      'level:0',
      'level:1',
      'level:2',
    ]);
    expect(loaded.data.clearedDungeons).toEqual([entry.identity.seedPath]);

    // Re-enter through the same world attachment, not a serialized plan. Regeneration must recover
    // the same root and child identities while the reducer advances only visit metadata.
    const revisitedEntry = createDungeonEntry(entrance, returnContext);
    const revisitedLevels = buildDungeonLevelStack(
      revisitedEntry.identity,
      revisitedEntry.plan,
      WORLD_SEED,
    );
    const revisitedState = applyWorldAction(loaded.data, {
      type: 'DUNGEON_ENTERED',
      payload: { identity: revisitedEntry.identity },
    });
    const revisitedRecord = revisitedState.dungeonExpeditions?.[entry.identity.dungeonId];

    expect(revisitedEntry.identity).toEqual(entry.identity);
    expect(Array.from(revisitedEntry.plan.grid)).toEqual(Array.from(entry.plan.grid));
    expect(revisitedLevels.map((level) => level.identity)).toEqual(
      levels.map((level) => level.identity),
    );
    expect(revisitedRecord).toMatchObject({
      identity: entry.identity,
      visitPhase: 'active',
      completion: 'completed',
      visitCount: 2,
      hasRevisited: true,
    });
    expect(revisitedRecord?.progress.claimedTreasureIds).toEqual([treasure.eventId]);
    expect(revisitedRecord?.progress.clearedEncounterIds).toEqual([encounter.eventId]);
    expect(revisitedRecord?.progress.objectives[objective.id]).toBe('completed');
    expect(revisitedState.clearedDungeons).toEqual([entry.identity.seedPath]);

    // A completed dungeon that is entered again must not silently reset: the cleared encounter is
    // still gone from the reachable list, so re-entry cannot resurrect defeated content.
    expect(
      findNextDungeonEncounterInteraction(
        revisitedEntry.plan,
        revisitedEntry.identity,
        revisitedRecord?.progress.clearedEncounterIds ?? [],
        revisitedLevels[0].entryCell,
      )?.eventId,
    ).not.toBe(encounter.eventId);
  }, 120_000);

  it('fails closed for missing world links, blocked routes, and malformed level ancestry', async () => {
    const entrance = realWorldEntrance();
    const returnContext = returnContextFor(entrance);

    // A stale entrance cannot fall back to a preview plan, and distance remains a hard product
    // boundary before entry is offered.
    expect(() => createDungeonEntry(
      { ...entrance, id: 'wf-dungeon-stale-journey-link' },
      returnContext,
    )).toThrow(/identity mismatch/i);
    expect(nearestEnterableDungeon(
      [entrance],
      entrance.xM + DUNGEON_ENTRY_INTERACTION_RADIUS_M + 0.1,
      entrance.zM,
    )).toBeNull();

    const entry = createDungeonEntry(entrance, returnContext);
    const start = buildDungeonLevelStack(entry.identity, entry.plan, WORLD_SEED)[0].entryCell;

    // The floor authority returns no route to an out-of-bounds destination. Gameplay cannot use a
    // missing transition coordinate to teleport beyond DungeonPlan collision.
    expect(dungeonPathBetweenCells(entry.plan, start, { x: -1, y: -1 })).toEqual([]);

    const baseState: GameState = { ...createMockGameState(), worldSeed: WORLD_SEED };
    expect(worldReducer(baseState, {
      type: 'DUNGEON_COMPLETED',
      payload: { dungeonId: entry.identity.dungeonId },
    })).toEqual({});

    // A valid child identity with the wrong parent is still an invalid stack link. Save/load drops
    // that receipt instead of attaching level two directly to the surface during a revisit.
    const entered = enterDungeonExpedition(entry.identity);
    const childSeedPath = `${entry.identity.seedPath}/level:2`;
    const malformedRecord: DungeonExpeditionRecord = {
      ...entered,
      progress: {
        ...entered.progress,
        levelVisits: {
          'level:2': {
            levelId: 'level:2',
            depth: 2,
            identity: {
              dungeonId: canonicalDungeonId(childSeedPath),
              seedPath: childSeedPath,
            },
            parentLevelId: 'level:0',
            entryCellKey: '3,4',
          },
        },
      },
    };
    const malformedState: GameState = {
      ...baseState,
      dungeonExpeditions: { [entry.identity.dungeonId]: malformedRecord },
    };

    const saved = await SaveLoadService.saveGame(malformedState, BROKEN_LINK_SAVE_SLOT);
    expect(saved.success).toBe(true);
    const loaded = await SaveLoadService.loadGame(BROKEN_LINK_SAVE_SLOT);
    expect(loaded.success).toBe(true);
    expect(
      loaded.data?.dungeonExpeditions?.[entry.identity.dungeonId]?.progress.levelVisits,
    ).toEqual({});
  }, 120_000);
});
