// @dependencies-start
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
// @dependencies-end

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
export const SplitPaneLayout: React.FC<SplitPaneLayoutProps> = ({
  controls,
  preview,
  className = ''
}) => {
  return (
    <div
      className={`flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-1 sm:gap-6 sm:p-4 md:flex-row md:overflow-hidden ${className}`}
      data-testid="split-pane-layout"
    >
      {/* Left Pane: Controls/List */}
      <div
        className="flex max-h-72 w-full flex-shrink-0 flex-col overflow-y-auto rounded-xl border border-gray-700 bg-gray-900/50 p-4 shadow-inner md:h-full md:max-h-full md:min-h-0 md:w-1/3 lg:w-1/4"
        data-testid="split-pane-controls"
      >
        {controls}
      </div>

      {/* Right Pane: Preview/Details */}
      <div
        className="relative flex min-h-[24rem] w-full flex-col overflow-y-auto rounded-xl border border-gray-700 bg-gray-800 p-4 shadow-xl sm:p-6 md:h-full md:min-h-0 md:w-2/3 lg:w-3/4"
        data-testid="split-pane-preview"
      >
        {preview}
      </div>
    </div>
  );
};
