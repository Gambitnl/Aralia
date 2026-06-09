import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CompassPane from '../index';
import { Location } from '../../../types';

// Mock framer-motion so the component can be exercised as plain DOM in tests.
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  const React = await import('react');

  type MotionProps = {
    whileHover?: unknown;
    whileTap?: unknown;
    layout?: unknown;
    initial?: unknown;
    animate?: unknown;
    exit?: unknown;
    transition?: unknown;
    children?: React.ReactNode;
  } & React.ComponentPropsWithoutRef<'button'> & React.ComponentPropsWithoutRef<'div'>;

  const MotionButton = React.forwardRef<HTMLButtonElement, MotionProps>(
    ({ whileHover, whileTap, layout, initial, animate, exit, transition, ...props }, ref) => (
      <button ref={ref} {...(props as React.ComponentPropsWithoutRef<'button'>)} />
    )
  );
  MotionButton.displayName = 'MotionButton';

  const MotionDiv = React.forwardRef<HTMLDivElement, MotionProps>(
    ({ whileHover, whileTap, layout, initial, animate, exit, transition, ...props }, ref) => (
      <div ref={ref} {...(props as React.ComponentPropsWithoutRef<'div'>)} />
    )
  );
  MotionDiv.displayName = 'MotionDiv';

  return {
    ...actual,
    motion: {
      button: MotionButton,
      div: MotionDiv,
    },
  };
});

// The pass-time modal uses a focus trap hook that is not relevant to this
// regression proof, so keep it inert in the test environment.
vi.mock('@/hooks/useFocusTrap', () => ({
  useFocusTrap: () => ({ current: null }),
}));

// Keep the time and calendar helpers deterministic so the rendered proof stays stable.
vi.mock('@/utils/core', () => ({
  formatGameTime: vi.fn(() => '12:00 PM'),
  getGameDay: vi.fn(() => 1),
  getSeason: vi.fn(() => 'Winter'),
  getGameEpoch: vi.fn(() => new Date(Date.UTC(351, 0, 1))),
  addGameTime: vi.fn((date, time) => new Date(
    date.getTime()
      + ((time?.minutes ?? 0) * 60 * 1000)
      + ((time?.hours ?? 0) * 60 * 60 * 1000)
      + ((time?.days ?? 0) * 24 * 60 * 60 * 1000)
      + ((time?.weeks ?? 0) * 7 * 24 * 60 * 60 * 1000)
      + ((time?.months ?? 0) * 30 * 24 * 60 * 60 * 1000)
      + ((time?.years ?? 0) * 365 * 24 * 60 * 60 * 1000)
  )),
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

  const mapData = {
    gridSize: { rows: 2, cols: 2 },
    tiles: [
      [{ biomeId: 'plains' }, { biomeId: 'plains' }],
      [{ biomeId: 'plains' }, { biomeId: 'plains' }],
    ],
  } as any;

  const defaultProps = {
    currentLocation: mockLocation,
    currentSubMapCoordinates: { x: 10, y: 10 },
    worldMapCoords: { x: 0, y: 0 },
    subMapCoords: { x: 0, y: 0 },
    onAction: vi.fn(),
    disabled: false,
    mapData,
    gameTime: new Date(Date.UTC(351, 0, 1, 12, 0, 0)),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders time widget components', () => {
    render(<CompassPane {...defaultProps} />);

    // This proves the component still surfaces the time widget state that sits above the navigation grid.
    expect(screen.getByText(/1 Deepwinter/)).toBeInTheDocument();
    expect(screen.getByText(/The sun is high/)).toBeInTheDocument();
  });

  it('dispatches move and look-around actions from the compass grid', () => {
    const onAction = vi.fn();

    render(<CompassPane {...defaultProps} onAction={onAction} />);

    fireEvent.click(screen.getByLabelText('Move North'));
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'move',
        label: 'Move North',
        targetId: 'North',
        payload: expect.objectContaining({ query: 'Move North' }),
      })
    );

    fireEvent.click(screen.getByLabelText('Look Around'));
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'look_around',
        label: 'Look Around',
      })
    );
  });

  it('keeps edge movement disabled while leaving look around available', () => {
    const onAction = vi.fn();

    render(
      <CompassPane
        {...defaultProps}
        onAction={onAction}
        currentSubMapCoordinates={{ x: 0, y: 0 }}
        worldMapCoords={{ x: 0, y: 0 }}
      />
    );

    expect(screen.getByLabelText('Move North-West (unavailable)')).toBeDisabled();
    expect(screen.getByLabelText('Look Around')).toBeEnabled();

    fireEvent.click(screen.getByLabelText('Look Around'));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ type: 'look_around' }));

    fireEvent.click(screen.getByLabelText('Move North-West (unavailable)'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('opens pass time and emits wait seconds when confirmed', () => {
    const onAction = vi.fn();

    render(<CompassPane {...defaultProps} onAction={onAction} />);

    fireEvent.click(screen.getByLabelText('Pass Time'));

    expect(screen.getByRole('dialog', { name: 'Pass Time' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/minutes/i), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'wait',
        label: 'Pass time',
        payload: { seconds: 300 },
      })
    );
  });
});
