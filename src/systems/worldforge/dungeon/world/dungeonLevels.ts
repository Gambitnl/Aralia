// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 21/07/2026, 01:45:42
 * Dependents: components/World3D/DungeonExpeditionOverlay.tsx
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file gives one world-grown dungeon a small deterministic stack of playable levels.
 *
 * Level zero keeps the entrance's existing identity and plan. Deeper levels append one stable
 * `level:<depth>` child to that frozen seed path, then call the same DungeonPlan generator with
 * the same world-derived parameters. Each child remembers its parent and the exact floor cells
 * used for descent and return. The final generated boss room becomes the only player-facing boss
 * objective; shallower boss rooms are used as stair destinations rather than inventing new rooms.
 *
 * A generated hoist, ladder shaft, or maintenance walk can truthfully expose a vertical sightline.
 * Other plans omit that annotation instead of receiving a decorative balcony with no data basis.
 * Combat resolution, falling damage, pit traversal, and dungeon completion remain deferred.
 *
 * Called by: DungeonExpeditionOverlay and focused multi-level tests.
 * Depends on: canonical root identity resolution, the existing generator, and shared floor helpers.
 */

import { childSeedPath } from '../../seedPath';
import { generateDungeon } from '../generateDungeon';
import type { Cell, DungeonPlan, RoomPurpose } from '../types';
import {
  deriveDungeonIdentity,
  generateDungeonForIdentity,
  resolveDungeonIdentity,
} from './deriveIdentity';
import {
  canonicalDungeonId,
  type DungeonIdentity,
} from './dungeonIdentity';
import {
  dungeonEntrancePlayerCell,
  dungeonRoomPlayerCell,
} from './dungeonGameplay';
import type { DungeonLevelVisitReceipt } from './dungeonLifecycle';
import { dungeonCellKey } from './dungeonMap';

// ============================================================================
// Stable Level Grammar
// ============================================================================
// Three pages provide a real descent, an intermediate return link, and a distinct deepest boss.
// The small fixed stack is intentionally explicit; arbitrary depth and streaming remain future work.
// ============================================================================

export const DUNGEON_LEVEL_COUNT = 3;

export function dungeonLevelId(depth: number): string {
  if (!Number.isInteger(depth) || depth < 0 || depth >= DUNGEON_LEVEL_COUNT) {
    throw new Error(`Dungeon level depth ${depth} is outside the supported stack.`);
  }
  return `level:${depth}`;
}

export interface DungeonLevelIdentity extends DungeonIdentity {
  rootDungeonId: string;
  levelId: string;
  depth: number;
  parentLevelId: string | null;
}

/** Derive a stable child receipt while preserving the entrance identity unchanged at level zero. */
export function dungeonLevelIdentity(
  rootIdentity: DungeonIdentity,
  depth: number,
): DungeonLevelIdentity {
  const levelId = dungeonLevelId(depth);
  const seedPath = depth === 0
    ? rootIdentity.seedPath
    : childSeedPath(rootIdentity.seedPath, levelId);

  return {
    dungeonId: depth === 0 ? rootIdentity.dungeonId : canonicalDungeonId(seedPath),
    seedPath,
    rootDungeonId: rootIdentity.dungeonId,
    levelId,
    depth,
    parentLevelId: depth === 0 ? null : dungeonLevelId(depth - 1),
  };
}

// ============================================================================
// Canonical Child Generation
// ============================================================================
// Child paths change deterministic draws, not generator ownership. World parameters still come
// from the resolved surface site, so every page remains one descendant of the world entrance.
// ============================================================================

export function generateDungeonLevelPlan(
  rootIdentity: DungeonIdentity,
  depth: number,
  expectedWorldSeed?: number,
): DungeonPlan {
  const level = dungeonLevelIdentity(rootIdentity, depth);
  if (depth === 0) return generateDungeonForIdentity(rootIdentity, expectedWorldSeed);

  const { worldSeed, site } = resolveDungeonIdentity(rootIdentity, expectedWorldSeed);
  const { params, world } = deriveDungeonIdentity(worldSeed, site);
  return generateDungeon({
    seed: worldSeed,
    seedPath: level.seedPath,
    params,
    world,
  });
}

// ============================================================================
// Truthful Vertical Features
// ============================================================================
// Transition cells are authored floor in the entrance or boss room. Optional sightlines require a
// room purpose whose existing meaning already implies height; no generic room is renamed balcony.
// ============================================================================

export type DungeonVerticalFeatureKind = 'stairs-up' | 'stairs-down' | 'boss' | 'overlook';

export interface DungeonVerticalFeature {
  id: string;
  kind: DungeonVerticalFeatureKind;
  label: string;
  cell: Cell;
  roomId: number;
}

export interface DungeonLevelDescriptor {
  identity: DungeonLevelIdentity;
  plan: DungeonPlan;
  entryCell: Cell;
  parentReturnCell: Cell | null;
  upTransition: DungeonVerticalFeature | null;
  downTransition: DungeonVerticalFeature | null;
  bossObjective: DungeonVerticalFeature | null;
  verticalSight: DungeonVerticalFeature | null;
}

const VERTICAL_SIGHT_PURPOSES: ReadonlySet<RoomPurpose> = new Set([
  'hoist',
  'ladder-shaft',
  'maintenance-walk',
]);

function transitionId(
  rootIdentity: DungeonIdentity,
  fromDepth: number,
  toDepth: number,
): string {
  return `vertical.v1:${rootIdentity.dungeonId}:${dungeonLevelId(fromDepth)}:${dungeonLevelId(toDepth)}`;
}

/** Describe one generated page and its deterministic links to adjacent pages. */
export function describeDungeonLevel(
  rootIdentity: DungeonIdentity,
  depth: number,
  plan: DungeonPlan,
  parentReturnCell: Cell | null = null,
): DungeonLevelDescriptor {
  const identity = dungeonLevelIdentity(rootIdentity, depth);
  const entryCell = dungeonEntrancePlayerCell(plan);
  const bossCell = dungeonRoomPlayerCell(plan, plan.bossId);
  const bossRoom = plan.rooms.find((room) => room.id === plan.bossId);
  if (!bossRoom) throw new Error(`Dungeon ${identity.dungeonId} has no authored boss room.`);

  const upTransition = depth > 0 ? {
    id: transitionId(rootIdentity, depth, depth - 1),
    kind: 'stairs-up' as const,
    label: `Stairs up to ${dungeonLevelId(depth - 1)}`,
    cell: entryCell,
    roomId: plan.entranceId,
  } : null;
  const downTransition = depth < DUNGEON_LEVEL_COUNT - 1 ? {
    id: transitionId(rootIdentity, depth, depth + 1),
    kind: 'stairs-down' as const,
    label: `Stairs down to ${dungeonLevelId(depth + 1)}`,
    cell: bossCell,
    roomId: plan.bossId,
  } : null;
  const bossObjective = depth === DUNGEON_LEVEL_COUNT - 1 ? {
    id: `objective.v1:${identity.dungeonId}:boss:${plan.bossId}`,
    kind: 'boss' as const,
    label: 'Deepest boss objective',
    cell: bossCell,
    roomId: plan.bossId,
  } : null;

  const sightRoom = plan.rooms
    .filter((room) => VERTICAL_SIGHT_PURPOSES.has(room.purpose))
    .sort((left, right) => left.depth - right.depth || left.id - right.id)[0];
  const verticalSight = sightRoom ? {
    id: `vertical-sight.v1:${identity.dungeonId}:room:${sightRoom.id}`,
    kind: 'overlook' as const,
    label: sightRoom.purpose === 'maintenance-walk' ? 'Balcony sightline' : 'Vertical shaft sightline',
    cell: dungeonRoomPlayerCell(plan, sightRoom.id),
    roomId: sightRoom.id,
  } : null;

  return {
    identity,
    plan,
    entryCell,
    parentReturnCell: parentReturnCell ? { ...parentReturnCell } : null,
    upTransition,
    downTransition,
    bossObjective,
    verticalSight,
  };
}

/** Build a complete deterministic stack while reusing the already-mounted surface plan. */
export function buildDungeonLevelStack(
  rootIdentity: DungeonIdentity,
  surfacePlan: DungeonPlan,
  expectedWorldSeed?: number,
): DungeonLevelDescriptor[] {
  const levels: DungeonLevelDescriptor[] = [];

  for (let depth = 0; depth < DUNGEON_LEVEL_COUNT; depth += 1) {
    const plan = depth === 0
      ? surfacePlan
      : generateDungeonLevelPlan(rootIdentity, depth, expectedWorldSeed);
    const parentReturnCell = depth === 0 ? null : levels[depth - 1].downTransition?.cell ?? null;
    levels.push(describeDungeonLevel(rootIdentity, depth, plan, parentReturnCell));
  }

  return levels;
}

/** Serialize only compact identity and navigation evidence into the root expedition ledger. */
export function dungeonLevelVisitReceipt(level: DungeonLevelDescriptor): DungeonLevelVisitReceipt {
  return {
    levelId: level.identity.levelId,
    depth: level.identity.depth,
    identity: {
      dungeonId: level.identity.dungeonId,
      seedPath: level.identity.seedPath,
    },
    parentLevelId: level.identity.parentLevelId,
    entryCellKey: dungeonCellKey(level.entryCell),
    parentReturnCellKey: level.parentReturnCell ? dungeonCellKey(level.parentReturnCell) : undefined,
    downTransitionCellKey: level.downTransition
      ? dungeonCellKey(level.downTransition.cell)
      : undefined,
    bossObjectiveCellKey: level.bossObjective
      ? dungeonCellKey(level.bossObjective.cell)
      : undefined,
  };
}
