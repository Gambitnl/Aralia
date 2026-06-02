/**
 * @file World3DMinimap.test.tsx
 * Deferred Plan 4 UX: in-3D minimap overlay rendered inside InWorldHUD.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import World3DMinimap from '../World3DMinimap';
import type { WorldData } from '../../../services/worldSim/types';

function makeMinimalWorldData(): WorldData {
  const cols = 4;
  const rows = 2;
  const cells = cols * rows;
  return {
    version: 2,
    seed: 1,
    templateId: 'test',
    gridSize: { cols, rows },
    heights: Array.from({ length: cells }, () => 0.5),
    temperatures: Array.from({ length: cells }, () => 0),
    moisture: Array.from({ length: cells }, () => 0),
    biomeIds: Array.from({ length: cells }, () => 'plains_meadow'),
    rivers: [],
    roads: [],
    sites: [],
    coastlines: [],
    lakes: [],
    biomeZones: [],
  };
}

describe('World3DMinimap (Plan 4 deferred UX)', () => {
  it('renders nothing when playerWorldPos is null', () => {
    const { container } = render(
      <World3DMinimap worldData={makeMinimalWorldData()} playerWorldPos={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when worldData is null', () => {
    const { container } = render(
      <World3DMinimap worldData={null} playerWorldPos={{ x: 10, y: 1, z: 10 }} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the minimap when both worldData and position are present', () => {
    render(
      <World3DMinimap
        worldData={makeMinimalWorldData()}
        playerWorldPos={{ x: 128, y: 5, z: 64 }}
      />,
    );
    expect(screen.getByTestId('world-3d-minimap')).toBeInTheDocument();
  });
});
