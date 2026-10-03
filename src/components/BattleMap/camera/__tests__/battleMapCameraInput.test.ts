/**
 * This file proves the 3D camera and tile input gestures do not overlap.
 * It covers the exact regression where left drag ended as actor movement.
 */

import { describe, expect, it } from 'vitest';
import { MOUSE } from 'three';
import {
  BATTLE_MAP_CAMERA_GESTURES,
  BATTLE_MAP_CAMERA_MOUSE_BUTTONS,
  createTilePointerGestureGuard,
} from '../battleMapCameraInput';

describe('battleMapCameraInput', () => {
  it('documents middle pan, right orbit, wheel zoom, and no left camera binding', () => {
    expect(BATTLE_MAP_CAMERA_MOUSE_BUTTONS).toEqual({
      LEFT: -1,
      MIDDLE: MOUSE.PAN,
      RIGHT: MOUSE.ROTATE,
    });
    expect(BATTLE_MAP_CAMERA_GESTURES).toEqual({
      pan: 'middle-drag',
      orbit: 'right-drag',
      zoom: 'wheel',
    });
  });

  it('allows a stationary left click but consumes a left drag before movement', () => {
    const guard = createTilePointerGestureGuard(4);

    guard.begin({ button: 0, clientX: 20, clientY: 20 });
    guard.end({ button: 0, clientX: 20, clientY: 20 });
    expect(guard.consumeClick()).toBe(true);

    guard.begin({ button: 0, clientX: 20, clientY: 20 });
    guard.move({ button: 0, clientX: 32, clientY: 26 });
    guard.end({ button: 0, clientX: 32, clientY: 26 });
    expect(guard.consumeClick()).toBe(false);
    expect(guard.consumeClick()).toBe(true);
  });

  it('does not let middle-drag camera panning suppress a later left click', () => {
    const guard = createTilePointerGestureGuard();
    guard.begin({ button: 1, clientX: 5, clientY: 5 });
    guard.move({ button: 1, clientX: 50, clientY: 50 });
    guard.end({ button: 1, clientX: 50, clientY: 50 });
    expect(guard.consumeClick()).toBe(true);
  });
});
