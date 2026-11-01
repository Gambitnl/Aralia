import {describe, expect, it} from 'vitest';
import type {GroundWorld} from '@/systems/worldforge/bridge/groundChunkLoader';
import {playerCameraFrame} from '../playerCameraFrame';
import * as THREE from 'three';
import {createPlayerCameraSightline} from '../playerCameraVisibility';

function fixture(parts: Array<Record<string, unknown>> = []): GroundWorld {
  return {cols: 1, rows: 1, heights: [0], buildings: [{id: 'home', xM: 100, zM: 100,
    cornersM: [{x: 95, z: 95}, {x: 105, z: 95}, {x: 105, z: 105}, {x: 95, z: 105}], parts}]} as unknown as GroundWorld;
}
const origin = {x: 80, z: 90};
const foot = Object.freeze({xM: 100, zM: 100, yM: 0});

describe('camera return to accepted footing', () => {
  it('uses a clear three-meter inn passage before collapsing the view to two meters', () => {
    // The played inn admits a three-meter arm while its walls reject four.
    // Model the same narrow, off-center passage with actual opaque geometry.
    const scene = new THREE.Scene(), building = new THREE.Group();
    building.name = 'world3d:site-building';
    for (const [x, z, w, d] of [[-.8, 0, .1, 8], [.8, 0, .1, 8], [0, 1.2, 2, .1], [0, -3.4, 2, .1]]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 3, d), new THREE.MeshBasicMaterial());
      wall.position.set(x + 20, 1.5, z + 10); building.add(wall);
    }
    scene.add(building);
    const query = createPlayerCameraSightline(() => scene);
    const ground = fixture(), before = JSON.stringify(ground);
    const frame = playerCameraFrame(ground, foot, origin, 9, query)!;
    expect(Math.hypot(frame.position![0] - 20, frame.position![2] - 10)).toBeCloseTo(3);
    expect(frame.position![2]).toBeCloseTo(7);
    expect(query(frame.target, frame.position!)).toBeNull();
    expect(JSON.stringify(ground)).toBe(before);
    expect(foot).toEqual({xM: 100, zM: 100, yM: 0});
  });

  it('checks the eye-line at an indoor height instead of rejecting it at walking width', () => {
    const queried: number[] = [];
    const wall = {h: 10, colorHex: '#cfc7b8'};
    const ground = fixture([{...wall, x: 0, z: 0, w: 20, d: 20}]);
    const frame = playerCameraFrame(ground, foot, origin, 2, (_target, eye) => {
      queried.push(eye[1]); return eye[1] > 2 ? 0.5 : null;
    });
    expect(queried).toContain(2.6);
    expect(frame?.position?.[1]).toBe(1.85);
    expect(frame?.target).toEqual([20, 1.15, 10]);
  });
  it('does not claim a usable return when every rendered eye-line is blocked', () => {
    expect(playerCameraFrame(fixture(), foot, origin, 3, () => 0.1)).toBeNull();
  });
  it('uses actual footing and floating origin without changing either source', () => {
    const ground = fixture(), before = JSON.stringify(ground);
    const frame = playerCameraFrame(ground, foot, origin, 7)!;
    expect(frame).toMatchObject({kind: 'player', nonce: 7, target: [20, 1.15, 10]});
    expect(JSON.stringify(ground)).toBe(before);
    expect(foot).toEqual({xM: 100, zM: 100, yM: 0});
    expect(playerCameraFrame(ground, {...foot, xM: 104}, origin, 8)?.target).toEqual([24, 1.15, 10]);
  });
  it('rejects the arm through a real wall and chooses the open street side', () => {
    const wall = {x: 1, z: 0, w: 0.12, d: 12, h: 10, colorHex: '#cfc7b8'};
    const frame = playerCameraFrame(fixture([wall]), foot, origin, 1)!;
    expect(frame.position![0]).toBeLessThan(20.7);
    expect(frame.position![2]).toBeGreaterThan(15);
    expect(frame.target).toEqual([20, 1.15, 10]);
  });
  it('fails closed when enclosed or missing footing instead of placing the camera across walls', () => {
    const wall = {h: 10, colorHex: '#cfc7b8'};
    const ground = fixture([
      {...wall, x: -0.7, z: 0, w: 0.12, d: 2}, {...wall, x: 0.7, z: 0, w: 0.12, d: 2},
      {...wall, x: 0, z: -0.7, w: 2, d: 0.12}, {...wall, x: 0, z: 0.7, w: 2, d: 0.12},
    ]);
    expect(playerCameraFrame(ground, foot, origin, 1)).toBeNull();
    expect(playerCameraFrame(ground, null, origin, 1)).toBeNull();
    expect(playerCameraFrame(null, foot, origin, 1)).toBeNull();
  });
});
