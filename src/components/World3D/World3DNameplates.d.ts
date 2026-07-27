/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/06/2026, 17:45:59
 * Dependents: components/World3D/World3DScene.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/components/World3D/World3DNameplates.tsx
 * In-3D HUD overlay for site nameplates.
 *
 * This helper renders a conservative, distance/LOD-gated set of labels over
 * World3D sites using React Three Drei Html overlays.
 */
import React from 'react';
import type { LoadedChunk, LodTier, ChunkSite } from '@/systems/world3d/types';
import type { SceneOrigin } from '@/systems/world3d/sceneOrigin';
import type { PlayerWorldPosition } from '@/types';
/** --------------------------------------------------------------------- */
/** Section: label model and config defaults                               */
/** --------------------------------------------------------------------- */
/** Distance and density rules for HUD nameplates. */
interface NameplateConfig {
    /** Show only these LODs so distant chunks stay light. */
    allowedLods: LodTier[];
    /** Hide labels farther than this world distance in meters. */
    maxWorldDistance: number;
    /** Keep label count bounded for dense world passes. */
    maxVisible: number;
}
/** Normalized record for one projected label. */
interface SiteLabel {
    /** Stable React key so list updates stay deterministic. */
    key: string;
    /** Text shown in the overlay. */
    text: string;
    /** Label world position converted into scene coordinates. */
    position: [number, number, number];
    /** Cached squared distance used for stable nearest-first sorting. */
    distanceSq: number;
    /** Distance-fade opacity in [0, 1] (1 = fully visible, fades near range edge). */
    opacity: number;
    /** Site type, also available for test/diagnostic selectors. */
    kind: ChunkSite['kind'];
    /**
     * Occupant/hostile plates exist to be read up close — they skip the near-hide
     * gate and the cluster declutter (a keeper standing by their shop must label).
     */
    declutterExempt: boolean;
}
/**
 * Hide a plate when the player is essentially AT the site: inside this range
 * the building itself is identification enough, and a world-anchored label
 * this close fills the frame.
 */
export declare const NAMEPLATE_MIN_DISTANCE_M = 15;
/**
 * Screen-space declutter: when several labeled sites cluster (a business row),
 * only the nearest label within this world separation shows. Prevents plate
 * pile-ups where 4-5 chips stack over one block.
 */
export declare const NAMEPLATE_MIN_SEPARATION_M = 18;
interface World3DNameplatesProps {
    /** Loaded chunks owned by the streamer. */
    loaded: LoadedChunk[];
    /** Floating world origin so labels stay near the rendered local coordinate frame. */
    sceneOrigin: SceneOrigin;
    /** Player anchor used for distance culling and sorting. */
    playerWorldPos?: PlayerWorldPosition | null;
    /** Optional overrides for local testing and profiling. */
    maxWorldDistance?: number;
    /** Optional overrides for local testing and profiling. */
    maxVisible?: number;
}
declare function makeNameplates(loaded: LoadedChunk[], sceneOrigin: SceneOrigin, playerWorldPos: PlayerWorldPosition | null, config: NameplateConfig): SiteLabel[];
/** --------------------------------------------------------------------- */
/** Section: 3D nameplate component                                        */
/** --------------------------------------------------------------------- */
declare const World3DNameplates: React.FC<World3DNameplatesProps>;
export default World3DNameplates;
export { makeNameplates };
