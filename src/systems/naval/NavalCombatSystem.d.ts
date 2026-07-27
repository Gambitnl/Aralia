/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/systems/naval/NavalCombatSystem.ts
 * System for managing naval combat state, turns, and maneuver resolution.
 */
import { Ship } from '../../types/naval';
import { NavalCombatState, NavalCombatResult, CombatRange } from '../../types/navalCombat';
export declare class NavalCombatSystem {
    private state;
    constructor(initialState?: NavalCombatState);
    getState(): NavalCombatState;
    /**
     * Initializes a duel between two ships.
     * Starts at Medium range (2000ft).
     */
    initializeDuel(ship1: Ship, ship2: Ship): void;
    private createShipState;
    private randomWindDirection;
    getDistance(shipId1: string, shipId2: string): number;
    getRangeCategory(distance: number): CombatRange;
    /**
     * Executes a maneuver for a specific ship.
     */
    executeManeuver(attackerId: string, maneuverId: string, targetId?: string): NavalCombatResult;
    private applySuccessEffect;
    private applyFailureEffect;
    private dealDamage;
    private addStatusEffect;
    endRound(): void;
    private log;
}
