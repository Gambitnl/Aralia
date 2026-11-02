import { describe, it, expect } from 'vitest';
import { createGroundMoveGesture, hasInteractionBeforeGround, renderedGroundHit, sceneHitToTileMeters } from '../groundClickMove';
import * as THREE from 'three';

describe('ground movement gesture', () => {
  const pointer = (changes: Partial<PointerEvent> = {}) => ({ pointerId: 1, button: 0, clientX: 100, clientY: 100, isPrimary: true, ...changes });
  it('commits one primary tap only on a matching release and permits small jitter', () => {
    const gesture = createGroundMoveGesture();
    expect(gesture.finish(pointer())).toBe(false);
    gesture.begin(pointer());
    gesture.move(pointer({ clientX: 103, clientY: 104 }));
    expect(gesture.finish(pointer({ clientX: 103, clientY: 104 }))).toBe(true);
    expect(gesture.finish(pointer())).toBe(false);
  });
  it('rejects right-button orbit, middle-button pan and non-primary touch', () => {
    for (const input of [pointer({ button: 2 }), pointer({ button: 1 }), pointer({ isPrimary: false })]) {
      const gesture = createGroundMoveGesture();
      gesture.begin(input);
      expect(gesture.finish(input)).toBe(false);
    }
  });
  it('cancels a camera drag even after the pointer returns to its starting point', () => {
    const gesture = createGroundMoveGesture();
    gesture.begin(pointer());
    gesture.move(pointer({ clientX: 130 }));
    gesture.move(pointer());
    expect(gesture.finish(pointer())).toBe(false);
  });
  it('rejects a dragged release even if the intervening move was outside the plane', () => {
    const gesture = createGroundMoveGesture();
    gesture.begin(pointer());
    expect(gesture.finish(pointer({ clientY: 120 }))).toBe(false);
  });
  it('cancels interrupted and multi-pointer gestures', () => {
    const gesture = createGroundMoveGesture();
    gesture.begin(pointer()); gesture.cancel();
    expect(gesture.finish(pointer())).toBe(false);
    gesture.begin(pointer()); gesture.move(pointer({ pointerId: 2 }));
    expect(gesture.finish(pointer())).toBe(false);
    gesture.begin(pointer()); gesture.begin(pointer({ pointerId: 2, isPrimary: false }));
    expect(gesture.finish(pointer())).toBe(false);
  });
  it('does not accept a release from a different pointer or button', () => {
    const gesture = createGroundMoveGesture();
    gesture.begin(pointer());
    expect(gesture.finish(pointer({ pointerId: 2 }))).toBe(false);
    gesture.begin(pointer());
    expect(gesture.finish(pointer({ button: 2 }))).toBe(false);
  });
  it('rejects non-finite coordinates and recovers for the next genuine tap', () => {
    const gesture = createGroundMoveGesture();
    gesture.begin(pointer({ clientX: NaN }));
    expect(gesture.finish(pointer())).toBe(false);
    gesture.begin(pointer()); gesture.move(pointer({ clientY: Infinity }));
    expect(gesture.finish(pointer())).toBe(false);
    gesture.begin(pointer());
    expect(gesture.finish(pointer())).toBe(true);
  });
});

/**
 * The coordinate conversion is the one spot where a sign error would silently
 * teleport the player, so it is pinned here (the R3F pick plane that feeds it
 * isn't jsdom-testable). Convention: add the scene origin (sceneToWorld), then
 * clamp to the loaded tile.
 */
describe('sceneHitToTileMeters', () => {
  it('adds the scene origin (matches the camera-walk / combat-pick convention)', () => {
    const { xM, zM } = sceneHitToTileMeters(10, -5, { x: 100, z: 200 }, 0, 0);
    expect(xM).toBe(110);
    expect(zM).toBe(195);
  });

  it('is identity when the scene origin is zero (ground mode)', () => {
    const { xM, zM } = sceneHitToTileMeters(42, 17, { x: 0, z: 0 }, 0, 0);
    expect(xM).toBe(42);
    expect(zM).toBe(17);
  });

  it('clamps a hit past the tile edge back onto the loaded surface', () => {
    // extent 300x300, origin 0: a click at 999 clamps to 300, a click at -50 to 0.
    expect(sceneHitToTileMeters(999, -50, { x: 0, z: 0 }, 300, 300)).toEqual({ xM: 300, zM: 0 });
  });

  it('keeps an in-bounds hit unchanged under clamping', () => {
    expect(sceneHitToTileMeters(120, 80, { x: 0, z: 0 }, 300, 300)).toEqual({ xM: 120, zM: 80 });
  });

  it('leaves coordinates unclamped when extents are non-positive (unknown tile size)', () => {
    expect(sceneHitToTileMeters(-40, 500, { x: 0, z: 0 }, 0, -1)).toEqual({ xM: -40, zM: 500 });
  });
});

describe('ground interaction priority', () => {
  const plane = new THREE.Object3D();
  const ray = new THREE.Ray(new THREE.Vector3(0, 6, 0), new THREE.Vector3(0, -1, 0));
  const ground = new THREE.Vector3(0, 0, 0);

  it('yields to a desk below the flat input plane but above actual terrain', () => {
    // The actual library ray hit the plane at 2.934m, desk at 3.838m and
    // terrain at 5.379m. Plane-first delivery must not also start walking.
    const actualRay = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
    expect(hasInteractionBeforeGround([
      { eventObject: plane, distance: 2.934 },
      { eventObject: new THREE.Object3D(), distance: 3.838 },
    ], plane, actualRay, new THREE.Vector3(0, -5.379, 0))).toBe(true);
  });

  it.each(['resident', 'door group', 'furnishing'])('preserves the %s interaction in front of the ground', () => {
    expect(hasInteractionBeforeGround([
      { eventObject: new THREE.Group(), distance: 4 },
      { eventObject: plane, distance: 5 },
    ], plane, ray, ground)).toBe(true);
  });

  it('permits open-ground movement with only the input plane in the ray', () => {
    expect(hasInteractionBeforeGround([{ eventObject: plane, distance: 2 }], plane, ray, ground)).toBe(false);
  });

  it('does not let a buried or invalid intersection block visible open ground', () => {
    expect(hasInteractionBeforeGround([
      { eventObject: new THREE.Object3D(), distance: 7 },
      { eventObject: new THREE.Object3D(), distance: NaN },
      { eventObject: new THREE.Object3D(), distance: -1 },
    ], plane, ray, ground)).toBe(false);
  });
});

describe('rendered ground picking', () => {
  const raisedTerrain = () => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshBasicMaterial());
    mesh.name = 'world3d:terrain';
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 10;
    return mesh;
  };
  const ray = new THREE.Ray(new THREE.Vector3(0, 20, 20), new THREE.Vector3(0, -1, -1).normalize());

  it('picks the visible raised floor instead of shifting the tap onto buried terrain', () => {
    // In the played temple the two surfaces differ by only 12cm, yet an
    // oblique floor tap shifts sideways when it follows the terrain below.
    const scene = new THREE.Scene(), floor = raisedTerrain();
    floor.name = 'world3d:walk-surface'; floor.position.y = 10.12;
    scene.add(raisedTerrain(), floor); scene.updateMatrixWorld(true);
    const hit = renderedGroundHit(scene, ray)!;
    expect(hit.y).toBeCloseTo(10.12);
    expect(hit.z).toBeCloseTo(10.12);
  });

  it('does not turn a stair side or a hidden floor into a walking destination', () => {
    const scene = new THREE.Scene(), hidden = raisedTerrain();
    hidden.name = 'world3d:walk-surface'; hidden.position.y = 15; hidden.visible = false;
    const side = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 1), new THREE.MeshBasicMaterial());
    side.name = 'world3d:walk-surface'; side.position.set(0, 15, 17);
    scene.add(raisedTerrain(), hidden, side); scene.updateMatrixWorld(true);
    expect(renderedGroundHit(scene, ray)?.y).toBeCloseTo(10);
  });

  it('lands on the raised visible ground rather than the low capture plane', () => {
    const scene = new THREE.Scene(); scene.add(raisedTerrain()); scene.updateMatrixWorld(true);
    const hit = renderedGroundHit(scene, ray)!;
    expect(hit.y).toBeCloseTo(10);
    expect(hit.z).toBeCloseTo(10);
    const oldPlaneHit = ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3())!;
    expect(oldPlaneHit.z).toBeCloseTo(0);
  });

  it('does not treat roofs and skirts as walkable terrain', () => {
    const scene = new THREE.Scene();
    const roof = raisedTerrain(); roof.name = 'world3d:site-building'; roof.position.y = 15;
    scene.add(roof, raisedTerrain()); scene.updateMatrixWorld(true);
    expect(renderedGroundHit(scene, ray)?.y).toBeCloseTo(10);
    scene.children[1].name = 'world3d:terrain-skirt';
    expect(renderedGroundHit(scene, ray)).toBeNull();
  });

  it('keeps physical ground when a presentation layer is hidden', () => {
    const scene = new THREE.Scene(), layer = new THREE.Group();
    layer.add(raisedTerrain()); layer.visible = false; scene.add(layer); scene.updateMatrixWorld(true);
    expect(renderedGroundHit(scene, ray)?.y).toBeCloseTo(10);
  });
});
