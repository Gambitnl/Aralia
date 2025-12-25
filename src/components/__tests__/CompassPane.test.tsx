import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CompassPane from '../CompassPane';
import { Location } from '../../types';

// Mock dependencies
vi.mock('@/utils/timeUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/timeUtils')>();
  return {
    ...actual,
    formatGameTime: vi.fn(() => '12:00 PM'),
    getGameDay: vi.fn(() => 1),
    getSeason: vi.fn(() => actual.Season.Winter),
    getTimeOfDay: vi.fn(() => actual.TimeOfDay.Day),
    getTimeModifiers: vi.fn(() => ({ description: 'Test Weather' })),
    getGameEpoch: vi.fn(() => new Date(Date.UTC(351, 0, 1))),
    addGameTime: vi.fn((date) => date), // Mock addGameTime to return same date
  };
});

vi.mock('@/systems/time/CalendarSystem', () => ({
  getCalendarDescription: vi.fn(() => 'It is Deepwinter, 351 (Winter). Moon: Waxing Crescent.'),
  getMoonPhase: vi.fn(() => 'Full Moon'),
  MoonPhase: { FullMoon: 'Full Moon' },
  getHoliday: vi.fn(() => null),
  getMonthName: vi.fn(() => 'Deepwinter'),
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
    // The previous text check is no longer valid as the display has changed to a widget
    // We should check for the TimeWidget content
    expect(screen.getByText(/❄️ 1 Deepwinter/)).toBeInTheDocument();
    expect(screen.getByText(/☀️ Day/)).toBeInTheDocument();
  });
});
