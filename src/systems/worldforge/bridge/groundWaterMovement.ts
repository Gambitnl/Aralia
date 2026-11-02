/** Grounded water passage spends the same movement budget as combat terrain.
 * The existing walking solver still owns floors, grades, doors and clearance.
 * Published water supplies immersion; this never changes water, land or saved
 * height, and it does not manufacture swimming or breathing permission. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/11/2026, 17:13:33
 * Dependents: components/World3D/groundWaterMovement.ts, systems/worldforge/bridge/groundChunkLoader.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

// Moved from components/World3D/groundWaterMovement.ts on 2026-11-02 (GG-587): systems/ code
// may not import components/ (lint rule C11). The old path re-exports it.

import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import { inspectGroundWater } from '@/systems/worldforge/bridge/groundWaterSurfaceQuery';
import { GROUND_METERS_PER_CELL } from '@/systems/worldforge/bridge/groundWorldAdapter';
import { applyMovementCostModifiers } from '@/utils/combat/physicsUtils';
import { ANY_DIFFICULT_TERRAIN_POLICY, type TerrainMovementPolicy } from '@/utils/combat/movementUtils';

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
const CONTACT_M = .05;
const BREATHING_CLEARANCE_M = .05;

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
  const water = inspectGroundWater(ground, feet.xM, feet.zM);
  if (water.status === 'unavailable') return {mode: 'blocked', multiplier: Infinity, reason: 'unknown-water'};
  const surfaceY = water.surfaceY;
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
