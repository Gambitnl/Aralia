/**
 * @file src/data/travelEvents.ts
 *
 * Travel event definitions mapped by biome.
 * Used by src/services/travelEventService.ts to generate random encounters during world travel.
 *
 * Each event can have:
 * - A descriptive string
 * - A 'delay' effect (in hours)
 * - A 'weight' for probability (default 1)
 * - Optional skill checks for interactive resolution
 */
import { BiomeEventMap } from '../types/exploration';
export declare const TRAVEL_EVENTS: BiomeEventMap;
