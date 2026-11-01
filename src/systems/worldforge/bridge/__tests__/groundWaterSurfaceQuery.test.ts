import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { publishedGroundWaterSurfaceYAt } from '../groundWaterSurfaceQuery';
import { sampleGroundChunk, type GroundWorld } from '../groundChunkLoader';
import { buildWaterMesh } from '../../../world3d/waterGeometry';
import { WORLD3D_CONFIG } from '../../../world3d/config';

function ground(overrides: Partial<GroundWorld> = {}): GroundWorld {
  return { cols: 4, rows: 4, heights: Array(16).fill(0), biomeIds: Array(16).fill('plains'), extentMetersX: 4, extentMetersZ: 4,
    features: [], props: [], hostiles: [], hiddenSites: [], dungeonEntrances: [], rivers: [], roads: [], walls: [], waterBodies: [],
    decks: [], gatehouses: [], towns: [], buildings: [], rosters: [], occupants: [], ...overrides };
}

function renderedOracle(source: GroundWorld) {
  const meshes: THREE.Mesh[] = [], size = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;
  for (let cx = -1; cx <= 2; cx++) for (let cy = -1; cy <= 2; cy++) {
    const water = buildWaterMesh(sampleGroundChunk(source, cx, cy, 17));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(water.positions, 3));
    geometry.setIndex(new THREE.BufferAttribute(water.indices, 1));
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    mesh.position.set(cx * size, 0, cy * size); mesh.updateMatrixWorld(true); meshes.push(mesh);
  }
  return {
    height(x: number, z: number) { return new THREE.Raycaster(new THREE.Vector3(x, 100, z), new THREE.Vector3(0, -1, 0)).intersectObjects(meshes)[0]?.point.y; },
    dispose() { for (const mesh of meshes) { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); } },
  };
}

describe('published ground water surface admission', () => {
  it('includes visible bank overdraw but does not widen a town ribbon to its regional referee width', () => {
    const source = ground({ rivers: [{ sourceKind: 'river', sourceId: 42, points: [{ x: 10, z: 64 }, { x: 110, z: 64 }],
      widthM: 68, surfaceWidthM: [4, 4], waterlineY: [6, 4] }] });
    expect(publishedGroundWaterSurfaceYAt(source, 60, 67)).toBeCloseTo(5, 5);
    expect(publishedGroundWaterSurfaceYAt(source, 60, 68)).toBeUndefined();
    expect(publishedGroundWaterSurfaceYAt(source, 60, 64)).toBeCloseTo(5, 5);
  });

  it('matches independently raycast rendered triangles through bends, taper and chunk seams', () => {
    const source = ground({ rivers: [{ sourceKind: 'river', points: [{ x: 20, z: 40 }, { x: 70, z: 45 }, { x: 125, z: 90 }, { x: 160, z: 110 }],
      widthM: 40, surfaceWidthM: [4, 20, 8, 3], waterlineY: [8, 7, 5, 4] }] });
    const before = JSON.stringify(source), oracle = renderedOracle(source);
    let wet = 0, dry = 0;
    try {
      for (let x = 16.3; x < 167; x += 7.7) for (let z = 25.1; z < 125; z += 6.3) {
        const expected = oracle.height(x, z), actual = publishedGroundWaterSurfaceYAt(source, x, z);
        if (expected == null) { expect(actual).toBeUndefined(); dry++; }
        else { expect(actual).toBeCloseTo(expected, 5); wet++; }
      }
      expect(wet).toBeGreaterThan(20); expect(dry).toBeGreaterThan(20);
      expect(JSON.stringify(source)).toBe(before);
    } finally { oracle.dispose(); }
  });

  it('reads a neighboring chunk ribbon overhang even when the point chunk contains no centerline', () => {
    const source = ground({ rivers: [{ sourceKind: 'river', points: [{ x: 100, z: 126 }, { x: 120, z: 126 }],
      widthM: 4, surfaceWidthM: [4, 4], waterlineY: [5, 5] }] });
    expect(sampleGroundChunk(source, 0, 1, 17).rivers).toHaveLength(0);
    expect(publishedGroundWaterSurfaceYAt(source, 110, 129)).toBeCloseTo(5, 6);
    expect(publishedGroundWaterSurfaceYAt(source, 110, 130)).toBeUndefined();
  });

  it('uses drawn water bodies, keeps the highest overlapping layer and excludes a suppressed duplicate', () => {
    const square = [{ x: 20, z: 20 }, { x: 50, z: 20 }, { x: 50, z: 50 }, { x: 20, z: 50 }];
    const source = ground({ waterBodies: [
      { kind: 'lake', pointsM: square, surfaceY: 3 },
      { kind: 'lake', pointsM: square, surfaceY: 7 },
      { kind: 'river', pointsM: square, surfaceY: 100, drawnByRiverRibbon: true },
    ] });
    expect(publishedGroundWaterSurfaceYAt(source, 35, 35)).toBeCloseTo(7, 6);
    expect(publishedGroundWaterSurfaceYAt(source, 60, 35)).toBeUndefined();
  });

  it('keeps legacy unqualified ribbons unknown and rejects invalid query coordinates', () => {
    const source = ground({ rivers: [{ sourceKind: 'river', points: [{ x: 10, z: 20 }, { x: 80, z: 20 }], widthM: 8 }] });
    expect(publishedGroundWaterSurfaceYAt(source, 40, 20)).toBeUndefined();
    expect(publishedGroundWaterSurfaceYAt(source, NaN, 20)).toBeUndefined();
    expect(publishedGroundWaterSurfaceYAt(source, 40, Infinity)).toBeUndefined();
  });
});
