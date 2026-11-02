/**
 * @file crowdInstancePlan.ts — pure bucketing for the instanced street crowd.
 *
 * Turns scene-ready agent nodes into per-instance placements: which ancestry
 * archetype, which walk-cycle keyframe, facing which way, at what size. Kept
 * out of the component so the logic is unit-testable without R3F.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 01:49:01
 * Dependents: components/World3D/GroundAgents.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { SeededRandom } from '@/utils/random/seededRandom';
import type { GroundAgentSceneNode } from '@/systems/worldforge/bridge/groundAgentMotion';
import { CROWD_WALK_PHASES } from '@/systems/entities3d/three/crowdBake';
import { CROWD_ACTIVITIES, type CrowdActivity } from '@/systems/entities3d/recipeFromOccupant';

/** Townsfolk ancestry mix (same weighting the household roster uses). */
const WEIGHTED_GROUPS: Array<[string, number]> = [
  ['Human', 8],
  ['Elf', 4],
  ['Dwarf', 4],
  ['Halfling', 3],
  ['Gnome', 3],
  ['Half-Elf', 3],
  ['Greenskins', 2],
  ['Goliath', 1],
  ['Tiefling', 1],
  ['Aasimar', 1],
  ['Draconic Kin', 1],
  ['Beastfolk', 1],
];

export const CROWD_GROUPS = WEIGHTED_GROUPS.map(([g]) => g);

const TOTAL_WEIGHT = WEIGHTED_GROUPS.reduce((s, [, w]) => s + w, 0);

/** Stable ancestry group per roster occupant (they don't carry one yet). */
export function groupForOccupant(occupantId: number): string {
  let roll = new SeededRandom(occupantId * 613 + 29).nextInt(0, TOTAL_WEIGHT);
  for (const [group, weight] of WEIGHTED_GROUPS) {
    roll -= weight;
    if (roll < 0) return group;
  }
  return 'Human';
}

/** A well-mixed 0..1 value per id. SeededRandom's first draw follows the
 * seed too closely for neighboring ids (9 of 40 talked at a 60% rate). */
function unitHash(id: number): number {
  let h = Math.imul(id ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export interface CrowdInstance {
  node: GroundAgentSceneNode;
  group: string;
  /** 0 = idle keyframe, 1..N = walk keyframes. */
  phaseIdx: number;
  /** NPC life (2026-11-02): an activity pose for a still person at an errand
   *  place, with its frame. The renderer falls back to idle (phaseIdx 0) when
   *  the group's activity frames are not baked yet. */
  activity?: CrowdActivity['name'];
  activityFrame?: number;
  /** Facing (radians around +Y). */
  yaw: number;
  /** Per-agent size jitter around the archetype body. */
  scale: number;
}

/** Last-seen position + facing per occupant, kept by the caller across ticks. */
export type HeadingMemory = Map<number, { x: number; z: number; yaw: number }>;

const WALK_CYCLE_HZ = 1.9;

export function crowdInstancePlan(
  nodes: GroundAgentSceneNode[],
  timeS: number,
  headings: HeadingMemory,
  sourceAncestries?: ReadonlyMap<string, string>,
): CrowdInstance[] {
  return nodes.map((n) => {
    const prev = headings.get(n.occupantId);
    let yaw = prev?.yaw ?? (new SeededRandom(n.occupantId * 131 + 7).next() * Math.PI * 2);
    if (prev && (prev.x !== n.gridX || prev.z !== n.gridY)) {
      yaw = Math.atan2(n.gridX - prev.x, n.gridY - prev.z);
    }
    // NPC life (2026-11-02): a person standing at an errand place turns to the
    // point the group there faces, so a group reads as people together. Both
    // axes share one scale (meters vs pseudo-grid), so the angle is the same.
    if (!n.moving && n.faceXM !== undefined && n.faceZM !== undefined
      && Math.hypot(n.faceXM - n.xM, n.faceZM - n.zM) > 0.05) {
      yaw = Math.atan2(n.faceXM - n.xM, n.faceZM - n.zM);
    }
    headings.set(n.occupantId, { x: n.gridX, z: n.gridY, yaw });
    const phaseIdx = n.moving
      ? 1 +
        (Math.floor(
          (((timeS * WALK_CYCLE_HZ + n.occupantId * 0.371) % 1) + 1) % 1 * CROWD_WALK_PHASES,
        ) %
          CROWD_WALK_PHASES)
      : 0;
    const scale = 0.92 + new SeededRandom(n.occupantId * 449 + 3).next() * 0.16;
    // A still person at an errand place talks or listens; about 60% talk.
    // Each person starts the loop at their own point, so a group does not
    // gesture in step.
    let activity: CrowdActivity | undefined;
    let activityFrame: number | undefined;
    if (!n.moving && n.faceXM !== undefined) {
      const roll = unitHash(n.occupantId);
      activity = CROWD_ACTIVITIES.find((a) => a.name === (roll < 0.6 ? 'talk' : 'listen'));
      if (activity) {
        const loop = (((timeS / activity.periodS + roll * 7.31) % 1) + 1) % 1;
        activityFrame = Math.min(activity.frames - 1, Math.floor(loop * activity.frames));
      }
    }
    // Unknown legacy crowds retain the seeded mix. Known residents keep the
    // ancestry of their source body even when distance reduces visual detail.
    return {
      node: n,
      group: sourceAncestries?.get(`${n.burgId}:${n.occupantId}`) ?? groupForOccupant(n.occupantId),
      phaseIdx,
      yaw,
      scale,
      ...(activity ? { activity: activity.name, activityFrame } : {}),
    };
  });
}
