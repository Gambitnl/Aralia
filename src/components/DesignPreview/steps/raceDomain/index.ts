// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 13/08/2026, 11:02:24
 * Dependents: None (Orphan)
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file is the import boundary for the Tactical Sandbox Race domain.
 *
 * The Rules orchestrator can import one stable tab module plus the shell,
 * registry factory, and contracts
 * from this one path without touching the shared preview host or central tab
 * registry. It keeps future race leaves disjoint from shared mechanics wiring.
 * Called by: the Rules domain integration.
 * Depends on: the local Race domain modules.
 */

// ============================================================================
// Public Race Domain Exports
// ============================================================================
// Re-exporting the contracts here makes the integration surface explicit and
// avoids forcing the host to know the local file layout of this domain.
// ============================================================================

export { RaceDomainShell, RaceDomainSurface } from './RaceDomainShell';
export {
  createRaceDomainRegistry,
  discoverRaceDomainLeaves,
  extractRaceDomainLeafRegistrations,
  raceDomainRegistry,
} from './raceDomainRegistry';
export { default } from './RaceDomainShell';
export type {
  RaceDomainIntegrationRegistration,
  RaceDomainLeafProps,
  RaceDomainLeafRegistration,
  RaceDomainLeafModule,
  RaceDomainRegistry,
  RaceDomainScenarioState,
  RaceDomainShellProps,
} from './raceDomainTypes';
export { createRaceDomainScenarioState } from './raceDomainTypes';

// This is the stable peer-registration record the Rules orchestrator imports.
import React from 'react';
import { definePreviewCombatDomainTab } from '../PreviewCombatDomainTabs';
import type { PreviewCombatDomainTabModule } from '../PreviewCombatDomainTabs';
import { RaceDomainSurface } from './RaceDomainShell';
import type { RaceDomainIntegrationRegistration } from './raceDomainTypes';

export const RACE_DOMAIN_INTEGRATION: RaceDomainIntegrationRegistration = {
  id: 'race',
  label: 'Races',
  Shell: RaceDomainSurface,
};

// The shared tab host imports this one self-contained module. The file remains
// .ts, so React.createElement expresses the same prop-free render contract as
// <RaceDomainSurface /> without moving the public import path.
export const RACE_DOMAIN_TAB_MODULE: PreviewCombatDomainTabModule = (
  definePreviewCombatDomainTab({
    id: 'races',
    label: 'Races',
    description: 'Canonical Race selection and registered scenarios',
    render: () => React.createElement(RaceDomainSurface),
  })
);
