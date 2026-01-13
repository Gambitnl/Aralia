/**
 * @file mark_of_scribing_gnome.ts
 * Defines the data for the Mark of Scribing Gnome race in the Aralia RPG.
 * Gnomes with the Mark of Scribing are masters of language and documentation.
 */
import { Race } from '../../types';

export const MARK_OF_SCRIBING_GNOME_DATA: Race = {
    id: 'wordweaver_gnome',
    name: 'Wordweaver Gnome',
    baseRace: 'gnome',
    description:
        'Adorned with an intricate sigil that shifts like living text, gnomes bearing the Mark of Scribing possess mastery over written and spoken language. This hereditary gift grants them an almost preternatural understanding of communication in all its forms, allowing them to transcend linguistic barriers and imbue their words with magical power. Their mark glows softly when they read or write, and their voice carries across impossible distances when needed. These gifted gnomes become translators, archivists, diplomats, and keepers of knowledge, their words holding weight beyond mere meaning.',
    abilityBonuses: [], // Flexible ASIs handled by Point Buy.
    traits: [
        'Creature Type: Humanoid',
        'Size: Small (about 3-4 feet tall)',
        'Speed: 25 feet',
        'Darkvision: You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You can\'t discern color in darkness, only shades of gray.',
        'Gnome Cunning: You have Advantage on all Intelligence, Wisdom, and Charisma saving throws against magic.',
        'Gifted Scribe: When you make an Intelligence (History) check or an ability check using calligrapher\'s supplies, you can roll a d4 and add the number rolled to the ability check.',
        'Scribe\'s Insight: You know the Message cantrip. You can also cast Comprehend Languages once with this trait, and you regain the ability to cast it when you finish a Long Rest. Starting at 3rd level, you can cast the Magic Mouth spell with this trait, and you regain the ability to cast it when you finish a Long Rest. Intelligence is your spellcasting ability for these spells.',
        'Spells of the Mark: If you have the Spellcasting or Pact Magic class feature, the spells on the Mark of Scribing Spells table are added to the spell list of your spellcasting class. (Mark of Scribing Spells: 1st level - Comprehend Languages, Illusory Script; 2nd level - Animal Messenger, Silence; 3rd level - Sending, Tongues; 4th level - Arcane Eye, Confusion; 5th level - Dream)',
    ],
    imageUrl: 'assets/images/races/mark_of_scribing_gnome.png',
    visual: {
        id: 'mark_of_scribing_gnome',
        icon: '📜',
        color: '#4682B4',
        maleIllustrationPath: 'assets/images/races/mark_of_scribing_gnome_male.png',
        femaleIllustrationPath: 'assets/images/races/mark_of_scribing_gnome_female.png',
    },
};
