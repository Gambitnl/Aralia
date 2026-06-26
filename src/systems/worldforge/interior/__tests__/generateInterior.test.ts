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

/**
 * Every doorway must physically sit on the shared wall of the two rooms it
 * connects (and the entry on the street wall, within its room). A doorway that
 * floats off the boundary would mean an agent can't actually pass between the
 * rooms and the 3D renderer would punch a door through a solid wall.
 */
function assertDoorwaysOnSharedWalls(plan: InteriorPlan): void {
  const byId = new Map(plan.rooms.map((r) => [r.id, r]));
  for (const d of plan.doorways) {
    if (d.a === EXTERIOR) {
      const b = byId.get(d.b);
      expect(b, `entry room ${d.b} exists`).toBeTruthy();
      expect(d.y, 'entry door on street wall y=0').toBe(0);
      expect(b!.y, 'entry room touches street wall').toBe(0);
      expect(d.x).toBeGreaterThanOrEqual(b!.x);
      expect(d.x).toBeLessThanOrEqual(b!.x + b!.w);
      continue;
    }
    const a = byId.get(d.a);
    const b = byId.get(d.b);
    expect(a && b, `doorway rooms ${d.a},${d.b} exist`).toBeTruthy();
    if (!a || !b) continue;
    if (d.axis === 'y') {
      // Vertical shared wall at x = d.x; rooms adjacent left/right of it.
      const adjacent = (a.x + a.w === d.x && b.x === d.x) || (b.x + b.w === d.x && a.x === d.x);
      expect(adjacent, `axis-y doorway ${d.a}-${d.b} sits on the shared vertical wall`).toBe(true);
      expect(d.y).toBeGreaterThanOrEqual(Math.max(a.y, b.y));
      expect(d.y).toBeLessThanOrEqual(Math.min(a.y + a.d, b.y + b.d));
    } else {
      // Horizontal shared wall at y = d.y; rooms adjacent below/above it.
      const adjacent = (a.y + a.d === d.y && b.y === d.y) || (b.y + b.d === d.y && a.y === d.y);
      expect(adjacent, `axis-x doorway ${d.a}-${d.b} sits on the shared horizontal wall`).toBe(true);
      expect(d.x).toBeGreaterThanOrEqual(Math.max(a.x, b.x));
      expect(d.x).toBeLessThanOrEqual(Math.min(a.x + a.w, b.x + b.w));
    }
  }
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

it('every doorway sits on the shared wall of the rooms it connects', () => {
  assertDoorwaysOnSharedWalls(generateInterior(housePlot(), SEED_PATH));
  assertDoorwaysOnSharedWalls(generateInterior(marketPlot(), SEED_PATH));
});

/** No furnishing may sit on a doorway threshold it shares a room with. */
function assertDoorwaysUnblocked(plan: InteriorPlan): void {
  for (const dr of plan.doorways) {
    const blocking = plan.furnishings.filter(
      (f) => (f.roomId === dr.a || f.roomId === dr.b) &&
        Math.abs(f.x - dr.x) < 2.5 + 0.01 && Math.abs(f.y - dr.y) < 2.5 + 0.01,
    );
    expect(blocking, `door ${dr.a}-${dr.b} @(${dr.x},${dr.y}) blocked by ${blocking.map((b) => b.kind)}`).toEqual([]);
  }
}

it('keeps every doorway clear of furnishings (passable openings)', () => {
  // Regression: the per-role furnishing tables are blind to door positions, so
  // ~16% of doors used to have a prop on the threshold. Sweep many plots/seeds.
  assertDoorwaysUnblocked(generateInterior(housePlot(), SEED_PATH));
  assertDoorwaysUnblocked(generateInterior(marketPlot(), SEED_PATH));
  let id = 0;
  for (const seed of [1, 7, 42, 1234, 99999]) {
    const seedPath = rootSeedPath(seed);
    for (let w = 20; w <= 120; w += 20) {
      for (let d = 20; d <= 120; d += 20) {
        for (const role of ['house', 'market']) {
          assertDoorwaysUnblocked(
            generateInterior({ id: id++, footprint: [[0, 0], [w, 0], [w, d], [0, d]], role, storeys: 1 }, seedPath),
          );
        }
      }
    }
  }
});

it('holds tiling + connectivity + alignment across many plot sizes and seeds', () => {
  // The fixed-plot tests above prove two cases; the BSP doorway tree must hold
  // for ALL plots. Sweep a grid of frontage×depth (incl. degenerate slivers and
  // large halls) × roles × seeds and re-assert every structural invariant — this
  // is the seamless-interior guarantee (every room reachable, no gaps/overlaps),
  // and would surface any split that fails to record a connecting doorway.
  const mkPlot = (w: number, d: number, role: string, id: number): InteriorPlotInput => ({
    id,
    footprint: [[0, 0], [w, 0], [w, d], [0, d]],
    role,
    storeys: 1,
  });
  let id = 0;
  for (const seed of [1, 7, 42, 1234, 99999]) {
    const seedPath = rootSeedPath(seed);
    for (let w = 10; w <= 120; w += 15) {
      for (let d = 10; d <= 120; d += 15) {
        for (const role of ['house', 'market']) {
          const plan = generateInterior(mkPlot(w, d, role, id++), seedPath);
          assertTilesExactly(plan);
          assertConnected(plan);
          assertDoorwaysOnSharedWalls(plan);
          for (const r of plan.rooms) {
            expect(r.x % 5 === 0 && r.y % 5 === 0 && r.w % 5 === 0 && r.d % 5 === 0).toBe(true);
          }
        }
      }
    }
  }
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
