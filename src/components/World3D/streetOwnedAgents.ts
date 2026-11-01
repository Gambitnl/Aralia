/**
 * @file streetOwnedAgents.ts
 * Filters ground agent nodes based on interior resident handoffs and town rosters.
 *
 * Extracted from GroundAgents.tsx to decouple helper functions from TSX files,
 * ensuring React Fast Refresh works without module invalidation in Vite.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 10:55:11
 * Dependents: components/World3D/GroundAgents.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { TownRoster } from '@/systems/worldforge/roster/types';
import type { GroundAgentSceneNode } from '@/systems/worldforge/bridge/groundAgentMotion';
import {
  residentIdentityKey,
  residentRenderKey,
  residentRenderOwnerAtClock,
  residentRosterIndex,
  type ResidentHandoffRecord,
} from './InteriorOccupants';

/**
 * Remove only roster instances whose joined interior packet owns the resident
 * at this clock. Unmatched/legacy residents remain street-owned, and the stable
 * member-key equality prevents a coincident numeric id from hiding a stranger.
 */
export function streetOwnedAgentNodes(
  nodes: GroundAgentSceneNode[],
  rosters: TownRoster[],
  handoffs: ReadonlyMap<string, ResidentHandoffRecord>,
  clock: number,
  personalBodyKeys: ReadonlySet<string> = new Set(),
): GroundAgentSceneNode[] {
  const rosterIdentityByRenderKey = residentRosterIndex(rosters);

  return nodes.filter((node) => {
    const renderKey = residentRenderKey(node.burgId, node.occupantId);
    const handoff = handoffs.get(renderKey);
    const rosterIdentity = rosterIdentityByRenderKey.get(renderKey);
    if (!handoff || !rosterIdentity || handoff.stableKey !== rosterIdentity) {
      return true;
    }
    // The selected personal model also owns its street leg. Keep the generic
    // crowd as a fallback for people outside that bounded detail allocation.
    if (personalBodyKeys.has(handoff.stableKey)) return false;
    return !(handoff.locations ?? [handoff.occupant]).some(occupant =>
      residentRenderOwnerAtClock(occupant, clock) === 'interior');
  });
}
