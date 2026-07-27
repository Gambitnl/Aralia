/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 23/06/2026, 12:36:14
 * Dependents: components/DesignPreview/steps/PreviewCombatScenarios.tsx, components/DesignPreview/steps/PreviewSpellGlossary.tsx, components/Glossary/index.ts
 * Imports: 16 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file Glossary.tsx
 * Main Glossary modal component - now modularized into smaller sub-components.
 *
 * Sub-components:
 * - GlossaryHeader: Title bar, action buttons, search input
 * - GlossarySidebar: Category navigation and entry tree
 * - GlossaryEntryPanel: Entry content display with breadcrumbs
 * - GlossaryFooter: Timestamp and keyboard hints
 * - GlossaryResizeHandles: Modal resize controls
 *
 * Hooks:
 * - useGlossaryModal: Modal position, size, drag, and resize state
 * - useGlossarySearch: Search filtering and expansion state
 * - useGlossaryKeyboardNav: Keyboard navigation
 */
import React from 'react';
interface GlossaryProps {
    isOpen: boolean;
    onClose: () => void;
    initialTermId?: string;
    /** Whether developer-only glossary diagnostics should be visible. */
    isDevModeEnabled: boolean;
    /** Optional preview/testing override for the initial spell gate toggle state. */
    defaultShowSpellGateChecks?: boolean;
}
declare const Glossary: React.FC<GlossaryProps>;
export default Glossary;
