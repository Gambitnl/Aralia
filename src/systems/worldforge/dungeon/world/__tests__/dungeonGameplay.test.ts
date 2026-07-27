/**
 * This file proves the first canonical dungeon gameplay path from movement to persistence.
 *
 * It uses one real generated plan, walks from the entrance to a reachable authored treasure room
 * on the generator's floor grid, and records its stable cache id through the established lifecycle
 * helpers. A retreat and revisit must retain that claimed treasure.
 *
 * Runs with: the focused Vitest command for dungeonGameplay.test.ts.
 */

import { describe, expect, it } from 'vitest';
import { generateDungeon } from '../../generateDungeon';
import type { Cell } from '../../types';
import { canonicalDungeonId, type DungeonIdentity } from '../dungeonIdentity';
import {
  enterDungeonExpedition,
  recordDungeonProgress,
  retreatDungeonExpedition,
} from '../dungeonLifecycle';
import {
  canClaimDungeonTreasure,
  canClearDungeonEncounter,
  dungeonEncounterEventId,
  dungeonEncounterProgressPatch,
  dungeonEntrancePlayerCell,
  dungeonPathToEncounterInteraction,
  dungeonPathToTreasureInteraction,
  dungeonSpawnCell,
  dungeonTreasureEventId,
  dungeonTreasureProgressPatch,
  findNextDungeonEncounterInteraction,
  findNextDungeonTreasureInteraction,
  moveDungeonPlayer,
  type DungeonMoveDirection,
} from '../dungeonGameplay';

// ============================================================================
// Canonical Generated Fixture
// ============================================================================
// A fixed sewer plan exercises long connected corridors and authored treasure rooms while the
// canonical identity matches the production entry receipt grammar.
// ============================================================================

const SEED_PATH = 'wf:1784445698735/burg:1/dungeon:sewer';
const IDENTITY: DungeonIdentity = {
  dungeonId: canonicalDungeonId(SEED_PATH),
  seedPath: SEED_PATH,
};

const PLAN_INPUT = {
  seed: 1784445698735,
  seedPath: SEED_PATH,
  params: {
    roomCount: 32,
    theme: 'sewer' as const,
    loopChance: 0.22,
    decorDensity: 0.55,
  },
};

const PLAN = generateDungeon(PLAN_INPUT);

function directionBetween(from: Cell, to: Cell): DungeonMoveDirection {
  if (to.x === from.x && to.y === from.y - 1) return 'north';
  if (to.x === from.x + 1 && to.y === from.y) return 'east';
  if (to.x === from.x && to.y === from.y + 1) return 'south';
  if (to.x === from.x - 1 && to.y === from.y) return 'west';
  throw new Error('Dungeon path contains a non-adjacent movement step.');
}

// ============================================================================
// Movement, Event Identity, and Lifecycle Proof
// ============================================================================

describe('canonical dungeon gameplay', () => {
  it('derives the same treasure event from the same canonical plan', () => {
    const regenerated = generateDungeon(PLAN_INPUT);
    const start = dungeonEntrancePlayerCell(PLAN);
    const repeatedStart = dungeonEntrancePlayerCell(regenerated);
    const treasure = findNextDungeonTreasureInteraction(PLAN, IDENTITY, [], start);
    const repeatedTreasure = findNextDungeonTreasureInteraction(
      regenerated,
      IDENTITY,
      [],
      repeatedStart,
    );

    // Identity comes from canonical receipt plus authored room id, so regeneration cannot create
    // a second cache key for the same generated treasure room.
    expect(treasure).not.toBeNull();
    expect(repeatedTreasure).toEqual(treasure);
    expect(treasure?.eventId).toBe(dungeonTreasureEventId(IDENTITY, treasure!.roomId));
  });

  it('walks real floor cells, claims one cache, and retains it on revisit', () => {
    let player = dungeonEntrancePlayerCell(PLAN);
    const treasure = findNextDungeonTreasureInteraction(PLAN, IDENTITY, [], player);
    expect(treasure).not.toBeNull();
    if (!treasure) throw new Error('Fixture has no reachable authored treasure room.');

    const path = dungeonPathToTreasureInteraction(PLAN, player, treasure);
    expect(path[0]).toEqual(player);
    expect(path.at(-1)).toEqual(treasure.targetCell);
    expect(path.length).toBeGreaterThan(1);

    // Apply the same one-cell directional action the mounted preview exposes. Every planned step
    // must be accepted without teleporting or crossing a wall.
    for (const next of path.slice(1)) {
      player = moveDungeonPlayer(PLAN, player, directionBetween(player, next));
      expect(player).toEqual(next);
    }

    expect(canClaimDungeonTreasure(player, treasure)).toBe(true);

    // The interaction emits a lifecycle patch rather than mutating its own local list. Retreat and
    // revisit therefore preserve the same cache id through the canonical expedition record.
    const entered = enterDungeonExpedition(IDENTITY);
    const claimed = recordDungeonProgress(entered, dungeonTreasureProgressPatch(treasure));
    const revisited = enterDungeonExpedition(IDENTITY, retreatDungeonExpedition(claimed));
    expect(claimed.progress.claimedTreasureIds).toEqual([treasure.eventId]);
    expect(revisited.progress.claimedTreasureIds).toEqual([treasure.eventId]);
    expect(
      findNextDungeonTreasureInteraction(
        PLAN,
        IDENTITY,
        revisited.progress.claimedTreasureIds,
        player,
      )?.eventId,
    ).not.toBe(treasure.eventId);
  });

  it('derives a stable encounter id from the generated spawn cell', () => {
    const regenerated = generateDungeon(PLAN_INPUT);
    const start = dungeonEntrancePlayerCell(PLAN);
    const repeatedStart = dungeonEntrancePlayerCell(regenerated);
    const encounter = findNextDungeonEncounterInteraction(PLAN, IDENTITY, [], start);
    const repeated = findNextDungeonEncounterInteraction(regenerated, IDENTITY, [], repeatedStart);

    // The fixture always carries at least one generated spawn, and its stable key comes from the
    // canonical receipt, authored room, and the spawn's own frozen grid cell.
    expect(PLAN.spawns.length).toBeGreaterThan(0);
    expect(encounter).not.toBeNull();
    if (!encounter) throw new Error('Fixture has no reachable encounter.');
    expect(repeated).toEqual(encounter);

    const spawn = PLAN.spawns.find((candidate) => candidate.roomId === encounter.roomId);
    expect(spawn).toBeDefined();
    expect(encounter.eventId).toBe(
      dungeonEncounterEventId(IDENTITY, encounter.roomId, dungeonSpawnCell(PLAN, spawn!)),
    );
  });

  it('walks to one generated encounter, clears it, and keeps it cleared on revisit', () => {
    let player = dungeonEntrancePlayerCell(PLAN);
    const encounter = findNextDungeonEncounterInteraction(PLAN, IDENTITY, [], player);
    expect(encounter).not.toBeNull();
    if (!encounter) throw new Error('Fixture has no reachable encounter.');

    const path = dungeonPathToEncounterInteraction(PLAN, player, encounter);
    expect(path[0]).toEqual(player);
    expect(path.at(-1)).toEqual(encounter.targetCell);
    expect(path.length).toBeGreaterThan(1);

    // Every planned step is accepted by the same one-cell collision rule, so the interaction cell is
    // genuinely reachable rather than an unreachable authored decoration.
    for (const next of path.slice(1)) {
      player = moveDungeonPlayer(PLAN, player, directionBetween(player, next));
      expect(player).toEqual(next);
    }
    expect(canClearDungeonEncounter(player, encounter)).toBe(true);

    const entered = enterDungeonExpedition(IDENTITY);
    const cleared = recordDungeonProgress(entered, dungeonEncounterProgressPatch(encounter));
    const revisited = enterDungeonExpedition(IDENTITY, retreatDungeonExpedition(cleared));
    expect(cleared.progress.clearedEncounterIds).toEqual([encounter.eventId]);
    expect(revisited.progress.clearedEncounterIds).toEqual([encounter.eventId]);

    // The cleared encounter never resurfaces as the next reachable one after revisit.
    expect(
      findNextDungeonEncounterInteraction(
        PLAN,
        IDENTITY,
        revisited.progress.clearedEncounterIds,
        player,
      )?.eventId,
    ).not.toBe(encounter.eventId);
  });
});
