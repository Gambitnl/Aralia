/**
 * @file white_dragonborn.ts
 * Defines the data for the White Dragonborn race in the Aralia RPG.
 * White dragonborn have cold-based breath weapons and damage resistance.
 */
import { Race } from '../../types';

export const WHITE_DRAGONBORN_DATA: Race = {
  id: 'white_dragonborn',
  name: 'White Dragonborn',
  baseRace: 'dragonborn',
  description:
    'Descended from white dragons, these dragonborn carry the legacy of arctic hunters. Their scales are pristine white or pale blue, like fresh snow and ice, and they command freezing cold. White dragonborn are often direct and primal, embodying the savage nature of their draconic ancestors.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    'Draconic Ancestry: White Dragon - Cold damage',
    'Breath Weapon: You can use your Breath Weapon as part of the Attack action. You exhale destructive energy in a 15-foot cone. Each creature in the area must make a Dexterity saving throw (DC 8 + your Constitution modifier + your proficiency bonus). On a failed save, a creature takes 1d10 cold damage. On a successful save, it takes half as much damage. This damage increases to 2d10 at 5th level, 3d10 at 11th level, and 4d10 at 17th level. After using your breath weapon, you can\'t use it again until you finish a short or long rest.',
    'Damage Resistance: You have resistance to cold damage.',
    'Darkvision: You have Darkvision with a range of 60 feet.',
    'Draconic Language: You can speak, read, and write Draconic.',
  ],
  visual: {
    id: 'white_dragonborn',
    icon: '🐉',
    color: '#F0F8FF',
    maleIllustrationPath: 'assets/images/races/white_dragonborn_male.png',
    femaleIllustrationPath: 'assets/images/races/white_dragonborn_female.png',
  },
};
