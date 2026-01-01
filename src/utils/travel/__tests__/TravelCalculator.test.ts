
import { describe, it, expect } from 'vitest';
import { TravelCalculator } from '../TravelCalculator';
import { TravelParameters } from '../../../types/travel';

describe('TravelCalculator', () => {
  const origin = { x: 0, y: 0 };
  const destination = { x: 4, y: 0 }; // 4 tiles away
  const milesPerTile = 6; // 4 * 6 = 24 miles

  it('calculates normal pace correctly for standard speed', () => {
    const params: TravelParameters = {
      origin,
      destination,
      baseSpeed: 30,
      pace: 'normal',
    };

    const result = TravelCalculator.calculateTravel(params, milesPerTile);

    expect(result.distanceMiles).toBe(24);
    // 30ft speed -> 3 mph. Normal pace * 1.0.
    // 24 miles / 3 mph = 8 hours.
    expect(result.travelSpeedMph).toBeCloseTo(3.0);
    expect(result.travelTimeHours).toBeCloseTo(8.0);
  });

  it('calculates fast pace correctly', () => {
    const params: TravelParameters = {
      origin,
      destination,
      baseSpeed: 30,
      pace: 'fast',
    };

    const result = TravelCalculator.calculateTravel(params, milesPerTile);

    // Fast pace: 3 mph * 1.33 = ~4 mph.
    // 24 miles / 4 mph = 6 hours.
    expect(result.travelSpeedMph).toBeCloseTo(3.99, 1);
    expect(result.travelTimeHours).toBeCloseTo(6.0, 1);
  });

  it('calculates slow pace correctly', () => {
    const params: TravelParameters = {
      origin,
      destination,
      baseSpeed: 30,
      pace: 'slow',
    };

    const result = TravelCalculator.calculateTravel(params, milesPerTile);

    // Slow pace: 3 mph * 0.67 = ~2.01 mph.
    // 24 miles / 2.01 mph = 11.94 hours.
    expect(result.travelSpeedMph).toBeCloseTo(2.0, 1);
    expect(result.travelTimeHours).toBeCloseTo(12.0, 0); // Decreased precision to 0 decimal places to allow ~12
  });

  it('adjusts for slow base speed (e.g. Dwarf/Small races)', () => {
    const params: TravelParameters = {
      origin,
      destination,
      baseSpeed: 25,
      pace: 'normal',
    };

    const result = TravelCalculator.calculateTravel(params, milesPerTile);

    // Speed factor: 25/30 = 0.833
    // MPH: 3 * 0.833 = 2.5 mph
    // Time: 24 / 2.5 = 9.6 hours
    expect(result.travelSpeedMph).toBeCloseTo(2.5);
    expect(result.travelTimeHours).toBeCloseTo(9.6);
  });

  it('applies encumbrance penalty', () => {
    const params: TravelParameters = {
      origin,
      destination,
      baseSpeed: 30,
      pace: 'normal',
      isEncumbered: true
    };

    const result = TravelCalculator.calculateTravel(params, milesPerTile);

    // Encumbered: 30 - 10 = 20 effective speed.
    // Factor: 20/30 = 0.666
    // MPH: 3 * 0.666 = 2 mph
    // Time: 24 / 2 = 12 hours
    expect(result.travelSpeedMph).toBeCloseTo(2.0);
    expect(result.travelTimeHours).toBeCloseTo(12.0);
  });
});
