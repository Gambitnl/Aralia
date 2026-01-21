/**
 * @file autumn_eladrin.ts
 * Defines the data for the Autumn Eladrin race in the Aralia RPG.
 * Autumn eladrin embody peace and goodwill, their Fey Step charming nearby creatures.
 */
import { Race } from '../../types';

export const AUTUMN_ELADRIN_DATA: Race = {
  id: 'autumn_eladrin',
  name: 'Autumn Eladrin',
  baseRace: 'eladrin',
  description:
    'When an eladrin is in the autumn season, they embody peace and goodwill, sharing freely with others and spreading kindness wherever they go. Autumn eladrin are contemplative and generous, often serving as mediators and peacemakers. Their appearance reflects the season\'s gentle warmth—hair in shades of red, orange, and gold like falling leaves, skin with earthy undertones, and eyes that radiate calm wisdom. An autumn eladrin\'s presence can soothe troubled minds and ease tensions. Their Fey Step carries the peace of the harvest season, calming those nearby.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    'Darkvision: You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You discern colors in that darkness only as shades of gray.',
    'Fey Ancestry: You have advantage on saving throws you make to avoid or end the charmed condition on yourself.',
    'Keen Senses: You have proficiency in the Perception skill.',
    'Trance: You don\'t need to sleep, and magic can\'t put you to sleep. You can finish a Long Rest in 4 hours if you spend those hours in a trancelike meditation, during which you retain consciousness.',
    'Fey Step (Autumn): As a Bonus Action, you can magically teleport up to 30 feet to an unoccupied space you can see. You can use this trait a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest. Immediately after you teleport, up to two creatures of your choice that you can see within 10 feet of you must succeed on a Wisdom saving throw (DC 8 + your Proficiency Bonus + your Intelligence, Wisdom, or Charisma modifier) or be charmed by you for 1 minute, or until you or your companions deal any damage to the target.',
    'Season Association: Autumn represents peace and goodwill, with a desire to share and give. You can change your season during a long rest, which changes your Fey Step effect.',
  ],
  visual: {
    id: 'autumn_eladrin',
    icon: '🍂',
    color: '#D2691E',
    maleIllustrationPath: 'assets/images/races/Eladrin_Autumn_Male.png',
    femaleIllustrationPath: 'assets/images/races/Eladrin_Autumn_Female.png',
  },
};
