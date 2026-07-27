/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:28:12
 * Dependents: actionHandlers.ts
 * Imports: 10 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/hooks/actions/handleItemInteraction.ts
 * Handles item interaction actions like 'take_item', 'EQUIP_ITEM', etc.
 */
import React from 'react';
import { GameState, Action, EquipItemPayload, UnequipItemPayload, UseItemPayload, DropItemPayload } from '../../types';
import { AppAction } from '../../state/actionTypes';
import { AddMessageFn, AddGeminiLogFn } from './actionHandlerTypes';
interface HandleTakeItemProps {
    action: Action;
    gameState: GameState;
    dispatch: React.Dispatch<AppAction>;
    addMessage: AddMessageFn;
}
export declare function handleTakeItem({ action, gameState, dispatch, addMessage, }: HandleTakeItemProps): Promise<void>;
interface HandleSearchAreaProps {
    gameState: GameState;
    dispatch: React.Dispatch<AppAction>;
    addMessage: AddMessageFn;
}
/**
 * "Search the Area" — the wilderness loot affordance for procedural coord_ tiles.
 *
 * Named locations carry authored `itemIds`; coord_ tiles do not, so without this a
 * player exploring the map can never pick anything up. This runs a deterministic,
 * biome-biased forage (no AI dependency — see systems/exploration/forage.ts), places
 * any finds onto the tile via PLACE_AREA_ITEMS (which the player then collects with
 * the normal Take buttons), and marks the tile searched so it cannot be farmed.
 */
export declare function handleSearchArea({ gameState, dispatch, addMessage, }: HandleSearchAreaProps): Promise<void>;
export declare function handleEquipItem(dispatch: React.Dispatch<AppAction>, payload: EquipItemPayload): void;
export declare function handleUnequipItem(dispatch: React.Dispatch<AppAction>, payload: UnequipItemPayload): void;
export declare function handleUseItem(dispatch: React.Dispatch<AppAction>, payload: UseItemPayload): void;
export declare function handleDropItem(dispatch: React.Dispatch<AppAction>, payload: DropItemPayload): void;
interface HandleHarvestProps {
    action: Action;
    gameState: GameState;
    dispatch: React.Dispatch<AppAction>;
    addMessage: AddMessageFn;
    addGeminiLog: AddGeminiLogFn;
}
export declare function handleHarvestResource({ action, gameState, dispatch, addMessage, addGeminiLog }: HandleHarvestProps): Promise<void>;
export {};
