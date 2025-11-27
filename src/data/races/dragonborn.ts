/**
 * @file dragonborn.ts
 * Defines the data for the Dragonborn race and their various Draconic Ancestries
 * in the Aralia RPG. This includes base Dragonborn traits and specific details
 * for each ancestry type (e.g., damage resistance, breath weapon type).
 */
import {
  Race,
  DraconicAncestorType,
  DraconicDamageType,
  DraconicAncestryInfo,
} from '../../types.ts'; // Path relative to src/data/races/

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
    'Born of dragons, dragonborn are proud and honorable, with innate draconic abilities. Their appearance reflects their chosen ancestry. (Example ASIs: +2 STR, +1 CHA)',
  abilityBonuses: [
    { ability: 'Strength', bonus: 2 },
    { ability: 'Charisma', bonus: 1 },
  ],
  traits: [
    'Speed: 30 feet',
    'Draconic Ancestry (Choose ancestor: determines Damage Resistance and Breath Weapon type)',
    'Breath Weapon (Attack action replacement, Dex save for half, Prof Bonus uses/Long Rest, 1d10 damage, scales)', // Specifics (range, shape) depend on ancestry. Scaling & uses not fully implemented.
    'Damage Resistance (Type based on ancestry)',
    'Darkvision (60ft)', // Some interpretations grant Darkvision, others do not. Included for playability.
    'Draconic Flight (Gained at Lvl 5)', // Placeholder for higher-level feature.
  ],
  imageUrl: 'https://i.ibb.co/mrxb2Hwz/Dragonborn.png',
};
