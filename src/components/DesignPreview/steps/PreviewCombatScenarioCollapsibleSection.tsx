// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/08/2026, 02:08:51
 * Dependents: components/DesignPreview/steps/scenarioControls/PreviewCombatScenarioControlPanel.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file renders one independently collapsible Tactical Sandbox detail box.
 *
 * Rules and scenario controls share this shell so both boxes have the same
 * bordered shape, keyboard-accessible toggle, visible state cue, and spacing.
 * Each mounted box owns only its own open state, so collapsing one never hides
 * or changes the other box or any combat mechanic inside it.
 *
 * Called by: PreviewCombatScenarios and PreviewCombatScenarioControlPanel.
 * Depends on: the shared Button primitive for consistent interaction styling.
 */

import React, { useId, useState } from 'react';
import { Button } from '../../ui/Button';

// ============================================================================
// Public Presentation Contract
// ============================================================================
// Callers choose only the label, accent, and content. The shared shell keeps
// collapse behavior and accessible relationships identical across scenarios.
// ============================================================================

export interface PreviewCombatScenarioCollapsibleSectionProps {
  title: string;
  tone: 'amber' | 'cyan';
  description?: string;
  initiallyExpanded?: boolean;
  className?: string;
  children: React.ReactNode;
}

const TONE_STYLES = {
  amber: {
    border: 'border-amber-900/70',
    heading: 'text-amber-400',
    icon: 'text-amber-300',
  },
  cyan: {
    border: 'border-cyan-900/70',
    heading: 'text-cyan-300',
    icon: 'text-cyan-200',
  },
} as const;

// ============================================================================
// Independent Collapsible Box
// ============================================================================
// The body is removed while collapsed so the sidebar becomes genuinely shorter
// and its hidden controls cannot receive keyboard focus. aria-expanded and
// aria-controls keep the current state understandable without relying on color.
// ============================================================================

export function PreviewCombatScenarioCollapsibleSection({
  title,
  tone,
  description,
  initiallyExpanded = true,
  className = '',
  children,
}: PreviewCombatScenarioCollapsibleSectionProps): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);
  const contentId = useId();
  const toneStyles = TONE_STYLES[tone];

  return (
    <section
      aria-label={title}
      className={`overflow-hidden rounded-xl border bg-gray-950/75 ${toneStyles.border} ${className}`}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-expanded={isExpanded}
        aria-controls={contentId}
        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${title}`}
        onClick={() => setIsExpanded(current => !current)}
        className="w-full rounded-none px-3 py-2.5 text-left hover:bg-gray-900/80 focus:ring-inset focus:ring-sky-500/70"
      >
        {/* Button wraps its children for loading-state support, so this inner
            row owns the full-width label/chevron alignment explicitly. */}
        <span className="flex w-full items-center justify-between gap-3">
          <span className="min-w-0">
            <span className={`block text-[10px] font-black uppercase tracking-[0.18em] ${toneStyles.heading}`}>
              {title}
            </span>
            {description && (
              <span className="mt-0.5 block text-[10px] font-normal leading-relaxed text-slate-500">
                {description}
              </span>
            )}
          </span>
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`h-4 w-4 shrink-0 transition-transform ${toneStyles.icon} ${isExpanded ? 'rotate-180' : ''}`}
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 0 1 1.414 0L10 10.586l3.293-3.293a1 1 0 1 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 0-1.414Z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </Button>

      {isExpanded && (
        <div id={contentId} className="border-t border-gray-800/80 p-3">
          {children}
        </div>
      )}
    </section>
  );
}

export default PreviewCombatScenarioCollapsibleSection;
