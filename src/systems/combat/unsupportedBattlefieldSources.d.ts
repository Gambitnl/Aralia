/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 14:00:50
 * Dependents: App.tsx, components/Combat/EncounterModal.tsx, hooks/useSeaEncounter.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file unsupportedBattlefieldSources.ts
 * Builds the explicit WorldForge source-gap records for production encounter
 * requests that currently know what might fight but cannot prove where.
 *
 * These builders preserve useful encounter context without carrying the
 * proposed roster into combat state. The shared encounter launcher rejects any
 * source-gap payload that also includes actors or terrain, so these records are
 * diagnoses rather than partially initialized battles.
 */
import type { BattlefieldSourceGapReason } from '../../types/actions';
import type { PendingSeaEncounter } from '../../types/naval';
/** Stable diagnostics codes used by tests, Vistest, and the source inventory. */
export declare const SEA_ENCOUNTER_SOURCE_GAP = "sea-encounter-no-worldforge-battlefield";
export declare const LOCATION_FREE_SIMULATION_SOURCE_GAP = "location-free-simulation-no-worldforge-location";
/** EncounterModal modes that can author a roster without selecting a place. */
export type LocationFreeSimulationMode = 'ai' | 'custom' | 'bestiary';
/**
 * Describe why a hostile voyage event cannot become tactical combat yet.
 * The source event remains consumed once, but its suggested foes are never
 * converted into combatants without sea and vessel geometry.
 */
export declare function createSeaEncounterSourceGap(encounter: Pick<PendingSeaEncounter, 'id' | 'summary' | 'monsters'>): BattlefieldSourceGapReason;
/**
 * Describe why an independently authored roster cannot enter production play.
 * The current world position is intentionally not assumed: the user or caller
 * must select a canonical WorldForge location and encounter anchor explicitly.
 */
export declare function createLocationFreeSimulationSourceGap(mode: LocationFreeSimulationMode, proposedCombatantCount: number): BattlefieldSourceGapReason;
