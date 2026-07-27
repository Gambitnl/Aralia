/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 22/04/2026, 13:27:08
 * Dependents: components/Glossary/spellGateChecker/GateBucketCard.tsx, components/Glossary/spellGateChecker/SpellGateBucketSections.tsx
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file gateDisplayLabels.ts
 * Single source of display truth for the spell gate checker UI.
 *
 * Design contract:
 * - Classification keys (e.g. `footnote_marker_residue`) are stable identifiers
 *   used by 17+ tracker docs, the generated spell_gate_report.json artifact,
 *   and cross-repo spell-truth tooling. They MUST NOT be renamed here.
 * - Only the *display* side (plain-English labels, verdict tone, icon,
 *   collapse-by-default behaviour) lives in this file.
 *
 * Why: the previous panel surfaced raw snake_case keys and "Severity: Model
 * Boundary" text directly to human reviewers. That language is for the tracker
 * docs, not for a glossary-side reviewer who just wants to know "is something
 * wrong with this spell yes/no and if yes, how bad".
 *
 * Called by: SpellGateBucketSections.tsx, GateBucketCard.tsx
 * Depends on: nothing (pure data)
 */
export type GateVerdict = 'aligned' | 'boundary' | 'residue' | 'review' | 'drift' | 'blocked' | 'info';
export interface VerdictStyle {
    /** Short glyph rendered in the badge and in the card header. */
    icon: string;
    /** Tailwind classes for the badge pill. */
    badgeClass: string;
    /** Tailwind classes for the accent border on the card. */
    accentClass: string;
    /** Tailwind text-tone class for reuse in inline severity spans. */
    toneClass: string;
    /** Human-readable verdict label shown in the badge. */
    label: string;
    /** Whether the card starts collapsed. Low-signal verdicts do; real issues don't. */
    collapseByDefault: boolean;
    /**
     * Prefix used for the single-sentence summary line in the card header.
     * "What is wrong" only makes sense when something is actually wrong, so
     * Aligned/Boundary/Residue/Info use softer framings. Set to `null` to
     * suppress the summary line entirely for this verdict (used for Aligned
     * where the summary would just be noise like "components match").
     */
    summaryLabel: string | null;
}
export declare const VERDICT_STYLE: Record<GateVerdict, VerdictStyle>;
export interface ClassificationDisplay {
    label: string;
    verdict: GateVerdict;
    description: string;
}
export declare const CLASSIFICATION_LABELS: Record<string, ClassificationDisplay>;
/**
 * Fallback used when the gate emits a classification key that is not yet in
 * CLASSIFICATION_LABELS. Keeps the UI resilient and loud about the missing
 * entry without crashing.
 */
export declare function classificationFallback(classification: string): ClassificationDisplay;
/**
 * Look up display metadata for a classification key. Falls back to a
 * humanized snake_case rendering when a key is missing from the map.
 */
export declare function getClassificationDisplay(classification: string | undefined | null): ClassificationDisplay;
