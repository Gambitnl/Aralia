import type { CombatCharacter } from '../../types/combat';
import type { EntityRecipe } from './types';
/** Resolve a humanoid's race id from its creatureTypes tags + name. */
export declare function raceIdFromTags(tags: string[] | undefined, name: string): string;
/** Build the recipe for a combat-map combatant. */
export declare function recipeFromCombatant(c: CombatCharacter): EntityRecipe;
