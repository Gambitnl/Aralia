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
  let onGroundPick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onGroundPick = vi.fn();
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
});
