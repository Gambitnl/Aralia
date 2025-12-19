
import { GroupTravelParameters, TravelResult, PACE_MODIFIERS, TerrainType } from '../types/travel';
import { calculateGroupTravelStats, calculateTravelTimeHours } from '../systems/travel/TravelCalculations';
import { PlayerCharacter } from '../types/character';
import { Item } from '../types/items';

/**
 * Service to handle comprehensive travel calculations.
 * Orchestrates distance, group speed, pace modifiers, and event generation stubs.
 */
export class TravelService {

  /**
   * Calculates the outcome of a travel action.
   *
   * @param params GroupTravelParameters including origin, destination, party, and pace.
   * @param milesPerTile Scale of the map in miles per tile (default 6 for province scale).
   * @returns TravelResult with time, distance, and encounter checks.
   */
  static calculateTravel(params: GroupTravelParameters, milesPerTile: number = 6): TravelResult {
    const { origin, destination, travelers, inventories, pace, terrain = 'plains' } = params;

    // 1. Calculate Distance (Chebyshev for grid movement consistency)
    const dx = Math.abs(destination.x - origin.x);
    const dy = Math.abs(destination.y - origin.y);
    const distanceTiles = Math.max(dx, dy);
    const distanceMiles = distanceTiles * milesPerTile;

    // 2. Calculate Group Speed
    // Cast 'any' types from interface back to strong types for the calculation system
    const safeTravelers = travelers as PlayerCharacter[];
    const safeInventories = inventories as Record<string, Item[]>;

    const groupStats = calculateGroupTravelStats(safeTravelers, safeInventories, pace, terrain);

    // 3. Calculate Time
    const travelTimeHours = calculateTravelTimeHours(distanceMiles, groupStats);

    // 4. Encounter Checks (Standard: 1 per 4 hours)
    // TODO(Navigator): Integrate with WorldEventManager to adjust danger based on faction control/war status
    const encounterChecks = Math.ceil(travelTimeHours / 4);

    return {
      distanceMiles,
      travelTimeHours,
      travelSpeedMph: groupStats.travelSpeedMph,
      encounterChecks,
      terrainCostModifier: groupStats.terrainModifier
    };
  }

  /**
   * Generates a travel log message describing the journey.
   */
  static generateTravelSummary(result: TravelResult, pace: string, terrain: TerrainType = 'plains'): string {
    const hours = Math.floor(result.travelTimeHours);
    const minutes = Math.round((result.travelTimeHours - hours) * 60);

    let timeString = '';
    if (hours > 0) timeString += `${hours} hr `;
    if (minutes > 0) timeString += `${minutes} min`;
    if (timeString === '') timeString = 'less than a minute';

    let terrainText = '';
    if (terrain !== 'plains') {
        terrainText = ` through ${terrain}`;
    }

    return `Traveled ${result.distanceMiles.toFixed(1)} miles${terrainText} in ${timeString} at ${pace} pace.`;
  }
}
