/** Save only accepted footing and the frozen world doorway; regenerate source plans on load. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 13:23:17
 * Dependents: components/World3D/DungeonExpeditionOverlay.tsx, components/World3D/hooks/useInteriorTransition.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { ActiveDungeonEntry } from './dungeonEntryRuntime';
import { CellKind } from '../types';
import { buildDungeonLevelStack } from './dungeonLevels';
import { withOpenedDungeonDoors } from './dungeonDoorActions';
import { normalizeDungeonExplorationPosition, type DungeonExplorationPosition, type DungeonExpeditionRecord } from './dungeonLifecycle';

/** Never recover into an unknown page, wall, closed door, or another world's visit. */
export function validateDungeonExplorationPosition(
  record: DungeonExpeditionRecord | undefined, entry: ActiveDungeonEntry,
): DungeonExplorationPosition | null {
  const p = normalizeDungeonExplorationPosition(record?.progress.activeVisit);
  if (!record || record.visitPhase !== 'active' || !p ||
      record.identity.dungeonId !== entry.identity.dungeonId ||
      p.returnContext.worldSeed !== entry.returnContext.worldSeed ||
      p.returnContext.cellId !== entry.returnContext.cellId) return null;
  const levels = buildDungeonLevelStack(entry.identity, entry.plan, entry.returnContext.worldSeed);
  const level = levels[p.depth];
  if (!level || (p.depth > 0 && !record.progress.levelVisits[level.identity.levelId])) return null;
  const plan = withOpenedDungeonDoors(level.plan, level.identity, record.progress.openedRouteIds);
  const {x,y} = p.playerCell;
  if (x < 0 || y < 0 || x >= plan.W || y >= plan.H || plan.grid[y * plan.W + x] !== CellKind.Floor ||
      plan.doors.some(d => d.cell.x === x && d.cell.y === y && d.state !== 'open')) return null;
  return p;
}
