/**
 * @file dragonborn.ts
 * Defines the data for the Dragonborn race and their various Draconic Ancestries
 * in the Aralia RPG. This includes base Dragonborn traits and specific details
 * for each ancestry type (e.g., damage resistance, breath weapon type).
 */
import {
  Race,
  DraconicAncestorType,
  DraconicAncestryInfo,
} from '../../types'; // Path relative to src/data/races/

/**
 * A record mapping each Draconic Ancestor type to its specific information,
 * including the damage type associated with its resistance and breath weapon.
 */
export const DRAGONBORN_ANCESTRIES_DATA: Record<
  DraconicAncestorType,
  DraconicAncestryInfo
> = {
  Black: { type: 'Black', damageType: 'Acid' },
  Blue: { type: 'Blue', damageType: 'Lightning' },
  Brass: { type: 'Brass', damageType: 'Fire' },
  Bronze: { type: 'Bronze', damageType: 'Lightning' },
  Copper: { type: 'Copper', damageType: 'Acid' },
  Gold: { type: 'Gold', damageType: 'Fire' },
  Green: { type: 'Green', damageType: 'Poison' },
  Red: { type: 'Red', damageType: 'Fire' },
  Silver: { type: 'Silver', damageType: 'Cold' },
  White: { type: 'White', damageType: 'Cold' },
};

/**
 * Base data for the Dragonborn race.
 * Specific ancestry details (like damage type) are chosen during character creation.
 */
export const DRAGONBORN_DATA: Race = {
  id: 'dragonborn',
  name: 'Dragonborn',
  description:
    'Born of dragons, dragonborn are proud and honorable, with innate draconic abilities. Their appearance reflects their chosen ancestry.',
  abilityBonuses: [
      { ability: 'Strength', bonus: 2 },
      { ability: 'Charisma', bonus: 1 },
  ], // Kept 2014 ASIs for now to ensure mechanical balance until Backgrounds system fully handles stats.
  traits: [
    'Speed: 30 feet',
    'Draconic Ancestry: You have a draconic ancestor that determines your breath weapon and damage resistance.',
    'Breath Weapon: You can use your Breath Weapon as part of the Attack action. Each creature in the area must make a Dexterity saving throw (DC 8 + Con mod + Prof Bonus).',
    'Damage Resistance: You have resistance to the damage type associated with your Draconic Ancestry.',
    'Darkvision: You have Darkvision with a range of 60 feet.',
    'Draconic Flight (Level 5): You sprout wings and gain a flying speed equal to your walking speed.', // Fizban's/2024 Variant option, kept as placeholder for progression.
  ],
  imageUrl: 'https://i.ibb.co/mrxb2Hwz/Dragonborn.png',
  visual: {
    id: 'dragonborn',
    icon: '🐉',
    color: '#C9A227',
    maleIllustrationPath: 'assets/images/races/Dragonborn_Male.png',
    femaleIllustrationPath: 'assets/images/races/Dragonborn_Female.png',
  },
};
