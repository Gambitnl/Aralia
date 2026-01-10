import { Race } from '../../types';

export const BEASTHIDE_SHIFTER_DATA: Race = {
  id: 'beasthide_shifter',
  name: 'Beasthide Shifter',
  baseRace: 'shifter',
  description: 'Beasthide shifters are typically tied to the bear or the boar, animals known for their tough hides and ferocious strength when cornered. These shifters are among the most resilient of their kind, able to shrug off blows that would fell lesser warriors. When they shift, their skin thickens and their features become more bestial, granting them remarkable durability. Beasthide shifters often find roles as front-line fighters, bodyguards, and protectors, using their enhanced endurance to shield their allies from harm.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    'Darkvision: You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You discern colors in that darkness only as shades of gray.',
    'Shifting: As a Bonus Action, you can assume a more bestial appearance. This transformation lasts for 1 minute, until you die, or until you revert to your normal appearance as a bonus action. When you shift, you gain temporary hit points equal to 2 x your Proficiency Bonus. You can shift a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest. Whenever you shift, you also gain an additional benefit based on your subrace (see Bestial Durability).',
    'Bestial Durability: Whenever you shift, you gain 1d6 additional temporary hit points. While shifted, you also have a +1 bonus to your Armor Class.',
  ],
  visual: {
    id: 'beasthide_shifter',
    icon: '🐻',
    color: '#8B4513',
    maleIllustrationPath: 'assets/images/races/beasthide_shifter_male.png',
    femaleIllustrationPath: 'assets/images/races/beasthide_shifter_female.png',
  },
};
