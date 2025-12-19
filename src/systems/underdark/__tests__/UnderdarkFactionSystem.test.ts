
import { describe, it, expect } from 'vitest';
import { UnderdarkFactionSystem } from '../UnderdarkFactionSystem';
import { UNDERDARK_FACTIONS } from '../../../data/underdarkFactions';
import { UnderdarkState } from '../../../types/underdark';

describe('UnderdarkFactionSystem', () => {
    describe('getLayerFromDepth', () => {
        it('should return upper for shallow depths', () => {
            expect(UnderdarkFactionSystem.getLayerFromDepth(500)).toBe('upper');
            expect(UnderdarkFactionSystem.getLayerFromDepth(1999)).toBe('upper');
        });

        it('should return middle for medium depths', () => {
            expect(UnderdarkFactionSystem.getLayerFromDepth(2000)).toBe('middle');
            expect(UnderdarkFactionSystem.getLayerFromDepth(9000)).toBe('middle');
        });

        it('should return lower for deep depths', () => {
            expect(UnderdarkFactionSystem.getLayerFromDepth(10000)).toBe('lower');
            expect(UnderdarkFactionSystem.getLayerFromDepth(29999)).toBe('lower');
        });

        it('should return abyss for extreme depths', () => {
            expect(UnderdarkFactionSystem.getLayerFromDepth(30000)).toBe('abyss');
            expect(UnderdarkFactionSystem.getLayerFromDepth(100000)).toBe('abyss');
        });
    });

    describe('getFactionsAtDepth', () => {
        it('should return Drow and Myconids at upper depth', () => {
            const factions = UnderdarkFactionSystem.getFactionsAtDepth(1000);
            const ids = factions.map(f => f.id);
            expect(ids).toContain('drow_menzoberranzan');
            expect(ids).toContain('myconid_spore_circle');
            expect(ids).not.toContain('illithid_colony');
        });

        it('should return Illithids at lower depth', () => {
            const factions = UnderdarkFactionSystem.getFactionsAtDepth(15000);
            const ids = factions.map(f => f.id);
            expect(ids).toContain('illithid_colony');
            expect(ids).not.toContain('drow_menzoberranzan');
        });
    });

    describe('calculateHostility', () => {
        const drowFaction = UNDERDARK_FACTIONS.find(f => f.id === 'drow_menzoberranzan')!;

        it('should reduce hostility for same race', () => {
            const hostility = UnderdarkFactionSystem.calculateHostility(drowFaction, 'Drow', 0);
            expect(hostility).toBeLessThan(drowFaction.baseHostility);
        });

        it('should increase hostility for hated races', () => {
            const hostility = UnderdarkFactionSystem.calculateHostility(drowFaction, 'Elf', 0);
            expect(hostility).toBeGreaterThan(drowFaction.baseHostility);
        });

        it('should respect reputation', () => {
            const neutral = UnderdarkFactionSystem.calculateHostility(drowFaction, 'Human', 0);
            const liked = UnderdarkFactionSystem.calculateHostility(drowFaction, 'Human', 50);
            const hated = UnderdarkFactionSystem.calculateHostility(drowFaction, 'Human', -50);

            expect(liked).toBeLessThan(neutral);
            expect(hated).toBeGreaterThan(neutral);
        });
    });

    describe('applyTerritoryMechanics', () => {
        const initialState: UnderdarkState = {
            currentDepth: 15000,
            lightLevel: 'darkness',
            activeLightSources: [],
            faerzressLevel: 0,
            wildMagicChance: 0,
            sanity: { current: 100, max: 100, madnessLevel: 0 },
            currentTerritoryFactionId: 'illithid_colony'
        };

        it('should apply psionic static sanity drain', () => {
            // Illithid Colony has 'psionic_static' with intensity 8
            // Drain = (8 * 0.1) * (60 / 60) = 0.8 sanity per hour
            const newState = UnderdarkFactionSystem.applyTerritoryMechanics(initialState, 'illithid_colony', 60);
            expect(newState.sanity.current).toBeLessThan(100);
            expect(newState.sanity.current).toBeCloseTo(99.2, 1);
        });

        it('should do nothing if faction ID is invalid', () => {
            const newState = UnderdarkFactionSystem.applyTerritoryMechanics(initialState, 'fake_faction', 60);
            expect(newState.sanity.current).toBe(100);
        });
    });
});
