/**
 * @file mark_of_storm_half_elf.ts
 * Defines the data for the Mark of Storm Half-Elf race in the Aralia RPG.
 * Mark of Storm half-elves possess power over wind and weather.
 */
import { Race } from '../../types';

export const MARK_OF_STORM_HALF_ELF_DATA: Race = {
  id: 'stormborn_half_elf',
  name: 'Stormborn Half-Elf',
  baseRace: 'half_elf',
  description:
    'Born with a crackling sigil that shifts and pulses like storm clouds, half-elves bearing the Mark of Storm command the winds and weather itself. This hereditary gift flows from ancient pacts with elemental powers, manifesting as the ability to call lightning from clear skies and ride the strongest gales. Their mark glows brightest during tempests, and they feel most alive when wind whips around them. These storm-touched individuals become legendary sailors, navigators, and storm callers, their mastery of the elements making them both feared and revered.',
  abilityBonuses: [
    {
      ability: 'charisma',
      amount: 2,
    },
    {
      ability: 'dexterity',
      amount: 1,
    },
  ],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium (about 5-6 feet tall)',
    'Speed: 30 feet',
    'Darkvision: You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You can\'t discern color in darkness, only shades of gray.',
    'Fey Ancestry: You have advantage on saving throws against being charmed, and magic can\'t put you to sleep.',
    'Windwright\'s Intuition: When you make a Dexterity (Acrobatics) check or any ability check involving navigator\'s tools, you can roll a d4 and add the number rolled to the ability check.',
    'Storm\'s Boon: You have resistance to lightning damage.',
    'Headwinds: You know the Gust cantrip. Starting at 3rd level, you can cast the Gust of Wind spell once with this trait, and you regain the ability to cast it when you finish a Long Rest. Charisma is your spellcasting ability for these spells.',
    'Spells of the Mark: If you have the Spellcasting or Pact Magic class feature, the spells on the Mark of Storm Spells table are added to the spell list of your spellcasting class.',
  ],
  imageUrl: 'assets/images/races/mark_of_storm_half_elf.png',
  visual: {
    id: 'mark_of_storm_half_elf',
    icon: '⚡',
    color: '#4682B4',
    maleIllustrationPath: 'assets/images/races/mark_of_storm_half_elf_male.png',
    femaleIllustrationPath: 'assets/images/races/mark_of_storm_half_elf_female.png',
  },
};
