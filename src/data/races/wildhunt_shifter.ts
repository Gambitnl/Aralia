import { Race } from '../../types';

export const WILDHUNT_SHIFTER_DATA: Race = {
  id: 'wildhunt_shifter',
  name: 'Wildhunt Shifter',
  baseRace: 'shifter',
  description: 'Wildhunt shifters are the most in tune with their animal nature, their lycanthropic heritage tied to creatures known for their keen senses and tracking ability like wolves and bloodhounds. Sharp-eyed and perceptive, these shifters make excellent trackers and hunters. When they shift, their senses sharpen to supernatural levels, allowing them to detect hidden foes and react to threats before they manifest. Wildhunt shifters often serve as scouts, rangers, and sentries, their enhanced awareness making them nearly impossible to ambush or deceive.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    'Darkvision: You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You discern colors in that darkness only as shades of gray.',
    'Shifting: As a Bonus Action, you can assume a more bestial appearance. This transformation lasts for 1 minute, until you die, or until you revert to your normal appearance as a bonus action. When you shift, you gain temporary hit points equal to 2 x your Proficiency Bonus. You can shift a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest. Whenever you shift, you also gain an additional benefit based on your subrace (see Mark the Scent).',
    'Mark the Scent: While shifted, you have advantage on Wisdom checks, and no creature within 30 feet of you can make an attack roll with advantage against you unless you\'re incapacitated.',
  ],
  visual: {
    id: 'wildhunt_shifter',
    icon: '🦉',
    color: '#2F4F4F',
    maleIllustrationPath: 'assets/images/races/wildhunt_shifter_male.png',
    femaleIllustrationPath: 'assets/images/races/wildhunt_shifter_female.png',
  },
};
