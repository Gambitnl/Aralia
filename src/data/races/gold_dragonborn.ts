/**
 * @file gold_dragonborn.ts
 * Defines the data for the Gold Dragonborn race in the Aralia RPG.
 * Gold dragonborn have fire-based breath weapons and damage resistance.
 */
import { Race } from '../../types';

export const GOLD_DRAGONBORN_DATA: Race = {
  id: 'gold_dragonborn',
  name: 'Gold Dragonborn',
  baseRace: 'dragonborn',
  description:
    'Descended from gold dragons, these dragonborn carry the legacy of the most majestic and wise dragons. Their scales gleam like polished gold, radiating regal authority, and they wield the power of fire. Gold dragonborn are often wise and just, embodying the noble nature of their draconic ancestors.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    'Draconic Ancestry: Gold Dragon - Fire damage',
    'Breath Weapon: You can use your Breath Weapon as part of the Attack action. You exhale destructive energy in a 15-foot cone. Each creature in the area must make a Dexterity saving throw (DC 8 + your Constitution modifier + your proficiency bonus). On a failed save, a creature takes 1d10 fire damage. On a successful save, it takes half as much damage. This damage increases to 2d10 at 5th level, 3d10 at 11th level, and 4d10 at 17th level. After using your breath weapon, you can\'t use it again until you finish a short or long rest.',
    'Damage Resistance: You have resistance to fire damage.',
    'Darkvision: You have Darkvision with a range of 60 feet.',
    'Draconic Language: You can speak, read, and write Draconic.',
  ],
  visual: {
    id: 'gold_dragonborn',
    icon: '🐉',
    color: '#FFD700',
    maleIllustrationPath: 'assets/images/races/Dragonborn_Gold_Male.png',
    femaleIllustrationPath: 'assets/images/races/Dragonborn_Gold_Female.png',
  },
};
