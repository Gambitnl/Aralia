/**
 * @file streetOwnedAgents.ts
 * Filters ground agent nodes based on interior resident handoffs and town rosters.
 *
 * Extracted from GroundAgents.tsx to decouple helper functions from TSX files,
 * ensuring React Fast Refresh works without module invalidation in Vite.
 */
import type { TownRoster } from '@/systems/worldforge/roster/types';
import type { GroundAgentSceneNode } from '@/systems/worldforge/bridge/groundAgentMotion';
import {
  residentIdentityKey,
  residentRenderKey,
  residentRenderOwnerAtClock,
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
): GroundAgentSceneNode[] {
  const rosterIdentityByRenderKey = new Map<string, string>();
  for (const roster of rosters) {
    for (const occupant of roster.occupants) {
      if (occupant.householdMemberId === undefined) continue;
      rosterIdentityByRenderKey.set(
        residentRenderKey(roster.burgId, occupant.id),
        residentIdentityKey(roster.burgId, occupant.householdMemberId),
      );
    }
  }

  return nodes.filter((node) => {
    const renderKey = residentRenderKey(node.burgId, node.occupantId);
    const handoff = handoffs.get(renderKey);
    const rosterIdentity = rosterIdentityByRenderKey.get(renderKey);
    if (!handoff || !rosterIdentity || handoff.stableKey !== rosterIdentity) {
      return true;
    }
    return residentRenderOwnerAtClock(handoff.occupant, clock) === 'street';
  });
}
