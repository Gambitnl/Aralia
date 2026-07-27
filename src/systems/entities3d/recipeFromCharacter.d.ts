/**
 * @file recipeFromCharacter.ts — a real character sheet → entity recipe.
 *
 * Maps the character's race id, class id, and equipped items so the player
 * (or a rich NPC) renders with the gear they actually wear instead of the
 * generic class kit. Slots without a visual mapping are simply not shown.
 */
import type { PlayerCharacter } from '../../types/character';
import type { RichNPC } from '../../types/world';
import type { EntityRecipe, PartInstance } from './types';
/** Visible gear from the equipped-items slot map. */
export declare function gearFromEquippedItems(equippedItems: PlayerCharacter['equippedItems'] | undefined): PartInstance[];
/** Build the recipe for a real character. Seed defaults to the character id. */
export declare function recipeFromCharacter(pc: PlayerCharacter, seed?: string): EntityRecipe;
/** Build the recipe for a generated rich NPC. The NPC generator does not
 * persist a race id (and itself defaults unspecified NPCs to human), so the
 * recipe mirrors that; class and worn gear come from the NPC's real data. */
export declare function recipeFromRichNpc(npc: RichNPC): EntityRecipe;
