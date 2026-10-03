/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 28/03/2026, 00:15:45
 * Dependents: components/CharacterSheet/Skills/SkillDetailDisplay.tsx, components/CharacterSheet/Skills/SkillsTab.tsx, components/Glossary/SpellCardTemplate.tsx, components/Glossary/index.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file GlossaryTooltip.tsx
 * This component wraps the standard Tooltip to dynamically fetch and display
 * content from the glossary based on a termId.
 * It now uses a global context to get pre-loaded excerpts and lets the trigger
 * element itself own navigation.
 *
 * Why it changed:
 * The previous version rendered a clickable button inside the tooltip that
 * suggested "click for full entry". In practice that was frustrating because
 * moving the mouse from the chip to the tooltip caused the tooltip to disappear.
 * The owner explicitly wants the chip to act as the button instead.
 *
 * What this preserves:
 * - Hover/focus still reveals glossary excerpts.
 * - Clicking the chip still navigates to the full glossary entry when possible.
 * - Missing-term/error states still degrade safely to read-only tooltip text.
 */
import React, { ReactElement, HTMLAttributes } from 'react';
import { GlossaryTooltipProps as LocalGlossaryTooltipProps } from '../../types';
interface CustomGlossaryTooltipProps extends LocalGlossaryTooltipProps {
    children: ReactElement<HTMLAttributes<HTMLElement>>;
}
declare const GlossaryTooltip: React.FC<CustomGlossaryTooltipProps>;
export default GlossaryTooltip;
