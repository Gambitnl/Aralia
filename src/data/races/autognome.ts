/**
 * @file autognome.ts
 * Represents the Autognome race as described in the glossary.
 */
import { Race } from '../../types';

export const AUTOGNOME_DATA: Race = {
  id: 'autognome',
  name: 'Autognome',
  baseRace: 'autognome',
  description:
    'Autognomes are mechanical beings built by rock gnome inventors with a spark of sentience, programmed for loyalty but capable of forging their own personalities.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Construct',
    'Size: Small',
    'Speed: 30 feet',
    'Armored Casing: While you are not wearing armor, your base Armor Class is 13 + your Dexterity modifier.',
    'Built for Success: You can add a d4 to one attack roll, ability check, or saving throw after you see the d20 roll; you can do so a number of times equal to your Proficiency Bonus per long rest.',
    'Healing Machine: If someone casts mending on you, you can spend a Hit Die, roll it, and regain hit points equal to the roll plus your Constitution modifier; cure wounds, healing word, mass cure wounds, mass healing word, and spare the dying treat you as valid targets.',
    'Mechanical Nature: You have resistance to poison, immunity to disease, and advantage on saves against being paralyzed or poisoned. You don’t need to eat, drink, or breathe.',
    'Sentry\'s Rest: You spend 6 hours in an inactive, motionless state instead of sleeping; you remain conscious during that time.',
    'Specialized Design: You gain two tool proficiencies of your choice.',
  ],
  visual: {
    id: 'autognome',
    color: '#6c757d',
    maleIllustrationPath: 'assets/images/races/autognome_male.png',
    femaleIllustrationPath: 'assets/images/races/autognome_female.png',
  },
};
