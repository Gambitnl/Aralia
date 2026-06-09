/**
 * @file World3DScene.lifecycle.test.tsx
 * @description Focused lifecycle proof for the streamed 3D scene shell. It keeps the
 * container visibly sized, verifies the camera/origin wiring on mount, and confirms the
 * first streaming update renders loaded chunk content into the scene. The streamer itself
 * still has a separate StrictMode regression test in useChunkStreaming.test.tsx.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import World3DScene from '../World3DScene';
import type { ChunkLoader } from '@/systems/world3d/types';

const mockUpdate = vi.fn();
const mockOnChunkUpdate = vi.fn();
let lastCanvasDomElement: { addEventListener: ReturnType<typeof vi.fn> } | null = null;

// Mock the R3F canvas so the scene can be tested in JSDOM without a WebGL context.
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children, camera, onCreated }: any) => {
    React.useEffect(() => {
      const domElement = { addEventListener: vi.fn() };
      lastCanvasDomElement = domElement;
      onCreated?.({ gl: { domElement } });
    }, [onCreated]);

    return (
      <div data-testid="world3d-canvas" data-camera-position={JSON.stringify(camera.position)}>
        {children}
      </div>
    );
  },
}));

vi.mock('@react-three/drei', () => ({
  Html: ({ children }: any) => <div>{children}</div>,
}));

// The scene owns mount/camera wiring; the streamer is replaced with a deterministic hook
// result so this proof stays fast and non-flaky while the separate hook test covers lifecycle.
vi.mock('../useChunkStreaming', () => ({
  useChunkStreaming: () => ({
    loaded: [
      {
        cx: 4,
        cy: 2,
        lod: 'full',
        bundle: {
          cx: 4,
          cy: 2,
          terrain: {
            positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]),
            indices: new Uint32Array([0, 1, 2]),
            normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]),
            colors: new Float32Array([1, 1, 1, 1, 1, 1, 1, 1, 1]),
          },
          water: undefined,
          roads: undefined,
          sites: [
            {
              id: 'town-4-2',
              kind: 'town',
              localX: 8,
              localZ: 12,
              surfaceY: 16,
              radius: 6,
              population: 120,
              walled: false,
            },
          ],
          vegetation: undefined,
        },
      },
    ],
    update: mockUpdate,
    pendingCount: 0,
  }),
}));

// The real controller is R3F-aware, so the test substitutes a minimal shell that exposes the
// props we care about without pulling in frame-loop machinery.
vi.mock('../FreeRoamCameraController', () => ({
  default: ({ initialTarget, sceneOrigin, onPositionChange }: any) => (
    <div
      data-testid="camera-controller"
      data-has-on-position-change={String(typeof onPositionChange === 'function')}
      data-initial-target={JSON.stringify(initialTarget)}
      data-scene-origin={JSON.stringify(sceneOrigin)}
    />
  ),
}));

const makeLoader = (): ChunkLoader =>
  async () => ({
    cx: 4,
    cy: 2,
    terrain: {
      positions: new Float32Array(0),
      indices: new Uint32Array(0),
      normals: new Float32Array(0),
      colors: new Float32Array(0),
    },
    sites: [],
  });

describe('World3DScene lifecycle proof', () => {
  beforeEach(() => {
    mockUpdate.mockClear();
    mockOnChunkUpdate.mockClear();
    lastCanvasDomElement = null;
  });

  it('keeps the shell visible, wires the mount update, and renders loaded chunk content', async () => {
    const { container } = render(
      <World3DScene
        loader={makeLoader()}
        start={[512, 40, 256]}
        startSurfaceY={40}
        onChunkUpdate={mockOnChunkUpdate}
      />,
    );

    // The wrapper height is part of the blank-render defense: if this collapses, the scene can
    // still mount but remain effectively invisible.
    const shell = container.firstElementChild as HTMLElement;
    expect(shell.style.height).toBe('78vh');
    expect(shell.style.minHeight).toBe('520px');

    // The camera shell and scene origin are the mount-time values the renderer needs to keep the
    // world anchored around the player instead of drifting or pointing at empty space.
    expect(screen.getByTestId('world3d-canvas')).toHaveAttribute(
      'data-camera-position',
      JSON.stringify([380, 300, 380]),
    );
    expect(screen.getByTestId('camera-controller')).toHaveAttribute(
      'data-initial-target',
      JSON.stringify([0, 40, 0]),
    );
    expect(screen.getByTestId('camera-controller')).toHaveAttribute(
      'data-scene-origin',
      JSON.stringify({ x: 512, z: 256 }),
    );
    expect(screen.getByTestId('camera-controller')).toHaveAttribute(
      'data-has-on-position-change',
      'true',
    );

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(512, 256));
    await waitFor(() => expect(mockOnChunkUpdate).toHaveBeenCalledWith(1));
    await waitFor(() => expect(lastCanvasDomElement).not.toBeNull());

    // A loaded chunk should become actual scene content, not just an empty canvas shell.
    expect(container.querySelector('mesh')).not.toBeNull();
    expect(lastCanvasDomElement?.addEventListener).toHaveBeenCalledWith(
      'webglcontextlost',
      expect.any(Function),
      false,
    );
    expect(lastCanvasDomElement?.addEventListener).toHaveBeenCalledWith(
      'webglcontextrestored',
      expect.any(Function),
      false,
    );
  });
});
