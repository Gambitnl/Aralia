import {describe, expect, it, vi} from 'vitest';
import * as THREE from 'three';
import {nearestGroundCameraHit, nearestGroundCameraHits} from '../cameraGroundRaycast';
import {TABLE_LAMP_NO_HIT_RAYCAST} from '../tableLamp';

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
  it('checks nearby instanced scenery without rereading every town prop on warm rays', () => {
    const mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(.4, .4, 2, 8),
      new THREE.MeshBasicMaterial({side: THREE.DoubleSide}), 2000), matrix = new THREE.Matrix4();
    for (let i = 0; i < mesh.count; i++) mesh.setMatrixAt(i, matrix.makeTranslation(i ? i * 3 : 0, 1.5, 3));
    mesh.instanceMatrix.needsUpdate = true; mesh.updateMatrixWorld(true);
    const query = ray(), expected = oracle(mesh, query), original = Array.from(mesh.instanceMatrix.array);
    expect(expected).not.toBeNull(); expect(nearestGroundCameraHit(mesh, query)).toBeCloseTo(expected!, 10);
    const reads = vi.spyOn(mesh, 'getMatrixAt');
    for (let i = 0; i < 4; i++) expect(nearestGroundCameraHit(mesh, query)).toBeCloseTo(expected!, 10);
    expect(reads.mock.calls.length).toBeLessThan(20); reads.mockRestore();
    expect(Array.from(mesh.instanceMatrix.array)).toEqual(original);
  });
  it('invalidates instanced scenery bounds when matrices, geometry or active count change', () => {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 2, 1),
      new THREE.MeshBasicMaterial({side: THREE.DoubleSide}), 2), matrix = new THREE.Matrix4();
    mesh.setMatrixAt(0, matrix.makeTranslation(0, 1.5, 3));
    mesh.setMatrixAt(1, matrix.makeTranslation(20, 1.5, 3));
    mesh.instanceMatrix.needsUpdate = true; mesh.updateMatrixWorld(true);
    const query = ray(); expect(nearestGroundCameraHit(mesh, query)).not.toBeNull();
    mesh.setMatrixAt(0, matrix.makeTranslation(20, 1.5, 3)); mesh.instanceMatrix.needsUpdate = true;
    expect(nearestGroundCameraHit(mesh, query)).toBeNull();
    mesh.setMatrixAt(1, matrix.makeTranslation(0, 1.5, 3)); mesh.instanceMatrix.needsUpdate = true;
    expect(nearestGroundCameraHit(mesh, query)).not.toBeNull();
    mesh.count = 1; expect(nearestGroundCameraHit(mesh, query)).toBeNull();
    mesh.count = 2; expect(nearestGroundCameraHit(mesh, query)).not.toBeNull();
    mesh.geometry = new THREE.BoxGeometry(1, .01, 1);
    expect(nearestGroundCameraHit(mesh, query)).toBeNull();
    mesh.geometry = new THREE.BoxGeometry(1, 2, 1);
    const position = mesh.geometry.getAttribute('position');
    expect(nearestGroundCameraHit(mesh, query)).not.toBeNull();
    for (let i = 0; i < position.count; i++) position.setX(i, position.getX(i) + 20);
    position.needsUpdate = true; expect(nearestGroundCameraHit(mesh, query)).toBeNull();
  });
  it('matches native instanced triangles through parent transforms and retains custom raycast ownership', () => {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(.6, 2, .6),
      new THREE.MeshBasicMaterial({side: THREE.DoubleSide}), 1);
    mesh.setMatrixAt(0, new THREE.Matrix4().makeTranslation(0, 1.5, 3));
    mesh.position.set(12, 4, -9); mesh.rotation.y = .7; mesh.scale.set(1.2, .8, 1.4); mesh.updateMatrixWorld(true);
    const query = ray(new THREE.Vector3(0, 1.15, 0).applyMatrix4(mesh.matrixWorld),
      new THREE.Vector3(0, 1.55, 6).applyMatrix4(mesh.matrixWorld));
    expect(nearestGroundCameraHit(mesh, query)).toBeCloseTo(oracle(mesh, query)!, 10);
    mesh.raycast = vi.fn(); expect(nearestGroundCameraHit(mesh, query)).toBeNull();
    expect(mesh.raycast).toHaveBeenCalledOnce();
  });
  it('preserves custom raycast behavior on decorative or specially shaped mounted pieces', () => {
    const mesh = slope(), query = ray();mesh.updateMatrixWorld(true);
    mesh.raycast = vi.fn();
    expect(nearestGroundCameraHit(mesh, query)).toBeNull();
    expect(mesh.raycast).toHaveBeenCalledOnce();
  });
  it('matches two native rays while traversing a root once and rereads scene changes next call', () => {
    const root = new THREE.Group(), mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 4, .2),
      new THREE.MeshBasicMaterial({side: THREE.DoubleSide})); mesh.position.set(0, 1.5, 3); root.add(mesh); root.updateMatrixWorld(true);
    const rays = [ray(), ray(new THREE.Vector3(.4, 1.15, 0), new THREE.Vector3(.4, 1.55, 6))];
    const traverse = vi.spyOn(root, 'traverseVisible');
    const hits = nearestGroundCameraHits([{root, applies: [true, true]}], rays);
    expect(hits[0]).toBeCloseTo(oracle(mesh, rays[0])!, 10);
    expect(hits[1]).toBeCloseTo(oracle(mesh, rays[1])!, 10);
    expect(traverse).toHaveBeenCalledOnce();
    mesh.layers.set(1);
    expect(nearestGroundCameraHits([{root, applies: [true, true]}], rays)).toEqual([null, null]);
    rays[0].layers.set(1); rays[1].layers.set(1);
    mesh.layers.enable(0);
    expect(mesh.layers.test(rays[0].layers)).toBe(true);
    expect(nearestGroundCameraHits([{root, applies: [true, true]}], rays)[0]).not.toBeNull();
    mesh.position.x = 1000; root.updateMatrixWorld(true);
    expect(nearestGroundCameraHits([{root, applies: [true, true]}], rays)).toEqual([null, null]);
    mesh.position.x = 0; mesh.visible = false;
    expect(nearestGroundCameraHits([{root, applies: [true, true]}], rays)).toEqual([null, null]);
  });
  it('batches native instanced rays against the same live instance transforms', () => {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(.6, 2, .6),
      new THREE.MeshBasicMaterial({side: THREE.DoubleSide}), 1);
    mesh.setMatrixAt(0, new THREE.Matrix4().makeTranslation(0, 1.5, 3));
    mesh.instanceMatrix.needsUpdate = true; mesh.updateMatrixWorld(true);
    const rays = [ray(), ray(new THREE.Vector3(.1, 1.15, 0), new THREE.Vector3(.1, 1.55, 6))];
    const hits = nearestGroundCameraHits([{root: mesh, applies: [true, true]}], rays);
    expect(hits).toEqual(rays.map(query => oracle(mesh, query)));
    mesh.setMatrixAt(0, new THREE.Matrix4().makeTranslation(20, 1.5, 3)); mesh.instanceMatrix.needsUpdate = true;
    expect(nearestGroundCameraHits([{root: mesh, applies: [true, true]}], rays)).toEqual([null, null]);
  });
  it('batches the exact shared lamp no-hit callback while preserving native wall hits', () => {
    const root = new THREE.Group();
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(.3, .3, .3), new THREE.MeshBasicMaterial());
    lamp.raycast = TABLE_LAMP_NO_HIT_RAYCAST;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(2, 3, .2), new THREE.MeshBasicMaterial({side: THREE.DoubleSide}));
    lamp.position.set(0, 1.5, 1); wall.position.set(0, 1.5, 3); root.add(lamp, wall); root.updateMatrixWorld(true);
    const rays = [ray(), ray(new THREE.Vector3(.3, 1.15, 0), new THREE.Vector3(.3, 1.55, 6))];
    const traverse = vi.spyOn(root, 'traverseVisible');
    expect(nearestGroundCameraHits([{root, applies: [true, true]}], rays))
      .toEqual(rays.map(query => oracle(wall, query)));
    expect(traverse).toHaveBeenCalledOnce();

    // Replacing the exact callback with any other function restores ordered fallback.
    const replacement = vi.fn(); lamp.raycast = replacement;
    traverse.mockClear();
    expect(nearestGroundCameraHits([{root, applies: [true, true], batchSafe: false}], rays))
      .toEqual(rays.map(query => oracle(wall, query)));
    expect(replacement).toHaveBeenCalledTimes(2);
    expect(traverse).toHaveBeenCalledTimes(2);
  });
  it('lets a leading custom raycast hide a later wall before its live traversal visit', () => {
    const root = new THREE.Group(), custom = new THREE.Mesh(new THREE.BoxGeometry(.5, .5, .5), new THREE.MeshBasicMaterial());
    const wall = new THREE.Mesh(new THREE.BoxGeometry(2, 3, .2), new THREE.MeshBasicMaterial({side: THREE.DoubleSide}));
    custom.position.set(0, 1.5, 1); wall.position.set(0, 1.5, 3);
    const query = ray(), nativeWallHit = oracle(wall, query);
    expect(nativeWallHit).not.toBeNull();
    const mutate = vi.fn(() => { wall.visible = false; }); custom.raycast = mutate;
    root.add(custom, wall); root.updateMatrixWorld(true);
    expect(nearestGroundCameraHit(root, query)).toBeNull();
    expect(mutate).toHaveBeenCalledOnce();
  });
  it('observes a newly appended sibling on the next native query', () => {
    const root = new THREE.Group(), custom = new THREE.Mesh(new THREE.BoxGeometry(.5, .5, .5), new THREE.MeshBasicMaterial());
    custom.position.set(0, 1.5, 1);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(2, 3, .2), new THREE.MeshBasicMaterial({side: THREE.DoubleSide}));
    wall.position.set(0, 1.5, 3);
    let appended = false;
    custom.raycast = () => { if (!appended) { appended = true; root.add(wall); } };
    root.add(custom); root.updateMatrixWorld(true);
    const query = ray();
    expect(nearestGroundCameraHit(root, query)).toBeNull();
    expect(nearestGroundCameraHit(root, query)).toBeCloseTo(oracle(wall, query)!, 10);
  });
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
  it('rejects a warmed ray outside the real geometry bounds before walking its long grid path', () => {
    const mesh = slope(), warm = ray(); mesh.updateMatrixWorld(true);
    const expected = oracle(mesh, warm);
    expect(expected).not.toBeNull();
    expect(nearestGroundCameraHit(mesh, warm)).toBeCloseTo(expected!, 10);

    const outside = new THREE.Raycaster(new THREE.Vector3(1000, 1.15, 0), new THREE.Vector3(0, .4, 6).normalize(), .01, 256);
    expect(oracle(mesh, outside)).toBeNull();
    const mapReads = vi.spyOn(Map.prototype, 'get');
    expect(nearestGroundCameraHit(mesh, outside)).toBeNull();
    const cellReads = mapReads.mock.calls.length;
    mapReads.mockRestore();
    // The ray misses every source triangle, so it should not look up any of
    // the 2 m cells along its 256 m arm after the index has been warmed.
    expect(cellReads).toBe(0);
  });
  it('keeps malformed source triangles on the established exact candidate path', () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      -1, 0, 2, Number.NaN, 0, 2, 1, 0, 2,
    ], 3));
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({side: THREE.DoubleSide})); mesh.updateMatrixWorld(true);
    const query = ray();
    expect(oracle(mesh, query)).toBeNull();
    const mapReads = vi.spyOn(Map.prototype, 'get');
    expect(nearestGroundCameraHit(mesh, query)).toBeNull();
    const cellReads = mapReads.mock.calls.length;
    mapReads.mockRestore();
    // Non-finite source data cannot establish an enclosing box, so the old
    // bounded grid path still runs and decides the empty result.
    expect(cellReads).toBeGreaterThan(0);
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
