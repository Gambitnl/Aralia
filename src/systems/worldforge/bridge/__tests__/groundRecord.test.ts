/**
 * The world's one ground (GG-533): a shape cut into the height grid, the same
 * shape the river's brush cuts, saved edits replayed in order, live edits
 * heard by readers, and the river's bed reading the fine ground inside its
 * corridor and the drawn lattice at the cut line.
 */
import { describe, expect, it } from 'vitest';
import { heightToMeters, metersToHeight } from '@/systems/world3d/config';
import { applyDeltas } from '../../delta/applyDeltas';
import type { WorldDelta } from '../../delta/types';
import type { LocalArtifact } from '../../artifacts';
import { groundShapeDeltas, type GroundShape } from '../../terrain/groundShapeProfile';
import { RiverTerrainBrush } from '@/systems/world3d/river/riverTerrainBrush';
import {
  applyGroundShape,
  editGround,
  groundArtifactSeedPath,
  groundShapeDelta,
  groundShapesCutInto,
  nextGroundShapeSequence,
  onGroundEdit,
  replayGroundShapes,
  type GroundHeightGrid,
} from '../groundRecord';
import { GROUND_METERS_PER_CELL } from '../groundWorldAdapter';
import {
  buildWorldFineGround,
  buildWorldTerrainLattice,
  fineGroundPatch,
  applyFineGroundPatch,
  worldBedHeightLocal,
  type RiverWorldFrame,
} from '@/systems/world3d/river/riverWorldBed';

const STEP = GROUND_METERS_PER_CELL;

/** A flat grid, every vertex `m` meters high. */
function flatGrid(cols: number, rows: number, m: number): GroundHeightGrid {
  return { cols, rows, heights: new Array(cols * rows).fill(metersToHeight(m)) };
}
const metersAt = (g: GroundHeightGrid, c: number, r: number) => heightToMeters(g.heights[r * g.cols + c]);

describe('applyGroundShape', () => {
  it('cuts a hole its full depth at the center and leaves the ground past its radius', () => {
    const g = flatGrid(40, 40, 10);
    const shape: GroundShape = { shape: 'hole', x: 20 * STEP, z: 20 * STEP, radius: 6, depth: 2 };
    const box = applyGroundShape(g, shape);
    expect(box).toEqual({ x0: 20 * STEP - 6, z0: 20 * STEP - 6, x1: 20 * STEP + 6, z1: 20 * STEP + 6 });
    expect(metersAt(g, 20, 20)).toBeCloseTo(8, 6);
    expect(metersAt(g, 20 + 5, 20)).toBeCloseTo(10, 6); // 7.6 m out: past the radius
  });

  it('cuts the same change the river brush cuts for the same shape', () => {
    const g = flatGrid(30, 30, 4);
    for (let k = 0; k < g.heights.length; k += 1) g.heights[k] = metersToHeight(4 + (k % 7) * 0.3);
    const before = g.heights.map(heightToMeters);
    const shape: GroundShape = { shape: 'wall', x: 10 * STEP, z: 12 * STEP, x2: 20 * STEP, z2: 14 * STEP, radius: 5, depth: 1.5 };
    applyGroundShape(g, shape);
    const brush = new RiverTerrainBrush();
    brush.apply({ kind: 'shape', stroke: 1, ...shape }, [
      { id: 'ground', nx: 30, nz: 30, step: STEP, x0: 0, z0: 0, heights: before },
    ]);
    for (let k = 0; k < before.length; k += 1) {
      expect(heightToMeters(g.heights[k])).toBeCloseTo(before[k] + brush.offset('ground', k), 6);
    }
  });

  it('returns null and changes nothing when the shape misses the grid', () => {
    const g = flatGrid(10, 10, 3);
    const copy = g.heights.slice();
    expect(applyGroundShape(g, { shape: 'hole', x: 500, z: 500, radius: 4, depth: 1 })).toBeNull();
    expect(g.heights).toEqual(copy);
  });

  it('throws on a shape no tool may cut', () => {
    expect(() => applyGroundShape(flatGrid(5, 5, 0), { shape: 'hole', x: 1, z: 1, radius: 0, depth: 1 })).toThrow('Invalid terrain shape');
  });
});

describe('the saved ground edits', () => {
  const seedPath = 'wf/test/local';
  const hole = (x: number, depth: number): GroundShape => ({ shape: 'hole', x, z: 10 * STEP, radius: 4, depth });

  it('replay in their recorded order, for their own artifact only', () => {
    // A wall then a hole over it differs from the hole then the wall: order matters.
    const wall: GroundShape = { shape: 'wall', x: 10 * STEP, z: 6 * STEP, x2: 10 * STEP, z2: 14 * STEP, radius: 4, depth: 2 };
    const deltas: WorldDelta[] = [
      groundShapeDelta(seedPath, hole(10 * STEP, 1), 2),
      groundShapeDelta(seedPath, wall, 1),
      groundShapeDelta('wf/other', hole(10 * STEP, 5), 3),
    ];
    const g = flatGrid(20, 20, 6);
    expect(replayGroundShapes(g, deltas, seedPath)).toBe(2);
    const live = flatGrid(20, 20, 6);
    applyGroundShape(live, wall);
    applyGroundShape(live, hole(10 * STEP, 1));
    expect(g.heights).toEqual(live.heights);
  });

  it('leave the artifact replay alone', () => {
    const local: LocalArtifact = {
      layer: 'local', schemaVersion: 1, seedPath, bounds: { x: 0, y: 0, width: 500, height: 500 },
      terrain: { widthCells: 2, heightCells: 2, elevationFt: new Float32Array([0.1, 0.2, 0.3, 0.4]), materialIndex: new Uint8Array([0, 0, 1, 1]), materials: ['grass', 'dirt'] },
      features: [{ id: 1, kind: 'tree', x: 10, y: 20, data: {} }],
    };
    const r = applyDeltas(local, [groundShapeDelta(seedPath, hole(3, 1), 1)]);
    expect(r.warnings).toEqual([]);
    expect(r.artifact.features).toEqual(local.features);
  });
});

describe('editGround', () => {
  it('cuts the shape and tells each listener the box it changed', () => {
    const g = flatGrid(20, 20, 2);
    const heard: Array<{ x0: number; seq: number }> = [];
    const off = onGroundEdit((e) => heard.push({ x0: e.box.x0, seq: e.sequence }));
    const e = editGround(g, { shape: 'hole', x: 10 * STEP, z: 10 * STEP, radius: 3, depth: 1 });
    off();
    expect(e).not.toBeNull();
    expect(heard).toEqual([{ x0: 10 * STEP - 3, seq: e!.sequence }]);
    expect(metersAt(g, 10, 10)).toBeCloseTo(1, 6);
    // Unsubscribed: a later edit is not heard.
    editGround(g, { shape: 'hole', x: 5 * STEP, z: 5 * STEP, radius: 3, depth: 1 });
    expect(heard).toHaveLength(1);
  });
});

describe('the river bed on the one ground', () => {
  // A ground with a slot 1.5 m wide and 2 m deep along world z = 50 (too thin
  // for the 8 m lattice to hold), on flat ground 10 m high.
  const groundAt = (x: number, z: number) => (Math.abs(z - 50) < 1.6 ? 8 : 10);
  const frame: RiverWorldFrame = { x: 0, z: 0, yaw: 0, datum: 0 };
  const box = { x0: 0, z0: 0, x1: 100, z1: 100 };
  const bed = {
    frame,
    lattice: buildWorldTerrainLattice(frame, box, 8, groundAt),
    fine: buildWorldFineGround(frame, box, STEP, groundAt),
    corridor: { halfM: 12, blendM: 3, rimM: 1 },
    course: [[-10, 50], [110, 50]] as Array<[number, number]>,
  };

  it('is the fine ground at the course and the drawn lattice at the cut line', () => {
    // On the slot's center line the fine ground holds the full 2 m depth.
    const fine = bed.fine;
    const center = Math.round(50 / STEP) * STEP; // a fine vertex on the slot
    expect(worldBedHeightLocal(bed, 30 * STEP, center)).toBeCloseTo(8, 6);
    // At the cut line (12 m out) the bed is exactly the lattice the world draws.
    const atRim = 50 + 11.5;
    const { lattice } = bed;
    expect(worldBedHeightLocal(bed, 40, atRim)).toBeCloseTo(worldBedHeightLocal({ frame, lattice }, 40, atRim), 9);
    expect(fine.step).toBe(STEP);
  });

  it('takes a later patch of the ground record', () => {
    const fine = buildWorldFineGround(frame, box, STEP, groundAt);
    const b2 = { ...bed, fine };
    const before = worldBedHeightLocal(b2, 20, 50);
    const p = fineGroundPatch(fine, { x0: 40, z0: 45, x1: 50, z1: 55 }, (x, z) => groundAt(x, z) - 3);
    expect(p).not.toBeNull();
    applyFineGroundPatch(fine, p!);
    expect(worldBedHeightLocal(b2, 45, 50)).toBeCloseTo(worldBedHeightLocal(bed, 45, 50) - 3, 6);
    // Outside the patch the bed has not moved.
    expect(worldBedHeightLocal(b2, 20, 50)).toBeCloseTo(before, 9);
  });

  it('agrees with the shape the record cut (one math for the record and its readers)', () => {
    const g = flatGrid(70, 70, 10);
    const shape: GroundShape = { shape: 'trench', x: 20, z: 50, x2: 80, z2: 50, radius: 3, depth: 2 };
    const deltas = groundShapeDeltas(shape, { nx: 70, nz: 70, step: STEP, x0: 0, z0: 0, read: (i) => heightToMeters(g.heights[i]) });
    applyGroundShape(g, shape);
    expect(deltas.length).toBeGreaterThan(0);
    const record = (x: number, z: number) => heightToMeters(g.heights[Math.round(z / STEP) * 70 + Math.round(x / STEP)]);
    const fine = buildWorldFineGround(frame, { x0: 0, z0: 0, x1: 100, z1: 100 }, STEP, record);
    const b3 = { ...bed, fine, lattice: buildWorldTerrainLattice(frame, box, 8, record) };
    expect(worldBedHeightLocal(b3, 33 * STEP, Math.round(50 / STEP) * STEP)).toBeCloseTo(8, 5);
  });
});

describe('the crater shape (GG-533 step 3)', () => {
  it('cuts the arena sphere: its center depth under the ground, its rim where the sphere meets it', () => {
    const g = flatGrid(40, 40, 10);
    // Sphere radius 4 m, center 1.4 m under the ground: 5.4 m deep at the
    // middle, rim at sqrt(16 - 1.96) = 3.75 m.
    applyGroundShape(g, { shape: 'crater', x: 20 * STEP, z: 20 * STEP, radius: 4, depth: 1.4 });
    expect(metersAt(g, 20, 20)).toBeCloseTo(10 - 1.4 - 4, 5);
    // 1 cell out (1.524 m): the sphere's floor there.
    expect(metersAt(g, 21, 20)).toBeCloseTo(10 - 1.4 - Math.sqrt(16 - STEP * STEP), 5);
    // 3 cells out (4.57 m): past the rim, untouched.
    expect(metersAt(g, 23, 20)).toBeCloseTo(10, 6);
  });

  it('changes nothing when its sphere stays under the ground', () => {
    const g = flatGrid(20, 20, 5);
    expect(applyGroundShape(g, { shape: 'crater', x: 10 * STEP, z: 10 * STEP, radius: 2, depth: 2.5 })).toBeNull();
  });
});

describe('a saved edit keeps its place across sessions', () => {
  const seedPath = 'wf/test/local';
  const hole: GroundShape = { shape: 'hole', x: 10 * STEP, z: 10 * STEP, radius: 4, depth: 1 };

  it('takes the sequence after the artifact\'s last saved edit, with an id unique to both', () => {
    const saved = [groundShapeDelta(seedPath, hole, 1), groundShapeDelta(seedPath, hole, 4), groundShapeDelta('wf/other', hole, 9)];
    expect(nextGroundShapeSequence(saved, seedPath)).toBe(5);
    expect(nextGroundShapeSequence([], seedPath)).toBe(1);
    // A second session's first edit no longer reuses the first session's id.
    expect(groundShapeDelta(seedPath, hole, 5).id).not.toBe(saved[0].id);
    expect(groundShapeDelta(seedPath, hole, 1).id).not.toBe(groundShapeDelta('wf/other', hole, 1).id);
  });

  it('knows the artifact of a grid its edits replayed onto', () => {
    const g = flatGrid(10, 10, 3);
    expect(groundArtifactSeedPath(g)).toBeUndefined();
    replayGroundShapes(g, [], seedPath);
    expect(groundArtifactSeedPath(g)).toBe(seedPath);
  });

  it('answers for a copy of the grid (the world-gen worker sends a copy) from its own fields', () => {
    const g = flatGrid(20, 20, 6);
    replayGroundShapes(g, [groundShapeDelta(seedPath, hole, 1)], seedPath);
    // What the worker posts: plain data, with the record's facts as fields.
    const copy: GroundHeightGrid = structuredClone({ ...g, artifactSeedPath: seedPath, groundShapes: [...groundShapesCutInto(g)] });
    expect(groundArtifactSeedPath(copy)).toBe(seedPath);
    expect(groundShapesCutInto(copy)).toEqual([hole]);
    // A live edit on the copy lands after the saved edit, not instead of it.
    const live: GroundShape = { shape: 'hole', x: 5 * STEP, z: 5 * STEP, radius: 3, depth: 1 };
    editGround(copy, live);
    expect(groundShapesCutInto(copy)).toEqual([hole, live]);
  });
});
