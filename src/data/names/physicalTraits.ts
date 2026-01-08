/**
 * @file physicalTraits.ts
 * Defines logical physical ranges and cosmetic options for NPC generation.
 * Height and weight bases are in inches and pounds respectively.
 */
export interface PhysicalTraits {
  hairStyles: string[];
  hairColors: string[];
  eyeColors: string[];
  skinTones: string[];
  facialHair?: string[]; // Mostly relevant for male-coded characters or specific races like Dwarves
  bodyTypes: string[];
  heightBaseInches: number;
  heightModifierDice: string; // Adds variety to the base height
  weightBaseLb: number;
  weightModifierDice: string; // Adds variety to the base weight
  ageMaturity: number; // Age at which the race is considered an adult
  ageMax: number;      // Maximum typical lifespan
}

export const COMMON_HAIR_STYLES = ['Short', 'Long', 'Bald', 'Braided', 'Messy', 'Ponytail', 'Topknot', 'Mohawk', 'Shaved sides', 'Curly'];
export const COMMON_HAIR_COLORS = ['Black', 'Brown', 'Blonde', 'Red', 'Gray', 'White', 'Auburn'];
export const COMMON_EYE_COLORS = ['Blue', 'Green', 'Brown', 'Hazel', 'Gray', 'Amber'];
export const COMMON_SKIN_TONES = ['Pale', 'Fair', 'Tan', 'Olive', 'Brown', 'Dark', 'Ebony', 'Ruddy'];
export const COMMON_BODY_TYPES = ['Slender', 'Athletic', 'Muscular', 'Stocky', 'Lean', 'Heavy', 'Average', 'Fit'];

/**
 * Aesthetic flavor traits to make NPCs more memorable.
 */
export const SCARS_AND_MARKS = [
  'A jagged scar on the left cheek',
  'A burn mark on the forearm',
  'A tattoo of a dragon on the neck',
  'Pierced nose',
  'Missing a finger',
  'A long scar across the eye',
  'Tribal tattoos on the arm',
  'A birthmark on the forehead',
  'Weather-beaten skin',
  'Calloused hands'
];

/**
 * Race-specific physical constraints.
 * Sourced from D&D 5e Player's Handbook (PHB) and expanded for variety.
 */
export const RACE_PHYSICAL_TRAITS: Record<string, PhysicalTraits> = {
  human: {
    hairStyles: COMMON_HAIR_STYLES,
    hairColors: COMMON_HAIR_COLORS,
    eyeColors: COMMON_EYE_COLORS,
    skinTones: COMMON_SKIN_TONES,
    facialHair: ['None', 'Stubble', 'Full Beard', 'Goatee', 'Mustache', 'Sideburns'],
    bodyTypes: COMMON_BODY_TYPES,
    heightBaseInches: 56, // 4'8"
    heightModifierDice: '2d10',
    weightBaseLb: 110,
    weightModifierDice: '2d4', 
    ageMaturity: 18,
    ageMax: 80
  },
  dwarf: {
    hairStyles: ['Long', 'Braided', 'Bald', 'Mohawk', 'Knotted'],
    hairColors: ['Black', 'Brown', 'Red', 'Gray', 'White'],
    eyeColors: ['Dark Brown', 'Black', 'Hazel', 'Gray'],
    skinTones: ['Pale', 'Tan', 'Ruddy', 'Deep Brown'],
    facialHair: ['Long Braided Beard', 'Bushy Beard', 'Forked Beard', 'Trimmed Beard', 'Grand Mustache'],
    bodyTypes: ['Stocky', 'Broad', 'Solid', 'Thick', 'Stout'],
    heightBaseInches: 44, // 3'8"
    heightModifierDice: '2d4',
    weightBaseLb: 115,
    weightModifierDice: '2d6',
    ageMaturity: 50,
    ageMax: 350
  },
  elf: {
    hairStyles: ['Long and straight', 'Elegant braid', 'Flowing', 'Intricate bun', 'Short cropped'],
    hairColors: ['Silver', 'Gold', 'Black', 'Copper', 'Blue-black', 'Blonde'],
    eyeColors: ['Green', 'Blue', 'Gold', 'Silver', 'Violet'],
    skinTones: ['Pale', 'Fair', 'Copper', 'Bronze', 'Bluish-white'],
    facialHair: ['None'],
    bodyTypes: ['Slender', 'Lithesome', 'Graceful', 'Lean', 'Tall'],
    heightBaseInches: 54, // 4'6"
    heightModifierDice: '2d10',
    weightBaseLb: 90,
    weightModifierDice: '1d4',
    ageMaturity: 100,
    ageMax: 750
  },
  halfling: {
    hairStyles: ['Curly', 'Mop', 'Short', 'Sideburns', 'Topknot'],
    hairColors: ['Brown', 'Sandy', 'Black', 'Auburn'],
    eyeColors: ['Brown', 'Hazel'],
    skinTones: ['Tan', 'Pale', 'Ruddy'],
    facialHair: ['Sideburns', 'Mutton chops', 'None'],
    bodyTypes: ['Small', 'Plump', 'Stout', 'Lean'],
    heightBaseInches: 31, // 2'7"
    heightModifierDice: '2d4',
    weightBaseLb: 35,
    weightModifierDice: '1d1',
    ageMaturity: 20,
    ageMax: 150
  },
  tiefling: {
    hairStyles: ['Wild', 'Horns prominent', 'Long', 'Spiked'],
    hairColors: ['Black', 'Red', 'Purple', 'Blue', 'White'],
    eyeColors: ['Solid Black', 'Solid Red', 'Solid White', 'Gold', 'Green'],
    skinTones: ['Red', 'Purple', 'Blue', 'Human-like'],
    facialHair: ['Goatee', 'Small beard', 'None'],
    bodyTypes: ['Lean', 'Wiry', 'Curvaceous', 'Athletic'],
    heightBaseInches: 57, // 4'9"
    heightModifierDice: '2d8',
    weightBaseLb: 110,
    weightModifierDice: '2d4',
    ageMaturity: 18,
    ageMax: 100
  },
  goliath: {
    hairStyles: ['Bald', 'Lithoderms only', 'Small tuft'],
    hairColors: ['None'],
    eyeColors: ['Gray', 'Blue', 'Green'],
    skinTones: ['Gray', 'Stone-like', 'Mottled', 'Slate'],
    facialHair: ['None'],
    bodyTypes: ['Massive', 'Muscular', 'Towering', 'Broad-shouldered'],
    heightBaseInches: 84, // 7'0"
    heightModifierDice: '2d10',
    weightBaseLb: 280,
    weightModifierDice: '2d6',
    ageMaturity: 18,
    ageMax: 90
  }
};

export const FALLBACK_TRAITS: PhysicalTraits = RACE_PHYSICAL_TRAITS.human;
