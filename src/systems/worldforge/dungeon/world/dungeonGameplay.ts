// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 21/07/2026, 01:46:10
 * Dependents: components/BattleMap/dungeon/Dungeon3DPreview.tsx, systems/worldforge/dungeon/world/dungeonLevels.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file supplies the first playable rules for a canonical generated dungeon.
 *
 * Movement stays on the generator's real five-foot floor grid. The first meaningful interaction
 * uses rooms already authored with the `treasure` type, giving each cache a stable id derived from
 * the canonical dungeon receipt and generated room id. The mounted 3D expedition reports that id
 * to the existing durable lifecycle ledger instead of keeping a parallel component-owned record.
 * The same floor and route helpers now seat vertical transitions in authored rooms and restore the
 * exact parent coordinate after ascent. Level-zero movement and treasure behaviour stay unchanged.
 *
 * Called by: Dungeon3DPreview.tsx, dungeonLevels.ts, and focused dungeon gameplay tests.
 * Depends on: DungeonPlan geometry, canonical dungeon identity, and the lifecycle progress patch.
 */

import {
  CellKind,
  type Cell,
  type DungeonPlan,
  type DungeonRoom,
  type DungeonSpawn,
} from '../types';
import type { DungeonIdentity } from './dungeonIdentity';
import type { DungeonProgressPatch } from './dungeonLifecycle';

// ============================================================================
// Public Gameplay Vocabulary
// ============================================================================
// One cell is one generated five-foot square. A treasure interaction identifies the authored
// treasure room and the nearest reachable floor cell where its cache can be secured.
// ============================================================================

export type DungeonMoveDirection = 'north' | 'east' | 'south' | 'west';

export interface DungeonTreasureInteraction {
  eventId: string;
  roomId: number;
  targetCell: Cell;
  distance: number;
}

export interface DungeonEncounterInteraction {
  eventId: string;
  roomId: number;
  /** Real bestiary key of the generated monster, surfaced for the interaction prompt only. */
  monsterKey: string;
  targetCell: Cell;
  distance: number;
}

const MOVE_OFFSETS: Readonly<Record<DungeonMoveDirection, Cell>> = {
  north: { x: 0, y: -1 },
  east: { x: 1, y: 0 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
};

const NEIGHBOR_OFFSETS: readonly Cell[] = [
  MOVE_OFFSETS.north,
  MOVE_OFFSETS.east,
  MOVE_OFFSETS.south,
  MOVE_OFFSETS.west,
];

// ============================================================================
// Stable Treasure Identity
// ============================================================================
// The canonical seed path freezes generated room ids. Pairing that receipt with the authored
// treasure-room id keeps one cache address stable across exit, save/load, and revisit.
// ============================================================================

export function dungeonTreasureEventId(identity: DungeonIdentity, roomId: number): string {
  return `treasure.v1:${identity.dungeonId}:room:${roomId}`;
}

/** The generated five-foot grid cell a spawn stands on, derived from its frozen plot-feet position. */
export function dungeonSpawnCell(plan: DungeonPlan, spawn: DungeonSpawn): Cell {
  return {
    x: Math.floor(spawn.x / plan.cellFt),
    y: Math.floor(spawn.y / plan.cellFt),
  };
}

/**
 * Freeze one encounter's stable key from the canonical receipt, its authored room, and its grid
 * cell. A room may hold several generated spawns, so the cell disambiguates them without depending
 * on the mutable spawn-array order. The same seeded plan therefore yields the same encounter id
 * across exit, save/load, and revisit.
 */
export function dungeonEncounterEventId(
  identity: DungeonIdentity,
  roomId: number,
  cell: Cell,
): string {
  return `encounter.v1:${identity.dungeonId}:room:${roomId}:cell:${cell.x},${cell.y}`;
}

// ============================================================================
// Grid Helpers
// ============================================================================
// These helpers read the generator bitmap directly. They do not copy dungeon geometry into a
// second map, so movement and the rendered floor cannot drift apart.
// ============================================================================

function cellKey(cell: Cell): string {
  return `${cell.x},${cell.y}`;
}

function isInsideDungeon(plan: DungeonPlan, cell: Cell): boolean {
  return cell.x >= 0 && cell.y >= 0 && cell.x < plan.W && cell.y < plan.H;
}

function isWalkableDungeonCell(plan: DungeonPlan, cell: Cell): boolean {
  if (!isInsideDungeon(plan, cell)) return false;
  if (plan.grid[cell.y * plan.W + cell.x] !== CellKind.Floor) return false;

  // Generated open passages are walkable. Closed, secret, and bricked doors stay blocked because
  // this bounded kernel does not invent opening, searching, lockpicking, or demolition rules.
  const door = plan.doors.find((candidate) => (
    candidate.cell.x === cell.x && candidate.cell.y === cell.y
  ));
  return !door || door.state === 'open';
}

function neighboringCells(cell: Cell): Cell[] {
  return NEIGHBOR_OFFSETS.map((offset) => ({
    x: cell.x + offset.x,
    y: cell.y + offset.y,
  }));
}

function isCellInsideRoom(plan: DungeonPlan, room: DungeonRoom, cell: Cell): boolean {
  const minX = Math.floor(room.x / plan.cellFt);
  const minY = Math.floor(room.y / plan.cellFt);
  const maxX = Math.ceil((room.x + room.w) / plan.cellFt);
  const maxY = Math.ceil((room.y + room.h) / plan.cellFt);
  return cell.x >= minX && cell.y >= minY && cell.x < maxX && cell.y < maxY;
}

// ============================================================================
// Canonical Room and Entry Cells
// ============================================================================
// Generated rooms may be curved or irregular inside their bounding box. The closest real floor
// cell to a requested room centre is a truthful interaction point, with row/column order breaking
// ties. The entrance wrapper preserves the established surface spawn contract.
// ============================================================================

export function dungeonRoomPlayerCell(plan: DungeonPlan, roomId: number): Cell {
  const room = plan.rooms.find((candidate) => candidate.id === roomId);
  const targetX = room
    ? (room.x + room.w / 2) / plan.cellFt - 0.5
    : plan.W / 2;
  const targetY = room
    ? (room.y + room.h / 2) / plan.cellFt - 0.5
    : plan.H / 2;
  let best: Cell | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  // Scan the immutable bitmap once. The explicit failure keeps malformed plans from placing the
  // player or a transition in void without explanation.
  for (let y = 0; y < plan.H; y += 1) {
    for (let x = 0; x < plan.W; x += 1) {
      if (plan.grid[y * plan.W + x] !== CellKind.Floor) continue;
      if (room && !isCellInsideRoom(plan, room, { x, y })) continue;
      const distance = (x - targetX) ** 2 + (y - targetY) ** 2;
      if (distance < bestDistance) {
        best = { x, y };
        bestDistance = distance;
      }
    }
  }

  if (!best) throw new Error(`Generated dungeon room ${roomId} has no floor cell for player entry.`);
  return best;
}

/** Place the party on the truthful floor nearest the generated entrance-room centre. */
export function dungeonEntrancePlayerCell(plan: DungeonPlan): Cell {
  return dungeonRoomPlayerCell(plan, plan.entranceId);
}

// ============================================================================
// Reachability and Treasure Selection
// ============================================================================
// Breadth-first traversal gives every reachable cell its shortest distance. Treasure and vertical
// routes both use this one canonical floor graph instead of maintaining parallel collision rules.
// ============================================================================

function dungeonDistanceMap(plan: DungeonPlan, start: Cell): Int32Array {
  const distances = new Int32Array(plan.W * plan.H);
  distances.fill(-1);
  const queue: Cell[] = [{ ...start }];
  distances[start.y * plan.W + start.x] = 0;

  // Visit each reachable floor square once. Fixed north/east/south/west order makes equal paths
  // deterministic without adding another random stream to the generated dungeon.
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    const currentDistance = distances[current.y * plan.W + current.x];
    for (const neighbor of neighboringCells(current)) {
      if (!isWalkableDungeonCell(plan, neighbor)) continue;
      const index = neighbor.y * plan.W + neighbor.x;
      if (distances[index] >= 0) continue;
      distances[index] = currentDistance + 1;
      queue.push(neighbor);
    }
  }

  return distances;
}

export function findNextDungeonTreasureInteraction(
  plan: DungeonPlan,
  identity: DungeonIdentity,
  claimedTreasureIds: readonly string[],
  playerCell: Cell,
): DungeonTreasureInteraction | null {
  const claimed = new Set(claimedTreasureIds);
  const distances = dungeonDistanceMap(plan, playerCell);
  const candidates: DungeonTreasureInteraction[] = [];

  // Every candidate must be a true floor cell inside an authored treasure room. This is the
  // authoritative generator signal even when history has replaced a chest prop with other evidence.
  for (const room of plan.rooms) {
    if (room.type !== 'treasure') continue;
    const eventId = dungeonTreasureEventId(identity, room.id);
    if (claimed.has(eventId)) continue;
    for (let y = 0; y < plan.H; y += 1) {
      for (let x = 0; x < plan.W; x += 1) {
        const cell = { x, y };
        if (!isCellInsideRoom(plan, room, cell)) continue;
        if (!isWalkableDungeonCell(plan, cell)) continue;
        const distance = distances[y * plan.W + x];
        if (distance < 0) continue;
        candidates.push({ eventId, roomId: room.id, targetCell: cell, distance });
      }
    }
  }

  // Prefer the closest reachable treasure square. Room and coordinate tie-breakers keep the
  // selected interaction stable when several floor cells share the same distance.
  candidates.sort((left, right) => (
    left.distance - right.distance
    || left.roomId - right.roomId
    || left.targetCell.y - right.targetCell.y
    || left.targetCell.x - right.targetCell.x
  ));

  return candidates[0] ?? null;
}

export function findNextDungeonEncounterInteraction(
  plan: DungeonPlan,
  identity: DungeonIdentity,
  clearedEncounterIds: readonly string[],
  playerCell: Cell,
): DungeonEncounterInteraction | null {
  const cleared = new Set(clearedEncounterIds);
  const distances = dungeonDistanceMap(plan, playerCell);
  const candidates: DungeonEncounterInteraction[] = [];

  // Each generated spawn is one encounter. Its stable key is fixed to the spawn's own grid cell, but
  // the interaction resolves to the reachable floor cell nearest that spawn so a monster authored on
  // an irregular tile can still be confronted without inventing a new collision rule.
  for (const spawn of plan.spawns) {
    const spawnCell = dungeonSpawnCell(plan, spawn);
    const eventId = dungeonEncounterEventId(identity, spawn.roomId, spawnCell);
    if (cleared.has(eventId)) continue;

    const room = plan.rooms.find((candidate) => candidate.id === spawn.roomId);
    let best: Cell | null = null;
    let bestProximity = Number.POSITIVE_INFINITY;
    for (let y = 0; y < plan.H; y += 1) {
      for (let x = 0; x < plan.W; x += 1) {
        const cell = { x, y };
        if (room && !isCellInsideRoom(plan, room, cell)) continue;
        if (!isWalkableDungeonCell(plan, cell)) continue;
        if (distances[y * plan.W + x] < 0) continue;
        const proximity = (x - spawnCell.x) ** 2 + (y - spawnCell.y) ** 2;
        if (proximity < bestProximity) {
          best = cell;
          bestProximity = proximity;
        }
      }
    }
    if (!best) continue;

    candidates.push({
      eventId,
      roomId: spawn.roomId,
      monsterKey: spawn.monsterKey,
      targetCell: best,
      distance: distances[best.y * plan.W + best.x],
    });
  }

  // Prefer the closest reachable encounter. Room and coordinate tie-breakers keep the selection
  // deterministic when several spawns share a shortest-path distance from the player.
  candidates.sort((left, right) => (
    left.distance - right.distance
    || left.roomId - right.roomId
    || left.targetCell.y - right.targetCell.y
    || left.targetCell.x - right.targetCell.x
  ));

  return candidates[0] ?? null;
}

export function dungeonPathBetweenCells(
  plan: DungeonPlan,
  playerCell: Cell,
  targetCell: Cell,
): Cell[] {
  const targetKey = cellKey(targetCell);
  const queue: Cell[] = [{ ...playerCell }];
  const previous = new Map<string, Cell | null>([[cellKey(playerCell), null]]);

  // Record one deterministic predecessor per reachable floor square until the treasure-room
  // target is found. The reconstructed path includes the player's current cell first.
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    if (cellKey(current) === targetKey) break;
    for (const neighbor of neighboringCells(current)) {
      const key = cellKey(neighbor);
      if (previous.has(key)) continue;
      if (!isWalkableDungeonCell(plan, neighbor)) continue;
      previous.set(key, current);
      queue.push(neighbor);
    }
  }

  if (!previous.has(targetKey)) return [];
  const reversed: Cell[] = [];
  let cursor: Cell | null = targetCell;

  // Follow the stored predecessors back to the player, then restore travel order for the UI.
  while (cursor) {
    reversed.push(cursor);
    cursor = previous.get(cellKey(cursor)) ?? null;
  }

  return reversed.reverse();
}

/** Reuse the shared shortest floor route for the selected authored treasure cache. */
export function dungeonPathToTreasureInteraction(
  plan: DungeonPlan,
  playerCell: Cell,
  interaction: DungeonTreasureInteraction,
): Cell[] {
  return dungeonPathBetweenCells(plan, playerCell, interaction.targetCell);
}

/** Reuse the same shortest floor route for the selected generated encounter. */
export function dungeonPathToEncounterInteraction(
  plan: DungeonPlan,
  playerCell: Cell,
  interaction: DungeonEncounterInteraction,
): Cell[] {
  return dungeonPathBetweenCells(plan, playerCell, interaction.targetCell);
}

// ============================================================================
// Player Actions
// ============================================================================
// Directional movement advances one legal five-foot square. Treasure interaction emits only a
// lifecycle patch; the shared reducer remains the single authority that persists progress.
// ============================================================================

export function moveDungeonPlayer(
  plan: DungeonPlan,
  playerCell: Cell,
  direction: DungeonMoveDirection,
): Cell {
  const offset = MOVE_OFFSETS[direction];
  const destination = {
    x: playerCell.x + offset.x,
    y: playerCell.y + offset.y,
  };

  return isWalkableDungeonCell(plan, destination) ? destination : { ...playerCell };
}

export function canClaimDungeonTreasure(
  playerCell: Cell,
  interaction: DungeonTreasureInteraction | null,
): boolean {
  return Boolean(
    interaction
    && playerCell.x === interaction.targetCell.x
    && playerCell.y === interaction.targetCell.y,
  );
}

export function dungeonTreasureProgressPatch(
  interaction: DungeonTreasureInteraction,
): DungeonProgressPatch {
  return { claimedTreasureIds: [interaction.eventId] };
}

export function canClearDungeonEncounter(
  playerCell: Cell,
  interaction: DungeonEncounterInteraction | null,
): boolean {
  return Boolean(
    interaction
    && playerCell.x === interaction.targetCell.x
    && playerCell.y === interaction.targetCell.y,
  );
}

export function dungeonEncounterProgressPatch(
  interaction: DungeonEncounterInteraction,
): DungeonProgressPatch {
  return { clearedEncounterIds: [interaction.eventId] };
}

/** One completed boss (or other authored) objective, recorded through the shared progress action. */
export function dungeonObjectiveProgressPatch(objectiveId: string): DungeonProgressPatch {
  return { objectives: { [objectiveId]: 'completed' } };
}

// ============================================================================
// Rendering Seam
// ============================================================================
// The 3D preview uses one scene unit per five-foot cell. Keeping this conversion beside movement
// lets the player and treasure markers sit on the exact same grid without importing Three.js.
// ============================================================================

export function dungeonCellToScenePosition(plan: DungeonPlan, cell: Cell): { x: number; z: number } {
  return {
    x: cell.x - plan.W / 2 + 0.5,
    z: cell.y - plan.H / 2 + 0.5,
  };
}
