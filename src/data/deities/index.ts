
import { Deity } from '../../types';

export const DEITIES: Deity[] = [
  // --- Dawn War Pantheon (Standard/Sample) ---
  {
    id: 'bahamut',
    name: 'Bahamut',
    titles: ['The Platinum Dragon', 'King of the Good Dragons', 'Lord of the North Wind'],
    alignment: 'Lawful Good',
    domains: ['Life', 'War'],
    symbol: 'Platinum dragon head in profile',
    description: 'The god of justice, nobility, and honor. He appears as a massive platinum dragon or an old man with canaries (gold dragons). He opposes Tiamat and evil dragons.',
    source: 'PHB 2014, DMG 2014',
  },
  {
    id: 'moradin',
    name: 'Moradin',
    titles: ['The Soul Forger', 'Dwarf-father'],
    alignment: 'Lawful Good',
    domains: ['Knowledge', 'War'],
    symbol: 'Hammer and anvil',
    description: 'The creator of dwarves and god of the forge, engineering, and war. He judges souls and inspires artisans.',
    source: 'PHB 2014',
  },
  {
    id: 'pelor',
    name: 'Pelor',
    titles: ['The Dawnfather', 'The Shining One'],
    alignment: 'Neutral Good',
    domains: ['Life', 'Light'],
    symbol: 'Sun face',
    description: 'God of the sun, light, strength, and healing. He brings light to the darkness and is a foe of all things evil.',
    source: 'PHB 2014',
  },
  {
    id: 'raven_queen',
    name: 'The Raven Queen',
    titles: ['Matron of Death', 'Queen of the Shadowfell'],
    alignment: 'Lawful Neutral',
    domains: ['Death', 'Life'],
    symbol: 'Raven head in profile',
    description: 'Goddess of death, fate, and winter. She ensures the natural transition of death and hates undeath.',
    source: 'DMG 2014',
  },
  {
    id: 'asmodeus',
    name: 'Asmodeus',
    titles: ['The Lord of the Nine', 'The Prince of Lies'],
    alignment: 'Lawful Evil',
    domains: ['Knowledge', 'Trickery'],
    symbol: 'Three inverted triangles arranged in a long triangle',
    description: 'The supreme master of the Nine Hells. He governs sin, tyranny, and contracts. He is a master manipulator.',
    source: 'PHB 2014, DMG 2014',
  }
];
