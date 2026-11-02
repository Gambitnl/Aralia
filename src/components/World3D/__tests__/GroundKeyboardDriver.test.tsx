/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/components/World3D/__tests__/GroundKeyboardDriver.test.tsx
 *
 * Unit tests for the GroundKeyboardDriver 3D locomotion controller.
 */

import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { GroundKeyboardDriver } from '../useGroundKeyboardControls';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { PlayerCharacter } from '@/types/character';
import type { GroundMovementIntent } from '../groundLocomotion';

const waterHarness = vi.hoisted(() => ({ waterY: undefined as number | undefined }));
vi.mock('@/systems/worldforge/bridge/groundWaterSurfaceQuery', () => ({ inspectGroundWater: () => ({status: 'valid', surfaceY: waterHarness.waterY}) }));

let frameCallback: ((state: any, delta: number) => void) | null = null;
const mockCamera = new THREE.PerspectiveCamera();
mockCamera.position.set(0, 10, 10);
mockCamera.lookAt(0, 0, 0);

const mockControls = {
  target: new THREE.Vector3(0, 0, 0),
  update: vi.fn(),
};

vi.mock('@react-three/fiber', () => ({
  useFrame: (cb: (state: any, delta: number) => void) => {
    frameCallback = cb;
  },
  useThree: () => ({
    camera: mockCamera,
    controls: mockControls,
  }),
}));

describe('GroundKeyboardDriver', () => {
  let onGroundPick: ReturnType<typeof vi.fn<(xM: number, zM: number) => void>>;

  beforeEach(() => {
    waterHarness.waterY = undefined;
    onGroundPick = vi.fn<(xM: number, zM: number) => void>();
    frameCallback = null;
    mockCamera.position.set(0, 10, 10);
    mockControls.target.set(0, 0, 0);
    mockControls.update.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('translates KeyW into forward ground position step and glides camera during useFrame', () => {
    const sceneOrigin = { x: 100, z: 100 };
    const playerGroundPos = { xM: 100, zM: 100 };

    render(
      <GroundKeyboardDriver
        sceneOrigin={sceneOrigin}
        playerGroundPos={playerGroundPos}
        onGroundPick={onGroundPick}
        enabled={true}
      />,
    );

    const initCamZ = mockCamera.position.z;
    const initCtrlZ = mockControls.target.z;

    // Press 'W' key
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }));

    // Simulate render frame with 0.1s delta
    if (frameCallback) {
      frameCallback({ camera: mockCamera }, 0.1);
    }

    // Release 'W' key
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true }));

    expect(onGroundPick).toHaveBeenCalled();
    const lastCall = onGroundPick.mock.calls[onGroundPick.mock.calls.length - 1];
    expect(typeof lastCall[0]).toBe('number');
    expect(typeof lastCall[1]).toBe('number');

    // Camera and controls target must have moved forward in Z
    expect(mockCamera.position.z).not.toBe(initCamZ);
    expect(mockControls.target.z).not.toBe(initCtrlZ);
    expect(mockControls.update).toHaveBeenCalled();
  });

  it('takes over at the actual body instead of an unfinished click destination', () => {
    const actual = { xM: 100, zM: 100, yM: 3.2 };
    render(<GroundKeyboardDriver sceneOrigin={{ x: 100, z: 100 }} playerGroundPos={{ xM: 180, zM: 180 }}
      getFootfall={() => actual} onGroundPick={onGroundPick} />);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    frameCallback!({ camera: mockCamera }, .1);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
    const [x, z] = onGroundPick.mock.calls.at(-1)!;
    expect(Math.hypot(x - actual.xM, z - actual.zM)).toBeCloseTo(.1524);
    expect(Math.hypot(x - 180, z - 180)).toBeGreaterThan(100);
  });

  it('does not advance the camera for a keyboard destination the body has not reached', () => {
    const actual = {xM: 100, zM: 100, yM: 0};
    render(<GroundKeyboardDriver sceneOrigin={{x: 100, z: 100}} playerGroundPos={actual}
      getFootfall={() => actual} onGroundPick={onGroundPick} />);
    frameCallback!({}, .1);
    window.dispatchEvent(new KeyboardEvent('keydown', {code: 'KeyW'}));
    frameCallback!({}, .1);
    expect(onGroundPick).toHaveBeenCalled();
    expect(mockCamera.position.toArray()).toEqual([0, 10, 10]);
    expect(mockControls.target.toArray()).toEqual([0, 0, 0]);
    window.dispatchEvent(new KeyboardEvent('keyup', {code: 'KeyW'}));
  });

  it('follows real settling footfalls after key release and hands camera control back on pointer input', () => {
    const actual = {xM: 100, zM: 100, yM: 0};
    render(<GroundKeyboardDriver sceneOrigin={{x: 100, z: 100}} playerGroundPos={actual}
      getFootfall={() => actual} onGroundPick={onGroundPick} />);
    frameCallback!({}, .1);
    window.dispatchEvent(new KeyboardEvent('keydown', {code: 'KeyW'})); frameCallback!({}, .1);
    window.dispatchEvent(new KeyboardEvent('keyup', {code: 'KeyW'}));
    actual.zM -= .08; frameCallback!({}, .1);
    expect(mockCamera.position.z).toBeCloseTo(9.92);
    expect(mockControls.target.z).toBeCloseTo(-.08);
    window.dispatchEvent(new Event('pointerdown'));
    actual.zM -= .03; frameCallback!({}, .1);
    expect(mockCamera.position.z).toBeCloseTo(9.92);
    expect(mockControls.target.z).toBeCloseTo(-.08);
  });

  it('ignores keyboard movement if disabled', () => {
    const sceneOrigin = { x: 100, z: 100 };
    const playerGroundPos = { xM: 100, zM: 100 };

    render(
      <GroundKeyboardDriver
        sceneOrigin={sceneOrigin}
        playerGroundPos={playerGroundPos}
        onGroundPick={onGroundPick}
        enabled={false}
      />,
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }));
    if (frameCallback) {
      frameCallback({ camera: mockCamera }, 0.1);
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true }));

    expect(onGroundPick).not.toHaveBeenCalled();
  });

  it('shares Shift-click intent, uses character speed, and clears it on blur and unmount', () => {
    const movementIntent = { sprinting: false };
    const view = render(<GroundKeyboardDriver sceneOrigin={{ x: 100, z: 100 }}
      playerGroundPos={{ xM: 100, zM: 100 }} character={{ speed: 20 } as PlayerCharacter}
      movementIntent={movementIntent} onGroundPick={onGroundPick} />);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft', shiftKey: true }));
    expect(movementIntent.sprinting).toBe(true);
    frameCallback!({}, .1);
    expect(onGroundPick).not.toHaveBeenCalled();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', shiftKey: true }));
    frameCallback!({}, 2);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', shiftKey: true }));
    const [x, z] = onGroundPick.mock.calls.at(-1)!;
    expect(Math.hypot(x - 100, z - 100)).toBeCloseTo(.2032);
    expect(movementIntent.sprinting).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ShiftLeft', shiftKey: true }));
    expect(movementIntent.sprinting).toBe(true); // The other Shift can still be held.
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ShiftRight' }));
    expect(movementIntent.sprinting).toBe(false);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft' }));
    window.dispatchEvent(new Event('blur'));
    expect(movementIntent.sprinting).toBe(false);
    const count = onGroundPick.mock.calls.length;
    frameCallback!({}, 1);
    expect(onGroundPick).toHaveBeenCalledTimes(count);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft' }));
    view.unmount();
    expect(movementIntent.sprinting).toBe(false);
  });

  it('does not move a zero-speed character even when Shift is held', () => {
    render(<GroundKeyboardDriver sceneOrigin={{ x: 100, z: 100 }} playerGroundPos={{ xM: 100, zM: 100 }}
      character={{ speed: 0 } as PlayerCharacter} onGroundPick={onGroundPick} />);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    frameCallback!({}, 1);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
    expect(onGroundPick.mock.calls.at(-1)).toEqual([100, 100]);
    expect(mockCamera.position.toArray()).toEqual([0, 10, 10]);
  });

  it('stops keyboard position and camera together at the canonical wall', () => {
    mockCamera.lookAt(0, 0, 0);
    const ground = { rivers: [], cols: 1, rows: 1, heights: [0], extentMetersX: 200, extentMetersZ: 200,
      buildings: [{ xM: 100, zM: 100,
        cornersM: [{ x: 95, z: 95 }, { x: 105, z: 95 }, { x: 105, z: 105 }, { x: 95, z: 105 }],
        parts: [{ x: 0, z: 0, w: 8, d: 0.1, h: 3, colorHex: '#cfc7b8' }],
      }] } as unknown as GroundWorld;
    render(<GroundKeyboardDriver groundWorld={ground} sceneOrigin={{ x: 100, z: 100 }} playerGroundPos={{ xM: 100, zM: 100.5 }} onGroundPick={onGroundPick} />);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    for (let i = 0; i < 8; i++) frameCallback!({ camera: mockCamera }, 0.1);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
    const lastCall = onGroundPick.mock.calls.at(-1)!;
    expect(lastCall[1]).toBeCloseTo(100.351);
    expect(mockCamera.position.z).toBeCloseTo(10 - (100.5 - lastCall[1]));
    expect(mockControls.target.z).toBeCloseTo(-(100.5 - lastCall[1]));
  });

  it('does not use a terrain fallback to move an unsupported accepted footfall', () => {
    const ground = { rivers: [], cols: 1, rows: 1, heights: [0], buildings: [],
      extentMetersX: 200, extentMetersZ: 200 } as unknown as GroundWorld;
    const yM = 6.166488720703125;
    render(<GroundKeyboardDriver groundWorld={ground} sceneOrigin={{ x: 100, z: 100 }}
      playerGroundPos={{ xM: 100, zM: 100, yM }}
      getFootfall={() => ({ xM: 100, zM: 100, yM })} onGroundPick={onGroundPick} />);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    for (let i = 0; i < 8; i++) frameCallback!({}, .1);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
    expect(onGroundPick.mock.calls.at(-1)).toEqual([100, 100]);
    expect(mockCamera.position.toArray()).toEqual([0, 10, 10]);
    expect(mockControls.target.toArray()).toEqual([0, 0, 0]);
  });

  it('shares the body-owned profile and spends the same grounded wading budget as click movement', () => {
    waterHarness.waterY = 1.3;
    const ground = { rivers: [], cols: 1, rows: 1, heights: [0], buildings: [], extentMetersX: 48, extentMetersZ: 48 } as unknown as GroundWorld;
    const movementIntent: GroundMovementIntent = { sprinting: false, waterProfile: { mouthHeightM: 1.55 } };
    render(<GroundKeyboardDriver groundWorld={ground} sceneOrigin={{ x: 20, z: 10 }} playerGroundPos={{ xM: 20, zM: 10, yM: 0 }} movementIntent={movementIntent} onGroundPick={onGroundPick} />);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    frameCallback!({}, .1);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
    expect(onGroundPick.mock.calls.at(-1)).toEqual([20, expect.closeTo(10 - .0762, 5)]);
    expect(movementIntent.waterIssue).toBeUndefined();
  });
});
