import { describe, expect, it } from 'vitest';
import type { BattleMapData, BattleMapTile } from '../../../../types/combat';
import { makeTerrainHeightSampler } from '../terrainHeightSampler';
import {
  APRON_PROFILES,
  CAMERA_TO_FOG_FAR_RATIO,
  FRINGE_TILES,
  apronReachTiles,
  makeApronField,
  resolveHorizon,
  resolveApronProfile,
} from '../apronField';
import { buildApronGeometry } from '../TerrainApron';

/**
 * This file proves that the 3D battle map's playable ground, surrounding land,
 * fog, and camera share one continuous distance budget.
 *
 * The terrain fixtures protect physical seams and geometry cost. The horizon
 * fixtures protect tactical readability without mounting WebGL, so small and
 * large maps fail deterministically if camera and fog ranges drift apart.
 *
 * Exercises: apronField.ts and TerrainApron.tsx
 * Depends on: the production terrain height sampler for realistic edge relief
 */

const WIDTH = 40;
const HEIGHT = 30;

// ============================================================================
// Shared Terrain Fixture
// ============================================================================
// The relief fixture lets apron continuity tests exercise real height changes
// without making the distance-budget checks depend on renderer state.
// ============================================================================

/** A board with real relief: a ridge across it and a pond in one corner. */
function makeGrid(): { grid: (BattleMapTile | null)[][]; mapData: BattleMapData } {
  const tiles = new Map<string, BattleMapTile>();
  const grid: (BattleMapTile | null)[][] = [];
  for (let y = 0; y < HEIGHT; y++) {
    grid[y] = [];
    for (let x = 0; x < WIDTH; x++) {
      const water = x < 5 && y < 5;
      const tile = {
        id: `${x}-${y}`,
        coordinates: { x, y },
        terrain: water ? 'water' : 'grass',
        elevation: water ? 0 : Math.round(3 * Math.sin(x * 0.4) + 2 * Math.cos(y * 0.3)),
      } as unknown as BattleMapTile;
      tiles.set(tile.id, tile);
      grid[y][x] = tile;
    }
  }
  const mapData = {
    dimensions: { width: WIDTH, height: HEIGHT },
    tiles,
    theme: 'forest',
    seed: 4242,
  } as unknown as BattleMapData;
  return { grid, mapData };
}

describe('apronField', () => {
  const { grid, mapData } = makeGrid();
  const sampler = makeTerrainHeightSampler(grid, WIDTH, HEIGHT, 4242);
  const field = makeApronField(mapData, sampler);

  it('is the heightfield itself inside the playable rect', () => {
    // Nothing outside the rect may reach back in and move the board.
    for (const [x, z] of [[0, 0], [12.5, 7.25], [WIDTH, HEIGHT], [WIDTH / 2, 0]]) {
      expect(field.heightAt(x, z)).toBe(sampler(x, z));
      expect(field.outsetAt(x, z)).toBe(0);
    }
  });

  it('leaves no step at the rect boundary', () => {
    // Approaching the boundary from outside must converge on the inside value:
    // the relief ramp and the grain fade both start at exactly zero.
    for (let x = 0; x <= WIDTH; x += 2.5) {
      const inside = field.heightAt(x, 0);
      const outside = field.heightAt(x, -0.02);
      expect(Math.abs(outside - inside)).toBeLessThan(0.01);
    }
  });

  it('rises into landscape away from the board instead of sinking to a datum', () => {
    // The old fringe eased DOWN to a fixed -0.15 apron plane. The relief now
    // climbs, and the far samples must not all share one height.
    const far: number[] = [];
    for (let x = -300; x <= WIDTH + 300; x += 37) far.push(field.heightAt(x, -300));
    const min = Math.min(...far);
    const max = Math.max(...far);
    expect(max - min).toBeGreaterThan(1.5);
    expect(max).toBeGreaterThan(0.5);
  });

  it('carries the board past the fringe with a surface that is smooth at apron scale', () => {
    // The apron mesh samples about once per tile at its inner ring, so the
    // finest term in the field out there has to be far coarser than that or the
    // two meshes leave pinholes along the join.
    let worst = 0;
    for (let x = -60; x <= WIDTH + 60; x += 0.5) {
      const z = -FRINGE_TILES;
      const chord = (field.heightAt(x - 1, z) + field.heightAt(x + 1, z)) / 2;
      worst = Math.max(worst, Math.abs(chord - field.heightAt(x, z)));
    }
    // The un-low-passed extrusion measured 1.11 units here. Anything above a
    // few centimetres is a pinhole of sky along the join at grazing angles.
    expect(worst).toBeLessThan(0.03);
  });

  it('reaches far enough to be a horizon, and further on open biomes', () => {
    expect(apronReachTiles(mapData)).toBeGreaterThan(120);
    const desert = { ...mapData, theme: 'desert' } as BattleMapData;
    const cave = { ...mapData, theme: 'cave' } as BattleMapData;
    expect(apronReachTiles(desert)).toBeGreaterThan(apronReachTiles(cave));
  });

  it('names a profile for every biome it is asked about, forest for the rest', () => {
    for (const key of ['forest', 'desert', 'swamp', 'cave', 'dungeon']) {
      expect(resolveApronProfile(key)).toBe(APRON_PROFILES[key]);
    }
    expect(resolveApronProfile('nonsense')).toBe(APRON_PROFILES.forest);
  });
});

// ============================================================================
// Camera, Fog, and Horizon Distance Contract
// ============================================================================
// These pure checks protect both small sandbox chambers and expanded maps.
// A legal camera zoom must always stop before fog becomes fully opaque.
// ============================================================================

describe('horizon distance budget', () => {
  it('keeps a small dungeon atmospheric while clearing its complete zoom range', () => {
    const horizon = resolveHorizon({
      dimensions: { width: 16, height: 12 },
      biome: 'dungeon',
    });

    // The authored dungeon end was 6.8 units, behind both the initial camera
    // and the legal 20-unit overview. The near fog remains the authored 2.2,
    // while the far end now reserves a readable margin beyond max zoom.
    expect(horizon.fogNear).toBeCloseTo(2.2);
    expect(horizon.cameraMaxDistance).toBe(20);
    expect(horizon.fogFar).toBe(20 * CAMERA_TO_FOG_FAR_RATIO);
  });

  it('scales the same visibility margin for a large enclosed battlefield', () => {
    const horizon = resolveHorizon({
      dimensions: { width: 80, height: 60 },
      biome: 'dungeon',
    });

    // Large maps derive a larger orbit cap instead of relying on the small-map
    // floor. Fog must scale with that cap so size cannot recreate the defect.
    expect(horizon.cameraMaxDistance).toBe(45);
    expect(horizon.fogFar).toBe(45 * CAMERA_TO_FOG_FAR_RATIO);
    expect(horizon.fogFar).toBeGreaterThan(horizon.cameraMaxDistance);
  });

  it('preserves an open biome whose authored horizon already clears the camera', () => {
    const horizon = resolveHorizon({
      dimensions: { width: 16, height: 12 },
      biome: 'forest',
    });

    // Forest fog is part of the distant-landscape composition and already has
    // ample range, so the reliability floor must not flatten that tuning.
    expect(horizon.cameraMaxDistance).toBe(35);
    expect(horizon.fogFar).toBe(130);
  });
});

describe('apron geometry', () => {
  const { grid, mapData } = makeGrid();

  it('builds one closed frame whose inner ring sits on the fringe boundary', () => {
    const build = buildApronGeometry(mapData, grid);
    const pos = build.geometry.getAttribute('position');
    expect(build.triangles).toBeGreaterThan(0);
    expect(build.rings).toBeGreaterThan(8);

    // Ring 0 must trace the rect the heightfield plane ends on, or the two
    // meshes do not touch at all.
    const innerAX = WIDTH / 2 + FRINGE_TILES;
    const innerAZ = HEIGHT / 2 + FRINGE_TILES;
    let onBoundary = 0;
    const samples = build.vertices / build.rings;
    for (let j = 0; j < samples; j++) {
      const x = pos.getX(j) - WIDTH / 2;
      const z = pos.getZ(j) - HEIGHT / 2;
      const onX = Math.abs(Math.abs(x) - innerAX) < 1e-6 && Math.abs(z) <= innerAZ + 1e-6;
      const onZ = Math.abs(Math.abs(z) - innerAZ) < 1e-6 && Math.abs(x) <= innerAX + 1e-6;
      if (onX || onZ) onBoundary++;
    }
    expect(onBoundary).toBe(samples);
  });

  it('agrees with the heightfield along the whole seam', () => {
    const build = buildApronGeometry(mapData, grid);
    const sampler = makeTerrainHeightSampler(grid, WIDTH, HEIGHT, mapData.seed);
    const field = makeApronField(mapData, sampler);
    const pos = build.geometry.getAttribute('position');
    const samples = build.vertices / build.rings;
    for (let j = 0; j < samples; j += 7) {
      const y = field.heightAt(pos.getX(j), pos.getZ(j));
      expect(Math.abs(pos.getY(j) - y)).toBeLessThan(1e-6);
    }
  });

  it('stays cheap: one mesh, well under a hundred thousand triangles', () => {
    const build = buildApronGeometry(mapData, grid);
    expect(build.triangles).toBeLessThan(100_000);
    expect(build.geometry.groups.length).toBe(0); // one material, one draw call
  });

  it('has upward normals everywhere — nothing in the apron is a wall by accident', () => {
    const build = buildApronGeometry(mapData, grid);
    const nrm = build.geometry.getAttribute('normal');
    for (let i = 0; i < nrm.count; i += 13) {
      expect(nrm.getY(i)).toBeGreaterThan(0);
    }
  });

  it('emits triangles wound to face the sky', () => {
    // The normal ATTRIBUTE pointing up is not the same claim as the WINDING
    // being right, and the difference is not subtle on screen: with
    // side=DoubleSide a back-facing apron has its normal negated per fragment,
    // drops out of the sun, and renders as a black plain around a lit board.
    const build = buildApronGeometry(mapData, grid);
    const pos = build.geometry.getAttribute('position');
    const idx = build.geometry.getIndex()!;
    let checked = 0;
    for (let t = 0; t < idx.count; t += 3 * 37) {
      const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2);
      const e1 = [pos.getX(b) - pos.getX(a), pos.getY(b) - pos.getY(a), pos.getZ(b) - pos.getZ(a)];
      const e2 = [pos.getX(c) - pos.getX(a), pos.getY(c) - pos.getY(a), pos.getZ(c) - pos.getZ(a)];
      const ny = e1[2] * e2[0] - e1[0] * e2[2];
      expect(ny).toBeGreaterThan(0);
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
  });
});
