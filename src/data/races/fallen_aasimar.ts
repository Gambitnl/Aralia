import { Race } from '../../types';

export const FALLEN_AASIMAR_DATA: Race = {
  id: 'fallen_aasimar',
  name: 'Fallen Aasimar',
  baseRace: 'aasimar',
  description: 'Fallen aasimar are those touched by dark powers as a youth or who have turned to evil in early adulthood. An aasimar who was touched by dark powers as a youth might turn thoroughly evil, while others find redemption late in life after years of wrongdoing. Some fallen aasimar heard whispers from an evil entity in their dreams and took those dark suggestions to heart. Whatever the cause, fallen aasimar manifest their transformation through skeletal, flightless wings and an aura of dread that frightens all who witness it.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium or Small',
    'Speed: 30 feet',
    'Darkvision: 60 feet',
    'Celestial Resistance: You have resistance to necrotic damage and radiant damage.',
    'Healing Hands: As an action, you can touch a creature and roll a number of d4s equal to your Proficiency Bonus. The creature regains a number of hit points equal to the total rolled. Once you use this trait, you can\'t use it again until you finish a Long Rest.',
    'Light Bearer: You know the light cantrip. Charisma is your spellcasting ability for it.',
    'Necrotic Shroud: Starting at 3rd level, you can use a Bonus Action to unleash the divine energy within yourself, causing your eyes to turn into pools of darkness and two skeletal, ghostly, flightless wings to sprout from your back. The instant you transform, other creatures within 10 feet of you that can see you must succeed on a Charisma saving throw (DC 8 + your Proficiency Bonus + your Charisma modifier) or become frightened of you until the end of your next turn. Your transformation lasts for 1 minute or until you end it as a bonus action. During it, once on each of your turns, you can deal extra necrotic damage to one target when you deal damage to it with an attack or a spell. The extra necrotic damage equals your Proficiency Bonus. Once you use this trait, you can\'t use it again until you finish a Long Rest.',
  ],
  visual: {
    id: 'fallen_aasimar',
    icon: '💀',
    color: '#4B0082',
    maleIllustrationPath: 'assets/images/races/Aasimar_Fallen_Male.png',
    femaleIllustrationPath: 'assets/images/races/Aasimar_Fallen_Female.png',
  },
  knownSpells: [
    { minLevel: 1, spellId: 'light' }
  ]
};
