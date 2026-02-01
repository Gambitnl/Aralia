/**
 * @file ravenite_dragonborn.ts
 * Defines the data for the Ravenite Dragonborn race in the Aralia RPG.
 * Ravenite dragonborn are a Critical Role variant from Explorer's Guide to Wildemount,
 * known for their warrior culture and vengeful spirit.
 */
import { Race } from '../../types';

export const RAVENITE_DRAGONBORN_DATA: Race = {
  id: 'ravenite_dragonborn',
  name: 'Ravenite Dragonborn',
  baseRace: 'draconic_kin',
  description:
    'Ravenite dragonborn were once enslaved by the draconblood but rose up to destroy the nation of Draconia. They are a proud warrior culture that values freedom, strength, and vengeance. Unlike other dragonborn, they lack breath weapons but possess fierce combat abilities. Their scales tend toward darker, more practical colors, and they bear the scars of their ancestors\' struggles.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    "Vision: You can see in [[dim_light|dim light]] within 60 feet of you as if it were [[bright_light|bright light]], and in [[darkness]] as if it were [[dim_light|dim light]]. You can't discern color in [[darkness]], only shades of gray.",
    'Vengeful Assault: When you take damage from a creature in range of a weapon you are wielding, you can use your reaction to make an attack with the weapon against that creature. Once you use this trait, you can\'t do so again until you finish a short or long rest.',
    'Draconic Language: You can speak, read, and write Draconic.',
  ],
  visual: {
    id: 'ravenite_dragonborn',
    color: '#B22222',
    maleIllustrationPath: 'assets/images/races/Dragonborn_Ravenite_Male.png',
    femaleIllustrationPath: 'assets/images/races/Dragonborn_Ravenite_Female.png',
  },
};
