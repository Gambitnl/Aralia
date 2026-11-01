/**
 * Lets the party open an ordinary door beside its accepted dungeon square.
 * The generated plan stays immutable. Existing saved route IDs describe which
 * leaves have been opened; movement, maps, rendering and combat use that same
 * projected plan. Secret and bricked doors still need their own future rules.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 10:02:31
 * Dependents: components/World3D/DungeonExpeditionOverlay.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {CellKind, type Cell, type DungeonPlan} from '../types';
import type {DungeonIdentity} from './dungeonIdentity';
import type {DungeonProgressPatch} from './dungeonLifecycle';

export function dungeonDoorRouteId(identity: DungeonIdentity, cell: Cell): string {
  return `door.v1:${identity.dungeonId}:cell:${cell.x},${cell.y}`;
}

function floorAt(plan: DungeonPlan, cell: Cell): boolean {
  return Number.isInteger(cell.x) && Number.isInteger(cell.y)
    && cell.x >= 0 && cell.y >= 0 && cell.x < plan.W && cell.y < plan.H
    && plan.grid[cell.y * plan.W + cell.x] === CellKind.Floor;
}

/** Only touch a real adjacent leaf; neither a distant click nor a wall grants passage. */
export function openDungeonDoorProgress(
  plan: DungeonPlan, identity: DungeonIdentity, player: Cell, target: Cell,
): DungeonProgressPatch | null {
  if (!floorAt(plan, player) || !floorAt(plan, target)
    || Math.abs(player.x - target.x) + Math.abs(player.y - target.y) !== 1) return null;
  if (plan.doors.some(door => door.cell.x === player.x && door.cell.y === player.y && door.state !== 'open')) return null;
  const door = plan.doors.find(candidate => candidate.cell.x === target.x && candidate.cell.y === target.y);
  if (door?.state !== 'door') return null;
  return {openedRouteIds: [dungeonDoorRouteId(identity, target)]};
}

/** Rebuild only changed door leaves from saved evidence, retaining all source geometry and identities. */
export function withOpenedDungeonDoors(
  plan: DungeonPlan, identity: DungeonIdentity, openedRouteIds: readonly string[],
): DungeonPlan {
  const opened = new Set(openedRouteIds);
  let changed = false;
  const doors = plan.doors.map(door => {
    if (door.state !== 'door' || !opened.has(dungeonDoorRouteId(identity, door.cell))) return door;
    changed = true;
    return {...door, state: 'open' as const};
  });
  return changed ? {...plan, doors} : plan;
}
