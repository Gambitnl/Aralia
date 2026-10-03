/**
 * @file groundSurfaceYM.ts
 * Sampler helper that queries height in meters for a given ground position.
 *
 * Extracted from PlayerAvatar.tsx to decouple non-React component exports
 * from TSX files, ensuring React Fast Refresh hot-reloading works properly in Vite.
 */
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import { GROUND_METERS_PER_CELL } from '@/systems/worldforge/bridge/groundWorldAdapter';
import { heightToMeters } from '@/systems/world3d/config';

/**
 * Sample the ground-world surface height (meters) at tile-local meters.
 */
export function groundSurfaceYM(ground: GroundWorld, xM: number, zM: number): number {
  const gx = Math.max(0, Math.min(ground.cols - 1, Math.round(xM / GROUND_METERS_PER_CELL)));
  const gy = Math.max(0, Math.min(ground.rows - 1, Math.round(zM / GROUND_METERS_PER_CELL)));
  return heightToMeters(ground.heights[gy * ground.cols + gx] ?? 0);
}
