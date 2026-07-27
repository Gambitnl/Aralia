import type { GroundAgentSceneNode } from '@/systems/worldforge/bridge/groundAgentMotion';
export declare const CROWD_GROUPS: string[];
/** Stable ancestry group per roster occupant (they don't carry one yet). */
export declare function groupForOccupant(occupantId: number): string;
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
export type HeadingMemory = Map<number, {
    x: number;
    z: number;
    yaw: number;
}>;
export declare function crowdInstancePlan(nodes: GroundAgentSceneNode[], timeS: number, headings: HeadingMemory): CrowdInstance[];
