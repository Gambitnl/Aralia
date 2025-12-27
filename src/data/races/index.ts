/**
 * @file src/data/races/index.ts
 * This file serves as an aggregator for all race data defined in the `src/data/races/` directory.
 * It imports individual race data objects (e.g., Human, Elf, Dwarf, Dragonborn) and exports
 * them as a consolidated `ALL_RACES_DATA` object, which maps race IDs to their respective Race data.
 * It also re-exports specific data like `DRAGONBORN_ANCESTRIES_DATA`.
 */
import type { Race } from '../../types'; // Path relative to src/data/races/
import { AARAKOCRA_DATA } from './aarakocra';
import { AASIMAR_DATA } from './aasimar';
import { AIR_GENASI_DATA } from './air_genasi';
import { BUGBEAR_DATA } from './bugbear';
import { CENTAUR_DATA } from './centaur';
import { CHANGELING_DATA } from './changeling';
import { DRAGONBORN_ANCESTRIES_DATA, DRAGONBORN_DATA } from './dragonborn';
import { DUERGAR_DATA } from './duergar';
import { DWARF_DATA } from './dwarf';
import { EARTH_GENASI_DATA } from './earth_genasi';
import { ELF_DATA } from './elf';
import { ELADRIN_DATA } from './eladrin';
import { FAIRY_DATA } from './fairy';
import { FIENDISH_LEGACIES_DATA, TIEFLING_DATA } from './tiefling';
import { FIRBOLG_DATA } from './firbolg';
import { FIRE_GENASI_DATA } from './fire_genasi';
import { GIANT_ANCESTRY_BENEFITS_DATA, GOLIATH_DATA } from './goliath';
import { GITHYANKI_DATA } from './githyanki';
import { GITHZERAI_DATA } from './githzerai';
import { GNOME_DATA, GNOME_SUBRACES_DATA } from './gnome';
import { GOBLIN_DATA } from './goblin';
import { HALFLING_DATA } from './halfling';
import { HUMAN_DATA } from './human';
import { ORC_DATA } from './orc';
import { TABAXI_DATA } from './tabaxi';
import { WATER_GENASI_DATA } from './water_genasi';

/**
 * A frozen array of all active races, ensuring runtime immutability.
 * This list serves as the single source of truth for which races are available in the game,
 * providing a stable order for UI elements like character creation dropdowns.
 */
export const ALL_RACES_DATA: Record<string, Race> = Object.freeze({
  human: HUMAN_DATA,
  elf: ELF_DATA,
  dwarf: DWARF_DATA,
  halfling: HALFLING_DATA,
  dragonborn: DRAGONBORN_DATA,
  tiefling: TIEFLING_DATA,
  eladrin: ELADRIN_DATA,
  gnome: GNOME_DATA,
  aasimar: AASIMAR_DATA,
  air_genasi: AIR_GENASI_DATA,
  earth_genasi: EARTH_GENASI_DATA,
  fire_genasi: FIRE_GENASI_DATA,
  water_genasi: WATER_GENASI_DATA,
  fairy: FAIRY_DATA,
  changeling: CHANGELING_DATA,
  goliath: GOLIATH_DATA,
  firbolg: FIRBOLG_DATA,
  bugbear: BUGBEAR_DATA,
  orc: ORC_DATA,
  duergar: DUERGAR_DATA,
  githyanki: GITHYANKI_DATA,
  githzerai: GITHZERAI_DATA,
  aarakocra: AARAKOCRA_DATA,
  centaur: CENTAUR_DATA,
  goblin: GOBLIN_DATA,
  tabaxi: TABAXI_DATA,
});

/**
 * A frozen array of all active races, ensuring runtime immutability.
 * This list is derived from `ALL_RACES_DATA` to serve as the single source of truth,
 * providing a stable order for UI elements like character creation dropdowns.
 */
// Why: Deriving this array from the `ALL_RACES_DATA` object ensures that the list
// and the lookup map can't fall out of sync. It centralizes the race definitions
// in one place, making it easier to add, remove, or modify races without
// introducing inconsistencies. The order is preserved from the object definition.
export const ACTIVE_RACES: readonly Race[] = Object.freeze(Object.values(ALL_RACES_DATA));

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
  gnomeSubraces: GNOME_SUBRACES_DATA,
});
