/**
 * @file src/systems/crafting/__tests__/gatheringData.coverage.test.ts
 * Coverage pass (gap C14) for the biome resource filter.
 */
import { describe, expect, it } from 'vitest';
import { GATHERABLE_RESOURCES, getResourcesForBiome } from '../gatheringData';
import type { Biome } from '../gatheringData';

describe('getResourcesForBiome', () => {
    it('returns exactly the resources that list the biome', () => {
        const biomes: Biome[] = ['Forest', 'Arctic', 'Blightshore', 'Urban'];
        for (const biome of biomes) {
            const result = getResourcesForBiome(biome);
            expect(result.every(r => r.locations.includes(biome))).toBe(true);
            expect(result.length).toBe(GATHERABLE_RESOURCES.filter(r => r.locations.includes(biome)).length);
        }
    });

    it('returns known single-biome resources', () => {
        expect(getResourcesForBiome('Arctic').map(r => r.id).sort()).toEqual(['frost_lichen', 'silverthorn']);
        expect(getResourcesForBiome('Blightshore').map(r => r.id).sort()).toEqual(['black_sap', 'blight_spores']);
    });

    it('returns an empty list for a biome with no resources', () => {
        expect(getResourcesForBiome('Underwater')).toEqual([]);
    });
});
