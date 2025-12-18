import { describe, it, expect, vi } from 'vitest';
import {
    createStronghold,
    recruitStaff,
    fireStaff,
    processDailyUpkeep,
    getAvailableUpgrades,
    purchaseUpgrade,
    calculateDefense,
    generateThreat,
    resolveThreat,
    startMission,
    UPGRADE_CATALOG
} from '../strongholdService';
import { Stronghold, ActiveThreat } from '../../types/stronghold';

describe('StrongholdService', () => {
    it('should create a stronghold with default resources and empty upgrades', () => {
        const castle = createStronghold('My Castle', 'castle', 'loc-123');
        expect(castle.name).toBe('My Castle');
        expect(castle.resources.gold).toBe(1000);
        expect(castle.upgrades).toEqual([]);
        expect(castle.constructionQueue).toEqual([]);
        expect(castle.threats).toEqual([]);
        expect(castle.missions).toEqual([]);
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

        it('should prevent firing staff on mission', () => {
            let castle = createStronghold('My Castle', 'castle', 'loc-123');
            castle = recruitStaff(castle, 'Agent', 'spy');
            const staffId = castle.staff[0].id;

            castle = startMission(castle, staffId, 'scout', 10, 'Spying');

            expect(() => fireStaff(castle, staffId)).toThrow('Cannot fire staff currently on a mission');
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

    describe('Threats', () => {
        it('should calculate defense correctly', () => {
            let castle = createStronghold('My Castle', 'castle', 'loc-123');
            expect(calculateDefense(castle)).toBe(10); // Base

            // Add Guard Tower (+5)
            castle.upgrades.push('guard_tower');
            expect(calculateDefense(castle)).toBe(15);

            // Add Guard staff (+5)
            castle = recruitStaff(castle, 'Guard Bob', 'guard');
            expect(calculateDefense(castle)).toBe(20);
        });

        it('should resolve threats successfully when defense is high', () => {
            const castle = createStronghold('Strong Castle', 'castle', 'loc-1');
            // High defense
            castle.upgrades.push('guard_tower', 'barracks'); // +20
            // recruitStaff helper adds to staff array
            castle.staff.push({ id: '1', name: 'G1', role: 'guard', dailyWage: 5, morale: 100, skills: {} });
            castle.staff.push({ id: '2', name: 'G2', role: 'guard', dailyWage: 5, morale: 100, skills: {} });
            // Total defense: 10 + 20 + 10 = 40

            const threat: ActiveThreat = {
                id: 't1',
                name: 'Weak Bandits',
                description: '...',
                type: 'bandits',
                severity: 20, // Low severity
                daysUntilTrigger: 0,
                resolved: false,
                consequences: { goldLoss: 100 }
            };

            const result = resolveThreat(castle, threat);
            expect(result.success).toBe(true);
            expect(result.logs[0]).toContain('Defeated');
        });

        it('should fail to resolve threats when defense is low', () => {
            const castle = createStronghold('Weak Hut', 'castle', 'loc-1');
            // Base defense 10

            const threat: ActiveThreat = {
                id: 't1',
                name: 'Dragon',
                description: '...',
                type: 'monster',
                severity: 100, // Impossible to beat with base defense
                daysUntilTrigger: 0,
                resolved: false,
                consequences: { goldLoss: 1000 }
            };

            const result = resolveThreat(castle, threat);
            expect(result.success).toBe(false);
            expect(result.logs[0]).toContain('Failed');
        });

        it('should apply threat consequences in daily upkeep', () => {
            let castle = createStronghold('My Castle', 'castle', 'loc-123');
            castle.resources.gold = 2000;

            // Add a threat about to trigger
            const threat: ActiveThreat = {
                id: 't1',
                name: 'Tax Collector',
                description: '...',
                type: 'political',
                severity: 100, // Ensure failure
                daysUntilTrigger: 1, // Will trigger this turn
                resolved: false,
                consequences: { goldLoss: 500, suppliesLoss: 0, moraleLoss: 0 }
            };
            castle.threats.push(threat);

            const result = processDailyUpkeep(castle);

            // Should fail and lose gold
            expect(result.updatedStronghold.resources.gold).toBeLessThan(2000);
            expect(result.summary.threatEvents.some(e => e.includes('Lost 500 gold'))).toBe(true);
            // Threat should be removed
            expect(result.updatedStronghold.threats.length).toBe(0);
        });

        it('should generate new threats occasionally', () => {
             // Mock Math.random to force threat generation
             const originalRandom = Math.random;
             Math.random = () => 0.05; // Force threat (threshold 0.1)

             let castle = createStronghold('My Castle', 'castle', 'loc-123');
             const result = processDailyUpkeep(castle);

             expect(result.updatedStronghold.threats.length).toBe(1);
             expect(result.summary.threatEvents[0]).toContain('New Threat');

             // Restore random
             Math.random = originalRandom;
        });
    });

    describe('Missions', () => {
        it('should start a mission correctly', () => {
            let castle = createStronghold('Castle', 'castle', 'loc-1');
            castle = recruitStaff(castle, 'Spy Master', 'spy');
            const staffId = castle.staff[0].id;

            castle = startMission(castle, staffId, 'scout', 50, 'Scout Area');

            expect(castle.missions.length).toBe(1);
            expect(castle.missions[0].type).toBe('scout');
            expect(castle.staff[0].currentMissionId).toBe(castle.missions[0].id);
            expect(castle.resources.supplies).toBe(90); // 100 - 10
        });

        it('should prevent starting mission if busy', () => {
             let castle = createStronghold('Castle', 'castle', 'loc-1');
             castle = recruitStaff(castle, 'Spy Master', 'spy');
             const staffId = castle.staff[0].id;

             castle = startMission(castle, staffId, 'scout', 50, 'Scout 1');
             expect(() => startMission(castle, staffId, 'trade', 10, 'Trade 1')).toThrow('Staff already on mission');
        });

        it('should resolve mission in daily upkeep', () => {
            let castle = createStronghold('Castle', 'castle', 'loc-1');
            castle = recruitStaff(castle, 'Merchant', 'merchant');
            const staffId = castle.staff[0].id;

            // Mock Math.random for predictable duration (min 2 days)
            // But checking upkeep multiple times is safer
            castle = startMission(castle, staffId, 'trade', 10, 'Trade Run');
            // Force duration to 1 day for test
            castle.missions[0].daysRemaining = 1;

            const result = processDailyUpkeep(castle);

            expect(result.updatedStronghold.missions.length).toBe(0); // Completed
            expect(result.summary.missionEvents.length).toBe(1);
            expect(result.updatedStronghold.staff[0].currentMissionId).toBeUndefined(); // Staff freed
        });

        it('should fail mission if staff quits', () => {
             let castle = createStronghold('Castle', 'castle', 'loc-1');
             castle = recruitStaff(castle, 'Deserter', 'guard');
             const staffId = castle.staff[0].id;

             castle = startMission(castle, staffId, 'raid', 10, 'Raid');

             // Remove staff manually to simulate firing/death/glitch before upkeep
             castle.staff = [];

             const result = processDailyUpkeep(castle);

             expect(result.updatedStronghold.missions.length).toBe(0); // Removed
             expect(result.summary.missionEvents[0]).toContain('Cancelled');
        });
    });
});
