import {describe, expect, it, vi} from 'vitest';
import * as THREE from 'three';
import {nearestGroundCameraHit} from '../cameraGroundRaycast';

function slope(indexed = true): THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]> {
  let geometry: THREE.BufferGeometry = new THREE.PlaneGeometry(256, 256, 128, 128);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) position.setY(i, position.getZ(i) / 3);
  if (!indexed) geometry = geometry.toNonIndexed();
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
}
function ray(from = new THREE.Vector3(0, 1.15, 0), to = new THREE.Vector3(0, 1.55, 6)) {
  const delta = to.clone().sub(from), query = new THREE.Raycaster(from, delta.clone().normalize(), .01, delta.length());
  return query;
}
function oracle(mesh: THREE.Mesh, query: THREE.Raycaster) {
  const hits = query.intersectObject(mesh, false).filter(hit => {
    const material = Array.isArray(mesh.material) ? mesh.material[hit.face?.materialIndex ?? 0] : mesh.material;
    return material?.visible && material.opacity > 0 && !(material.transparent && material.opacity < .95);
  });
  return hits[0]?.distance ?? null;
}

describe('exact camera ground candidates', () => {
  it.each([true, false])('matches native rendered intersections indexed=%s through transformed slopes', indexed => {
    const mesh = slope(indexed);mesh.position.set(12, 4, -9);mesh.rotation.y = .7;mesh.scale.set(1.2, .8, 1.4);mesh.updateMatrixWorld(true);
    const from = new THREE.Vector3(0, 1.15, 0).applyMatrix4(mesh.matrixWorld), to = new THREE.Vector3(0, 1.55, 6).applyMatrix4(mesh.matrixWorld);
    const query = ray(from, to), expected = oracle(mesh, query);
    expect(expected).not.toBeNull();expect(nearestGroundCameraHit(mesh, query)).toBeCloseTo(expected!, 10);
    expect(nearestGroundCameraHit(mesh, ray(from, from.clone().lerp(to, .1)))).toBeNull();
  });
  it('uses nearby cells on warm queries rather than rescanning a whole dense town mesh', () => {
    const mesh = slope(), query = ray();mesh.updateMatrixWorld(true);
    const vertices = Array.from(mesh.geometry.getAttribute('position').array), indices = Array.from(mesh.geometry.index!.array);
    expect(nearestGroundCameraHit(mesh, query)).toBeCloseTo(oracle(mesh, query)!);
    const reads = vi.spyOn(mesh.geometry.getAttribute('position'), 'getX');
    for (let i = 0; i < 4; i++) expect(nearestGroundCameraHit(mesh, query)).not.toBeNull();
    // Four local queries must not read all 98,304 indexed vertex references.
    expect(reads.mock.calls.length).toBeLessThan(5000);reads.mockRestore();
    expect(Array.from(mesh.geometry.getAttribute('position').array)).toEqual(vertices);
    expect(Array.from(mesh.geometry.index!.array)).toEqual(indices);
  });
  it('invalidates changed position/index attributes and follows live transforms', () => {
    const mesh = slope(), query = ray();mesh.updateMatrixWorld(true);
    expect(nearestGroundCameraHit(mesh, query)).not.toBeNull();
    const position = mesh.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) position.setY(i, -10);position.needsUpdate = true;
    expect(nearestGroundCameraHit(mesh, query)).toBeNull();
    mesh.geometry = slope().geometry;expect(nearestGroundCameraHit(mesh, query)).not.toBeNull();
    mesh.geometry.setIndex([]);expect(nearestGroundCameraHit(mesh, query)).toBeNull();
    mesh.geometry = slope().geometry;mesh.position.x = 1000;mesh.updateMatrixWorld(true);
    expect(nearestGroundCameraHit(mesh, query)).toBeNull();
  });
  it('honors live material sides, visibility, opacity, groups and draw ranges', () => {
    const mesh = slope(), query = ray();mesh.updateMatrixWorld(true);
    const front = new THREE.MeshBasicMaterial({side:THREE.FrontSide}), back = new THREE.MeshBasicMaterial({side:THREE.BackSide});
    for (const material of [front, back]) {mesh.material = material;expect(nearestGroundCameraHit(mesh, query)).toEqual(oracle(mesh, query));}
    const material = new THREE.MeshBasicMaterial({side:THREE.DoubleSide});mesh.material = material;
    material.visible = false;expect(nearestGroundCameraHit(mesh, query)).toBeNull();material.visible = true;
    material.transparent = true;material.opacity = .5;expect(nearestGroundCameraHit(mesh, query)).toBeNull();material.opacity = 1;
    mesh.geometry.clearGroups();mesh.geometry.addGroup(0, mesh.geometry.index!.count, 1);mesh.material = [front, material];
    expect(nearestGroundCameraHit(mesh, query)).toEqual(oracle(mesh, query));
    mesh.geometry.setDrawRange(0, 3);expect(nearestGroundCameraHit(mesh, query)).toBeNull();
    mesh.geometry.setDrawRange(0, Infinity);mesh.visible = false;expect(nearestGroundCameraHit(mesh, query)).toBeNull();
  });
  it('keeps a very large face instead of losing it at grid boundaries', () => {
    const geometry = new THREE.BufferGeometry();geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1000,0,-1000,1000,0,-1000,0,0,1000], 3));
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld(true);
    const query = ray(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, -2, 0));
    expect(nearestGroundCameraHit(mesh, query)).toEqual(oracle(mesh, query));
  });
  it('matches native rays across positive, negative and exact corner cell crossings', () => {
    const mesh = slope();mesh.updateMatrixWorld(true);
    for (const [x,z] of [[70,70],[-70,70],[70,-70],[-70,-70],[0,64],[64,0]]) {
      const query = ray(new THREE.Vector3(-x, 30, -z), new THREE.Vector3(x, -30, z));
      expect(nearestGroundCameraHit(mesh, query)).toBeCloseTo(oracle(mesh, query)!, 10);
    }
  });
});
