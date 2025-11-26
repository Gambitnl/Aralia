
/**
 * @file githzerai.ts
 * Defines the data for the Githzerai race in the Aralia RPG.
 */
import { Race } from '../../types.ts';

export const GITHZERAI_DATA: Race = {
  id: 'githzerai',
  name: 'Githzerai',
  description:
    'Githzerai migrated to the Everchanging Chaos of Limbo after the ancient schism that split their ancestors from their cousins, githyanki. Limbo is a roiling maelstrom of matter and energy, collapsing and reforming without purpose or direction, until a creature exerts deliberate will to stabilize it. Through their potent psionic power, githzerai carved a home for themselves amid the chaos.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    'Githzerai Psionics: You know the mage hand cantrip, and the hand is invisible. Starting at 3rd level, you can cast the shield spell with this trait. Starting at 5th level, you can also cast the detect thoughts spell with it. Once you cast shield or detect thoughts with this trait, you can’t cast that spell with it again until you finish a long rest. Intelligence, Wisdom, or Charisma is your spellcasting ability for these spells (choose when you select this race).',
    'Mental Discipline: You have advantage on saving throws you make to avoid or end the charmed and frightened conditions on yourself.',
    'Psychic Resilience: You have resistance to psychic damage.',
  ],
  racialSpellChoice: {
    traitName: 'Githzerai Psionics',
    traitDescription: 'Choose your spellcasting ability for Githzerai Psionics (Mage Hand, Shield, Detect Thoughts).',
  },
  knownSpells: [
    { minLevel: 1, spellId: 'mage-hand' },
    { minLevel: 3, spellId: 'shield' },
    { minLevel: 5, spellId: 'detect-thoughts' }
  ]
};
