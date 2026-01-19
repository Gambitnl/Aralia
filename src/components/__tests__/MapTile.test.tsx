import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MapTile from '../MapTile';
import { MapTile as MapTileType, MapMarker } from '../../types';
import { BIOMES } from '../../constants';

// We don't need to mock Tooltip if it's not used, but if it were, we would.
// MapTile currently uses title attribute.

describe('MapTile', () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseTile: MapTileType = {
    x: 0,
    y: 0,
    biomeId: 'plains',
    discovered: true,
    isPlayerCurrent: false,
  };

  const biome = BIOMES['plains'];

  it('renders a discovered tile correctly', () => {
    render(<MapTile tile={baseTile} isFocused={false} onClick={mockOnClick} />);

    const button = screen.getByRole('gridcell');
    expect(button).toBeInTheDocument();

    // Check background color from biome
    expect(button).toHaveStyle({ backgroundColor: biome.rgbaColor });

    // Check icon
    expect(screen.getByText(biome.icon!)).toBeInTheDocument();
  });

  it('renders an undiscovered tile correctly', () => {
    const undiscoveredTile: MapTileType = { ...baseTile, discovered: false };
    render(<MapTile tile={undiscoveredTile} isFocused={false} onClick={mockOnClick} />);

    const button = screen.getByRole('gridcell');

    // Check generic undiscovered styling
    expect(button).toHaveStyle({ backgroundColor: 'rgba(55, 65, 81, 0.7)' });
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('highlights the player location', () => {
    const playerTile: MapTileType = { ...baseTile, isPlayerCurrent: true };
    render(<MapTile tile={playerTile} isFocused={false} onClick={mockOnClick} />);

    // Since the testing environment normalizes colors in style attributes to RGB
    // we match against the RGB value or a regex.
    // Received: "background-color: rgba(234, 179, 8, 0.7); border: 2px solid rgb(251, 191, 36); aspect-ratio: 1 / 1;"

    const button = screen.getByRole('gridcell');
    const styleAttribute = button.getAttribute('style');
    expect(styleAttribute).toMatch(/border:\s*2px\s+solid\s+(rgb\(251,\s*191,\s*36\)|#FBBF24)/);

    expect(screen.getByRole('img', { name: /Player Location/i })).toBeInTheDocument();
  });

  it('handles click events when discovered', () => {
    render(<MapTile tile={baseTile} isFocused={false} onClick={mockOnClick} />);

    fireEvent.click(screen.getByRole('gridcell'));
    expect(mockOnClick).toHaveBeenCalledWith(0, 0, baseTile);
  });

  it('does not trigger click when undiscovered (and not player current)', () => {
    const undiscoveredTile: MapTileType = { ...baseTile, discovered: false };
    render(<MapTile tile={undiscoveredTile} isFocused={false} onClick={mockOnClick} />);

    fireEvent.click(screen.getByRole('gridcell'));
    expect(mockOnClick).not.toHaveBeenCalled();
    expect(screen.getByRole('gridcell')).toBeDisabled();
  });

  it('renders markers correctly', () => {
    const markers: MapMarker[] = [
      {
        id: 'm1',
        coordinates: { x: 0, y: 0 },
        icon: '🏰',
        label: 'Castle',
        isDiscovered: true
      }
    ];

    render(<MapTile tile={baseTile} isFocused={false} markers={markers} onClick={mockOnClick} />);

    expect(screen.getByText('🏰')).toBeInTheDocument();
    expect(screen.getByTitle('Castle')).toBeInTheDocument();
  });

  it('generates correct tooltip for discovered tile', () => {
    render(<MapTile tile={baseTile} isFocused={false} onClick={mockOnClick} />);

    const button = screen.getByRole('gridcell');
    // MapTile uses the title attribute for the tooltip
    expect(button.getAttribute('title')).toContain(`${biome.name} (0, 0)`);
  });
});
