/**
 * @file generateInterior.test.ts
 * Invariants + determinism + golden for the L4 interior generator.
 */

import { generateInterior, type InteriorPlotInput } from '../generateInterior';
import { EXTERIOR, type InteriorPlan } from '../types';
import { rootSeedPath } from '../../seedPath';

const SEED_PATH = rootSeedPath(42);

const housePlot = (): InteriorPlotInput => ({
  id: 7,
  // 60 ft frontage × 45 ft depth quad at an arbitrary world offset/rotation-
  // free pose (the generator only uses edge lengths).
  footprint: [
    [1000, 2000],
    [1060, 2000],
    [1060, 2045],
    [1000, 2045],
  ],
  role: 'house',
  storeys: 1,
});

const marketPlot = (): InteriorPlotInput => ({
  id: 12,
  footprint: [
    [500, 800],
    [580, 800],
    [580, 860],
    [500, 860],
  ],
  role: 'market',
  storeys: 2,
});

/** Raster the rooms onto the 5 ft cell grid; every cell exactly once. */
function assertTilesExactly(plan: InteriorPlan): void {
  const cols = plan.widthFt / 5;
  const rows = plan.depthFt / 5;
  const hits = new Int32Array(cols * rows);
  for (const r of plan.rooms) {
    for (let y = r.y / 5; y < (r.y + r.d) / 5; y++) {
      for (let x = r.x / 5; x < (r.x + r.w) / 5; x++) {
        hits[y * cols + x]++;
      }
    }
  }
  let bad = 0;
  for (let i = 0; i < hits.length; i++) {
    if (hits[i] !== 1) bad++;
  }
  expect(bad).toBe(0);
}

/** BFS the doorway graph from the street; every room must be reachable. */
function assertConnected(plan: InteriorPlan): void {
  const adj = new Map<number, number[]>();
  for (const d of plan.doorways) {
    adj.set(d.a, [...(adj.get(d.a) ?? []), d.b]);
    adj.set(d.b, [...(adj.get(d.b) ?? []), d.a]);
  }
  const seen = new Set<number>([EXTERIOR]);
  const queue = [EXTERIOR];
  while (queue.length) {
    const n = queue.shift()!;
    for (const m of adj.get(n) ?? []) {
      if (!seen.has(m)) {
        seen.add(m);
        queue.push(m);
      }
    }
  }
  const unreached = plan.rooms.filter((r) => !seen.has(r.id));
  expect(unreached).toEqual([]);
}

it('is deterministic: same plot + seed path → deep-equal plan', () => {
  const a = generateInterior(housePlot(), SEED_PATH);
  const b = generateInterior(housePlot(), SEED_PATH);
  expect(b).toEqual(a);
});

it('rooms tile the envelope exactly on the 5 ft grid (house + market)', () => {
  assertTilesExactly(generateInterior(housePlot(), SEED_PATH));
  assertTilesExactly(generateInterior(marketPlot(), SEED_PATH));
});

it('room rects are 5 ft aligned; doors and furnishings on half-cell centers', () => {
  const plan = generateInterior(housePlot(), SEED_PATH);
  let misaligned = 0;
  for (const r of plan.rooms) {
    if (r.x % 5 || r.y % 5 || r.w % 5 || r.d % 5) misaligned++;
  }
  for (const d of plan.doorways) {
    if ((d.x * 2) % 5 || (d.y * 2) % 5) misaligned++;
  }
  for (const f of plan.furnishings) {
    if ((f.x * 2) % 5 || (f.y * 2) % 5) misaligned++;
  }
  expect(misaligned).toBe(0);
});

it('every room is reachable from the street door', () => {
  assertConnected(generateInterior(housePlot(), SEED_PATH));
  assertConnected(generateInterior(marketPlot(), SEED_PATH));
});

it('entry room sits on the street wall with the role from the plot role', () => {
  const house = generateInterior(housePlot(), SEED_PATH);
  const market = generateInterior(marketPlot(), SEED_PATH);
  for (const [plan, role] of [
    [house, 'hall'],
    [market, 'shopfloor'],
  ] as const) {
    const entryDoor = plan.doorways.find((d) => d.a === EXTERIOR)!;
    expect(entryDoor).toBeDefined();
    expect(entryDoor.y).toBe(0);
    const entryRoom = plan.rooms.find((r) => r.id === entryDoor.b)!;
    expect(entryRoom.y).toBe(0);
    expect(entryRoom.role).toBe(role);
  }
});

it('furnishings stay inside their room', () => {
  const plan = generateInterior(marketPlot(), SEED_PATH);
  let outside = 0;
  for (const f of plan.furnishings) {
    const r = plan.rooms.find((room) => room.id === f.roomId)!;
    if (f.x < r.x || f.x > r.x + r.w || f.y < r.y || f.y > r.y + r.d) outside++;
  }
  expect(outside).toBe(0);
});

it('matches the frozen golden for the fixed house plot', () => {
  expect(generateInterior(housePlot(), SEED_PATH)).toMatchSnapshot('house-interior-golden');
});
