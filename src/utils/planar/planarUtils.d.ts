/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:33:17
 * Dependents: planar/index.ts, planarUtils.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { Plane, Portal } from '../../types/planes';
import { Location, GameState, MagicSchool } from '../../types/index';
/**
 * Retrieves the plane object by its ID.
 * @param planeId - The ID of the plane to retrieve.
 * @returns The Plane object, or the Material Plane if not found.
 */
export declare function getPlane(planeId: string): Plane;
/**
 * Determines the current plane based on the current location.
 * @param currentLocation - The current location object.
 * @returns The Plane object the location resides in.
 */
export declare function getCurrentPlane(currentLocation: Location): Plane;
/**
 * Checks if a portal can be activated given the current game state.
 * @param portal - The portal to check.
 * @param gameState - The current game state.
 * @returns True if the portal can be activated.
 */
export declare function canActivatePortal(portal: Portal, gameState: GameState): boolean;
/**
 * Calculates the modified DC or effectiveness of a spell based on the current plane.
 * @param spellSchool - The school of the spell being cast.
 * @param plane - The plane the spell is being cast on.
 * @param baseDC - The original DC of the spell.
 * @returns The modified DC.
 */
export declare function getPlanarSpellModifier(spellSchool: MagicSchool, plane: Plane): number;
/**
 * Returns a description of how the plane affects the character's senses/feelings.
 * @param plane - The current plane.
 * @returns A string description.
 */
export declare function getPlanarAtmosphere(plane: Plane): string;
