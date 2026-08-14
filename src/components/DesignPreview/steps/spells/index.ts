// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * RE-EXPORT BRIDGE / MIDDLEMAN: Forwards exports to another file.
 *
 * Last Sync: 13/08/2026, 10:59:54
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
 * This file is the narrow import boundary for the Tactical Sandbox Spells
 * domain shell.
 *
 * Rules can import the component, registry contract, and shared domain-tab
 * registration from one stable local path while scenario leaves continue to
 * live inside this disjoint domain.
 * No shared tab host or combat catalog is changed here.
 *
 * Called by: the future Rules domain-tab integration.
 * Depends on: the local SpellsDomainShell, spellRegistry, and types modules.
 */

// ============================================================================
// Integration Exports
// ============================================================================
// Keep the public surface intentionally small: one component, one starter
// registry, one lookup helper, the peer tab module, and the types needed to add
// a real scenario.
// ============================================================================

export { default as SpellsDomainShell } from './SpellsDomainShell';
export { SPELL_SCENARIO_REGISTRY, getSpellScenario } from './spellRegistry';
export { SPELLS_DOMAIN_TAB } from './spellsDomainTab';
export type {
  CanonicalSpellEvidence,
  SpellScenarioAvailability,
  SpellScenarioComponent,
  SpellScenarioComponentProps,
  SpellScenarioDefinition,
  SpellScenarioKind,
  SpellScenarioRegistry,
} from './types';
