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
import { type ClassificationDisplay, type GateVerdict } from './gateDisplayLabels';
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
export declare const GateBucketCard: React.FC<GateBucketCardProps>;
export default GateBucketCard;
