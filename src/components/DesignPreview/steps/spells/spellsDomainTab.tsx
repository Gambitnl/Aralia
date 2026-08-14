// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 10:59:55
 * Dependents: components/DesignPreview/steps/spells/index.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React from 'react';
import { definePreviewCombatDomainTab } from '../PreviewCombatDomainTabs';
import SpellsDomainShell from './SpellsDomainShell';

/**
 * This file adapts the self-contained Spells shell to the shared Tactical
 * Sandbox domain-tab contract.
 *
 * Rules can import this one module without passing props or knowing how the
 * spell selector works. The renderer creates the shell with its safe default
 * registry, while future spell leaves can add canonical scenarios inside the
 * shell's existing extension seam.
 *
 * Called by: the shared Rules domain-tab host through the Spells index export.
 * Depends on: definePreviewCombatDomainTab and the local SpellsDomainShell.
 */

// ============================================================================
// Shared Domain Registration
// ============================================================================
// Keeping the registration record beside the shell makes the peer contract
// explicit and prevents the central host from reaching into spell internals.
// ============================================================================

export const SPELLS_DOMAIN_TAB = definePreviewCombatDomainTab({
  id: 'spells',
  label: 'Spells',
  description: 'Canonical spell mechanics and deterministic scenario coverage.',
  render: () => <SpellsDomainShell />,
});

// The default export is a convenience for hosts that import one peer module
// directly; the named export remains the stable Rules integration symbol.
export default SPELLS_DOMAIN_TAB;
