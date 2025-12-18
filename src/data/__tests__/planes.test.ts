
import { describe, it, expect } from 'vitest';
import { PLANES } from '../planes';
import { Plane } from '../../types';

describe('Lore Data: Planes', () => {
    it('should export a valid PLANES object', () => {
        expect(PLANES).toBeDefined();
        expect(Object.keys(PLANES).length).toBeGreaterThan(0);
    });

    it('should include authentic D&D 5e planes', () => {
        const expectedPlanes = [
            'material',
            'feywild',
            'shadowfell',
            'ethereal',
            'astral',
            'elemental_fire',
            'elemental_water',
            'nine_hells',
            'abyss',
            'mechanus',
            'limbo',
            'mount_celestia'
        ];

        expectedPlanes.forEach(planeId => {
            expect(PLANES[planeId]).toBeDefined();
            expect(PLANES[planeId].id).toBe(planeId);
        });
    });

    it('should have valid structure for each plane', () => {
        Object.values(PLANES).forEach((plane: Plane) => {
            expect(plane.id).toBeTypeOf('string');
            expect(plane.name).toBeTypeOf('string');
            expect(plane.description).toBeTypeOf('string');
            expect(Array.isArray(plane.traits)).toBe(true);

            // Check traits structure
            plane.traits.forEach(trait => {
                expect(trait.id).toBeTypeOf('string');
                expect(trait.name).toBeTypeOf('string');
                expect(trait.type).toBeDefined();
            });

            // Check alignment (new field)
            if (plane.alignment) {
                expect(plane.alignment).toBeTypeOf('string');
            }
        });
    });

    it('should have correct specific lore details', () => {
        const nineHells = PLANES['nine_hells'];
        expect(nineHells.alignment).toBe('Lawful Evil');
        expect(nineHells.atmosphereDescription).toContain('brimstone');

        const abyss = PLANES['abyss'];
        expect(abyss.alignment).toBe('Chaotic Evil');

        const feywild = PLANES['feywild'];
        expect(feywild.traits.some(t => t.id === 'time_warp')).toBe(true);
    });
});
