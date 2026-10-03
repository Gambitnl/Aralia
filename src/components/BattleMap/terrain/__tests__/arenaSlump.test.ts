/**
 * @file arenaSlump.test.ts — the slump, on the combat arena's own lattice.
 *
 * The arena is the first surface whose cells are not cubes: 0.469 m across and
 * 0.15 m tall, a ratio of 3.13. `granularSettle` had only ever run on cubic
 * volumes, and its whole criterion is a comparison between cell INDICES —
 * `h[i] - h[j] > tan(repose) * distance` — which is the repose angle only while
 * one cell is as tall as it is wide.
 *
 * So these tests are about the WORLD, not about the lattice: every angle is
 * converted back to degrees before it is asserted, and the first test pins the
 * fault by running the solver both ways on the same ground.
 *
 * The last one is the claim the wiring exists for: after the slump, the drawn
 * surface a token stands on is the SETTLED one. It walks the same two functions
 * the component walks — `meshCellRange` for the drawn tops, `foldDrawnTops` to
 * fold them per column, `makeArenaSurfaceSampler` to read a tile — because a
 * test that re-derives the height its own way proves nothing about the height
 * the board uses.
 */
import { describe, it, expect } from 'vitest';
import {
  buildArenaVolume,
  arenaDepthDatum,
  ARENA_CELL_H_M,
  type ArenaTiles,
  type ArenaVolume,
} from '../arenaVolume';
import {
  foldDrawnTops,
  makeArenaSurfaceSampler,
  type SlabEntry,
} from '../VolumeArenaGround';
import { applyBrush } from '@/systems/worldforge/terrain/voxelBrush';
import { meshCellRange } from '@/systems/worldforge/terrain/surfaceNets';
import { colorAtDepth } from '@/systems/worldforge/terrain/materials';
import { Material } from '@/systems/worldforge/terrain/voxelVolume';
import {
  beginSettle,
  settleStep,
  settleToRest,
  movedVolumeM3,
  isLooseMaterial,
} from '@/systems/worldforge/terrain/granularSettle';

/** A flat grass board, optionally tilted by `gradePerTile` units along +x. */
function tiles(size: number, gradePerTile = 0): ArenaTiles {
  const elevation = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) elevation[y * size + x] = x * gradePerTile;
  }
  return {
    width: size,
    height: size,
    seed: 7,
    biome: 'forest',
    elevation,
    terrain: new Uint8Array(size * size), // 0 = grass
    ford: new Uint8Array(size * size),
  };
}

/** Every non-air cell, by substance. The conservation census. */
function census(a: ArenaVolume): Map<number, number> {
  const out = new Map<number, number>();
  for (let z = 0; z < a.cells; z++) {
    for (let y = 0; y < a.cellsY; y++) {
      for (let x = 0; x < a.cells; x++) {
        const m = a.volume.get(x, y, z);
        if (m === Material.Air) continue;
        out.set(m, (out.get(m) ?? 0) + 1);
      }
    }
  }
  return out;
}

/** Topmost solid cell of a column, or -1. */
function top(a: ArenaVolume, x: number, z: number): number {
  for (let y = a.cellsY - 1; y >= 0; y--) if (a.volume.get(x, y, z) !== Material.Air) return y;
  return -1;
}

/**
 * The drawn ground the tokens stand on, built exactly as the component builds
 * it: mesh the whole lattice as one slab, fold the dual tops, sample in tiles.
 */
function drawnSurface(a: ArenaVolume): (tx: number, tz: number) => number {
  const mesh = meshCellRange(
    a.volume,
    a.cellM,
    a.originM,
    (d) => colorAtDepth(d, a.biomeStack),
    arenaDepthDatum(a),
    { min: [0, 0, 0], max: [a.cells, a.cellsY, a.cells] },
    a.cellHM,
  );
  const slabs = new Map<number, SlabEntry>([
    [0, { geometry: null as never, dualTopY: mesh.dualTopY, dualRect: mesh.dualRect }],
  ]);
  const { columnTopY } = foldDrawnTops(slabs, a.cells);
  return makeArenaSurfaceSampler(columnTopY, a.cells, a.cellM, () => -Infinity);
}

/** A Fireball's crater, straight out of `groundImpactOfAbility`'s table. */
const FIREBALL_RADIUS_M = 1.8;
const FIREBALL_DEPTH_M = 0.63;

function fireball(a: ArenaVolume, tileX: number, tileZ: number) {
  const x = Math.min(a.cells - 1, Math.floor(tileX / a.cellM));
  const z = Math.min(a.cells - 1, Math.floor(tileZ / a.cellM));
  const surfaceY = a.originalTopY[z * a.cells + x];
  return applyBrush(
    { volume: a.volume, cellM: a.cellM, cellHM: a.cellHM, originM: a.originM },
    [tileX, surfaceY - FIREBALL_DEPTH_M, tileZ],
    { shape: 'sphere', mode: 'dig', radiusM: FIREBALL_RADIUS_M },
    a.biomeStack,
  );
}

describe('granular settling on the combat arena', () => {
  it('reads the repose angle in the WORLD, not in cells — a cubic reading flattens honest ground', () => {
    /* A bank at about 22 degrees: below every loose substance's repose, so it
     * is at rest and NOTHING may move. Two runs over the same ground: one told
     * the arena's real cell height, one left to assume a cube. */
    const size = 48;
    const grade = 1.4; // units of elevation per tile
    const aspect = buildArenaVolume(tiles(size, grade), { cells: 128, cellHM: ARENA_CELL_H_M });
    const cubic = buildArenaVolume(tiles(size, grade), { cells: 128, cellHM: ARENA_CELL_H_M });

    const region = {
      min: [40, 0, 40] as [number, number, number],
      max: [88, aspect.cellsY - 1, 88] as [number, number, number],
    };

    const aspectRun = settleToRest(aspect.volume, region, aspect.cellM, {
      cellHM: aspect.cellHM,
    });
    const cubicRun = settleToRest(cubic.volume, region, cubic.cellM);

    /* The measured slope of this board, in degrees, so the assertion is about
     * terrain and not about a magic number. */
    const rise =
      (aspect.originalTopY[64 * aspect.cells + 80] - aspect.originalTopY[64 * aspect.cells + 40]) /
      ((80 - 40) * aspect.cellM);
    const deg = (Math.atan(rise) * 180) / Math.PI;
    expect(deg).toBeGreaterThan(10);
    expect(deg).toBeLessThan(30);

    // Aspect-aware: the bank is under repose, so there is nothing to shed.
    expect(aspectRun === null || aspectRun.moved === 0).toBe(true);
    // Cubic: the same ground reads as a cliff and is sanded flat.
    expect(cubicRun).not.toBeNull();
    expect(cubicRun!.moved).toBeGreaterThan(100);
  });

  it('brings a Fireball crater wall down to the substance angle, measured in degrees', () => {
    const a = buildArenaVolume(tiles(24), { cells: 64, cellHM: ARENA_CELL_H_M });
    const mid = 12;
    const carve = fireball(a, mid, mid);
    expect(carve.changed).toBeGreaterThan(0);

    const before = census(a);
    const r = settleToRest(
      a.volume,
      { min: carve.min, max: carve.max },
      a.cellM,
      { cellHM: a.cellHM },
    );
    expect(r).not.toBeNull();
    expect(r!.moved).toBeGreaterThan(0);

    // Matter is conserved, per substance, across the whole volume.
    const after = census(a);
    expect([...after.entries()].sort()).toEqual([...before.entries()].sort());

    /* The steepest remaining step of LOOSE ground anywhere in the crater, as an
     * angle in the world. Loose ground rests at 34-35 degrees in this registry,
     * and the activation slack is one whole cell — so the bound is repose plus
     * the angle one cell of slack adds over one cell of run.
     *
     * Rock is excluded on purpose and not as a convenience: a Fireball digs
     * 2.4 m, which is through the forest stack's soil and into its bedrock, and
     * a sheer granite wall at the bottom of the bowl is the answer rule 2 of
     * the solver promises. Measured blind, that wall reads 50 degrees and looks
     * like a failure of a rule it is obeying. */
    const cx = Math.round(mid / a.cellM);
    let worstDeg = 0;
    for (let z = cx - 12; z <= cx + 12; z++) {
      for (let x = cx - 12; x <= cx + 12; x++) {
        const h = top(a, x, z);
        if (h < 0 || !isLooseMaterial(a.volume.get(x, h, z))) continue;
        for (const [dx, dz] of [[1, 0], [0, 1]] as const) {
          const n = top(a, x + dx, z + dz);
          if (n >= h) continue; // only the step this column stands over
          const rise = (h - n) * a.cellHM;
          worstDeg = Math.max(worstDeg, (Math.atan(rise / a.cellM) * 180) / Math.PI);
        }
      }
    }
    expect(worstDeg).toBeGreaterThan(0);
    const slackDeg = (Math.atan((Math.tan((35 * Math.PI) / 180) * a.cellM + a.cellHM) / a.cellM) * 180) / Math.PI;
    expect(worstDeg).toBeLessThanOrEqual(slackDeg + 0.001);
  });

  it('re-plants a token: the drawn surface at the crater rim rises when the walls come in', () => {
    const a = buildArenaVolume(tiles(24), { cells: 64, cellHM: ARENA_CELL_H_M });
    const mid = 12;
    const carve = fireball(a, mid, mid);

    const cut = drawnSurface(a);
    const cutCentre = cut(mid, mid);
    const cutFloorSamples = [cut(mid, mid), cut(mid + 0.4, mid), cut(mid, mid + 0.4)];

    const r = settleToRest(a.volume, { min: carve.min, max: carve.max }, a.cellM, {
      cellHM: a.cellHM,
    });
    expect(r!.moved).toBeGreaterThan(0);

    const settled = drawnSurface(a);
    const settledFloorSamples = [
      settled(mid, mid),
      settled(mid + 0.4, mid),
      settled(mid, mid + 0.4),
    ];

    /* The bowl's floor comes UP: the walls slid into it. That is the height a
     * token standing at the impact tile now plants on, and it is the number the
     * host's `groundSampler` hands to every actor on the board. */
    const cutFloor = Math.min(...cutFloorSamples);
    const settledFloor = Math.min(...settledFloorSamples);
    expect(settledFloor).toBeGreaterThan(cutFloor);
    // And it is still a hole — the slump fills a crater, it does not erase one.
    expect(settledFloor).toBeLessThan(a.originalTopY[0]);
    expect(Number.isFinite(cutCentre)).toBe(true);
  });

  it('paces itself: a crater settles in a handful of slices, none of them a frame', () => {
    const a = buildArenaVolume(tiles(24), { cells: 64, cellHM: ARENA_CELL_H_M });
    const carve = fireball(a, 12, 12);
    const f = beginSettle(a.volume, { min: carve.min, max: carve.max }, a.cellM, {
      cellHM: a.cellHM,
    });
    expect(f).not.toBeNull();

    let slices = 0;
    let worst = 0;
    let r = settleStep(f!);
    while (!r.done && slices < 400) {
      worst = Math.max(worst, r.ms);
      r = settleStep(f!);
      slices++;
    }
    expect(r.done).toBe(true);
    expect(slices).toBeLessThan(120);
    // The solver's own millisecond budget, honored.
    expect(worst).toBeLessThan(40);

    /* The ledger uses the arena's real cell VOLUME. A cubic reading of a
     * 0.469 x 0.469 x 0.15 m cell over-reports by 3.13x, which would make the
     * one honest number on the HUD the wrong one. */
    const m3 = movedVolumeM3(f!);
    expect(m3).toBeCloseTo(f!.moved * a.cellM * a.cellM * a.cellHM, 6);
  });

  it('leaves the arena rock alone — a bore into stone finds no field and costs no frames', () => {
    const a = buildArenaVolume(tiles(24), { cells: 64, cellHM: ARENA_CELL_H_M });
    /* Deep enough that the sphere is entirely inside the bedrock band, so the
     * exposed cells around it are rock and nothing granular is left standing. */
    const x = Math.floor(12 / a.cellM);
    const surfaceY = a.originalTopY[x * a.cells + x];
    const deep = applyBrush(
      { volume: a.volume, cellM: a.cellM, cellHM: a.cellHM, originM: a.originM },
      [12, surfaceY - 6, 12],
      { shape: 'sphere', mode: 'dig', radiusM: 1.2 },
      a.biomeStack,
    );
    expect(deep.changed).toBeGreaterThan(0);
    const f = beginSettle(a.volume, { min: deep.min, max: deep.max }, a.cellM, {
      cellHM: a.cellHM,
    });
    expect(f).toBeNull();
  });
});
