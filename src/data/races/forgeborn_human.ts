/**
 * @file mark_of_making_human.ts
 * Defines the data for the Mark of Making Human race in the Aralia RPG.
 * Humans with the Mark of Making possess exceptional crafting and artifice abilities.
 */
import { Race } from '../../types';

export const MARK_OF_MAKING_HUMAN_DATA: Race = {
  id: 'forgeborn_human',
  name: 'Forgeborn Human',
  baseRace: 'human',
  description:
    'Inscribed with a sigil that glows when creating or repairing, humans bearing the Mark of Making are blessed with supernatural crafting ability. This hereditary gift grants them an intuitive understanding of how things work and how to build them better. Their mark pulses with energy when they craft magical items or mend broken objects, channeling arcane power through their skilled hands. These maker-touched individuals become legendary artificers, master craftspeople, and inventors, their creations sought across the realm.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    'Resourceful: You gain Heroic Inspiration whenever you finish a Long Rest.',
    'Skillful: You gain proficiency in one skill of your choice.',
    'Versatile: You gain an Origin feat of your choice.',
    'Artisan\'s Intuition: When you make an Arcana check or an ability check involving artisan\'s tools, you can roll a d4 and add the number rolled to the ability check.',
    'Maker\'s Gift: You gain proficiency with one type of artisan\'s tools of your choice.',
    'Spellsmith: You know the Mending cantrip. You can also cast Magic Weapon with this trait. When you do so, the spell lasts for 1 hour and doesn\'t require concentration. Once you cast this spell with this trait, you can\'t do so again until you finish a Long Rest. Intelligence is your spellcasting ability for these spells.',
    'Spells of the Mark: If you have the Spellcasting or Pact Magic class feature, the spells on the Mark of Making Spells table are added to the spell list of your spellcasting class.',
  ],
  visual: {
    id: 'mark_of_making_human',
    icon: '🔨',
    color: '#CD7F32',
    maleIllustrationPath: 'assets/images/races/Human_Forgeborn_Male.png',
    femaleIllustrationPath: 'assets/images/races/Human_Forgeborn_Female.png',
  },
  knownSpells: [
    { minLevel: 1, spellId: 'mending' },
    { minLevel: 1, spellId: 'magic-weapon' },
  ],
};
