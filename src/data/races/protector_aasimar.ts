import { Race } from '../../types';

export const PROTECTOR_AASIMAR_DATA: Race = {
  id: 'protector_aasimar',
  name: 'Protector Aasimar',
  baseRace: 'aasimar',
  description: 'Protector aasimar are charged by the powers of good to guard the weak, strike at evil wherever it arises, and stand vigilant against the darkness. From a young age, a protector aasimar receives advice and directives that urge them to stand against evil. Their celestial guide speaks in dreams, visions, and feelings, guiding them toward righteousness. When they transform, spectral wings sprout from their back, a manifestation of their celestial nature that allows them to soar above their enemies while radiating divine light.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium or Small',
    'Speed: 30 feet',
    "Vision: You can see in [[dim_light|dim light]] within 60 feet of you as if it were [[bright_light|bright light]], and in [[darkness]] as if it were [[dim_light|dim light]]. You can't discern color in [[darkness]], only shades of gray.",
    'Celestial Resistance: You have resistance to necrotic damage and radiant damage.',
    'Healing Hands: As an action, you can touch a creature and roll a number of d4s equal to your Proficiency Bonus. The creature regains a number of hit points equal to the total rolled. Once you use this trait, you can\'t use it again until you finish a Long Rest.',
    'Light Bearer: You know the light cantrip. Charisma is your spellcasting ability for it.',
    'Radiant Soul: Starting at 3rd level, you can use a Bonus Action to unleash the divine energy within yourself, causing your eyes to glimmer and two luminous, incorporeal wings to sprout from your back. Your transformation lasts for 1 minute or until you end it as a bonus action. During it, you have a flying speed equal to your walking speed, and once on each of your turns, you can deal extra radiant damage to one target when you deal damage to it with an attack or a spell. The extra radiant damage equals your Proficiency Bonus. Once you use this trait, you can\'t use it again until you finish a Long Rest.',
  ],
  visual: {
    id: 'protector_aasimar',
    color: '#FFD700',
    maleIllustrationPath: 'assets/images/races/Aasimar_Protector_Male.png',
    femaleIllustrationPath: 'assets/images/races/Aasimar_Protector_Female.png',
  },
  knownSpells: [
    { minLevel: 1, spellId: 'light' }
  ]
};
