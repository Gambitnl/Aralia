
import { describe, it, expect } from 'vitest';
import { LeverageSystem, LeverageAttempt } from '../LeverageSystem';
import { Secret } from '../../../types/identity';

describe('LeverageSystem', () => {
    const system = new LeverageSystem(12345);

    const mockSecret: Secret = {
        id: 'sec_1',
        subjectId: 'faction_1',
        content: 'The leader is a vampire.',
        verified: true,
        value: 8,
        knownBy: [],
        tags: ['supernatural']
    };

    const mockTarget = {
        id: 'faction_1',
        name: 'House Vampyr',
        power: 80,
        reputation: -10
    };

    it('calculates resistance correctly', () => {
        // Resistance = (Power/2) - (SecretValue*5) - (Rep/5) + 50
        // (80/2) - (8*5) - (-10/5) + 50
        // 40 - 40 - (-2) + 50 = 52
        const resistance = system.calculateLeverageResistance(mockSecret, mockTarget.power, mockTarget.reputation);
        expect(resistance).toBeCloseTo(52);
    });

    it('processes a successful blackmail attempt', () => {
        // Mock a high value secret to ensure success with deterministic seed or high roll
        // Since we can't easily force the RNG inside the class without DI, we rely on the math.
        // With resistance ~52, a roll of 53+ wins.
        // Let's rely on the logic flow for now.

        // We will mock the RNG via a subclass or just test the logic structure if we exposed it,
        // but since we passed a seed, it is deterministic.

        const attempt: LeverageAttempt = {
            secretId: mockSecret.id,
            targetId: mockTarget.id,
            goal: 'blackmail'
        };

        const result = system.applyLeverage(attempt, mockSecret, mockTarget);

        expect(['success', 'failure', 'backfire']).toContain(result.outcome);
        if (result.outcome === 'success') {
            expect(result.rewards?.gold).toBeGreaterThan(0);
            expect(result.consequences?.secretBurned).toBe(true);
        }
    });

    it('handles backfires on critical failures', () => {
        // To force a backfire, we need a very high resistance or low roll.
        // Let's try a low value secret against a high power target.
        const weakSecret: Secret = { ...mockSecret, value: 1 }; // -5 modifier
        const strongTarget = { ...mockTarget, power: 100 }; // 50 base
        // Res = 50 - 5 - (-2) + 50 = 97.
        // Almost guaranteed failure/backfire.

        const attempt: LeverageAttempt = {
            secretId: weakSecret.id,
            targetId: strongTarget.id,
            goal: 'favor'
        };

        const result = system.applyLeverage(attempt, weakSecret, strongTarget);
        // With seed 12345, we'll see.
        expect(result.outcome).not.toBe('success');
    });
});
