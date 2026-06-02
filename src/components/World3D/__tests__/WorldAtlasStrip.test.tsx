/**
 * @file WorldAtlasStrip.test.tsx
 * W3DUI-23: always-visible world atlas strip on PLAYING GameLayout.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WorldAtlasStrip from '../WorldAtlasStrip';
import { UI_ID } from '../../../styles/uiIds';
import type { MapData } from '../../../types';

function makeMinimalMapData(): MapData {
  const cols = 4;
  const rows = 2;
  const tiles = Array.from({ length: rows }, (_, y) =>
    Array.from({ length: cols }, (_, x) => ({
      x,
      y,
      biomeId: 'plains',
      discovered: true,
      isPlayerCurrent: false,
    })),
  );
  return {
    gridSize: { cols, rows },
    tiles,
    seed: 1,
  } as MapData;
}

describe('WorldAtlasStrip (W3DUI-23)', () => {
  it('renders nothing when playerWorldPos is null', () => {
    const { container } = render(
      <WorldAtlasStrip
        mapData={makeMinimalMapData()}
        playerWorldPos={null}
        onOpenWorldMap={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders strip and opens world map on click when position is set', () => {
    const onOpenWorldMap = vi.fn();
    render(
      <WorldAtlasStrip
        mapData={makeMinimalMapData()}
        playerWorldPos={{ x: 256, y: 10, z: 128 }}
        onOpenWorldMap={onOpenWorldMap}
      />,
    );

    const strip = screen.getByTestId(UI_ID.WORLD_ATLAS_STRIP);
    expect(strip).toBeInTheDocument();
    fireEvent.click(strip);
    expect(onOpenWorldMap).toHaveBeenCalledTimes(1);
  });
});
