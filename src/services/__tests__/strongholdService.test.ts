import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    createStronghold,
    recruitStaff,
    fireStaff,
    processDailyUpkeep,
    processAllStrongholds,
    strongholdSummariesToMessages,
    getAvailableUpgrades,
    purchaseUpgrade,
    calculateDefense,
    // TODO(lint-intent): 'generateThreat' is unused in this test; use it in the assertion path or remove it.
    generateThreat as _generateThreat,
    resolveThreat,
    startMission,
    // TODO(lint-intent): 'UPGRADE_CATALOG' is unused in this test; use it in the assertion path or remove it.
    UPGRADE_CATALOG as _UPGRADE_CATALOG
} from '../strongholdService';
import { Stronghold, ActiveThreat, DailyUpdateSummary } from '../../types/stronghold';

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
            const castle = createStronghold('My Castle', 'castle', 'loc-123');
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
            const castle = createStronghold('My Castle', 'castle', 'loc-123');
            // Base income 10

            // Add Market Stall (+15 income) manually to skip costs for this test
            castle.upgrades.push('market_stall');

            const result = processDailyUpkeep(castle);
            // 10 (Base) + 15 (Market Stall) = 25
            expect(result.summary.goldChange).toBe(25);
            expect(result.updatedStronghold.resources.gold).toBe(1000 + 25);
        });

        it('should apply upgrade influence bonuses', () => {
            const castle = createStronghold('My Castle', 'castle', 'loc-123');
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
            // Mock Math.random to prevent random new threat generation during this test
            const originalRandom = Math.random;
            Math.random = () => 0.5; // High roll = no new threat

            const castle = createStronghold('My Castle', 'castle', 'loc-123');
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

            // Restore random
            Math.random = originalRandom;

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

             const castle = createStronghold('My Castle', 'castle', 'loc-123');
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

// ---------------------------------------------------------------------------
// Helper: build a minimal stronghold with a deterministic id
// ---------------------------------------------------------------------------
const makeStronghold = (overrides: Partial<Stronghold> = {}): Stronghold => {
    const base = createStronghold('Test Keep', 'castle', 'loc-1');
    return { ...base, id: 'sh-1', ...overrides };
};

// ---------------------------------------------------------------------------
// processAllStrongholds
// ---------------------------------------------------------------------------
describe('processAllStrongholds', () => {
    afterEach(() => { vi.restoreAllMocks(); });

    it('should return empty results for an empty record', () => {
        const { updatedStrongholds, summaries } = processAllStrongholds({});
        expect(updatedStrongholds).toEqual({});
        expect(summaries).toEqual([]);
    });

    it('should process a single stronghold and return its updated state + summary', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.99);
        const sh = makeStronghold();
        const { updatedStrongholds, summaries } = processAllStrongholds({ [sh.id]: sh });

        expect(Object.keys(updatedStrongholds)).toHaveLength(1);
        expect(updatedStrongholds[sh.id]).toBeDefined();
        expect(summaries).toHaveLength(1);
        expect(summaries[0].strongholdId).toBe(sh.id);
    });

    it('should process multiple strongholds independently', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.99);
        const sh1 = makeStronghold({ id: 'sh-1', name: 'Keep Alpha' });
        const sh2 = makeStronghold({ id: 'sh-2', name: 'Keep Beta', resources: { gold: 5000, supplies: 200, influence: 0, intel: 0 } });

        const { updatedStrongholds, summaries } = processAllStrongholds({
            [sh1.id]: sh1,
            [sh2.id]: sh2
        });

        expect(Object.keys(updatedStrongholds)).toHaveLength(2);
        expect(summaries).toHaveLength(2);

        const ids = summaries.map(s => s.strongholdId);
        expect(ids).toContain('sh-1');
        expect(ids).toContain('sh-2');
    });

    it('should add daily income to gold for a stronghold with no staff', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.99);

        const sh = makeStronghold({ dailyIncome: 25 });
        const { updatedStrongholds, summaries } = processAllStrongholds({ [sh.id]: sh });

        expect(updatedStrongholds[sh.id].resources.gold).toBe(sh.resources.gold + 25);
        expect(summaries[0].goldChange).toBe(25);
    });

    it('should deduct staff wages from gold', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.99);

        let sh = makeStronghold();
        sh = recruitStaff(sh, 'Bob', 'guard');
        sh = { ...sh, id: 'sh-1' };

        const { updatedStrongholds, summaries } = processAllStrongholds({ [sh.id]: sh });

        // Income 10, wage 5 => net +5
        expect(summaries[0].goldChange).toBe(10 - 5);
        expect(updatedStrongholds[sh.id].resources.gold).toBe(sh.resources.gold + 10 - 5);
    });
});

// ---------------------------------------------------------------------------
// strongholdSummariesToMessages
// ---------------------------------------------------------------------------
describe('strongholdSummariesToMessages', () => {
    const gameTime = new Date('2024-06-15T12:00:00Z');

    it('should return no messages for an empty summaries array', () => {
        const messages = strongholdSummariesToMessages([], gameTime);
        expect(messages).toEqual([]);
    });

    it('should return no messages when a summary has no events at all', () => {
        const summary: DailyUpdateSummary = {
            strongholdId: 'sh-1',
            goldChange: 0,
            influenceChange: 0,
            staffEvents: [],
            threatEvents: [],
            missionEvents: [],
            alerts: []
        };
        const messages = strongholdSummariesToMessages([summary], gameTime);
        expect(messages).toEqual([]);
    });

    it('should create a message with [Stronghold Report] prefix when goldChange is non-zero', () => {
        const summary: DailyUpdateSummary = {
            strongholdId: 'sh-1',
            goldChange: 15,
            influenceChange: 0,
            staffEvents: [],
            threatEvents: [],
            missionEvents: [],
            alerts: []
        };
        const messages = strongholdSummariesToMessages([summary], gameTime);

        expect(messages).toHaveLength(1);
        expect(messages[0].text).toContain('[Stronghold Report]');
        expect(messages[0].text).toContain('+15 gold');
        expect(messages[0].sender).toBe('system');
        expect(messages[0].timestamp).toBe(gameTime);
    });

    it('should include negative gold changes with no plus sign', () => {
        const summary: DailyUpdateSummary = {
            strongholdId: 'sh-1',
            goldChange: -50,
            influenceChange: 0,
            staffEvents: [],
            threatEvents: [],
            missionEvents: [],
            alerts: []
        };
        const messages = strongholdSummariesToMessages([summary], gameTime);

        expect(messages).toHaveLength(1);
        expect(messages[0].text).toContain('-50 gold');
        expect(messages[0].text).not.toContain('+-50');
    });

    it('should include staffEvents in the message', () => {
        const summary: DailyUpdateSummary = {
            strongholdId: 'sh-1',
            goldChange: 0,
            influenceChange: 0,
            staffEvents: ['Bob (guard) was not paid. Morale dropped.'],
            threatEvents: [],
            missionEvents: [],
            alerts: []
        };
        const messages = strongholdSummariesToMessages([summary], gameTime);

        expect(messages).toHaveLength(1);
        expect(messages[0].text).toContain('Bob (guard) was not paid');
    });

    it('should include threatEvents in the message', () => {
        const summary: DailyUpdateSummary = {
            strongholdId: 'sh-1',
            goldChange: 0,
            influenceChange: 0,
            staffEvents: [],
            threatEvents: ['New Threat: Bandit Raid (Severity: 25)'],
            missionEvents: [],
            alerts: []
        };
        const messages = strongholdSummariesToMessages([summary], gameTime);

        expect(messages).toHaveLength(1);
        expect(messages[0].text).toContain('Bandit Raid');
    });

    it('should include missionEvents in the message', () => {
        const summary: DailyUpdateSummary = {
            strongholdId: 'sh-1',
            goldChange: 0,
            influenceChange: 0,
            staffEvents: [],
            threatEvents: [],
            missionEvents: ['Mission Success: Alice completed \'Scout the northern pass\'.'],
            alerts: []
        };
        const messages = strongholdSummariesToMessages([summary], gameTime);

        expect(messages).toHaveLength(1);
        expect(messages[0].text).toContain('Mission Success');
    });

    it('should include alerts in the message', () => {
        const summary: DailyUpdateSummary = {
            strongholdId: 'sh-1',
            goldChange: 0,
            influenceChange: 0,
            staffEvents: [],
            threatEvents: [],
            missionEvents: [],
            alerts: ['Warning: Treasury is running low!']
        };
        const messages = strongholdSummariesToMessages([summary], gameTime);

        expect(messages).toHaveLength(1);
        expect(messages[0].text).toContain('Warning: Treasury is running low!');
    });

    it('should join multiple events with pipe separators', () => {
        const summary: DailyUpdateSummary = {
            strongholdId: 'sh-1',
            goldChange: 10,
            influenceChange: 0,
            staffEvents: ['Guard hired.'],
            threatEvents: [],
            missionEvents: [],
            alerts: ['Warning: Treasury is running low!']
        };
        const messages = strongholdSummariesToMessages([summary], gameTime);

        expect(messages).toHaveLength(1);
        expect(messages[0].text).toContain(' | ');
    });

    it('should include strongholdId in message metadata', () => {
        const summary: DailyUpdateSummary = {
            strongholdId: 'sh-42',
            goldChange: 5,
            influenceChange: 0,
            staffEvents: [],
            threatEvents: [],
            missionEvents: [],
            alerts: []
        };
        const messages = strongholdSummariesToMessages([summary], gameTime);

        expect(messages).toHaveLength(1);
        expect(messages[0].metadata).toBeDefined();
        expect(messages[0].metadata!.strongholdId).toBe('sh-42');
        expect(messages[0].metadata!.type).toBe('stronghold_report');
    });

    it('should produce one message per summary that has events', () => {
        const summaries: DailyUpdateSummary[] = [
            {
                strongholdId: 'sh-1',
                goldChange: 10,
                influenceChange: 0,
                staffEvents: [],
                threatEvents: [],
                missionEvents: [],
                alerts: []
            },
            {
                strongholdId: 'sh-2',
                goldChange: 0,
                influenceChange: 0,
                staffEvents: [],
                threatEvents: [],
                missionEvents: [],
                alerts: []
            },
            {
                strongholdId: 'sh-3',
                goldChange: 0,
                influenceChange: 0,
                staffEvents: ['Someone quit'],
                threatEvents: [],
                missionEvents: [],
                alerts: []
            }
        ];

        const messages = strongholdSummariesToMessages(summaries, gameTime);

        // sh-1 has goldChange, sh-2 has nothing, sh-3 has staffEvents
        expect(messages).toHaveLength(2);
        expect(messages[0].metadata!.strongholdId).toBe('sh-1');
        expect(messages[1].metadata!.strongholdId).toBe('sh-3');
    });

    it('should assign unique ids to each message', () => {
        const summaries: DailyUpdateSummary[] = [
            { strongholdId: 'sh-1', goldChange: 5, influenceChange: 0, staffEvents: [], threatEvents: [], missionEvents: [], alerts: [] },
            { strongholdId: 'sh-2', goldChange: 10, influenceChange: 0, staffEvents: [], threatEvents: [], missionEvents: [], alerts: [] }
        ];
        const messages = strongholdSummariesToMessages(summaries, gameTime);

        expect(messages).toHaveLength(2);
        expect(messages[0].id).not.toBe(messages[1].id);
    });
});

// ---------------------------------------------------------------------------
// processDailyUpkeep (supplementary edge cases)
// ---------------------------------------------------------------------------
describe('processDailyUpkeep - edge cases', () => {
    afterEach(() => { vi.restoreAllMocks(); });

    it('should generate a low-funds alert when gold is below 50', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.99);

        const sh = makeStronghold({ resources: { gold: 30, supplies: 100, influence: 0, intel: 0 }, dailyIncome: 0 });
        const { summary } = processDailyUpkeep(sh);

        expect(summary.alerts).toContain('Warning: Treasury is running low!');
    });

    it('should reduce morale and log an event when a staffer cannot be paid', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.99);

        let sh = makeStronghold({ resources: { gold: 0, supplies: 100, influence: 0, intel: 0 }, dailyIncome: 0 });
        sh = recruitStaff(sh, 'Poor Guard', 'guard');
        sh = { ...sh, id: 'sh-1' };

        const { updatedStronghold, summary } = processDailyUpkeep(sh);

        expect(summary.staffEvents.some(e => e.includes('Poor Guard'))).toBe(true);
        const guard = updatedStronghold.staff.find(s => s.name === 'Poor Guard');
        expect(guard).toBeDefined();
        if (guard) {
            expect(guard.morale).toBeLessThan(100);
        }
    });
});
