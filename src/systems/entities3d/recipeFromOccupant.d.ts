import type { EntityRecipe } from './types';
export interface OccupantIdentity {
    /** Stable per-member id (plotId * 100 + memberIndex). */
    id: number;
    ageBand: string;
    /** Ancestry group name; absent on packets from older bakes. */
    race?: string;
}
/** Build the recipe for one interior villager. */
export declare function recipeFromOccupant(occ: OccupantIdentity): EntityRecipe;
