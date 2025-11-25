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
import { DEEP_GNOME_DATA } from './deep_gnome';
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
import { GNOME_DATA } from './gnome';
import { GOBLIN_DATA } from './goblin';
import { HALFLING_DATA } from './halfling';
import { HUMAN_DATA } from './human';
import { ORC_DATA } from './orc';
import { WATER_GENASI_DATA } from './water_genasi';

/**
 * Keeping the active races in a single list makes it obvious when a race
 * is intentionally removed (e.g., during cleanup of obsolete assets) and
 * prevents straggler imports from reintroducing retired data. The object
 * map is generated from this list to preserve the existing lookup shape.
 */
const ACTIVE_RACES_DATA: readonly Race[] = [
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
];

/**
 * Exporting the curated list directly is helpful for gameplay flows that
 * need a stable ordering (e.g., character creator dropdowns) without
 * relying on object iteration order. Freezing the exported array enforces
 * runtime immutability so consumers cannot mutate ordering or contents,
 * while still preserving the intentional source ordering above.
 */
export const ACTIVE_RACES: readonly Race[] = Object.freeze([
  ...ACTIVE_RACES_DATA,
]);

/**
 * A record containing all available race data, keyed by race ID.
 */
export const ALL_RACES_DATA: Record<string, Race> = Object.freeze(
  ACTIVE_RACES_DATA.reduce((acc, race) => {
    // Why: Explicitly mapping each race ID from the curated list avoids accidentally keeping
    // stale imports around after a race is removed elsewhere, while freeze guards against
    // runtime mutations that could desynchronize selectors or hooks.
    if (acc[race.id]) {
      // Why: Guard against identifier collisions so downstream selectors/hooks never see
      // ambiguous lookups or silently overwritten data when new races are added.
      throw new Error(`Duplicate race id detected while building ALL_RACES_DATA: ${race.id}`);
    }

    acc[race.id] = race;
    return acc;
  }, {} as Record<string, Race>),
);

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
