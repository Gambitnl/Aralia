import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CompassPane from '../index';
import { Location } from '../../../types';

// Define enums for the mock
// TODO(lint-intent): 'Season' is unused in this test; use it in the assertion path or remove it.
enum _Season {
  Spring = 'Spring',
  Summer = 'Summer',
  Autumn = 'Autumn',
  Winter = 'Winter',
}
// TODO(lint-intent): 'TimeOfDay' is unused in this test; use it in the assertion path or remove it.
enum _TimeOfDay {
  Dawn = 'Dawn',
  Day = 'Day',
  Dusk = 'Dusk',
  Night = 'Night',
}

// Mock dependencies
vi.mock('@/utils/timeUtils', () => ({
  formatGameTime: vi.fn(() => '12:00 PM'),
  getGameDay: vi.fn(() => 1),
  getSeason: vi.fn(() => 'Winter'),
  getGameEpoch: vi.fn(() => new Date(Date.UTC(351, 0, 1))),
  addGameTime: vi.fn((date) => date),
  getTimeOfDay: vi.fn(() => 'Day'),
  getTimeModifiers: vi.fn(() => ({
    travelCostMultiplier: 1.0,
    visionModifier: 1.0,
    description: 'The sun is high.',
  })),
  Season: {
    Spring: 'Spring',
    Summer: 'Summer',
    Autumn: 'Autumn',
    Winter: 'Winter',
  },
  TimeOfDay: {
    Dawn: 'Dawn',
    Day: 'Day',
    Dusk: 'Dusk',
    Night: 'Night',
  }
}));

vi.mock('@/systems/time/CalendarSystem', () => ({
  getCalendarDescription: vi.fn(() => 'It is Deepwinter, 351 (Winter). Moon: Waxing Crescent.'),
  getMoonPhase: vi.fn(() => 'Waxing Crescent'),
  getHoliday: vi.fn(() => null),
  getMonthName: vi.fn(() => 'Deepwinter'),
  MoonPhase: {
    WaxingCrescent: 'Waxing Crescent'
  }
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

  it('renders time widget components', () => {
    render(<CompassPane {...defaultProps} />);
    // Check for month and day from TimeWidget
    expect(screen.getByText(/1 Deepwinter/)).toBeInTheDocument();
    // Check for atmospheric description
    expect(screen.getByText(/The sun is high/)).toBeInTheDocument();
  });
});
