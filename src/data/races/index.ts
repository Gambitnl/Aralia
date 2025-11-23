/**
 * @file src/data/races/index.ts
 * This file serves as an aggregator for all race data defined in the `src/data/races/` directory.
 * It imports individual race data objects (e.g., Human, Elf, Dwarf, Dragonborn) and exports
 * them as a consolidated `ALL_RACES_DATA` object, which maps race IDs to their respective Race data.
 * It also re-exports specific data like `DRAGONBORN_ANCESTRIES_DATA`.
 */
import { HUMAN_DATA } from './human';
import { ELF_DATA } from './elf';
import { AASIMAR_DATA } from './aasimar';
import { DWARF_DATA } from './dwarf';
import { DRAGONBORN_DATA, DRAGONBORN_ANCESTRIES_DATA } from './dragonborn';
import { GNOME_DATA } from './gnome';
import { GOLIATH_DATA, GIANT_ANCESTRY_BENEFITS_DATA } from './goliath';
import { HALFLING_DATA } from './halfling';
import { ORC_DATA } from './orc';
import { TIEFLING_DATA, FIENDISH_LEGACIES_DATA } from './tiefling';
import { AARAKOCRA_DATA } from './aarakocra';
// DATA FOR AIR GENASI
import { AIR_GENASI_DATA } from './air_genasi';
import { BUGBEAR_DATA } from './bugbear';
import { CENTAUR_DATA } from './centaur';
import { CHANGELING_DATA } from './changeling';
import { DEEP_GNOME_DATA } from './deep_gnome';
import { DUERGAR_DATA } from './duergar';
import { EARTH_GENASI_DATA } from './earth_genasi';
import { ELADRIN_DATA } from './eladrin';
import { FAIRY_DATA } from './fairy';
import { FIRBOLG_DATA } from './firbolg';
import { FIRE_GENASI_DATA } from './fire_genasi';
import { GITHYANKI_DATA } from './githyanki';
import { GITHZERAI_DATA } from './githzerai';
import { GOBLIN_DATA } from './goblin';
import { WATER_GENASI_DATA } from './water_genasi';
import { Race } from '../../types'; // Path relative to src/data/races/

/**
 * A record containing all available race data, keyed by race ID.
 */
export const ALL_RACES_DATA: Record<string, Race> = {
  [HUMAN_DATA.id]: HUMAN_DATA,
  [ELF_DATA.id]: ELF_DATA,
  [AASIMAR_DATA.id]: AASIMAR_DATA,
  [DWARF_DATA.id]: DWARF_DATA,
  [DRAGONBORN_DATA.id]: DRAGONBORN_DATA,
  [GNOME_DATA.id]: GNOME_DATA,
  [DEEP_GNOME_DATA.id]: DEEP_GNOME_DATA,
  [GOLIATH_DATA.id]: GOLIATH_DATA,
  [HALFLING_DATA.id]: HALFLING_DATA,
  [ORC_DATA.id]: ORC_DATA,
  [TIEFLING_DATA.id]: TIEFLING_DATA,
  [AARAKOCRA_DATA.id]: AARAKOCRA_DATA,
  // DATA FOR AIR GENASI
  [AIR_GENASI_DATA.id]: AIR_GENASI_DATA,
  [BUGBEAR_DATA.id]: BUGBEAR_DATA,
  [CENTAUR_DATA.id]: CENTAUR_DATA,
  [CHANGELING_DATA.id]: CHANGELING_DATA,
  [DUERGAR_DATA.id]: DUERGAR_DATA,
  [EARTH_GENASI_DATA.id]: EARTH_GENASI_DATA,
  [ELADRIN_DATA.id]: ELADRIN_DATA,
  [FAIRY_DATA.id]: FAIRY_DATA,
  [FIRBOLG_DATA.id]: FIRBOLG_DATA,
  [FIRE_GENASI_DATA.id]: FIRE_GENASI_DATA,
  [GITHYANKI_DATA.id]: GITHYANKI_DATA,
  [GITHZERAI_DATA.id]: GITHZERAI_DATA,
  [GOBLIN_DATA.id]: GOBLIN_DATA,
  [WATER_GENASI_DATA.id]: WATER_GENASI_DATA,
};

/**
 * Data for Dragonborn ancestries, re-exported for easy access.
 */
export { DRAGONBORN_ANCESTRIES_DATA };

/**
 * Data for Goliath Giant Ancestry benefits, re-exported for easy access.
 */
export { GIANT_ANCESTRY_BENEFITS_DATA };

/**
 * Data for Tiefling Fiendish Legacies, re-exported for easy access.
 */
export { FIENDISH_LEGACIES_DATA as TIEFLING_LEGACIES_DATA };