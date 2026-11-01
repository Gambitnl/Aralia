import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createMountedDeckWalkingSurfaces, isGroundFootingSupported, groundWalkHeight, resolveBuildingMotion, resolveGroundWalk } from '../groundBuildingMotion';
import { resolveGroundWaterWalk } from '../groundWaterMovement';
import { buildDeckMesh } from '@/systems/world3d/deckGeometry';
import type { ChunkData, LoadedChunk } from '@/systems/world3d/types';
import { WORLD3D_CONFIG } from '@/systems/world3d/config';
import { groundSurfaceYM } from '../terrain/groundSurfaceYM';
import { metersToHeight } from '@/systems/world3d/config';
import { GROUND_METERS_PER_CELL } from '@/systems/worldforge/bridge/groundWorldAdapter';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { SitePart } from '@/systems/worldforge/bridge/interiorParts';
import { siteDoorKey } from '@/systems/worldforge/bridge/sitePartTransform';

const wall = { x: 0, z: 0, w: 0.12, d: 8, h: 3, colorHex: '#cfc7b8' };
describe('mounted deck walking', () => {
  function terrainChunk(y = 0, lod: LoadedChunk['lod'] = 'full') {
    return { cx: 0, cy: 0, lod, bundle: { terrain: {
      positions: new Float32Array([0, y, 0, 4, y, 0, 0, y, 4, 4, y, 4]),
      indices: new Uint32Array([0, 2, 1, 1, 2, 3]), normals: new Float32Array(12), colors: new Float32Array(12),
    } } } as LoadedChunk;
  }
  it('measures nonplanar render mismatch without moving an accepted body onto coarse geometry', () => {
    const chunk = terrainChunk();
    chunk.bundle.terrain.positions[10] = 4;
    const surfaces = createMountedDeckWalkingSurfaces();
    surfaces.updateLoaded([chunk]);
    const ground = { cols: 1, rows: 1, heights: [metersToHeight(4)], buildings: [] } as unknown as GroundWorld;
    expect(groundSurfaceYM(ground, 3, 3)).toBeCloseTo(4);
    expect(surfaces.renderedTerrainHeightAt?.(3, 3)).toBeCloseTo(2);
    expect(groundWalkHeight(ground, { xM: 3, zM: 3, yM: 4 }, undefined, surfaces)).toBeCloseTo(4);
    const result = resolveGroundWalk(ground, { xM: 3, zM: 3, yM: 4 }, { xM: 3.1, zM: 3.1 }, undefined, surfaces);
    expect(result.blocked).toBe(false);
    expect(result.yM).toBe(4);
    expect(surfaces.surfaceHeightsAt(3, 3)).toEqual([]);
  });
  it('retains real full-detail terrain through camera downgrades and resets for another world', () => {
    const surfaces = createMountedDeckWalkingSurfaces();
    surfaces.updateLoaded([terrainChunk(2)]);
    surfaces.updateLoaded([terrainChunk(0, 'low')]);
    expect(surfaces.renderedTerrainHeightAt?.(2, 2)).toBe(2);
    surfaces.updateLoaded([]);
    expect(surfaces.renderedTerrainHeightAt?.(2, 2)).toBe(2);
    surfaces.updateLoaded([terrainChunk(3)]);
    expect(surfaces.renderedTerrainHeightAt?.(2, 2)).toBe(3);
    expect(createMountedDeckWalkingSurfaces().renderedTerrainHeightAt?.(2, 2)).toBeUndefined();
  });
  function deck(topY = .12, railing = false, cx = 0) {
    const origin = cx * WORLD3D_CONFIG.CHUNK_WORLD_SIZE;
    const points = [[10, 10], [30, 10], [30, 20], [10, 20]].map(([x, z]) => ({ x: (x + origin) / WORLD3D_CONFIG.METERS_PER_CELL, y: z / WORLD3D_CONFIG.METERS_PER_CELL }));
    const data = { cx, cy: 0, resolution: 4, heights: new Float32Array(16), biomeIds: Array(16).fill('plains'), rivers: [], roads: [], sites: [],
      decks: [{ points, topY, kind: 'bridge', detail: { pilingSpacingM: 0, railing, archRiseM: .8 } }] } as ChunkData;
    const chunk = { cx, cy: 0, lod: 'full', bundle: { decks: buildDeckMesh(data) } } as LoadedChunk;
    const surfaces = createMountedDeckWalkingSurfaces();
    surfaces.updateLoaded([chunk]);
    const ground = { cols: 1, rows: 1, heights: [0], buildings: [] } as unknown as GroundWorld;
    return { surfaces, ground, chunk, origin };
  }
  it('walks the rendered arch and preserves its saved supported height', () => {
    const { surfaces, ground } = deck();
    const yM = surfaces.surfaceHeightsAt(14, 15).at(-1)!;
    expect(yM).toBeGreaterThan(.5);
    expect(groundWalkHeight(ground, { xM: 14, zM: 15, yM }, undefined, surfaces)).toBe(yM);
    const result = resolveGroundWalk(ground, { xM: 14, zM: 15, yM }, { xM: 20, zM: 15 }, undefined, surfaces);
    expect(result.blocked).toBe(false);
    expect(result.xM).toBeCloseTo(20);
    expect(result.yM).toBeCloseTo(surfaces.surfaceHeightsAt(20, 15).at(-1)!);
  });
  it('blocks the actual rail rather than walking sideways off the bridge', () => {
    const { surfaces, ground } = deck(.12, true);
    const yM = surfaces.surfaceHeightsAt(20, 15).at(-1)!;
    const result = resolveGroundWalk(ground, { xM: 20, zM: 15, yM }, { xM: 20, zM: 22 }, undefined, surfaces);
    expect(result.blocked).toBe(true);
    expect(result.zM).toBeGreaterThan(18);
    expect(result.zM).toBeLessThan(20);
  });
  it('keeps a valid below-bridge save below it and rejects a low slab overhead', () => {
    const high = deck(3);
    expect(groundWalkHeight(high.ground, { xM: 20, zM: 15, yM: 0 }, undefined, high.surfaces)).toBe(0);
    expect(resolveGroundWalk(high.ground, { xM: 20, zM: 15, yM: 0 }, { xM: 21, zM: 15 }, undefined, high.surfaces).blocked).toBe(false);
    const low = deck(.5);
    expect(resolveGroundWalk(low.ground, { xM: 20, zM: 15, yM: 0 }, { xM: 21, zM: 15 }, undefined, low.surfaces).blocked).toBe(true);
  });
  it('uses world chunk origins and retains loaded support through camera unloading', () => {
    const { surfaces, ground, origin } = deck(.12, false, 2);
    const point = { xM: origin + 20, zM: 15, yM: surfaces.surfaceHeightsAt(origin + 20, 15).at(-1)! };
    expect(point.yM).toBeGreaterThan(.9);
    surfaces.updateLoaded([]);
    expect(groundWalkHeight(ground, point, undefined, surfaces)).toBe(point.yM);
    expect(createMountedDeckWalkingSurfaces().surfaceHeightsAt(point.xM, point.zM)).toEqual([]);
  });
});
describe('continuous terrain walking', () => {
  it('explains the refused diagonal while retaining legal cardinal approaches and the same source slope', () => {
    // Native Brilia play exposed a supported bank whose diagonal is too steep,
    // while each cardinal approach remains walkable. No fixture enters a save.
    const cell = GROUND_METERS_PER_CELL;
    const ground = { cols: 2, rows: 2, heights: [0, metersToHeight(.58 * cell),
      metersToHeight(.71 * cell), metersToHeight(1.29 * cell)], biomeIds: Array(4).fill('plains'),
      extentMetersX: cell, extentMetersZ: cell, features: [], props: [], hostiles: [], hiddenSites: [],
      dungeonEntrances: [], roads: [], walls: [], decks: [], gatehouses: [], towns: [], rosters: [], occupants: [],
      buildings: [], rivers: [], waterBodies: [] } as unknown as GroundWorld;
    const from = Object.freeze({ xM: .5, zM: .5, yM: groundSurfaceYM(ground, .5, .5) });
    const before = JSON.stringify(ground);
    for (const direction of [-1, 1]) {
      const target = { xM: from.xM + direction * .1, zM: from.zM + direction * .1 };
      const result = resolveGroundWalk(ground, from, target);
      expect(result).toMatchObject({ ...from, blocked: true, blockedReason: 'steep-grade' });
      // The single movement-budget wrapper must retain the same explanation.
      expect(resolveGroundWaterWalk(ground, from, target, 1, { mouthHeightM: 1.2 }))
        .toMatchObject({ ...from, blocked: true, blockedReason: 'steep-grade', spentMovementM: 0, water: { mode: 'dry' } });
    }
    for (const target of [{ xM: .6, zM: .5 }, { xM: .5, zM: .6 }]) {
      const result = resolveGroundWalk(ground, from, target);
      expect(result.blocked).toBe(false);
      expect(result).not.toHaveProperty('blockedReason');
      expect(result.xM).toBeCloseTo(target.xM);
      expect(result.zM).toBeCloseTo(target.zM);
    }
    expect(JSON.stringify(ground)).toBe(before);
  });
  function ramp(grade: number) {
    return { cols: 2, rows: 2, heights: [0, metersToHeight(grade * GROUND_METERS_PER_CELL), 0,
      metersToHeight(grade * GROUND_METERS_PER_CELL)], buildings: [] } as unknown as GroundWorld;
  }
  it('crosses the old nearest-cell boundary on a gentle ramp without an invented step', () => {
    const ground = ramp(0.4), x = GROUND_METERS_PER_CELL / 2;
    expect(groundSurfaceYM(ground, x, .2)).toBeCloseTo(x * .4);
    expect(groundSurfaceYM(ground, -1, .2)).toBe(0);
    expect(groundSurfaceYM(ground, 100, .2)).toBeCloseTo(GROUND_METERS_PER_CELL * .4);
    const result = resolveGroundWalk(ground, { xM: x - .1, zM: .2, yM: (x - .1) * .4 }, { xM: x + .1, zM: .2 });
    expect(result.blocked).toBe(false);
    expect(result.xM).toBeCloseTo(x + .1);
    expect(result.yM).toBeCloseTo((x + .1) * .4);
  });
  it('rejects a steep natural bank in both directions despite small substeps', () => {
    const ground = ramp(4);
    for (const direction of [-1, 1]) {
      const from = { xM: .5, zM: .2, yM: 2 };
      const result = resolveGroundWalk(ground, from, { xM: .5 + direction * .1, zM: .2 });
      expect(result.blocked).toBe(true);
      expect(result.xM).toBe(from.xM);
      expect(result.yM).toBeCloseTo(from.yM);
    }
  });
  it('preserves finite saved footing above or below support and refuses to move it', () => {
    const ground = ramp(.4);
    for (const yM of [-5, 6.166488720703125]) {
      const saved = Object.freeze({ xM: .5, zM: .2, yM });
      expect(groundWalkHeight(ground, saved)).toBe(yM);
      expect(resolveGroundWalk(ground, saved, saved)).toMatchObject({ ...saved, blocked: true });
      expect(resolveGroundWalk(ground, saved, { xM: .6, zM: .2 })).toMatchObject({ ...saved, blocked: true });
    }
    // A genuinely new arrival still has no accepted height to preserve.
    expect(groundWalkHeight(ground, { xM: .5, zM: .2 })).toBeCloseTo(.2);
  });
  it('does not settle a nearby saved height until a supported walking step is requested', () => {
    const ground = ramp(0), saved = { xM: .5, zM: .2, yM: .1 };
    expect(groundWalkHeight(ground, saved)).toBe(.1);
    expect(resolveGroundWalk(ground, saved, saved)).toMatchObject({ ...saved, blocked: false });
    expect(resolveGroundWalk(ground, saved, { xM: .6, zM: .2 })).toMatchObject({ xM: .6, zM: .2, yM: 0, blocked: false });
  });
});
function fixture(parts: SitePart[], yaw = 0, sign = -1) {
  const project = (x: number, z: number) => {
    const v = new THREE.Vector3(x, 0, z * -sign).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    return { xM: v.x + 100, zM: v.z + 100 };
  };
  const cornersM = [[-5, -5], [5, -5], [5, 5], [-5, 5]].map(([x, z]) => {
    const p = project(x, z); return { x: p.xM, z: p.zM };
  });
  const ground = { cols: 1, rows: 1, heights: [0], buildings: [{ id: 'home', xM: 100, zM: 100, cornersM, parts }] } as unknown as GroundWorld;
  return { ground, project };
}

describe('canonical building movement', () => {
  it('does not mistake a full wall for overhead clearance or change its refusal',()=>{
    const {ground,project}=fixture([{...wall,w:4,d:.2,h:3,baseY:0}]);
    const from={...project(0,-1),yM:0},result=resolveGroundWalk(ground,from,project(0,1),undefined,undefined,2.3);
    expect(result.blocked).toBe(true);expect(result).not.toHaveProperty('blockedReason');
  });
  it('uses standing anatomy for headroom while preserving the doorway and saved feet', () => {
    const {ground,project}=fixture([{...wall,w:4,d:.2,h:1,baseY:1.8}]);
    const from=Object.freeze({...project(0,-1),yM:0}),target=project(0,1);
    expect(resolveGroundWalk(ground,from,target).blocked).toBe(true);
    const reached=resolveGroundWalk(ground,from,target,undefined,undefined,1.7);
    expect(reached.blocked).toBe(false);
    expect(reached.xM).toBeCloseTo(target.xM);expect(reached.zM).toBeCloseTo(target.zM);
    expect(reached.yM).toBe(0);
    expect(resolveGroundWalk(ground,from,target,undefined,undefined,2.3)).toMatchObject({blocked:true,blockedReason:'low-clearance'});
    expect(resolveGroundWalk(ground,from,target,undefined,undefined,NaN).blocked).toBe(true);
    expect(from).toEqual({...project(0,-1),yM:0});
  });
  it('keeps tall figures under the same mounted deck ceiling rule', () => {
    const {ground,project}=fixture([]);
    const from={...project(0,-1),yM:0},target=project(0,1);
    const surfaces={surfaceHeightsAt:()=>[],intersectsBody:(_p:unknown,_w:number,height:number)=>height>.22+2};
    expect(resolveGroundWalk(ground,from,target,undefined,surfaces,2.5).blocked).toBe(true);
    expect(resolveGroundWalk(ground,from,target,undefined,surfaces,1.7).blocked).toBe(false);
  });
  for (const yaw of [0, 0.73, -2.1]) for (const sign of [-1, 1]) {
    it(`sweeps a thin real wall at yaw ${yaw}, sign ${sign} without tunneling`, () => {
      const { ground, project } = fixture([wall], yaw, sign);
      const result = resolveBuildingMotion(ground, project(-3, 0), project(3, 0), 0);
      const expected = project(-0.361, 0);
      expect(result.blocked).toBe(true);
      expect(result.xM).toBeCloseTo(expected.xM, 5);
      expect(result.zM).toBeCloseTo(expected.zM, 5);
    });
  }

  it('slides along a wall and stops at an inside corner', () => {
    const { ground, project } = fixture([wall, { ...wall, x: -2, z: 2, w: 4, d: 0.12 }]);
    const result = resolveBuildingMotion(ground, project(-2, 0), project(2, 4), 0);
    expect(result.blocked).toBe(true);
    expect(result.xM).toBeLessThan(99.641);
    expect(result.zM).toBeLessThan(101.641);
    expect(result.zM).toBeGreaterThan(101.63);
  });

  it('preserves a real one-meter doorway and rejects the adjacent wall', () => {
    const { ground, project } = fixture([
      { ...wall, x: -1.25, z: 0, w: 1.5, d: 0.12 },
      { ...wall, x: 1.25, z: 0, w: 1.5, d: 0.12 },
      { ...wall, x: 0, z: 0, w: 1, d: 0.1, h: 2.1, colorHex: '#4a3220' },
      { ...wall, x: 0, z: 0, w: 1, d: 0.2, h: 0.6, baseY: 2.1 },
    ]);
    expect(resolveBuildingMotion(ground, project(0, -2), project(0, 2), 0)).toEqual({ ...project(0, 2), blocked: false });
    expect(resolveBuildingMotion(ground, project(1, -2), project(1, 2), 0).blocked).toBe(true);
  });

  it('blocks low furniture and keeps basement, floors, overhead slabs and dressing out of the walking band', () => {
    const { ground, project } = fixture([
      { ...wall, x: 0, d: 1, h: 0.4 },
      ...['motif', 'building-material', 'building-weathering', 'building-ensemble', 'building-history', 'roof', 'facade'].map(tag => ({ ...wall, x: -2, tag })),
      { ...wall, x: -2, baseY: -3, h: 3 },
      { ...wall, x: -2, baseY: -0.1, h: 0.1 },
      { ...wall, x: -2, baseY: 0, h: 0.12192 },
      { ...wall, x: -2, baseY: 3, h: 0.2 },
    ]);
    const result = resolveBuildingMotion(ground, project(-3, 0), project(3, 0), 0);
    expect(result.xM).toBeCloseTo(99.639);
    expect(result.blocked).toBe(true);
  });

  it('permits a legacy overlapping save to leave by its nearest edge but not walk deeper', () => {
    const { ground, project } = fixture([{ ...wall, w: 2, d: 2 }]);
    const from = project(-0.9, 0);
    expect(resolveBuildingMotion(ground, from, project(-2, 0), 0).blocked).toBe(false);
    expect(resolveBuildingMotion(ground, from, project(2, 0), 0)).toEqual({ ...from, blocked: true });
  });

  it('also respects a tactical party wall that its neighbor alone renders', () => {
    const { ground, project } = fixture([{ ...wall, renderRole: 'tactical-only' }]);
    expect(resolveBuildingMotion(ground, project(-2, 0), project(2, 0), 0).blocked).toBe(true);
  });

  it('blocks a closed canonical leaf, preserves the open passage, and still collides with the swung leaf', () => {
    const door: SitePart = { x: 0, z: 0, w: .9144, d: .21, h: 2.1, colorHex: '#4a3220',
      door: { id: '0:0:x:0.0000:0.0000', level: 0, index: 0, axis: 'x', swingX: 0, swingZ: 1 } };
    const { ground, project } = fixture([door]);
    const open = new Set([siteDoorKey('home', door)]);
    expect(resolveBuildingMotion(ground, project(0, -2), project(0, 2), 0).blocked).toBe(true);
    expect(resolveBuildingMotion(ground, project(0, -2), project(0, 2), 0, open)).toEqual({ ...project(0, 2), blocked: false });
    expect(resolveBuildingMotion(ground, project(-.4572, -2), project(-.4572, 2), 0, open).blocked).toBe(true);
    // Closing the same door again must not reuse the open-state collider cache.
    expect(resolveBuildingMotion(ground, project(0, -2), project(0, 2), 0, new Set()).blocked).toBe(true);
  });
});

/** Candidate selection may become cheaper; its boundaries and source-order
 * ties must not change support, long sweeps or unknown-geometry refusal. */
describe('canonical query candidate boundaries',()=>{
 function packet(parts:SitePart[]):GroundWorld{return {cols:1,rows:1,heights:[0],buildings:[{id:'candidate-test',xM:100,zM:100,cornersM:[{x:96,z:96},{x:104,z:96},{x:104,z:104},{x:96,z:104}],parts}]} as unknown as GroundWorld;}
 for(const wideFirst of [true,false])it('keeps original support order across broad and local surfaces: '+wideFirst,()=>{
  const wide:SitePart={x:0,z:0,w:1000,d:1000,h:.12,baseY:0,colorHex:'#aaa',walkSurface:'floor'};
  const local:SitePart={x:0,z:0,w:1,d:1,h:.12,baseY:0,colorHex:'#aaa',walkSurface:'landing'};
  const g=packet(wideFirst?[wide,local]:[local,wide]);
  expect(resolveGroundWalk(g,{xM:100,yM:.12,zM:100},{xM:100.02,zM:100})).toMatchObject({blocked:false,yM:.12,onStairs:!wideFirst});
 });
 for(const sign of [-1,1])it('keeps tiny elevated support at positive and negative cell edges: '+sign,()=>{
  const g=packet([{x:sign,z:0,w:.02,d:.02,h:.12,baseY:.88,colorHex:'#aaa',walkSurface:'floor'}]);
  for(const x of [sign-.01-5e-8,sign,sign+.01+5e-8])expect(isGroundFootingSupported(g,{xM:100+x,yM:1,zM:100})).toBe(true);
  expect(isGroundFootingSupported(g,{xM:100+sign+.01+2e-7,yM:1,zM:100})).toBe(false);
 });
 it('keeps a thin-wall contact through a long multi-cell sweep',()=>{
  const g=packet([{x:0,z:0,w:.02,d:8,h:3,baseY:0,colorHex:'#aaa'}]);
  const out=resolveBuildingMotion(g,{xM:40,zM:100},{xM:160,zM:100},0);
  expect(out.blocked).toBe(true);expect(out.xM).toBeLessThan(100);
 });
 it('refuses unknown measured geometry even when its horizontal bounds cannot be indexed',()=>{
  const g=packet([{x:0,z:0,w:8,d:8,h:.12,baseY:0,colorHex:'#aaa',walkSurface:'floor'},{x:0,z:0,w:Infinity,d:1,h:1,baseY:1,colorHex:'#bbb'}]);
  const from={xM:100,yM:.12,zM:100};
  expect(resolveGroundWalk(g,from,{xM:100.02,zM:100},new Set(),undefined,1.9,.3,{minXM:-.1,maxXM:.1,minZM:-.1,maxZM:.1,yawRad:0})).toMatchObject({...from,blocked:true});
 });
});
