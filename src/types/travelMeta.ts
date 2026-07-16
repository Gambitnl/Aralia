// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 15/07/2026, 23:40:35
 * Dependents: App.tsx, components/MapPane.tsx, systems/travel/applyProvision.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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

/**
 * Deterministic world-travel event asking the tactical layer to start combat.
 * The route cells are source lineage, not merely flavor: land and sea encounters
 * require different battlefield artifacts and must never substitute for one
 * another when their bridge is incomplete.
 */
export interface TravelCombatEncounter {
  kind: 'land-route-ambush' | 'sea-hostile';
  monsters: Array<{ name: string; quantity: number; cr: string; description: string }>;
  routeCells: number[];
}

/** Per-trip metadata for a world-map move. */
export interface TravelMeta {
  /** Real trip duration in seconds (advances the game clock). */
  seconds: number;
  /** Pre-rolled "danger on the road" message, if an encounter was rolled. */
  encounterMessage?: string | null;
  /**
   * The foes for a rolled road ambush. When present, arrival requests tactical
   * combat through handleStartBattleMapEncounter instead of only printing the
   * message. App must still prove the destination's matching WorldForge
   * battlefield artifact; an incomplete or non-road source reaches the visible
   * source gap rather than borrowing an arena.
   * Lightweight monster stubs; the bestiary resolves them at battle start.
   */
  encounter?: TravelCombatEncounter;
  /** Provisioning effects to apply after the move (omitted when ungated). */
  provision?: TravelProvisionEffect;
  /**
   * Fare (whole gp) charged for a hired-ferry trip, deducted from party gold on
   * departure (travel G15). Present only when the committed trip crossed a sea
   * leg on a hired ferry; absent for all-land trips and owned-ship voyages (which
   * pay no fare). App's executor deducts this after the move so cost stays atomic.
   */
  ferryFareGp?: number;
  /**
   * Forced-march exhaustion risk for a committed trip that pushes past the safe
   * 8-hour travel day (travel G1). MapPane derives this from the trip's duration
   * via `calculateForcedMarchStatus`: `saveDC` is 11 at the 9th hour and rises by
   * 1 for each further full hour. App's executor rolls each party member's
   * Constitution save vs `saveDC` after the move and applies the party
   * 'exhaustion' condition when the march bites. Present ONLY when the trip is
   * long enough to trigger a save (a normal ≤8-hour day omits it, so short trips
   * are unaffected). `hours` is the trip's total travel time, for the log line.
   */
  forcedMarch?: { hours: number; saveDC: number };
  /**
   * Navigation drift (travel G2). MapPane rolls the DMG "get lost" check (a
   * Survival check vs the trip's governing graded DC — the worst cell crossed)
   * for a committed land trip. Present ONLY when the party gets LOST — a trip
   * that stays on maintained routes (highways/roads, and trails outside deep
   * forest, all DC 0) or navigates successfully omits the field entirely, so a
   * clean trip is unaffected. `driftDirection` is the wrong compass heading the
   * party wanders ('N'..'NW'); `extraSeconds` is the lost time (DMG 1d6 hours)
   * that App's executor adds to the trip's ADVANCE_TIME and announces to the
   * adventure log. `cause` words the announcement: a faint forest path that
   * faded reads differently from trackless wilds. The party still ARRIVES at
   * the intended cell (time-only penalty) — getting lost never teleports the
   * player to a wrong cell (keeps the cell-native arrival invariant intact).
   */
  navDrift?: { lost: boolean; driftDirection: string; extraSeconds: number; cause: 'wilds' | 'faint-path' };
  /**
   * Trip event (mountains spec §3). MapPane rolls ONE seeded travel event per
   * committed LAND trip — the biome-pool revival that finally fires the
   * mountain, haunted/fey forest, and every other travel-event table in real
   * play. The governing pool follows the route's drama priority (a crag cell
   * outranks a haunted wood outranks the most-crossed ordinary biome); skill
   * check events already resolved against the party's best member inside the
   * roll. Present ONLY when an event fired (the chance gate keeps ~75% of
   * trips silent), so a quiet trip is unaffected. `message` is the resolved
   * player-facing line (event description + check branch) App announces to the
   * adventure log; `extraSeconds` is the event's delay cost, joining the
   * trip's ADVANCE_TIME exactly like navDrift's (0 for delay-free events).
   * Sea trips never carry one — you don't meet a rockslide on a ferry.
   */
  tripEvent?: { message: string; extraSeconds: number };
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
