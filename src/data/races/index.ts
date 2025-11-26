/**
 * @file src/data/races/index.ts
 * This file serves as an aggregator for all race data defined in the `src/data/races/` directory.
 * It imports individual race data objects (e.g., Human, Elf, Dwarf, Dragonborn) and exports
 * them as a consolidated `ALL_RACES_DATA` object, which maps race IDs to their respective Race data.
 * It also re-exports specific data like `DRAGONBORN_ANCESTRIES_DATA`.
 */
import type { Race } from '../../types.ts'; // Path relative to src/data/races/
import { AARAKOCRA_DATA } from './aarakocra.ts';
import { AASIMAR_DATA } from './aasimar.ts';
import { AIR_GENASI_DATA } from './air_genasi.ts';
import { BUGBEAR_DATA } from './bugbear.ts';
import { CENTAUR_DATA } from './centaur.ts';
import { CHANGELING_DATA } from './changeling.ts';
import { DEEP_GNOME_DATA } from './deep_gnome.ts';
import { DRAGONBORN_ANCESTRIES_DATA, DRAGONBORN_DATA } from './dragonborn.ts';
import { DUERGAR_DATA } from './duergar.ts';
import { DWARF_DATA } from './dwarf.ts';
import { EARTH_GENASI_DATA } from './earth_genasi.ts';
import { ELF_DATA } from './elf.ts';
import { ELADRIN_DATA } from './eladrin.ts';
import { FAIRY_DATA } from './fairy.ts';
import { FIENDISH_LEGACIES_DATA, TIEFLING_DATA } from './tiefling.ts';
import { FIRBOLG_DATA } from './firbolg.ts';
import { FIRE_GENASI_DATA } from './fire_genasi.ts';
import { GIANT_ANCESTRY_BENEFITS_DATA, GOLIATH_DATA } from './goliath.ts';
import { GITHYANKI_DATA } from './githyanki.ts';
import { GITHZERAI_DATA } from './githzerai.ts';
import { GNOME_DATA } from './gnome.ts';
import { GOBLIN_DATA } from './goblin.ts';
import { HALFLING_DATA } from './halfling.ts';
import { HUMAN_DATA } from './human.ts';
import { ORC_DATA } from './orc.ts';
import { WATER_GENASI_DATA } from './water_genasi.ts';

/**
 * A frozen array of all active races, ensuring runtime immutability.
 * This list serves as the single source of truth for which races are available in the game,
 * providing a stable order for UI elements like character creation dropdowns.
 */
export const ACTIVE_RACES: readonly Race[] = Object.freeze([
  // Core PHB-style options
  HUMAN_DATA,
  ELF_DATA,
  DWARF_DATA,
  HALFLING_DATA,

  // Subrace/lineage-driven ancestries
  DRAGONBORN_DATA, // Tied to DRAGONBORN_ANCESTRIES_DATA export below
  TIEFLING_DATA, // Paired with FIENDISH_LEGACIES_DATA export below
  ELADRIN_DATA,

  // Gnome family
  GNOME_DATA,
  DEEP_GNOME_DATA,

  // Elemental/planar infusions
  AASIMAR_DATA,
  AIR_GENASI_DATA,
  EARTH_GENASI_DATA,
  FIRE_GENASI_DATA,
  WATER_GENASI_DATA,

  // Fae and shapeshifters
  FAIRY_DATA,
  CHANGELING_DATA,

  // Giantkin and sturdy adventurers
  GOLIATH_DATA, // Related benefits re-exported via GIANT_ANCESTRY_BENEFITS_DATA
  FIRBOLG_DATA,
  BUGBEAR_DATA,
  ORC_DATA,
  DUERGAR_DATA,

  // Martial and psionic cultures
  GITHYANKI_DATA,
  GITHZERAI_DATA,

  // Agile and nomadic peoples
  AARAKOCRA_DATA,
  CENTAUR_DATA,
  GOBLIN_DATA,
]);

/**
 * A record containing all available race data, keyed by race ID.
 * This is derived from ACTIVE_RACES to ensure consistency and is frozen
 * to prevent runtime mutations, which could desynchronize game state.
 */
// Why: The previous implementation had a separate ACTIVE_RACES_DATA list, which was redundant.
// This version uses ACTIVE_RACES as the single source of truth, simplifying the code
// and reducing the chance of data inconsistencies. The duplicate ID check that was here
// has been moved to a dedicated validation script (`scripts/validate-data.ts`) to centralize
// data integrity checks.
export const ALL_RACES_DATA: Record<string, Race> = Object.freeze(
  Object.fromEntries(ACTIVE_RACES.map(race => [race.id, race])),
);

/**
 * A comprehensive bundle of all race-related data, including lineages, subraces,
 * and other unique racial choices. This is structured to provide a single,
 * easily importable object for all non-core race data.
 */
// Why: Previously, various race-specific data objects (like Dragonborn ancestries) were
// exported individually. This made imports cluttered and less organized. By grouping
// them into a single, well-typed `RACE_DATA_BUNDLE`, we create a cleaner, more
// maintainable API for accessing this data. The bundle is frozen to prevent runtime
// mutations, ensuring data integrity.
export const RACE_DATA_BUNDLE = Object.freeze({
  dragonbornAncestries: DRAGONBORN_ANCESTRIES_DATA,
  goliathGiantAncestries: GIANT_ANCESTRY_BENEFITS_DATA,
  tieflingLegacies: FIENDISH_LEGACIES_DATA,
});
