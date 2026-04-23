// @dependencies-start
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
// @dependencies-end

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

// ============================================================================
// Verdict taxonomy
// ============================================================================
// The reviewer-facing taxonomy collapses the ~60 stable classification keys
// into 7 verdict buckets. Each verdict drives colour, icon, and whether the
// card should be collapsed by default so the overall panel is scannable.
// ============================================================================

export type GateVerdict =
    // Everything checks out for this bucket; keep the card collapsed.
    | 'aligned'
    // Accepted model/display-shape difference (e.g. structured header vs
    // decomposed runtime JSON). Not wrong, just a known storage boundary.
    | 'boundary'
    // Cosmetic / source-shape residue (e.g. `*` vs `**` footnote markers).
    // Low priority; safe to collapse.
    | 'residue'
    // Needs a human to look — likely wording or interpretation drift.
    | 'review'
    // Real implementation drift — runtime JSON or structured layer is
    // actually wrong and needs a data fix.
    | 'drift'
    // Comparison is blocked because one side is missing the data we need.
    | 'blocked'
    // Audit-shape / informational bucket where nothing is actually wrong
    // but we want to keep the row visible for traceability.
    | 'info';

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

export const VERDICT_STYLE: Record<GateVerdict, VerdictStyle> = {
    aligned: {
        icon: '✓',
        label: 'Aligned',
        badgeClass: 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/60',
        accentClass: 'border-l-4 border-emerald-700/60',
        toneClass: 'text-emerald-300',
        collapseByDefault: true,
        // When the bucket is aligned, the summary is usually redundant with
        // the verdict itself ("components match exactly"). Suppress it so the
        // card header stays quiet.
        summaryLabel: null,
    },
    boundary: {
        icon: '◐',
        label: 'Storage boundary',
        badgeClass: 'bg-violet-900/60 text-violet-300 border border-violet-700/60',
        accentClass: 'border-l-4 border-violet-700/60',
        toneClass: 'text-violet-300',
        collapseByDefault: true,
        summaryLabel: 'Why it differs',
    },
    residue: {
        icon: '~',
        label: 'Cosmetic residue',
        badgeClass: 'bg-sky-900/60 text-sky-300 border border-sky-700/60',
        accentClass: 'border-l-4 border-sky-700/60',
        toneClass: 'text-sky-300',
        collapseByDefault: true,
        summaryLabel: 'Cosmetic note',
    },
    review: {
        icon: '?',
        label: 'Needs review',
        badgeClass: 'bg-amber-900/60 text-amber-300 border border-amber-700/60',
        accentClass: 'border-l-4 border-amber-600/70',
        toneClass: 'text-amber-300',
        collapseByDefault: false,
        summaryLabel: 'Needs review',
    },
    drift: {
        icon: '!',
        label: 'Real drift',
        badgeClass: 'bg-red-900/60 text-red-300 border border-red-700/60',
        accentClass: 'border-l-4 border-red-600/70',
        toneClass: 'text-red-300',
        collapseByDefault: false,
        summaryLabel: 'What is wrong',
    },
    blocked: {
        icon: '■',
        label: 'Blocked',
        badgeClass: 'bg-gray-800 text-gray-300 border border-gray-600',
        accentClass: 'border-l-4 border-gray-600',
        toneClass: 'text-gray-300',
        collapseByDefault: false,
        summaryLabel: 'Cannot compare',
    },
    info: {
        icon: 'i',
        label: 'Informational',
        badgeClass: 'bg-gray-800 text-gray-400 border border-gray-600',
        accentClass: 'border-l-4 border-gray-700',
        toneClass: 'text-gray-400',
        collapseByDefault: true,
        summaryLabel: 'Note',
    },
};

// ============================================================================
// Classification label map
// ============================================================================
// Every classification key the gate checker can emit is listed here. The
// mapping defines:
//   - label       : plain English phrase shown to the reviewer
//   - verdict     : which of the 7 verdict buckets the classification belongs to
//   - description : one-sentence explanation used for tooltips and the
//                   collapsed card preview so reviewers don't have to expand
//                   the card to know what the label means
//
// If you add a new classification to useSpellGateChecks.ts, add the matching
// entry here. Missing entries fall back to `classificationFallback` below.
// ============================================================================

export interface ClassificationDisplay {
    label: string;
    verdict: GateVerdict;
    description: string;
}

export const CLASSIFICATION_LABELS: Record<string, ClassificationDisplay> = {
    // ---- Universal shared keys -------------------------------------------
    aligned: {
        label: 'Aligned',
        verdict: 'aligned',
        description: 'Structured layer and the runtime spell JSON already agree for this bucket.',
    },
    model_display_boundary: {
        label: 'Same facts, different storage shape',
        verdict: 'boundary',
        description: 'The structured layer stores one compact header; the runtime JSON stores the same facts as decomposed fields.',
    },
    display_model_boundary: {
        label: 'Same facts, different display shape',
        verdict: 'boundary',
        description: 'The spell stores the same facts as the canonical source, but the normalized display shape differs.',
    },
    real_runtime_drift: {
        label: 'Runtime JSON does not match structured',
        verdict: 'drift',
        description: 'The structured layer and the runtime spell JSON disagree about the actual facts for this bucket.',
    },
    true_runtime_drift: {
        label: 'Runtime JSON does not match structured',
        verdict: 'drift',
        description: 'The structured layer and the runtime spell JSON disagree about the actual facts for this bucket.',
    },
    real_implementation_drift: {
        label: 'Real implementation drift',
        verdict: 'drift',
        description: 'The runtime spell JSON is behind the structured layer and needs a data fix.',
    },

    // ---- Components (canonical -> structured) -----------------------------
    footnote_marker_residue: {
        label: 'Footnote marker residue',
        verdict: 'residue',
        description: 'The V/S/M letters match; only the canonical footnote marker (for example * vs **) differs.',
    },
    alternate_source_shape: {
        label: 'Alternate source shape',
        verdict: 'residue',
        description: 'An alternate canonical source keeps the raw component/material string inline instead of the normalized compact header.',
    },
    true_components_drift: {
        label: 'Real components drift',
        verdict: 'drift',
        description: 'The V/S/M facts themselves disagree between structured and canonical.',
    },

    // ---- Components runtime ----------------------------------------------
    missing_runtime_components: {
        label: 'Runtime JSON is missing components',
        verdict: 'drift',
        description: 'The structured layer has a V/S/M line, but the runtime JSON does not carry the component facts needed to render it.',
    },
    missing_structured_components: {
        label: 'Structured layer is missing components',
        verdict: 'blocked',
        description: 'The runtime JSON may have component facts, but the structured layer lacks a comparable Components line.',
    },

    // ---- Material Component (canonical) -----------------------------------
    missing_canonical_comparable_field: {
        label: 'No comparable canonical field',
        verdict: 'info',
        description: 'The canonical source does not currently expose a directly comparable Material Component field.',
    },
    missing_structured_material: {
        label: 'Structured layer is missing the material note',
        verdict: 'blocked',
        description: 'The canonical snapshot has material text, but the structured layer has no matching Material Component line.',
    },
    consumed_state_drift: {
        label: 'Consumed-state drift',
        verdict: 'review',
        description: 'The canonical and structured material notes disagree about whether the component is consumed.',
    },
    true_material_component_drift: {
        label: 'Real material component drift',
        verdict: 'drift',
        description: 'The structured and canonical material notes disagree about the actual material text.',
    },

    // ---- Material Component runtime ---------------------------------------
    missing_runtime_material_component: {
        label: 'Runtime JSON is missing the material note',
        verdict: 'drift',
        description: 'The structured layer has a material note but the runtime JSON does not expose a matching material description.',
    },
    missing_structured_material_component: {
        label: 'Structured layer is missing the material note',
        verdict: 'blocked',
        description: 'The runtime JSON may have material data but the structured layer has no comparable Material Component line to diff against.',
    },
    consumed_state_runtime_drift: {
        label: 'Runtime consumed-state disagrees',
        verdict: 'review',
        description: 'Structured and runtime JSON disagree about whether the component is consumed by the spell.',
    },
    cost_runtime_drift: {
        label: 'Runtime material cost disagrees',
        verdict: 'review',
        description: 'Structured and runtime JSON disagree about the GP cost of the material component.',
    },

    // ---- Duration (canonical -> structured) -------------------------------
    flattened_concentration_display: {
        label: 'Concentration shown inline in duration',
        verdict: 'residue',
        description: 'The canonical duration string folds the Concentration flag into the duration text; the structured layer keeps them as separate facts.',
    },
    duration_unit_pluralization: {
        label: 'Duration unit pluralization',
        verdict: 'residue',
        description: 'The canonical and structured duration differ only in whether the unit is singular or plural (e.g. "1 Minute" vs "1 Minutes").',
    },
    until_dispelled_boundary: {
        label: '"Until dispelled" source shape',
        verdict: 'boundary',
        description: 'The canonical source stores this as a prose phrase; the structured layer normalizes it into explicit duration facts.',
    },
    until_dispelled_or_triggered_boundary: {
        label: '"Until dispelled or triggered" source shape',
        verdict: 'boundary',
        description: 'The canonical source stores this as a prose phrase; the structured layer normalizes it into explicit duration facts.',
    },
    special_duration_boundary: {
        label: 'Special-case duration source shape',
        verdict: 'boundary',
        description: 'The canonical source uses a special-case duration phrasing that the structured layer normalizes away.',
    },
    true_duration_drift: {
        label: 'Real duration drift',
        verdict: 'drift',
        description: 'The canonical and structured duration values actually disagree.',
    },

    // ---- Duration runtime -------------------------------------------------
    missing_runtime_duration: {
        label: 'Runtime JSON is missing duration',
        verdict: 'drift',
        description: 'The structured layer has duration facts but the runtime spell JSON does not expose a comparable duration.',
    },
    missing_structured_duration: {
        label: 'Structured layer is missing duration',
        verdict: 'blocked',
        description: 'The runtime JSON has duration data but the structured layer has no comparable Duration row to diff against.',
    },
    flattened_concentration_runtime_residue: {
        label: 'Runtime concentration wording residue',
        verdict: 'residue',
        description: 'The structured layer and runtime JSON carry the same duration facts; only the wording around Concentration differs.',
    },
    duration_wording_runtime_residue: {
        label: 'Runtime duration wording residue',
        verdict: 'residue',
        description: 'The structured layer and runtime JSON carry the same duration facts with only minor wording differences.',
    },
    special_bucket_normalization: {
        label: 'Special-case duration normalization',
        verdict: 'boundary',
        description: 'Structured and runtime use a documented special-case duration shape that does not round-trip exactly.',
    },
    true_runtime_duration_drift: {
        label: 'Runtime duration does not match structured',
        verdict: 'drift',
        description: 'Structured and runtime JSON disagree about the actual duration facts.',
    },

    // ---- Casting Time -----------------------------------------------------
    ritual_inline_display: {
        label: 'Ritual flag shown inline',
        verdict: 'residue',
        description: 'The canonical casting-time string folds the Ritual marker inline; the structured layer keeps ritual as a separate fact.',
    },
    trigger_footnote_display: {
        label: 'Trigger footnote shown inline',
        verdict: 'residue',
        description: 'The canonical casting-time string carries a trigger footnote that the structured layer normalizes out.',
    },
    canonical_suffix_display: {
        label: 'Canonical suffix residue',
        verdict: 'residue',
        description: 'The canonical casting-time string carries a trailing source-display suffix that does not round-trip to the normalized header.',
    },
    true_casting_time_drift: {
        label: 'Real casting time drift',
        verdict: 'drift',
        description: 'Canonical and structured casting-time values actually disagree.',
    },

    // ---- Description ------------------------------------------------------
    audit_shape_residue: {
        label: 'Audit did not extract a comparable field',
        verdict: 'info',
        description: 'The canonical prose likely exists under raw Rules Text, but the audit did not derive a directly comparable Description value.',
    },
    real_prose_drift: {
        label: 'Real prose drift',
        verdict: 'review',
        description: 'The structured Description is saying something materially different from the canonical Rules Text.',
    },
    formatting_residue: {
        label: 'Formatting or encoding residue',
        verdict: 'residue',
        description: 'Description text is semantically aligned; formatting or encoding differences are preventing an exact match.',
    },
    missing_structured_description: {
        label: 'Structured Description is missing',
        verdict: 'drift',
        description: 'The canonical snapshot has spell prose, but the structured spell block has no Description text.',
    },

    // ---- Description runtime ---------------------------------------------
    blocked_missing_structured_description: {
        label: 'Cannot compare — structured Description missing',
        verdict: 'blocked',
        description: 'The structured Description is missing, so there is nothing to compare against the runtime JSON yet.',
    },
    missing_runtime_description: {
        label: 'Runtime JSON is missing description',
        verdict: 'drift',
        description: 'The structured layer has Description prose, but the runtime spell JSON does not carry it.',
    },
    formatting_runtime_residue: {
        label: 'Runtime formatting residue',
        verdict: 'residue',
        description: 'Structured and runtime text are semantically equal; formatting or encoding differences are preventing an exact match.',
    },

    // ---- Higher Levels (canonical) ---------------------------------------
    canonical_prefix_only: {
        label: 'Canonical prefix header only',
        verdict: 'residue',
        description: 'The canonical snapshot carries a prefix header for the scaling text that the structured layer normalizes away.',
    },
    canonical_statblock_tail: {
        label: 'Canonical statblock tail',
        verdict: 'residue',
        description: 'The canonical scaling text carries a trailing statblock residue that does not round-trip to the normalized header.',
    },
    true_higher_levels_drift: {
        label: 'Real higher-levels drift',
        verdict: 'review',
        description: 'Structured and canonical scaling text actually disagree about spell behaviour at higher levels.',
    },

    // ---- Higher Levels runtime -------------------------------------------
    missing_runtime_higher_levels: {
        label: 'Runtime JSON is missing higher-levels',
        verdict: 'drift',
        description: 'The structured layer has higher-levels scaling text, but the runtime spell JSON does not carry it.',
    },
    missing_structured_higher_levels: {
        label: 'Structured layer is missing higher-levels',
        verdict: 'blocked',
        description: 'The runtime JSON has higher-levels text, but the structured layer has no comparable row to diff against.',
    },
    duplicate_runtime_higher_levels: {
        label: 'Runtime Description repeats higher-levels',
        verdict: 'review',
        description: 'The runtime JSON Description appears to repeat the higher-levels text, which usually indicates a copy-paste.',
    },

    // ---- Sub-Classes ------------------------------------------------------
    markdown_malformed_value: {
        label: 'Structured Sub-Classes value is malformed',
        verdict: 'drift',
        description: 'The structured Sub-Classes row does not parse into a valid list.',
    },
    repeated_base_normalization: {
        label: 'Repeated-base normalization',
        verdict: 'boundary',
        description: 'The canonical snapshot preserves subclass entries whose base class is already in the spell roster; the structured layer intentionally omits those.',
    },
    unsupported_entries: {
        label: 'Subclass entries unsupported',
        verdict: 'boundary',
        description: 'The canonical subclass entries exist but are not yet modelled in the normalized runtime roster.',
    },
    no_subclass_entries: {
        label: 'No subclass entries',
        verdict: 'aligned',
        description: 'The spell has no subclass-specific access beyond the base class roster.',
    },
    real_subclass_drift: {
        label: 'Real subclass drift',
        verdict: 'drift',
        description: 'Structured and canonical subclass access actually disagree.',
    },
    malformed_structured_value: {
        label: 'Structured Sub-Classes value is malformed',
        verdict: 'drift',
        description: 'The structured Sub-Classes row does not parse into a valid list.',
    },
    missing_runtime_subclasses: {
        label: 'Runtime JSON is missing subclass access',
        verdict: 'drift',
        description: 'The structured layer has Sub-Classes entries, but the runtime spell JSON does not.',
    },
    missing_structured_subclasses: {
        label: 'Structured layer is missing Sub-Classes',
        verdict: 'blocked',
        description: 'The runtime JSON has subclass access, but the structured layer has no comparable row to diff against.',
    },
    json_unverified_after_transfer: {
        label: 'Runtime subclass not yet verified',
        verdict: 'review',
        description: 'Subclass access was transferred but the verification flag is not yet set on the runtime JSON.',
    },

    // ---- Classes ----------------------------------------------------------
    source_shape_residue: {
        label: 'Canonical uses Available For shape',
        verdict: 'residue',
        description: 'The canonical source preserves class access under a raw Available For list rather than a dedicated Classes field.',
    },
    legacy_available_for_surface: {
        label: 'Legacy Available For surface',
        verdict: 'residue',
        description: 'The canonical class access is preserved in legacy Available For form; the structured layer carries the normalized Classes header.',
    },
    true_class_drift: {
        label: 'Real class-access drift',
        verdict: 'drift',
        description: 'Canonical and structured class-access lists actually disagree.',
    },

    // ---- Range/Area (canonical) ------------------------------------------
    self_radius_in_range: {
        label: 'Self radius folded into range',
        verdict: 'residue',
        description: 'The canonical source stores the self-centered radius inside the range string; the structured layer splits it into range + area facts.',
    },
    range_only_boundary: {
        label: 'Range-only source shape',
        verdict: 'boundary',
        description: 'The canonical source only exposes range; area geometry lives on the normalized structured side only.',
    },
    true_range_area_drift: {
        label: 'Real range/area drift',
        verdict: 'drift',
        description: 'Canonical and structured range/area values actually disagree.',
    },

    // ---- Range/Area runtime ----------------------------------------------
    missing_runtime_range_area: {
        label: 'Runtime JSON is missing range/area',
        verdict: 'drift',
        description: 'The structured layer has range/area facts, but the runtime spell JSON does not carry them.',
    },
    missing_structured_range_area: {
        label: 'Structured layer is missing range/area',
        verdict: 'blocked',
        description: 'The runtime JSON has range/area data but the structured layer has no comparable row to diff against.',
    },
    range_used_as_area_radius: {
        label: 'Range value reused as area radius',
        verdict: 'review',
        description: 'The runtime JSON reuses the range distance as the area radius; may be intentional or may hide the real area size.',
    },
    self_only_placeholder_area_geometry: {
        label: 'Placeholder self-only geometry',
        verdict: 'info',
        description: 'The spell has self-only range and the area geometry is a placeholder; not real drift.',
    },

    // ---- Attack Roll Riders ----------------------------------------------
    missing_runtime_attack_roll_riders: {
        label: 'Runtime JSON is missing attack-roll riders',
        verdict: 'drift',
        description: 'The structured layer names attack-roll rider mechanics, but the runtime JSON has no matching rider effect.',
    },
    missing_structured_attack_roll_riders: {
        label: 'Structured layer is missing attack-roll riders',
        verdict: 'blocked',
        description: 'The runtime JSON has rider effects but the structured layer has no comparable row to diff against.',
    },

    // ---- Conditions -------------------------------------------------------
    missing_runtime_conditions: {
        label: 'Runtime JSON is missing conditions',
        verdict: 'drift',
        description: 'The structured layer names applied conditions but the runtime JSON has no matching condition effect.',
    },
    missing_structured_conditions: {
        label: 'Structured layer is missing conditions',
        verdict: 'blocked',
        description: 'The runtime JSON applies conditions but the structured layer has no comparable row to diff against.',
    },
};

/**
 * Fallback used when the gate emits a classification key that is not yet in
 * CLASSIFICATION_LABELS. Keeps the UI resilient and loud about the missing
 * entry without crashing.
 */
export function classificationFallback(classification: string): ClassificationDisplay {
    return {
        label: classification.replace(/_/g, ' '),
        verdict: 'info',
        description: `No plain-English description has been registered for classification key "${classification}" yet.`,
    };
}

/**
 * Look up display metadata for a classification key. Falls back to a
 * humanized snake_case rendering when a key is missing from the map.
 */
export function getClassificationDisplay(classification: string | undefined | null): ClassificationDisplay {
    if (!classification) {
        return {
            label: 'Unclassified',
            verdict: 'info',
            description: 'The gate checker did not attach a classification to this bucket.',
        };
    }
    return CLASSIFICATION_LABELS[classification] ?? classificationFallback(classification);
}
