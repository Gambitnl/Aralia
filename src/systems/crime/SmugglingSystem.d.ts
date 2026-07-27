import { SmugglingRoute, InspectionEvent, InspectionResult, ContrabandDefinition } from '../../types/crime';
import { PlayerCharacter } from '../../types/character';
export declare class SmugglingSystem {
    /**
     * Calculates the total risk of a smuggling run.
     * Factors in route difficulty, cargo volume vs concealment, and player skills.
     */
    static calculateRunRisk(route: SmugglingRoute, cargo: ContrabandDefinition[], player: PlayerCharacter, concealmentPlan?: 'magic' | 'hidden_compartment' | 'bribe_ahead'): number;
    /**
     * Determines if an inspection occurs during travel.
     */
    static checkForInspection(route: SmugglingRoute, risk: number, seed?: number): InspectionEvent | null;
    /**
     * Resolves an inspection encounter.
     */
    static resolveInspection(event: InspectionEvent, playerAction: 'submit' | 'bribe' | 'bluff' | 'fight' | 'flee', player: PlayerCharacter, cargo: ContrabandDefinition[], seed?: number): {
        result: InspectionResult;
        message: string;
        itemsLost: ContrabandDefinition[];
        goldCost: number;
    };
}
