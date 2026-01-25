/**
 * @file red_dragonborn.ts
 * Defines the data for the Red Dragonborn race in the Aralia RPG.
 * Red dragonborn have fire-based breath weapons and damage resistance.
 */
import { Race } from '../../types';

export const RED_DRAGONBORN_DATA: Race = {
  id: 'red_dragonborn',
  name: 'Red Dragonborn',
  baseRace: 'dragonborn',
  description:
    'Descended from red dragons, these dragonborn carry the legacy of the most powerful and arrogant chromatic dragons. Their scales blaze in shades of crimson and scarlet, and they command devastating fire. Red dragonborn are often ambitious and fierce, embodying the dominant nature of their draconic ancestors.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    'Draconic Ancestry: Red Dragon - Fire damage',
    'Breath Weapon: You can use your Breath Weapon as part of the Attack action. You exhale destructive energy in a 15-foot cone. Each creature in the area must make a Dexterity saving throw (DC 8 + your Constitution modifier + your proficiency bonus). On a failed save, a creature takes 1d10 fire damage. On a successful save, it takes half as much damage. This damage increases to 2d10 at 5th level, 3d10 at 11th level, and 4d10 at 17th level. After using your breath weapon, you can\'t use it again until you finish a short or long rest.',
    'Damage Resistance: You have resistance to fire damage.',
    "Vision: You can see in [[dim_light|dim light]] within 60 feet of you as if it were [[bright_light|bright light]], and in [[darkness]] as if it were [[dim_light|dim light]]. You can't discern color in [[darkness]], only shades of gray.",
    'Draconic Language: You can speak, read, and write Draconic.',
  ],
  visual: {
    id: 'red_dragonborn',
    color: '#DC143C',
    maleIllustrationPath: 'assets/images/races/Dragonborn_Red_Male.png',
    femaleIllustrationPath: 'assets/images/races/Dragonborn_Red_Female.png',
  },
};
