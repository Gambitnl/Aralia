// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 11:01:30
 * Dependents: components/DesignPreview/steps/raceDomain/RaceDomainShell.tsx, components/DesignPreview/steps/raceDomain/index.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { ACTIVE_RACES } from '../../../../data/races';
import type {
  RaceDomainLeafRegistration,
  RaceDomainLeafModule,
  RaceDomainRegistry,
} from './raceDomainTypes';
import type { Race } from '../../../../types';

/**
 * This file builds the Tactical Sandbox Race registry from the live selectable
 * race data and any future race-specific leaves. Leaf modules are discovered
 * from ./leaves/** so each future Race task can own one component and test
 * without editing this file.
 *
 * It exists so the Rules orchestrator can import one stable factory while the
 * selectable roster continues to follow ACTIVE_RACES automatically. Stale leaf
 * registrations are ignored rather than rendered with invented race data.
 * Called by: RaceDomainShell.tsx and the Rules domain integration.
 * Depends on: src/data/races/index.ts and the Race domain contracts.
 */

// ============================================================================
// Canonical Registry Construction
// ============================================================================
// ACTIVE_RACES is the selectable truth. No roster is copied here, and the
// supplied array is preserved in its canonical order for deterministic tests
// and the same ordering users see in the character creator.
// ============================================================================

// Vite eagerly loads every dedicated leaf module. A missing directory simply
// produces an empty object, which is the honest baseline before leaf work lands.
const raceDomainLeafModules: Record<string, unknown> = import.meta.glob(
  './leaves/*.{ts,tsx}',
  { eager: true },
);

// A candidate must expose the exact named export before the registry considers
// it. This keeps default exports and arbitrary helper values out of the domain.
function getNamedLeafExport(moduleValue: unknown): unknown {
  if (!moduleValue || typeof moduleValue !== 'object') {
    return undefined;
  }

  return (moduleValue as RaceDomainLeafModule).RACE_DOMAIN_LEAF;
}

// Validate the runtime shape because import.meta.glob returns module objects,
// and a malformed future leaf should be ignored rather than crash the shell.
function isRaceDomainLeafRegistration(
  candidate: unknown,
): candidate is RaceDomainLeafRegistration {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }

  const registration = candidate as Partial<RaceDomainLeafRegistration>;
  return (
    typeof registration.id === 'string'
    && typeof registration.raceId === 'string'
    && typeof registration.label === 'string'
    && typeof registration.description === 'string'
    && typeof registration.Component === 'function'
  );
}

// Extract and validate glob modules separately so focused tests can prove the
// future leaf contract without hand-editing this central registry.
export function extractRaceDomainLeafRegistrations(
  modules: Readonly<Record<string, unknown>>,
  races: readonly Race[] = ACTIVE_RACES,
): readonly RaceDomainLeafRegistration[] {
  const canonicalRaceIds = new Set(races.map(race => race.id));
  const seenLeafIds = new Set<string>();
  const registrations: RaceDomainLeafRegistration[] = [];

  // File order is the stable Vite glob order; retaining it makes discovery
  // deterministic while each registration remains independently owned.
  for (const moduleValue of Object.values(modules)) {
    const candidate = getNamedLeafExport(moduleValue);
    if (!isRaceDomainLeafRegistration(candidate)) {
      continue;
    }

    // A stale Race id or duplicate leaf id cannot create a phantom scenario.
    if (!canonicalRaceIds.has(candidate.raceId) || seenLeafIds.has(candidate.id)) {
      continue;
    }

    seenLeafIds.add(candidate.id);
    registrations.push(candidate);
  }

  return registrations;
}

// This named helper lets the host or focused proof inspect the same discovery
// result used by the default shell without taking ownership of the leaf list.
export const discoverRaceDomainLeaves = (): readonly RaceDomainLeafRegistration[] => (
  extractRaceDomainLeafRegistrations(raceDomainLeafModules)
);

export function createRaceDomainRegistry(
  races: readonly Race[] = ACTIVE_RACES,
  registrations?: readonly RaceDomainLeafRegistration[],
): RaceDomainRegistry {
  // Default construction uses automatic discovery; a supplied list remains a
  // deliberate test seam and never forces future leaves into a central array.
  const discoveredOrInjectedRegistrations = registrations
    ?? extractRaceDomainLeafRegistrations(raceDomainLeafModules, races);

  // Keep only leaves whose Race still exists in the current canonical roster.
  // This protects a long-lived integration list from rendering stale data.
  const canonicalRaceIds = new Set(races.map(race => race.id));
  const leaves = discoveredOrInjectedRegistrations.filter(registration => (
    canonicalRaceIds.has(registration.raceId)
  ));

  // Lookups close over the same canonical array rendered by the shell, so a
  // selected item and a registered leaf cannot disagree about its Race object.
  const getRaceById = (raceId: string) => races.find(race => race.id === raceId);
  const getLeavesForRace = (raceId: string) => leaves.filter(
    registration => registration.raceId === raceId,
  );

  return {
    races,
    leaves,
    getRaceById,
    getLeavesForRace,
  };
}

// This named export is the import seam for the Rules orchestrator when it
// needs a canonical registry without composing any race-specific leaves yet.
export const raceDomainRegistry = createRaceDomainRegistry();

export default raceDomainRegistry;
