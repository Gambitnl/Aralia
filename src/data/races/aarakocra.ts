
/**
 * @file aarakocra.ts
 * Defines the data for the Aarakocra race in the Aralia RPG, based on Mordenkainen Presents: Monsters of the Multiverse, pg. 6,
 * and user-provided updated text.
 * ASIs are handled flexibly during character creation, not as fixed racial bonuses.
 */
import { Race } from '../../types'; // Path relative to src/data/races/

export const AARAKOCRA_DATA: Race = {
  id: 'aarakocra',
  name: 'Aarakocra',
  baseRace: 'beastfolk',
  description:
    'A winged people who originated on the Elemental Plane of Air, aarakocra soar through the sky wherever they wander. The first aarakocra served the Wind Dukes of Aaqa—mighty beings of air—and were imbued with a measure of their masters’ power over winds. Their descendants still command echoes of that power.\n\nAasimar can arise among any population of mortals. They resemble their parents, but they live for up to 160 years and often have features that hint at their celestial heritage. These often begin subtle and become more obvious when the aasimar gains the ability to reveal their full celestial nature.',
  abilityBonuses: [], // Flexible ASIs are handled by the Point Buy system.
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    'Flight: Because of your wings, you have a flying speed equal to your walking speed. You can’t use this flying speed if you’re wearing medium or heavy armor.',
    'Talons: You have talons that you can use to make unarmed strikes. When you hit with them, the strike deals 1d6 + your Strength modifier slashing damage, instead of the bludgeoning damage normal for an unarmed strike.',
    'Wind Caller: Starting at 3rd level, you can cast the gust of wind spell with this trait, without requiring a material component. Once you cast the spell with this trait, you can’t do so again until you finish a long rest. You can also cast the spell using any spell slots you have of 2nd level or higher. Intelligence, Wisdom, or Charisma is your spellcasting ability for it when you cast gust of wind with this trait (choose when you select this race).',
  ],
  imageUrl: 'https://i.ibb.co/jPRJmQwb/Aarakocra.png',
  visual: {
    id: 'aarakocra',
    icon: '🦅',
    color: '#8B7355',
    maleIllustrationPath: 'assets/images/races/Aarakocra_Male.png',
    femaleIllustrationPath: 'assets/images/races/Aarakocra_Female.png',
  },
  racialSpellChoice: {
    traitName: 'Wind Caller',
    traitDescription: 'Choose the spellcasting ability for your Wind Caller trait (Gust of Wind).',
  },
  knownSpells: [
    { minLevel: 3, spellId: 'gust-of-wind' }
  ]
};
