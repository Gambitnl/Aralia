/**
 * @file crowdInstancePlan.ts — pure bucketing for the instanced street crowd.
 *
 * Turns scene-ready agent nodes into per-instance placements: which ancestry
 * archetype, which walk-cycle keyframe, facing which way, at what size. Kept
 * out of the component so the logic is unit-testable without R3F.
 */
import { SeededRandom } from '@/utils/random/seededRandom';
import type { GroundAgentSceneNode } from '@/systems/worldforge/bridge/groundAgentMotion';
import { CROWD_WALK_PHASES } from '@/systems/entities3d/three/crowdBake';

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

export interface CrowdInstance {
  node: GroundAgentSceneNode;
  group: string;
  /** 0 = idle keyframe, 1..N = walk keyframes. */
  phaseIdx: number;
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
): CrowdInstance[] {
  return nodes.map((n) => {
    const prev = headings.get(n.occupantId);
    let yaw = prev?.yaw ?? (new SeededRandom(n.occupantId * 131 + 7).next() * Math.PI * 2);
    if (prev && (prev.x !== n.gridX || prev.z !== n.gridY)) {
      yaw = Math.atan2(n.gridX - prev.x, n.gridY - prev.z);
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
    return { node: n, group: groupForOccupant(n.occupantId), phaseIdx, yaw, scale };
  });
}
