/**
 * @file summer_eladrin.ts
 * Defines the data for the Summer Eladrin race in the Aralia RPG.
 * Summer eladrin burn with aggressive energy, their Fey Step dealing fire damage.
 */
import { Race } from '../../types';

export const SUMMER_ELADRIN_DATA: Race = {
  id: 'summer_eladrin',
  name: 'Summer Eladrin',
  baseRace: 'eladrin',
  description:
    'When an eladrin is in the summer season, they burn with aggressive energy and fierce determination. Summer eladrin are bold, brash, and filled with righteous fury. Their appearance reflects the season\'s intensity—fiery hair that seems to flicker like flames, skin bronzed like sun-baked earth, and eyes that smolder with inner fire. A summer eladrin\'s passion can be overwhelming, their presence commanding attention and respect. Their Fey Step channels this fierce energy, erupting in a burst of flames that sears nearby enemies.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    'Darkvision: You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You discern colors in that darkness only as shades of gray.',
    'Fey Ancestry: You have advantage on saving throws you make to avoid or end the charmed condition on yourself.',
    'Keen Senses: You have proficiency in the Perception skill.',
    'Trance: You don\'t need to sleep, and magic can\'t put you to sleep. You can finish a Long Rest in 4 hours if you spend those hours in a trancelike meditation, during which you retain consciousness.',
    'Fey Step (Summer): As a Bonus Action, you can magically teleport up to 30 feet to an unoccupied space you can see. You can use this trait a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest. Immediately after you teleport, each creature of your choice that you can see within 5 feet of you takes fire damage equal to your Proficiency Bonus.',
    'Season Association: Summer represents boldness and aggression, a filtered fury of the burning sun. You can change your season during a long rest, which changes your Fey Step effect.',
  ],
  visual: {
    id: 'summer_eladrin',
    icon: '☀️',
    color: '#FF6347',
    maleIllustrationPath: 'assets/images/races/Eladrin_Summer_Male.png',
    femaleIllustrationPath: 'assets/images/races/Eladrin_Summer_Female.png',
  },
};
