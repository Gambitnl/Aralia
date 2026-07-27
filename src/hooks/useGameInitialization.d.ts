/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 13:33:58
 * Dependents: App.tsx
 * Imports: 14 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * ARCHITECTURAL CONTEXT:
 * This hook is the 'bootloader' for the Aralia engine. It handles all entrance
 * vectors into the game world: New Game, Quick Start (Skip), and Loading Saves.
 *
 * It acts as a bridge between high-level UI intents and the low-level procedural
 * generation services (map generation, character generation).
 *
 * Called by: App.tsx
 * Use cases:
 * - Standard flow (New Game -> Character Creator -> Gameplay)
 * - Dev flow (Skip Character Creator -> Direct Gameplay)
 * - Persistence (Load Game)
 */
/**
 * @file src/hooks/useGameInitialization.ts
 * Central hook for all game-start flows. Provides callbacks for:
 *  - handleNewGame:                Opens the character creator wizard for a fresh game.
 *  - handleSkipCharacterCreator:   Dev/quick-start that auto-generates a full party and jumps straight into gameplay.
 *  - handleLoadGameFlow:           Loads a saved game from local storage.
 *  - startGame:                    Finalizes a player-created character and boots into the world.
 *  - initializeDummyPlayerState:   Sets up world state without a character (used for UI/design previews).
 *
 * Each flow assembles the required world data (map, dynamic items, NPC placement)
 * and dispatches the appropriate action to the game state reducer.
 *
 * IMPORTANT: Inline comments in this file should NOT be removed.
 * If the code they describe is modified, update the comment with a new date/time
 * and an explanation of what changed.
 *
 * @updated 2026-02-09 23:37
 */
import React from 'react';
import { PlayerCharacter, Item } from '../types';
import { AppAction } from '../state/actionTypes';
type AddMessageFn = (text: string, sender?: 'system' | 'player' | 'npc') => void;
interface UseGameInitializationProps {
    dispatch: React.Dispatch<AppAction>;
    addMessage: AddMessageFn;
    worldSeed: number;
}
export declare function useGameInitialization({ dispatch, addMessage, worldSeed: currentWorldSeed, }: UseGameInitializationProps): {
    handleNewGame: () => void;
    handleSkipCharacterCreator: () => Promise<void>;
    handleLoadGameFlow: (slotId?: string) => Promise<void>;
    startGame: (character: PlayerCharacter, startingInventory: Item[], worldSeed: number, startTown?: {
        atlasCellId: number;
        name?: string;
        region?: string;
        centerPx?: readonly [number, number];
    }) => Promise<void>;
    initializeDummyPlayerState: () => Promise<void>;
    handleLegacyDummyAutoStart: () => Promise<void>;
};
export {};
