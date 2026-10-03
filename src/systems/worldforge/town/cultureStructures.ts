/**
 * @file cultureStructures.ts
 *
 * The culture-keyed settlement vocabulary: WHAT a culture builds, as a
 * companion to architectureStyle.ts, which says HOW it builds them.
 *
 * This table is the harvested content of the retired 2D village generator
 * (`src/services/villageGenerator.ts`, deleted 2026-09-20 under Remy's world
 * sheet ruling q1 "harvest then delete"). That file was the only record of 24
 * culture-specific structure names — treehouses, stone halls, hide tents,
 * longhouses, totem poles, lighthouses, arcane towers, nomad yurts — plus the
 * biome and race rules that chose between them. The town engine had geometry,
 * population and construction materials, but no culture-keyed building names.
 *
 * Three axes, kept separate on purpose:
 *
 *   1. CULTURE_STRUCTURES — the 24 names, each mapped onto the town engine's
 *      existing `BuildingType` (town/population.ts) and, where one exists, its
 *      `CivicKind` (town/townEngine.ts). No union was extended: every harvested
 *      name resolves to a type the plot packer, the housing math and the
 *      interior pipeline already understand.
 *   2. CULTURE_ACCENTS — the eight settlement accents of
 *      `VillagePersonality['architecturalStyle']`, each naming the civic,
 *      commercial and residential structures it prefers. Harvested verbatim
 *      from the retired file's getShopTypesForPersonality and
 *      getHouseTypesForPersonality.
 *   3. STYLE_FAMILY_ACCENTS — which accents each of the five Worldforge
 *      architecture families (architectureStyle.ts STYLE_FAMILIES) can wear.
 *      This is the bridge from an FMG culture type to the harvested vocabulary.
 *
 * The two resolvers below (biomeStyleForFamily, cultureAccentFor) carry the
 * retired file's inferBiomeStyle and inferArchitecturalStyle rules unchanged in
 * meaning. Following the no-fallback directive and the throw in
 * `styleFamilyForCultureType`, both tables are TOTAL over their closed
 * vocabularies — the eleven biome families of `src/data/biomes.ts` and the nine
 * playable races — and an unknown key is an ERROR, not a default.
 *
 * Note on `gatehouse`: the harvest list circulated on the board named it as a
 * 25th culture structure, but in the retired file it was a CivicTileType, not a
 * CulturalTileType, and Worldforge already owns it — see `GatehouseForm` and
 * `styledGatehouseForm` in architectureStyle.ts. It is deliberately absent here.
 */
import type { VillagePersonality } from '../../../types/village';
import type { CivicKind } from './townEngine';
import type { BuildingType } from './population';
import type { ArchitectureFamilyId } from './buildingMaterials';

/** The 24 culture-specific structures the retired village generator authored. */
export type CultureStructureName =
  // Elven
  | 'treehouse_small' | 'treehouse_large' | 'ancient_circle' | 'weaver_hall'
  // Dwarven
  | 'stone_hall_small' | 'stone_hall_large' | 'forge_temple' | 'underground_entrance'
  // Orcish
  | 'hide_tent' | 'longhouse' | 'totem_pole' | 'war_memorial'
  // Aquatic/Marine
  | 'dock' | 'lighthouse' | 'shipwright' | 'fish_market'
  // Magical
  | 'magic_academy' | 'arcane_tower' | 'healers_hut' | 'alchemist_shop'
  // Exotic
  | 'caravan_stop' | 'nomad_yurt' | 'trading_post' | 'shrine';

/** Which slot of a settlement a structure fills. */
export type CultureStructureRole = 'civic' | 'commercial' | 'residential';

export interface CultureStructure {
  name: CultureStructureName;
  /** The culture group that authored the name, kept for readable tables. */
  culture: 'elven' | 'dwarven' | 'orcish' | 'marine' | 'magical' | 'exotic';
  role: CultureStructureRole;
  /** The town-engine building type this name is a cultural dress for. */
  buildingType: BuildingType;
  /** Set only when the structure is also a town-scale civic landmark. */
  civicKind?: CivicKind;
  /** One line a describer or a map tooltip can read aloud. */
  blurb: string;
}

/**
 * Every harvested name, mapped onto the unions the town engine already uses.
 * The mapping is the point: a treehouse is a cottage the plot packer can place
 * and the interior pipeline can furnish, dressed in an elven name.
 */
export const CULTURE_STRUCTURES: Record<CultureStructureName, CultureStructure> = {
  // Elven
  treehouse_small: {
    name: 'treehouse_small', culture: 'elven', role: 'residential', buildingType: 'cottage',
    blurb: 'A single family platform grown into the canopy.',
  },
  treehouse_large: {
    name: 'treehouse_large', culture: 'elven', role: 'residential', buildingType: 'townhouse',
    blurb: 'Linked canopy halls for a whole bough of kin.',
  },
  ancient_circle: {
    name: 'ancient_circle', culture: 'elven', role: 'civic', buildingType: 'civic', civicKind: 'temple',
    blurb: 'Standing stones older than the settlement around them.',
  },
  weaver_hall: {
    name: 'weaver_hall', culture: 'elven', role: 'commercial', buildingType: 'workshop',
    blurb: 'Looms of spider silk and dyed bark fibre.',
  },

  // Dwarven
  stone_hall_small: {
    name: 'stone_hall_small', culture: 'dwarven', role: 'residential', buildingType: 'cottage',
    blurb: 'A low cut-stone dwelling with a deep hearth.',
  },
  stone_hall_large: {
    name: 'stone_hall_large', culture: 'dwarven', role: 'residential', buildingType: 'townhouse',
    blurb: 'A clan hall of dressed stone and iron banding.',
  },
  forge_temple: {
    name: 'forge_temple', culture: 'dwarven', role: 'commercial', buildingType: 'smithy', civicKind: 'temple',
    blurb: 'Where the anvil is the altar and the fire never dies.',
  },
  underground_entrance: {
    name: 'underground_entrance', culture: 'dwarven', role: 'civic', buildingType: 'civic',
    blurb: 'A buttressed stair head into the delvings below.',
  },

  // Orcish
  hide_tent: {
    name: 'hide_tent', culture: 'orcish', role: 'residential', buildingType: 'cottage',
    blurb: 'Stretched hides over a frame, struck in a morning.',
  },
  longhouse: {
    name: 'longhouse', culture: 'orcish', role: 'residential', buildingType: 'tenement',
    blurb: 'One roof, one fire, many families down its length.',
  },
  totem_pole: {
    name: 'totem_pole', culture: 'orcish', role: 'civic', buildingType: 'civic',
    blurb: 'Carved ancestors watching the approach road.',
  },
  war_memorial: {
    name: 'war_memorial', culture: 'orcish', role: 'civic', buildingType: 'civic',
    blurb: 'Weapons of the fallen driven into a cairn.',
  },

  // Aquatic/Marine
  dock: {
    name: 'dock', culture: 'marine', role: 'civic', buildingType: 'civic', civicKind: 'dock',
    blurb: 'Pilings and planking where the boats come in.',
  },
  lighthouse: {
    name: 'lighthouse', culture: 'marine', role: 'civic', buildingType: 'civic',
    blurb: 'A banked fire above the rocks, tended all night.',
  },
  shipwright: {
    name: 'shipwright', culture: 'marine', role: 'commercial', buildingType: 'workshop',
    blurb: 'Keels on the slipway and the smell of pitch.',
  },
  fish_market: {
    name: 'fish_market', culture: 'marine', role: 'commercial', buildingType: 'shop',
    blurb: 'Slabs, ice and the morning catch shouted over.',
  },

  // Magical
  magic_academy: {
    name: 'magic_academy', culture: 'magical', role: 'civic', buildingType: 'civic',
    blurb: 'Lecture halls and warded practice yards.',
  },
  arcane_tower: {
    name: 'arcane_tower', culture: 'magical', role: 'commercial', buildingType: 'workshop',
    blurb: 'One resident, several floors, unexplained lights.',
  },
  healers_hut: {
    name: 'healers_hut', culture: 'magical', role: 'commercial', buildingType: 'shop',
    blurb: 'Drying herbs, clean linen and a waiting bench.',
  },
  alchemist_shop: {
    name: 'alchemist_shop', culture: 'magical', role: 'commercial', buildingType: 'shop',
    blurb: 'Glassware, a vented roof and a careful proprietor.',
  },

  // Exotic
  caravan_stop: {
    name: 'caravan_stop', culture: 'exotic', role: 'commercial', buildingType: 'inn',
    blurb: 'Water, a walled yard and beds for the drovers.',
  },
  nomad_yurt: {
    name: 'nomad_yurt', culture: 'exotic', role: 'residential', buildingType: 'cottage',
    blurb: 'Felt over a lattice, warm against an open plain.',
  },
  trading_post: {
    name: 'trading_post', culture: 'exotic', role: 'commercial', buildingType: 'shop',
    blurb: 'Scales, ledgers and whatever the last road brought.',
  },
  shrine: {
    name: 'shrine', culture: 'exotic', role: 'civic', buildingType: 'civic', civicKind: 'temple',
    blurb: 'A roadside niche kept in offerings by strangers.',
  },
};

export const CULTURE_STRUCTURE_NAMES = Object.keys(CULTURE_STRUCTURES) as CultureStructureName[];

/** The settlement accent axis, shared with the live `VillagePersonality` type. */
export type CultureAccent = VillagePersonality['architecturalStyle'];

export interface CultureAccentVocabulary {
  /** Landmark structures this accent raises for the whole settlement. */
  civic: CultureStructureName[];
  /** Trade structures this accent adds beyond the generic shop set. */
  commercial: CultureStructureName[];
  /** Dwelling names, most prestigious first, as the retired file ordered them. */
  residential: CultureStructureName[];
}

/**
 * Harvested from villageGenerator's getShopTypesForPersonality and
 * getHouseTypesForPersonality. An accent with an empty list builds the generic
 * Worldforge vocabulary for that slot (`cottage`, `shop`, `smithy`) with no
 * culture-keyed dress — that was the retired file's `else` branch, not a gap.
 */
export const CULTURE_ACCENTS: Record<CultureAccent, CultureAccentVocabulary> = {
  magical: {
    civic: ['magic_academy', 'ancient_circle'],
    commercial: ['alchemist_shop', 'healers_hut', 'arcane_tower', 'weaver_hall'],
    residential: ['treehouse_large', 'treehouse_small'],
  },
  industrial: {
    civic: ['underground_entrance'],
    commercial: ['forge_temple'],
    residential: ['stone_hall_large', 'stone_hall_small'],
  },
  tribal: {
    civic: ['totem_pole', 'war_memorial'],
    commercial: [],
    residential: ['longhouse', 'hide_tent'],
  },
  aquatic: {
    civic: ['dock', 'lighthouse'],
    commercial: ['fish_market', 'shipwright'],
    residential: [],
  },
  nomadic: {
    civic: ['shrine'],
    commercial: ['caravan_stop', 'trading_post'],
    residential: ['nomad_yurt'],
  },
  colonial: { civic: [], commercial: ['trading_post'], residential: [] },
  martial: { civic: ['war_memorial'], commercial: [], residential: [] },
  medieval: { civic: ['shrine'], commercial: [], residential: [] },
};

/**
 * Which accents a Worldforge architecture family can wear. The families come
 * from STYLE_FAMILIES in architectureStyle.ts, which an FMG culture type
 * already selects, so this table completes the path from a burg's culture to a
 * culture-keyed building name. The first accent of each list is the family's
 * default reading; the rest are the variation a district may take.
 */
export const STYLE_FAMILY_ACCENTS: Record<ArchitectureFamilyId, CultureAccent[]> = {
  highlandStone: ['industrial', 'martial'],
  coastalTimber: ['aquatic', 'colonial'],
  riverHalfTimber: ['medieval', 'colonial'],
  roughLog: ['tribal', 'nomadic'],
  temperateFrame: ['medieval', 'magical'],
};

/** Every culture-keyed structure a style family may raise, in table order. */
export function structuresForStyleFamily(familyId: ArchitectureFamilyId): CultureStructureName[] {
  const accents = STYLE_FAMILY_ACCENTS[familyId];
  if (!accents) throw new Error(`No culture accents for architecture family "${familyId}"`);
  const seen = new Set<CultureStructureName>();
  for (const accent of accents) {
    const vocab = CULTURE_ACCENTS[accent];
    for (const name of [...vocab.civic, ...vocab.commercial, ...vocab.residential]) seen.add(name);
  }
  return [...seen];
}

/**
 * Biome family → settlement biome style. Harvested from inferBiomeStyle. The
 * key vocabulary is the eleven families of `src/data/biomes.ts` VARIANTS plus
 * the `special` family its three standalone biomes carry. `forest`, `plains`
 * and `special` read as temperate, which was the retired file's default arm.
 */
export const BIOME_FAMILY_TO_BIOME_STYLE: Record<string, VillagePersonality['biomeStyle']> = {
  desert: 'arid',
  coastal: 'coastal',
  wetland: 'swampy',
  jungle: 'jungle',
  tundra: 'tundra',
  volcanic: 'volcanic',
  blight: 'blighted',
  mountain: 'highland',
  forest: 'temperate',
  plains: 'temperate',
  special: 'temperate',
};

export function biomeStyleForFamily(family: string): VillagePersonality['biomeStyle'] {
  const style = BIOME_FAMILY_TO_BIOME_STYLE[family];
  if (!style) throw new Error(`No settlement biome style for biome family "${family}"`);
  return style;
}

/** Race → culture accent. Race outranks biome, as the retired file had it. */
export const RACE_TO_CULTURE_ACCENT: Record<string, CultureAccent> = {
  elf: 'magical',
  gnome: 'magical',
  tiefling: 'magical',
  dwarf: 'industrial',
  orc: 'tribal',
  halfling: 'colonial',
  dragonborn: 'martial',
  human: 'medieval',
  other: 'medieval',
};

/** Biome family → culture accent, used when no race dominates the settlement. */
export const BIOME_FAMILY_TO_CULTURE_ACCENT: Record<string, CultureAccent> = {
  forest: 'magical',
  mountain: 'industrial',
  desert: 'nomadic',
  coastal: 'aquatic',
  wetland: 'tribal',
  jungle: 'tribal',
  tundra: 'colonial',
  volcanic: 'industrial',
  blight: 'magical',
  plains: 'medieval',
  special: 'medieval',
};

export interface CultureAccentInput {
  /** A biome family from `src/data/biomes.ts`, not an FMG biome id. */
  biomeFamily: string;
  /** The settlement's dominant race, when one is known. */
  dominantRace?: string;
  /** True when the biome carries anything other than mundane magic. */
  magicalBiome?: boolean;
}

/**
 * Harvested from inferArchitecturalStyle. Race first, then a magical biome
 * with no dominant race, then the biome family table.
 */
export function cultureAccentFor(input: CultureAccentInput): CultureAccent {
  if (input.dominantRace) {
    const byRace = RACE_TO_CULTURE_ACCENT[input.dominantRace];
    if (!byRace) throw new Error(`No culture accent for race "${input.dominantRace}"`);
    return byRace;
  }
  if (input.magicalBiome) return 'magical';
  const byBiome = BIOME_FAMILY_TO_CULTURE_ACCENT[input.biomeFamily];
  if (!byBiome) throw new Error(`No culture accent for biome family "${input.biomeFamily}"`);
  return byBiome;
}
