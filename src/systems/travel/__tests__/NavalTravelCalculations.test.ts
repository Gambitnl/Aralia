/**
 * @file src/systems/travel/__tests__/NavalTravelCalculations.test.ts
 * Tests for naval travel logic.
 */

import { describe, it, expect } from 'vitest';
import { calculateNavalTravelStats, calculateRelativeWind, getWindSpeedModifier } from '../NavalTravelCalculations';
import { Ship } from '../../types/naval';

describe('NavalTravelCalculations', () => {
  const mockShip: Ship = {
    id: 'ship-1',
    name: 'The Black Pearl',
    type: 'Sloop', // Fore-and-aft
    size: 'Medium',
    description: 'Fast sloop',
    stats: {
      speed: 60, // 6 mph base
      maneuverability: 5,
      hullPoints: 100,
      maxHullPoints: 100,
      armorClass: 12,
      cargoCapacity: 10,
      crewMin: 5,
      crewMax: 15
    },
    crew: {
      members: [],
      averageMorale: 80,
      unrest: 0,
      quality: 'Average'
    },
    cargo: { items: [], totalWeight: 0, capacityUsed: 0 },
    modifications: [],
    weapons: [],
    flags: {}
  };

  const squareRiggedShip: Ship = {
    ...mockShip,
    type: 'Galleon',
    stats: { ...mockShip.stats, speed: 40 } // 4 mph base
  };

  describe('calculateRelativeWind', () => {
    it('detects Headwind correctly', () => {
      expect(calculateRelativeWind('North', 'North')).toBe('Headwind');
      expect(calculateRelativeWind('North', 'NorthEast')).toBe('Headwind'); // 45 deg diff
    });

    it('detects Tailwind correctly', () => {
      expect(calculateRelativeWind('North', 'South')).toBe('Tailwind'); // 180 deg
      expect(calculateRelativeWind('North', 'SouthEast')).toBe('Tailwind'); // 135 deg
    });

    it('detects Crosswind correctly', () => {
      expect(calculateRelativeWind('North', 'East')).toBe('Crosswind'); // 90 deg
    });
  });

  describe('getWindSpeedModifier', () => {
    it('penalizes headwind heavily for square rigged', () => {
        const mod = getWindSpeedModifier(squareRiggedShip, 'Headwind', 'Strong Breeze');
        // Strong Breeze (1.5) * Square Rigged Headwind (0.25) = 0.375, rounded to 2 decimals in function = 0.38
        expect(mod).toBeCloseTo(0.38);
    });

    it('penalizes headwind less for sloop', () => {
        const mod = getWindSpeedModifier(mockShip, 'Headwind', 'Strong Breeze');
        // Strong Breeze (1.5) * Sloop Headwind (0.5) = 0.75
        expect(mod).toBeCloseTo(0.75);
    });

    it('boosts tailwind for square rigged', () => {
        const mod = getWindSpeedModifier(squareRiggedShip, 'Tailwind', 'Strong Breeze');
        // Strong Breeze (1.5) * Square Tailwind (1.2) = 1.8
        expect(mod).toBeCloseTo(1.8);
    });

    it('handles calm water', () => {
        const mod = getWindSpeedModifier(mockShip, 'Crosswind', 'Calm');
        expect(mod).toBe(0.1);
    });
  });

  describe('calculateNavalTravelStats', () => {
    it('calculates effective speed correctly', () => {
        // Sloop (6 mph), Crosswind (Reach), Strong Breeze
        // Base 6 * 1.5 (Breeze) * 1.2 (Sloop Reach) = 10.8 mph
        const result = calculateNavalTravelStats(mockShip, 'North', { direction: 'East', speed: 'Strong Breeze' });
        expect(result.effectiveSpeedMph).toBeCloseTo(10.8);
        expect(result.relativeWind).toBe('Crosswind');
    });

    it('applies crew quality bonus', () => {
        const eliteShip = { ...mockShip, crew: { ...mockShip.crew, quality: 'Elite' as const } };
        // Sloop (6), Crosswind, Strong Breeze -> 10.8 * 1.2 (Elite) = 12.96
        const result = calculateNavalTravelStats(eliteShip, 'North', { direction: 'East', speed: 'Strong Breeze' });
        expect(result.effectiveSpeedMph).toBeCloseTo(12.96);
    });
  });
});
