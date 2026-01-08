
/**
 * @file aasimar.ts
 * Defines the data for the Aasimar race in the Aralia RPG.
 * This includes their ID, name, description, and unique celestial traits
 * like Healing Hands and Light Bearer. ASIs are handled flexibly.
 */
import { Race } from '../../types'; // Path relative to src/data/races/

export const AASIMAR_DATA: Race = {
  id: 'aasimar',
  name: 'Aasimar',
  description:
    'Whether descended from a celestial being or infused with heavenly power, aasimar are mortals who carry a spark of the Upper Planes within their souls. They can fan that spark to bring light, ease wounds, and unleash the fury of the heavens.\n\nAasimar can arise among any population of mortals. They resemble their parents, but they live for up to 160 years and often have features that hint at their celestial heritage. These often begin subtle and become more obvious when the aasimar gains the ability to reveal their full celestial nature.',
  abilityBonuses: [], // ASIs are handled flexibly during character creation.
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium or Small',
    'Speed: 30 feet',
    'Celestial Resistance: You have resistance to necrotic damage and radiant damage.',
    'Darkvision: You can see in dim light within 60 feet of you as if it were bright light and in darkness as if it were dim light. You discern colors in that darkness only as shades of gray.',
    'Healing Hands: As an action, you can touch a creature and roll a number of d4s equal to your proficiency bonus. The creature regains a number of hit points equal to the total rolled. Once you use this trait, you can’t use it again until you finish a long rest.',
    'Light Bearer: You know the light cantrip. Charisma is your spellcasting ability for it.',
    'Celestial Revelation (Lvl 3): When you reach 3rd level, choose one of the revelation options (Necrotic Shroud, Radiant Consumption, or Radiant Soul). Thereafter, you can use a bonus action to unleash the celestial energy within yourself. Your transformation lasts for 1 minute or until you end it as a bonus action. Once you transform, you can’t use it again until you finish a long rest.',
  ],
  imageUrl: 'https://i.ibb.co/Qvm7Vwg1/Aasimar.png',
  visual: {
    id: 'aasimar',
    icon: '👼',
    color: '#FFD700',
    maleIllustrationPath: 'assets/images/races/aasimar_male.png',
    femaleIllustrationPath: 'assets/images/races/aasimar_female.png',
  },
  knownSpells: [
    { minLevel: 1, spellId: 'light' }
  ]
};
