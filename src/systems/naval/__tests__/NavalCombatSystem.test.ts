
import { describe, it, expect, beforeEach } from 'vitest';
import { NavalCombatSystem } from '../NavalCombatSystem';
import { createShip } from '../../../utils/navalUtils';
import { NAVAL_MANEUVERS } from '../../../data/navalManeuvers';

describe('NavalCombatSystem', () => {
    let system: NavalCombatSystem;
    const ship1 = createShip('HMS Victory', 'Frigate');
    const ship2 = createShip('The Black Pearl', 'Sloop');

    beforeEach(() => {
        system = new NavalCombatSystem();
        system.initializeDuel(ship1, ship2);
    });

    it('should initialize combat correctly', () => {
        const state = system.getState();
        expect(state.ships[ship1.id]).toBeDefined();
        expect(state.ships[ship2.id]).toBeDefined();
        expect(state.round).toBe(1);

        // Check initial distance
        expect(system.getDistance(ship1.id, ship2.id)).toBe(2000);
        expect(system.getRangeCategory(2000)).toBe('Medium');
    });

    it('should execute FULL_SAIL maneuver', () => {
        const result = system.executeManeuver(ship1.id, 'FULL_SAIL');
        expect(result.roll).toBeGreaterThan(0);

        if (result.success) {
            const shipState = system.getState().ships[ship1.id];
            expect(shipState.activeEffects).toEqual(
                expect.arrayContaining([expect.objectContaining({ id: 'full_sail_boost' })])
            );
        }

        // Check Cooldown
        const shipState = system.getState().ships[ship1.id];
        expect(shipState.cooldowns['FULL_SAIL']).toBeGreaterThan(0);
    });

    it('should fail if maneuver is on cooldown', () => {
        system.executeManeuver(ship1.id, 'FULL_SAIL');
        const result = system.executeManeuver(ship1.id, 'FULL_SAIL');
        expect(result.success).toBe(false);
        expect(result.details).toContain('cooldown');
    });

    it('should check range requirements for BROADSIDE', () => {
        // NOTE: Broadside has a cooldown of 1 round.
        // We must ensure we haven't fired it before in this test.
        // Since `beforeEach` resets the system, we are clean.

        // Initial distance is 2000 (Medium). Broadside allows Medium.
        const result = system.executeManeuver(ship1.id, 'BROADSIDE', ship2.id);

        // The first execution might put it on cooldown!
        // So we can't test "range failure" with the SAME ship immediately if we successfully fired.

        // Resetting for the "out of range" test part
        // We create a NEW system or just new ships to test the failure case cleanly without cooldowns interfering.

        const freshSystem = new NavalCombatSystem();
        const s1 = createShip('S1', 'Sloop');
        const s2 = createShip('S2', 'Sloop');

        // Manually place them far apart
        freshSystem.initializeDuel(s1, s2);
        // Force position update to 10000
        freshSystem.getState().ships[s2.id].position = 10000;

        const failResult = freshSystem.executeManeuver(s1.id, 'BROADSIDE', s2.id);
        expect(failResult.success).toBe(false);
        expect(failResult.details).toContain('out of range');
    });

    it('should deal damage on successful BROADSIDE', () => {
        const result = system.executeManeuver(ship1.id, 'BROADSIDE', ship2.id);

        if (result.success) {
            expect(result.damageDealt).toBeGreaterThan(0);

            // Check target HP reduced
            const targetState = system.getState().ships[ship2.id];
            expect(targetState.currentHullPoints).toBeLessThan(targetState.ship.stats.maxHullPoints);
        }
    });

    it('should handle end of round cleanup', () => {
        system.executeManeuver(ship1.id, 'FULL_SAIL');

        expect(system.getState().ships[ship1.id].cooldowns['FULL_SAIL']).toBe(1);

        system.endRound();

        expect(system.getState().ships[ship1.id].cooldowns['FULL_SAIL']).toBe(0);
        expect(system.getState().round).toBe(2);
    });
});
