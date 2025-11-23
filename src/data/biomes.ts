
/**
 * @file src/data/biomes.ts
 * Defines biome data for the Aralia RPG map system.
 */
import { Biome } from '../types';

export const BIOMES: Record<string, Biome> = {
  'plains': { 
    id: 'plains', 
    name: 'Plains', 
    color: 'bg-yellow-500', // Tailwind class
    rgbaColor: 'rgba(234, 179, 8, 0.7)',
    icon: '🌾', 
    description: 'Open grasslands with scattered trees, easy to traverse.', 
    passable: true 
  },
  'forest': { 
    id: 'forest', 
    name: 'Forest', 
    color: 'bg-green-700', 
    rgbaColor: 'rgba(4, 120, 87, 0.7)',
    icon: '🌲', 
    description: 'Dense woodlands teeming with life and hidden paths.', 
    passable: true 
  },
  'mountain': { 
    id: 'mountain', 
    name: 'Mountains', 
    color: 'bg-gray-600', 
    rgbaColor: 'rgba(75, 85, 99, 0.7)',
    icon: '⛰️', 
    description: 'Towering peaks, difficult to traverse without a pass.', 
    passable: true // Could be false for some mountain tiles, true for passes
  },
  'hills': {
    id: 'hills',
    name: 'Hills',
    color: 'bg-lime-600', // A lighter green than forest
    rgbaColor: 'rgba(101, 163, 13, 0.7)',
    icon: '🌄',
    description: 'Rolling hills and meadows, offering good views.',
    passable: true,
  },
  'desert': { 
    id: 'desert', 
    name: 'Desert', 
    color: 'bg-yellow-300', 
    rgbaColor: 'rgba(253, 224, 71, 0.7)',
    icon: '🏜️', 
    description: 'Arid wasteland, scarce in resources and water.', 
    passable: true 
  },
  'swamp': {
    id: 'swamp',
    name: 'Swamp',
    color: 'bg-teal-800', // Dark, murky green/blue
    rgbaColor: 'rgba(19, 78, 74, 0.7)',
    icon: '🌿', // Using a generic plant, could find better
    description: 'Murky marshlands, difficult terrain, and hidden dangers.',
    passable: true,
  },
  'ocean': { 
    id: 'ocean', 
    name: 'Ocean', 
    color: 'bg-blue-700', 
    rgbaColor: 'rgba(29, 78, 216, 0.7)',
    icon: '🌊', 
    description: 'Vast expanse of water, requires a vessel to cross.', 
    passable: false,
    impassableReason: "The vast ocean is too dangerous to cross without a sturdy vessel."
  },
  'cave': {
    id: 'cave',
    name: 'Cave',
    color: 'bg-gray-800',
    rgbaColor: 'rgba(31, 41, 55, 0.7)',
    icon: '🌑',
    description: 'A dark, natural subterranean chamber or series of passages.',
    passable: true,
  },
  'dungeon': {
    id: 'dungeon',
    name: 'Dungeon',
    color: 'bg-stone-900',
    rgbaColor: 'rgba(28, 25, 23, 0.7)',
    icon: '⛓️',
    description: 'An underground labyrinth of constructed corridors and rooms, often ancient and dangerous.',
    passable: true,
  }
};