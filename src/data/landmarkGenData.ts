/**
 * @file src/data/landmarkGenData.ts
 *
 * Data components for procedural landmark generation.
 * Used by landmarkService to construct unique, varied landmarks.
 */

export interface LandmarkOrigin {
  id: string;
  name: string; // e.g., "Elven", "Dwarven", "Ancient"
  descriptionPrefix: string[]; // "Elegant", "Blocky", "Weather-worn"
  commonBiomes: string[];
  rewardTypes: ('item' | 'gold' | 'xp' | 'health')[];
  minLevel: number;
}

export interface LandmarkType {
  id: string;
  name: string; // e.g., "Ruins", "Statue", "Shrine"
  descriptionTemplates: string[];
  baseWeight: number;
}

export interface LandmarkState {
  id: string;
  nameSuffix: string; // e.g., "of the Dead", "in Ruins", "of Light"
  descriptionModifier: string; // "It is overgrown with vines.", "Shadows cling to it."
  consequenceTypes: ('buff' | 'map_reveal' | 'reputation')[];
  riskLevel: number; // 0-10, higher means more rewards but more danger (traps/encounters in future)
}

export const LANDMARK_ORIGINS: LandmarkOrigin[] = [
  {
    id: 'elven',
    name: 'Elven',
    descriptionPrefix: ['Elegant', 'Slender', 'Graceful', 'Moonlit'],
    commonBiomes: ['forest', 'plains'],
    rewardTypes: ['item', 'health', 'xp'],
    minLevel: 1,
  },
  {
    id: 'dwarven',
    name: 'Dwarven',
    descriptionPrefix: ['Blocky', 'Sturdy', 'Geometric', 'Stone-carved'],
    commonBiomes: ['mountain', 'hills', 'underdark'],
    rewardTypes: ['gold', 'item'],
    minLevel: 1,
  },
  {
    id: 'ancient',
    name: 'Ancient',
    descriptionPrefix: ['Crumbling', 'Weather-worn', 'Moss-covered', 'Forgotten'],
    commonBiomes: ['all'],
    rewardTypes: ['xp', 'gold'],
    minLevel: 1,
  },
  {
    id: 'draconic',
    name: 'Draconic',
    descriptionPrefix: ['Scorched', 'Scale-patterned', 'Ominous', 'Majestic'],
    commonBiomes: ['mountain', 'desert', 'underdark'],
    rewardTypes: ['gold', 'xp'],
    minLevel: 5,
  },
  {
    id: 'fey',
    name: 'Fey',
    descriptionPrefix: ['Shimmering', 'Impossible', 'Colorful', 'Illusionary'],
    commonBiomes: ['forest', 'swamp'],
    rewardTypes: ['health', 'xp'],
    minLevel: 3,
  }
];

export const LANDMARK_TYPES: LandmarkType[] = [
  {
    id: 'ruins',
    name: 'Ruins',
    descriptionTemplates: [
        'The shattered remains of a {origin} structure lie here.',
        'Walls of {origin} masonry stand defiant against time.',
    ],
    baseWeight: 3,
  },
  {
    id: 'statue',
    name: 'Statue',
    descriptionTemplates: [
        'A massive statue of {origin} design dominates the clearing.',
        'A lonely stone figure stands watch, crafted in the {origin} style.',
    ],
    baseWeight: 2,
  },
  {
    id: 'shrine',
    name: 'Shrine',
    descriptionTemplates: [
        'A small {origin} shrine sits undisturbed.',
        'An altar of {origin} make, covered in dust.',
    ],
    baseWeight: 2,
  },
  {
    id: 'tower',
    name: 'Tower',
    descriptionTemplates: [
        'A lone {origin} tower pierces the sky.',
        'The base of a great {origin} spire remains.',
    ],
    baseWeight: 1,
  },
  {
    id: 'cave',
    name: 'Cavern',
    descriptionTemplates: [
        'A natural cave entrance, reinforced with {origin} supports.',
        'The mouth of a tunnel, marked with {origin} runes.',
    ],
    baseWeight: 2,
  }
];

export const LANDMARK_STATES: LandmarkState[] = [
  {
    id: 'overgrown',
    nameSuffix: 'Overgrown',
    descriptionModifier: 'Thick vines and moss claim the stone.',
    consequenceTypes: ['map_reveal'],
    riskLevel: 1,
  },
  {
    id: 'haunted',
    nameSuffix: 'Haunted',
    descriptionModifier: 'A cold wind blows, and you hear faint whispers.',
    consequenceTypes: ['reputation'], // e.g. "Cleansing" it
    riskLevel: 5,
  },
  {
    id: 'blessed',
    nameSuffix: 'Sanctified',
    descriptionModifier: 'The air feels warm and safe.',
    consequenceTypes: ['buff'],
    riskLevel: 0,
  },
  {
    id: 'looted',
    nameSuffix: 'Desecrated',
    descriptionModifier: 'It has been ransacked recently.',
    consequenceTypes: [],
    riskLevel: 2,
  },
  {
    id: 'pristine',
    nameSuffix: 'Preserved',
    descriptionModifier: 'It looks as if it was built yesterday.',
    consequenceTypes: ['map_reveal', 'reputation'],
    riskLevel: 3,
  }
];
