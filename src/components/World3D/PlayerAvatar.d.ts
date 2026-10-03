/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 12/07/2026, 00:33:16
 * Dependents: components/World3D/GroundMovePlane.tsx, components/World3D/World3DScene.tsx, components/World3D/World3DWrapper.tsx, components/World3D/combat/InPlaceCombatLayer.tsx
 * Imports: 11 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/components/World3D/PlayerAvatar.tsx
 *
 * The player's own visible body in the streamed ground world — a REAL
 * generated entity (src/systems/entities3d): the character's race sets the
 * body, the class and equipped items set the visible gear, and the blobfolk
 * gait walks the legs. This replaced the tapered-cylinder placeholder when
 * the entity generator shipped (2026-07-11).
 *
 * Anchoring: the body stands at the LOGICAL player position
 * (`playerGroundPos` — tile-local ground meters), NOT the camera. Camera walk
 * and Locale-map click-to-move both dispatch SET_PLAYER_GROUND_POS, so both
 * move this body. Ground elevation is resampled from the ground-world
 * heightfield each move so the figure stays planted on the terrain. The gait
 * driver takes its speed and heading from the same glide, so the legs stride
 * exactly as fast as the body actually moves.
 */
import React from 'react';
import type { SceneOrigin } from '@/systems/world3d/sceneOrigin';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { PlayerCharacter } from '@/types/character';
/**
 * Cheap race scale, kept for legacy callers: small folk get a visibly smaller
 * body. The avatar itself no longer uses this — race frames come from the
 * entity generator's species profiles.
 */
export declare function raceScale(raceName: string | undefined): number;
interface PlayerAvatarProps {
    /** The ONE movement state — tile-local ground meters. Null = stand at spawn. */
    groundPos: {
        xM: number;
        zM: number;
    } | null;
    /** Ground world (heights for terrain planting). Renders nothing without it. */
    ground: GroundWorld | null;
    sceneOrigin: SceneOrigin;
    /** Spawn surface Y (m) — fallback elevation when groundPos is null. */
    startSurfaceY: number;
    /** The real character — race, class, and equipped gear shape the body.
     * Null (pre-party states) renders no figure: there is no character yet. */
    character?: PlayerCharacter | null;
}
declare const PlayerAvatar: React.FC<PlayerAvatarProps>;
export default PlayerAvatar;
