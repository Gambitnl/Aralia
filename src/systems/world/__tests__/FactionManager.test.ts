
import { describe, it, expect } from 'vitest';
import { FactionManager } from '../FactionManager';
// TODO(lint-intent): 'Faction' is unused in this test; use it in the assertion path or remove it.
import { GameState, GamePhase, Faction as _Faction } from '../../../types';
import { FACTIONS } from '../../../data/factions';
import { createMockGameState } from '../../../utils/core/factories';

const mockState: GameState = createMockGameState({
    factions: JSON.parse(JSON.stringify(FACTIONS)),
    playerFactionStandings: {},
    gameTime: new Date(),
    activeRumors: [],
    phase: GamePhase.PLAYING,
    economy: {
        activeEvents: [],
        marketFactors: { scarcity: [], surplus: [] },
        // TODO(2026-01-03 pass 4 Codex-CLI): prices stubbed for legacy assertions until economy typing expands.
        prices: {} as unknown as GameState['economy']['regionalWealth'],
        tradeRoutes: [],
        marketEvents: [],
        globalInflation: 0,
        regionalWealth: {},
        buyMultiplier: 1,
        sellMultiplier: 0.5,
    } as unknown as GameState['economy'],
    notoriety: { globalHeat: 0, localHeat: {}, knownCrimes: [], bounties: [] },
    underdark: {
        currentDepth: 0,
        currentBiomeId: 'cavern_standard',
        lightLevel: 'bright',
        activeLightSources: [],
        faerzressLevel: 0,
        wildMagicChance: 0,
        sanity: { current: 100, max: 100, madnessLevel: 0 },
    },
    environment: {
        precipitation: 'none',
        temperature: 'temperate',
        wind: { direction: 'north', speed: 'calm' },
        visibility: 'clear'
    },
});

// Setup relationships for testing
// Iron Ledger <-> House Vane (Allies)
// Iron Ledger <-> Unseen Hand (Enemies)
mockState.factions['iron_ledger'].allies = ['house_vane'];
mockState.factions['iron_ledger'].enemies = ['unseen_hand'];
mockState.factions['house_vane'].allies = ['iron_ledger'];

describe('FactionManager', () => {
    it('applies direct reputation changes correctly', () => {
        const result = FactionManager.applyReputationChange(mockState, 'iron_ledger', 10, 'good deed');

        expect(result.standings['iron_ledger'].publicStanding).toBe(10);
        expect(result.logs.length).toBeGreaterThan(0);
        expect(result.logs[0].text).toContain('The Iron Ledger');
    });

    it('generates ripple effects for allies', () => {
        // Helping Iron Ledger should help House Vane (Ally)
        const result = FactionManager.applyReputationChange(mockState, 'iron_ledger', 20, 'big help');

        expect(result.standings['iron_ledger'].publicStanding).toBe(20);
        // Ally gets 50%
        expect(result.standings['house_vane'].publicStanding).toBe(10);
        expect(result.logs.find(l => l.text.includes('House Vane'))).toBeTruthy();
    });

    it('generates ripple effects for enemies', () => {
        // Helping Iron Ledger should hurt Unseen Hand (Enemy)
        const result = FactionManager.applyReputationChange(mockState, 'iron_ledger', 20, 'big help');

        // Enemy loses 50%
        expect(result.standings['unseen_hand'].publicStanding).toBe(-10);
    });

    it('generates rumors for significant changes', () => {
        const result = FactionManager.applyReputationChange(mockState, 'iron_ledger', 20, 'heroic feat');

        expect(result.rumors.length).toBe(1);
        expect(result.rumors[0].sourceFactionId).toBe('iron_ledger');
        expect(result.rumors[0].virality).toBeGreaterThan(0.5);
    });

    it('does not generate rumors for minor changes', () => {
        const result = FactionManager.applyReputationChange(mockState, 'iron_ledger', 5, 'small favor');

        expect(result.rumors.length).toBe(0);
    });
});
