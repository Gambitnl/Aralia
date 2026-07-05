/**
 * @file World3DNameplates.test.tsx
 * Verifies the distance and LOD gates for in-3D site labels.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PlayerWorldPosition } from '../../../types';
import type { LoadedChunk } from '@/systems/world3d/types';
import type { SceneOrigin } from '@/systems/world3d/sceneOrigin';
import World3DNameplates, { makeNameplates } from '../World3DNameplates';

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
      makeChunk(0, 0, 'full', [makeSiteData({ id: 'full-town', kind: 'town', localX: 96, localZ: 64 })]),
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
        makeSiteData({ id: 'near-1', localX: 96, localZ: 64 }),
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

  it('uses explicit site names and keeps the fallback for unnamed sites', () => {
    const loaded: LoadedChunk[] = [
      makeChunk(0, 0, 'full', [
        makeSiteData({ id: 'named-occupant', kind: 'landmark', localX: 96, localZ: 64, name: 'Mara Fen' }),
        makeSiteData({ id: 'plain-town', kind: 'town', localX: 96, localZ: 96 }),
      ]),
    ];

    const labels = makeNameplates(loaded, sceneOrigin, playerPos, {
      allowedLods: ['full', 'mid'],
      maxWorldDistance: 400,
      maxVisible: 12,
    });

    expect(labels.map((label) => label.text)).toEqual([
      'Mara Fen',
      'Town - plain-town',
    ]);
  });

  it('uses per-site label ranges before the global distance gate', () => {
    const loaded: LoadedChunk[] = [
      makeChunk(0, 0, 'full', [
        // markerOnly = occupant-style plates, exempt from the 15 m near-hide.
        makeSiteData({ id: 'inside-site-range', localX: 70, localZ: 64, labelRangeM: 12, markerOnly: true }),
        makeSiteData({ id: 'outside-site-range', localX: 90, localZ: 64, labelRangeM: 12, markerOnly: true }),
        makeSiteData({ id: 'plain-global-range', localX: 90, localZ: 64 }),
      ]),
    ];

    const labels = makeNameplates(loaded, sceneOrigin, playerPos, {
      allowedLods: ['full', 'mid'],
      maxWorldDistance: 400,
      maxVisible: 12,
    });

    expect(labels.map((label) => label.text)).toEqual([
      'Town - inside-site-range',
      'Town - plain-global-range',
    ]);
  });

  it('anchors building labels above their roof clearance while plain sites keep radius height', () => {
    const loaded: LoadedChunk[] = [
      makeChunk(0, 0, 'full', [
        makeSiteData({
          id: 'enterable-building',
          localX: 96,
          localZ: 64,
          radius: 30,
          surfaceY: 5,
          boxHeight: 4,
        }),
        makeSiteData({
          id: 'plain-town',
          localX: 96,
          localZ: 96,
          radius: 12,
          surfaceY: 20,
        }),
      ]),
    ];

    const labels = makeNameplates(loaded, sceneOrigin, playerPos, {
      allowedLods: ['full', 'mid'],
      maxWorldDistance: 400,
      maxVisible: 12,
    });

    expect(labels.find((label) => label.text === 'Town - enterable-building')?.position[1]).toBe(12.5);
    expect(labels.find((label) => label.text === 'Town - plain-town')?.position[1]).toBe(32);
  });

  it('hides building plates inside the near gate but keeps occupant/hostile plates', () => {
    const loaded: LoadedChunk[] = [
      makeChunk(0, 0, 'full', [
        makeSiteData({ id: 'too-close-building', localX: 70, localZ: 64 }), // 6 m
        makeSiteData({ id: 'close-occupant', kind: 'landmark', localX: 70, localZ: 70, markerOnly: true, name: 'Keeper' }),
        makeSiteData({ id: 'close-hostile', kind: 'monster', localX: 60, localZ: 60, name: 'Wolf' }),
      ]),
    ];
    const labels = makeNameplates(loaded, sceneOrigin, playerPos, {
      allowedLods: ['full', 'mid'],
      maxWorldDistance: 400,
      maxVisible: 12,
    });
    const texts = labels.map((l) => l.text);
    expect(texts).not.toContain('Town - too-close-building');
    expect(texts).toContain('Keeper');
    expect(texts).toContain('Wolf');
  });

  it('declutters clustered plates: only the nearest of a tight business row shows', () => {
    const loaded: LoadedChunk[] = [
      makeChunk(0, 0, 'full', [
        makeSiteData({ id: 'row-a', localX: 96, localZ: 64 }), // 32 m — nearest
        makeSiteData({ id: 'row-b', localX: 104, localZ: 64 }), // 8 m from row-a → decluttered
        makeSiteData({ id: 'row-c', localX: 100, localZ: 70 }), // also inside separation → decluttered
        makeSiteData({ id: 'apart', localX: 96, localZ: 128 }), // 64 m away, keeps its plate
      ]),
    ];
    const labels = makeNameplates(loaded, sceneOrigin, playerPos, {
      allowedLods: ['full', 'mid'],
      maxWorldDistance: 400,
      maxVisible: 12,
    });
    expect(labels.map((l) => l.text)).toEqual(['Town - row-a', 'Town - apart']);
  });

  it('fades plates near the edge of their range', () => {
    const loaded: LoadedChunk[] = [
      makeChunk(0, 0, 'full', [
        makeSiteData({ id: 'mid-range', localX: 96, localZ: 64 }), // 32 m of 400 → fully opaque
        makeSiteData({ id: 'edge-range', localX: 64 + 390, localZ: 64 }), // 390 m of 400 → faded
      ]),
    ];
    const labels = makeNameplates(loaded, sceneOrigin, playerPos, {
      allowedLods: ['full', 'mid'],
      maxWorldDistance: 400,
      maxVisible: 12,
    });
    const mid = labels.find((l) => l.text === 'Town - mid-range');
    const edge = labels.find((l) => l.text === 'Town - edge-range');
    expect(mid?.opacity).toBe(1);
    expect(edge?.opacity).toBeLessThan(0.2);
    expect(edge?.opacity).toBeGreaterThan(0);
  });
});
