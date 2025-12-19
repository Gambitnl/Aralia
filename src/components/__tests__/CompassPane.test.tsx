import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CompassPane from '../CompassPane';
import { Location } from '../../types';

// Mock dependencies
vi.mock('@/utils/timeUtils', () => ({
  formatGameTime: vi.fn(() => '12:00 PM'),
  getGameDay: vi.fn(() => 1),
  getSeason: vi.fn(() => 'Winter'),
  getGameEpoch: vi.fn(() => new Date(Date.UTC(351, 0, 1))),
  addGameTime: vi.fn((date) => date), // Mock addGameTime to return same date
}));

vi.mock('@/systems/time/CalendarSystem', () => ({
  getCalendarDescription: vi.fn(() => 'It is Deepwinter, 351 (Winter). Moon: Waxing Crescent.'),
}));

describe('CompassPane', () => {
  const mockLocation: Location = {
    id: 'loc1',
    name: 'Test Location',
    baseDescription: 'A test location.',
    exits: {},
    mapCoordinates: { x: 0, y: 0 },
    biomeId: 'plains',
  };

  const defaultProps = {
    currentLocation: mockLocation,
    currentSubMapCoordinates: null,
    worldMapCoords: { x: 0, y: 0 },
    subMapCoords: null,
    onAction: vi.fn(),
    disabled: false,
    mapData: null,
    gameTime: new Date(Date.UTC(351, 0, 1, 12, 0, 0)),
  };

  it('renders time with season', () => {
    render(<CompassPane {...defaultProps} />);
    expect(screen.getByText(/Day 1 \(Winter\)/)).toBeInTheDocument();
  });
});
