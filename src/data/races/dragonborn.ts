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
} from '../../types/index.js'; // Path relative to src/data/races/

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
  baseRace: 'draconic_kin',
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
    "Vision: You can see in [[dim_light|dim light]] within 60 feet of you as if it were [[bright_light|bright light]], and in [[darkness]] as if it were [[dim_light|dim light]]. You can't discern color in [[darkness]], only shades of gray.",
    // Canonical 2024 wording, matched word-for-word to the ten ancestry race
    // files (black_dragonborn.ts and siblings). The shortened placeholder that
    // stood here stated no start level in a sentence the shared racial parser
    // reads, no activation, and no once-per-Long-Rest limit, so the parser could
    // only ever project an always-on flight. With this text the parser reads
    // minLevel 5 and emits the Long Rest resource, which is what makes the
    // level-5 unlock real for the base race (agora-431e).
    'Draconic Flight (Level 5): Starting at Level 5, you can use a [[bonus_action|Bonus Action]] to sprout spectral wings for 10 minutes or until you\'re [[incapacitated_condition|Incapacitated]]. For the duration, you have a [[fly_speed|Flying Speed]] equal to your walking speed. Once you use this trait, you can\'t do so again until you finish a [[long_rest|Long Rest]].',
  ],
  imageUrl: 'https://i.ibb.co/mrxb2Hwz/Dragonborn.png',
  visual: {
    id: 'dragonborn',
    color: '#C9A227',
    maleIllustrationPath: 'assets/images/races/Dragonborn_Male.png',
    femaleIllustrationPath: 'assets/images/races/Dragonborn_Female.png',
  },
};
