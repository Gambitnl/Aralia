
import { describe, it, expect } from 'vitest';
import { getPlanarAtmosphere } from '../planarUtils';
import { PLANES } from '../../../data/planes';

describe('planarUtils Atmosphere', () => {
    it('should return correct atmosphere for Material Plane', () => {
        expect(getPlanarAtmosphere(PLANES['material'])).toContain('dust and rain');
    });

    it('should return correct atmosphere for Feywild', () => {
        expect(getPlanarAtmosphere(PLANES['feywild'])).toContain('colors are too bright');
    });

    it('should return correct atmosphere for Nine Hells', () => {
        expect(getPlanarAtmosphere(PLANES['nine_hells'])).toContain('smell of brimstone');
    });
});
