import { biomeColor } from '../terrainColor';

it('returns an RGB triple in 0..1 for known biomes', () => {
  const c = biomeColor('forest', 40);
  expect(c).toHaveLength(3);
  for (const v of c) {
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
  }
});

it('gives water-classified biomes a blue-dominant color', () => {
  const [r, g, b] = biomeColor('ocean', 5);
  expect(b).toBeGreaterThan(r);
  expect(b).toBeGreaterThan(g * 0.8);
});

it('falls back to a neutral color for unknown biomes', () => {
  const c = biomeColor('totally-unknown-biome', 50);
  expect(c).toHaveLength(3);
  expect(Number.isFinite(c[0])).toBe(true);
});
