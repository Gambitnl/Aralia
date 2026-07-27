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
export declare const POIS: PointOfInterest[];
