/**
 * This folder is the dedicated home for the glossary spell gate checker.
 *
 * It exists so the glossary shell can stay focused on navigation and window
 * management while the spell-truth machinery lives behind one explicit module
 * boundary. Glossary.tsx, GlossarySidebar.tsx, and the spell gate tests import
 * from this barrel instead of reaching into scattered helper files.
 *
 * Called by: glossary UI files and spell gate tests
 * Depends on: the hook, the sidebar label helper, and the gate result types
 */

// ============================================================================
// Public spell gate checker API
// ============================================================================
// This section is the stable surface the rest of the glossary uses. Keeping the
// re-exports here means we can continue breaking up the implementation inside
// this folder later without forcing more import churn across the glossary.
// ============================================================================

export { useSpellGateChecks } from './useSpellGateChecks';
export { buildGateLabel } from './buildGateLabel';
export { SpellGateChecksPanel } from './SpellGateChecksPanel';
export type { GateChecklist, GateResult, GateStatus, SpellGateArtifactEntry } from './useSpellGateChecks';
