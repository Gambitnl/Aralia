import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CompassPane from '../CompassPane';
import { Location } from '../../types';

// Define enums for the mock
enum Season {
  Spring = 'Spring',
  Summer = 'Summer',
  Autumn = 'Autumn',
  Winter = 'Winter',
}

enum TimeOfDay {
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
  getTimeOfDay: vi.fn(() => 'Day'),
  getTimeModifiers: vi.fn(() => ({ description: 'Mock Description', travelCostMultiplier: 1, visionModifier: 1 })),
  getGameEpoch: vi.fn(() => new Date(Date.UTC(351, 0, 1))),
  addGameTime: vi.fn((date) => date),
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
    NewMoon: 'New Moon',
    WaxingCrescent: 'Waxing Crescent',
    FirstQuarter: 'First Quarter',
    WaxingGibbous: 'Waxing Gibbous',
    FullMoon: 'Full Moon',
    WaningGibbous: 'Waning Gibbous',
    LastQuarter: 'Last Quarter',
    WaningCrescent: 'Waning Crescent',
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

  it('renders time with season', () => {
    render(<CompassPane {...defaultProps} />);
    // The previous text 'Day 1 (Winter)' might be gone or changed in the new widget.
    // The widget displays "❄️ 1 Deepwinter" and "☀️ Day"
    expect(screen.getByText('❄️ 1 Deepwinter')).toBeInTheDocument();
    expect(screen.getByText('☀️ Day')).toBeInTheDocument();
  });
});
