/** Grounded water passage spends the same movement budget as combat terrain.
 * The existing walking solver still owns floors, grades, doors and clearance.
 * Published water supplies immersion; this never changes water, land or saved
 * height, and it does not manufacture swimming or breathing permission. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 31/10/2026, 03:35:29
 * Dependents: components/World3D/InteriorOccupants.tsx, components/World3D/PlayerAvatar.tsx, components/World3D/groundLocomotion.ts, components/World3D/groundPlacementInspection.ts, components/World3D/initialTownEntry.ts, components/World3D/useGroundKeyboardControls.ts, systems/worldforge/bridge/groundChunkLoader.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import { publishedGroundWaterSurfaceYAt } from '@/systems/worldforge/bridge/groundWaterSurfaceQuery';
import { GROUND_METERS_PER_CELL } from '@/systems/worldforge/bridge/groundWorldAdapter';
import { applyMovementCostModifiers } from '@/utils/combat/physicsUtils';
import { ANY_DIFFICULT_TERRAIN_POLICY, type TerrainMovementPolicy } from '@/utils/combat/movementUtils';
import { resolveGroundWalk, type GroundWalkSurfaces } from './groundBuildingMotion';

type Feet = { xM: number; zM: number; yM: number };
type Point = { xM: number; zM: number };
export interface GroundWaterProfile {
  /** Actual rendered mouth height above the feet, supplied by the body owner.
   * Missing anatomy cannot authorize walking with the body submerged. */
  mouthHeightM?: number;
  /** Standing figure and held gear; independent of mouth immersion. */
  standingHeightM?: number;
  terrainPolicy?: TerrainMovementPolicy | null;
}
export interface GroundWaterMovement {
  mode: 'dry' | 'wading' | 'blocked';
  multiplier: number;
  depthM?: number;
  reason?: 'deep-water' | 'unknown-water' | 'unknown-body';
}
export type GroundWaterWalk = ReturnType<typeof resolveGroundWalk> & {
  water: GroundWaterMovement;
  /** Movement effort in meters; time was already budgeted by the input owner. */
  spentMovementM: number;
};
const CONTACT_M = .05;
const BREATHING_CLEARANCE_M = .05;
const SUBSTEP_M = .04;
const CLOSED_DOORS: ReadonlySet<string> = new Set();

function hasUnresolvedRibbonAt(ground: GroundWorld, point: Point): boolean {
  for (const river of ground.rivers) {
    if (river.points.length < 2 || (river.waterlineY?.length === river.points.length && river.waterlineY.every(Number.isFinite))) continue;
    for (let i = 1; i < river.points.length; i++) {
      const a = river.points[i - 1], b = river.points[i], dx = b.x - a.x, dz = b.z - a.z;
      const t = Math.max(0, Math.min(1, ((point.xM - a.x) * dx + (point.zM - a.z) * dz) / (dx * dx + dz * dz || 1)));
      const width = Math.max(river.surfaceWidthM?.[i - 1] ?? river.widthM, river.surfaceWidthM?.[i] ?? river.widthM);
      // Missing published levels remain unknown inside the possible ribbon,
      // including overdraw and end caps. They must not become a dry shortcut.
      if (!Number.isFinite(width) || Math.hypot(point.xM - a.x - t * dx, point.zM - a.z - t * dz) <= width / 2 + GROUND_METERS_PER_CELL) return true;
    }
  }
  return false;
}

export function groundWaterMovementAt(ground: GroundWorld, feet: Feet, profile: GroundWaterProfile): GroundWaterMovement {
  if (![feet.xM, feet.zM, feet.yM].every(Number.isFinite)) return { mode: 'blocked', multiplier: Infinity, reason: 'unknown-body' };
  if (hasUnresolvedRibbonAt(ground, feet)) return { mode: 'blocked', multiplier: Infinity, reason: 'unknown-water' };
  const surfaceY = publishedGroundWaterSurfaceYAt(ground, feet.xM, feet.zM);
  const depthM = surfaceY == null ? 0 : Math.max(0, surfaceY - feet.yM);
  // This only classifies grounded, source-supported local movement. A dry
  // published point is never a regional route or crossing certificate.
  if (depthM <= CONTACT_M) return { mode: 'dry', multiplier: 1, depthM };
  if (!Number.isFinite(profile.mouthHeightM) || profile.mouthHeightM! <= 0) return { mode: 'blocked', multiplier: Infinity, depthM, reason: 'unknown-body' };
  if (depthM + BREATHING_CLEARANCE_M >= profile.mouthHeightM!) return { mode: 'blocked', multiplier: Infinity, depthM, reason: 'deep-water' };
  // The existing unrestricted policy covers water. Earth Walk and Timberwalk
  // keep their ground/plant qualifiers rather than gaining a new water waiver.
  const multiplier = applyMovementCostModifiers(1, {
    isDifficultTerrain: true,
    ignoreDifficultTerrain: profile.terrainPolicy === ANY_DIFFICULT_TERRAIN_POLICY,
  });
  return { mode: 'wading', multiplier, depthM };
}

/** Spend one frame's walking budget along the requested direction. Sampling
 * every existing 4 cm support step prevents a distant click from skipping
 * deep water. The more costly shoreline endpoint is paid before crossing it.
 * Deeper water stays a separate movement problem, never an automatic lift. */
export function resolveGroundWaterWalk(
  ground: GroundWorld, from: Feet, requested: Point, movementBudgetM: number,
  profile: GroundWaterProfile, doors: ReadonlySet<string> = CLOSED_DOORS, surfaces?: GroundWalkSurfaces,
): GroundWaterWalk {
  const initial = resolveGroundWalk(ground, from, from, doors, surfaces, profile.standingHeightM);
  let water = groundWaterMovementAt(ground, from, profile);
  if (initial.blocked) return { ...initial, water, spentMovementM: 0 };
  const dx = requested.xM - from.xM, dz = requested.zM - from.zM, distance = Math.hypot(dx, dz);
  if (![distance, movementBudgetM].every(Number.isFinite) || movementBudgetM < 0) return { ...from, blocked: true, onStairs: false, water, spentMovementM: 0 };
  if (distance <= 1e-9 || movementBudgetM === 0) return { ...initial, water, spentMovementM: 0 };
  if (water.mode === 'blocked') return { ...from, blocked: true, onStairs: false, water, spentMovementM: 0 };
  const nx = dx / distance, nz = dz / distance;
  let pose = { ...from }, remaining = distance, budget = movementBudgetM, spentMovementM = 0, onStairs = false;
  while (remaining > 1e-7 && budget > 1e-7) {
    const length = Math.min(SUBSTEP_M, remaining, budget / water.multiplier);
    let reached = resolveGroundWalk(ground, pose, { xM: pose.xM + nx * length, zM: pose.zM + nz * length }, doors, surfaces, profile.standingHeightM);
    let nextWater = groundWaterMovementAt(ground, reached, profile);
    if (nextWater.mode === 'blocked') return { ...pose, blocked: true, onStairs, water: nextWater, spentMovementM };
    const multiplier = Math.max(water.multiplier, nextWater.multiplier);
    let moved = Math.hypot(reached.xM - pose.xM, reached.zM - pose.zM);
    if (moved * multiplier > budget + 1e-9) {
      const share = budget / (moved * multiplier);
      reached = resolveGroundWalk(ground, pose, { xM: pose.xM + (reached.xM - pose.xM) * share, zM: pose.zM + (reached.zM - pose.zM) * share }, doors, surfaces, profile.standingHeightM);
      nextWater = groundWaterMovementAt(ground, reached, profile);
      if (nextWater.mode === 'blocked') return { ...pose, blocked: true, onStairs, water: nextWater, spentMovementM };
      moved = Math.hypot(reached.xM - pose.xM, reached.zM - pose.zM);
    }
    const cost = moved * multiplier;
    budget = Math.max(0, budget - cost); spentMovementM += cost;
    pose = { xM: reached.xM, zM: reached.zM, yM: reached.yM };
    remaining -= moved; water = nextWater; onStairs ||= reached.onStairs;
    // Preserve the ground solver's explanation through the same movement budget.
    // Water admission and its separate warnings keep their existing precedence.
    if (reached.blocked || moved < 1e-9) return { ...pose, blocked: reached.blocked, onStairs, water, spentMovementM,
      ...(reached.blockedReason ? { blockedReason: reached.blockedReason } : {}) };
  }
  return { ...pose, blocked: false, onStairs, water, spentMovementM };
}
