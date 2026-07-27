/**
 * @file src/systems/travel/TravelNavigation.ts
 * Logic for "Getting Lost" (Navigation) mechanics.
 *
 * Based on D&D 5e DMG (p. 111) rules for becoming lost.
 */
import { TravelPace, TravelTerrain, NavigationResult, TravelDirection } from '../../types/travel';
import { SeededRandom } from '@/utils/random';
export declare const TERRAIN_NAVIGATION_DCS: Record<TravelTerrain, number>;
/**
 * Checks if the party gets lost during travel.
 *
 * @param survivalCheckResult The d20 + Survival Modifier roll result.
 * @param terrain The terrain type being traversed.
 * @param pace The travel pace (affects DC/Roll).
 * @param hasMapOrCompass Whether the party has navigational aids (Advantage -> +5).
 * @param intendedDirection The direction the party WANTS to go.
 * @param rng Optional SeededRandom instance for deterministic drift.
 * @param dcOverride Explicit DC replacing the terrain-table lookup (0 still auto-succeeds).
 */
export declare function checkNavigation(survivalCheckResult: number, terrain: TravelTerrain, pace: TravelPace, hasMapOrCompass: boolean, intendedDirection: TravelDirection, rng?: SeededRandom, dcOverride?: number): NavigationResult;
