/**
 * @file raceMap.ts — maps EVERY race id in the game to a species profile.
 *
 * Resolution order (no silent fallbacks — unknown race ids throw):
 *   1. the race must exist in ALL_RACES_DATA;
 *   2. profile = per-race override profile, else the race group's default;
 *   3. per-race overrides (palette, frame, features) merge on top.
 *
 * The coverage test (raceMap.test.ts) walks ALL_RACES_DATA, so adding a race
 * to the game without extending this map fails CI loudly.
 */
import { ALL_RACES_DATA } from '../../data/races';
import type { SpeciesProfile } from './speciesProfiles';
import { SPECIES_PROFILES } from './speciesProfiles';
import type { PartInstance } from './types';

interface RaceOverride {
  /** Use a different profile than the group default. */
  profile?: string;
  /** Shallow field overrides applied after the profile is copied. */
  overrides?: Partial<SpeciesProfile>;
}

/** Default profile per race group (Race.baseRace, else the race's own id). */
const GROUP_PROFILES: Record<string, string> = {
  human: 'human',
  elf: 'elf',
  eladrin: 'elf',
  half_elf: 'halfElf',
  dwarf: 'dwarf',
  halfling: 'halfling',
  gnome: 'gnome',
  goliath: 'goliath',
  greenskins: 'orcish',
  tiefling: 'tiefling',
  draconic_kin: 'dragonborn',
  aasimar: 'aasimar',
  genasi: 'genasi',
  gith: 'gith',
  beastfolk: 'feline',
  constructed: 'constructed',
  feyfolk: 'feyfolk',
  planar_travelers: 'planar',
  shapeshifters: 'shifter',
};

const dragonChroma = (skin: string, eye: string): RaceOverride => ({
  overrides: { skinTones: [skin], eyeTones: [eye] },
});

const skin = (...tones: string[]): Partial<SpeciesProfile> => ({ skinTones: tones });

/** Per-race adjustments. Races not listed use their group default as-is. */
const RACE_OVERRIDES: Record<string, RaceOverride> = {
  // --- elves: lineage palettes
  drow: { overrides: skin('#5a4468', '#4a3a58', '#6e5a7a') },
  half_elf_drow: { overrides: skin('#8a7a98', '#9a8aa8') },
  pallid_elf: { overrides: skin('#e8e4dc', '#dcd8d0') },
  astral_elf: { overrides: skin('#d9cfa8', '#e8dfc4') },
  shadar_kai: { overrides: skin('#9a9aa2', '#8a8a92') },
  shadowveil_elf: { overrides: skin('#7a7a88', '#6a6a78') },
  sea_elf: { overrides: skin('#6a9a9a', '#5a8a8a', '#7aa8a0') },
  autumn_eladrin: { overrides: skin('#c9863a', '#b9762e') },
  spring_eladrin: { overrides: skin('#9ab86a', '#8aa85a') },
  summer_eladrin: { overrides: skin('#d9a44e', '#c99a63') },
  winter_eladrin: { overrides: skin('#b4c4d9', '#a8b8cc') },
  // --- dwarves
  duergar: { overrides: skin('#9a9aa2', '#8a8a92', '#7f7f88') },
  // --- gnomes
  deep_gnome: { overrides: skin('#9a8f96', '#8a7f88') },
  // --- halflings
  stout_halfling: { overrides: { bulkRange: [1.1, 1.3] } },
  // --- greenskins that are not orcs
  goblin: { profile: 'goblinoid' },
  verdan: { profile: 'goblinoid', overrides: skin('#7f9a5a', '#5a9a8a') },
  hobgoblin: { profile: 'hobgoblin' },
  bugbear: { profile: 'bugbear' },
  half_orc: { overrides: { bulkRange: [1.15, 1.4], skinTones: ['#8a9a6a', '#9aa07a', '#a89a72'] } },
  pathfinder_half_orc: { overrides: { bulkRange: [1.15, 1.4], skinTones: ['#8a9a6a', '#9aa07a'] } },
  // --- dragonborn chroma
  black_dragonborn: dragonChroma('#3a3a42', '#c9a227'),
  blue_dragonborn: dragonChroma('#3a5a9a', '#c9a227'),
  brass_dragonborn: dragonChroma('#c9a463', '#8a3333'),
  bronze_dragonborn: dragonChroma('#a8783a', '#4a7a4e'),
  copper_dragonborn: dragonChroma('#b4643a', '#4a7a4e'),
  gold_dragonborn: dragonChroma('#d9a828', '#8a3333'),
  green_dragonborn: dragonChroma('#4a7a44', '#c9a227'),
  red_dragonborn: dragonChroma('#a2382e', '#c9a227'),
  silver_dragonborn: dragonChroma('#b9c2cc', '#33506e'),
  white_dragonborn: dragonChroma('#dfe4ea', '#33506e'),
  draconblood_dragonborn: dragonChroma('#8a5a68', '#c9a227'),
  ravenite_dragonborn: dragonChroma('#5a5c66', '#8a3333'),
  kobold: { profile: 'kobold' },
  // --- goliath giant ancestries tint the stone skin
  fire_giant_goliath: { overrides: skin('#b05c3a', '#9aa0a6') },
  frost_giant_goliath: { overrides: skin('#b4c4d9', '#9aa0a6') },
  cloud_giant_goliath: { overrides: skin('#c4c9d4', '#b7bdc4') },
  storm_giant_goliath: { overrides: skin('#7a8a99', '#9aa0a6') },
  hill_giant_goliath: { overrides: skin('#a89e91', '#9a8a72') },
  // --- tiefling legacies
  abyssal_tiefling: { overrides: skin('#8a3346', '#a2402e') },
  chthonic_tiefling: { overrides: skin('#5a4468', '#6e3a8a') },
  infernal_tiefling: { overrides: skin('#a2402e', '#b05c3a') },
  // --- genasi elements
  air_genasi: { overrides: skin('#b4c4d9', '#c4d4e4') },
  earth_genasi: { overrides: skin('#8a7a5a', '#9a8a6a') },
  fire_genasi: {
    overrides: {
      skinTones: ['#b05c3a', '#c26a42'],
      features: [{ partId: 'crest', anchor: 'crown' } satisfies PartInstance],
    },
  },
  water_genasi: { overrides: skin('#6a9a9a', '#7aa8a0') },
  // --- beastfolk, one by one
  aarakocra: {
    profile: 'avian',
    overrides: {
      features: [
        { partId: 'beak', anchor: 'head' },
        { partId: 'crest', anchor: 'crown' },
        { partId: 'wingsFeathered', anchor: 'back' },
      ],
    },
  },
  kenku: { profile: 'avian', overrides: skin('#3a3a42', '#4a4a52') },
  giff: { profile: 'bulky', overrides: skin('#8a8a92', '#9aa0a6') },
  hadozee: { profile: 'simian' },
  harengon: { profile: 'harengon' },
  leonin: {
    profile: 'feline',
    overrides: { bulkRange: [1.15, 1.35], skinTones: ['#c9a463', '#b78a4e'] },
  },
  lizardfolk: { profile: 'reptilian' },
  loxodon: {
    profile: 'bulky',
    overrides: {
      features: [
        { partId: 'snout', anchor: 'jaw', params: { lengthScale: 2.2, droop: 0.85 } },
        { partId: 'earsLong', anchor: 'head' },
      ],
      skinTones: ['#8a8a92', '#9a9aa2'],
    },
  },
  minotaur: {
    profile: 'bulky',
    overrides: {
      features: [
        { partId: 'hornsCurved', anchor: 'head', params: { colorHex: '#e8ddc8' } },
        { partId: 'muzzleShort', anchor: 'jaw' },
        { partId: 'tailThin', anchor: 'tailRoot' },
      ],
      skinTones: ['#7a5a3a', '#8a6a4a'],
    },
  },
  tabaxi: { profile: 'feline' },
  thri_kreen: { profile: 'insectoid' },
  tortle: {
    profile: 'bulky',
    overrides: {
      heightRangeFt: [5.5, 6.2],
      features: [
        { partId: 'muzzleShort', anchor: 'jaw' },
        { partId: 'belly', anchor: 'hips', params: { size: 1.25 } },
      ],
      skinTones: ['#6a8a5a', '#7a8a4a'],
    },
  },
  yuan_ti: { profile: 'reptilian', overrides: skin('#5a7a44', '#6e8a3e', '#8a9a4a') },
  // --- constructed
  autognome: { overrides: { heightRangeFt: [2.9, 3.6], bulkRange: [0.9, 1.1], headScale: 1.25 } },
  // --- feyfolk, one by one
  centaur: {
    overrides: {
      gait: 'quad',
      heightRangeFt: [6.0, 7.0],
      bulkRange: [1.2, 1.4],
      features: [{ partId: 'tailThin', anchor: 'tailRoot', params: { droop: 0.55 } }],
      skinTones: ['#8a6a4a', '#7a5a3a', '#c68642'],
    },
  },
  fairy: {
    overrides: {
      heightRangeFt: [2.5, 3.0],
      bulkRange: [0.7, 0.85],
      features: [
        { partId: 'earsPointed', anchor: 'head' },
        { partId: 'wingsMembrane', anchor: 'back' },
      ],
      skinTones: ['#f1c27d', '#d9b4d9', '#b4d9c4'],
    },
  },
  firbolg: {
    overrides: {
      heightRangeFt: [7.0, 7.8],
      bulkRange: [1.25, 1.45],
      features: [
        { partId: 'earsPointed', anchor: 'head', params: { lengthScale: 1.2 } },
        { partId: 'brow', anchor: 'head' },
      ],
      skinTones: ['#9ab4d9', '#a8b8a8', '#c9b49a'],
    },
  },
  satyr: {
    overrides: {
      features: [
        { partId: 'hornsRam', anchor: 'head' },
        { partId: 'tailThin', anchor: 'tailRoot', params: { lengthScale: 0.35 } },
      ],
    },
  },
  // --- planar travelers
  kender: { profile: 'halfling', overrides: { headScale: 1.1 } },
  kalashtar: { profile: 'human', overrides: skin('#e8d4c4', '#f1e0c8') },
  triton: { overrides: { features: [{ partId: 'crest', anchor: 'crown' }], skinTones: ['#6a9a9a', '#5a8aa8', '#7aa8b4'] } },
  vedalken: { overrides: { heightRangeFt: [6.0, 6.6], bulkRange: [0.8, 0.95], skinTones: ['#7a9ac4', '#6a8ab4'] } },
  simic_hybrid: { overrides: { features: [{ partId: 'crest', anchor: 'crown' }], skinTones: ['#6a9a8a', '#7aa87a'] } },
  // --- shapeshifters
  changeling: { profile: 'planar', overrides: skin('#e8e4ec', '#dcd8e4') },
  plasmoid: {
    overrides: {
      gait: 'hopper',
      heightRangeFt: [4.5, 5.5],
      bulkRange: [1.2, 1.45],
      headScale: 1.1,
      features: [],
      skinTones: ['#8aa87a', '#9ab86a', '#7a9a8a'],
    },
  },
  beasthide_shifter: { overrides: { bulkRange: [1.15, 1.35] } },
  longtooth_shifter: {
    overrides: {
      features: [
        { partId: 'muzzleShort', anchor: 'jaw' },
        { partId: 'tuskJaw', anchor: 'jaw' },
        { partId: 'earsPointed', anchor: 'head' },
        { partId: 'tailThin', anchor: 'tailRoot' },
      ],
    },
  },
};

/** Resolve a race id to its fully merged species profile. Throws on unknown ids. */
export function profileForRace(raceId: string): SpeciesProfile {
  const race = ALL_RACES_DATA[raceId];
  if (!race) {
    throw new Error(`entities3d: unknown race id "${raceId}"`);
  }
  const override = RACE_OVERRIDES[raceId];
  const group = race.baseRace ?? race.id;
  const profileId = override?.profile ?? GROUP_PROFILES[group];
  const base = profileId ? SPECIES_PROFILES[profileId] : undefined;
  if (!base) {
    throw new Error(
      `entities3d: race "${raceId}" (group "${group}") has no species profile mapping`,
    );
  }
  return { ...base, ...(override?.overrides ?? {}) };
}
