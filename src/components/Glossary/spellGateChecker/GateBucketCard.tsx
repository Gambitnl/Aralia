// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 22/04/2026, 13:27:15
 * Dependents: components/Glossary/spellGateChecker/SpellGateBucketSections.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file GateBucketCard.tsx
 * Reusable card wrapper for every spell-gate bucket review block.
 *
 * Why this exists: the previous bucket rendering was one undifferentiated
 * wall of `<li>- Classification: foo_bar</li>` rows. Reviewers had to read
 * the raw classification key to know whether a bucket mattered. This card:
 *   - shows a plain-English verdict badge (Aligned / Cosmetic residue / etc.)
 *   - shows a one-sentence explanation of what the bucket is saying
 *   - collapses low-signal cards by default (aligned, boundary, residue)
 *   - keeps the raw classification key visible as a muted technical footer
 *     so trackers and grep-based tooling still resolve exact matches
 *
 * Called by: SpellGateBucketSections.tsx
 * Depends on: gateDisplayLabels.ts
 */
import React from 'react';
import {
    VERDICT_STYLE,
    type ClassificationDisplay,
    type GateVerdict,
} from './gateDisplayLabels';

export interface GateBucketCardProps {
    /** Headline for the card, e.g. "Components (canonical -> structured)". */
    title: string;
    /** Plain-English classification display metadata. */
    display: ClassificationDisplay;
    /** Raw classification key, kept visible for tracker/grep purposes. */
    classificationKey: string;
    /** Short sentence summarizing what is actually wrong for THIS spell. */
    problemStatement?: string | null;
    /** Optional override for default collapse behaviour. */
    defaultOpen?: boolean;
    /** Detail rows — rendered inside the <details> body. */
    children: React.ReactNode;
    /** Optional extra verdict override, e.g. when parent computes a different
     *  verdict than the classification map alone would give. */
    verdictOverride?: GateVerdict;
}

export const GateBucketCard: React.FC<GateBucketCardProps> = ({
    title,
    display,
    classificationKey,
    problemStatement,
    defaultOpen,
    children,
    verdictOverride,
}) => {
    const verdict = verdictOverride ?? display.verdict;
    const style = VERDICT_STYLE[verdict];
    const open = defaultOpen ?? !style.collapseByDefault;

    return (
        <details
            className={`mt-2 rounded bg-gray-900/60 ${style.accentClass}`}
            open={open}
        >
            <summary className="flex cursor-pointer list-none items-start gap-2 px-2 py-1.5 hover:bg-gray-800/40">
                <span
                    className={`mt-0.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-tight ${style.badgeClass}`}
                    title={display.description}
                >
                    <span>{style.icon}</span>
                    <span>{style.label}</span>
                </span>
                <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-gray-200">{title}</div>
                    <div className={`mt-0.5 text-xs ${style.toneClass}`}>{display.label}</div>
                    {style.summaryLabel !== null
                        && problemStatement
                        && problemStatement.trim().length > 0 && (
                        <div className="mt-1 text-xs text-gray-300">
                            <span className="font-semibold text-gray-400">
                                {style.summaryLabel}:{' '}
                            </span>
                            {problemStatement}
                        </div>
                    )}
                    <div className="mt-0.5 text-[11px] italic text-gray-500">
                        {display.description}
                    </div>
                </div>
            </summary>
            <div className="border-t border-gray-800 px-3 py-2 text-xs text-gray-300">
                {children}
                <div className="mt-2 border-t border-gray-800 pt-1 text-[10px] italic text-gray-600">
                    Classification key: <code className="text-gray-500">{classificationKey}</code>
                </div>
            </div>
        </details>
    );
};

export default GateBucketCard;
