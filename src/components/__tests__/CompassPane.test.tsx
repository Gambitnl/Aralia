import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CompassPane from '../CompassPane';
import { Location } from '../../types';

// Mock dependencies
vi.mock('@/utils/timeUtils', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    formatGameTime: vi.fn(() => '12:00 PM'),
    getGameDay: vi.fn(() => 1),
    getSeason: vi.fn(() => 'Winter'),
    getTimeOfDay: vi.fn(() => 'Day'),
    getTimeModifiers: vi.fn(() => ({ description: 'Mock Description', travelCostMultiplier: 1, visionModifier: 1 })),
    getGameEpoch: vi.fn(() => new Date(Date.UTC(351, 0, 1))),
    addGameTime: vi.fn((date) => date),
  };
});

vi.mock('@/systems/time/CalendarSystem', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        getCalendarDescription: vi.fn(() => 'It is Deepwinter, 351 (Winter). Moon: Waxing Crescent.'),
        getMoonPhase: vi.fn(() => 'Waxing Crescent'),
        getHoliday: vi.fn(() => null),
        getMonthName: vi.fn(() => 'Deepwinter'),
    }
});

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

  it('renders time widget elements', () => {
    render(<CompassPane {...defaultProps} />);
    // Check for TimeWidget elements
    expect(screen.getByText(/Deepwinter/)).toBeInTheDocument(); // Month name
    expect(screen.getByText(/Day/)).toBeInTheDocument(); // Time of day
    expect(screen.getByText(/12:00 PM/)).toBeInTheDocument(); // Formatted time
  });
});
