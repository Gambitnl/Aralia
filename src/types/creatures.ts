import { DamageType, ConditionName } from './spells';

/**
 * D&D creature types - affects targeting, resistances, and abilities.
 * Source: PHB 2024
 */
export enum CreatureType {
  Aberration = 'Aberration',
  Beast = 'Beast',
  Celestial = 'Celestial',
  Construct = 'Construct',
  Dragon = 'Dragon',
  Elemental = 'Elemental',
  Fey = 'Fey',
  Fiend = 'Fiend',
  Giant = 'Giant',
  Humanoid = 'Humanoid',
  Monstrosity = 'Monstrosity',
  Ooze = 'Ooze',
  Plant = 'Plant',
  Undead = 'Undead',
}

export interface TypeTraits {
  immunities?: DamageType[];
  resistances?: DamageType[];
  vulnerabilities?: DamageType[];
  conditionImmunities?: ConditionName[];
  description?: string;
}

/**
 * Standard traits associated with specific creature types.
 * Note: Individual creatures may vary; these are general rules or common attributes.
 */
export const CreatureTypeTraits: Record<CreatureType, TypeTraits> = {
  [CreatureType.Aberration]: {
    description: "Beings of alien nature, often from the Far Realm.",
  },
  [CreatureType.Beast]: {
    description: "Non-humanoid creatures that are part of the natural world.",
  },
  [CreatureType.Celestial]: {
    description: "Creatures native to the Upper Planes.",
  },
  [CreatureType.Construct]: {
    description: "Inanimate objects animated by magic.",
    immunities: ['Poison', 'Psychic'],
    conditionImmunities: ['Charmed', 'Exhaustion', 'Frightened', 'Paralyzed', 'Petrified', 'Poisoned'],
  },
  [CreatureType.Dragon]: {
    description: "Large reptilian creatures of ancient origin and tremendous power.",
  },
  [CreatureType.Elemental]: {
    description: "Creatures native to the Elemental Planes.",
    immunities: ['Poison'],
    conditionImmunities: ['Exhaustion', 'Paralyzed', 'Petrified', 'Poisoned', 'Unconscious'],
  },
  [CreatureType.Fey]: {
    description: "Creatures of magic with connections to the Feywild.",
  },
  [CreatureType.Fiend]: {
    description: "Creatures native to the Lower Planes.",
  },
  [CreatureType.Giant]: {
    description: "Humanoid-like creatures of great size.",
  },
  [CreatureType.Humanoid]: {
    description: "The main peoples of the D&D world, both civilized and savage.",
  },
  [CreatureType.Monstrosity]: {
    description: "Frightening creatures that are not ordinary animals, not truly natural.",
  },
  [CreatureType.Ooze]: {
    description: "Gelatinous creatures that rarely have a fixed shape.",
    conditionImmunities: ['Blinded', 'Charmed', 'Deafened', 'Exhaustion', 'Frightened', 'Prone'],
  },
  [CreatureType.Plant]: {
    description: "Vegetable creatures, not ordinary flora.",
  },
  [CreatureType.Undead]: {
    description: "Once-living creatures brought to a horrifying state of undeath.",
    immunities: ['Poison'],
    conditionImmunities: ['Poisoned'],
  },
};

/**
 * Creature size categories.
 * Source: PHB 2024
 */
export enum CreatureSize {
  Tiny = 'Tiny',
  Small = 'Small',
  Medium = 'Medium',
  Large = 'Large',
  Huge = 'Huge',
  Gargantuan = 'Gargantuan',
}

export interface SizeTraits {
  /** Space controlled in combat (width in feet). Assumes square space. */
  spaceInFeet: number;
  /** Typical Hit Die size for monsters of this size. */
  hitDie: string;
  description: string;
}

/**
 * Standard traits associated with creature sizes.
 */
export const CreatureSizeTraits: Record<CreatureSize, SizeTraits> = {
  [CreatureSize.Tiny]: {
    spaceInFeet: 2.5,
    hitDie: 'd4',
    description: "Tiny creatures control a space 2.5 by 2.5 feet.",
  },
  [CreatureSize.Small]: {
    spaceInFeet: 5,
    hitDie: 'd6',
    description: "Small creatures control a space 5 by 5 feet.",
  },
  [CreatureSize.Medium]: {
    spaceInFeet: 5,
    hitDie: 'd8',
    description: "Medium creatures control a space 5 by 5 feet.",
  },
  [CreatureSize.Large]: {
    spaceInFeet: 10,
    hitDie: 'd10',
    description: "Large creatures control a space 10 by 10 feet.",
  },
  [CreatureSize.Huge]: {
    spaceInFeet: 15,
    hitDie: 'd12',
    description: "Huge creatures control a space 15 by 15 feet.",
  },
  [CreatureSize.Gargantuan]: {
    spaceInFeet: 20,
    hitDie: 'd20',
    description: "Gargantuan creatures control a space 20 by 20 feet or larger.",
  },
};

// TODO(Taxonomist): Update codebase to use CreatureSize enum instead of magic strings
