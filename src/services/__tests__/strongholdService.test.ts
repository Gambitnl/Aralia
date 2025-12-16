import { describe, it, expect } from 'vitest';
import { createStronghold, recruitStaff, fireStaff, processDailyUpkeep } from '../strongholdService';
import { Stronghold, StaffRole } from '../../types/stronghold';

describe('StrongholdService', () => {
    it('should create a stronghold with default resources', () => {
        const castle = createStronghold('My Castle', 'castle', 'loc-123');
        expect(castle.name).toBe('My Castle');
        expect(castle.type).toBe('castle');
        expect(castle.resources.gold).toBe(1000);
        expect(castle.staff.length).toBe(0);
    });

    it('should recruit staff correctly', () => {
        let castle = createStronghold('My Castle', 'castle', 'loc-123');
        castle = recruitStaff(castle, 'Jeeves', 'steward');

        expect(castle.staff.length).toBe(1);
        expect(castle.staff[0].name).toBe('Jeeves');
        expect(castle.staff[0].role).toBe('steward');
        expect(castle.staff[0].morale).toBe(100);
    });

    it('should fire staff correctly', () => {
        let castle = createStronghold('My Castle', 'castle', 'loc-123');
        castle = recruitStaff(castle, 'Jeeves', 'steward');
        const staffId = castle.staff[0].id;

        castle = fireStaff(castle, staffId);
        expect(castle.staff.length).toBe(0);
    });

    it('should process daily income', () => {
        let castle = createStronghold('My Castle', 'castle', 'loc-123');
        // Base income is 10
        const result = processDailyUpkeep(castle);

        expect(result.summary.goldChange).toBe(10);
        expect(result.updatedStronghold.resources.gold).toBe(1010);
    });

    it('should pay wages and reduce gold', () => {
        let castle = createStronghold('My Castle', 'castle', 'loc-123');
        castle = recruitStaff(castle, 'Guard 1', 'guard'); // Wage 5

        // Base income 10, Wage 5 => Net +5
        const result = processDailyUpkeep(castle);

        expect(result.summary.goldChange).toBe(5);
        expect(result.updatedStronghold.resources.gold).toBe(1005);
    });

    it('should reduce morale when unpaid and staff should quit eventually', () => {
        let castle = createStronghold('My Castle', 'castle', 'loc-123');
        castle.resources.gold = 0; // Broke
        castle.dailyIncome = 0; // No income

        castle = recruitStaff(castle, 'Angry Guard', 'guard'); // Wage 5

        // Day 1: Unpaid, morale drops by 20 -> 80
        let result = processDailyUpkeep(castle);
        expect(result.updatedStronghold.staff[0].morale).toBe(80);
        expect(result.summary.staffEvents).toContain('Angry Guard (guard) was not paid. Morale dropped.');

        // Fast forward 4 more days (80 -> 60 -> 40 -> 20 -> 0)
        let currentCastle = result.updatedStronghold;
        for (let i = 0; i < 4; i++) {
             const r = processDailyUpkeep(currentCastle);
             currentCastle = r.updatedStronghold;
        }

        // Morale should be 0 now (or just quit)
        // Day 6: Quits
        result = processDailyUpkeep(currentCastle);
        expect(result.updatedStronghold.staff.length).toBe(0);
        expect(result.summary.staffEvents).toContain('Angry Guard quit due to lack of payment!');
    });

    it('should apply steward wage reduction', () => {
        let castle = createStronghold('My Castle', 'castle', 'loc-123');
        castle = recruitStaff(castle, 'Steward', 'steward'); // Wage 10
        castle = recruitStaff(castle, 'Guard', 'guard'); // Wage 5

        // Total base wages: 15
        // Steward effect: 5% reduction
        // Steward wage: 10 * 0.95 = 9.5 -> 9
        // Guard wage: 5 * 0.95 = 4.75 -> 4
        // Total: 13

        // Net change: Income (10) - Wages (13) = -3

        const result = processDailyUpkeep(castle);
        expect(result.summary.goldChange).toBe(-3);
    });
});
