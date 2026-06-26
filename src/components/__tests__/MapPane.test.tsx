import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MapData } from '@/types/world';
import MapPane from '../MapPane';

// These tests protect the first legacy-world-map deprecation slice.
// The gameplay state still uses MapData tiles for travel/discovery, but the
// player-facing MapPane should no longer expose the old square grid renderer.

describe('MapPane', () => {
  it('renders the native Worldforge atlas as the sole map (no legacy grid, no Azgaar iframe)', () => {
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

    // Worldforge is the sole cartography system (the Azgaar iframe was retired).
    expect(screen.getByTestId('worldforge-map-viewport')).toBeInTheDocument();
    expect(screen.queryByTitle('Azgaar World Atlas')).not.toBeInTheDocument();
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    expect(onTileClick).not.toHaveBeenCalled();
  });

  it('exposes a sea-preference toggle in travel mode', async () => {
    const onTileClick = vi.fn();
    const onClose = vi.fn();
    const mapData = createMapData();

    render(
      <MapPane
        mapData={mapData}
        onTileClick={onTileClick}
        onClose={onClose}
        allowTravel
      />,
    );

    const seaPreference = await screen.findByTestId('travel-sea-pref');
    expect(seaPreference).toHaveValue('none');
  });

  it('keeps island-harbor generation default-off but exposes an explicit proof opt-in', () => {
    const onTileClick = vi.fn();
    const onClose = vi.fn();
    const mapData = createMapData();

    const { rerender } = render(
      <MapPane
        mapData={mapData}
        onTileClick={onTileClick}
        onClose={onClose}
        allowTravel
      />,
    );

    expect(screen.getByTestId('worldforge-map-viewport')).toHaveAttribute(
      'data-island-harbors-enabled',
      'false',
    );

    rerender(
      <MapPane
        mapData={mapData}
        onTileClick={onTileClick}
        onClose={onClose}
        allowTravel
        enableIslandHarbors
      />,
    );

    expect(screen.getByTestId('worldforge-map-viewport')).toHaveAttribute(
      'data-island-harbors-enabled',
      'true',
    );
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
