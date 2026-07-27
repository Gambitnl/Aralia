/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/07/2026, 00:33:34
 * Dependents: components/World3D/World3DDemo.tsx, components/World3D/World3DScene.tsx, components/World3D/World3DWrapper.tsx
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/components/World3D/SceneCast.tsx
 *
 * Renders the **staged cast** of an in-world scene — the player plus the 1–3
 * opening-situation strangers — standing in a conversational cluster at the
 * spawn point, each with a floating name label.
 *
 * Figures are REAL generated entities (src/systems/entities3d): the player
 * renders their actual race + class + equipped gear, rich NPCs render their
 * class and worn gear. A member without a recipe renders as an unarmed human
 * commoner — the same default the NPC generator itself uses for unspecified
 * folk (castMemberRecipe below is the one place that decides this).
 *
 * Positions are scene-local: the streamed scene origin is centered on the spawn
 * `start`, so scene-space (0, surfaceY, 0) is the ground at the player's feet.
 * The cast is arranged around that point so the ground camera frames the group.
 */
import React from 'react';
import type { EntityRecipe } from '@/systems/entities3d/types';
export interface SceneCastMember {
    id: string;
    name: string;
    /** The player's own figure (stands at the near edge). */
    isPlayer?: boolean;
    /** The stranger who speaks first — label carries the highlight. */
    isSpeaker?: boolean;
    /** Real identity when known (player sheet / rich NPC). */
    recipe?: EntityRecipe;
}
interface SceneCastProps {
    cast: SceneCastMember[];
    /** Scene-space Y (m) of the ground at the spawn; figures stand on it. */
    surfaceY?: number;
    /**
     * Click-to-talk: invoked with an NPC figure's id when the player clicks it in
     * the 3D world. The player's own figure is never clickable. When omitted the
     * figures are inert (e.g. a non-interactive diorama / test render).
     */
    onSelectNpc?: (npcId: string) => void;
}
/**
 * Whether a cast figure is click-to-talk interactive: only NPC figures, and only
 * when a select handler is wired. The player's own figure is NEVER clickable —
 * you don't open a conversation with yourself. Pure so the contract is testable
 * without an R3F render.
 */
export declare function figureIsInteractive(member: SceneCastMember, hasHandler: boolean): boolean;
/**
 * The one place an unspecified cast member becomes a body: an unarmed human
 * commoner, deterministic per member id. Members with real identities carry
 * their own recipe.
 */
export declare function castMemberRecipe(member: SceneCastMember): EntityRecipe;
/**
 * Lay the cast out as a small face-to-face cluster: the player at the near edge
 * (+Z, toward the camera) and the NPCs in a shallow arc opposite, facing back.
 */
export declare function layoutCast(cast: SceneCastMember[]): Array<SceneCastMember & {
    pos: [number, number, number];
}>;
/**
 * Render the staged cast. Returns null when there's no one to stage (the normal
 * case once the opening is over and the player wanders off).
 */
declare const SceneCast: React.FC<SceneCastProps>;
export default SceneCast;
