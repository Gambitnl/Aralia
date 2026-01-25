/**
 * @file green_dragonborn.ts
 * Defines the data for the Green Dragonborn race in the Aralia RPG.
 * Green dragonborn have poison-based breath weapons and damage resistance.
 */
import { Race } from '../../types';

export const GREEN_DRAGONBORN_DATA: Race = {
  id: 'green_dragonborn',
  name: 'Green Dragonborn',
  baseRace: 'dragonborn',
  description:
    'Descended from green dragons, these dragonborn carry the legacy of forest manipulators and schemers. Their scales range from emerald to forest green, and they possess an affinity for poison. Green dragonborn are often cunning and persuasive, embodying the devious nature of their draconic ancestors.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    'Draconic Ancestry: Green Dragon - Poison damage',
    'Breath Weapon: You can use your Breath Weapon as part of the Attack action. You exhale destructive energy in a 15-foot cone. Each creature in the area must make a Dexterity saving throw (DC 8 + your Constitution modifier + your proficiency bonus). On a failed save, a creature takes 1d10 poison damage. On a successful save, it takes half as much damage. This damage increases to 2d10 at 5th level, 3d10 at 11th level, and 4d10 at 17th level. After using your breath weapon, you can\'t use it again until you finish a short or long rest.',
    'Damage Resistance: You have resistance to poison damage.',
    "Vision: You can see in [[dim_light|dim light]] within 60 feet of you as if it were [[bright_light|bright light]], and in [[darkness]] as if it were [[dim_light|dim light]]. You can't discern color in [[darkness]], only shades of gray.",
    'Draconic Language: You can speak, read, and write Draconic.',
  ],
  visual: {
    id: 'green_dragonborn',
    color: '#228B22',
    maleIllustrationPath: 'assets/images/races/Dragonborn_Green_Male.png',
    femaleIllustrationPath: 'assets/images/races/Dragonborn_Green_Female.png',
  },
};
