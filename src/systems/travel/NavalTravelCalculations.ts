/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/systems/travel/NavalTravelCalculations.ts
 * Logic for calculating naval travel speed, time, and modifiers based on ship stats, wind, and crew.
 */

import { Ship, ShipStats } from '../../types/naval';
import { WindDirection, RelativeWind } from '../../types/navalCombat';

// Map cardinal directions to degrees for calculation
export const WIND_DIRECTION_DEGREES: Record<WindDirection, number> = {
  North: 0,
  NorthEast: 45,
  East: 90,
  SouthEast: 135,
  South: 180,
  SouthWest: 225,
  West: 270,
  NorthWest: 315,
};

export type WindSpeed = 'Calm' | 'Light Breeze' | 'Strong Breeze' | 'Gale' | 'Storm';

export interface WindCondition {
  direction: WindDirection;
  speed: WindSpeed;
}

export interface NavalTravelStats {
  baseSpeedMph: number;
  effectiveSpeedMph: number;
  travelTimeHours: number; // Time to travel 1 mile (or arbitrary distance unit)
  relativeWind: RelativeWind;
  description: string;
}

/**
 * Calculates the relative angle between ship heading and wind direction.
 */
export function calculateRelativeWind(heading: WindDirection, windDirection: WindDirection): RelativeWind {
  const hDeg = WIND_DIRECTION_DEGREES[heading];
  const wDeg = WIND_DIRECTION_DEGREES[windDirection];

  let diff = Math.abs(hDeg - wDeg);
  if (diff > 180) diff = 360 - diff;

  // 0-45 degrees from bow = Headwind (Beating)
  // 135-180 degrees (stern) = Tailwind (Running)
  // 45-135 degrees = Crosswind (Reaching)

  // Note: Sailing directly into wind (0 deg) is impossible for sails, but we assume tacking.
  // Headwind means "from the front", Tailwind means "from the back".

  // Wait: Wind Direction is WHERE IT COMES FROM.
  // If Heading North (0), and Wind is North (0), wind comes from North -> Headwind.
  // Diff is 0.

  if (diff <= 45) return 'Headwind';
  if (diff >= 135) return 'Tailwind';
  return 'Crosswind';
}

/**
 * Calculates speed modifier based on ship type and relative wind.
 * Some ships (Square rigged) are better downwind.
 * Others (Fore-and-aft) are better at reaching/beating.
 */
export function getWindSpeedModifier(ship: Ship, relativeWind: RelativeWind, windSpeed: WindSpeed): number {
    let modifier = 1.0;

    // Wind Speed Effects
    switch (windSpeed) {
        case 'Calm': return 0.1; // Drifting or rowing
        case 'Light Breeze': modifier = 0.5; break;
        case 'Strong Breeze': modifier = 1.5; break; // Ideal
        case 'Gale': modifier = 1.2; break; // Too fast, need to reef sails
        case 'Storm': return 0.2; // Survival mode, not travel
        default: modifier = 1.0;
    }

    // Ship Rigging biases (simplified)
    // Square rigged (Galleon, Frigate, Warship) - Good at Tailwind, Bad at Headwind
    // Fore-and-aft (Sloop, Caravel) - Good at Crosswind, Better at Headwind

    const isSquareRigged = ['Galleon', 'Frigate', 'Warship', 'SailingShip', 'Galley'].includes(ship.type);

    // Rowing vessels
    const isRowed = ['Rowboat', 'Galley', 'Longship'].includes(ship.type);

    if (relativeWind === 'Headwind') {
        if (isRowed && windSpeed === 'Calm') return 1.0; // Rowing speed is consistent
        if (isRowed) modifier *= 0.8; // Rowing against wind
        else if (isSquareRigged) modifier *= 0.25; // Tacking is slow
        else modifier *= 0.5; // Sloop tacking
    } else if (relativeWind === 'Tailwind') {
        if (isSquareRigged) modifier *= 1.2;
        else modifier *= 1.0;
    } else { // Crosswind
        if (!isSquareRigged) modifier *= 1.2; // Sloops love reaching
    }

    return Number(modifier.toFixed(2));
}

/**
 * Calculates effective naval travel stats.
 */
export function calculateNavalTravelStats(
  ship: Ship,
  heading: WindDirection,
  wind: WindCondition
): NavalTravelStats {
  // Base Speed: ship.stats.speed is ft/round.
  // 1 ft/round = 0.1 mph (approx, 30ft => 3mph)
  const baseMph = ship.stats.speed / 10;

  const relativeWind = calculateRelativeWind(heading, wind.direction);
  const modifier = getWindSpeedModifier(ship, relativeWind, wind.speed);

  let effectiveSpeed = baseMph * modifier;

  // Crew proficiency bonus (simplified)
  // If crew is veteran/elite, they handle sails better
  if (ship.crew.quality === 'Veteran') effectiveSpeed *= 1.1;
  if (ship.crew.quality === 'Elite') effectiveSpeed *= 1.2;
  if (ship.crew.quality === 'Poor') effectiveSpeed *= 0.8;

  // Ensure minimum speed (drifting) unless calm
  if (effectiveSpeed < 0.5 && wind.speed !== 'Calm') effectiveSpeed = 0.5;

  return {
    baseSpeedMph: baseMph,
    effectiveSpeedMph: Number(effectiveSpeed.toFixed(2)),
    travelTimeHours: effectiveSpeed > 0 ? Number((1 / effectiveSpeed).toFixed(2)) : Infinity,
    relativeWind,
    description: `Sailing ${ship.name} (${ship.type}) into a ${relativeWind} (${wind.speed})`
  };
}
