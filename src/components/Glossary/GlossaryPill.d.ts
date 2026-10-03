/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 15/04/2026, 00:36:12
 * Dependents: components/Glossary/SpellCardTemplate.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file renders the small pill-shaped glossary controls used across spell
 * cards and glossary reviews.
 *
 * Why it exists:
 * the glossary already has a repeated "pill" look for tags, linked rules, and
 * other compact labels. Conditions should use that same default behavior so the
 * UI feels consistent instead of inventing a one-off style for each label.
 *
 * What it preserves:
 * - the existing spell-card chip appearance
 * - optional glossary navigation when a term id is known
 * - a plain, non-linked pill when the spell data does not have a glossary target
 *
 * Called by: SpellCardTemplate.tsx and any future glossary surface that needs a
 * consistent pill.
 * Depends on: GlossaryTooltip for linked pills.
 */
import React from 'react';
export interface GlossaryPillProps {
    label: React.ReactNode;
    glossaryTermId?: string;
    onNavigateToGlossary?: (termId: string) => void;
    className?: string;
    title?: string;
}
export declare const GlossaryPill: React.FC<GlossaryPillProps>;
export default GlossaryPill;
