import { GroupTravelParameters, TravelResult } from '../types/travel';
/**
 * Service to handle comprehensive travel calculations.
 * Orchestrates distance, group speed, pace modifiers, and event generation stubs.
 */
export declare class TravelService {
    /**
     * Calculates the outcome of a travel action.
     *
     * @param params GroupTravelParameters including origin, destination, party, and pace.
     * @param milesPerTile Scale of the map in miles per tile (default 6 for province scale).
     * @returns TravelResult with time, distance, and encounter checks.
     */
    static calculateTravel(params: GroupTravelParameters, milesPerTile?: number): TravelResult;
    /**
     * Generates a travel log message describing the journey.
     */
    static generateTravelSummary(result: TravelResult, pace: string): string;
}
