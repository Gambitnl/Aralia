/**
 * @file brass_dragonborn.ts
 * Defines the data for the Brass Dragonborn race in the Aralia RPG.
 * Brass dragonborn have fire-based breath weapons and damage resistance.
 */
import { Race } from '../../types';

export const BRASS_DRAGONBORN_DATA: Race = {
  id: 'brass_dragonborn',
  name: 'Brass Dragonborn',
  baseRace: 'dragonborn',
  description:
    'Descended from brass dragons, these dragonborn carry the legacy of talkative desert dwellers. Their scales gleam in warm metallic hues of bronze and gold, and they wield the power of fire. Brass dragonborn are often sociable and curious, embodying the gregarious nature of their draconic ancestors.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    'Draconic Ancestry: Brass Dragon - Fire damage',
    'Breath Weapon: You can use your Breath Weapon as part of the Attack action. You exhale destructive energy in a 5-foot by 30-foot line. Each creature in the area must make a Dexterity saving throw (DC 8 + your Constitution modifier + your proficiency bonus). On a failed save, a creature takes 1d10 fire damage. On a successful save, it takes half as much damage. This damage increases to 2d10 at 5th level, 3d10 at 11th level, and 4d10 at 17th level. After using your breath weapon, you can\'t use it again until you finish a short or long rest.',
    'Damage Resistance: You have resistance to fire damage.',
    "Vision: You can see in [[dim_light|dim light]] within 60 feet of you as if it were [[bright_light|bright light]], and in [[darkness]] as if it were [[dim_light|dim light]]. You can't discern color in [[darkness]], only shades of gray.",
    'Draconic Language: You can speak, read, and write Draconic.',
  ],
  visual: {
    id: 'brass_dragonborn',
    color: '#CD853F',
    maleIllustrationPath: 'assets/images/races/Dragonborn_Brass_Male.png',
    femaleIllustrationPath: 'assets/images/races/Dragonborn_Brass_Female.png',
  },
};
