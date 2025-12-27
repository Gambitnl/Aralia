
import { GroupTravelParameters, TravelResult } from '../types/travel';
import { calculateGroupTravelStats, calculateTravelTimeHours } from '../systems/travel/TravelCalculations';
import { PlayerCharacter } from '../types/character';
import { Item } from '../types/items';
import { logger } from '../utils/logger';

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
    const defaultResult: TravelResult = {
      distanceMiles: 0,
      travelTimeHours: 0,
      travelSpeedMph: 0,
      usedTerrain: params?.terrain || 'open',
      encounterChecks: 0
    };

    try {
      if (!params || !params.origin || !params.destination) {
          throw new Error("Invalid travel parameters: missing origin or destination.");
      }

      const { origin, destination, travelers, inventories, pace, terrain = 'open' } = params;

      // 1. Calculate Distance (Chebyshev for grid movement consistency)
      const dx = Math.abs(destination.x - origin.x);
      const dy = Math.abs(destination.y - origin.y);
      const distanceTiles = Math.max(dx, dy);
      const distanceMiles = distanceTiles * milesPerTile;

      // 2. Validate and Calculate Group Speed
      if (!Array.isArray(travelers) || travelers.length === 0) {
          throw new Error("Invalid travelers list.");
      }

      // Filter out null/undefined travelers or those missing critical stats to prevent crashes
      // in calculateGroupTravelStats which expects valid PlayerCharacter objects
      const safeTravelers = (travelers as PlayerCharacter[]).filter(t => t && t.id && t.finalAbilityScores);

      if (safeTravelers.length === 0) {
          throw new Error("No valid travelers found in the group.");
      }

      const safeInventories = inventories as Record<string, Item[]>;

      const groupStats = calculateGroupTravelStats(safeTravelers, safeInventories, pace, terrain);

      // 3. Calculate Time
      const travelTimeHours = calculateTravelTimeHours(distanceMiles, groupStats);

      // 4. Encounter Checks (Standard: 1 per 4 hours)
      // TODO(Navigator): Integrate with dynamic map data to auto-detect terrain type for route segments.
      const encounterChecks = Math.ceil(travelTimeHours / 4);

      return {
        distanceMiles,
        travelTimeHours,
        travelSpeedMph: groupStats.travelSpeedMph,
        usedTerrain: terrain,
        encounterChecks
      };

    } catch (error) {
      logger.error("Travel calculation failed", { error });
      // Return a safe fallback to prevent UI crash
      return defaultResult;
    }
  }

  /**
   * Generates a travel log message describing the journey.
   */
  static generateTravelSummary(result: TravelResult, pace: string): string {
    const hours = Math.floor(result.travelTimeHours);
    const minutes = Math.round((result.travelTimeHours - hours) * 60);

    let timeString = '';
    if (hours > 0) timeString += `${hours} hr `;
    if (minutes > 0) timeString += `${minutes} min`;
    if (timeString === '') timeString = 'less than a minute';

    return `Traveled ${result.distanceMiles.toFixed(1)} miles in ${timeString} at ${pace} pace over ${result.usedTerrain} terrain.`;
  }
}
