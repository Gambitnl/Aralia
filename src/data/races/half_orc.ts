/**
 * @file half_orc.ts
 * Defines the data for the Half-Orc race in the Aralia RPG.
 */
import { Race } from '../../types';

export const HALF_ORC_DATA: Race = {
  id: 'half_orc',
  name: 'Half-Orc',
  baseRace: 'half_orc',
  description:
    'Half-orcs walk between civilized and wild worlds, channeling human adaptability and orcish ferocity. They are resilient survivors who learn to feed their passions without letting them consume their better judgment.',
  abilityBonuses: [
    { ability: 'Strength', bonus: 2 },
    { ability: 'Constitution', bonus: 1 },
  ],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium (about 5-6.5 feet tall)',
    'Speed: 30 feet',
    "Vision: You can see in [[dim_light|dim light]] within 60 feet of you as if it were [[bright_light|bright light]], and in [[darkness]] as if it were [[dim_light|dim light]]. You can't discern color in [[darkness]], only shades of gray.",
    'Relentless Endurance: When you are reduced to 0 hit points but not killed outright, you can drop to 1 hit point instead. Once you use this trait, you canâ€™t do so again until you finish a long rest.',
    'Savage Attacks: When you score a critical hit with a melee weapon attack, you can roll one of the weaponâ€™s damage dice one additional time and add it to the extra damage of the critical hit.',
  ],
  visual: {
    id: 'half_orc',
    color: '#4A4A4A',
    maleIllustrationPath: 'assets/images/races/Half_Orc_Male.png',
    femaleIllustrationPath: 'assets/images/races/Half_Orc_Female.png',
  },
};
