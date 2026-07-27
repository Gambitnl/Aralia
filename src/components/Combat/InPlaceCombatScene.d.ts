/**
 * @file InPlaceCombatScene.tsx — renders combat INSIDE the streamed world.
 *
 * Fight-in-place slice 2 ("kill the teleport"): when a fight started from the
 * live ground world, CombatView renders THIS instead of the separate BattleMap /
 * BattleMap3D diorama. The camera never leaves the town: we re-mount the same
 * `World3DScene` (same terrain, buildings, townsfolk) using the ground world
 * handed across the phase change (`fightInPlaceHandoff`), and overlay the combat
 * surface (`InPlaceCombatLayer`) on it — tokens on the real ground, a soft
 * reachable disc, and a ground-pick plane for click-to-move.
 *
 * The combat MACHINERY is unchanged: CombatView owns the turn manager and
 * ability system and passes the live characters + a move-committing callback in.
 * We translate patch-tile positions ↔ world meters through the invisible referee
 * (`inSceneMovement`), so an in-scene click is ruled by the SAME lattice the 2D
 * board uses. Abilities/attacks still resolve on the existing machinery; for this
 * slice their full in-scene TARGETING is deferred to the 2D-board toggle (the
 * honest cut line documented in the spec), while movement + turn flow are live
 * in-scene.
 */
import React from 'react';
import type { CombatCharacter, BattleMapData, CombatAction } from '../../types/combat';
export interface InPlaceCombatSceneProps {
    /** The live combat roster (CombatView's `characters` state). */
    characters: CombatCharacter[];
    /** The extracted referee patch (CombatView's `mapData`). */
    mapData: BattleMapData | null;
    /** The current actor's id (turnManager.turnState.currentCharacterId). */
    currentCharacterId: string | null;
    /** Commit a validated move for the active actor (routes turnManager.executeAction). */
    onCommitMove: (action: CombatAction) => void;
    /** Show an on-screen note when a click is rejected (out of range / blocked). */
    onNotify?: (message: string) => void;
}
declare const InPlaceCombatScene: React.FC<InPlaceCombatSceneProps>;
export default InPlaceCombatScene;
