/**
 * @file src/systems/naval/NavalLogic.ts
 * Consolidated logic for the Naval system: Voyage management, Crew generation, and Ship creation.
 */
import { Ship, VoyageState, CrewMember, CrewRole, ShipType } from '../../types/naval';
export declare class VoyageManager {
    static startVoyage(shipId: string, destinationId: string, distance: number): VoyageState;
    static advanceDay(currentVoyage: VoyageState, ship: Ship): VoyageState;
}
export declare class CrewManager {
    static generateCrewMember(role?: CrewRole): CrewMember;
}
export declare const createShip: (type: ShipType, name: string) => Ship;
