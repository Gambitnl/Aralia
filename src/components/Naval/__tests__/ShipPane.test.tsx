import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShipPane } from '../ShipPane';
import { Ship } from '../../../types/naval';

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
});
