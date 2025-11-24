/**
 * @file src/data/world/pois.ts
 * Defines static Points of Interest (POIs) that show up as map markers on
 * both the minimap and full world map. Coordinates here are tile-based and
 * align with the world map grid used in map generation.
 */
import { PointOfInterest } from '../../types';

/**
 * Points of Interest are intentionally light-weight: they provide a label,
 * icon, and description that can be surfaced once the player uncovers the
 * corresponding tile (or visits the area). Icons should be small enough to
 * render inside tight grid cells.
 */
export const POIS: PointOfInterest[] = [
  {
    id: 'aralia_town_square',
    name: 'Aralia Town Center',
    description: 'Bustling square with markets and the central fountain.',
    coordinates: { x: 14, y: 10 },
    icon: '🏰',
    category: 'settlement',
    locationId: 'aralia_town_center',
  },
  {
    id: 'forest_watch',
    name: 'Forest Watch Path',
    description: 'A guarded trail where scouts often keep watch.',
    coordinates: { x: 15, y: 9 },
    icon: '🌲',
    category: 'wilderness',
    locationId: 'forest_path',
  },
  {
    id: 'hidden_spring',
    name: 'Hidden Grove Spring',
    description: 'A calm, secluded grove dotted with fireflies.',
    coordinates: { x: 15, y: 11 },
    icon: '🌿',
    category: 'landmark',
    locationId: 'hidden_grove',
  },
  {
    id: 'old_ruins_gate',
    name: 'Ancient Ruin Gate',
    description: 'Crumbling archways that mark the ruined complex.',
    coordinates: { x: 16, y: 10 },
    icon: '🏛️',
    category: 'ruin',
    locationId: 'ancient_ruins_entrance',
  },
  {
    id: 'echo_cavern',
    name: 'Echoing Cave Mouth',
    description: 'Cold air spills out of a jagged cave entrance.',
    coordinates: { x: 15, y: 7 },
    icon: '🕳️',
    category: 'cave',
    locationId: 'cave_entrance',
  },
];
