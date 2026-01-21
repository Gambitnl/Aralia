import { Race } from '../../types';

export const LONGTOOTH_SHIFTER_DATA: Race = {
  id: 'longtooth_shifter',
  name: 'Longtooth Shifter',
  baseRace: 'shifter',
  description: 'Longtooth shifters are fierce and aggressive, their lycanthropic heritage tied to fierce predators like wolves and tigers. When they shift, they grow elongated fangs capable of tearing through flesh with ease. These shifters embody the hunter\'s fury, channeling their bestial nature into devastating attacks. Longtooth shifters are often drawn to martial pursuits, their natural aggression making them formidable warriors who revel in close combat where they can put their fangs to use.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    'Darkvision: You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You discern colors in that darkness only as shades of gray.',
    'Shifting: As a Bonus Action, you can assume a more bestial appearance. This transformation lasts for 1 minute, until you die, or until you revert to your normal appearance as a bonus action. When you shift, you gain temporary hit points equal to 2 x your Proficiency Bonus. You can shift a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest. Whenever you shift, you also gain an additional benefit based on your subrace (see Fangs).',
    'Fangs: While shifted, you can use your elongated fangs to make an unarmed strike as a Bonus Action. If you hit with your fangs, you deal piercing damage equal to 1d6 + your Strength modifier, instead of the bludgeoning damage normal for an unarmed strike.',
  ],
  visual: {
    id: 'longtooth_shifter',
    icon: '🐺',
    color: '#696969',
    maleIllustrationPath: 'assets/images/races/Shifter_Longtooth_Male.png',
    femaleIllustrationPath: 'assets/images/races/Shifter_Longtooth_Female.png',
  },
};
