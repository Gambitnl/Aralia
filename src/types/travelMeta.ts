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

import type { Entry3DAnchor } from './state';

/** Per-trip metadata for a world-map move. */
export interface TravelMeta {
  /** Real trip duration in seconds (advances the game clock). */
  seconds: number;
  /** Pre-rolled "danger on the road" message, if an encounter was rolled. */
  encounterMessage?: string | null;
  /**
   * The foes for a rolled road ambush. When present, arrival starts a real fight
   * (via handleStartBattleMapEncounter) instead of only printing the message.
   * Lightweight monster stubs; the bestiary resolves them at battle start.
   */
  encounter?: { monsters: Array<{ name: string; quantity: number; cr: string; description: string }> };
  /** Provisioning effects to apply after the move (omitted when ungated). */
  provision?: TravelProvisionEffect;
  /**
   * Cell-native destination of the trip (Stage 4, cell-native world). When present,
   * arrival sets the canonical `playerCell` to this EXACT cell (resetting Locale
   * feet, which are meaningless in the new cell) and stamps the 3D-entry anchor so a
   * later Enter-3D frames the destination town. Absent for legacy compass/static
   * moves — those keep the Stage-2 tile-derived cell. Carries only an atlas cell id +
   * graph-space anchor; no Locale feet cross this boundary (feet stay Locale-local).
   */
  destinationCell?: { cellId: number; anchor: Entry3DAnchor; name?: string };
}
