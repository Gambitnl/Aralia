
import { describe, it, expect } from 'vitest';
import { calculateRippleEffects, applyReputationChange, calculateNewStanding, getReputationTier, formatReputationChangeMessage } from '../factionUtils';
import { FACTIONS } from '../../data/factions';
import { GameState } from '../../types';
import { PlayerFactionStanding } from '../../types/factions';

// Mock GameState for testing
const mockGameState: GameState = {
    factions: FACTIONS,
    playerFactionStandings: {
        'iron_ledger': {
            factionId: 'iron_ledger',
            publicStanding: 0,
            secretStanding: 0,
            rankId: 'initiate',
            favorsOwed: 0,
            renown: 0
        },
        'house_vane': {
            factionId: 'house_vane',
            publicStanding: 0,
            secretStanding: 0,
            rankId: 'initiate',
            favorsOwed: 0,
            renown: 0
        },
        'unseen_hand': {
            factionId: 'unseen_hand',
            publicStanding: 0,
            secretStanding: 0,
            rankId: 'initiate',
            favorsOwed: 0,
            renown: 0
        }
    }
} as unknown as GameState;

describe('Faction Reputation System', () => {
    describe('calculateNewStanding', () => {
        it('should clamp values between -100 and 100', () => {
            expect(calculateNewStanding(90, 20)).toBe(100);
            expect(calculateNewStanding(-90, -20)).toBe(-100);
            expect(calculateNewStanding(0, 50)).toBe(50);
        });
    });

    describe('getReputationTier', () => {
        it('should return correct tiers', () => {
            expect(getReputationTier(-100)).toBe('NEMESIS');
            expect(getReputationTier(-50)).toBe('HOSTILE');
            expect(getReputationTier(0)).toBe('NEUTRAL');
            expect(getReputationTier(50)).toBe('HONORED');
            expect(getReputationTier(100)).toBe('REVERED');
        });
    });

    describe('formatReputationChangeMessage', () => {
        it('should format positive change correctly', () => {
            const msg = formatReputationChangeMessage('Test Faction', 10, 'public', 'doing good');
            expect(msg).toBe('Publicly, your standing with Test Faction has improved by 10 due to doing good.');
        });

        it('should format negative change correctly', () => {
            const msg = formatReputationChangeMessage('Test Faction', -10, 'secret');
            expect(msg).toBe('Secretly, your standing with Test Faction has worsened by 10.');
        });
    });

    describe('calculateRippleEffects', () => {
        it('should generate positive ripples for allies when standing improves', () => {
            // Setup: Iron Ledger and House Vane are allies (will be added in data step)
            // Helping Iron Ledger should help House Vane
            const changes = calculateRippleEffects(FACTIONS, 'iron_ledger', 10);

            const allyChange = changes.find(c => c.factionId === 'house_vane');
            expect(allyChange).toBeDefined();
            expect(allyChange?.amount).toBeGreaterThan(0);
            expect(allyChange?.reason).toContain('alliance');
        });

        it('should generate negative ripples for enemies when standing improves', () => {
            // Helping Iron Ledger should hurt Unseen Hand
            const changes = calculateRippleEffects(FACTIONS, 'iron_ledger', 10);

            const enemyChange = changes.find(c => c.factionId === 'unseen_hand');
            expect(enemyChange).toBeDefined();
            expect(enemyChange?.amount).toBeLessThan(0);
            expect(enemyChange?.reason).toContain('enemy');
        });

        it('should generate negative ripples for allies when standing worsens', () => {
            // Hurting Iron Ledger should hurt House Vane
            const changes = calculateRippleEffects(FACTIONS, 'iron_ledger', -10);

            const allyChange = changes.find(c => c.factionId === 'house_vane');
            expect(allyChange).toBeDefined();
            expect(allyChange?.amount).toBeLessThan(0);
        });

        it('should generate positive ripples for enemies when standing worsens', () => {
            // Hurting Iron Ledger should help Unseen Hand (enemy of my enemy)
            const changes = calculateRippleEffects(FACTIONS, 'iron_ledger', -10);

            const enemyChange = changes.find(c => c.factionId === 'unseen_hand');
            expect(enemyChange).toBeDefined();
            expect(enemyChange?.amount).toBeGreaterThan(0);
        });
    });

    describe('applyReputationChange', () => {
        it('should update primary faction and propagate to others', () => {
            // Deep copy state to avoid mutation pollution
            const testState = JSON.parse(JSON.stringify(mockGameState));

            const result = applyReputationChange(testState, 'iron_ledger', 20, 'completed contract');

            // Primary update
            expect(result.standings['iron_ledger'].publicStanding).toBe(20);

            // Ripple updates (Assuming 50% propagation for simplicity in test expectation,
            // exact value depends on implementation but direction matters)
            expect(result.standings['house_vane'].publicStanding).toBeGreaterThan(0);
            expect(result.standings['unseen_hand'].publicStanding).toBeLessThan(0);

            // Check logs
            expect(result.logs.length).toBeGreaterThan(1); // Primary + ripples
        });

        it('should clamp values between -100 and 100', () => {
            const testState = JSON.parse(JSON.stringify(mockGameState));
            testState.playerFactionStandings['iron_ledger'].publicStanding = 90;

            const result = applyReputationChange(testState, 'iron_ledger', 20, 'big win');

            expect(result.standings['iron_ledger'].publicStanding).toBe(100);
        });
    });
});
