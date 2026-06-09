/**
 * @file World3DNameplates.test.tsx
 * Verifies the distance and LOD gates for in-3D site labels.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PlayerWorldPosition } from '../../../types';
import type { LoadedChunk } from '@/systems/world3d/types';
import type { SceneOrigin } from '@/systems/world3d/sceneOrigin';
import World3DNameplates from '../World3DNameplates';

vi.mock('@react-three/drei', () => ({
  Html: ({ children, style, 'data-kind': kind, 'data-testid': testId }: any) => (
    <div data-kind={kind} data-testid={testId} style={style}>
      {children}
    </div>
  ),
}));

function makeSiteData(override: Partial<LoadedChunk['bundle']['sites'][number]> = {}) {
  return {
    id: 'site-1',
    kind: 'town' as const,
    localX: 0,
    localZ: 0,
    surfaceY: 20,
    radius: 12,
    population: 900,
    walled: false,
    ...override,
  };
}

function makeChunk(
  cx: number,
  cy: number,
  lod: LoadedChunk['lod'],
  sites: LoadedChunk['bundle']['sites'],
): LoadedChunk {
  return {
    cx,
    cy,
    lod,
    bundle: {
      cx,
      cy,
      terrain: {
        positions: new Float32Array(0),
        indices: new Uint32Array(0),
        normals: new Float32Array(0),
        colors: new Float32Array(0),
      },
      sites,
    },
  };
}

const sceneOrigin: SceneOrigin = { x: 0, z: 0 };
const playerPos: PlayerWorldPosition = { x: 64, y: 0, z: 64 };

describe('World3DNameplates', () => {
  it('shows labels only for supported LOD tiers', () => {
    const loaded: LoadedChunk[] = [
      makeChunk(0, 0, 'full', [makeSiteData({ id: 'full-town', kind: 'town', localX: 64, localZ: 64 })]),
      makeChunk(0, 1, 'mid', [makeSiteData({ id: 'mid-dungeon', kind: 'dungeon', localX: 64, localZ: 192 })]),
      makeChunk(1, 1, 'low', [makeSiteData({ id: 'low-ruin', kind: 'ruin', localX: 64, localZ: 64 })]),
    ];

    render(
      <World3DNameplates
        loaded={loaded}
        sceneOrigin={sceneOrigin}
        playerWorldPos={playerPos}
      />,
    );

    expect(screen.getByText('Town - full-town')).toBeInTheDocument();
    expect(screen.getByText('Dungeon - mid-dungeon')).toBeInTheDocument();
    expect(screen.queryByText('Ruin - low-ruin')).not.toBeInTheDocument();
  });

  it('respects distance and max visible count gates', () => {
    const loaded: LoadedChunk[] = [
      makeChunk(0, 0, 'full', [
        makeSiteData({ id: 'near-1', localX: 64, localZ: 64 }),
        makeSiteData({ id: 'near-2', localX: 128, localZ: 64 }),
      ]),
      makeChunk(0, 1, 'full', [makeSiteData({ id: 'far-1', localX: 1024, localZ: 1024 })]),
    ];

    render(
      <World3DNameplates
        loaded={loaded}
        sceneOrigin={sceneOrigin}
        playerWorldPos={playerPos}
        maxWorldDistance={400}
        maxVisible={1}
      />,
    );

    expect(screen.getByText('Town - near-1')).toBeInTheDocument();
    expect(screen.queryByText('Town - near-2')).not.toBeInTheDocument();
    expect(screen.queryByText('Town - far-1')).not.toBeInTheDocument();
  });
});
