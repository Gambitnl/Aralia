import { placeSites } from '../sites';
import { SeededRandom } from '@/utils/random';

const flatHeights = (cols: number, rows: number) => {
  const h = new Array(cols * rows).fill(40);
  for (let x = 0; x < cols; x++) h[x] = 10; // coast at y=0
  return h;
};

it('places at least one town with a non-empty footprint', () => {
  const cols = 20;
  const rows = 10;
  const heights = flatHeights(cols, rows);
  const rng = new SeededRandom(1234);
  const sites = placeSites(heights, cols, rows, [], rng, { townTarget: 4, dungeonTarget: 2, ruinTarget: 2 });
  const towns = sites.filter((s) => s.kind === 'town');
  expect(towns.length).toBeGreaterThan(0);
  expect(towns[0].footprint.length).toBeGreaterThanOrEqual(3);
});

it('honours minimum spacing between sites of the same kind', () => {
  const cols = 30;
  const rows = 20;
  const heights = flatHeights(cols, rows);
  const rng = new SeededRandom(5678);
  const sites = placeSites(heights, cols, rows, [], rng, { townTarget: 10, dungeonTarget: 0, ruinTarget: 0 });
  const towns = sites.filter((s) => s.kind === 'town');
  for (let i = 0; i < towns.length; i++) {
    for (let j = i + 1; j < towns.length; j++) {
      const dx = towns[i].position.x - towns[j].position.x;
      const dy = towns[i].position.y - towns[j].position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      expect(dist).toBeGreaterThanOrEqual(3);
    }
  }
});

it('is deterministic for a given seed', () => {
  const cols = 20;
  const rows = 10;
  const heights = flatHeights(cols, rows);
  const a = placeSites(heights, cols, rows, [], new SeededRandom(42), { townTarget: 4, dungeonTarget: 2, ruinTarget: 2 });
  const b = placeSites(heights, cols, rows, [], new SeededRandom(42), { townTarget: 4, dungeonTarget: 2, ruinTarget: 2 });
  expect(JSON.stringify(a)).toBe(JSON.stringify(b));
});

it('reaches dungeon/ruin targets without being blocked by towns (per-kind spacing)', () => {
  const cols = 40;
  const rows = 30;
  const heights = new Array(cols * rows).fill(40);
  const rng = new SeededRandom(9999);
  const sites = placeSites(heights, cols, rows, [], rng, {
    townTarget: 5,
    dungeonTarget: 5,
    ruinTarget: 5,
  });
  expect(sites.filter((s) => s.kind === 'town').length).toBe(5);
  expect(sites.filter((s) => s.kind === 'dungeon').length).toBe(5);
  expect(sites.filter((s) => s.kind === 'ruin').length).toBe(5);
});
