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

// Task 10 (MOUNTAINS): glacier windows get a real ice surface, killing the
// brown-rock glacier bug. `ice` is a distinct light, blue-leaning palette id.
it('ice: a light blue-leaning tint distinct from the brown-grey mountain rock it replaces', () => {
  const ice = biomeColor('ice', 5);
  const mountain = biomeColor('mountain', 5);
  // Light + blue-leaning: blue channel dominates and the whole tint is bright.
  expect(ice[2]).toBeGreaterThan(ice[0]);
  expect(ice[2]).toBeGreaterThan(0.8);
  expect(Math.min(ice[0], ice[1], ice[2])).toBeGreaterThan(0.7);
  // Clearly different from the mountain rock that glaciers used to render as.
  const dist =
    Math.abs(ice[0] - mountain[0]) +
    Math.abs(ice[1] - mountain[1]) +
    Math.abs(ice[2] - mountain[2]);
  expect(dist).toBeGreaterThan(0.3);
});

// 2026-08-04: a deciduous forest window's ground rendered as pale sand — the
// adapter gave it `grassland` and the golden-hour key light multiplied that
// bright, green-dominant tint into flat khaki. `forest_floor` is leaf litter.
it('forest_floor: dark brown-olive litter, well under open grassland in value', () => {
  const litter = biomeColor('forest_floor', 5);
  const grass = biomeColor('grassland', 5);
  const luma = ([r, g, b]: number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Darker than open meadow by more than half — that gap is what survives a
  // warm low sun as brown instead of sand.
  expect(luma(litter)).toBeLessThan(luma(grass) * 0.55);
  // Brown-olive: warm (red leads), never green-dominant the way meadow is.
  expect(litter[0]).toBeGreaterThan(litter[1]);
  expect(litter[1]).toBeGreaterThan(litter[2]);
  expect(grass[1]).toBeGreaterThan(grass[0]);
  // Desaturated: a saturated brown reads as terracotta, not leaf litter.
  const sat = (Math.max(...litter) - Math.min(...litter)) / Math.max(...litter);
  expect(sat).toBeLessThan(0.5);
});

// Dry biomes must STAY pale — the forest fix is biome-driven, not a global
// darkening of the terrain.
it('desert and dirt keep their pale, warm tints', () => {
  const luma = ([r, g, b]: number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  expect(luma(biomeColor('desert', 5))).toBeGreaterThan(0.55);
  expect(luma(biomeColor('dirt', 5))).toBeGreaterThan(0.3);
});
