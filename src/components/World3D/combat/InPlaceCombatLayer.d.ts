/**
 * @file InPlaceCombatLayer.tsx — the in-scene combat surface (R3F).
 *
 * Fight-in-place slice 2 ("kill the teleport"): drawn INSIDE World3DScene's
 * Canvas (via its `combatLayer` prop), this renders the fight on the same
 * streamed terrain the player was walking — no phase-swap diorama:
 *
 *  - combatant TOKENS at their tile positions, planted on the real ground
 *    (reuses the PlayerAvatar body recipe + `groundSurfaceYM` height sampler);
 *  - a soft REACHABLE-AREA disc under the active player token (BG3-style, no
 *    visible grid — locked decision #2, gridless presentation);
 *  - an active-turn RING under the current actor;
 *  - an invisible GROUND-PICK plane spanning the patch: a click raycasts to a
 *    world-meters position and calls `onGroundPick`, which the combat surface
 *    routes through the invisible referee (`validateInSceneMove`).
 *
 * It is purely presentational: positions and the reachable radius come in as
 * props (CombatView owns the turn manager / ability system). Tokens interpolate
 * (lerp) toward their target scene position so a committed move glides.
 */
import React from 'react';
import type { SceneOrigin } from '@/systems/world3d/sceneOrigin';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
/** One combatant to draw in the scene. */
export interface InPlaceToken {
    id: string;
    name: string;
    /** World-meters position (tile center → world, done by the caller). */
    xM: number;
    zM: number;
    /** 'player' | 'enemy' | 'neutral' — drives the token color. */
    team: 'player' | 'enemy' | 'neutral';
    /** Whether this is the active actor this turn (ring + reachable disc). */
    isActive: boolean;
    /** Approximate body height in meters (defaults to a 6-ft adult). */
    heightM?: number;
}
export interface InPlaceCombatLayerProps {
    ground: GroundWorld;
    sceneOrigin: SceneOrigin;
    tokens: InPlaceToken[];
    /** World-meters center of the active player's reachable disc (null = hide). */
    reachable: {
        centerXM: number;
        centerZM: number;
        movementFeet: number;
    } | null;
    /** Patch dimensions (cells) — sizes the invisible ground-pick plane. */
    patchDims: {
        width: number;
        height: number;
    };
    /** The extraction anchor world-meters — the plane centers here. */
    anchorXM: number;
    anchorZM: number;
    /** Fired when the player clicks the ground; carries world meters. */
    onGroundPick?: (worldXM: number, worldZM: number) => void;
}
/** The full in-scene combat layer mounted inside World3DScene's Canvas. */
declare const InPlaceCombatLayer: React.FC<InPlaceCombatLayerProps>;
export default InPlaceCombatLayer;
