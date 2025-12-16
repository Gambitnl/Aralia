import { describe, it, expect } from 'vitest';
import { createStronghold, recruitStaff, fireStaff, processDailyUpkeep, startConstruction, getAvailableUpgrades } from '../strongholdService';
import { Stronghold, StaffRole } from '../../types/stronghold';

describe('StrongholdService', () => {
    it('should create a stronghold with default resources', () => {
        const castle = createStronghold('My Castle', 'castle', 'loc-123');
        expect(castle.name).toBe('My Castle');
        expect(castle.type).toBe('castle');
        expect(castle.resources.gold).toBe(1000);
        expect(castle.staff.length).toBe(0);
        expect(castle.upgrades.length).toBe(0);
        expect(castle.constructionQueue.length).toBe(0);
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

        // Fast forward 3 more days (80 -> 60 -> 40 -> 20)
        let currentCastle = result.updatedStronghold;
        for (let i = 0; i < 3; i++) {
             const r = processDailyUpkeep(currentCastle);
             currentCastle = r.updatedStronghold;
        }

        // Day 5: Morale 20 -> 0. Quits.
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

    describe('Construction System', () => {
        it('should show available upgrades', () => {
            const castle = createStronghold('My Castle', 'castle', 'loc-1');
            const upgrades = getAvailableUpgrades(castle);
            expect(upgrades.some(u => u.id === 'barracks')).toBe(true);
            expect(upgrades.some(u => u.id === 'market_stall')).toBe(true);
        });

        it('should start construction and deduct gold', () => {
            let castle = createStronghold('My Castle', 'castle', 'loc-1');
            const initialGold = castle.resources.gold;
            // Market stall cost: 300
            castle = startConstruction(castle, 'market_stall');

            expect(castle.resources.gold).toBe(initialGold - 300);
            expect(castle.constructionQueue.length).toBe(1);
            expect(castle.constructionQueue[0].upgradeId).toBe('market_stall');
            expect(castle.constructionQueue[0].daysRemaining).toBe(3); // Based on catalog
        });

        it('should advance construction daily', () => {
            let castle = createStronghold('My Castle', 'castle', 'loc-1');
            castle = startConstruction(castle, 'market_stall'); // 3 days

            const result = processDailyUpkeep(castle);
            const updated = result.updatedStronghold;

            expect(updated.constructionQueue[0].daysRemaining).toBe(2);
            expect(updated.upgrades.length).toBe(0);
        });

        it('should complete construction after days pass', () => {
            let castle = createStronghold('My Castle', 'castle', 'loc-1');
            castle = startConstruction(castle, 'market_stall'); // 3 days

            // Advance 3 days
            let current = castle;
            for(let i=0; i<3; i++) {
                current = processDailyUpkeep(current).updatedStronghold;
            }

            expect(current.constructionQueue.length).toBe(0);
            expect(current.upgrades).toContain('market_stall');
        });

        it('should apply upgrade effects (income bonus)', () => {
            let castle = createStronghold('My Castle', 'castle', 'loc-1');
            // Force add upgrade without waiting
            castle.upgrades.push('market_stall'); // +15 gold/day, cost 2 gold/day maint

            // Base income: 10
            // Market bonus: +15
            // Maintenance: -2
            // Total net: 23

            const result = processDailyUpkeep(castle);

            expect(result.summary.goldChange).toBe(23);
        });

        it('should prevent duplicate upgrades', () => {
             let castle = createStronghold('My Castle', 'castle', 'loc-1');
             castle = startConstruction(castle, 'market_stall');

             // Try to start again
             expect(() => startConstruction(castle, 'market_stall')).toThrow();
        });

        it('should prevent unaffordable upgrades', () => {
             let castle = createStronghold('My Castle', 'castle', 'loc-1');
             castle.resources.gold = 10;

             expect(() => startConstruction(castle, 'barracks')).toThrow(/Insufficient funds/);
        });
    });
});
