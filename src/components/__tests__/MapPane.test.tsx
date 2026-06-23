import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MapData } from '@/types/world';
import MapPane from '../MapPane';

// These tests protect the first legacy-world-map deprecation slice.
// The gameplay state still uses MapData tiles for travel/discovery, but the
// player-facing MapPane should no longer expose the old square grid renderer.

describe('MapPane', () => {
  it('hides the legacy grid view control while keeping the atlas controls available', () => {
    const onTileClick = vi.fn();
    const onClose = vi.fn();
    const mapData = createMapData();

    render(
      <MapPane
        mapData={mapData}
        onTileClick={onTileClick}
        onClose={onClose}
        allowTravel={false}
      />,
    );

    expect(screen.getByRole('button', { name: 'Azgaar Atlas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'World Forge' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Legacy Grid' })).not.toBeInTheDocument();
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    expect(onTileClick).not.toHaveBeenCalled();
  });

  it('keeps atlas mode active when the embedded atlas reports a load error', async () => {
    const onTileClick = vi.fn();
    const onClose = vi.fn();
    const mapData = createMapData();

    render(
      <MapPane
        mapData={mapData}
        onTileClick={onTileClick}
        onClose={onClose}
        allowTravel={false}
      />,
    );

    fireEvent.error(screen.getByTitle('Azgaar World Atlas'));

    expect(screen.getByTitle('Azgaar World Atlas')).toBeInTheDocument();
    expect(await screen.findByText('Azgaar world map could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });
});

function createMapData(): MapData {
  return {
    gridSize: { rows: 2, cols: 2 },
    tiles: [
      [
        {
          x: 0,
          y: 0,
          biomeId: 'plains',
          discovered: true,
          isPlayerCurrent: true,
        },
        {
          x: 1,
          y: 0,
          biomeId: 'forest',
          discovered: true,
          isPlayerCurrent: false,
        },
      ],
      [
        {
          x: 0,
          y: 1,
          biomeId: 'water',
          discovered: false,
          isPlayerCurrent: false,
        },
        {
          x: 1,
          y: 1,
          biomeId: 'mountains',
          discovered: false,
          isPlayerCurrent: false,
        },
      ],
    ],
  };
}
