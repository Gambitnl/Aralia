import { Race } from '../../types';

export const SWIFTSTRIDE_SHIFTER_DATA: Race = {
  id: 'swiftstride_shifter',
  name: 'Swiftstride Shifter',
  baseRace: 'shifter',
  description: 'Swiftstride shifters are graceful and quick, their lycanthropic heritage tied to swift and elusive creatures like cats, rats, and ravens. They are often characterized by feline features or sleek, streamlined builds. When shifted, these shifters move with supernatural speed and grace, able to dart away from danger in the blink of an eye. Swiftstride shifters excel as scouts, rogues, and skirmishers, using their enhanced mobility to strike quickly and retreat before enemies can retaliate.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    "Vision: You can see in [[dim_light|dim light]] within 60 feet of you as if it were [[bright_light|bright light]], and in [[darkness]] as if it were [[dim_light|dim light]]. You can't discern color in [[darkness]], only shades of gray.",
    'Shifting: As a Bonus Action, you can assume a more bestial appearance. This transformation lasts for 1 minute, until you die, or until you revert to your normal appearance as a bonus action. When you shift, you gain temporary hit points equal to 2 x your Proficiency Bonus. You can shift a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest. Whenever you shift, you also gain an additional benefit based on your subrace (see Swift Stride).',
    'Swift Stride: While shifted, your walking speed increases by 10 feet. Additionally, you can move up to 10 feet as a reaction when a creature ends its turn within 5 feet of you. This reactive movement doesn\'t provoke opportunity attacks.',
  ],
  visual: {
    id: 'swiftstride_shifter',
    color: '#DEB887',
    maleIllustrationPath: 'assets/images/races/Shifter_Swiftstride_Male.png',
    femaleIllustrationPath: 'assets/images/races/Shifter_Swiftstride_Female.png',
  },
};
