import { Race } from '../../types';

export const SCOURGE_AASIMAR_DATA: Race = {
  id: 'scourge_aasimar',
  name: 'Scourge Aasimar',
  baseRace: 'aasimar',
  description: 'Scourge aasimar are imbued with a divine energy that blazes intensely within them. It feeds a powerful desire to destroy evil—a desire that is, at its best, parsing and exacting, but at its worst, all-consuming. Many scourge aasimar wear masks to block out the world and focus on containing this power, unmasking only in battle. When they transform, their divine energy erupts in a searing radiance that burns all around them, friend and foe alike—a price they willingly pay to purge evil from the world.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium or Small',
    'Speed: 30 feet',
    'Darkvision: 60 feet',
    'Celestial Resistance: You have resistance to necrotic damage and radiant damage.',
    'Healing Hands: As an action, you can touch a creature and roll a number of d4s equal to your Proficiency Bonus. The creature regains a number of hit points equal to the total rolled. Once you use this trait, you can\'t use it again until you finish a Long Rest.',
    'Light Bearer: You know the light cantrip. Charisma is your spellcasting ability for it.',
    'Radiant Consumption: Starting at 3rd level, you can use a Bonus Action to unleash the divine energy within yourself, causing searing light to radiate from you, pour out of your eyes and mouth, and threaten to char you. Your transformation lasts for 1 minute or until you end it as a bonus action. During it, you shed bright light in a 10-foot radius and dim light for an additional 10 feet, and at the end of each of your turns, each creature within 10 feet of you takes radiant damage equal to your Proficiency Bonus. Until the transformation ends, once on each of your turns, you can deal extra radiant damage to one target when you deal damage to it with an attack or a spell. The extra radiant damage equals your Proficiency Bonus. Once you use this trait, you can\'t use it again until you finish a Long Rest.',
  ],
  visual: {
    id: 'scourge_aasimar',
    icon: '🔥',
    color: '#FF4500',
    maleIllustrationPath: 'assets/images/races/Aasimar_Scourge_Male.png',
    femaleIllustrationPath: 'assets/images/races/Aasimar_Scourge_Female.png',
  },
  knownSpells: [
    { minLevel: 1, spellId: 'light' }
  ]
};
