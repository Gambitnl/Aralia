/**
 * @file oceanFreeLook.ts — a free-look camera for the ocean viewer.
 *
 * WHAT IT IS FOR
 *
 * The viewer's camera used to move only when a capture script set its pose
 * (`__OCEAN__.setPose`) or a preset button did. A person who opened the page
 * could not look around. Remy asked for it on 2026-09-25 ("no mouse controls
 * here? i can't look around?").
 *
 * THE CONTROLS
 *
 *   drag (left button)   look around: yaw and pitch, no roll
 *   W A S D              fly forward, left, back, right, along the view
 *   E / Q                up / down
 *   Shift                four times faster
 *   wheel                a step forward or back along the view
 *
 * The speed follows the height above the water (a camera at 138 m flies
 * faster than one at 2 m), so one speed works for the deck view and the
 * view from high above.
 *
 * WHAT IS KEPT: THE CAPTURES DO NOT CHANGE
 *
 * The controller writes to the camera ONLY while there is input: a drag, a
 * held key, or a wheel step. With no input, `update` returns at once and the
 * camera keeps exactly the pose a script or a preset gave it. So every pinned
 * capture draws the same pixels as before (checked with the performance
 * pass's `perf/shots.mjs` and `perf/quality.py` on the five judged scenes).
 * After a script sets a pose, call `syncFromCamera()` so the next drag starts
 * from that pose instead of an old one.
 *
 * Keys act only while the canvas has focus (a pointer press gives it focus),
 * so typing elsewhere on the page never moves the camera.
 */
import * as THREE from 'three/webgpu';

export interface FreeLook {
  /** Apply held keys for one frame of `dtS` seconds. No input: no change. */
  update(dtS: number): void;
  /** Read yaw and pitch back from the camera after a script set its pose. */
  syncFromCamera(): void;
  dispose(): void;
}

/** Radians of turn per pixel of drag. About 0.14 degrees a pixel. */
const LOOK_RAD_PER_PX = 0.0025;
/** Pitch stops short of straight up and down, so yaw stays defined. */
const PITCH_LIMIT_RAD = (89 * Math.PI) / 180;
/** Flight speed near the water, m/s, and its growth with height (per m). */
const SPEED_MIN_MS = 6;
const SPEED_PER_M_OF_HEIGHT = 0.6;
const SHIFT_GAIN = 4;
/** One wheel notch moves this many seconds of flight at the current speed. */
const WHEEL_SECONDS = 0.35;

const FLY_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ShiftLeft', 'ShiftRight']);

export function attachFreeLook(camera: THREE.PerspectiveCamera, dom: HTMLElement): FreeLook {
  let yaw = 0;
  let pitch = 0;
  const held = new Set<string>();
  let drag: { id: number; x: number; y: number } | null = null;

  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const move = new THREE.Vector3();

  const syncFromCamera = () => {
    euler.setFromQuaternion(camera.quaternion, 'YXZ');
    yaw = euler.y;
    pitch = euler.x;
  };
  const applyLook = () => {
    euler.set(pitch, yaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);
  };
  const speed = () => {
    const s = Math.max(SPEED_MIN_MS, Math.abs(camera.position.y) * SPEED_PER_M_OF_HEIGHT);
    return held.has('ShiftLeft') || held.has('ShiftRight') ? s * SHIFT_GAIN : s;
  };

  // The canvas takes focus on a press, so keys reach it; the outline is off
  // because the canvas fills the frame and an outline would draw over the sea.
  if (!dom.hasAttribute('tabindex')) dom.tabIndex = 0;
  dom.style.outline = 'none';
  dom.style.touchAction = 'none';
  dom.style.cursor = 'grab';
  dom.title = 'Drag to look around. W A S D to fly, E up, Q down, Shift faster, wheel forward or back.';

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    dom.focus();
    syncFromCamera();
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    dom.setPointerCapture(e.pointerId);
    dom.style.cursor = 'grabbing';
  };
  const onMove = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    if (dx === 0 && dy === 0) return;
    // GRAB THE SCENE: the sea follows the cursor, as in a street-view panorama
    // and the Water Pro demo. A drag to the left turns the view right, and a
    // drag up tilts it down. (The first build used game-style mouse look, the
    // other way round, and a drag up threw the view into the sky.)
    yaw += dx * LOOK_RAD_PER_PX;
    pitch = Math.max(-PITCH_LIMIT_RAD, Math.min(PITCH_LIMIT_RAD, pitch + dy * LOOK_RAD_PER_PX));
    applyLook();
  };
  const onUp = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    if (dom.hasPointerCapture(e.pointerId)) dom.releasePointerCapture(e.pointerId);
    dom.style.cursor = 'grab';
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    camera.getWorldDirection(fwd);
    const step = speed() * WHEEL_SECONDS * (e.deltaY < 0 ? 1 : -1);
    camera.position.addScaledVector(fwd, step);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (!FLY_KEYS.has(e.code)) return;
    held.add(e.code);
    e.preventDefault();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    held.delete(e.code);
  };
  // A key released while the canvas has no focus would stay held forever.
  const onBlur = () => held.clear();

  dom.addEventListener('pointerdown', onDown);
  dom.addEventListener('pointermove', onMove);
  dom.addEventListener('pointerup', onUp);
  dom.addEventListener('pointercancel', onUp);
  dom.addEventListener('wheel', onWheel, { passive: false });
  dom.addEventListener('keydown', onKeyDown);
  dom.addEventListener('keyup', onKeyUp);
  dom.addEventListener('blur', onBlur);

  syncFromCamera();

  return {
    update(dtS: number) {
      if (held.size === 0) return;
      camera.getWorldDirection(fwd);
      right.crossVectors(fwd, camera.up).normalize();
      move.set(0, 0, 0);
      if (held.has('KeyW')) move.add(fwd);
      if (held.has('KeyS')) move.sub(fwd);
      if (held.has('KeyD')) move.add(right);
      if (held.has('KeyA')) move.sub(right);
      if (held.has('KeyE')) move.y += 1;
      if (held.has('KeyQ')) move.y -= 1;
      if (move.lengthSq() === 0) return;
      // A frame that took long (a tab in the background) must not throw the
      // camera across the sea.
      const dt = Math.min(dtS, 0.1);
      camera.position.addScaledVector(move.normalize(), speed() * dt);
    },
    syncFromCamera,
    dispose() {
      dom.removeEventListener('pointerdown', onDown);
      dom.removeEventListener('pointermove', onMove);
      dom.removeEventListener('pointerup', onUp);
      dom.removeEventListener('pointercancel', onUp);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('keydown', onKeyDown);
      dom.removeEventListener('keyup', onKeyUp);
      dom.removeEventListener('blur', onBlur);
      held.clear();
    },
  };
}
