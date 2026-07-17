// @dependencies-start
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
// @dependencies-end

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
export const SEA_ENCOUNTER_SOURCE_GAP =
  'sea-encounter-no-worldforge-battlefield';
export const LOCATION_FREE_SIMULATION_SOURCE_GAP =
  'location-free-simulation-no-worldforge-location';

/** EncounterModal modes that can author a roster without selecting a place. */
export type LocationFreeSimulationMode = 'ai' | 'custom' | 'bestiary';

const SIMULATION_MODE_LABELS: Record<LocationFreeSimulationMode, string> = {
  ai: 'AI-generated',
  custom: 'Custom bestiary',
  bestiary: 'Bestiary roll',
};

/**
 * Describe why a hostile voyage event cannot become tactical combat yet.
 * The source event remains consumed once, but its suggested foes are never
 * converted into combatants without sea and vessel geometry.
 */
export function createSeaEncounterSourceGap(
  encounter: Pick<PendingSeaEncounter, 'id' | 'summary' | 'monsters'>,
): BattlefieldSourceGapReason {
  const proposedFoeCount = encounter.monsters.reduce(
    (total, monster) => total + Math.max(0, monster.quantity),
    0,
  );

  return {
    code: SEA_ENCOUNTER_SOURCE_GAP,
    encounterLabel: `Daily sea encounter: ${encounter.id}`,
    locationLabel: 'Open-sea voyage without a tactical location artifact',
    missingSourceFacts: [
      'WorldForge sea surface',
      'vessel deck geometry',
      'relative vessel headings',
      'weather and boarding context',
    ],
    detail: `${encounter.summary} The voyage event does not publish a canonical sea or vessel battlefield. ${proposedFoeCount} proposed foes were not converted into combatants.`,
  };
}

/**
 * Describe why an independently authored roster cannot enter production play.
 * The current world position is intentionally not assumed: the user or caller
 * must select a canonical WorldForge location and encounter anchor explicitly.
 */
export function createLocationFreeSimulationSourceGap(
  mode: LocationFreeSimulationMode,
  proposedCombatantCount: number,
): BattlefieldSourceGapReason {
  const modeLabel = SIMULATION_MODE_LABELS[mode];

  return {
    code: LOCATION_FREE_SIMULATION_SOURCE_GAP,
    encounterLabel: `${modeLabel} encounter simulation`,
    locationLabel: 'No WorldForge battlefield selected',
    missingSourceFacts: [
      'selected WorldForge cell',
      'tactical crop anchor',
      'encounter-to-location receipt',
    ],
    detail: `${modeLabel} authored a roster independently of a WorldForge location. ${Math.max(0, proposedCombatantCount)} proposed combatants remain a simulation request; no actors or terrain were created.`,
  };
}
