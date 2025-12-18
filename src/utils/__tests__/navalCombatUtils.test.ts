/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/utils/__tests__/navalCombatUtils.test.ts
 * Tests for naval combat maneuvers.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { initializeNavalCombat, resolveManeuver } from '../navalCombatUtils';
import { NAVAL_MANEUVERS } from '../../data/navalManeuvers';
import { createShip } from '../navalUtils';
import { CrewMember } from '../../types/naval';

describe('Naval Combat Utils', () => {
    let ship1 = createShip('Interceptor', 'Sloop');
    let ship2 = createShip('Black Pearl', 'Galleon');

    // Helper to add dummy crew
    const addDummyCrew = (ship: any, count: number) => {
        const newMembers: CrewMember[] = [];
        for (let i = 0; i < count; i++) {
            newMembers.push({
                id: `crew-${i}`,
                name: `Crew ${i}`,
                role: 'Sailor',
                skills: {},
                morale: 100,
                loyalty: 100,
                dailyWage: 1,
                traits: []
            });
        }
        ship.crew.members = newMembers;
    };

    beforeEach(() => {
        ship1 = createShip('Interceptor', 'Sloop');
        ship2 = createShip('Black Pearl', 'Galleon');
        addDummyCrew(ship1, 20); // Sufficient for all maneuvers
        addDummyCrew(ship2, 50);
    });

    it('initializes combat correctly', () => {
        const state = initializeNavalCombat([ship1, ship2]);
        expect(state.ships[ship1.id]).toBeDefined();
        expect(state.ships[ship1.id].currentCrew).toBe(20);
        expect(state.ships[ship2.id]).toBeDefined();
        expect(state.round).toBe(1);
    });

    it('resolves BROADSIDE maneuver correctly', () => {
        const state = initializeNavalCombat([ship1, ship2]);

        // Force positions to be close for Short range
        state.ships[ship1.id].position = 100;
        state.ships[ship2.id].position = 120; // Dist 20 = Short

        const result = resolveManeuver(state, NAVAL_MANEUVERS.BROADSIDE, ship1.id, ship2.id);

        // Since it's RNG, we check if it handled success/failure structure
        expect(result.roll).toBeGreaterThan(0);
        if (result.success) {
            expect(result.damageDealt).toBeGreaterThan(0);
            expect(result.stateUpdates.ships![ship2.id].currentHullPoints).toBeLessThan(ship2.stats.maxHullPoints);
        } else {
            expect(result.damageDealt).toBe(0);
        }
    });

    it('fails maneuver if out of range', () => {
        const state = initializeNavalCombat([ship1, ship2]);

        // Force positions to be far
        state.ships[ship1.id].position = 0;
        state.ships[ship2.id].position = 1000; // Long

        // RAMMING_SPEED requires Short range
        const result = resolveManeuver(state, NAVAL_MANEUVERS.RAMMING_SPEED, ship1.id, ship2.id);
        expect(result.success).toBe(false);
        expect(result.details).toContain('Out of range');
    });

    it('fails maneuver if insufficient crew', () => {
        const state = initializeNavalCombat([ship1, ship2]);
        // Manually reduce crew in state to simulate loss or understaffing
        state.ships[ship1.id].currentCrew = 1; // Too few for Full Sail (needs 5)

        const result = resolveManeuver(state, NAVAL_MANEUVERS.FULL_SAIL, ship1.id, ship2.id);
        expect(result.success).toBe(false);
        expect(result.details).toContain('Insufficient crew');
    });
});
