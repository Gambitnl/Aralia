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
import { resolveGroundWalk, type GroundWalkSurfaces } from './groundBuildingMotion';
import { groundWaterMovementAt, type GroundWaterMovement, type GroundWaterProfile } from '@/systems/worldforge/bridge/groundWaterMovement';

// The pure water classifier moved to systems/worldforge/bridge/groundWaterMovement.ts
// on 2026-11-02 (GG-587, lint rule C11). This walk solver stays here because it calls
// resolveGroundWalk; the re-export keeps every existing caller and test mock working.
export * from '@/systems/worldforge/bridge/groundWaterMovement';

type Feet = { xM: number; zM: number; yM: number };
type Point = { xM: number; zM: number };
export type GroundWaterWalk = ReturnType<typeof resolveGroundWalk> & {
  water: GroundWaterMovement;
  /** Movement effort in meters; time was already budgeted by the input owner. */
  spentMovementM: number;
};
const SUBSTEP_M = .04;
const CLOSED_DOORS: ReadonlySet<string> = new Set();

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
