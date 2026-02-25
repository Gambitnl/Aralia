/**
 * @file dragonborn.ts
 * Defines the data for the Dragonborn race and their various Draconic Ancestries
 * in the Aralia RPG. This includes base Dragonborn traits and specific details
 * for each ancestry type (e.g., damage resistance, breath weapon type).
 */
import { Race, DraconicAncestorType, DraconicAncestryInfo } from '../../types';
/**
 * A record mapping each Draconic Ancestor type to its specific information,
 * including the damage type associated with its resistance and breath weapon.
 */
export declare const DRAGONBORN_ANCESTRIES_DATA: Record<DraconicAncestorType, DraconicAncestryInfo>;
/**
 * Base data for the Dragonborn race.
 * Specific ancestry details (like damage type) are chosen during character creation.
 */
export declare const DRAGONBORN_DATA: Race;
