/**
 * @file recipeFromOccupant.ts — interior villager render packet → entity recipe.
 *
 * Household members carry an ancestry GROUP (a raceGroups display name like
 * "Elf" or "Greenskins"), not a concrete race id. Each group maps to a few
 * townsfolk-plausible concrete races; the pick is deterministic per member id
 * so a villager's body never changes between visits. Villagers are commoners:
 * no gear. A packet with no race (older bakes) renders the human commoner;
 * an unrecognized group throws.
 */
import { SeededRandom } from '../../utils/random/seededRandom';
import type { AgeBand, EntityRecipe } from './types';

/** Ancestry group (raceGroups display name) → townsfolk-plausible race ids. */
const GROUP_CANDIDATES: Record<string, string[]> = {
  Human: ['human'],
  Elf: ['high_elf', 'wood_elf'],
  Eladrin: ['autumn_eladrin', 'summer_eladrin'],
  Dwarf: ['hill_dwarf', 'mountain_dwarf'],
  Halfling: ['halfling', 'lightfoot_halfling', 'stout_halfling'],
  Gnome: ['rock_gnome', 'forest_gnome'],
  'Half-Elf': ['half_elf'],
  Greenskins: ['half_orc', 'orc', 'hobgoblin', 'goblin'],
  Goliath: ['goliath'],
  Tiefling: ['tiefling'],
  Aasimar: ['protector_aasimar'],
  'Draconic Kin': ['bronze_dragonborn', 'copper_dragonborn', 'brass_dragonborn'],
  Beastfolk: ['tabaxi', 'harengon', 'tortle'],
  Genasi: ['earth_genasi', 'water_genasi'],
  Gith: ['githzerai'],
  Shapeshifters: ['changeling', 'beasthide_shifter'],
  Feyfolk: ['firbolg', 'satyr'],
  Constructed: ['warforged'],
  'Planar Travelers': ['triton', 'kalashtar'],
};

export interface OccupantIdentity {
  /** Stable per-member id (plotId * 100 + memberIndex). */
  id: number;
  ageBand: string;
  /** Ancestry group name; absent on packets from older bakes. */
  race?: string;
}

/** Build the recipe for one interior villager. */
export function recipeFromOccupant(occ: OccupantIdentity): EntityRecipe {
  let raceId = 'human';
  if (occ.race) {
    const candidates = GROUP_CANDIDATES[occ.race];
    if (!candidates) {
      throw new Error(`entities3d: unknown ancestry group "${occ.race}" (occupant ${occ.id})`);
    }
    raceId = candidates[new SeededRandom(occ.id * 977 + 13).nextInt(0, candidates.length)];
  }
  const ageBand: AgeBand =
    occ.ageBand === 'child' || occ.ageBand === 'elder' ? occ.ageBand : 'adult';
  return {
    kind: 'humanoid',
    raceId,
    classId: 'fighter', // accent tint only — commoners carry no gear
    seed: `occupant:${occ.id}`,
    gearOverride: [],
    ageBand,
  };
}
