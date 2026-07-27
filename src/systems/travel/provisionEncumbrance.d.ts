/**
 * @file provisionEncumbrance.ts — E3: provision weight → encumbrance → speed.
 *
 * Carried food and water have real weight; the more days of supply you pack for
 * a long trip, the heavier the load, the slower the march — which lengthens the
 * trip and demands yet more supply. This module exposes the pure weight + speed
 * math so the travel field (and thus the reach ring) can reflect that tension.
 *
 * Kept separate from provisioning.ts so it can be built without editing files
 * other live sessions are concurrently touching on the shared working tree.
 * Pure: no React/DOM/state.
 */
import type { Item } from '@/types/items';
/** Total weight (lbs) of carried provisions (rations + water). */
export declare function provisionWeight(inventory: readonly Item[]): number;
/** Total weight (lbs) of the entire inventory — the basis for encumbrance. */
export declare function inventoryWeight(inventory: readonly Item[]): number;
/**
 * Travel-speed multiplier from carried weight, mirroring 5e variant encumbrance
 * as a fraction of the 30ft base: over the light threshold costs −10ft (×2/3),
 * over the heavy threshold −20ft (×1/3). Zero thresholds (party carry capacity
 * unknown) disable the gate (×1) so the ring never wrongly collapses.
 */
export declare function encumbranceSpeedFactor(weightLbs: number, encumberedAt: number, heavilyAt: number): number;
