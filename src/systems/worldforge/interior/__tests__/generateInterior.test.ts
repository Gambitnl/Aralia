/**
 * @file generateInterior.test.ts
 * Invariants + determinism + golden for the legacy interior ADAPTER (Task 10):
 * generateInterior now maps generateBuilding's BlueprintPlan onto the legacy
 * InteriorPlan shape. Rooms are the BBOXES of (possibly L-shaped) blueprint
 * rooms, so the old exact-tiling / rect-shared-wall invariants no longer
 * apply; the new truth is: rooms stay inside the envelope, the envelope fits
 * the lot, doors touch both of their rooms' bboxes, and the door graph stays
 * fully connected from the street.
 */

import { blueprintForPlot, generateInterior, PURPOSE_TO_ROLE, rollBasement, type InteriorPlotInput } from '../generateInterior';
import { generateBuilding } from '../generateBuilding';
import { styleFamilyForCultureType } from '../../town/architectureStyle';
import { childSeedPath, rootSeedPath } from '../../seedPath';
import { EXTERIOR, type InteriorPlan } from '../types';
import type { HouseholdBrief, StyleContext } from '../blueprintTypes';

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

/**
 * Rooms are bboxes of possibly L-shaped blueprint rooms: they may overlap and
 * need not tile the envelope. New truth: every room rect is 5 ft aligned,
 * has positive area, and lies fully inside the envelope.
 */
function assertRoomsWithinEnvelope(plan: InteriorPlan): void {
  let bad = 0;
  for (const r of plan.rooms) {
    if (r.x % 5 || r.y % 5 || r.w % 5 || r.d % 5) bad++;
    if (r.w <= 0 || r.d <= 0) bad++;
    if (r.x < 0 || r.y < 0 || r.x + r.w > plan.widthFt || r.y + r.d > plan.depthFt) bad++;
  }
  expect(bad).toBe(0);
}

/**
 * Every doorway sits on a cell edge shared by the two rooms it connects (a
 * blueprint invariant), so its point must lie inside BOTH rooms' bboxes
 * (inclusive — bboxes are a loose bound for L-shaped rooms). The entry door
 * sits on an outer wall of its room, so it lies within the entry room's bbox
 * (no longer forced onto y=0: irregular footprints put the entry on whichever
 * outer wall the main room owns).
 */
function assertDoorwaysOnSharedWalls(plan: InteriorPlan): void {
  const byId = new Map(plan.rooms.map((r) => [r.id, r]));
  const within = (roomId: number, x: number, y: number): boolean => {
    const r = byId.get(roomId);
    return !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.d;
  };
  for (const d of plan.doorways) {
    if (d.a === EXTERIOR) {
      expect(byId.get(d.b), `entry room ${d.b} exists`).toBeTruthy();
      expect(within(d.b, d.x, d.y), `entry door @(${d.x},${d.y}) inside room ${d.b} bbox`).toBe(true);
      continue;
    }
    expect(within(d.a, d.x, d.y), `door ${d.a}-${d.b} @(${d.x},${d.y}) inside room ${d.a} bbox`).toBe(true);
    expect(within(d.b, d.x, d.y), `door ${d.a}-${d.b} @(${d.x},${d.y}) inside room ${d.b} bbox`).toBe(true);
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

it('room bboxes are 5 ft aligned and inside the envelope (house + market)', () => {
  assertRoomsWithinEnvelope(generateInterior(housePlot(), SEED_PATH));
  assertRoomsWithinEnvelope(generateInterior(marketPlot(), SEED_PATH));
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

it('holds lot-fit + connectivity + alignment across many plot sizes and seeds', () => {
  // The fixed-plot tests above prove two cases; the adapter contract must hold
  // for ALL plots. Sweep a grid of frontage×depth (incl. tiny lots that force
  // footprint clamping) × roles × seeds and re-assert every structural
  // invariant — every room reachable from the street, rooms inside the
  // envelope, doors touching their rooms, and the building fitting the lot.
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
          assertRoomsWithinEnvelope(plan);
          assertConnected(plan);
          assertDoorwaysOnSharedWalls(plan);
          // Lot fit (C3-T2): the building envelope never overhangs the plot.
          expect(plan.widthFt).toBeLessThanOrEqual(Math.max(10, w));
          expect(plan.depthFt).toBeLessThanOrEqual(Math.max(10, d));
        }
      }
    }
  }
});

it('does not discard a cell from a rotated or affine 15 ft lot', () => {
  const nearlyFifteen = 15 - 1e-12;
  const plan = blueprintForPlot({
    id: 515,
    footprint: [
      [0, 0],
      [nearlyFifteen, 0],
      [nearlyFifteen, nearlyFifteen],
      [0, nearlyFifteen],
    ],
    role: 'house',
    storeys: 1,
    ensemble: {
      blockKey: 'ward:5:edge:1',
      kind: 'row',
      partyWallLeft: false,
      partyWallRight: false,
      eaveStoreys: 1,
      lotProfile: 'full-envelope',
      lotSignature: 'floating-lot-proof',
      ensembleSignature: 'floating-row-proof',
    },
  }, rootSeedPath(515));

  expect([plan.widthFt, plan.depthFt]).toEqual([15, 15]);
  expect(plan.footprintCells).toHaveLength(9);
});

it('has exactly one entry door, into a room with the role from the plot role', () => {
  // Adapter truth: the entry sits on an outer wall of the MAIN room (any
  // side — irregular footprints retired the fixed y=0 street wall), and the
  // main room's purpose maps through the role table: house→cottage→hall,
  // market→shop→shopfront→shopfloor.
  const house = generateInterior(housePlot(), SEED_PATH);
  const market = generateInterior(marketPlot(), SEED_PATH);
  for (const [plan, role] of [
    [house, 'hall'],
    [market, 'shopfloor'],
  ] as const) {
    const entries = plan.doorways.filter((d) => d.a === EXTERIOR);
    expect(entries).toHaveLength(1);
    const entryRoom = plan.rooms.find((r) => r.id === entries[0].b)!;
    expect(entryRoom).toBeDefined();
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

describe('adapter shape (Task 10): InteriorPlan is a faithful collapse of the BlueprintPlan', () => {
  it('maps rooms to bboxes, roles via the purpose table, and passes doors/furnishings/stairs through', () => {
    const plot = marketPlot();
    const legacy = generateInterior(plot, SEED_PATH);
    // Reproduce the plan the adapter must have used: same seed segment, same
    // buildingId (=== plot.id), same lot caps (80×60 snapped).
    const plan = generateBuilding({
      buildingId: plot.id,
      type: 'shop', // market → shop
      seedPath: childSeedPath(SEED_PATH, `interior:${plot.id}`),
      storeys: plot.storeys,
      maxWidthFt: 80,
      maxDepthFt: 60,
    });
    expect(legacy.plotId).toBe(plot.id);
    expect(legacy.widthFt).toBe(plan.widthFt);
    expect(legacy.depthFt).toBe(plan.depthFt);
    expect(legacy.storeys).toBe(plot.storeys);

    const ground = plan.floors.find((f) => f.level === 0)!;
    expect(legacy.rooms).toEqual(ground.rooms.map((r) => ({
      id: r.id, role: PURPOSE_TO_ROLE[r.purpose],
      x: r.bbox.x, y: r.bbox.y, w: r.bbox.w, d: r.bbox.d,
    })));
    expect(legacy.doorways).toEqual(ground.doors.map((d) => ({
      a: d.a, b: d.b, x: d.x, y: d.y, axis: d.axis,
    })));
    // Furnishings pass through UNCHANGED — including kinds the legacy 3D
    // bridge has no mesh for yet (bench/altar/desk/chair/weapon-rack); the
    // adapter never drops them.
    expect(legacy.furnishings).toEqual(ground.furnishings.map((f) => ({
      kind: f.kind, roomId: f.roomId, x: f.x, y: f.y, rotation: f.rotation,
    })));
    expect(legacy.upperFloors.map((f) => f.level)).toEqual(
      plan.floors.filter((f) => f.level >= 1).map((f) => f.level),
    );
    expect(legacy.stairs).toEqual(
      plan.stairs.filter((s) => s.fromLevel >= 0).map((s) => ({ fromFloor: s.fromLevel, x: s.x, y: s.y })),
    );
  });

  it('covers every RoomPurpose with a legacy RoomRole (total mapping)', () => {
    const purposes = [
      'hall', 'common-room', 'great-hall', 'nave', 'kitchen', 'bedroom',
      'guest-room', 'private-room', 'solar', 'shopfront', 'workshop', 'storage',
      'pantry', 'cellar', 'armory', 'sanctuary', 'vestry', 'study',
      'guard-room', 'corridor',
    ] as const;
    const legal = new Set(['hall', 'bedroom', 'kitchen', 'storage', 'workshop', 'shopfloor']);
    for (const p of purposes) {
      expect(legal.has(PURPOSE_TO_ROLE[p]), `purpose ${p} maps to a legacy role`).toBe(true);
    }
  });

  it('throws on an unmapped plot role (no silent fallback)', () => {
    expect(() =>
      generateInterior({ id: 1, footprint: [[0, 0], [40, 0], [40, 40], [0, 40]], role: 'aviary', storeys: 1 }, SEED_PATH),
    ).toThrow(/no BuildingType mapping/);
  });
});

describe('multi-storey buildings', () => {
  const townhouse = (storeys: number): InteriorPlotInput => ({
    id: 9,
    footprint: [[0, 0], [55, 0], [55, 40], [0, 40]],
    role: 'house',
    storeys,
  });

  const roomContaining = (rooms: InteriorPlan['rooms'], x: number, y: number): number => {
    const r = rooms.find((rm) => x >= rm.x && x < rm.x + rm.w && y >= rm.y && y < rm.y + rm.d);
    return r ? r.id : -1;
  };

  /** BFS the floor's doorway graph from a start room; every room must be reached. */
  function assertFloorConnectedFrom(rooms: InteriorPlan['rooms'], doorways: InteriorPlan['doorways'], startId: number): void {
    const adj = new Map<number, number[]>();
    for (const d of doorways) {
      adj.set(d.a, [...(adj.get(d.a) ?? []), d.b]);
      adj.set(d.b, [...(adj.get(d.b) ?? []), d.a]);
    }
    const seen = new Set<number>([startId]);
    const queue = [startId];
    while (queue.length) {
      const n = queue.shift()!;
      for (const m of adj.get(n) ?? []) if (!seen.has(m)) { seen.add(m); queue.push(m); }
    }
    expect(rooms.filter((r) => !seen.has(r.id))).toEqual([]);
  }

  it('single-storey buildings have no upper floors or stairs', () => {
    const plan = generateInterior(townhouse(1), SEED_PATH);
    expect(plan.upperFloors).toEqual([]);
    expect(plan.stairs).toEqual([]);
  });

  it('generates one upper floor and one stair per storey gap', () => {
    for (const storeys of [2, 3, 4]) {
      const plan = generateInterior(townhouse(storeys), SEED_PATH);
      expect(plan.storeys).toBe(storeys);
      expect(plan.upperFloors).toHaveLength(storeys - 1);
      expect(plan.stairs).toHaveLength(storeys - 1);
      expect(plan.upperFloors.map((f) => f.level)).toEqual(
        Array.from({ length: storeys - 1 }, (_, i) => i + 1),
      );
    }
  });

  it('stairs form one vertical shaft inside a room on every floor', () => {
    const plan = generateInterior(townhouse(3), SEED_PATH);
    // All stairs share one (x, y) column.
    const xs = new Set(plan.stairs.map((s) => `${s.x},${s.y}`));
    expect(xs.size).toBe(1);
    const { x, y } = plan.stairs[0];
    // The stair point lands inside a room on the ground floor AND each upper floor.
    expect(roomContaining(plan.rooms, x, y)).toBeGreaterThanOrEqual(0);
    for (const floor of plan.upperFloors) {
      expect(roomContaining(floor.rooms, x, y)).toBeGreaterThanOrEqual(0);
    }
    expect(plan.stairs.map((s) => s.fromFloor)).toEqual([0, 1]);
  });

  it('each upper floor stays in the envelope, doors touch their rooms, all rooms connected', () => {
    for (const storeys of [2, 3]) {
      const plan = generateInterior(townhouse(storeys), SEED_PATH);
      const stair = plan.stairs[0];
      for (const floor of plan.upperFloors) {
        const asPlan = { widthFt: plan.widthFt, depthFt: plan.depthFt, rooms: floor.rooms, doorways: floor.doorways } as InteriorPlan;
        assertRoomsWithinEnvelope(asPlan);
        assertDoorwaysOnSharedWalls(asPlan);
        // The stair shaft lands inside a room bbox on this floor; the floor's
        // door graph connects every room (bbox overlap can make the CONTAINING
        // room ambiguous, so connectivity is asserted from each candidate).
        const landing = roomContaining(floor.rooms, stair.x, stair.y);
        expect(landing).toBeGreaterThanOrEqual(0);
        assertFloorConnectedFrom(floor.rooms, floor.doorways, landing);
        // Upper floors have no street entry.
        expect(floor.doorways.some((d) => d.a === EXTERIOR)).toBe(false);
      }
    }
  });

  it('is deterministic across all floors', () => {
    expect(generateInterior(townhouse(4), SEED_PATH)).toEqual(generateInterior(townhouse(4), SEED_PATH));
  });
});

describe('basement decision (blueprint pipeline v1)', () => {
  const plotWith = (id: number, role: string): InteriorPlotInput => ({
    id,
    footprint: [
      [1000, 2000],
      [1060, 2000],
      [1060, 2045],
      [1000, 2045],
    ],
    role,
    storeys: 2,
  });

  it('rollBasement is deterministic and depends only on (type, interiorPath)', () => {
    const path = childSeedPath(SEED_PATH, 'interior:21');
    expect(rollBasement('tavern', path)).toBe(rollBasement('tavern', path));
    // Same draw, different threshold: a manor (0.9) rolls a basement whenever
    // a cottage (0.25) does — the chance table is monotone over one shared draw.
    for (let id = 1; id <= 30; id++) {
      const p = childSeedPath(SEED_PATH, `interior:${id}`);
      if (rollBasement('cottage', p)) expect(rollBasement('manor', p)).toBe(true);
    }
  });

  it('blueprintForPlot rolls basements deterministically per plot', () => {
    // Pinned outcomes under rootSeedPath(42): tavern plot 21 digs a cellar,
    // house plot 7 (the golden plot) does not.
    const withB = blueprintForPlot(plotWith(21, 'tavern'), SEED_PATH);
    const withoutB = blueprintForPlot(plotWith(7, 'house'), SEED_PATH);
    expect(withB.floors.some((f) => f.level === -1)).toBe(true);
    expect(withoutB.floors.some((f) => f.level === -1)).toBe(false);
    expect(blueprintForPlot(plotWith(21, 'tavern'), SEED_PATH))
      .toEqual(blueprintForPlot(plotWith(21, 'tavern'), SEED_PATH));
  });

  it('a rolled basement has no windows and one stair joining it to the ground floor', () => {
    const bp = blueprintForPlot(plotWith(21, 'tavern'), SEED_PATH);
    const cellar = bp.floors.find((f) => f.level === -1)!;
    expect(cellar.windows).toEqual([]);
    expect(cellar.doors.some((d) => d.a === EXTERIOR)).toBe(false);
    expect(bp.stairs.filter((s) => s.fromLevel === -1)).toHaveLength(1);
  });

  it('the legacy InteriorPlan adapter output stays basement-free', () => {
    const plan = generateInterior(plotWith(21, 'tavern'), SEED_PATH);
    // Level -1 is unrepresentable: no basement stair leaks through, upper
    // floors start at level 1, and rooms/doorways are the ground floor's.
    expect(plan.stairs.every((s) => s.fromFloor >= 0)).toBe(true);
    expect(plan.upperFloors.every((f) => f.level >= 1)).toBe(true);
  });
});

describe('v2 production wiring (Task 11): buildingType + household brief', () => {
  const QUAD_40x30: Array<[number, number]> = [[0, 0], [40, 0], [40, 30], [0, 30]];
  const FAMILY: HouseholdBrief = {
    homeId: 'b7',
    slots: [
      { tag: 'head', role: 'head', ageBand: 'adult' },
      { tag: 'spouse', role: 'spouse', ageBand: 'adult' },
      { tag: 'child:0', role: 'child', ageBand: 'child' },
    ],
    trade: 'blacksmith',
    worksAtHome: true,
    wealth: 'common',
  };

  it('buildingType wins over role; brief flows into the plan', () => {
    const plot: InteriorPlotInput = {
      id: 4, footprint: QUAD_40x30, role: 'house', storeys: 2,
      buildingType: 'smithy', household: FAMILY,
    };
    const plan = blueprintForPlot(plot, rootSeedPath(11));
    // buildingType overrides the role mapping (house→cottage would otherwise win).
    expect(plan.type).toBe('smithy');
    expect(plan.household?.homeId).toBe(FAMILY.homeId);

    // Legacy shape (no v2 fields) still generates identically to before —
    // briefless, and the type comes from the role table (house → cottage).
    const legacy = blueprintForPlot({ id: 4, footprint: QUAD_40x30, role: 'house', storeys: 2 }, rootSeedPath(11));
    expect(legacy.type).toBe('cottage');
    expect(legacy.household).toBeUndefined();
  });

  it('the household brief changes the generated plan (memo keys diverge)', () => {
    // A brief injects trade rooms + a bedroom program, so the same plot with a
    // brief must NOT collapse onto the briefless plan's memo entry.
    const base: InteriorPlotInput = { id: 8, footprint: QUAD_40x30, role: 'house', storeys: 2 };
    const briefed: InteriorPlotInput = { ...base, buildingType: 'smithy', household: FAMILY };
    const briefless = generateInterior(base, rootSeedPath(11));
    const withBrief = generateInterior(briefed, rootSeedPath(11));
    // Different inputs → different memo entries (not the same cached instance).
    expect(withBrief).not.toBe(briefless);
    // The briefless call remains byte-identical to a repeat briefless call.
    expect(generateInterior(base, rootSeedPath(11))).toEqual(briefless);
  });
});

describe('v2 production wiring (Task 7): atlas StyleContext → solved roof', () => {
  const QUAD_40x30: Array<[number, number]> = [[0, 0], [40, 0], [40, 30], [0, 30]];
  // A StyleContext exactly as the bake site (groundChunkLoader) assembles it:
  // cultureType from the burg (getBurgCultureType), climate from the burg's
  // biome (climateForBiomeId), wealth from the plot's ward district, ageBand new.
  const HIGHLAND_STYLE: StyleContext = {
    cultureType: 'Highland', climate: 'cold', wealth: 'common', ageBand: 'new',
  };

  it('a plot carrying a style context raises a solved roof + resolved dress', () => {
    const plot: InteriorPlotInput = {
      id: 3, footprint: QUAD_40x30, role: 'house', storeys: 2, style: HIGHLAND_STYLE,
    };
    const plan = blueprintForPlot(plot, rootSeedPath(11));
    expect(plan.roof).toBeDefined();
    expect(plan.styleResolved).toBeDefined();
    // familyId matches the culture's family (Highland → highlandStone), so the
    // 3D building dresses in the same family the 2D styled exterior uses.
    expect(plan.styleResolved!.familyId).toBe(styleFamilyForCultureType('Highland').id);
    expect(plan.styleResolved!.familyId).toBe('highlandStone');
    // The style context is echoed onto the plan (generateBuilding wiring).
    expect(plan.style).toEqual(HIGHLAND_STYLE);
  });

  it('a style-less plot raises NO roof and is byte-stable (honest absence, not fallback)', () => {
    const plot: InteriorPlotInput = { id: 3, footprint: QUAD_40x30, role: 'house', storeys: 2 };
    const plan = blueprintForPlot(plot, rootSeedPath(11));
    expect(plan.roof).toBeUndefined();
    expect(plan.styleResolved).toBeUndefined();
    expect(plan.style).toBeUndefined();
    // Byte-identical to a repeat style-less call — the added optional field
    // leaves the legacy (unstyled) path untouched.
    expect(blueprintForPlot(plot, rootSeedPath(11))).toEqual(plan);
  });

  it('the style context changes the generated interior (memo keys diverge)', () => {
    // Folding a style digest into the interior memo key means a styled plot must
    // NOT collapse onto the style-less plan's cached InteriorPlan.
    const base: InteriorPlotInput = { id: 5, footprint: QUAD_40x30, role: 'house', storeys: 2 };
    const styled: InteriorPlotInput = { ...base, style: HIGHLAND_STYLE };
    const plain = generateInterior(base, rootSeedPath(11));
    const withStyle = generateInterior(styled, rootSeedPath(11));
    expect(withStyle).not.toBe(plain);
    // The style-less call is unchanged from a repeat (empty style digest segment).
    expect(generateInterior(base, rootSeedPath(11))).toEqual(plain);
  });

  it('style never moves the bones: same plot ± style ⇒ identical rooms/doorways/stairs', () => {
    // The style-identity invariant: resolveStyle/solveRoof are additive, so the
    // collapsed InteriorPlan (which carries no roof) is unchanged by a style.
    const base: InteriorPlotInput = { id: 6, footprint: QUAD_40x30, role: 'house', storeys: 2 };
    const plain = generateInterior(base, rootSeedPath(11));
    const styled = generateInterior({ ...base, style: HIGHLAND_STYLE }, rootSeedPath(11));
    expect(styled.rooms).toEqual(plain.rooms);
    expect(styled.doorways).toEqual(plain.doorways);
    expect(styled.stairs).toEqual(plain.stairs);
    expect(styled.upperFloors).toEqual(plain.upperFloors);
  });
});
