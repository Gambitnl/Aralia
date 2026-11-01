/**
 * @file src/systems/crafting/__tests__/creatureHarvestData.coverage.test.ts
 * Coverage pass (gap C14) for creature harvest lookups.
 */
import { describe, expect, it } from 'vitest';
import { getCreatureById, getCreaturesForLocation, HARVESTABLE_CREATURES } from '../creatureHarvestData';

describe('getCreaturesForLocation', () => {
    it('returns creatures listed for the location plus every "Varies" creature', () => {
        const result = getCreaturesForLocation('Arctic');
        const resultIds = result.map(c => c.id);
        const expected = HARVESTABLE_CREATURES
            .filter(c => c.locations.includes('Arctic') || c.locations.includes('Varies'))
            .map(c => c.id);

        expect(resultIds).toEqual(expected);
        expect(result.every(c => c.locations.includes('Arctic') || c.locations.includes('Varies'))).toBe(true);
        expect(result.some(c => c.locations.includes('Arctic'))).toBe(true);
    });

    it('returns only "Varies" creatures for a location nobody lists', () => {
        const result = getCreaturesForLocation('Moon');
        expect(result.length).toBeGreaterThan(0);
        expect(result.every(c => c.locations.includes('Varies'))).toBe(true);
    });

    it('matches locations case-sensitively', () => {
        const lower = getCreaturesForLocation('underdark').map(c => c.id);
        const proper = getCreaturesForLocation('Underdark').map(c => c.id);
        expect(proper.length).toBeGreaterThan(lower.length);
        expect(proper).toContain('purple_worm');
        expect(lower).not.toContain('purple_worm');
    });
});

describe('getCreatureById', () => {
    it('finds a creature and returns undefined for an unknown id', () => {
        expect(getCreatureById('purple_worm')?.name).toBe('Purple Worm');
        expect(getCreatureById('tarrasque_lite')).toBeUndefined();
    });
});
