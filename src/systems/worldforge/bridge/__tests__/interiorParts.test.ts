/**
 * @file interiorParts.test.ts
 * Invariants for the L4 interior → 3D parts conversion: determinism, an
 * OPEN entry doorway in the street wall (seamless decision #11), wall/
 * furnishing bounds.
 */

import {
  buildInteriorParts,
  INTERIOR_WALL_COLOR,
  PERIMETER_WALL_COLORS,
  type OccupantFigure,
  type OccupantBody,
} from '../interiorParts';

const isWallColor = (c: string): boolean =>
  c === INTERIOR_WALL_COLOR || Object.values(PERIMETER_WALL_COLORS).includes(c);
import { generateInterior, type InteriorPlotInput } from '../../interior/generateInterior';
import { isAtWork } from '../groundChunkLoader';
import { EXTERIOR } from '../../interior/types';
import { rootSeedPath } from '../../seedPath';

const SEED_PATH = rootSeedPath(42);
const FT = 0.3048;
const FLOOR_COLOR = '#9a8a72';
const WALL_THICKNESS_M = 0.3;

const plot = (): InteriorPlotInput => ({
  id: 7,
  footprint: [
    [1000, 2000],
    [1060, 2000],
    [1060, 2045],
    [1000, 2045],
  ],
  role: 'house',
  storeys: 1,
});

/** A plausible adult body (meters + hex) — the BODY-1 projection the renderer
 * now consumes. Placement tests use a fixed body; the variation test below
 * supplies distinct bodies to prove the renderer reads them. */
const body = (over: Partial<OccupantBody> = {}): OccupantBody => ({
  heightM: 1.7,
  shoulderWidthM: 0.45,
  depthM: 0.28,
  headSizeM: 0.25,
  skinToneHex: '#e0ac69',
  clothingHex: '#6e4a3a',
  ...over,
});

const fig = (
  id: number,
  ageBand: 'child' | 'adult' | 'elder',
  atWork?: boolean,
): OccupantFigure => ({ id, ageBand, atWork, body: body() });

it('is deterministic', () => {
  expect(buildInteriorParts(plot(), SEED_PATH, 3)).toEqual(buildInteriorParts(plot(), SEED_PATH, 3));
});

it('produces perimeter + interior walls and furnishings', () => {
  const parts = buildInteriorParts(plot(), SEED_PATH, 3);
  const walls = parts.filter((p) => isWallColor(p.colorHex));
  const furnishings = parts.filter((p) => !isWallColor(p.colorHex) && p.colorHex !== FLOOR_COLOR);
  // 4 perimeter lines (front split by the door = at least 5 runs) plus at
  // least one internal wall for a 60×45 multi-room house.
  expect(walls.length).toBeGreaterThanOrEqual(6);
  expect(furnishings.length).toBeGreaterThan(0);
});

it('merges wall runs so no wall parts overlap on the same line', () => {
  const parts = buildInteriorParts(plot(), SEED_PATH, 3);
  const walls = parts.filter((p) => isWallColor(p.colorHex));
  let overlaps = 0;

  // Wall rectangles that share the same center line should be disjoint in
  // their long axis. This catches the doubled shared-room walls that render
  // as twinned slabs inside a building.
  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      const a = walls[i];
      const b = walls[j];
      const bothHorizontal = a.d === WALL_THICKNESS_M && b.d === WALL_THICKNESS_M;
      const bothVertical = a.w === WALL_THICKNESS_M && b.w === WALL_THICKNESS_M;
      if (bothHorizontal && Math.abs(a.z - b.z) < 0.001) {
        const overlap = Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2);
        if (overlap > 0.001) overlaps++;
      }
      if (bothVertical && Math.abs(a.x - b.x) < 0.001) {
        const overlap = Math.min(a.z + a.d / 2, b.z + b.d / 2) - Math.max(a.z - a.d / 2, b.z - b.d / 2);
        if (overlap > 0.001) overlaps++;
      }
    }
  }

  expect(overlaps).toBe(0);
});

it('emits one first floor slab that spans the full interior envelope', () => {
  const plan = generateInterior(plot(), SEED_PATH);
  const parts = buildInteriorParts(plot(), SEED_PATH, 3);
  const floors = parts.filter((p) => p.colorHex === FLOOR_COLOR);

  // The floor is a single worn-plank slab under the whole generated interior,
  // emitted first so later renderers can draw walls and props above it.
  expect(floors.length).toBe(1);
  expect(parts[0]).toBe(floors[0]);
  expect(floors[0]).toMatchObject({
    x: 0,
    z: 0,
    w: plan.widthFt * FT,
    d: plan.depthFt * FT,
  });
  expect(floors[0].h).toBeLessThanOrEqual(0.15);
});

it('leaves the entry doorway open in the street wall', () => {
  const plan = generateInterior(plot(), SEED_PATH);
  const entry = plan.doorways.find((d) => d.a === EXTERIOR)!;
  const parts = buildInteriorParts(plot(), SEED_PATH, 3);

  // Street wall in part coords: z = -depth/2 (in meters).
  const streetZ = (0 - plan.depthFt / 2) * FT;
  const doorX = (entry.x - plan.widthFt / 2) * FT;
  const blocking = parts.filter(
    (p) =>
      Math.abs(p.z - streetZ) < 0.01 &&
      doorX > p.x - p.w / 2 &&
      doorX < p.x + p.w / 2,
  );
  expect(blocking).toEqual([]);

  // ...but the street wall still exists either side of the gap.
  const streetWallRuns = parts.filter((p) => Math.abs(p.z - streetZ) < 0.01);
  expect(streetWallRuns.length).toBeGreaterThanOrEqual(2);
});

it('places occupant figures inside the envelope with stable heights', () => {
  const occupants = [fig(1, 'adult'), fig(2, 'child'), fig(3, 'elder')];
  const base = buildInteriorParts(plot(), SEED_PATH, 3);
  const withPeople = buildInteriorParts(plot(), SEED_PATH, 3, occupants);
  // Each villager is now two parts: a clothed body box + a skin-toned head.
  expect(withPeople.length).toBe(base.length + occupants.length * 2);
  const figures = withPeople.slice(base.length);
  const plan = generateInterior(plot(), SEED_PATH);
  const hw = (plan.widthFt / 2) * FT;
  const hd = (plan.depthFt / 2) * FT;
  const bad = figures.filter(
    (f) => Math.abs(f.x) > hw || Math.abs(f.z) > hd || f.h <= 0 || f.h > 1.8,
  );
  expect(bad).toEqual([]);

  // Time-of-day: a worker stands front-of-house (closer to the street wall
  // at z = -depth/2) than the same person at home.
  const [home] = buildInteriorParts(plot(), SEED_PATH, 3, [fig(1, 'adult')]).slice(-1);
  const [atWork] = buildInteriorParts(plot(), SEED_PATH, 3, [fig(1, 'adult', true)]).slice(-1);
  expect(atWork.z).toBeLessThan(home.z);
});

it('renders each occupant from its parametric body, not a uniform crate', () => {
  const tall: OccupantFigure = {
    id: 1,
    ageBand: 'adult',
    body: body({ heightM: 1.95, shoulderWidthM: 0.52, depthM: 0.34, headSizeM: 0.27, skinToneHex: '#8d5524', clothingHex: '#4a5e6e' }),
  };
  const small: OccupantFigure = {
    id: 2,
    ageBand: 'child',
    body: body({ heightM: 1.05, shoulderWidthM: 0.3, depthM: 0.2, headSizeM: 0.2, skinToneHex: '#ffdbac', clothingHex: '#5e6e4a' }),
  };
  const base = buildInteriorParts(plot(), SEED_PATH, 3).length;
  const [bodyTall, headTall] = buildInteriorParts(plot(), SEED_PATH, 3, [tall]).slice(base);
  const [bodySmall] = buildInteriorParts(plot(), SEED_PATH, 3, [small]).slice(base);

  // Dimensions and palette track the body, not a hardcoded constant.
  expect(bodyTall.h).toBeGreaterThan(bodySmall.h); // taller body → taller box
  expect(bodyTall.w).toBeCloseTo(0.52, 5); // shoulders → body width
  expect(bodyTall.colorHex).toBe('#4a5e6e'); // clothing palette
  expect(headTall.colorHex).toBe('#8d5524'); // skin tone
  expect(headTall.h).toBeCloseTo(0.27, 5); // head size
  expect(headTall.baseY).toBeCloseTo(bodyTall.h, 5); // head sits on the body
});

it('places every occupant center away from wall rectangles', () => {
  const occupants = Array.from({ length: 20 }, (_, id) => fig(id, 'adult'));
  const parts = buildInteriorParts(plot(), SEED_PATH, 3, occupants);
  const walls = parts.filter((p) => isWallColor(p.colorHex));
  const figures = parts.slice(-occupants.length);
  let violations = 0;

  // Occupant centers need breathing room around wall slabs. A center that is
  // inside or too close to a wall rectangle can render as a villager embedded
  // in plaster at first-person scale.
  for (const figure of figures) {
    for (const wall of walls) {
      const dx = Math.max(Math.abs(figure.x - wall.x) - wall.w / 2, 0);
      const dz = Math.max(Math.abs(figure.z - wall.z) - wall.d / 2, 0);
      const distance = Math.hypot(dx, dz);
      if (distance < 0.4) violations++;
    }
  }

  expect(violations).toBe(0);
});

it('keeps every part inside the interior envelope (plus wall thickness)', () => {
  const plan = generateInterior(plot(), SEED_PATH);
  const parts = buildInteriorParts(plot(), SEED_PATH, 3);
  const hw = (plan.widthFt / 2) * FT + 0.31;
  const hd = (plan.depthFt / 2) * FT + 0.31;
  const outside = parts.filter(
    (p) => Math.abs(p.x) > hw || Math.abs(p.z) > hd || p.h <= 0,
  );
  expect(outside).toEqual([]);
});

it('staggered work hours: per-occupant start 7-9, end 16-19, deterministic', () => {
  let violations = 0;
  let staggered = false;
  let firstStart: number | null = null;
  for (let id = 0; id < 60; id++) {
    // Derive this occupant's start/end by scanning hours.
    let start = -1;
    let end = -1;
    for (let h = 0; h < 24; h++) {
      const at = isAtWork(id, h);
      if (at && start === -1) start = h;
      if (!at && start !== -1 && end === -1) end = h;
    }
    if (start < 7 || start > 9 || end < 16 || end > 19) violations++;
    if (isAtWork(id, 12) !== isAtWork(id, 12)) violations++;
    if (firstStart === null) firstStart = start;
    else if (start !== firstStart) staggered = true;
  }
  expect(violations).toBe(0);
  // At least two occupants in 60 differ — the whole town must not move in
  // lockstep (the v1 behavior this replaces).
  expect(staggered).toBe(true);
});

it('interior doorway gaps are open through coincident duplicate walls', () => {
  const plan = generateInterior(plot(), SEED_PATH);
  const parts = buildInteriorParts(plot(), SEED_PATH, 3);
  let blocked = 0;
  for (const door of plan.doorways) {
    if (door.a === EXTERIOR) continue;
    const dx = (door.x - plan.widthFt / 2) * FT;
    const dz = (door.y - plan.depthFt / 2) * FT;
    for (const p of parts) {
      if (!isWallColor(p.colorHex)) continue;
      const inX = dx > p.x - p.w / 2 + 0.01 && dx < p.x + p.w / 2 - 0.01;
      const inZ = dz > p.z - p.d / 2 + 0.01 && dz < p.z + p.d / 2 - 0.01;
      if (inX && inZ) blocked++;
    }
  }
  expect(blocked).toBe(0);
});

describe('multi-storey parts', () => {
  const STAIR_COLOR = '#7a5a36';
  const tall = (storeys: number): InteriorPlotInput => ({
    id: 7,
    footprint: [[1000, 2000], [1055, 2000], [1055, 2040], [1000, 2040]],
    role: 'house',
    storeys,
  });

  it('a single-storey building emits no elevated parts', () => {
    // No occupants → nothing has baseY (heads are the only other baseY user).
    const parts = buildInteriorParts(plot(), SEED_PATH, 6);
    expect(parts.every((p) => (p.baseY ?? 0) === 0)).toBe(true);
    expect(parts.some((p) => p.colorHex === STAIR_COLOR)).toBe(false);
  });

  it('emits stacked upper floors at rising elevations + a stair flight per gap', () => {
    const storeys = 3;
    const shellH = 9;
    const parts = buildInteriorParts(tall(storeys), SEED_PATH, shellH);
    const storeyH = shellH / storeys;

    // A floor slab at each upper level's elevation.
    const slabYs = parts.filter((p) => p.colorHex === FLOOR_COLOR && (p.baseY ?? 0) > 0).map((p) => p.baseY);
    expect(slabYs.sort()).toEqual([storeyH, 2 * storeyH]);

    // One stair flight per gap, each rising a storey from its floor.
    const stairs = parts.filter((p) => p.colorHex === STAIR_COLOR);
    expect(stairs).toHaveLength(storeys - 1);
    for (const s of stairs) expect(s.h).toBeCloseTo(storeyH, 5);
    expect(stairs.map((s) => s.baseY ?? 0).sort()).toEqual([0, storeyH]);

    // Upper floors contribute interior walls + furniture above the ground.
    const elevatedWalls = parts.filter((p) => p.colorHex === INTERIOR_WALL_COLOR && (p.baseY ?? 0) > 0);
    expect(elevatedWalls.length).toBeGreaterThan(0);
  });

  it('keeps every elevated part within the interior envelope (x/z bounds)', () => {
    const plan = generateInterior(tall(3), SEED_PATH);
    const halfW = (plan.widthFt / 2) * FT + WALL_THICKNESS_M;
    const halfD = (plan.depthFt / 2) * FT + WALL_THICKNESS_M;
    for (const p of buildInteriorParts(tall(3), SEED_PATH, 9)) {
      if ((p.baseY ?? 0) === 0) continue;
      expect(Math.abs(p.x) - p.w / 2).toBeLessThanOrEqual(halfW + 0.01);
      expect(Math.abs(p.z) - p.d / 2).toBeLessThanOrEqual(halfD + 0.01);
    }
  });

  it('is deterministic for a multi-storey building', () => {
    expect(buildInteriorParts(tall(4), SEED_PATH, 12)).toEqual(buildInteriorParts(tall(4), SEED_PATH, 12));
  });

  it('houses resident occupants on the upper floors, not just the ground', () => {
    // Enough residents that the room cycle spills upstairs.
    const residents = Array.from({ length: 14 }, (_, i) => fig(i + 1, 'adult', false));
    const shellH = 9;
    const parts = buildInteriorParts(tall(3), SEED_PATH, shellH);
    const clothing = body().clothingHex;
    const bodies = parts.filter((p) => p.colorHex === clothing);
    expect(bodies).toHaveLength(0); // sanity: no occupants passed yet → no bodies

    const peopled = buildInteriorParts(tall(3), SEED_PATH, shellH, residents);
    const occupantBodies = peopled.filter((p) => p.colorHex === clothing);
    expect(occupantBodies).toHaveLength(residents.length);
    // At least one resident stands on an upper storey (baseY at a floor elevation).
    const storeyH = shellH / 3;
    const upstairs = occupantBodies.filter((p) => (p.baseY ?? 0) > 0);
    expect(upstairs.length).toBeGreaterThan(0);
    for (const p of upstairs) {
      const level = Math.round((p.baseY ?? 0) / storeyH);
      expect(p.baseY).toBeCloseTo(level * storeyH, 5); // lands exactly on a storey
      expect(level).toBeGreaterThanOrEqual(1);
    }
  });
});
