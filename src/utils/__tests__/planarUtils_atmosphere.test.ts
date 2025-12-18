
import { describe, it, expect } from 'vitest';
import { getPlanarAtmosphere } from '../planarUtils';
import { PLANES } from '../../data/planes';

describe('planarUtils Atmosphere', () => {
    it('should return correct atmosphere for Material Plane', () => {
        expect(getPlanarAtmosphere(PLANES['material'])).toContain('stable and familiar');
    });

    it('should return correct atmosphere for Feywild', () => {
        expect(getPlanarAtmosphere(PLANES['feywild'])).toContain('Colors seem more vivid');
    });

    it('should return correct atmosphere for Abyss', () => {
        expect(getPlanarAtmosphere(PLANES['abyss'])).toContain('tastes of copper');
    });
});
