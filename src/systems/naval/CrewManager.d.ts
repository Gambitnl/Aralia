/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 09/06/2026, 02:48:37
 * Dependents: data/naval/voyageEvents.ts, data/naval/voyageEvents/index.ts, state/reducers/navalReducer.ts, systems/naval/VoyageManager.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/systems/naval/CrewManager.ts
 * Logic for crew generation, management, and daily updates.
 */
import { Crew, CrewMember, CrewRole, Ship } from '../../types/naval';
import { SeededRandom } from '@/utils/random';
export declare class CrewManager {
    /**
     * Generates a new crew member with personality and skills.
     */
    static generateCrewMember(role: CrewRole, level?: number, rng?: SeededRandom): CrewMember;
    /**
     * Calculates derived stats for the entire crew.
     */
    static calculateCrewStats(members: CrewMember[]): Crew;
    /**
     * Adds a new crew member to the ship.
     */
    static recruitCrew(ship: Ship, role: CrewRole, level?: number, rng?: SeededRandom): Ship;
    /**
     * Processes daily updates for the crew: wages, morale decay, mutiny checks.
     * @param ship The ship to update
     * @param availableFunds The captain's gold available for wages
     * @param rng Optional seeded source used by callers that already have a replay seed.
     *            If omitted, the current ship/funds snapshot is hashed so the
     *            fallback path still behaves deterministically.
     * @returns Updated ship, remaining funds, and logs
     */
    static processDailyCrewUpdate(ship: Ship, availableFunds: number, rng?: SeededRandom): {
        ship: Ship;
        remainingFunds: number;
        logs: string[];
        mutinyTriggered: boolean;
    };
    /**
     * Modifies morale for all crew members.
     */
    static modifyCrewMorale(crew: Crew, amount: number, reason?: string): void;
    /**
     * Modifies loyalty for all crew members.
     */
    static modifyCrewLoyalty(crew: Crew, amount: number, _reason?: string): void;
}
