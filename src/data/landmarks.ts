
import { Biome } from '../types';

export interface LandmarkRewardTemplate {
  type: 'item' | 'xp' | 'health' | 'gold';
  resourceId?: string; // itemId for items
  amountRange: [number, number]; // [min, max]
  chance: number; // 0.0 to 1.0
  descriptionTemplate: string; // "You find {amount} gold coins."
}

export interface LandmarkTemplate {
  id: string;
  nameTemplate: string[]; // e.g., ["Ancient Ruins", "Crumbling Watchtower"]
  descriptionTemplate: string[];
  biomes: string[]; // e.g., ['forest', 'plains']
  weight: number;
  possibleRewards?: LandmarkRewardTemplate[];
}

export const LANDMARK_TEMPLATES: LandmarkTemplate[] = [
  {
    id: 'ancient_monument',
    nameTemplate: ['Ancient Obelisk', 'Forgotten Statue', 'Mossy Monolith'],
    descriptionTemplate: [
      'A tall stone structure rises from the ground, covered in undecipherable runes.',
      'A statue of a forgotten king stands vigil, eroded by centuries of wind and rain.',
    ],
    biomes: ['forest', 'plains', 'hills'],
    weight: 2,
    possibleRewards: [
      {
        type: 'gold',
        amountRange: [10, 50],
        chance: 0.8,
        descriptionTemplate: 'You find an offering bowl containing {amount} gold coins.',
      },
      {
        type: 'health',
        amountRange: [5, 10],
        chance: 0.5,
        descriptionTemplate: 'The lingering aura of the monument invigorates you. Healed {amount} HP.',
      }
    ]
  },
  {
    id: 'natural_wonder',
    nameTemplate: ['Crystal Cave', 'Whispering Falls', 'Giant\'s Footprint'],
    descriptionTemplate: [
      'Water cascades down into a pool that glows with an inner light.',
      'A massive depression in the earth looks remarkably like a footprint of a titan.',
    ],
    biomes: ['mountain', 'forest', 'hills'],
    weight: 2,
    possibleRewards: [
      {
        type: 'item',
        resourceId: 'healing_potion',
        amountRange: [1, 2],
        chance: 0.8,
        descriptionTemplate: 'You find {amount} healing potion(s) left by a previous traveler.',
      },
      {
        type: 'xp',
        amountRange: [50, 100],
        chance: 0.5,
        descriptionTemplate: 'The beauty of the scene inspires you. Gained {amount} XP.',
      }
    ]
  },
  {
    id: 'battlefield_remnant',
    nameTemplate: ['Sword Graveyard', 'Cratered Field', 'Bone Hill'],
    descriptionTemplate: [
      'Rusted weapons protrude from the earth like strange metallic grass.',
      'The land here is scarred, with old craters filled with murky water.',
    ],
    biomes: ['plains', 'desert'],
    weight: 1,
    possibleRewards: [
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
        descriptionTemplate: 'You scavenge {amount} gold pieces from the debris.',
      }
    ]
  },
  {
    id: 'mystical_site',
    nameTemplate: ['Fairy Ring', 'Ley Line Nexus', 'Singing Stones'],
    descriptionTemplate: [
      'A perfect circle of mushrooms. The air hums with faint energy.',
      'Stones vibrate with a low hum, causing the air to shimmer.',
    ],
    biomes: ['forest', 'swamp'],
    weight: 1,
    possibleRewards: [
      {
        type: 'health',
        amountRange: [10, 20],
        chance: 0.9,
        descriptionTemplate: 'The magical energy knit your wounds properly. Healed {amount} HP.',
      },
      {
        type: 'item',
        resourceId: 'strange_dust',
        amountRange: [1, 3],
        chance: 0.6,
        descriptionTemplate: 'You collect {amount} pinch(es) of glowing dust.',
      }
    ]
  },
];
