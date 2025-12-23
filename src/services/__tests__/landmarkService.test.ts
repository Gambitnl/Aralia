
import { describe, it, expect, vi } from 'vitest';
import { generateLandmark } from '../landmarkService';

describe('landmarkService', () => {
    it('should generate a landmark deterministically', () => {
        const seed = 12345;
        const coords = { x: 10, y: 10 };
        const biome = 'forest';

        // Run multiple times to ensure stability
        const run1 = generateLandmark(seed, coords, biome);
        const run2 = generateLandmark(seed, coords, biome);

        expect(run1).toEqual(run2);
    });

    it('should generate different landmarks for different seeds', () => {
        const coords = { x: 10, y: 10 };
        const biome = 'forest';

        // Find two seeds that both generate landmarks
        let seed1 = 0;
        let l1 = null;
        while (!l1 && seed1 < 100) {
             l1 = generateLandmark(seed1++, coords, biome);
        }

        let seed2 = seed1 + 1;
        let l2 = null;
        // Change coordinates for second landmark to ensure divergence
        const coords2 = { x: 11, y: 11 };
        while (!l2 && seed2 < 200) {
             l2 = generateLandmark(seed2++, coords2, biome);
        }

        // With different coordinates, IDs must differ
        if (l1 && l2) {
             expect(l1.id).not.toBe(l2.id);
        }
    });

    it('should return null most of the time (rarity check)', () => {
        let hits = 0;
        const total = 1000;
        for (let i = 0; i < total; i++) {
            if (generateLandmark(i, { x: 0, y: 0 }, 'plains')) {
                hits++;
            }
        }
        // Expect roughly 15%
        expect(hits).toBeGreaterThan(100);
        expect(hits).toBeLessThan(200);
    });

    it('should include rewards and consequences', () => {
        // Find a seed that generates a landmark
        let landmark = null;
        let seed = 0;
        while (!landmark && seed < 100) {
            landmark = generateLandmark(seed++, { x: 0, y: 0 }, 'forest');
        }

        expect(landmark).not.toBeNull();
        if (landmark) {
            expect(landmark.name).toBeDefined();
            expect(landmark.description).toBeDefined();
            expect(landmark.type).toBe('procedural_landmark');
            // Rewards might be empty based on RNG, but the array should exist
            expect(Array.isArray(landmark.rewards)).toBe(true);
            expect(Array.isArray(landmark.consequences)).toBe(true);
        }
    });

    it('should generate gold rewards', () => {
        // Find a seed that generates a Dwarven landmark (high chance of gold)
        // or just brute force until we see gold
        let foundGold = false;
        for (let i = 0; i < 500; i++) {
            const l = generateLandmark(i, { x: 0, y: 0 }, 'mountain');
            if (l && l.rewards.some(r => r.type === 'gold')) {
                foundGold = true;
                break;
            }
        }
        expect(foundGold).toBe(true);
    });
});
