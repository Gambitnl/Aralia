/** Player knowledge comes from bought accounts and explored physical traces, never the DM log. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 07:53:27
 * Dependents: components/World3D/DungeonExpeditionOverlay.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { ItemType, type Item } from '../../types';
import { CellKind, OverlayKind, type DungeonPlan } from '../../systems/worldforge/dungeon/types';
import { dungeonCellKey } from '../../systems/worldforge/dungeon/world/dungeonMap';

export function dungeonKnowledge(plan: DungeonPlan, sourcePath: string, inventory: readonly Item[], explored: readonly string[]) {
  const heard = inventory.filter(item => item.type === ItemType.Service
    && item.sourceId?.startsWith('gossip_dungeon-')
    && item.sourceId.includes(`${sourcePath}-`));
  const seen = new Set(explored);
  const traces = new Map<string, number>();
  const surfaceNames: Partial<Record<OverlayKind, string>> = {
    [OverlayKind.Water]: 'standing water', [OverlayKind.Rubble]: 'fallen masonry',
    [OverlayKind.Ice]: 'ice', [OverlayKind.Bloom]: 'fungal growth',
    [OverlayKind.Scorch]: 'scorched stone',
  };
  for (const key of seen) {
    const [x, y] = key.split(',').map(Number);
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= plan.W || y >= plan.H) continue;
    if (plan.grid[y * plan.W + x] !== CellKind.Floor) continue;
    const label = surfaceNames[plan.overlay[y * plan.W + x] as OverlayKind];
    if (label) traces.set(label, 1);
  }
  for (const prop of plan.props) {
    if (prop.eventRef === undefined) continue;
    const key = dungeonCellKey({x: Math.floor(prop.x / plan.cellFt), y: Math.floor(prop.y / plan.cellFt)});
    if (!seen.has(key)) continue;
    const label = prop.kind.replace(/[-_]+/g, ' ');
    traces.set(label, (traces.get(label) ?? 0) + 1);
  }
  // Seeing a scar does not reveal its hidden author, age, or every room it affected.
  return {heard, traces: [...traces].map(([label, count]) => ({label, count}))};
}
