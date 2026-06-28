/**
 * @file travelMeta.ts — the contract MapPane hands to App on a world-travel pick.
 *
 * MapPane owns the route, the rings, and (now) the provisioning gate, so it
 * computes WHAT a trip costs; App's `handleTileClick` is the executor that moves
 * the player and applies these effects. Keeping the shape here stops the three
 * call sites (App, MapPane, GameModals) from drifting.
 */

/** Provisioning consequences of a committed trip, applied after the move. */
export interface TravelProvisionEffect {
  /** Ration-days (food) to remove from inventory for the trip. */
  rationsToSpend: number;
  /** Water-days to remove from inventory for the trip. */
  waterToSpend: number;
  /** Party-wide conditions to apply on arrival/halt (e.g. 'starving', 'poisoned', 'fatigued'). */
  conditions?: string[];
  /** Companion loyalty delta per companion (negative on a starving march; may trigger desertion). */
  companionLoyaltyDelta?: number;
  /** A system message to surface (e.g. "Your food runs out on the road…"). */
  note?: string | null;
}

/** Per-trip metadata for a world-map move. */
export interface TravelMeta {
  /** Real trip duration in seconds (advances the game clock). */
  seconds: number;
  /** Pre-rolled "danger on the road" message, if an encounter was rolled. */
  encounterMessage?: string | null;
  /** Provisioning effects to apply after the move (omitted when ungated). */
  provision?: TravelProvisionEffect;
}
