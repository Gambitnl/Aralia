import { selectLodTier, LOD_RINGS } from '../lod';

it('classifies chunk distance into tiers', () => {
  expect(selectLodTier(0)).toBe('full');
  expect(selectLodTier(LOD_RINGS.full)).toBe('full');
  expect(selectLodTier(LOD_RINGS.full + 1)).toBe('mid');
  expect(selectLodTier(LOD_RINGS.mid)).toBe('mid');
  expect(selectLodTier(LOD_RINGS.mid + 1)).toBe('low');
  expect(selectLodTier(LOD_RINGS.low)).toBe('low');
  expect(selectLodTier(LOD_RINGS.low + 1)).toBe('culled');
});

it('tiers are ordered full < mid < low by ring distance', () => {
  expect(LOD_RINGS.full).toBeLessThan(LOD_RINGS.mid);
  expect(LOD_RINGS.mid).toBeLessThan(LOD_RINGS.low);
});
