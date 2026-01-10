/**
 * @file silver_dragonborn.ts
 * Defines the data for the Silver Dragonborn race in the Aralia RPG.
 * Silver dragonborn have cold-based breath weapons and damage resistance.
 */
import { Race } from '../../types';

export const SILVER_DRAGONBORN_DATA: Race = {
  id: 'silver_dragonborn',
  name: 'Silver Dragonborn',
  baseRace: 'dragonborn',
  description:
    'Descended from silver dragons, these dragonborn carry the legacy of cloud-dwelling protectors. Their scales shimmer like polished silver, reflecting light beautifully, and they wield the power of frost. Silver dragonborn are often compassionate and altruistic, embodying the benevolent nature of their draconic ancestors.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    'Draconic Ancestry: Silver Dragon - Cold damage',
    'Breath Weapon: You can use your Breath Weapon as part of the Attack action. You exhale destructive energy in a 15-foot cone. Each creature in the area must make a Dexterity saving throw (DC 8 + your Constitution modifier + your proficiency bonus). On a failed save, a creature takes 1d10 cold damage. On a successful save, it takes half as much damage. This damage increases to 2d10 at 5th level, 3d10 at 11th level, and 4d10 at 17th level. After using your breath weapon, you can\'t use it again until you finish a short or long rest.',
    'Damage Resistance: You have resistance to cold damage.',
    'Darkvision: You have Darkvision with a range of 60 feet.',
    'Draconic Language: You can speak, read, and write Draconic.',
  ],
  visual: {
    id: 'silver_dragonborn',
    icon: '🐉',
    color: '#C0C0C0',
    maleIllustrationPath: 'assets/images/races/silver_dragonborn_male.png',
    femaleIllustrationPath: 'assets/images/races/silver_dragonborn_female.png',
  },
};
