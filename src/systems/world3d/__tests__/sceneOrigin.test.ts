import { worldToScene, sceneToWorld } from '../sceneOrigin';

const origin = { x: 30720, z: 20480 };

it('worldToScene subtracts the origin', () => {
  expect(worldToScene(30720, 20480, origin)).toEqual({ x: 0, z: 0 });
  expect(worldToScene(30848, 20608, origin)).toEqual({ x: 128, z: 128 });
});

it('sceneToWorld adds the origin (inverse of worldToScene)', () => {
  expect(sceneToWorld(0, 0, origin)).toEqual({ x: 30720, z: 20480 });
  expect(sceneToWorld(128, 256, origin)).toEqual({ x: 30848, z: 20736 });
});

it('round-trips any point', () => {
  const s = worldToScene(31234, 21567, origin);
  const w = sceneToWorld(s.x, s.z, origin);
  expect(w.x).toBeCloseTo(31234);
  expect(w.z).toBeCloseTo(21567);
});
