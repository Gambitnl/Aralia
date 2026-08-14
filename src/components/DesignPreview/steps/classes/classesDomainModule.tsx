import { definePreviewCombatDomainTab } from '../PreviewCombatDomainTabs';
import type { PreviewCombatDomainTabModule } from '../PreviewCombatDomainTabs';
import { ClassesDomainShell } from './ClassesShell';

/**
 * This file defines the Rules tab module for the Tactical Sandbox Classes domain.
 * It exists so Rules can mount the existing Classes shell through the shared tab
 * contract without importing or editing the shared host from this domain.
 * Called by: the Rules host's domain-module composition.
 * Depends on: PreviewCombatDomainTabModule, definePreviewCombatDomainTab, and the
 * local ClassesDomainShell.
 */

// ============================================================================
// Classes Domain Registration
// ============================================================================
// The renderer is intentionally self-contained. Rules owns tab selection, while this
// module owns only the local Classes surface and its canonical subclass demonstrations.
export const classesDomainModule: PreviewCombatDomainTabModule = definePreviewCombatDomainTab({
  id: 'classes',
  label: 'Classes',
  description: 'Class and subclass mechanics',
  render: () => <ClassesDomainShell />,
});

export default classesDomainModule;

