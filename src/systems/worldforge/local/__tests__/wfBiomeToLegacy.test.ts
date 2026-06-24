import { describe, it, expect } from 'vitest';
import { wfBiomeIndexToLegacyId, wfBiomeNameToLegacyId } from '../wfBiomeToLegacy';
import { BIOMES } from '../../../../data/biomes';

describe('wfBiomeToLegacy', () => {
  it('maps each FMG biome index to a real legacy biome id', () => {
    for (let i = 0; i <= 12; i++) {
      const id = wfBiomeIndexToLegacyId(i);
      expect(BIOMES[id]).toBeDefined(); // every mapping points at a real biome
    }
  });

  it('maps representative names correctly', () => {
    expect(wfBiomeNameToLegacyId('Temperate deciduous forest')).toBe('forest_temperate');
    expect(wfBiomeNameToLegacyId('Savanna')).toBe('plains_savanna');
    expect(wfBiomeNameToLegacyId('Taiga')).toBe('forest_boreal');
    expect(wfBiomeNameToLegacyId('Wetland')).toBe('wetland_marsh');
  });

  it('all land-biome (index >= 1) mappings are passable; falls back when out of range', () => {
    for (let i = 1; i <= 12; i++) {
      expect(BIOMES[wfBiomeIndexToLegacyId(i)].passable).toBe(true);
    }
    expect(wfBiomeIndexToLegacyId(99)).toBe('plains_meadow');
    expect(wfBiomeNameToLegacyId('Nonsense')).toBe('plains_meadow');
    expect(wfBiomeNameToLegacyId(undefined)).toBe('plains_meadow');
  });
});
