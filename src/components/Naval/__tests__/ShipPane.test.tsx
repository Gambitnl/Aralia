import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ShipPane } from '../ShipPane';
import { Ship, VoyageState } from '../../../types/naval';

const mockShip: Ship = {
  id: 'test-ship',
  name: 'The Sea Spray',
  type: 'Sloop',
  size: 'Small',
  description: 'A nimble vessel.',
  stats: {
    speed: 40,
    maneuverability: 2,
    hullPoints: 50,
    maxHullPoints: 50,
    armorClass: 12,
    cargoCapacity: 20,
    crewMin: 5,
    crewMax: 15
  },
  crew: {
    members: [
      { id: '1', name: 'Jack', role: 'Captain', skills: {}, morale: 80, loyalty: 90, dailyWage: 5, traits: [] },
      { id: '2', name: 'Sparrow', role: 'Navigator', skills: {}, morale: 70, loyalty: 50, dailyWage: 3, traits: [] }
    ],
    averageMorale: 75,
    unrest: 0,
    quality: 'Average'
  },
  cargo: {
    items: [
      { id: 'c1', name: 'Rum', quantity: 10, weightPerUnit: 0.1, isContraband: true }
    ],
    totalWeight: 1,
    capacityUsed: 1,
    supplies: { food: 30, water: 30 }
  },
  modifications: [],
  weapons: [],
  flags: {}
};

const mockSailingVoyage: VoyageState = {
  shipId: 'test-ship',
  destinationId: 'port-42',
  status: 'Sailing',
  daysAtSea: 3,
  distanceTraveled: 60,
  distanceToDestination: 200,
  currentWeather: 'Clear',
  suppliesConsumed: { food: 3, water: 3 },
  log: [
    { day: 1, event: 'Set sail from port.', type: 'Info' },
    { day: 3, event: 'Spotted dolphins off the bow.', type: 'Fluff' },
  ],
};

const mockDockedVoyage: VoyageState = {
  shipId: 'test-ship',
  destinationId: 'port-42',
  status: 'Docked',
  daysAtSea: 5,
  distanceTraveled: 200,
  distanceToDestination: 200,
  currentWeather: 'Calm',
  suppliesConsumed: { food: 5, water: 5 },
  log: [
    { day: 5, event: 'Arrived at destination!', type: 'Info' },
  ],
};

describe('ShipPane', () => {
  it('renders ship overview correctly', () => {
    render(<ShipPane ship={mockShip} onClose={() => {}} />);

    expect(screen.getByText('The Sea Spray')).toBeInTheDocument();
    expect(screen.getByText('Hull')).toBeInTheDocument();
    expect(screen.getByText('50/50')).toBeInTheDocument(); // Hull
    expect(screen.getByText('40')).toBeInTheDocument(); // Speed
    expect(screen.getByText('Knots')).toBeInTheDocument(); // Speed unit
  });

  it('switches tabs to crew list', () => {
    render(<ShipPane ship={mockShip} onClose={() => {}} />);

    const crewButton = screen.getByText('Crew');
    fireEvent.click(crewButton);

    expect(screen.getByText('Jack')).toBeInTheDocument();
    expect(screen.getByText('Sparrow')).toBeInTheDocument();
    expect(screen.getByText('Captain')).toBeInTheDocument();
  });

  it('switches tabs to cargo', () => {
    render(<ShipPane ship={mockShip} onClose={() => {}} />);

    const cargoButton = screen.getByText('Cargo');
    fireEvent.click(cargoButton);

    expect(screen.getByText('Rum')).toBeInTheDocument();
    expect(screen.getByText('ILLEGAL')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(<ShipPane ship={mockShip} onClose={handleClose} />);

    fireEvent.click(screen.getByLabelText('Close'));

    expect(handleClose).toHaveBeenCalled();
  });

  // ── Voyage tab tests ──────────────────────────────────────────────────────

  it('renders voyage status and days at sea when an active voyage is provided', () => {
    render(
      <ShipPane ship={mockShip} onClose={() => {}} voyage={mockSailingVoyage} />
    );

    // Switch to voyage tab
    fireEvent.click(screen.getByText('Voyage'));

    expect(screen.getByText('Sailing')).toBeInTheDocument();
    // Scope the days-at-sea assertion to the "Days at Sea" stat card so it
    // won't break if another stat happens to equal 3.
    const daysCard = screen.getByText('Days at Sea').closest('div')!;
    expect(within(daysCard).getByText('3')).toBeInTheDocument();
  });

  it('resets to a valid tab when the voyage clears while the Voyage tab is active', () => {
    const { rerender } = render(
      <ShipPane ship={mockShip} onClose={() => {}} voyage={mockSailingVoyage} />
    );

    // Open the Voyage tab, then clear the voyage (as 3C-4 will on arrival).
    fireEvent.click(screen.getByText('Voyage'));
    rerender(<ShipPane ship={mockShip} onClose={() => {}} voyage={null} />);

    // Voyage tab is gone and a valid tab (Overview) is showing — not a blank pane.
    expect(screen.queryByText('Voyage')).not.toBeInTheDocument();
    expect(screen.getByText('Hull')).toBeInTheDocument();
  });

  it('renders voyage log entries on the Voyage tab', () => {
    render(
      <ShipPane ship={mockShip} onClose={() => {}} voyage={mockSailingVoyage} />
    );

    fireEvent.click(screen.getByText('Voyage'));

    expect(screen.getByText('Spotted dolphins off the bow.')).toBeInTheDocument();
    expect(screen.getByText('Set sail from port.')).toBeInTheDocument();
  });

  it('calls onAdvanceDay exactly once when Advance a day button is clicked', () => {
    const onAdvanceDay = vi.fn();
    render(
      <ShipPane
        ship={mockShip}
        onClose={() => {}}
        voyage={mockSailingVoyage}
        onAdvanceDay={onAdvanceDay}
      />
    );

    fireEvent.click(screen.getByText('Voyage'));
    fireEvent.click(screen.getByRole('button', { name: /advance a day at sea/i }));

    expect(onAdvanceDay).toHaveBeenCalledTimes(1);
  });

  it('does NOT render the advance button when voyage status is Docked', () => {
    render(
      <ShipPane
        ship={mockShip}
        onClose={() => {}}
        voyage={mockDockedVoyage}
        onAdvanceDay={() => {}}
      />
    );

    fireEvent.click(screen.getByText('Voyage'));

    expect(screen.queryByRole('button', { name: /advance a day at sea/i })).not.toBeInTheDocument();
    // "Arrived — docked at destination." message should be visible
    expect(screen.getByText(/Arrived — docked/i)).toBeInTheDocument();
  });

  it('renders no Voyage tab when voyage prop is absent', () => {
    render(<ShipPane ship={mockShip} onClose={() => {}} />);

    expect(screen.queryByText('Voyage')).not.toBeInTheDocument();
  });

  it('renders no Voyage tab when voyage prop is null', () => {
    render(<ShipPane ship={mockShip} onClose={() => {}} voyage={null} />);

    expect(screen.queryByText('Voyage')).not.toBeInTheDocument();
  });
});
