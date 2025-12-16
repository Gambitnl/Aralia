
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
    approves: [
      { id: 'defend_weak', description: 'Defending the weak', domain: 'combat', favorChange: 5 },
      { id: 'slay_evil_dragon', description: 'Slaying an evil dragon', domain: 'combat', favorChange: 20 },
      { id: 'honorable_act', description: 'Acting with honor', domain: 'social', favorChange: 2 },
    ],
    forbids: [
      { id: 'cowardice', description: 'Acts of cowardice', domain: 'combat', favorChange: -5 },
      { id: 'betrayal', description: 'Betraying an ally', domain: 'social', favorChange: -20 },
      { id: 'aid_tiamat', description: 'Aiding Tiamat or her cult', domain: 'social', favorChange: -50 },
    ],
    relationships: [
      { targetDeityId: 'tiamat', type: 'enemy', description: 'Eternal rival and sister' },
      { targetDeityId: 'moradin', type: 'ally', description: 'Share values of justice and creation' },
    ],
    blessings: [
        {
            id: 'platinum_scales',
            name: 'Platinum Scales',
            description: '+1 AC against evil creatures',
            minFavor: 20,
            effectType: 'stat_buff'
        }
    ]
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
    approves: [
      { id: 'craft_masterpiece', description: 'Crafting a masterwork item', domain: 'trade', favorChange: 15 },
      { id: 'defend_home', description: 'Defending one\'s home/stronghold', domain: 'combat', favorChange: 5 },
      { id: 'perseverance', description: 'Perseverance in adversity', domain: 'exploration', favorChange: 3 },
    ],
    forbids: [
      { id: 'sloth', description: 'Laziness or sloth', domain: 'social', favorChange: -2 },
      { id: 'shoddy_work', description: 'Creating shoddy or dangerous goods', domain: 'trade', favorChange: -10 },
      { id: 'abandon_clan', description: 'Abandoning one\'s clan', domain: 'social', favorChange: -25 },
    ],
    relationships: [
       { targetDeityId: 'bahamut', type: 'ally', description: 'Respects his honor' },
    ]
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
    approves: [
      { id: 'heal_needy', description: 'Healing the sick or needy', domain: 'magic', favorChange: 5 },
      { id: 'destroy_undead', description: 'Destroying undead', domain: 'combat', favorChange: 10 },
      { id: 'bring_hope', description: 'Bringing hope to the despairing', domain: 'social', favorChange: 3 },
    ],
    forbids: [
      { id: 'create_undead', description: 'Creating undead', domain: 'magic', favorChange: -50 },
      { id: 'darkness', description: 'Extinguishing light/hope', domain: 'social', favorChange: -10 },
      { id: 'torture', description: 'Torture or cruelty', domain: 'social', favorChange: -20 },
    ],
    relationships: [
        { targetDeityId: 'raven_queen', type: 'rival', description: 'Disagrees on the fate of undead, though both oppose perversion of death' }
    ]
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
    approves: [
      { id: 'destroy_undead', description: 'Destroying undead (especially intelligent ones)', domain: 'combat', favorChange: 15 },
      { id: 'accept_fate', description: 'Accepting one\'s fate/death', domain: 'social', favorChange: 5 },
      { id: 'hunt_necromancer', description: 'Hunting necromancers', domain: 'combat', favorChange: 10 },
    ],
    forbids: [
      { id: 'prolong_life', description: 'Unnaturally prolonging life (undeath)', domain: 'magic', favorChange: -50 },
      { id: 'cheat_death', description: 'Cheating death via resurrection (without ritual)', domain: 'magic', favorChange: -10 },
      { id: 'pity_dead', description: 'Excessive pity for the dead', domain: 'social', favorChange: -2 },
    ],
    relationships: [
        { targetDeityId: 'pelor', type: 'rival', description: 'Views his zeal against darkness as naive' }
    ]
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
    approves: [
      { id: 'make_pact', description: 'Convincing others to sign contracts', domain: 'social', favorChange: 10 },
      { id: 'tyranny', description: 'Establishing order through force', domain: 'social', favorChange: 5 },
      { id: 'trickery', description: 'Outwitting an opponent', domain: 'social', favorChange: 5 },
    ],
    forbids: [
      { id: 'break_contract', description: 'Breaking a contract', domain: 'social', favorChange: -100 },
      { id: 'chaos', description: 'Promoting chaos or anarchy', domain: 'social', favorChange: -20 },
      { id: 'mercy', description: 'Showing mercy to enemies', domain: 'combat', favorChange: -5 },
    ],
    relationships: []
  },
  {
    id: 'tiamat',
    name: 'Tiamat',
    titles: ['The Chromatic Dragon', 'Queen of Chaos'],
    alignment: 'Chaotic Evil',
    domains: ['War', 'Trickery'],
    symbol: 'Five-headed dragon',
    description: 'The goddess of greed and evil dragons. Trapped in the Nine Hells.',
    source: 'PHB 2014',
    approves: [
      { id: 'hoard_wealth', description: 'Hoarding wealth', domain: 'trade', favorChange: 10 },
      { id: 'conquer', description: 'Conquering weakness', domain: 'combat', favorChange: 15 },
    ],
    forbids: [
      { id: 'charity', description: 'Charity', domain: 'social', favorChange: -10 },
    ],
    relationships: [
       { targetDeityId: 'bahamut', type: 'enemy', description: 'Eternal rival' },
       { targetDeityId: 'asmodeus', type: 'master', description: 'She is imprisoned in his realm' }
    ]
  }
];
