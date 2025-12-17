import { describe, it, expect } from 'vitest';
import {
    createStronghold,
    recruitStaff,
    fireStaff,
    processDailyUpkeep,
    getAvailableUpgrades,
    purchaseUpgrade,
    UPGRADE_CATALOG
} from '../strongholdService';
import { Stronghold } from '../../types/stronghold';

describe('StrongholdService', () => {
    it('should create a stronghold with default resources and empty upgrades', () => {
        const castle = createStronghold('My Castle', 'castle', 'loc-123');
        expect(castle.name).toBe('My Castle');
        expect(castle.resources.gold).toBe(1000);
        expect(castle.upgrades).toEqual([]);
        expect(castle.constructionQueue).toEqual([]);
    });

    describe('Staff Management', () => {
        it('should recruit staff correctly', () => {
            let castle = createStronghold('My Castle', 'castle', 'loc-123');
            castle = recruitStaff(castle, 'Jeeves', 'steward');

            expect(castle.staff.length).toBe(1);
            expect(castle.staff[0].name).toBe('Jeeves');
        });

        it('should fire staff correctly', () => {
            let castle = createStronghold('My Castle', 'castle', 'loc-123');
            castle = recruitStaff(castle, 'Jeeves', 'steward');
            const staffId = castle.staff[0].id;

            castle = fireStaff(castle, staffId);
            expect(castle.staff.length).toBe(0);
        });
    });

    describe('Upgrades', () => {
        it('should list available upgrades', () => {
            const castle = createStronghold('My Castle', 'castle', 'loc-123');
            const available = getAvailableUpgrades(castle);

            // Should contain basic upgrades like Market Stall
            expect(available.some(u => u.id === 'market_stall')).toBe(true);
            // Should NOT contain advanced upgrades like Marketplace (requires Market Stall)
            expect(available.some(u => u.id === 'marketplace')).toBe(false);
        });

        it('should purchase upgrade if affordable', () => {
            let castle = createStronghold('My Castle', 'castle', 'loc-123');
            // Market Stall costs 500 gold, 50 supplies. Castle starts with 1000/100.

            castle = purchaseUpgrade(castle, 'market_stall');

            expect(castle.upgrades).toContain('market_stall');
            expect(castle.resources.gold).toBe(500); // 1000 - 500
            expect(castle.resources.supplies).toBe(50); // 100 - 50
        });

        it('should throw error if not affordable', () => {
            let castle = createStronghold('My Castle', 'castle', 'loc-123');
            castle.resources.gold = 100; // Too poor

            expect(() => purchaseUpgrade(castle, 'market_stall')).toThrow('Not enough gold.');
        });

        it('should unlock prerequisites', () => {
            let castle = createStronghold('My Castle', 'castle', 'loc-123');
            // Give enough resources for both
            castle.resources.gold = 5000;
            castle.resources.supplies = 500;

            // Buy Prereq
            castle = purchaseUpgrade(castle, 'market_stall');

            // Check available again
            const available = getAvailableUpgrades(castle);
            expect(available.some(u => u.id === 'marketplace')).toBe(true);

            // Buy Advanced
            castle = purchaseUpgrade(castle, 'marketplace');
            expect(castle.upgrades).toContain('marketplace');
        });
    });

    describe('Daily Upkeep', () => {
        it('should apply upgrade income bonuses', () => {
            let castle = createStronghold('My Castle', 'castle', 'loc-123');
            // Base income 10

            // Add Market Stall (+15 income) manually to skip costs for this test
            castle.upgrades.push('market_stall');

            const result = processDailyUpkeep(castle);
            // 10 (Base) + 15 (Market Stall) = 25
            expect(result.summary.goldChange).toBe(25);
            expect(result.updatedStronghold.resources.gold).toBe(1000 + 25);
        });

        it('should apply upgrade influence bonuses', () => {
            let castle = createStronghold('My Castle', 'castle', 'loc-123');
            // Add Marketplace (+1 influence) - needs ID not full object logic here as we just check ID lookup
            castle.upgrades.push('marketplace');

            const result = processDailyUpkeep(castle);
            // Marketplace also adds +50 gold. Base 10 + 50 = 60 gold.
            // Influence +1
            expect(result.summary.influenceChange).toBe(1);
            expect(result.updatedStronghold.resources.influence).toBe(1);
        });

        it('should apply staff wages', () => {
            let castle = createStronghold('My Castle', 'castle', 'loc-123');
            castle = recruitStaff(castle, 'Guard 1', 'guard'); // Wage 5

            // Base income 10, Wage 5 => Net +5
            const result = processDailyUpkeep(castle);

            expect(result.summary.goldChange).toBe(5);
        });

        it('should handle staff quitting when unpaid', () => {
            let castle = createStronghold('My Castle', 'castle', 'loc-123');
            castle.resources.gold = 0;
            castle.dailyIncome = 0;

            castle = recruitStaff(castle, 'Angry Guard', 'guard');

            // Fast forward to quit point (morale drops 20 per day)
            // 100 -> 80 -> 60 -> 40 -> 20 -> 0 -> Quit
            // Needs 6 days
            let currentCastle = castle;
            for (let i = 0; i < 6; i++) {
                 const r = processDailyUpkeep(currentCastle);
                 currentCastle = r.updatedStronghold;
            }

            expect(currentCastle.staff.length).toBe(0);
        });
    });
});
