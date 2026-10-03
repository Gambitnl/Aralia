/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/07/2026, 02:39:25
 * Dependents: components/DesignPreview/steps/EntityForgeScene.tsx, components/World3D/SceneCast.tsx
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import type { EntityBlueprint } from '../types';
import type { BodyTech } from './assembleEntity';
import type { EntityRenderMode } from './toon';
export interface Entity3DProps {
    blueprint: EntityBlueprint;
    /** Walk in place (or along `walkCircleRadius`) instead of idling. */
    walking?: boolean;
    /** Ground speed while walking, m/s. */
    speed?: number;
    /** When set, the entity strolls a circle of this radius (showcase mode). */
    walkCircleRadius?: number;
    position?: [number, number, number];
    /** Face direction (radians around Y) when not circling. */
    yaw?: number;
    /**
     * Scale the soft-body field resolution for the camera distance where this
     * figure appears. Values below one keep groups of characters affordable.
     */
    resolutionScale?: number;
    /**
     * Rebuild the expensive soft-body surface at most this many times a second.
     * Gear, eyes, facing, and group movement still update every rendered frame.
     */
    fieldUpdateHz?: number;
    /** Draw solid (toon blob) or wireframe. Default: the global ENTITY_RENDER_MODE. */
    renderMode?: EntityRenderMode;
    /** Body construction (skeleton pivot slice 1): rigid segment meshes
     * (default) or the skinned skeleton body. Omitting it changes nothing. */
    bodyTech?: BodyTech;
    /** Skinned weight style (slice 3): 'rigid' segment-look default or
     * 'smooth' one-piece blended tubes. Only read when bodyTech is 'skinned'. */
    skinnedWeights?: 'rigid' | 'smooth';
}
export declare function Entity3D({ blueprint, walking, speed, walkCircleRadius, position, yaw, resolutionScale, fieldUpdateHz, renderMode, bodyTech, skinnedWeights, }: Entity3DProps): import("react").JSX.Element;
