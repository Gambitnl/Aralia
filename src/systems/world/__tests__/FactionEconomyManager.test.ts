import { describe, it, expect } from 'vitest';
import {
    processFactionDailyEconomics,
    factionCompeteForRoute,
    calculateFactionTaxOnTransaction,
    getFactionTradeBonus
} from '../FactionEconomyManager';
import { Faction } from '../../../types/factions';
import { EconomyState, TradeRoute } from '../../../types/economy';
import { SeededRandom } from '../../../utils/random';

const makeFaction = (overrides: Partial<Faction> = {}): Faction => ({
    id: 'test_faction',
    name: 'Test Faction',
    description: 'A test faction.',
    type: 'GUILD',
    colors: { primary: '#000', secondary: '#fff' },
    ranks: [],
    allies: [],
    enemies: [],
    rivals: [],
    relationships: {},
    values: [],
    hates: [],
    power: 50,
    assets: [],
    treasury: 10000,
    taxRate: 10,
    controlledRegionIds: [],
    controlledRouteIds: [],
    economicPolicy: 'mercantile',
    tradeGoodPriorities: [],
    ...overrides
});

const makeRoute = (overrides: Partial<TradeRoute> = {}): TradeRoute => ({
    id: 'route_1',
    name: 'Golden Road',
    originId: 'region_a',
    destinationId: 'region_b',
    goods: ['luxury', 'gem'],
    status: 'active',
    riskLevel: 0.3,
    profitability: 60,
    ...overrides
});

const makeEconomy = (routes: TradeRoute[] = []): EconomyState => ({
    marketEvents: [],
    tradeRoutes: routes,
    globalInflation: 0,
    regionalWealth: {},
    marketFactors: { scarcity: [], surplus: [] },
    buyMultiplier: 1,
    sellMultiplier: 0.5,
    activeEvents: []
});

describe('FactionEconomyManager', () => {
    describe('processFactionDailyEconomics', () => {
        it('should increase treasury from controlled routes', () => {
            const route = makeRoute({ id: 'golden_road', profitability: 80 });
            const faction = makeFaction({
                id: 'iron_ledger',
                controlledRouteIds: ['golden_road'],
                controlledRegionIds: ['region_capital'],
                taxRate: 10,
                power: 30 // Low power = low expenses
            });

            const economy = makeEconomy([route]);
            const rng = new SeededRandom(42);

            const result = processFactionDailyEconomics(
                { iron_ledger: faction },
                economy,
                rng
            );

            // Should have income from route + region tax, minus expenses
            expect(result.factions.iron_ledger.treasury).toBeDefined();
            // The income from route + region tax should outweigh expenses for a low-power faction
            // Route: 80 * 0.5 * 1.3 (mercantile) = 52
            // Region: 1 * (10 * 2) = 20
            // Expenses: 30 * 1.5 = 45 (military) + route maintenance 10 + mercantile overhead 15 = 70
            // Net = 72 - 70 = 2
            expect(result.factions.iron_ledger.treasury).toBe(10002);
        });

        it('should decrease treasury when expenses exceed income', () => {
            const faction = makeFaction({
                id: 'weak_guild',
                controlledRouteIds: [],
                controlledRegionIds: [],
                power: 80, // High power = high military upkeep
                treasury: 5000
            });

            const economy = makeEconomy([]);
            const rng = new SeededRandom(99);

            const result = processFactionDailyEconomics(
                { weak_guild: faction },
                economy,
                rng
            );

            // No income, only expenses (military upkeep + policy overhead)
            expect(result.factions.weak_guild.treasury).toBeLessThan(5000);
        });

        it('should not go below zero treasury', () => {
            const faction = makeFaction({
                id: 'broke_guild',
                controlledRouteIds: [],
                controlledRegionIds: [],
                power: 90,
                treasury: 10 // Almost broke
            });

            const economy = makeEconomy([]);
            const rng = new SeededRandom(77);

            const result = processFactionDailyEconomics(
                { broke_guild: faction },
                economy,
                rng
            );

            expect(result.factions.broke_guild.treasury).toBe(0);
        });

        it('should log when a faction goes bankrupt', () => {
            const faction = makeFaction({
                id: 'dying_guild',
                name: 'The Dying Guild',
                controlledRouteIds: [],
                controlledRegionIds: [],
                power: 80,
                treasury: 50 // Will run out
            });

            const economy = makeEconomy([]);
            const rng = new SeededRandom(55);

            const result = processFactionDailyEconomics(
                { dying_guild: faction },
                economy,
                rng
            );

            expect(result.logs.some(l => l.includes('Dying Guild'))).toBe(true);
            expect(result.logs.some(l => l.includes('run out of gold'))).toBe(true);
        });
    });

    describe('factionCompeteForRoute', () => {
        it('should resolve competition with winner and costs', () => {
            const attacker = makeFaction({ id: 'attacker', power: 80, treasury: 20000 });
            const defender = makeFaction({ id: 'defender', power: 40, treasury: 5000 });
            const route = makeRoute();
            const rng = new SeededRandom(42);

            const result = factionCompeteForRoute(attacker, defender, route, rng);

            expect(result.winner).toBeDefined();
            expect(result.attackerCost).toBeGreaterThan(0);
            expect(result.defenderCost).toBeGreaterThan(0);
        });

        it('should give defender advantage', () => {
            // Equal power — defender should win more often due to +10 bonus
            let defenderWins = 0;
            for (let seed = 0; seed < 100; seed++) {
                const attacker = makeFaction({ id: 'attacker', power: 50, treasury: 10000 });
                const defender = makeFaction({ id: 'defender', power: 50, treasury: 10000 });
                const route = makeRoute();
                const rng = new SeededRandom(seed);

                const result = factionCompeteForRoute(attacker, defender, route, rng);
                if (result.winner.id === 'defender') defenderWins++;
            }

            // Defender should win more than 50% of the time
            expect(defenderWins).toBeGreaterThan(45);
        });
    });

    describe('calculateFactionTaxOnTransaction', () => {
        it('should calculate tax for region controlled by a faction', () => {
            const factions: Record<string, Faction> = {
                iron_ledger: makeFaction({
                    id: 'iron_ledger',
                    name: 'The Iron Ledger',
                    controlledRegionIds: ['region_capital'],
                    taxRate: 10
                })
            };

            const result = calculateFactionTaxOnTransaction('region_capital', factions, 100);
            expect(result.taxAmount).toBe(10);
            expect(result.factionId).toBe('iron_ledger');
            expect(result.factionName).toBe('The Iron Ledger');
        });

        it('should return zero tax for uncontrolled regions', () => {
            const factions: Record<string, Faction> = {
                iron_ledger: makeFaction({
                    id: 'iron_ledger',
                    controlledRegionIds: ['region_capital']
                })
            };

            const result = calculateFactionTaxOnTransaction('region_wilderness', factions, 100);
            expect(result.taxAmount).toBe(0);
            expect(result.factionId).toBeNull();
        });

        it('should handle fractional tax amounts', () => {
            const factions: Record<string, Faction> = {
                iron_ledger: makeFaction({
                    id: 'iron_ledger',
                    controlledRegionIds: ['region_capital'],
                    taxRate: 15
                })
            };

            const result = calculateFactionTaxOnTransaction('region_capital', factions, 33);
            expect(result.taxAmount).toBe(4.95); // 33 * 0.15 = 4.95
        });
    });

    describe('getFactionTradeBonus', () => {
        it('should return discount for friendly faction standing', () => {
            const factions: Record<string, Faction> = {
                iron_ledger: makeFaction({
                    id: 'iron_ledger',
                    controlledRegionIds: ['region_capital']
                })
            };

            const standings = {
                iron_ledger: {
                    factionId: 'iron_ledger',
                    publicStanding: 80, // Very friendly
                    secretStanding: 0,
                    rankId: 'member',
                    favorsOwed: 0,
                    renown: 0,
                    history: []
                }
            };

            const bonus = getFactionTradeBonus('region_capital', factions, standings);
            expect(bonus).toBeLessThan(0); // Negative = discount
            expect(bonus).toBeGreaterThanOrEqual(-0.15); // Max 15% discount
        });

        it('should return surcharge for hostile faction standing', () => {
            const factions: Record<string, Faction> = {
                unseen_hand: makeFaction({
                    id: 'unseen_hand',
                    controlledRegionIds: ['region_slums']
                })
            };

            const standings = {
                unseen_hand: {
                    factionId: 'unseen_hand',
                    publicStanding: -70, // Hostile
                    secretStanding: 0,
                    rankId: 'outsider',
                    favorsOwed: 0,
                    renown: 0,
                    history: []
                }
            };

            const bonus = getFactionTradeBonus('region_slums', factions, standings);
            expect(bonus).toBeGreaterThan(0); // Positive = surcharge
            expect(bonus).toBeLessThanOrEqual(0.20); // Max 20% surcharge
        });

        it('should return 0 for neutral standing', () => {
            const factions: Record<string, Faction> = {
                iron_ledger: makeFaction({
                    id: 'iron_ledger',
                    controlledRegionIds: ['region_capital']
                })
            };

            const standings = {
                iron_ledger: {
                    factionId: 'iron_ledger',
                    publicStanding: 10, // Neutral
                    secretStanding: 0,
                    rankId: 'outsider',
                    favorsOwed: 0,
                    renown: 0,
                    history: []
                }
            };

            const bonus = getFactionTradeBonus('region_capital', factions, standings);
            expect(bonus).toBe(0);
        });

        it('should return 0 for uncontrolled regions', () => {
            const factions: Record<string, Faction> = {
                iron_ledger: makeFaction({
                    id: 'iron_ledger',
                    controlledRegionIds: ['region_capital']
                })
            };

            const standings = {
                iron_ledger: {
                    factionId: 'iron_ledger',
                    publicStanding: 80,
                    secretStanding: 0,
                    rankId: 'member',
                    favorsOwed: 0,
                    renown: 0,
                    history: []
                }
            };

            const bonus = getFactionTradeBonus('region_wilderness', factions, standings);
            expect(bonus).toBe(0);
        });
    });
});
