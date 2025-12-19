
import {
    SmugglingRoute,
    InspectionEvent,
    InspectionResult,
    ContrabandDefinition,
    HeatLevel
} from '../../types/crime';
import { PlayerCharacter } from '../../types/character';
import { SeededRandom } from '../../utils/seededRandom';

export class SmugglingSystem {

    /**
     * Calculates the total risk of a smuggling run.
     * Factors in route difficulty, cargo volume vs concealment, and player skills.
     */
    static calculateRunRisk(
        route: SmugglingRoute,
        cargo: ContrabandDefinition[],
        player: PlayerCharacter,
        concealmentPlan?: 'magic' | 'hidden_compartment' | 'bribe_ahead'
    ): number {
        let risk = route.baseRisk;

        // Volume factor
        const totalVolume = cargo.reduce((acc, item) => acc + item.volume, 0);
        risk += totalVolume * 2; // +2% risk per volume unit

        // Concealment modifiers
        if (concealmentPlan === 'hidden_compartment') {
            risk -= 15;
        } else if (concealmentPlan === 'magic') {
            risk -= 25;
        } else if (concealmentPlan === 'bribe_ahead') {
            risk -= 10;
        }

        // Skill modifiers (Sleight of Hand / Deception implied via stats)
        const dexMod = Math.floor((player.stats.dexterity - 10) / 2);
        risk -= dexMod * 2;

        return Math.min(95, Math.max(5, risk));
    }

    /**
     * Determines if an inspection occurs during travel.
     */
    static checkForInspection(
        route: SmugglingRoute,
        risk: number,
        seed?: number
    ): InspectionEvent | null {
        const rng = new SeededRandom(seed || Date.now());
        const roll = rng.nextInt(1, 100);

        if (roll <= risk) {
            // Inspection triggered
            const difficulty = route.inspectionStrictness * 2 + 10; // DC 10-30
            const guardsCount = Math.max(2, Math.floor(route.patrolFrequency / 2) + rng.nextInt(0, 3));

            return {
                routeId: route.id,
                difficulty,
                guardsCount,
                canBribe: rng.next() > 0.3, // 70% chance to be bribeable
                bribeCost: guardsCount * 50 // 50gp per guard
            };
        }

        return null;
    }

    /**
     * Resolves an inspection encounter.
     */
    static resolveInspection(
        event: InspectionEvent,
        playerAction: 'submit' | 'bribe' | 'bluff' | 'fight' | 'flee',
        player: PlayerCharacter,
        cargo: ContrabandDefinition[]
    ): { result: InspectionResult; message: string; itemsLost: ContrabandDefinition[]; goldCost: number } {
        const rng = new SeededRandom(Date.now());

        if (playerAction === 'fight') {
             return {
                result: InspectionResult.Combat,
                message: "You draw your weapons. Roll for initiative!",
                itemsLost: [],
                goldCost: 0
            };
        }

        if (playerAction === 'submit') {
            return {
                result: InspectionResult.Confiscation,
                message: "You surrender your goods. The guards confiscate the contraband.",
                itemsLost: [...cargo],
                goldCost: 0
            };
        }

        if (playerAction === 'bribe') {
            if (!event.canBribe) {
                return {
                    result: InspectionResult.BribeFailure,
                    message: "The guard captain spits at your gold. 'We aren't corrupt, criminal scum!'",
                    itemsLost: [], // Triggers combat or arrest usually, handled by caller
                    goldCost: 0
                };
            }

            if (player.gold < event.bribeCost) {
                 return {
                    result: InspectionResult.BribeFailure,
                    message: "You don't have enough gold to satisfy them.",
                    itemsLost: [],
                    goldCost: 0
                };
            }

            return {
                result: InspectionResult.BribeSuccess,
                message: "The guards look the other way.",
                itemsLost: [],
                goldCost: event.bribeCost
            };
        }

        if (playerAction === 'bluff') {
            // Deception check
            const chaMod = Math.floor((player.stats.charisma - 10) / 2);
            // Add proficiency if we had skill access, assuming simplified model for now
            const roll = rng.nextInt(1, 20) + chaMod;

            if (roll >= event.difficulty) {
                return {
                    result: InspectionResult.Pass,
                    message: "You convinced them you're just a humble merchant.",
                    itemsLost: [],
                    goldCost: 0
                };
            } else {
                 return {
                    result: InspectionResult.Confiscation, // Failed bluff leads to search
                    message: "They didn't buy your story and started searching the cart.",
                    itemsLost: [...cargo],
                    goldCost: 0
                };
            }
        }

         if (playerAction === 'flee') {
             // Athletics/Vehicle check vs Patrol speed
             // Simplified: 50/50 modified by dexterity
             const dexMod = Math.floor((player.stats.dexterity - 10) / 2);
             const roll = rng.nextInt(1, 20) + dexMod;

             if (roll >= event.difficulty + 5) { // Fleeing is harder
                  return {
                    result: InspectionResult.Flee,
                    message: "You managed to outrun the patrol!",
                    itemsLost: [],
                    goldCost: 0
                };
             } else {
                 return {
                    result: InspectionResult.Combat, // Caught
                    message: "They caught up to you!",
                    itemsLost: [],
                    goldCost: 0
                };
             }
        }

        return {
            result: InspectionResult.Pass,
            message: "Nothing happened.",
            itemsLost: [],
            goldCost: 0
        };
    }
}
