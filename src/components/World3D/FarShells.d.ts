/**
 * @file FarShells.tsx — render the far-distance terrain shells (2026-07-21).
 *
 * Two static vertex-colored grid meshes built worker-side by farShells.ts:
 * the region ring (continues the streamed window's terrain to ~7.6 km) and the
 * atlas horizon ring (distant ranges to ~20 km). Geometry is built once per
 * window entry from typed arrays — no streaming, no per-frame work. Materials
 * match the chunk terrain (standard, vertex colors, flat shading) so lighting
 * and fog treat near and far ground as one surface. Both meshes ignore
 * raycasting so ground picking and click-to-move never hit the backdrop.
 */
import React from 'react';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { SceneOrigin } from '@/systems/world3d/sceneOrigin';
/** Mount both shells when the ground world carries them (region entries). */
export declare const FarShells: React.FC<{
    ground: GroundWorld | null | undefined;
    sceneOrigin: SceneOrigin;
}>;
export default FarShells;
