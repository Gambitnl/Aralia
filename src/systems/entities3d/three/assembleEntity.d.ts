/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 26/07/2026, 23:09:27
 * Dependents: components/BattleMap/characters/characterActor/EntityModel.tsx, components/DesignPreview/steps/EntityDebugScene.tsx, components/World3D/OccupantFigure.tsx, components/World3D/PlayerAvatar.tsx, systems/entities3d/three/Entity3D.tsx
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file assembleEntity.ts — blueprint → live entity (body v2: segments).
 *
 * Scene graph:
 *   group                (caller positions/rotates this)
 *   ├─ bodyRoot          (lifted by the gait's verticalOffsetM)
 *   │  ├─ segmentBody    (one rigid mesh per skeleton segment + chain parts)
 *   │  ├─ parts          (one container per mesh part, re-anchored per frame)
 *   │  └─ eyeL / eyeR    (blobfolk-style eyes with blink)
 *   └─ blobShadow        (radial ground disc, fades with airtime)
 *
 * Render mode (toon.ts ENTITY_RENDER_MODE): 'solid' = toon-shaded segments
 * with inverse-hull ink outlines; 'wireframe' = clean edge lines
 * (EdgesGeometry) for body and parts alike. Eyes and the ground shadow stay
 * solid in both. The metaball field era is over: nothing polygonizes at
 * runtime — per frame is transform updates only.
 *
 * Framework-agnostic: no React. Entity3D.tsx wraps this for R3F scenes.
 */
import { Group } from 'three';
import type { EntityBlueprint } from '../types';
import type { LocomotionState, Pose } from './gaits';
import { type EntityRenderMode } from './toon';
export interface EntityHandle {
    readonly group: Group;
    readonly blueprint: EntityBlueprint;
    /** Advance animation. Omit `loco` for a standing idle. */
    update(t: number, dt: number, loco?: LocomotionState): void;
    dispose(): void;
    /** React-lifecycle-safe ownership: retain in an effect, release in its
     * cleanup. Release defers the real dispose one microtask so StrictMode's
     * mount → cleanup → remount cycle never guts a handle that is still in use. */
    retain(): void;
    release(): void;
    /** Live anchor transforms (the gait driver's pose) — read-only debug view. */
    readonly pose: Pose;
    /** Debugger scrub: jump the gait cycle to `phase` (0–1). The next update
     * (even with dt = 0) re-poses the body at that phase. */
    setGaitPhase(phase: number): void;
    /** Debug snapshot for the harness stats readout. */
    stats(): {
        segments: number;
        triangles: number;
        renderMode: EntityRenderMode;
    };
}
/** How the body is constructed (skeleton pivot slice 1).
 * 'segments' — body v2: one rigid mesh per skeleton segment (the default;
 * unchanged behavior). 'skinned' — a THREE.Bone hierarchy driving one
 * rigid-weight SkinnedMesh + one ink-shell SkinnedMesh (biped, solid only for
 * now; the segment renderer still draws chain parts like tails). */
export type BodyTech = 'segments' | 'skinned';
export interface AssembleOptions {
    /** @deprecated Body v2 has no field to scale — accepted and ignored. */
    resolutionScale?: number;
    /** @deprecated Body v2 has no field to throttle — accepted and ignored. */
    fieldUpdateHz?: number;
    /** Draw solid (toon) or wireframe. Default: the global ENTITY_RENDER_MODE. */
    renderMode?: EntityRenderMode;
    /** Body construction technique. Default 'segments' — opting in is the only
     * way to get the slice-1 skinned body; nothing else changes. */
    bodyTech?: BodyTech;
    /** Skinned-body weight style (slice 3). 'rigid' reproduces the segment
     * look exactly; 'smooth' lofts one-piece chain tubes with joint-blended
     * weights (creased elbows/knees). Default 'rigid' until the eyeball gate. */
    skinnedWeights?: 'rigid' | 'smooth';
}
export declare function assembleEntity(blueprint: EntityBlueprint, options?: AssembleOptions): EntityHandle;
