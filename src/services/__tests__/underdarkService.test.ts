
import { describe, it, expect } from 'vitest';
import { calculateLightLevel, calculateSanityChange } from '../underdarkService';
import { LightSource } from '../../types/underdark';

describe('UnderdarkService', () => {
    describe('calculateLightLevel', () => {
        it('should return bright if depth is <= 0', () => {
            expect(calculateLightLevel([], 0)).toBe('bright');
            expect(calculateLightLevel([], -10)).toBe('bright');
        });

        it('should return darkness if no sources and depth > 0', () => {
            expect(calculateLightLevel([], 100)).toBe('darkness');
        });

        it('should return dim if max radius > 0 but < 20', () => {
            const sources: LightSource[] = [{
                id: '1', type: 'bioluminescence', name: 'Glow shroom', radius: 10, durationRemaining: 60, isActive: true
            }];
            expect(calculateLightLevel(sources, 100)).toBe('dim');
        });

        it('should return bright if max radius >= 20', () => {
            const sources: LightSource[] = [{
                id: '1', type: 'torch', name: 'Torch', radius: 20, durationRemaining: 60, isActive: true
            }];
            expect(calculateLightLevel(sources, 100)).toBe('bright');
        });
    });

    describe('calculateSanityChange', () => {
        const fullSanity = { current: 100, max: 100, madnessLevel: 0 };
        const lowSanity = { current: 50, max: 100, madnessLevel: 0 };

        it('should decrease sanity in darkness', () => {
            const change = calculateSanityChange('darkness', fullSanity, 10);
            expect(change).toBeLessThan(0);
            expect(change).toBe(-5); // -0.5 * 10
        });

        it('should increase sanity in bright light if damaged', () => {
            const change = calculateSanityChange('bright', lowSanity, 10);
            expect(change).toBeGreaterThan(0);
            expect(change).toBe(1); // 0.1 * 10
        });

        it('should not change sanity in dim light', () => {
            const change = calculateSanityChange('dim', lowSanity, 10);
            expect(change).toBe(0);
        });
    });
});
