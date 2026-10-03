/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 05/07/2026, 08:10:30
 * Dependents: components/CharacterCreator/AbilityScoreAllocation.tsx, components/CharacterCreator/BackgroundSelection.tsx, components/CharacterCreator/Class/ClassSelection.tsx, components/CharacterCreator/FeatSelection.tsx, components/CharacterCreator/NameAndReview.tsx, components/CharacterCreator/Race/RaceSelection.tsx, components/CharacterCreator/SkillSelection.tsx, components/DesignPreview/steps/PreviewComponents.tsx
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file SplitPaneLayout.tsx
 *
 * @component-owner UI Team / Core UI
 */
import React from 'react';
interface SplitPaneLayoutProps {
    controls: React.ReactNode;
    preview: React.ReactNode;
    className?: string;
}
/**
 * Split layout for selection steps.
 * - Desktop: Controls (List) on Left (1/3), Preview (Details) on Right (2/3).
 * - Mobile: Stacked vertically with a single reachable scroll path.
 */
export declare const SplitPaneLayout: React.FC<SplitPaneLayoutProps>;
export {};
