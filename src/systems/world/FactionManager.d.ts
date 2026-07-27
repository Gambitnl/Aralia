/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/world/FactionManager.ts
 * Centralizes faction reputation logic, ripple effects, and rumor generation.
 * Replaces scattered utility functions in factionUtils.ts for better encapsulation.
 */
import { GameState, GameMessage, WorldRumor, PlayerFactionStanding } from '../../types';
export interface ApplyReputationResult {
    standings: Record<string, PlayerFactionStanding>;
    logs: GameMessage[];
    rumors: WorldRumor[];
}
export declare class FactionManager {
    /**
     * Applies a reputation change and calculates ripple effects and rumors.
     * Does NOT mutate the input state.
     */
    static applyReputationChange(state: GameState, factionId: string, amount: number, reason: string): ApplyReputationResult;
    /**
     * Creates a WorldRumor based on a reputation change.
     */
    private static createRumor;
}
