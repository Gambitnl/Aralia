
import { Biome } from '../types';
import { DiscoveryReward, DiscoveryConsequence } from '../types/exploration';

export interface LandmarkRewardTemplate {
  type: 'item' | 'xp' | 'health' | 'gold';
  resourceId?: string; // itemId for items
  amountRange: [number, number]; // [min, max]
  chance: number; // 0.0 to 1.0
  descriptionTemplate: string; // "You find {amount} gold coins."
}

export interface LandmarkConsequenceTemplate {
  type: 'buff' | 'map_reveal' | 'reputation';
  targetId?: string;
  duration?: number;
  value?: number;
  chance: number;
  descriptionTemplate: string;
}

export interface LandmarkInteractionTemplate {
  id: string;
  labelTemplate: string;
  descriptionTemplate: string;
  skillCheck?: {
    skill: string;
    difficultyRange: [number, number];
  };
  successRewards?: LandmarkRewardTemplate[];
  successConsequences?: LandmarkConsequenceTemplate[];
  failureConsequences?: LandmarkConsequenceTemplate[];
}

export interface LandmarkTemplate {
  id: string;
  nameTemplate: string[]; // e.g., ["Ancient Ruins", "Crumbling Watchtower"]
  descriptionTemplate: string[];
  biomes: string[]; // e.g., ['forest', 'plains']
  weight: number;
  possibleRewards?: LandmarkRewardTemplate[];
  possibleConsequences?: LandmarkConsequenceTemplate[];
  possibleInteractions?: LandmarkInteractionTemplate[];
}

export const LANDMARK_TEMPLATES: LandmarkTemplate[] = [
  {
    id: 'ancient_monument',
    nameTemplate: ['Ancient Obelisk', 'Forgotten Statue', 'Mossy Monolith', 'Rune-Carved Stone'],
    descriptionTemplate: [
      'A tall stone structure rises from the ground, covered in undecipherable runes.',
      'A statue of a forgotten king stands vigil, eroded by centuries of wind and rain.',
      'A monolith hums with a faint, deep resonance that you feel in your bones.',
    ],
    biomes: ['forest', 'plains', 'hills'],
    weight: 2,
    possibleRewards: [],
    possibleInteractions: [
      {
        id: 'study',
        labelTemplate: 'Study the runes',
        descriptionTemplate: 'Attempt to decipher the ancient script.',
        skillCheck: { skill: 'Arcana', difficultyRange: [12, 16] },
        successRewards: [
           {
             type: 'xp',
             amountRange: [50, 100],
             chance: 1.0,
             descriptionTemplate: 'You decipher the history of the region. (+{amount} XP)'
           }
        ],
        successConsequences: [
          {
            type: 'reputation',
            targetId: 'scholars_guild',
            value: 5,
            chance: 1.0,
            descriptionTemplate: 'The Scholars Guild values this knowledge. (+5 Reputation)'
          }
        ],
        failureConsequences: [
           {
             type: 'buff',
             targetId: 'headache',
             duration: 1,
             value: -1,
             chance: 1.0,
             descriptionTemplate: 'The runes make your head spin. (Confused for 1 hour)'
           }
        ]
      },
      {
        id: 'pray',
        labelTemplate: 'Offer a prayer',
        descriptionTemplate: 'Pay respects to the ancient spirits.',
        skillCheck: { skill: 'Religion', difficultyRange: [10, 14] },
        successRewards: [
          {
            type: 'health',
            amountRange: [5, 15],
            chance: 1.0,
            descriptionTemplate: 'A warm light engulfs you. (+{amount} HP)'
          }
        ],
        failureConsequences: []
      }
    ]
  },
  {
    id: 'natural_wonder',
    nameTemplate: ['Crystal Cave', 'Whispering Falls', 'Giant\'s Footprint', 'Glowing Grotto'],
    descriptionTemplate: [
      'Water cascades down into a pool that glows with an inner light.',
      'A massive depression in the earth looks remarkably like a footprint of a titan.',
      'Crystals of every color jut from the cavern walls, illuminating the darkness.',
    ],
    biomes: ['mountain', 'forest', 'hills', 'underdark'],
    weight: 2,
    possibleRewards: [
      {
        type: 'item',
        resourceId: 'healing_potion',
        amountRange: [1, 2],
        chance: 0.8,
        descriptionTemplate: 'You find {amount} healing potion(s) left by a previous traveler.',
      }
    ],
    possibleInteractions: [
      {
        id: 'meditate',
        labelTemplate: 'Meditate',
        descriptionTemplate: 'Connect with the natural energy of this place.',
        skillCheck: { skill: 'Nature', difficultyRange: [12, 15] },
        successConsequences: [
          {
            type: 'map_reveal',
            value: 2,
            chance: 1.0,
            descriptionTemplate: 'Your senses expand, revealing the surrounding area. (Map Reveal Radius: 2)'
          }
        ],
        failureConsequences: []
      },
      {
        id: 'collect',
        labelTemplate: 'Collect samples',
        descriptionTemplate: 'Gather rare herbs or crystals.',
        skillCheck: { skill: 'Survival', difficultyRange: [12, 15] },
        successRewards: [
           {
             type: 'gold',
             amountRange: [10, 30],
             chance: 1.0,
             descriptionTemplate: 'You find valuable reagents worth {amount} gold.'
           }
        ],
        failureConsequences: [
           {
             type: 'buff',
             targetId: 'minor_poison',
             duration: 4,
             value: 0,
             chance: 1.0,
             descriptionTemplate: 'You touch something toxic. (Poisoned for 4 hours)'
           }
        ]
      }
    ]
  },
  {
    id: 'battlefield_remnant',
    nameTemplate: ['Sword Graveyard', 'Cratered Field', 'Bone Hill', 'Rusting Fields'],
    descriptionTemplate: [
      'Rusted weapons protrude from the earth like strange metallic grass.',
      'The land here is scarred, with old craters filled with murky water.',
      'Bleached bones lie scattered among broken shields and shattered pikes.',
    ],
    biomes: ['plains', 'desert'],
    weight: 1,
    possibleRewards: [],
    possibleInteractions: [
      {
        id: 'scavenge',
        labelTemplate: 'Scavenge for equipment',
        descriptionTemplate: 'Look for anything usable among the debris.',
        skillCheck: { skill: 'Investigation', difficultyRange: [12, 16] },
        successRewards: [
          {
            type: 'item',
            resourceId: 'dagger',
            amountRange: [1, 1],
            chance: 0.5,
            descriptionTemplate: 'You salvage a rusted but usable dagger.',
          },
          {
            type: 'gold',
            amountRange: [5, 20],
            chance: 0.6,
            descriptionTemplate: 'You scavenge {amount} gold pieces.',
          }
        ],
        failureConsequences: [
           {
             type: 'buff', // Tetanus?
             targetId: 'disease',
             duration: 24,
             value: 0,
             chance: 0.5,
             descriptionTemplate: 'You cut yourself on rusty metal. (Diseased)'
           }
        ]
      },
      {
        id: 'bury',
        labelTemplate: 'Bury the dead',
        descriptionTemplate: 'Put the restless spirits to rest.',
        skillCheck: { skill: 'Religion', difficultyRange: [10, 14] },
        successConsequences: [
           {
             type: 'reputation',
             targetId: 'fighters_guild',
             value: 5,
             chance: 1.0,
             descriptionTemplate: 'You honor the fallen. (+5 Fighters Guild Reputation)'
           }
        ],
        failureConsequences: []
      }
    ]
  },
  {
    id: 'mystical_site',
    nameTemplate: ['Fairy Ring', 'Ley Line Nexus', 'Singing Stones', 'Arcane Focus'],
    descriptionTemplate: [
      'A perfect circle of mushrooms. The air hums with faint energy.',
      'Stones vibrate with a low hum, causing the air to shimmer.',
      'Lines of blue light crisscross the ground here, converging at a central point.',
    ],
    biomes: ['forest', 'swamp'],
    weight: 1,
    possibleRewards: [],
    possibleInteractions: [
       {
         id: 'channel',
         labelTemplate: 'Channel the energy',
         descriptionTemplate: 'Attempt to tap into the ley line.',
         skillCheck: { skill: 'Arcana', difficultyRange: [14, 18] },
         successRewards: [
           {
             type: 'health',
             amountRange: [10, 20],
             chance: 1.0,
             descriptionTemplate: 'The magical energy restores you. (+{amount} HP)'
           }
         ],
         successConsequences: [
           {
             type: 'map_reveal',
             value: 3,
             chance: 1.0,
             descriptionTemplate: 'Your mind expands across the land. (Large Map Reveal)'
           }
         ],
         failureConsequences: [
            {
              type: 'buff', // Arcane Burn
              targetId: 'stunned',
              duration: 1,
              value: 0,
              chance: 1.0,
              descriptionTemplate: 'The energy overwhelms you. (Stunned for 1 hour)'
            }
         ]
       }
    ]
  },
  {
    id: 'cursed_ruin',
    nameTemplate: ['Blighted Tower', 'Shadowed Altar', 'Withered Grove'],
    descriptionTemplate: [
      'The stones here are cold to the touch, and shadows seem to cling to them.',
      'Vegetation withers in a perfect circle around a cracked obsidian altar.',
    ],
    biomes: ['swamp', 'underdark', 'forest'],
    weight: 1,
    possibleRewards: [],
    possibleInteractions: [
      {
        id: 'loot',
        labelTemplate: 'Loot the altar',
        descriptionTemplate: 'Take the gold, ignoring the warnings.',
        skillCheck: { skill: 'Sleight of Hand', difficultyRange: [14, 18] }, // Dexterity check to grab and run? Or Wisdom save?
        // Using Sleight of Hand as "Disarm Trap" equivalent for now.
        successRewards: [
           {
             type: 'gold',
             amountRange: [30, 80],
             chance: 1.0,
             descriptionTemplate: 'You snatch {amount} gold from the altar.'
           }
        ],
        failureConsequences: [
           {
             type: 'buff',
             targetId: 'curse_of_greed',
             duration: 24,
             value: 0,
             chance: 1.0,
             descriptionTemplate: 'A shadow latches onto your soul. (Cursed)'
           }
        ]
      },
      {
        id: 'cleanse',
        labelTemplate: 'Cleanse the shrine',
        descriptionTemplate: 'Use holy water or prayer to purify the site.',
        skillCheck: { skill: 'Religion', difficultyRange: [14, 18] },
        successRewards: [
           {
             type: 'xp',
             amountRange: [100, 200],
             chance: 1.0,
             descriptionTemplate: 'The darkness lifts. (+{amount} XP)'
           }
        ],
        failureConsequences: [
           {
             type: 'buff',
             targetId: 'weakness',
             duration: 4,
             value: 0,
             chance: 1.0,
             descriptionTemplate: 'The darkness fights back. (Weakened)'
           }
        ]
      }
    ]
  }
];
