/**
 * GG-533 step 3: a spell that moved earth on a world-sourced patch becomes the
 * exact world ground shape, at the tile's own ground point, sized by the
 * referee's facts; a patch with no world ground gives nothing.
 */
import { describe, expect, it } from 'vitest';
import type { BattleMapData, CombatLogEntry } from '@/types/combat';
import { groundShapeDeltas } from '@/systems/worldforge/terrain/groundShapeProfile';
import { groundImpactOfAbility } from '../../groundImpact';
import { GROUND_METERS_PER_CELL_FIP as CELL } from '../inSceneMovement';
import { groundShapeOfImpact, groundShapesOfTerrainLog, patchTileGroundPoint } from '../spellGroundEdits';

/** A 9 x 7 patch whose center tile (4, 3) stands at ground (100, 200). */
function patch(withWorld = true): BattleMapData {
  return {
    dimensions: { width: 9, height: 7 }, tiles: new Map(), theme: 'forest', seed: 1,
    ...(withWorld ? { worldGround: { artifactSeedPath: 'wf/test/local', anchorWorldMeters: { x: 100, z: 200 } } } : {}),
  } as BattleMapData;
}

const terrainLog = (type: string, tiles: Array<{ x: number; y: number }>, volume?: { size?: number; depth?: number }): CombatLogEntry => ({
  id: 'log-1', timestamp: 0, type: 'action', message: 'x',
  data: { manipulation: { type, volume }, affectedPositions: tiles },
} as CombatLogEntry);

describe('patchTileGroundPoint', () => {
  it('uses the extraction mapping: the center tile is the anchor, one tile is 1.524 m', () => {
    expect(patchTileGroundPoint(patch(), { x: 4, y: 3 })).toEqual({ x: 100, z: 200 });
    const p = patchTileGroundPoint(patch(), { x: 6, y: 1 })!;
    expect(p.x).toBeCloseTo(100 + 2 * CELL, 9);
    expect(p.z).toBeCloseTo(200 - 2 * CELL, 9);
    expect(patchTileGroundPoint(patch(false), { x: 4, y: 3 })).toBeNull();
  });
});

describe('groundShapesOfTerrainLog', () => {
  it('turns Mold Earth\'s excavate into a 5 ft hole at the tile, full depth over the whole tile', () => {
    const [hole] = groundShapesOfTerrainLog(terrainLog('excavate', [{ x: 5, y: 3 }], { size: 5, depth: 5 }), patch());
    expect(hole.shape).toBe('hole');
    expect(hole.x).toBeCloseTo(100 + CELL, 9);
    expect(hole.z).toBeCloseTo(200, 9);
    expect(hole.depth).toBeCloseTo(5 * 0.3048, 9);
    // A grid point anywhere in the tile's square goes the full depth: try
    // the square's corner on a 1.524 m grid laid exactly there.
    const corner = { x: hole.x + CELL / 2, z: hole.z + CELL / 2 };
    const [[, delta]] = groundShapeDeltas(hole, { nx: 1, nz: 1, step: CELL, x0: corner.x, z0: corner.z, read: () => 10 });
    expect(delta).toBeCloseTo(-hole.depth, 9);
  });

  it('turns a fill into a level mound as high as the volume\'s size', () => {
    const [mound] = groundShapesOfTerrainLog(terrainLog('fill', [{ x: 4, y: 3 }], { size: 10 }), patch());
    expect(mound).toMatchObject({ shape: 'wall', x: 100, z: 200, x2: 100, z2: 200 });
    expect(mound.depth).toBeCloseTo(10 * 0.3048, 9);
  });

  it('gives nothing for other manipulations, other entries, or a patch with no world ground', () => {
    expect(groundShapesOfTerrainLog(terrainLog('difficult', [{ x: 4, y: 3 }]), patch())).toEqual([]);
    expect(groundShapesOfTerrainLog({ id: 'l', timestamp: 0, type: 'action', message: 'm' } as CombatLogEntry, patch())).toEqual([]);
    expect(groundShapesOfTerrainLog(terrainLog('excavate', [{ x: 4, y: 3 }]), patch(false))).toEqual([]);
    expect(groundShapesOfTerrainLog(terrainLog('excavate', [{ x: 4, y: 3 }], { depth: 0 }), patch())).toEqual([]);
  });
});

describe('groundShapeOfImpact', () => {
  it('digs the arena\'s crater in meters: a Fireball (20 ft sphere, fire) at a tile', () => {
    // The real ability shape: a 4-tile (20 ft) circle, fire damage in its effects.
    const impact = groundImpactOfAbility({ areaOfEffect: { shape: 'circle', size: 4 }, effects: [{ type: 'damage', damageType: 'fire' }] })!;
    const crater = groundShapeOfImpact(impact, { x: 3, y: 3 }, patch())!;
    expect(crater.shape).toBe('crater');
    expect(crater.x).toBeCloseTo(100 - CELL, 9);
    // 4 tiles of blast x 0.45 = 1.8 tiles of crater = 2.74 m; center 0.35 of that down.
    expect(crater.radius).toBeCloseTo(1.8 * CELL, 9);
    expect(crater.depth).toBeCloseTo(1.8 * 0.35 * CELL, 9);
    expect(groundShapeOfImpact(impact, { x: 3, y: 3 }, patch(false))).toBeNull();
  });
});
