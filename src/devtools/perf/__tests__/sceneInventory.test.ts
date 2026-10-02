/**
 * Triangles by group, and what the camera sees.
 *
 * The inventory reads plain three fields with no three import, so these tests
 * build the fields by hand: identity matrices, a camera looking down -Z.
 */
import { describe, expect, it } from 'vitest';
import { distanceToBox, frustumPlanes, groupOf, sphereInFrustum, takeInventory, trianglesOf, worldSphere } from '../sceneInventory';

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const at = (x: number, y: number, z: number) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];

/** A perspective projection (column-major), 90 degrees, near 0.1, far 1000. */
function perspective(): number[] {
  const f = 1 / Math.tan(Math.PI / 4);
  const near = 0.1;
  const far = 1000;
  return [f, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, (2 * far * near) / (near - far), 0];
}

const camera = { type: 'PerspectiveCamera', projectionMatrix: { elements: perspective() }, matrixWorldInverse: { elements: I }, matrixWorld: { elements: I } };

function mesh(name: string, z: number, tris: number, extra: Record<string, unknown> = {}) {
  return {
    name,
    type: 'Mesh',
    isMesh: true,
    visible: true,
    matrixWorld: { elements: at(0, 0, z) },
    geometry: { type: 'BufferGeometry', index: { count: tris * 3 }, boundingSphere: { center: { x: 0, y: 0, z: 0 }, radius: 1 } },
    material: { type: 'MeshStandardMaterial' },
    children: [],
    ...extra,
  };
}

describe('groupOf', () => {
  it('prefers a perfGroup tag, then the name, then a named parent, then "unnamed"', () => {
    const parent = { name: 'trees', userData: {}, parent: null as unknown };
    const tagged = { name: 'trunk', parent: { name: '', userData: { perfGroup: 'forest' } } };
    expect(groupOf(tagged as never)).toEqual({ name: 'forest', source: 'tag' });
    expect(groupOf({ name: 'boulder' } as never)).toEqual({ name: 'boulder', source: 'name' });
    expect(groupOf({ name: '', parent } as never)).toEqual({ name: 'trees', source: 'ancestor' });
    expect(groupOf({ name: '' } as never)).toEqual({ name: 'unnamed', source: 'unnamed' });
  });
});

describe('trianglesOf', () => {
  it('honors the index, the draw range and the instance count', () => {
    expect(trianglesOf({ isMesh: true, geometry: { index: { count: 300 } } } as never)).toBe(100);
    expect(trianglesOf({ isMesh: true, geometry: { index: { count: 300 }, drawRange: { start: 0, count: 30 } } } as never)).toBe(10);
    expect(trianglesOf({ isMesh: true, isInstancedMesh: true, count: 50, geometry: { attributes: { position: { count: 60 } } } } as never)).toBe(1000);
    expect(trianglesOf({ isPoints: true } as never)).toBe(0);
  });
});

describe('frustum', () => {
  it('keeps a sphere in front of the camera and drops one behind it', () => {
    const planes = frustumPlanes(perspective(), I);
    expect(sphereInFrustum(planes, worldSphere({ center: { x: 0, y: 0, z: 0 }, radius: 1 }, at(0, 0, -10)))).toBe(true);
    expect(sphereInFrustum(planes, worldSphere({ center: { x: 0, y: 0, z: 0 }, radius: 1 }, at(0, 0, 10)))).toBe(false);
  });

  it('measures the distance to a box, not to a sphere around it', () => {
    // A wide flat water sheet 3 m below the camera: its bounding SPHERE would
    // contain the camera and read 0 m.
    const d = distanceToBox({ x: 0, y: 3, z: 0 }, { min: { x: -500, y: 0, z: -500 }, max: { x: 500, y: 0, z: 500 } }, I);
    expect(d).toBeCloseTo(3, 5);
  });
});

describe('takeInventory', () => {
  it('splits triangles by group and says what the frustum removes', () => {
    const scene = {
      isScene: true,
      children: [mesh('stones', -10, 1000), mesh('stones', 10, 3000), mesh('', -20, 500), mesh('water', -5, 200)],
    };
    const inv = takeInventory([{ sceneKey: 1, scene: scene as never, camera: camera as never }]);
    const stones = inv.groups.find((g) => g.name === 'stones')!;
    expect(stones.triangles).toBe(4000);
    expect(stones.inViewTriangles).toBe(1000); // the one behind the camera is out
    expect(inv.groups.find((g) => g.name === 'unnamed')!.triangles).toBe(500);
    expect(inv.unnamed[0].kind).toBe('Mesh · Standard · Buffer');
    expect(inv.mountedTriangles).toBe(4700);
    expect(inv.inViewTriangles).toBe(1700);
  });

  it('finds the nearest water by name, and does not take a sky called "OceanSky" for water', () => {
    const water = mesh('river_water', -5, 200, {
      geometry: { index: { count: 600 }, boundingSphere: { center: { x: 0, y: 0, z: 0 }, radius: 1 }, boundingBox: { min: { x: -1, y: -1, z: -1 }, max: { x: 1, y: 1, z: 1 } } },
    });
    const sky = mesh('OceanSky.mesh', 0, 2000);
    const inv = takeInventory([{ sceneKey: 1, scene: { isScene: true, children: [water, sky] } as never, camera: camera as never }]);
    expect(inv.nearestWater?.group).toBe('river_water');
    expect(inv.nearestWater?.distanceM).toBeCloseTo(4, 5);

    const onlySky = takeInventory([{ sceneKey: 1, scene: { isScene: true, children: [mesh('OceanSky.mesh', 0, 2000)] } as never, camera: camera as never }]);
    expect(onlySky.waterNamed).toBe(false);
  });
});
