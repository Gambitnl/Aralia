/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/companions/BanterManager.ts
 * Manages the selection and progression of companion banter.
 */
import { GameState } from '../../types';
import { BanterDefinition } from '../../types/companions';
export declare class BanterManager {
    /**
     * Selects a random valid banter based on current game state.
     * Does not manage active state, only selection.
     * Uses gameState.banterCooldowns for persistence.
     */
    static selectBanter(gameState: GameState): BanterDefinition | null;
}
