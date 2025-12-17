
import { Biome } from '../types';

export interface LandmarkTemplate {
  id: string;
  nameTemplate: string[]; // e.g., ["Ancient Ruins", "Crumbling Watchtower"]
  descriptionTemplate: string[];
  biomes: string[]; // e.g., ['forest', 'plains']
  weight: number;
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
  },
];
