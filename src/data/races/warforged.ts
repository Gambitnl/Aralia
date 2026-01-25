/**
 * @file warforged.ts
 * Defines the data for the Warforged race in the Aralia RPG, based on Eberron: Rising from the Last War.
 */
import { Race } from '../../types'; // Path relative to src/data/races/

export const WARFORGED_DATA: Race = {
  id: 'warforged',
  name: 'Warforged',
  description:
    'Warforged are living constructs created during the Last War of Eberron to serve as soldiers. They are composed of wood, metal, and stone, with a body of plant-like organic material that flows around their mechanical components. Each warforged has a unique pattern of protective plates and sigils. Though built for war, many warforged have found purpose beyond battle, seeking meaning and identity in a world that often views them as weapons.',
  abilityBonuses: [], // Flexible ASIs are handled by Point Buy system.
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    'Constructed Resilience: You were created to have remarkable fortitude, represented by the following benefits: You have advantage on saving throws against being poisoned, and you have resistance to poison damage. You don\'t need to eat, drink, or breathe. You are immune to disease. You don\'t need to sleep, and magic can\'t put you to sleep.',
    'Sentry\'s Rest: When you take a long rest, you must spend at least six hours in an inactive, motionless state, rather than sleeping. In this state, you appear inert, but it doesn\'t render you unconscious, and you can see and hear as normal.',
    'Integrated Protection: Your body has built-in defensive layers, which can be enhanced with armor: You gain a +1 bonus to Armor Class. You can don only armor with which you have proficiency. To don armor other than a shield, you must incorporate it into your body over the course of 1 hour, during which you remain in contact with the armor. To doff armor, you must spend 1 hour removing it. You can rest while donning or doffing armor in this way. While you live, the armor incorporated into your body can\'t be removed against your will.',
    'Specialized Design: You gain one skill proficiency and one tool proficiency of your choice.',
  ],
  visual: {
    id: 'warforged',
    color: '#708090',
    maleIllustrationPath: 'assets/images/races/Warforged_Male.png',
    femaleIllustrationPath: 'assets/images/races/Warforged_Female.png',
  },
};
