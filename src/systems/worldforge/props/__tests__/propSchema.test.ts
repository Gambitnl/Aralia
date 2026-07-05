import { describe, it, expect } from 'vitest';
import {
  providesCover,
  validatePropDefinition,
  CELL_METERS,
  type PropDefinition,
} from '../propSchema';

const good: PropDefinition = {
  id: 'crate',
  name: 'Crate',
  sizeClass: 'S',
  referee: {
    cover: 'half',
    blocksLoS: false,
    blocksMovement: true,
    difficultTerrain: false,
    material: 'wood',
    thicknessInches: 1,
  },
  flammable: true,
  destructible: true,
  gen: 'PC',
  placementTags: ['market'],
};

describe('propSchema', () => {
  it('CELL_METERS is a 5-ft cell', () => {
    expect(CELL_METERS).toBeCloseTo(1.524, 4);
  });

  it('providesCover derives from the cover rung', () => {
    expect(providesCover(good)).toBe(true);
    expect(providesCover({ ...good, referee: { ...good.referee, cover: 'none' } })).toBe(false);
  });

  it('validates a good definition', () => {
    expect(validatePropDefinition(good)).toEqual([]);
  });

  it('rejects bad ids, sizes, cover, thickness, gen, and empty tags', () => {
    expect(validatePropDefinition({ ...good, id: 'Bad Id' }).length).toBeGreaterThan(0);
    expect(validatePropDefinition({ ...good, sizeClass: 'X' as never }).length).toBeGreaterThan(0);
    expect(
      validatePropDefinition({ ...good, referee: { ...good.referee, cover: 'partial' as never } }).length,
    ).toBeGreaterThan(0);
    expect(
      validatePropDefinition({ ...good, referee: { ...good.referee, thicknessInches: 0 } }).length,
    ).toBeGreaterThan(0);
    expect(validatePropDefinition({ ...good, gen: 'ZZ' as never }).length).toBeGreaterThan(0);
    expect(validatePropDefinition({ ...good, placementTags: [] }).length).toBeGreaterThan(0);
  });

  it('rejects a prop that both blocks movement and is difficult terrain', () => {
    const problems = validatePropDefinition({
      ...good,
      referee: { ...good.referee, blocksMovement: true, difficultTerrain: true },
    });
    expect(problems.some((p) => /blocksMovement and difficultTerrain/.test(p))).toBe(true);
  });
});
