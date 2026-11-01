import {describe, expect, it, vi} from 'vitest';
import * as THREE from 'three';
import {createPlayerCameraSelfVisibility} from '../playerCameraSelfVisibility';
import {outlineMaterial} from '../../../systems/entities3d/three/toon';

function library() {
  // Measured after ordinary entry into source library30. The camera is only
  // 343mm from this visible body box and the figure fills the native viewport.
  const scene = new THREE.Scene(), player = new THREE.Group();
  player.name = 'world3d:player';
  player.position.set(53.777100925202774, 2.84443031106152, 17.028274685713825);
  const min = new THREE.Vector3(53.241327558468285, 2.8445655564597883, 16.45784000669408);
  const max = new THREE.Vector3(54.29630955306399, 4.697135152834263, 17.502751379553825);
  const material = new THREE.MeshStandardMaterial({color: '#d8ad52'});
  const size = max.clone().sub(min), center = min.clone().add(max).multiplyScalar(.5);
  const body = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
  body.position.copy(center.sub(player.position)); player.add(body); scene.add(player);
  const resident = new THREE.Mesh(body.geometry, material); resident.name = 'residentInterior:rosa';
  resident.position.set(60, 3, 20); scene.add(resident);
  const eye = new THREE.Vector3(53.0882467146111, 4.132197430211916, 16.150399136080818);
  scene.updateMatrixWorld(true);
  return {scene, player, body, resident, material, eye};
}

describe('lead player visibility in a compressed camera view', () => {
  it('makes the recorded library close view readable without changing the physical figure', () => {
    const f = library(), view = createPlayerCameraSelfVisibility();
    const before = new THREE.Box3().setFromObject(f.body), matrix = f.player.matrixWorld.clone();
    expect(before.distanceToPoint(f.eye)).toBeCloseTo(.3434437853);
    expect(view.update(f.scene, f.eye, true)).toBe(true);
    expect(f.body.material).not.toBe(f.material);
    expect(f.body.material.opacity).toBeGreaterThan(0);
    expect(f.body.material.opacity).toBeLessThan(.15);
    expect(f.body.material.transparent).toBe(true);
    expect(f.body.material.depthWrite).toBe(false);
    expect(f.body.visible).toBe(true); expect(f.player.visible).toBe(true);
    expect(new THREE.Box3().setFromObject(f.body)).toEqual(before);
    expect(f.player.matrixWorld).toEqual(matrix);
  });

  it('preserves residents and followers even when they share the original material', () => {
    const f = library(), follower = new THREE.Group(), view = createPlayerCameraSelfVisibility();
    follower.name = 'world3d:companion:elara';
    const body = new THREE.Mesh(f.body.geometry, f.material); follower.add(body); f.scene.add(follower);
    view.update(f.scene, f.eye, true);
    expect(f.resident.material).toBe(f.material); expect(body.material).toBe(f.material);
    expect(f.material.opacity).toBe(1); expect(f.material.transparent).toBe(false);
    expect(f.resident.visible).toBe(true); expect(follower.visible).toBe(true);
  });

  it('restores the exact original material and disposes only its own clone on a clear view', () => {
    const f = library(), view = createPlayerCameraSelfVisibility(), sourceDispose = vi.spyOn(f.material, 'dispose');
    view.update(f.scene, f.eye, true);
    const owned = f.body.material, ownedDispose = vi.spyOn(owned, 'dispose');
    expect(view.update(f.scene, new THREE.Vector3(40, 5, 10), true)).toBe(false);
    expect(f.body.material).toBe(f.material); expect(f.material.depthWrite).toBe(true);
    expect(f.material.transparent).toBe(false); expect(ownedDispose).toHaveBeenCalledOnce();
    expect(sourceDispose).not.toHaveBeenCalled();
  });

  it('restores exact material arrays when leaving the player view or unmounting', () => {
    const f = library(), view = createPlayerCameraSelfVisibility();
    const second = new THREE.MeshStandardMaterial({transparent: true, opacity: .5, depthWrite: false});
    const original = [f.material, second];
    (f.body as THREE.Mesh<THREE.BoxGeometry, THREE.Material | THREE.Material[]>).material = original;
    view.update(f.scene, f.eye, true);
    expect(f.body.material).not.toBe(original);
    expect(view.update(f.scene, f.eye, false)).toBe(false);
    expect(f.body.material).toBe(original); expect(second.opacity).toBe(.5);
    view.update(f.scene, f.eye, true); view.restore();
    expect(f.body.material).toBe(original);
  });

  it('ignores a projected shadow and hidden geometry when deciding whether the body obscures the eye', () => {
    const f = library(), view = createPlayerCameraSelfVisibility();
    const shadow = new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100), f.material);
    shadow.name = 'blobShadow'; f.player.add(shadow);
    const hidden = shadow.clone(); hidden.name = 'hidden-equipment'; hidden.visible = false; f.player.add(hidden);
    expect(view.update(f.scene, new THREE.Vector3(40, 5, 10), true)).toBe(false);
    expect(f.body.material).toBe(f.material); expect(shadow.material).toBe(f.material);
  });

  it('does not restore an obsolete material over a new appearance supplied while faded', () => {
    const f = library(), view = createPlayerCameraSelfVisibility(); view.update(f.scene, f.eye, true);
    const replacement = new THREE.MeshStandardMaterial({color: '#204080'});
    f.body.material = replacement; view.restore();
    expect(f.body.material).toBe(replacement); expect(replacement.opacity).toBe(1);
  });

  it('restores the source material when no mounted scene is available', () => {
    const f = library(), view = createPlayerCameraSelfVisibility(); view.update(f.scene, f.eye, true);
    expect(view.update(undefined, f.eye, true)).toBe(false);
    expect(f.body.material).toBe(f.material);
  });

  it('keeps a close-view silhouette stable through small camera-arm changes', () => {
    const f = library(), view = createPlayerCameraSelfVisibility();
    const bounds = new THREE.Box3().setFromObject(f.body), middle = bounds.getCenter(new THREE.Vector3());
    const near = new THREE.Vector3(bounds.min.x - .6, middle.y, middle.z);
    expect(view.update(f.scene, near, true)).toBe(false);
    expect(view.update(f.scene, f.eye, true)).toBe(true);
    const material = f.body.material;
    expect(view.update(f.scene, near, true)).toBe(true);
    expect(f.body.material).toBe(material);
    near.x = bounds.min.x - .9;
    expect(view.update(f.scene, near, true)).toBe(false);
    expect(f.body.material).toBe(f.material);
  });

  it('fades the real entity ink shader alpha without changing a shared source outline', () => {
    const f = library(), view = createPlayerCameraSelfVisibility();
    const ink = outlineMaterial('#646232');
    const shell = new THREE.Mesh(f.body.geometry, ink); shell.position.copy(f.body.position); f.player.add(shell);
    const residentInk = new THREE.Mesh(f.body.geometry, ink); f.resident.add(residentInk);
    view.update(f.scene, f.eye, true);
    // Native replay exposed a solid ink hull: this shader writes uA directly
    // into gl_FragColor and does not read the standard material.opacity.
    expect(shell.material.uniforms.uA.value).toBeCloseTo(.08);
    expect(shell.material.uniforms.uA.value).toBeGreaterThan(0);
    expect(ink.uniforms.uA.value).toBe(1);
    expect(residentInk.material).toBe(ink);
    view.restore(); expect(shell.material).toBe(ink);
  });
});

// Actual Howling Shield return: the legal two-meter camera is well outside
// Sana's bounds, yet her opaque figure hides most of the furnished room.
function innView() {
  const scene = new THREE.Scene(), player = new THREE.Group();
  player.name = 'world3d:player';
  const min = new THREE.Vector3(-.4480394556534125,3.2313169055524025,-.4678711543842181);
  const max = new THREE.Vector3(.4480394556534125,5.062866173846413,.2653799355030061);
  const size = max.clone().sub(min), material = new THREE.MeshStandardMaterial();
  const body = new THREE.Mesh(new THREE.BoxGeometry(size.x,size.y,size.z),material);
  body.position.copy(min.clone().add(max).multiplyScalar(.5));player.add(body);scene.add(player);
  const camera = new THREE.PerspectiveCamera(55,1440/900,.05,60000);
  camera.position.set(2,5.831181660154135,0);camera.lookAt(0,4.381181660154134,0);
  scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  return {scene,player,body,material,camera};
}

describe('lead figure screen coverage in the played inn camera', () => {
  it('reveals the room when the lead figure crowds the frame beyond the old proximity threshold', () => {
    const f=innView(), view=createPlayerCameraSelfVisibility();
    const bounds=new THREE.Box3().setFromObject(f.body), transform=f.player.matrixWorld.clone();
    const pose=f.camera.matrixWorld.clone();
    expect(bounds.distanceToPoint(f.camera.position)).toBeGreaterThan(1.5);
    expect(view.update(f.scene,f.camera.position,true,f.camera)).toBe(true);
    expect(f.body.material.opacity).toBeCloseTo(.08);
    expect(f.material.opacity).toBe(1);
    expect(new THREE.Box3().setFromObject(f.body)).toEqual(bounds);
    expect(f.player.matrixWorld).toEqual(transform);expect(f.camera.matrixWorld).toEqual(pose);
  });

  it('restores the original figure when ordinary zoom gives it a readable size', () => {
    const f=innView(),view=createPlayerCameraSelfVisibility();
    view.update(f.scene,f.camera.position,true,f.camera);
    f.camera.position.set(6,5.831181660154135,0);f.camera.lookAt(0,4.381181660154134,0);
    expect(view.update(f.scene,f.camera.position,true,f.camera)).toBe(false);
    expect(f.body.material).toBe(f.material);
  });

  it('uses the actual projection and restores at the same eye with a wider field of view', () => {
    const f=innView(),view=createPlayerCameraSelfVisibility();
    expect(view.update(f.scene,f.camera.position,true,f.camera)).toBe(true);
    f.camera.fov=110;f.camera.updateProjectionMatrix();
    expect(view.update(f.scene,f.camera.position,true,f.camera)).toBe(false);
    expect(f.body.material).toBe(f.material);
  });

  it('does not fade an offscreen lead figure, a map view, or a camera without projection evidence', () => {
    const f=innView(),view=createPlayerCameraSelfVisibility();
    f.camera.lookAt(4,5.831181660154135,0);
    expect(view.update(f.scene,f.camera.position,true,f.camera)).toBe(false);
    f.camera.lookAt(0,4.381181660154134,0);
    expect(view.update(f.scene,f.camera.position,false,f.camera)).toBe(false);
    expect(view.update(f.scene,f.camera.position,true)).toBe(false);
    expect(f.body.material).toBe(f.material);
  });

  it('keeps residents, walls and shared source materials opaque during the larger screen-coverage fade', () => {
    const f=innView(),view=createPlayerCameraSelfVisibility();
    const resident=new THREE.Mesh(f.body.geometry,f.material),wall=resident.clone();
    resident.name='residentInterior:675:b34:head';wall.name='world3d:site-building';
    f.scene.add(resident,wall);
    expect(view.update(f.scene,f.camera.position,true,f.camera)).toBe(true);
    expect(resident.material).toBe(f.material);expect(wall.material).toBe(f.material);
    expect(f.material.opacity).toBe(1);expect(f.material.transparent).toBe(false);
    view.restore();expect(f.body.material).toBe(f.material);
  });
});


describe('compressed-view layered alpha regression', () => {
  it('suppresses lead color and ground shadow without removing physical body evidence', () => {
    const f = library(), view = createPlayerCameraSelfVisibility();
    const shadowSource = new THREE.ShaderMaterial({transparent: true, depthWrite: false, uniforms: {uOpacity: {value: .4}}});
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1), shadowSource);
    shadow.name = 'blobShadow'; f.player.add(shadow);
    const before = new THREE.Box3().setFromObject(f.body);
    expect(view.update(f.scene, f.eye, true)).toBe(true);
    // Many translucent armor/body layers accumulated into lens-like haze in
    // the native inn. Color suppression also applies to the custom shadow.
    expect(f.body.material.colorWrite).toBe(false);
    expect(shadow.material.colorWrite).toBe(false);
    expect(f.body.visible).toBe(true);
    expect(f.body.material.visible).toBe(true);
    expect(f.body.material.opacity).toBeGreaterThan(0);
    expect(f.body.material.depthWrite).toBe(false);
    expect(shadow.material.depthWrite).toBe(false);
    expect(new THREE.Box3().setFromObject(f.body)).toEqual(before);
    expect(f.material.colorWrite).toBe(true);
    expect(shadowSource.colorWrite).toBe(true);
    const shadowClone = shadow.material, dispose = vi.spyOn(shadowClone, 'dispose');
    view.restore();
    expect(f.body.material).toBe(f.material);
    expect(shadow.material).toBe(shadowSource);
    expect(dispose).toHaveBeenCalledOnce();
  });
});
