/**
 * @file draconblood_dragonborn.ts
 * Defines the data for the Draconblood Dragonborn race in the Aralia RPG.
 * Draconblood dragonborn are a Critical Role variant from Explorer's Guide to Wildemount,
 * known for their arcane prowess and noble lineage.
 */
import { Race } from '../../types';

export const DRACONBLOOD_DRAGONBORN_DATA: Race = {
  id: 'draconblood_dragonborn',
  name: 'Draconblood Dragonborn',
  baseRace: 'dragonborn',
  description:
    'Draconblood dragonborn are the product of selective breeding by the draconic sorcerers of ancient Draconia. They possess refined features and an innate connection to arcane magic. Unlike other dragonborn, they lack breath weapons but compensate with enhanced mental capabilities and magical talent. Their scales tend toward refined, noble colors, and they carry themselves with aristocratic bearing.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    "Vision: You can see in [[dim_light|dim light]] within 60 feet of you as if it were [[bright_light|bright light]], and in [[darkness]] as if it were [[dim_light|dim light]]. You can't discern color in [[darkness]], only shades of gray.",
    'Forceful Presence: You can use your understanding of creative diplomacy or intimidation to guide a conversation in your favor. When you make a Charisma (Intimidation or Persuasion) check, you can do so with advantage. Once you use this trait, you can\'t do so again until you finish a short or long rest.',
    'Draconic Ancestral Legacy: You inherit the might of your dragon ancestors. You know the Thaumaturgy cantrip. You can cast Comprehend Languages once with this trait, and you regain the ability to do so when you finish a long rest. At 5th level, you can cast Detect Magic once with this trait, and you regain the ability to do so when you finish a long rest. Intelligence, Wisdom, or Charisma is your spellcasting ability for these spells (choose when you select this race).',
    'Draconic Language: You can speak, read, and write Draconic.',
  ],
  visual: {
    id: 'draconblood_dragonborn',
    color: '#8B008B',
    maleIllustrationPath: 'assets/images/races/Dragonborn_Draconblood_Male.png',
    femaleIllustrationPath: 'assets/images/races/Dragonborn_Draconblood_Female.png',
  },
  racialSpellChoice: {
    traitName: 'Draconic Ancestral Legacy',
    traitDescription: 'Choose your spellcasting ability for Draconic Ancestral Legacy (Thaumaturgy, Comprehend Languages, Detect Magic).',
  },
  knownSpells: [
    { minLevel: 1, spellId: 'thaumaturgy' },
    { minLevel: 1, spellId: 'comprehend-languages' },
    { minLevel: 5, spellId: 'detect-magic' }
  ]
};
