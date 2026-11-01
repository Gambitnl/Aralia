import {describe, expect, it} from 'vitest';
import * as THREE from 'three';
import {cameraBeforeBuilding, createPlayerCameraSightline} from '../playerCameraVisibility';

function fixture() {
  const scene = new THREE.Scene(), building = new THREE.Group();
  building.name = 'world3d:site-building';
  building.position.set(100, 2, 100); building.rotation.y = Math.PI / 2;
  const wall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 8), new THREE.MeshBasicMaterial());
  wall.position.x = 2; building.add(wall); scene.add(building);
  return {scene, building, wall};
}

describe('rendered player camera sightline', () => {
  it('does not treat the projected ground shadow as the physical figure width', () => {
    const scene = new THREE.Scene(), building = new THREE.Group(), player = new THREE.Group();
    building.name = 'world3d:site-building'; player.name = 'world3d:player';
    const wall = new THREE.Mesh(new THREE.BoxGeometry(.1, 3, 8), new THREE.MeshBasicMaterial());
    wall.position.set(.65, 1.5, 0); building.add(wall); scene.add(building);
    const body = new THREE.Mesh(new THREE.BoxGeometry(.4, 1.8, .4), new THREE.MeshBasicMaterial());
    body.position.y = .9; player.add(body);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({transparent: true, opacity: .3}));
    shadow.name = 'blobShadow'; shadow.rotation.x = -Math.PI / 2; player.add(shadow); scene.add(player);
    const query = createPlayerCameraSightline(() => scene);
    expect(query([0, 1.15, 0], [0, 2.6, 6])).toBeNull();
  });
  it('rejects a lintel-hidden head even when the torso center ray is clear', () => {
    const scene = new THREE.Scene(), building = new THREE.Group();
    building.name = 'world3d:site-building';
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 0.2), new THREE.MeshBasicMaterial());
    lintel.position.set(0, 2.2, 2); building.add(lintel); scene.add(building);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.8, 0.4), new THREE.MeshBasicMaterial());
    body.name = 'world3d:player'; body.position.y = 0.9; scene.add(body);
    const query = createPlayerCameraSightline(() => scene), focus = [0, 1.15, 0] as const, eye = [0, 2.6, 6] as const;
    expect(query(focus, eye)).not.toBeNull();
    const clear = cameraBeforeBuilding(focus, eye, query)!;
    expect(clear).not.toEqual(eye);
    expect(query(focus, clear)).toBeNull();
    expect(body.position.toArray()).toEqual([0, 0.9, 0]);
  });
  it('refuses to establish clearance before the rendered scene is available', () => {
    const query = createPlayerCameraSightline(() => null);
    expect(cameraBeforeBuilding([0, 1, 0], [0, 2, 6], query)).toBeNull();
  });
  it('uses real rotated building geometry and retracts before it without moving the focus', () => {
    const {scene} = fixture(), query = createPlayerCameraSightline(() => scene);
    const focus = Object.freeze([100, 2, 100] as const), eye = Object.freeze([100, 2, 94] as const);
    expect(query(focus, eye)).toBeCloseTo(1.9);
    const clear = cameraBeforeBuilding(focus, eye, query)!;
    expect(clear[2]).toBeCloseTo(98.3);
    expect(query(focus, clear)).toBeNull();
    expect(focus).toEqual([100, 2, 100]); expect(eye).toEqual([100, 2, 94]);
  });
  it('ignores hidden parents and transparent glass but retains opaque structure', () => {
    const {scene, building, wall} = fixture(), query = createPlayerCameraSightline(() => scene);
    const from = [100, 2, 100] as const, to = [100, 2, 94] as const;
    building.visible = false; expect(query(from, to)).toBeNull();
    building.visible = true; wall.material.transparent = true; wall.material.opacity = 0.25;
    expect(query(from, to)).toBeNull();
    wall.material.opacity = 1; expect(query(from, to)).toBeCloseTo(1.9);
  });
  it('reads opened leaf transforms without waiting for the streaming cache', () => {
    const {scene, wall} = fixture(), query = createPlayerCameraSightline(() => scene, () => 0);
    expect(query([100, 2, 100], [100, 2, 94])).not.toBeNull();
    wall.position.z = 10;
    expect(query([100, 2, 100], [100, 2, 94])).toBeNull();
  });
  it('refreshes streamed buildings and stops considering removed roots', () => {
    const {scene, building} = fixture(); let time = 0;
    const query = createPlayerCameraSightline(() => scene, () => time);
    expect(query([100, 2, 100], [100, 2, 94])).not.toBeNull();
    scene.remove(building); expect(query([100, 2, 100], [100, 2, 94])).toBeNull();
    scene.add(building); time = 1001;
    expect(query([100, 2, 100], [100, 2, 94])).not.toBeNull();
  });
  it('does not use the player or unrelated scene actors as building occluders', () => {
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial()));
    const query = createPlayerCameraSightline(() => scene), eye = [0, 1, 6] as const;
    expect(cameraBeforeBuilding([0, 1, 0], eye, query)).toBe(eye);
    expect(cameraBeforeBuilding([0, 1, 0], eye, () => 0.2)).toBeNull();
  });
});

describe('opaque streamed decks in the player sightline', () => {
  function deckScene() {
    const scene = new THREE.Scene(), deck = new THREE.Mesh(
      new THREE.BoxGeometry(8, .45, 8), new THREE.MeshBasicMaterial({side: THREE.DoubleSide}),
    );
    deck.name = 'world3d:decks'; deck.position.set(0, 2, 3); scene.add(deck);
    return {scene, deck};
  }
  it('retracts under a real bridge instead of reporting clear building-only space', () => {
    const {scene} = deckScene(), query = createPlayerCameraSightline(() => scene);
    const focus = Object.freeze([0, 1.15, 0] as const), eye = Object.freeze([0, 2.6, 6] as const);
    expect(query(focus, eye)).not.toBeNull();
    const clear = cameraBeforeBuilding(focus, eye, query)!;
    expect(clear).not.toBeNull(); expect(clear[2]).toBeLessThan(3);
    expect(query(focus, clear)).toBeNull();
    expect(clear[0]).toBe(0); expect(focus).toEqual([0, 1.15, 0]); expect(eye).toEqual([0, 2.6, 6]);
  });
  it('uses the mounted deck visibility and excludes a hidden bridge without hiding unrelated actors', () => {
    const {scene, deck} = deckScene(), query = createPlayerCameraSightline(() => scene);
    const focus = [0, 1.15, 0] as const, eye = [0, 2.6, 6] as const;
    expect(query(focus, eye)).not.toBeNull();
    deck.visible = false; expect(query(focus, eye)).toBeNull();
    deck.visible = true; expect(query(focus, eye)).not.toBeNull();
    scene.remove(deck); expect(query(focus, eye)).toBeNull();
  });
});

describe('opaque rendered ground in the player sightline', () => {
  it.each(['world3d:terrain', 'world3d:roads'])('retracts before a sloping %s surface without moving the reached body', name => {
    const scene = new THREE.Scene(), geometry = new THREE.PlaneGeometry(12, 12);
    geometry.rotateX(-Math.PI / 2);
    const position = geometry.getAttribute('position');
    for (let index = 0; index < position.count; index++) position.setY(index, position.getZ(index) / 3);
    geometry.computeVertexNormals();
    const ground = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
    ground.name = name; scene.add(ground);
    const body = new THREE.Mesh(new THREE.BoxGeometry(.4, 1.34, .4), new THREE.MeshBasicMaterial());
    body.name = 'world3d:player'; body.position.y = .67; scene.add(body);
    const vertices = Array.from(position.array), savedBody = body.position.toArray();
    const focus = Object.freeze([0, 1.15, 0] as const), eye = Object.freeze([0, 1.55, 6] as const);
    const query = createPlayerCameraSightline(() => scene, () => 0);
    // The eye is beneath the hill even though no building or bridge blocks it.
    // Reuse the normal arm retraction; terrain and the accepted feet stay put.
    expect(query(focus, eye)).not.toBeNull();
    const clear = cameraBeforeBuilding(focus, eye, query);
    expect(clear).not.toBeNull();
    expect(clear![2]).toBeGreaterThan(0); expect(clear![2]).toBeLessThan(6);
    expect(query(focus, clear!)).toBeNull();
    expect(clear![0]).toBe(0);
    expect((clear![1] - focus[1]) / (eye[1] - focus[1])).toBeCloseTo(clear![2] / eye[2]);
    expect(body.position.toArray()).toEqual(savedBody);
    expect(Array.from(position.array)).toEqual(vertices);
    ground.visible = false; expect(query(focus, eye)).toBeNull();
    ground.visible = true; expect(query(focus, eye)).not.toBeNull();
    scene.remove(ground); expect(query(focus, eye)).toBeNull();
  });
});
