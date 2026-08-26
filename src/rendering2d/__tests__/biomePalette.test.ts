import { describe, it, expect } from 'vitest';
import {
    BIOME_PALETTE,
    BIOME_NAMES,
    DEFAULT_BIOME_COLORS,
    getBiomeColors,
} from '../biomePalette';

const HEX = /^#[0-9a-f]{6}$/i;

describe('biomePalette', () => {
    it('names every biome exactly once', () => {
        expect(new Set(BIOME_NAMES).size).toBe(BIOME_NAMES.length);
        expect(Object.keys(BIOME_PALETTE)).toHaveLength(BIOME_NAMES.length);
    });

    it('holds at least the 13 biomes that the painters needed', () => {
        expect(BIOME_NAMES.length).toBeGreaterThanOrEqual(13);
    });

    it.each(BIOME_NAMES)('%s has a complete row', (name) => {
        const row = BIOME_PALETTE[name];
        expect(row.grassHue).toBeGreaterThanOrEqual(0);
        expect(row.grassHue).toBeLessThanOrEqual(360);
        expect(row.waterColor).toMatch(HEX);
        expect(row.waterDeepColor).toMatch(HEX);
        expect(row.roofOverride === null || HEX.test(row.roofOverride)).toBe(true);
        expect(row.wallOverride === null || HEX.test(row.wallOverride)).toBe(true);
    });

    it('keeps the 11 biomes that differ from the default', () => {
        const different = BIOME_NAMES.filter((name) => {
            const row = BIOME_PALETTE[name];
            return (
                row.grassHue !== DEFAULT_BIOME_COLORS.grassHue ||
                row.waterColor !== DEFAULT_BIOME_COLORS.waterColor ||
                row.waterDeepColor !== DEFAULT_BIOME_COLORS.waterDeepColor ||
                row.roofOverride !== DEFAULT_BIOME_COLORS.roofOverride
            );
        });
        expect(different.sort()).toEqual(
            [
                'AUTUMN_FOREST',
                'BADLANDS',
                'CHERRY_BLOSSOM',
                'CRYSTAL_WASTES',
                'DEAD_LANDS',
                'HIGHLANDS',
                'JUNGLE',
                'MUSHROOM_FOREST',
                'SAVANNA',
                'SWAMP',
                'VOLCANIC',
            ].sort()
        );
    });

    it('keeps the swamp roof override', () => {
        expect(BIOME_PALETTE.SWAMP.roofOverride).toBe('#365314');
    });

    it('returns the default row for an unknown biome', () => {
        expect(getBiomeColors('NOT_A_BIOME')).toEqual(DEFAULT_BIOME_COLORS);
    });

    it('returns the named row for a known biome', () => {
        expect(getBiomeColors('JUNGLE').grassHue).toBe(130);
        expect(getBiomeColors('JUNGLE').waterColor).toBe('#06b6d4');
    });

    it('does not share one object between rows', () => {
        expect(BIOME_PALETTE.PLAINS).not.toBe(BIOME_PALETTE.FOREST);
        expect(BIOME_PALETTE.PLAINS).not.toBe(DEFAULT_BIOME_COLORS);
    });
});
