import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MapData } from '@/types/world';
import MapPane from '../MapPane';

// These tests focus on the legacy grid read path because T8 routes MapPane's
// discovery/current marker reads through the World geography adapter while
// preserving the visible tile-grid behavior players already use.

describe('MapPane', () => {
  it('preserves discovered/current tile rendering and click payloads through adapter-backed reads', () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'Legacy Grid' }));

    const grid = screen.getByRole('grid');
    const cells = within(grid).getAllByRole('gridcell');

    expect(cells).toHaveLength(4);
    expect(within(cells[0]).getByRole('img', { name: /Player Location/i })).toBeInTheDocument();
    expect(cells[0]).toHaveAttribute('aria-selected', 'true');
    expect(cells[1]).not.toBeDisabled();
    expect(cells[2]).toBeDisabled();
    expect(cells[2]).toHaveTextContent('?');

    fireEvent.click(cells[1]);

    expect(onTileClick).toHaveBeenCalledWith(
      1,
      0,
      expect.objectContaining({
        x: 1,
        y: 0,
        discovered: true,
        isPlayerCurrent: false,
      }),
    );
    expect(mapData.tiles[0][0].isPlayerCurrent).toBe(true);
    expect(mapData.tiles[1][0].discovered).toBe(false);
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
