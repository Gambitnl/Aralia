
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CompassPane from '../CompassPane';
import { Location, MapData } from '../../types';
import { DIRECTION_VECTORS } from '../../config/mapConfig';
import { getGameEpoch } from '../../utils/timeUtils';

// Mock Tooltip since we are not testing it here
vi.mock('../Tooltip', () => ({
  default: ({ children, content }: { children: React.ReactNode; content: string }) => (
    <div title={content}>{children}</div>
  ),
}));

// Mock PassTimeModal
vi.mock('../PassTimeModal', () => ({
  default: ({ isOpen, onConfirm, currentTime }: { isOpen: boolean, onConfirm: (s: number) => void, currentTime: Date }) => (
    isOpen ? <div data-testid="pass-time-modal">
        <button onClick={() => onConfirm(3600)}>Confirm Pass Time</button>
        <span>{currentTime.toISOString()}</span>
    </div> : null
  ),
}));

const mockLocation: Location = {
  id: 'loc1',
  name: 'Test Location',
  description: 'A test location',
  baseDescription: 'A test location',
  mapCoordinates: { x: 5, y: 5 },
  biomeId: 'plains',
  type: 'wilderness',
  x: 5,
  y: 5
};

const mockMapData: MapData = {
  gridSize: { rows: 10, cols: 10 },
  tiles: [],
  subMaps: {},
  startingLocationId: 'loc1',
};

describe('CompassPane', () => {
  const onAction = vi.fn();
  const gameTime = new Date(getGameEpoch().getTime() + 1000 * 60 * 60 * 24); // Day 2

  it('renders compass points', () => {
    render(
      <CompassPane
        currentLocation={mockLocation}
        currentSubMapCoordinates={null}
        worldMapCoords={{ x: 5, y: 5 }}
        subMapCoords={null}
        onAction={onAction}
        disabled={false}
        mapData={mockMapData}
        gameTime={gameTime}
      />
    );

    expect(screen.getByText('N')).toBeInTheDocument();
    expect(screen.getByText('S')).toBeInTheDocument();
    expect(screen.getByText('E')).toBeInTheDocument();
    expect(screen.getByText('W')).toBeInTheDocument();
    expect(screen.getByText('◎')).toBeInTheDocument();
  });

  it('displays correct game time', () => {
    render(
      <CompassPane
        currentLocation={mockLocation}
        currentSubMapCoordinates={null}
        worldMapCoords={{ x: 5, y: 5 }}
        subMapCoords={null}
        onAction={onAction}
        disabled={false}
        mapData={mockMapData}
        gameTime={gameTime}
      />
    );

    // Day 2, 00:00:00
    // The format depends on locale, but checking for "Day 2" is safe
    expect(screen.getByText(/Day 2/)).toBeInTheDocument();
  });

  it('opens pass time modal when button clicked', () => {
    render(
      <CompassPane
        currentLocation={mockLocation}
        currentSubMapCoordinates={null}
        worldMapCoords={{ x: 5, y: 5 }}
        subMapCoords={null}
        onAction={onAction}
        disabled={false}
        mapData={mockMapData}
        gameTime={gameTime}
      />
    );

    const passTimeButton = screen.getByLabelText('Pass Time');
    fireEvent.click(passTimeButton);

    expect(screen.getByTestId('pass-time-modal')).toBeInTheDocument();
  });

  it('calls onAction when time passed', () => {
      render(
        <CompassPane
          currentLocation={mockLocation}
          currentSubMapCoordinates={null}
          worldMapCoords={{ x: 5, y: 5 }}
          subMapCoords={null}
          onAction={onAction}
          disabled={false}
          mapData={mockMapData}
          gameTime={gameTime}
        />
      );

      const passTimeButton = screen.getByLabelText('Pass Time');
      fireEvent.click(passTimeButton);

      const confirmButton = screen.getByText('Confirm Pass Time');
      fireEvent.click(confirmButton);

      expect(onAction).toHaveBeenCalledWith({ type: 'wait', label: 'Pass time', payload: { seconds: 3600 } });
  });
});
