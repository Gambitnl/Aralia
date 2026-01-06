/**
 * @file index.ts
 * Aggregates all race data exports for centralized access.
 * New races should be imported here and added to ALL_RACES_DATA.
 */
import { Race } from '../../types';

import { HUMAN_DATA } from './human';
import { ELF_DATA } from './elf';
import { DWARF_DATA } from './dwarf';
import { HILL_DWARF_DATA } from './hill_dwarf';
import { HALFLING_DATA } from './halfling';
import { DRAGONBORN_DATA, DRAGONBORN_ANCESTRIES_DATA } from './dragonborn';
import { GNOME_DATA } from './gnome';
import { TIEFLING_DATA, FIENDISH_LEGACIES_DATA } from './tiefling';
import { ORC_DATA } from './orc';
import { GOLIATH_DATA, GIANT_ANCESTRY_BENEFITS_DATA } from './goliath';
import { AASIMAR_DATA } from './aasimar';
import { FIRBOLG_DATA } from './firbolg';
import { GOBLIN_DATA } from './goblin';
import { BUGBEAR_DATA } from './bugbear';
import { AARAKOCRA_DATA } from './aarakocra';
import { CHANGELING_DATA } from './changeling';
import { AIR_GENASI_DATA } from './air_genasi';
import { EARTH_GENASI_DATA } from './earth_genasi';
import { FIRE_GENASI_DATA } from './fire_genasi';
import { WATER_GENASI_DATA } from './water_genasi';
import { CENTAUR_DATA } from './centaur';
import { FAIRY_DATA } from './fairy';
import { ELADRIN_DATA } from './eladrin';
import { GITHYANKI_DATA } from './githyanki';
import { GITHZERAI_DATA } from './githzerai';
import { TABAXI_DATA } from './tabaxi';
import { DUERGAR_DATA } from './duergar';
import { TRITON_DATA } from './triton';
import { KENKU_DATA } from './kenku';


// Aggregated data map
export const ALL_RACES_DATA: Record<string, Race> = {
  human: HUMAN_DATA,
  elf: ELF_DATA,
  dwarf: DWARF_DATA,
  hill_dwarf: HILL_DWARF_DATA,
  halfling: HALFLING_DATA,
  dragonborn: DRAGONBORN_DATA,
  gnome: GNOME_DATA,
  tiefling: TIEFLING_DATA,
  orc: ORC_DATA,
  goliath: GOLIATH_DATA,
  aasimar: AASIMAR_DATA,
  firbolg: FIRBOLG_DATA,
  goblin: GOBLIN_DATA,
  bugbear: BUGBEAR_DATA,
  aarakocra: AARAKOCRA_DATA,
  changeling: CHANGELING_DATA,
  air_genasi: AIR_GENASI_DATA,
  earth_genasi: EARTH_GENASI_DATA,
  fire_genasi: FIRE_GENASI_DATA,
  water_genasi: WATER_GENASI_DATA,
  centaur: CENTAUR_DATA,
  fairy: FAIRY_DATA,
  eladrin: ELADRIN_DATA,
  githyanki: GITHYANKI_DATA,
  githzerai: GITHZERAI_DATA,
  tabaxi: TABAXI_DATA,
  duergar: DUERGAR_DATA,
  triton: TRITON_DATA,
  kenku: KENKU_DATA,
};

// Bundled exports for subraces/legacies that need to be accessed by constants.ts
// This prevents circular dependencies or missing exports
export const RACE_DATA_BUNDLE = {
  dragonbornAncestries: DRAGONBORN_ANCESTRIES_DATA,
  goliathGiantAncestries: GIANT_ANCESTRY_BENEFITS_DATA,
  tieflingLegacies: FIENDISH_LEGACIES_DATA,
};

// Array for iteration (e.g., character creator list)
// Updated to filter out legacy or helper entries if needed
export const ACTIVE_RACES = Object.values(ALL_RACES_DATA).sort((a, b) =>
  a.name.localeCompare(b.name)
);
