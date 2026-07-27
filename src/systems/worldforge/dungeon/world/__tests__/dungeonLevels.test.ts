/**
 * This file proves deterministic descent and return across one canonical dungeon level stack.
 *
 * It resolves a real world entrance, regenerates all three pages through the existing DungeonPlan
 * generator, walks the canonical floor graph to each descent, and checks that ascent points back to
 * the exact parent coordinate. The deepest objective must occupy authored boss floor. A lifecycle
 * round trip then proves level identities, parent links, and isolated page ink survive save/load
 * and revisit without a second generator or storage owner.
 */

import { describe, expect, it } from 'vitest';
import { CellKind } from '../../types';
import { dungeonIdentityForSite, generateDungeonForIdentity } from '../deriveIdentity';
import { enumerateDungeonSites } from '../dungeonSites';
import {
  buildDungeonLevelStack,
  dungeonLevelVisitReceipt,
} from '../dungeonLevels';
import { dungeonPathBetweenCells } from '../dungeonGameplay';
import {
  enterDungeonExpedition,
  normalizeDungeonExpeditionLedger,
  recordDungeonProgress,
  retreatDungeonExpedition,
} from '../dungeonLifecycle';

// ============================================================================
// Canonical World Fixture
// ============================================================================
// A real site exercises the same identity resolution and world-derived parameters as mounted play.
// ============================================================================

const WORLD_SEED = 42;
const SITE = enumerateDungeonSites(WORLD_SEED)[0];
if (!SITE) throw new Error('Multi-level test world has no canonical dungeon site.');
const ROOT_IDENTITY = dungeonIdentityForSite(SITE);
const SURFACE_PLAN = generateDungeonForIdentity(ROOT_IDENTITY, WORLD_SEED);

function floorKind(level: ReturnType<typeof buildDungeonLevelStack>[number], x: number, y: number) {
  return level.plan.grid[y * level.plan.W + x];
}

// ============================================================================
// Descent, Return, and Durable Page Evidence
// ============================================================================

describe('canonical multi-level dungeon stack', () => {
  it('regenerates stable child identities and links every ascent to its parent stair', () => {
    const levels = buildDungeonLevelStack(ROOT_IDENTITY, SURFACE_PLAN, WORLD_SEED);
    const repeated = buildDungeonLevelStack(ROOT_IDENTITY, SURFACE_PLAN, WORLD_SEED);

    expect(levels).toHaveLength(3);
    expect(levels.map((level) => level.identity)).toEqual(
      repeated.map((level) => level.identity),
    );
    expect(levels[0].identity.seedPath).toBe(ROOT_IDENTITY.seedPath);
    expect(levels[1].identity.seedPath).toBe(`${ROOT_IDENTITY.seedPath}/level:1`);
    expect(levels[2].identity.seedPath).toBe(`${ROOT_IDENTITY.seedPath}/level:2`);

    for (const level of levels.slice(0, -1)) {
      expect(level.downTransition).not.toBeNull();
      if (!level.downTransition) throw new Error('Non-deepest level has no descent.');
      expect(floorKind(level, level.downTransition.cell.x, level.downTransition.cell.y)).toBe(
        CellKind.Floor,
      );
      expect(dungeonPathBetweenCells(level.plan, level.entryCell, level.downTransition.cell)).not.toEqual([]);
    }

    // Each child starts at authored entrance floor and points back to the exact descent coordinate
    // on its parent. This is the stable round trip used by the mounted overlay.
    for (const child of levels.slice(1)) {
      const parent = levels[child.identity.depth - 1];
      expect(child.identity.parentLevelId).toBe(parent.identity.levelId);
      expect(child.parentReturnCell).toEqual(parent.downTransition?.cell);
      expect(child.upTransition?.cell).toEqual(child.entryCell);
    }

    const deepest = levels.at(-1)!;
    expect(deepest.downTransition).toBeNull();
    expect(deepest.bossObjective?.roomId).toBe(deepest.plan.bossId);
    expect(deepest.plan.rooms.find((room) => room.id === deepest.bossObjective?.roomId)?.type).toBe('boss');
    expect(floorKind(deepest, deepest.bossObjective!.cell.x, deepest.bossObjective!.cell.y)).toBe(
      CellKind.Floor,
    );
  });

  it('preserves parent receipts and isolated level pages through save/load and revisit', () => {
    const levels = buildDungeonLevelStack(ROOT_IDENTITY, SURFACE_PLAN, WORLD_SEED);
    const entered = enterDungeonExpedition(ROOT_IDENTITY);
    const progressed = recordDungeonProgress(entered, {
      openedRouteIds: levels.slice(0, -1).map((level) => level.downTransition!.id),
      levelVisits: Object.fromEntries(levels.map((level) => [
        level.identity.levelId,
        dungeonLevelVisitReceipt(level),
      ])),
      exploredCellKeysByLevel: {
        'level:0': ['1,1'],
        'level:1': ['2,2', '2,3'],
        'level:2': ['3,3', '3,4', '3,5'],
      },
    });

    const loaded = normalizeDungeonExpeditionLedger(JSON.parse(JSON.stringify({
      [ROOT_IDENTITY.dungeonId]: retreatDungeonExpedition(progressed),
    })))[ROOT_IDENTITY.dungeonId];
    const revisited = enterDungeonExpedition(ROOT_IDENTITY, loaded);

    expect(Object.keys(revisited.progress.levelVisits)).toEqual(['level:0', 'level:1', 'level:2']);
    expect(revisited.progress.levelVisits['level:2'].parentLevelId).toBe('level:1');
    expect(revisited.progress.levelVisits['level:1'].parentReturnCellKey).toBe(
      `${levels[0].downTransition!.cell.x},${levels[0].downTransition!.cell.y}`,
    );
    expect(revisited.progress.exploredCellKeysByLevel).toEqual({
      'level:0': ['1,1'],
      'level:1': ['2,2', '2,3'],
      'level:2': ['3,3', '3,4', '3,5'],
    });
    expect(revisited.visitCount).toBe(2);
    expect(revisited.hasRevisited).toBe(true);
  });
});
