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
