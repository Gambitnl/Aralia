/**
 * @file winter_eladrin.ts
 * Defines the data for the Winter Eladrin race in the Aralia RPG.
 * Winter eladrin reflect sorrow and melancholy, their Fey Step frightening nearby creatures.
 */
import { Race } from '../../types';

export const WINTER_ELADRIN_DATA: Race = {
  id: 'winter_eladrin',
  name: 'Winter Eladrin',
  baseRace: 'eladrin',
  description:
    'When an eladrin is in the winter season, they reflect sorrow and melancholy, withdrawing into contemplation and introspection. Winter eladrin are somber and reserved, their emotions frozen like the frost. Their appearance reflects the season\'s cold beauty—hair as white as snow, skin pale as ice, and eyes that hold the depths of ancient grief. A winter eladrin\'s presence can be chilling, not in temperature but in the weight of unspoken sadness they carry. Their Fey Step channels this cold sorrow, striking fear into the hearts of those who witness their disappearance.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    'Darkvision: You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You discern colors in that darkness only as shades of gray.',
    'Fey Ancestry: You have advantage on saving throws you make to avoid or end the charmed condition on yourself.',
    'Keen Senses: You have proficiency in the Perception skill.',
    'Trance: You don\'t need to sleep, and magic can\'t put you to sleep. You can finish a Long Rest in 4 hours if you spend those hours in a trancelike meditation, during which you retain consciousness.',
    'Fey Step (Winter): As a Bonus Action, you can magically teleport up to 30 feet to an unoccupied space you can see. You can use this trait a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest. When you use your Fey Step, one creature of your choice that you can see within 5 feet of you before you teleport must succeed on a Wisdom saving throw (DC 8 + your Proficiency Bonus + your Intelligence, Wisdom, or Charisma modifier) or be frightened of you until the end of your next turn.',
    'Season Association: Winter represents contemplation and dolor, introspection and grief. You can change your season during a long rest, which changes your Fey Step effect.',
  ],
  visual: {
    id: 'winter_eladrin',
    icon: '❄️',
    color: '#B0E0E6',
    maleIllustrationPath: 'assets/images/races/Eladrin_Winter_Male.png',
    femaleIllustrationPath: 'assets/images/races/Eladrin_Winter_Female.png',
  },
};
