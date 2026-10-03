// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 11:01:04
 * Dependents: components/DesignPreview/steps/raceDomain/RaceDomainShell.tsx, components/DesignPreview/steps/raceDomain/index.ts, components/DesignPreview/steps/raceDomain/raceDomainRegistry.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { ComponentType } from 'react';
import type { Race } from '../../../../types';

/**
 * This file defines the public contract for the Tactical Sandbox Race domain.
 *
 * The shell owns only selection, reset, and event-reporting state. A later
 * race-specific leaf owns any real mechanic transaction and receives this
 * contract so the preview cannot quietly invent a second rules engine.
 * Called by: raceDomainRegistry.ts, RaceDomainShell.tsx, and future race leaves.
 * Depends on: the canonical Race type used by ACTIVE_RACES.
 */

// ============================================================================
// Resettable Race Scenario State
// ============================================================================
// This state is deliberately small. It gives the host and future leaves a
// deterministic seam for visible selection, reset, and event evidence without
// pretending that a selected race has already applied a combat mechanic.
// ============================================================================

export interface RaceDomainScenarioState {
  selectedRaceId: string | null;
  resetCount: number;
  eventLog: readonly string[];
}

export function createRaceDomainScenarioState(
  selectedRaceId: string | null,
  resetCount = 0,
  eventLog: readonly string[] = [],
): RaceDomainScenarioState {
  // Copy the log so callers cannot mutate state owned by the shell or a leaf.
  return {
    selectedRaceId,
    resetCount,
    eventLog: [...eventLog],
  };
}

// ============================================================================
// Race Leaf Registration Contract
// ============================================================================
// A leaf is an integration point, not a fake mechanic. It must render the
// supplied canonical race and use the event callback to report outcomes from
// real production helpers when a later implementation adds a scenario.
// ============================================================================

export interface RaceDomainLeafProps {
  race: Race;
  state: RaceDomainScenarioState;
  onScenarioEvent: (message: string) => void;
}

export interface RaceDomainLeafRegistration {
  id: string;
  raceId: string;
  label: string;
  description: string;
  Component: ComponentType<RaceDomainLeafProps>;
}

/**
 * Every module under leaves/ must export this exact named value. Keeping the
 * name stable lets future per-Race tasks add one file without editing a shared
 * registration list or risking a merge conflict with another leaf.
 */
export interface RaceDomainLeafModule {
  RACE_DOMAIN_LEAF?: RaceDomainLeafRegistration;
}

// ============================================================================
// Registry And Integration Contracts
// ============================================================================
// The registry exposes canonical races and validated leaf lookups to the Rules
// orchestrator. It is created from ACTIVE_RACES by default, while an injected
// registry remains available for focused tests and future host composition.
// ============================================================================

export interface RaceDomainRegistry {
  races: readonly Race[];
  leaves: readonly RaceDomainLeafRegistration[];
  getRaceById: (raceId: string) => Race | undefined;
  getLeavesForRace: (raceId: string) => readonly RaceDomainLeafRegistration[];
}

export interface RaceDomainShellProps {
  initialSelectedRaceId?: string | null;
  registry?: RaceDomainRegistry;
  races?: readonly Race[];
  registrations?: readonly RaceDomainLeafRegistration[];
  onStateChange?: (state: RaceDomainScenarioState) => void;
}

export interface RaceDomainIntegrationRegistration {
  id: 'race';
  label: 'Races';
  Shell: ComponentType<RaceDomainShellProps>;
}
