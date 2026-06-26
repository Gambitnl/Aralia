/**
 * @file groundAgentMotion.ts — agent motion in the 3D GROUND-METERS frame.
 *
 * The ground-meters analogue of `townMotionSnapshotAt`: it answers "where, in the
 * ground world's meter frame, is every townsperson at fractional clock H — and are
 * they walking?". `townMotionSnapshotAt` produces street-interpolated positions in
 * the town plan's FEET frame; this converts them to ground meters (offset from the
 * artifact's NW origin, the same `(coordFt - bounds) * FEET_TO_METERS` mapping the
 * static occupant/figure placement uses), so a 3D scene can animate commuters
 * walking between buildings against the live game clock.
 *
 * Pure + deterministic. The R3F scene consumes this per-frame (or per clock tick);
 * it owns no rendering and no time source.
 */
import { townMotionSnapshotAt } from '../roster/townSnapshot';
import { buildStreetGraph, type StreetGraph } from '../roster/agentPath';
import type { TownPlan } from '../artifacts';
import type { TownRoster } from '../roster/types';
import type { ActivityKind } from '../roster/occupantSchedule';
import { groundSurfaceY, type GroundWorld } from './groundChunkLoader';
import { WORLD3D_CONFIG } from '../../world3d/config';

const FEET_TO_METERS = 0.3048;

/** A townsperson positioned in the 3D ground-meters frame, possibly mid-walk. */
export interface GroundAgentMotion {
  burgId: number;
  occupantId: number;
  name: string;
  /** Ground meters from the artifact NW origin (same frame as GroundOccupantSite). */
  xM: number;
  zM: number;
  /** True while walking a street route between two plots. */
  moving: boolean;
  activity: ActivityKind;
}

/** Artifact window origin in town/plan FEET (i.e. `local.bounds`). */
export interface BoundsFeet {
  x: number;
  y: number;
}

/**
 * Every townsperson's ground-meter position (and walking flag) at fractional
 * `clock`. Pass a prebuilt `graph` to avoid rebuilding the street graph each call
 * (it depends only on the plan); omitted, it is derived from the plan.
 */
export function groundTownAgentsAt(
  burgId: number,
  plan: TownPlan,
  roster: TownRoster,
  boundsFeet: BoundsFeet,
  clock: number,
  graph: StreetGraph = buildStreetGraph(plan),
): GroundAgentMotion[] {
  return townMotionSnapshotAt(plan, graph, roster, clock).map((a) => ({
    burgId,
    occupantId: a.occupantId,
    name: a.name,
    xM: (a.x - boundsFeet.x) * FEET_TO_METERS,
    zM: (a.y - boundsFeet.y) * FEET_TO_METERS,
    moving: a.moving,
    activity: a.activity,
  }));
}

/**
 * Every townsperson across ALL towns in a ground world, positioned in ground
 * meters at fractional `clock`. The single call a 3D scene makes per frame/tick:
 * pairs each `townPlans` entry with its roster (by burgId) and flattens. Returns
 * `[]` when the ground world lacks the agent-motion inputs (e.g. a mocked world).
 */
export function allGroundAgentsAt(ground: GroundWorld, clock: number): GroundAgentMotion[] {
  if (!ground.townPlans || !ground.boundsFeet) return [];
  const bounds = ground.boundsFeet;
  const out: GroundAgentMotion[] = [];
  for (const { burgId, plan } of ground.townPlans) {
    const roster = ground.rosters.find((r) => r.burgId === burgId);
    if (!roster) continue;
    out.push(...groundTownAgentsAt(burgId, plan, roster, bounds, clock));
  }
  return out;
}

/** An agent resolved to 3D-scene-ready coordinates (the R3F mesh-layer input). */
export interface GroundAgentSceneNode extends GroundAgentMotion {
  /** Pseudo-grid position (ground meters ÷ METERS_PER_CELL) — the same transform
   *  every static ground site uses, so figures land exactly where occupants do. */
  gridX: number;
  gridY: number;
  /** Terrain surface height (scene Y meters) at the agent's position. */
  surfaceY: number;
  /** Parametric body height (meters) from `generateBody`, when supplied — lets
   *  figures vary (tall/short) instead of a uniform box. */
  bodyHeightM?: number;
  /** Parametric body width (meters, shoulder span) from `generateBody`. */
  bodyWidthM?: number;
}

/** Per-occupant parametric body dims (meters), keyed by occupant id. */
export type AgentBodyDims = Map<number, { heightM: number; widthM: number }>;

/**
 * Every townsperson across the ground world, resolved to scene-ready coordinates
 * at fractional `clock`: pseudo-grid X/Y (the established `pseudoGrid` transform)
 * plus the sampled terrain `surfaceY`, so figures stand on the ground. This is the
 * exact per-frame input a `<GroundAgents>` InstancedMesh layer consumes — the last
 * pure rung before R3F meshes. Pure + deterministic (sampling reads static terrain).
 */
export function groundAgentScenePositions(
  ground: GroundWorld,
  clock: number,
  /** Optional per-occupant parametric body dims (from `generateBody`) so figures
   *  render at their real height/build instead of a uniform box. */
  bodies?: AgentBodyDims,
): GroundAgentSceneNode[] {
  const mpc = WORLD3D_CONFIG.METERS_PER_CELL;
  return allGroundAgentsAt(ground, clock).map((a) => {
    const body = bodies?.get(a.occupantId);
    return {
      ...a,
      gridX: a.xM / mpc,
      gridY: a.zM / mpc,
      surfaceY: groundSurfaceY(ground, a.xM, a.zM),
      bodyHeightM: body?.heightM,
      bodyWidthM: body?.widthM,
    };
  });
}
