// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LocalArtifact, RegionArtifact } from '../../../systems/worldforge/artifacts';
import WorldforgeGroundDrilldown from '../WorldforgeGroundDrilldown';

/**
 * These tests protect the last step and return path of the Atlas hierarchy.
 *
 * The expensive WebGL scene is replaced with a small marker so this suite can prove that
 * the retained Local artifact reaches the shared loader and that both visible Return and
 * Escape ascend exactly one level without rebuilding the selected place.
 */

// The scene renderer has separate visual coverage; this marker keeps navigation tests
// focused on artifact continuity and ascent behavior.
vi.mock('../../World3D/World3DScene', () => ({
  default: () => <div data-testid="mock-world3d-scene" />,
}));

// The adapter result only needs enough terrain metadata for the component to place its
// camera. Capturing the Local object proves it was passed through by identity.
const { createGroundChunkLoader } = vi.hoisted(() => ({
  createGroundChunkLoader: vi.fn((local: LocalArtifact) => ({
    ground: {
      cols: 2,
      rows: 2,
      extentMetersX: local.bounds.width * 0.3048,
      extentMetersZ: local.bounds.height * 0.3048,
      heights: new Float32Array(4),
    },
    loader: vi.fn(),
  })),
}));
vi.mock('../../../systems/worldforge/bridge/groundChunkLoader', () => ({ createGroundChunkLoader }));
vi.mock('../../../systems/world3d/config', () => ({ heightToMeters: (height: number) => height }));

const region = { seedPath: '42/region:9' } as RegionArtifact;
const local = {
  seedPath: '42/region:9/local:1200,900',
  bounds: { x: 1000, y: 500, width: 3000, height: 3000 },
} as LocalArtifact;
const drilldown = {
  worldSeed: 42,
  atlasCellId: 9,
  regionSeedPath: region.seedPath,
  localSeedPath: local.seedPath,
  localBounds: { ...local.bounds },
  focus: { kind: 'site' as const, id: 7, label: 'Ash Shrine', xFt: 1300, yFt: 1100 },
};

describe('WorldforgeGroundDrilldown navigation', () => {
  it('renders the retained Local artifact and exposes its Atlas provenance', () => {
    render(<WorldforgeGroundDrilldown drilldown={drilldown} local={local} region={region} onAscend={vi.fn()} />);

    expect(createGroundChunkLoader).toHaveBeenCalledWith(local, 42, region);
    expect(screen.getByTestId('mock-world3d-scene')).toBeTruthy();
    expect(screen.getByText('Ash Shrine')).toBeTruthy();
    expect(screen.getByText('1,300, 1,100 ft')).toBeTruthy();
    expect(screen.getByText(/World 42 \/ Cell 9/)).toBeTruthy();
  });

  it('returns one level through both the visible control and Escape', () => {
    const onAscend = vi.fn();
    render(<WorldforgeGroundDrilldown drilldown={drilldown} local={local} region={region} onAscend={onAscend} />);

    fireEvent.click(screen.getByRole('button', { name: /Return to local map/i }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onAscend).toHaveBeenCalledTimes(2);
  });
});
