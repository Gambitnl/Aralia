import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TimeWidget } from '../TimeWidget';
import { Season, TimeOfDay } from '@/utils/timeUtils';
import { MoonPhase } from '@/systems/time/CalendarSystem';

// Mock dependencies
vi.mock('@/utils/timeUtils', () => ({
  Season: { Spring: 'Spring', Summer: 'Summer', Autumn: 'Autumn', Winter: 'Winter' },
  TimeOfDay: { Dawn: 'Dawn', Day: 'Day', Dusk: 'Dusk', Night: 'Night' },
  getSeason: vi.fn(() => 'Winter'),
  getTimeOfDay: vi.fn(() => 'Night'),
  getTimeModifiers: vi.fn(() => ({ description: 'It is cold.', travelCostMultiplier: 1.5, visionModifier: 0.2 })),
}));

vi.mock('@/systems/time/CalendarSystem', () => ({
  MoonPhase: { FullMoon: 'Full Moon' },
  getMoonPhase: vi.fn(() => 'Full Moon'),
  getHoliday: vi.fn(() => null),
  getMonthName: vi.fn(() => 'Deepwinter'),
}));

describe('TimeWidget', () => {
  const mockTime = new Date(Date.UTC(351, 0, 1, 23, 0, 0)); // Night

  it('renders correctly with time, season, and moon phase', () => {
    render(<TimeWidget gameTime={mockTime} />);

    expect(screen.getByText(/Winter/i)).toBeInTheDocument(); // Indirectly via icon or text if we add it
    expect(screen.getByText(/Deepwinter/i)).toBeInTheDocument();

    // Check for "Night" text specifically in the time display area, not just anywhere
    // But since we have multiple "Night" texts (one in status, one in warning), getAllByText is safer if we just want existence.
    expect(screen.getAllByText(/Night/i).length).toBeGreaterThan(0);

    expect(screen.getByText(/It is cold/i)).toBeInTheDocument();
    expect(screen.getByText(/Danger increases at night/i)).toBeInTheDocument(); // Night warning
  });
});
