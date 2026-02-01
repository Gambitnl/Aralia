/**
 * @file bronze_dragonborn.ts
 * Defines the data for the Bronze Dragonborn race in the Aralia RPG.
 * Bronze dragonborn have lightning-based breath weapons and damage resistance.
 */
import { Race } from '../../types';

export const BRONZE_DRAGONBORN_DATA: Race = {
  id: 'bronze_dragonborn',
  name: 'Bronze Dragonborn',
  baseRace: 'draconic_kin',
  description:
    'Descended from bronze dragons, these dragonborn carry the legacy of coastal guardians. Their scales shimmer with metallic bronze hues, reminiscent of polished armor, and they command the power of lightning. Bronze dragonborn are often noble and dutiful, embodying the protective nature of their draconic ancestors.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    'Draconic Ancestry: Bronze Dragon - Lightning damage',
    'Breath Weapon: You can use your Breath Weapon as part of the Attack action. You exhale destructive energy in a 5-foot by 30-foot line. Each creature in the area must make a Dexterity saving throw (DC 8 + your Constitution modifier + your proficiency bonus). On a failed save, a creature takes 1d10 lightning damage. On a successful save, it takes half as much damage. This damage increases to 2d10 at 5th level, 3d10 at 11th level, and 4d10 at 17th level. After using your breath weapon, you can\'t use it again until you finish a short or long rest.',
    'Damage Resistance: You have resistance to lightning damage.',
    "Vision: You can see in [[dim_light|dim light]] within 60 feet of you as if it were [[bright_light|bright light]], and in [[darkness]] as if it were [[dim_light|dim light]]. You can't discern color in [[darkness]], only shades of gray.",
    'Draconic Language: You can speak, read, and write Draconic.',
  ],
  visual: {
    id: 'bronze_dragonborn',
    color: '#CD7F32',
    maleIllustrationPath: 'assets/images/races/Dragonborn_Bronze_Male.png',
    femaleIllustrationPath: 'assets/images/races/Dragonborn_Bronze_Female.png',
  },
};
