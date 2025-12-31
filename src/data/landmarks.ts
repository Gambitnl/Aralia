// TODO(lint-intent): 'Biome' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { Biome as _Biome } from '../types';

export interface LandmarkRewardTemplate {
  type: 'item' | 'xp' | 'health' | 'gold';
  resourceId?: string; // itemId for items
  amountRange: [number, number]; // [min, max]
  chance: number; // 0.0 to 1.0
  descriptionTemplate: string; // "You find {amount} gold coins."
}

export interface LandmarkConsequenceTemplate {
  type: 'buff' | 'map_reveal' | 'reputation' | 'damage' | 'debuff';
  targetId?: string;
  duration?: number;
  value?: number;
  chance: number;
  descriptionTemplate: string;
}

export interface LandmarkTemplate {
  id: string;
  nameTemplate: string[]; // e.g., ["Ancient Ruins", "Crumbling Watchtower"]
  descriptionTemplate: string[];
  biomes: string[]; // e.g., ['forest', 'plains']
  weight: number;
  possibleRewards?: LandmarkRewardTemplate[];
  possibleConsequences?: LandmarkConsequenceTemplate[];
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
    ],
    possibleConsequences: [
      {
        type: 'reputation',
        targetId: 'scholars_guild',
        value: 5,
        chance: 0.3,
        descriptionTemplate: 'Recording the inscriptions will surely impress the Scholars Guild (+5 Reputation).',
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
      },
      {
        type: 'xp',
        amountRange: [50, 100],
        chance: 0.5,
        descriptionTemplate: 'The beauty of the scene inspires you. Gained {amount} XP.',
      }
    ],
    possibleConsequences: [
      {
        type: 'map_reveal',
        value: 2,
        chance: 0.5,
        descriptionTemplate: 'From this vantage point, you can map the surrounding area (Map Reveal Radius: 2).',
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
    ],
    possibleConsequences: [
      {
         type: 'reputation',
         targetId: 'fighters_guild',
         value: 3,
         chance: 0.4,
         descriptionTemplate: 'Recovering the fallen banner honors the Fighter\'s Guild (+3 Reputation).',
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
    ],
    possibleConsequences: [
      {
        type: 'map_reveal',
        value: 3,
        chance: 0.4,
        descriptionTemplate: 'The ley lines pulsate, briefly connecting your mind to the land itself (Large Map Reveal).',
      },
      {
         type: 'reputation',
         targetId: 'mages_guild',
         value: 5,
         chance: 0.3,
         descriptionTemplate: 'Charting this nexus is valuable data for the Mage\'s Guild (+5 Reputation).',
      }
    ]
  },
  {
    id: 'cursed_ruin',
    nameTemplate: ['Blighted Tower', 'Shadowed Altar', 'Withered Grove', 'Haunted Cairn'],
    descriptionTemplate: [
      'The stones here are cold to the touch, and shadows seem to cling to them.',
      'Vegetation withers in a perfect circle around a cracked obsidian altar.',
      'A pervasive chill seeps into your bones as you approach the ruins.',
    ],
    biomes: ['swamp', 'underdark', 'forest'],
    weight: 1,
    possibleRewards: [
      {
        type: 'gold',
        amountRange: [20, 80],
        chance: 0.7,
        descriptionTemplate: 'You risk the curse to loot {amount} gold from the altar.',
      }
    ],
    possibleConsequences: [
      {
        type: 'damage',
        value: 5,
        chance: 0.6,
        descriptionTemplate: 'As you touch the treasure, necrotic energy lashes out! Took 5 damage.',
      },
      {
        type: 'debuff',
        targetId: 'cursed_presence',
        duration: 4,
        chance: 0.3,
        descriptionTemplate: 'A dark presence latches onto you. You feel watched (Debuff: Cursed Presence for 4 hours).',
      }
    ]
  },
  {
    id: 'bandit_stash',
    nameTemplate: ['Hidden Cache', 'Smuggler\'s Den', 'Hollowed Tree Trunk'],
    descriptionTemplate: [
      'You spot a disturbed patch of earth that looks recently dug.',
      'A hollow tree trunk has been stuffed with oilcloth-wrapped bundles.',
    ],
    biomes: ['forest', 'hills', 'plains'],
    weight: 1,
    possibleRewards: [
      {
        type: 'gold',
        amountRange: [10, 40],
        chance: 1.0,
        descriptionTemplate: 'You find a stash of {amount} stolen gold.',
      },
      {
        type: 'item',
        resourceId: 'dagger',
        amountRange: [1, 1],
        chance: 0.3,
        descriptionTemplate: 'A balanced throwing dagger was hidden with the gold.',
      }
    ],
    possibleConsequences: [
      {
        type: 'damage',
        value: 3,
        chance: 0.4,
        descriptionTemplate: 'It was trapped! A needle springs out. Took 3 damage.',
      }
    ]
  }
];
