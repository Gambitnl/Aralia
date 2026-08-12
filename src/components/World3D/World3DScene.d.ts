/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 18/07/2026, 20:25:42
 * Dependents: components/Combat/InPlaceCombatScene.tsx, components/World3D/World3DDemo.tsx, components/World3D/World3DWrapper.tsx, components/Worldforge/WorldforgeGroundDrilldown.tsx
 * Imports: 29 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file World3DScene.tsx
 * @description R3F shell for the streamed 3D world. Renders one bundle of meshes per
 * loaded chunk (terrain + water + roads + sites + instanced vegetation).
 *
 * Floating-origin rendering: the streamer works in absolute world meters (which can be
 * ~30k for a mid-world demo), but the R3F scene is drawn relative to a fixed `sceneOrigin`
 * near the player so rendered coordinates stay near 0. This avoids float-precision loss,
 * keeps the camera/light math simple, and lets the directional light actually cover the
 * visible area. The camera controller converts its reported target back to world coords
 * (via sceneToWorld) so the streamer keeps receiving absolute positions.
 *
 * Shadows are gated off by WORLD3D_CONFIG.STREAMED_WORLD_SHADOWS (a real-time shadow pass
 * over dozens of streamed chunks is expensive and was contributing to renderer stalls /
 * WebGL context loss). A webglcontextlost/restored handler keeps a transient loss from
 * leaving the canvas permanently blank.
 */
import React from 'react';
import { type CameraFrameRequest } from './FreeRoamCameraController';
import { type SceneCastMember } from './SceneCast';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { ChunkLoader } from '@/systems/world3d/types';
import type { PlayerWorldPosition } from '@/types';
interface World3DSceneProps {
    loader: ChunkLoader;
    /** World-space position to center streaming + the scene origin on at mount. */
    start: readonly [number, number, number];
    /**
     * Scene-space Y (meters) of the terrain surface at the spawn point. With vertical
     * exaggeration the ground can sit hundreds of meters up, so the camera and its look-at
     * target are lifted by this so they frame the ground instead of looking at empty sky.
     * Defaults to 0 (flat) when the host doesn't know the spawn elevation.
     */
    startSurfaceY?: number;
    /** Optional override for camera position callback (for terrain height injection). */
    onPositionChange?: (worldX: number, worldZ: number) => void;
    /** Optional callback for chunk update notifications (loaded count). */
    onChunkUpdate?: (loadedCount: number) => void;
    /** Live player position for distance-gated label overlays. */
    playerWorldPos?: PlayerWorldPosition | null;
    /**
     * Camera framing: 'continent' (default) is the high oblique km-scale
     * view; 'ground' frames a walking-scale scene (Worldforge ground mode) â€”
     * low, close, overlooking the spawn like a diorama.
     */
    viewProfile?: 'continent' | 'ground';
    /** Service for runtime AI-generated textures. */
    forgeAssetService?: ForgeAssetService;
    /** WF ground world — when present, townsfolk walk its streets (ground mode). */
    groundWorld?: GroundWorld | null;
    /** Fractional hour driving agent schedules/motion (live game clock). */
    agentClock?: number;
    /**
     * Bumping this (vs its previous value) pulls the 3D camera up to frame the
     * whole spawn town from above — the HUD "Town Cell" overhead view. Stays in
     * the same scene; no view switch.
     */
    frameTownCellNonce?: number;
    /**
     * Staged scene cast — the player + opening-situation strangers, rendered as
     * figures at the spawn so the opening predicament is visible in-world. Empty
     * once the opening is over.
     */
    sceneCast?: SceneCastMember[];
    /**
     * Click-to-talk: called with an NPC figure's id when the player clicks it in
     * the 3D world. Wired to the same `talk` action the 2D action pane uses, so
     * the conversation/dialogue opens with full bookkeeping.
     */
    onSelectNpc?: (npcId: string) => void;
    /**
     * Click-to-move (interactive-3D locomotion): called with a clicked ground
     * destination in tile/world meters when the player clicks open ground. Wired
     * to `SET_PLAYER_GROUND_POS`, the same movement state the camera walk drives.
     */
    onGroundPick?: (xM: number, zM: number) => void;
    /**
     * Ground mode: the player's LOGICAL position (tile-local ground meters,
     * `playerGroundPos`) — drives the visible player avatar. Camera walk and
     * Locale-map click-to-move both write this state, so the body follows both.
     */
    playerGroundPos?: {
        xM: number;
        zM: number;
    } | null;
    /** Ground mode: the real character — race/class/gear shape the avatar body. */
    playerCharacter?: import('@/types/character').PlayerCharacter | null;
    /**
     * Fractional hour driving the sun/sky/fog model (World3DLighting). Plumbed
     * for the game clock; defaults to a pleasant fixed late-morning.
     */
    timeOfDayHours?: number;
    /**
     * Fight-in-place slice 2: extra R3F content mounted INSIDE the Canvas after
     * the world/agents/avatar — the combat token layer, reachable-area disc, and
     * ground-pick plane. Rendered as-is so the combat surface can draw its actors
     * on the streamed terrain without World3DScene knowing anything about combat.
     */
    combatLayer?: React.ReactNode;
    /**
     * Fight-in-place slice 2: one-shot camera framing forwarded to the camera
     * controller (same mechanism as the "Town Cell" nonce, but caller-built so a
     * fight can frame its own combat area on initiative start).
     */
    cameraFrameRequest?: CameraFrameRequest | null;
}
declare const World3DScene: React.FC<World3DSceneProps>;
export default World3DScene;
