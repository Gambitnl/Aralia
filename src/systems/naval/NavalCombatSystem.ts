/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/systems/naval/NavalCombatSystem.ts
 * System for managing naval combat state, turns, and maneuver resolution.
 */

import { Ship, ShipStats } from '../../types/naval';
import {
    NavalCombatState,
    CombatShipState,
    NavalManeuver,
    NavalCombatResult,
    WindDirection,
    CombatRange,
    NavalStatusEffect,
    NavalCombatLogEntry
} from '../../types/navalCombat';
import { NAVAL_MANEUVERS } from '../../data/navalManeuvers';
import { rollDice, rollDamage } from '../../utils/combatUtils';
import { calculateShipStats } from '../../utils/navalUtils';

// Range Thresholds in feet
const RANGES = {
    BOARDING: 100,
    SHORT: 1000,
    MEDIUM: 3000,
    LONG: 5000
};

export class NavalCombatSystem {
    private state: NavalCombatState;

    constructor(initialState?: NavalCombatState) {
        if (initialState) {
            this.state = initialState;
        } else {
            this.state = {
                ships: {},
                round: 1,
                windDirection: 'North',
                windSpeed: 1, // Breeze
                log: []
            };
        }
    }

    public getState(): NavalCombatState {
        return this.state;
    }

    /**
     * Initializes a duel between two ships.
     * Starts at Medium range (2000ft).
     */
    public initializeDuel(ship1: Ship, ship2: Ship): void {
        const state1 = this.createShipState(ship1, 0);
        const state2 = this.createShipState(ship2, 2000); // 2000ft separation

        this.state = {
            ships: {
                [ship1.id]: state1,
                [ship2.id]: state2
            },
            round: 1,
            windDirection: this.randomWindDirection(),
            windSpeed: 1,
            log: [{
                round: 1,
                message: `Combat initialized between ${ship1.name} and ${ship2.name}. Distance: 2000ft.`,
                type: 'Info'
            }]
        };
    }

    private createShipState(ship: Ship, position: number): CombatShipState {
        const stats = calculateShipStats(ship);
        return {
            ship,
            currentSpeed: stats.speed,
            currentHullPoints: stats.hullPoints,
            currentCrew: ship.crew.members.length,
            activeEffects: [],
            cooldowns: {},
            position,
            heading: 'North', // Default
        };
    }

    private randomWindDirection(): WindDirection {
        const dirs: WindDirection[] = ['North', 'South', 'East', 'West', 'NorthEast', 'NorthWest', 'SouthEast', 'SouthWest'];
        return dirs[Math.floor(Math.random() * dirs.length)];
    }

    public getDistance(shipId1: string, shipId2: string): number {
        const s1 = this.state.ships[shipId1];
        const s2 = this.state.ships[shipId2];
        if (!s1 || !s2) return 0;
        return Math.abs(s1.position - s2.position);
    }

    public getRangeCategory(distance: number): CombatRange {
        if (distance <= RANGES.BOARDING) return 'Boarding';
        if (distance <= RANGES.SHORT) return 'Short';
        if (distance <= RANGES.MEDIUM) return 'Medium';
        return 'Long';
    }

    /**
     * Executes a maneuver for a specific ship.
     */
    public executeManeuver(attackerId: string, maneuverId: string, targetId?: string): NavalCombatResult {
        const attacker = this.state.ships[attackerId];
        if (!attacker) return { success: false, roll: 0, details: 'Attacker not found', stateUpdates: {} };

        const maneuver = NAVAL_MANEUVERS[maneuverId];
        if (!maneuver) return { success: false, roll: 0, details: 'Maneuver not found', stateUpdates: {} };

        // 1. Check Cooldowns
        if (attacker.cooldowns[maneuverId] > 0) {
             return { success: false, roll: 0, details: `Maneuver on cooldown (${attacker.cooldowns[maneuverId]} rounds)`, stateUpdates: {} };
        }

        // 2. Check Range (if target)
        if (targetId && maneuver.requirements.range) {
            const distance = this.getDistance(attackerId, targetId);
            const rangeCat = this.getRangeCategory(distance);
            if (!maneuver.requirements.range.includes(rangeCat)) {
                 return { success: false, roll: 0, details: `Target out of range (${rangeCat}). Requires: ${maneuver.requirements.range.join(', ')}`, stateUpdates: {} };
            }
        }

        // 3. Roll for Success
        // Modifier: Captain's skill or Bosun's skill could go here.
        // For now, we use ship maneuverability + d20.
        const d20 = rollDice('1d20');
        const modifier = attacker.ship.stats.maneuverability;
        const total = d20 + modifier;
        const success = total >= maneuver.difficulty;

        const result: NavalCombatResult = {
            success,
            roll: total,
            details: success ? `Success! (${total} vs DC ${maneuver.difficulty})` : `Failed. (${total} vs DC ${maneuver.difficulty})`,
            stateUpdates: {}
        };

        this.log(`${attacker.ship.name} attempts ${maneuver.name}: ${result.details}`, 'Maneuver');

        // 4. Apply Effects
        if (success) {
            this.applySuccessEffect(maneuverId, attackerId, targetId, result);
        } else {
            this.applyFailureEffect(maneuverId, attackerId, targetId, result);
        }

        // Set Cooldown
        attacker.cooldowns[maneuverId] = maneuver.cooldown + 1; // +1 because it ticks down at end of round

        return result;
    }

    private applySuccessEffect(maneuverId: string, attackerId: string, targetId: string | undefined, result: NavalCombatResult) {
        const attacker = this.state.ships[attackerId];

        switch (maneuverId) {
            case 'FULL_SAIL':
                this.addStatusEffect(attackerId, {
                    id: 'full_sail_boost',
                    name: 'Full Sail',
                    duration: 1,
                    effectType: 'Speed',
                    value: 1.5 // 50% boost
                });
                break;

            case 'EVASIVE_MANEUVERS':
                this.addStatusEffect(attackerId, {
                    id: 'evasive',
                    name: 'Evasive',
                    duration: 1,
                    effectType: 'Defense',
                    value: 4 // +4 AC
                });
                break;

            case 'BROADSIDE':
                if (targetId) {
                    // Calculate damage based on ship weapons.
                    // Simplified: 3d10 per cannon slot (default 2 for now if empty)
                    // Or iterate weapons.
                    let damage = 0;
                    if (attacker.ship.weapons.length > 0) {
                        attacker.ship.weapons.forEach(w => {
                            damage += rollDamage(w.damage, false);
                        });
                    } else {
                        // Fallback generic cannons
                        damage = rollDamage('4d10', false);
                    }

                    this.dealDamage(targetId, damage);
                    result.damageDealt = damage;
                    result.details += ` Dealt ${damage} damage!`;
                }
                break;

            case 'RAMMING_SPEED':
                if (targetId) {
                    // Attacker deals massive damage but takes some too
                    const damage = rollDamage('8d10', false);
                    const selfDamage = rollDamage('2d10', false);

                    this.dealDamage(targetId, damage);
                    this.dealDamage(attackerId, selfDamage);

                    result.damageDealt = damage;
                    result.details += ` RAM! Dealt ${damage}, took ${selfDamage}.`;
                }
                break;

            case 'REPAIR':
                const heal = rollDamage('2d10', false) + 10;
                attacker.currentHullPoints = Math.min(attacker.ship.stats.maxHullPoints, attacker.currentHullPoints + heal);
                result.details += ` Repaired ${heal} HP.`;
                break;

            case 'BOARDING_PARTY':
                if (targetId) {
                    this.addStatusEffect(targetId, {
                        id: 'grappled',
                        name: 'Grappled',
                        duration: 3,
                        effectType: 'Speed',
                        value: 0 // Stop movement
                    });
                    this.addStatusEffect(attackerId, {
                        id: 'grappled_self',
                        name: 'Grappled',
                        duration: 3,
                        effectType: 'Speed',
                        value: 0
                    });
                    result.details += ` Ships are now grappled!`;
                }
                break;
        }
    }

    private applyFailureEffect(maneuverId: string, attackerId: string, targetId: string | undefined, result: NavalCombatResult) {
         // Specialized failure logic
         if (maneuverId === 'RAMMING_SPEED') {
             const selfDamage = rollDamage('1d10', false);
             this.dealDamage(attackerId, selfDamage);
             result.details += ` Missed ram, took ${selfDamage} stress damage.`;
         }
    }

    private dealDamage(shipId: string, amount: number) {
        const ship = this.state.ships[shipId];
        if (ship) {
            ship.currentHullPoints = Math.max(0, ship.currentHullPoints - amount);
            this.log(`${ship.ship.name} takes ${amount} damage!`, 'Attack');

            if (ship.currentHullPoints === 0) {
                this.log(`${ship.ship.name} has been destroyed!`, 'Info');
            }
        }
    }

    private addStatusEffect(shipId: string, effect: NavalStatusEffect) {
        const ship = this.state.ships[shipId];
        if (ship) {
            // Remove existing effect with same ID to refresh
            ship.activeEffects = ship.activeEffects.filter(e => e.id !== effect.id);
            ship.activeEffects.push(effect);
        }
    }

    public endRound() {
        this.state.round++;
        this.log(`Round ${this.state.round} begins.`, 'Info');

        // Update Cooldowns and Effects
        Object.values(this.state.ships).forEach(ship => {
            // Tick cooldowns
            for (const key in ship.cooldowns) {
                if (ship.cooldowns[key] > 0) ship.cooldowns[key]--;
            }

            // Tick effects
            ship.activeEffects.forEach(e => e.duration--);
            ship.activeEffects = ship.activeEffects.filter(e => e.duration > 0);
        });

        // TODO: Move ships based on speed?
        // This would require an 'Intention' phase which we are simplifying out for now.
    }

    private log(message: string, type: NavalCombatLogEntry['type']) {
        this.state.log.push({
            round: this.state.round,
            message,
            type
        });
    }
}
