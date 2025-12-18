/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/utils/navalCombatUtils.ts
 * Logic for resolving naval combat maneuvers and state updates.
 */

import { Ship, ShipStats } from '../types/naval';
import {
    NavalCombatState,
    NavalManeuver,
    NavalCombatResult,
    CombatShipState,
    CombatRange,
    WindDirection
} from '../types/navalCombat';
import { calculateShipStats } from './navalUtils';

/**
 * Initializes a new combat encounter.
 */
export function initializeNavalCombat(ships: Ship[], windDirection: WindDirection = 'North'): NavalCombatState {
    const shipStates: Record<string, CombatShipState> = {};

    ships.forEach(ship => {
        shipStates[ship.id] = {
            ship,
            currentSpeed: calculateShipStats(ship).speed,
            currentHullPoints: ship.stats.hullPoints,
            currentCrew: ship.crew.members.length,
            activeEffects: [],
            cooldowns: {},
            position: 0, // Default start
            heading: 'North',
        };
    });

    return {
        ships: shipStates,
        round: 1,
        windDirection,
        windSpeed: 1, // Breeze
        log: [{ round: 0, message: 'Combat initialized.', type: 'Info' }]
    };
}

/**
 * Calculates the relative range between two ships.
 * Simplified for this implementation.
 */
export function getRange(shipA: CombatShipState, shipB: CombatShipState): CombatRange {
    const dist = Math.abs(shipA.position - shipB.position);
    if (dist < 10) return 'Boarding';
    if (dist < 50) return 'Short';
    if (dist < 200) return 'Medium';
    return 'Long';
}

/**
 * Resolves a chosen maneuver.
 */
export function resolveManeuver(
    state: NavalCombatState,
    maneuver: NavalManeuver,
    sourceShipId: string,
    targetShipId: string
): NavalCombatResult {
    const source = state.ships[sourceShipId];
    const target = state.ships[targetShipId];

    if (!source || !target) {
        return { success: false, roll: 0, details: 'Invalid ship ID', stateUpdates: {} };
    }

    // Check Cooldown
    if (source.cooldowns[maneuver.id] > 0) {
        return { success: false, roll: 0, details: 'Maneuver on cooldown', stateUpdates: {} };
    }

    // Check Requirements
    if (maneuver.requirements.minCrew && source.currentCrew < maneuver.requirements.minCrew) {
        return { success: false, roll: 0, details: 'Insufficient crew', stateUpdates: {} };
    }

    const range = getRange(source, target);
    if (maneuver.requirements.range && !maneuver.requirements.range.includes(range)) {
        return { success: false, roll: 0, details: `Out of range (${range})`, stateUpdates: {} };
    }

    // Roll logic (d20 + modifiers)
    // Modifier could come from Crew Quality or Captain's skill
    // Simplified: Crew Quality 'Average' = +0, 'Elite' = +4
    const qualityBonus = getCrewQualityBonus(source.ship.crew.quality);
    const roll = Math.floor(Math.random() * 20) + 1 + qualityBonus;
    const success = roll >= maneuver.difficulty;

    let resultDetails = success ? maneuver.successEffect : maneuver.failureEffect;
    let damage = 0;
    const updates: Partial<NavalCombatState> = { ships: { ...state.ships } };
    const updatedSource = { ...source };
    const updatedTarget = { ...target };

    // Apply Specific Maneuver Logic
    if (success) {
        switch (maneuver.id) {
            case 'BROADSIDE':
                // Calculate damage based on ship weapons
                // Simplification: 1d10 per weapon slot (or 3d10 standard)
                damage = Math.floor(Math.random() * 10) + 1 + Math.floor(Math.random() * 10) + 1;
                updatedTarget.currentHullPoints -= damage;
                resultDetails += ` Dealt ${damage} damage.`;
                break;
            case 'RAMMING_SPEED':
                damage = 50;
                updatedTarget.currentHullPoints -= damage;
                updatedSource.currentHullPoints -= 10; // Self damage
                break;
            case 'FULL_SAIL':
                updatedSource.currentSpeed *= 1.5;
                break;
            case 'REPAIR':
                const heal = 20;
                updatedSource.currentHullPoints = Math.min(
                    updatedSource.ship.stats.maxHullPoints,
                    updatedSource.currentHullPoints + heal
                );
                break;
            case 'BOARDING_PARTY':
                updatedSource.grappledWith = [...(updatedSource.grappledWith || []), targetShipId];
                updatedTarget.grappledWith = [...(updatedTarget.grappledWith || []), sourceShipId];
                break;
        }
    }

    // Set Cooldown
    updatedSource.cooldowns[maneuver.id] = maneuver.cooldown;

    // Apply updates
    updates.ships![sourceShipId] = updatedSource;
    updates.ships![targetShipId] = updatedTarget;

    // Add log
    const logEntry = {
        round: state.round,
        message: `${source.ship.name} used ${maneuver.name}: ${success ? 'Success' : 'Failure'}. ${resultDetails}`,
        type: success ? 'Attack' : 'Info' as const
    };

    return {
        success,
        roll,
        details: resultDetails,
        damageDealt: damage,
        stateUpdates: updates // Note: In a real immutable reducer, this would be handled differently
    };
}

function getCrewQualityBonus(quality: string): number {
    switch (quality) {
        case 'Poor': return -2;
        case 'Average': return 0;
        case 'Experienced': return 2;
        case 'Veteran': return 4;
        case 'Elite': return 6;
        default: return 0;
    }
}
