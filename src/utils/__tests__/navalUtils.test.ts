
import { describe, it, expect } from 'vitest';
import { createShip, calculateShipStats, addCrewMember, calculateTravelTime, checkMutinyRisk } from '../navalUtils';
import { CrewMember } from '../../types/naval';

describe('Naval Utils', () => {
  it('should create a ship with correct base stats', () => {
    const ship = createShip('The Black Pearl', 'Sloop');
    expect(ship.name).toBe('The Black Pearl');
    expect(ship.type).toBe('Sloop');
    expect(ship.stats.speed).toBe(60);
    expect(ship.stats.crewMin).toBe(4);
  });

  it('should calculate stats with crew penalties', () => {
    let ship = createShip('Lonely Boat', 'Sloop');
    // Sloop min crew is 4. Let's add 0 crew members (default).
    // Speed should be 0 or penalized heavily? Logic says speed * (0/4) = 0
    let stats = calculateShipStats(ship);
    expect(stats.speed).toBe(0);

    // Add 1 crew member (25% capacity)
    const sailor: CrewMember = {
      id: '1', name: 'Jack', role: 'Sailor', skills: {}, morale: 50, loyalty: 50, dailyWage: 1, traits: []
    };
    ship = addCrewMember(ship, sailor);
    stats = calculateShipStats(ship);

    // 60 * (1/4) = 15
    expect(stats.speed).toBe(15);
  });

  it('should calculate stats with high morale bonus', () => {
    let ship = createShip('Happy Boat', 'Sloop');
    // Add full crew with high morale
    for (let i = 0; i < 4; i++) {
      ship = addCrewMember(ship, {
        id: `${i}`, name: `Sailor ${i}`, role: 'Sailor', skills: {}, morale: 90, loyalty: 90, dailyWage: 1, traits: []
      });
    }

    const stats = calculateShipStats(ship);
    // Base 60 * 1.1 = 66
    expect(stats.speed).toBeCloseTo(66);
    // Maneuverability base 6 + 1 = 7
    expect(stats.maneuverability).toBe(7);
  });

  it('should calculate travel time correctly', () => {
    let ship = createShip('Fast Boat', 'Sloop'); // Speed 60 = 6 mph
    // Add min crew to avoid penalty
    for (let i = 0; i < 4; i++) {
      ship = addCrewMember(ship, {
        id: `${i}`, name: `Sailor ${i}`, role: 'Sailor', skills: {}, morale: 50, loyalty: 50, dailyWage: 1, traits: []
      });
    }

    // Distance 60 miles, Speed 6 mph -> 10 hours
    const time = calculateTravelTime(ship, 60);
    expect(time).toBeCloseTo(10);

    // With wind factor 0.5 -> 3 mph -> 20 hours
    const slowTime = calculateTravelTime(ship, 60, 0.5);
    expect(slowTime).toBeCloseTo(20);
  });

  it('should detect mutiny risk', () => {
    let ship = createShip('Mutinous Boat', 'Sloop');
    ship.crew.unrest = 80;
    ship.crew.averageMorale = 20;
    expect(checkMutinyRisk(ship)).toBe(true);

    ship.crew.unrest = 20;
    ship.crew.averageMorale = 20;
    expect(checkMutinyRisk(ship)).toBe(false);
  });
});
