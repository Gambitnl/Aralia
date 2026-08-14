// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 10:50:13
 * Dependents: components/DesignPreview/steps/spells/SpellsDomainShell.tsx, components/DesignPreview/steps/spells/index.ts, components/DesignPreview/steps/spells/spellRegistry.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { ComponentType } from 'react';

/**
 * This file defines the small contract shared by the Tactical Sandbox spell
 * registry and its integration-ready shell.
 *
 * The Rules host can provide the registry now and add real scenario components
 * later without changing the selector or making the shell responsible for
 * game mechanics. Canonical source paths stay visible in the data contract so
 * future scenario work can start from the real spell implementation.
 *
 * Called by: spellRegistry.ts and SpellsDomainShell.tsx.
 * Depends on: React's component type only; it does not import game state.
 */

// ============================================================================
// Spell Scenario Kinds
// ============================================================================
// These labels describe the primary mechanic a scenario is expected to prove.
// They are deliberately small and descriptive rather than a speculative spell
// taxonomy; one spell can still carry several mechanics in its source data.
// ============================================================================

export type SpellScenarioKind =
  | 'attack-roll'
  | 'saving-throw'
  | 'healing'
  | 'reaction-defense';

// ============================================================================
// Canonical Evidence
// ============================================================================
// Every starter entry points future leaves to the data record, the runtime
// resolver path, and focused proof that already exists in this repository.
// These strings are repository paths, not claims that the shell itself runs
// those mechanics.
// ============================================================================

export interface CanonicalSpellEvidence {
  catalogPaths: readonly string[];
  resolverPaths: readonly string[];
  rationale: string;
}

// ============================================================================
// Scenario Extension Seam
// ============================================================================
// A real scenario component receives only its registry entry. This keeps the
// shell independent from combat state and lets a later leaf add deterministic
// controls around the canonical resolver without reshaping this contract.
// ============================================================================

export interface SpellScenarioComponentProps {
  spell: SpellScenarioDefinition;
}

export type SpellScenarioComponent = ComponentType<SpellScenarioComponentProps>;

export type SpellScenarioAvailability = 'pending' | 'available';

// ============================================================================
// Registry Entry
// ============================================================================
// The entry contains enough information for a human or Rules orchestrator to
// understand what is supported and what remains unimplemented. A missing
// component is an honest pending state, never permission to emulate a result.
// ============================================================================

export interface SpellScenarioDefinition {
  id: string;
  name: string;
  level: number;
  kind: SpellScenarioKind;
  summary: string;
  availability: SpellScenarioAvailability;
  canonicalEvidence: CanonicalSpellEvidence;
  scenarioComponent?: SpellScenarioComponent;
}

export type SpellScenarioRegistry = readonly SpellScenarioDefinition[];
