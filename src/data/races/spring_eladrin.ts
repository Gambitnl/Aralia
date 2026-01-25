/**
 * @file spring_eladrin.ts
 * Defines the data for the Spring Eladrin race in the Aralia RPG.
 * Spring eladrin are filled with joy and hope, their Fey Step teleporting willing allies.
 */
import { Race } from '../../types';

export const SPRING_ELADRIN_DATA: Race = {
  id: 'spring_eladrin',
  name: 'Spring Eladrin',
  baseRace: 'eladrin',
  description:
    'When an eladrin is in the spring season, they are filled with unbridled joy and hope, overflowing with energy and enthusiasm. Spring eladrin are celebratory and joyful, their very presence seeming to lift the spirits of those around them. Their appearance often reflects this season—hair adorned with flowers, skin with hints of green or gold, and eyes that sparkle with mirth. A spring eladrin\'s mood can be infectious, spreading cheer wherever they go. Their Fey Step carries the essence of spring, filling others with joyful energy that compels them toward the eladrin.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    "Vision: You can see in [[dim_light|dim light]] within 60 feet of you as if it were [[bright_light|bright light]], and in [[darkness]] as if it were [[dim_light|dim light]]. You can't discern color in [[darkness]], only shades of gray.",
    'Fey Ancestry: You have advantage on saving throws you make to avoid or end the charmed condition on yourself.',
    'Keen Senses: You have proficiency in the Perception skill.',
    'Trance: You don\'t need to sleep, and magic can\'t put you to sleep. You can finish a Long Rest in 4 hours if you spend those hours in a trancelike meditation, during which you retain consciousness.',
    'Fey Step (Spring): As a Bonus Action, you can magically teleport up to 30 feet to an unoccupied space you can see. You can use this trait a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest. When you use your Fey Step, you can also touch one willing creature within 5 feet of you. That creature then teleports instead of you, appearing in an unoccupied space of your choice within 30 feet of you.',
    'Season Association: Spring represents cheerfulness and celebration, marked by merriment and hope. You can change your season during a long rest, which changes your Fey Step effect.',
  ],
  visual: {
    id: 'spring_eladrin',
    color: '#98FB98',
    maleIllustrationPath: 'assets/images/races/Eladrin_Spring_Male.png',
    femaleIllustrationPath: 'assets/images/races/Eladrin_Spring_Female.png',
  },
};
