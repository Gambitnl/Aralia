// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 06/04/2026, 01:40:47
 * Dependents: components/Glossary/spellGateChecker/SpellGateChecksPanel.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file SpellGateBucketSections.tsx
 * This file renders the detailed bucket-by-bucket spell review sections.
 *
 * The overview shell now lives in SpellGateChecksPanel.tsx, while this file
 * keeps the long-form forensic review blocks grouped behind one dedicated module.
 * That split makes the top-level panel easier to scan without deleting any of
 * the deeper spell-truth detail work that the reviewer still needs.
 *
 * Called by: SpellGateChecksPanel.tsx
 * Depends on: GateResult data from the spell gate hook and the spell-card JSON shape
 */
import React from 'react';
import type { GlossaryEntry } from '../../../types';
import type { GateResult } from './useSpellGateChecks';
import type { SpellData } from '../SpellCardTemplate';

// ============================================================================
// Bucket detail helpers
// ============================================================================
// The gate panel now has a bucket-specific branch for Range/Area. The purpose of
// this section is to turn the live spell JSON into a short geometry summary so the
// user can compare three things at once:
// - the normalized spell JSON
// - the validator-facing structured header display
// - the copied canonical source display
//
// This is intentionally not a full generic spell inspector. It exists so the
// current Range/Area normalization work can be reviewed inside the glossary
// without jumping between files and reports.
// ============================================================================

function formatGateMeasuredDistance(value: number, unit: 'feet' | 'miles' | 'inches' = 'feet'): string {
    if (unit === 'miles') {
        return `${value} ${value === 1 ? 'mile' : 'miles'}`;
    }

    if (unit === 'inches') {
        return `${value} ${value === 1 ? 'inch' : 'inches'}`;
    }

    return `${value} ft.`;
}

function formatGateSizeType(sizeType?: string): string {
    switch (sizeType) {
        case 'radius':
            return 'radius';
        case 'diameter':
            return 'diameter';
        case 'length':
            return 'length';
        case 'edge':
            return 'edge';
        case 'side':
            return 'side';
        default:
            return '';
    }
}

function formatRangeAreaGeometry(spell: SpellData | null): string | null {
    if (!spell?.range || !spell.targeting) return null;

    const parts: string[] = [];

    // Range answers "where can the cast be initiated or placed from?"
    // We keep that separate from the resulting geometry below so self-centered
    // bursts and point-origin zones do not collapse into one vague label.
    if (spell.range.type === 'self') {
        parts.push('range=self');
    } else if (spell.range.type === 'touch') {
        parts.push('range=touch');
    } else if (spell.range.type === 'ranged') {
        parts.push(`range=${formatGateMeasuredDistance(spell.range.distance ?? 0, spell.range.distanceUnit ?? 'feet')}`);
    } else {
        parts.push(`range=${spell.range.type}`);
    }

    parts.push(`targeting=${spell.targeting.type}`);

    // Area geometry is where most of this bucket lives. Keep the shape, size, and
    // "moves with caster" state visible because those are the main normalization
    // decisions now being reviewed.
    if (spell.targeting.areaOfEffect) {
        const area = spell.targeting.areaOfEffect;
        const sizePrefix = formatGateSizeType(area.sizeType);
        let areaLabel = `area=${area.shape}`;

        if (typeof area.size === 'number') {
            areaLabel += ` ${sizePrefix ? `${sizePrefix} ` : ''}${formatGateMeasuredDistance(area.size, area.sizeUnit ?? 'feet')}`;
        }

        if (typeof area.height === 'number' && area.height > 0) {
            areaLabel += ` | height=${formatGateMeasuredDistance(area.height, area.heightUnit ?? 'feet')}`;
        }

        if (typeof area.width === 'number' && area.width > 0) {
            areaLabel += ` | width=${formatGateMeasuredDistance(area.width, area.widthUnit ?? 'feet')}`;
        }

        if (typeof area.thickness === 'number' && area.thickness > 0) {
            areaLabel += ` | thickness=${formatGateMeasuredDistance(area.thickness, area.thicknessUnit ?? 'feet')}`;
        }

        if (area.followsCaster) {
            areaLabel += ' (follows caster)';
        }

        parts.push(areaLabel);
    }

    // Risky geometry spells now expose extra forms and measured details. Keep
    // those visible in the gate checker so the reviewer can tell whether the
    // runtime JSON is actually carrying the pulled-apart variables or whether
    // the work is still stranded only in prose.
    const forms = spell.targeting.spatialDetails?.forms ?? [];
    if (forms.length > 0) {
        parts.push(`forms=${forms.length}:${forms.map((form) => form.label || form.shape).join(', ')}`);
    }

    const measuredDetails = spell.targeting.spatialDetails?.measuredDetails ?? [];
    if (measuredDetails.length > 0) {
        parts.push(`details=${measuredDetails.length}:${measuredDetails.map((detail) => detail.label).join(', ')}`);
    }

    return parts.join(' | ');
}

function humanizeCastingTimeUnit(unit: string, value: number): string {
    if (unit === 'action') return value === 1 ? 'action' : 'actions';
    if (unit === 'bonus_action') return value === 1 ? 'bonus action' : 'bonus actions';
    if (unit === 'reaction') return value === 1 ? 'reaction' : 'reactions';
    if (unit === 'minute') return value === 1 ? 'minute' : 'minutes';
    if (unit === 'hour') return value === 1 ? 'hour' : 'hours';
    if (unit === 'round') return value === 1 ? 'round' : 'rounds';
    return unit.replace(/_/g, ' ');
}

function formatCurrentCastingTime(spell: SpellData | null): string | null {
    if (!spell?.castingTime) return null;

    const { value, unit } = spell.castingTime;
    return `${value} ${humanizeCastingTimeUnit(unit, value)}`;
}

// Components residue is much narrower than some of the other buckets, but it is
// still worth showing the current JSON breakdown because the user needs to see
// whether the spell facts are actually wrong or whether the source just formats
// the same material note differently.
function formatCurrentComponents(spell: SpellData | null): string | null {
    if (!spell?.components) return null;

    const parts: string[] = [];
    if (spell.components.verbal) parts.push('V');
    if (spell.components.somatic) parts.push('S');
    if (spell.components.material) parts.push('M');

    const details: string[] = [];
    if (spell.components.material) {
        details.push(`material=${spell.components.materialDescription || '(none)'}`);
    }

    return details.length > 0
        ? `${parts.join(', ')} | ${details.join(' | ')}`
        : parts.join(', ');
}

// Material Component is narrower than the broader Components line. This helper
// keeps the live spell-card-facing material facts visible so the reviewer can
// compare the raw material note bucket against what the current glossary spell
// card actually knows how to render.
function formatCurrentMaterialComponent(spell: SpellData | null): string | null {
    if (!spell?.components?.material) return null;

    return `material=true | description=${spell.components.materialDescription || '(none)'}`;
}

// Duration needs the same kind of "what does the live JSON actually say?"
// helper as Range/Area and Casting Time. The Duration bucket is specifically
// about separating engine-truth facts like concentration from the flattened
// source-display string copied into the canonical snapshot.
function formatCurrentDuration(spell: SpellData | null): string | null {
    if (!spell?.duration) return null;

    const { type, value, unit, concentration } = spell.duration;
    const parts: string[] = [`type=${type}`];

    // Timed durations carry the most detail, so keep value and unit visible
    // when they exist. This is what lets the gate panel show that
    // "Concentration 1 Minute" is really two separate facts in the JSON.
    if (typeof value === 'number') {
        parts.push(`value=${value}`);
    }

    if (unit) {
        parts.push(`unit=${unit}`);
    }

    parts.push(`concentration=${concentration ? 'true' : 'false'}`);

    return parts.join(' | ');
}

// Duration runtime review needs the same severity treatment as the other
// structured -> JSON review blocks. The goal is to tell the reviewer whether
// the runtime spell JSON is truly behind, merely worded differently, or only
// exposing a known model-boundary around special durations.
function getDurationRuntimeReviewMeta(
    classification: NonNullable<NonNullable<GateResult['bucketDetails']>['durationRuntime']>['classification'],
): {
    severityLabel: string;
    severityTone: string;
} {
    if (classification === 'missing_runtime_duration') {
        return { severityLabel: 'High Severity', severityTone: 'text-red-300' };
    }

    if (classification === 'true_runtime_duration_drift') {
        return { severityLabel: 'Review Needed', severityTone: 'text-amber-300' };
    }

    if (
        classification === 'flattened_concentration_runtime_residue'
        || classification === 'duration_wording_runtime_residue'
    ) {
        return { severityLabel: 'Low Severity', severityTone: 'text-sky-300' };
    }

    if (
        classification === 'special_bucket_normalization'
        || classification === 'until_dispelled_boundary'
        || classification === 'until_dispelled_or_triggered_boundary'
    ) {
        return { severityLabel: 'Model Boundary', severityTone: 'text-violet-300' };
    }

    if (classification === 'aligned') {
        return { severityLabel: 'Aligned', severityTone: 'text-emerald-300' };
    }

    return { severityLabel: 'Blocked', severityTone: 'text-gray-300' };
}

// Higher-level scaling text already lives on the runtime spell JSON. We surface
// it in the gate checker so reviewers can see whether the structured header is
// still aligned with the live game-system data even when the canonical snapshot
// chose to keep the same scaling text inline under Rules Text.
function formatCurrentHigherLevels(spell: SpellData | null): string | null {
    if (!spell?.higherLevels) return null;

    const normalized = spell.higherLevels.trim();
    return normalized.length > 0 ? normalized : null;
}

// Description drift needs stronger reviewer guidance than the other buckets,
// because this lane mixes true content omissions with low-severity audit-shape
// residue. This helper turns the raw classifier into plain-language review
// guidance so the gate panel can say exactly what the reviewer should infer.
function getDescriptionReviewMeta(
    classification: NonNullable<NonNullable<GateResult['bucketDetails']>['description']>['classification'],
): {
    severityLabel: string;
    severityTone: string;
    problem: string;
    nextStep: string;
} {
    if (classification === 'missing_structured_description') {
        return {
            severityLabel: 'High Severity',
            severityTone: 'text-red-300',
            problem: 'The structured spell block is missing its Description text even though the canonical snapshot has usable spell prose.',
            nextStep: 'Copy the canonical prose into the structured Description field and verify the matching spell JSON description stays aligned.',
        };
    }

    if (classification === 'real_prose_drift') {
        return {
            severityLabel: 'Review Needed',
            severityTone: 'text-amber-300',
            problem: 'The structured Description is still saying something materially different from the copied canonical spell prose.',
            nextStep: 'Review the structured Description against the canonical Rules Text and decide whether the local wording omitted, shortened, or reshaped spell meaning.',
        };
    }

    if (classification === 'formatting_residue') {
        return {
            severityLabel: 'Low Severity',
            severityTone: 'text-sky-300',
            problem: 'The Description appears semantically aligned, but formatting or encoding differences are still preventing an exact match.',
            nextStep: 'Only clean this up if the visible text quality matters; this is not usually a spell-truth failure.',
        };
    }

    return {
        severityLabel: 'Informational',
        severityTone: 'text-gray-300',
        problem: 'The canonical spell prose likely exists under raw Rules Text, but the audit did not derive a directly comparable canonical Description field.',
        nextStep: 'Treat this as an audit-shape boundary first, not as proof that the structured Description is wrong.',
    };
}

// Runtime Description review is a separate lane from canonical -> structured.
// The glossary spell card renders from spell JSON, so this helper explains what
// the selected spell is doing wrong at the runtime/app layer specifically.
function getDescriptionRuntimeReviewMeta(
    classification: NonNullable<NonNullable<GateResult['bucketDetails']>['descriptionRuntime']>['classification'],
): {
    severityLabel: string;
    severityTone: string;
} {
    if (classification === 'missing_runtime_description') {
        return { severityLabel: 'High Severity', severityTone: 'text-red-300' };
    }

    if (classification === 'real_runtime_drift') {
        return { severityLabel: 'Review Needed', severityTone: 'text-amber-300' };
    }

    if (classification === 'formatting_runtime_residue') {
        return { severityLabel: 'Low Severity', severityTone: 'text-sky-300' };
    }

    return { severityLabel: 'Blocked', severityTone: 'text-gray-300' };
}

// Higher Levels needs its own runtime severity helper because the canonical
// review above only answers whether the interpreted header still lines up with
// the copied source snapshot. The glossary spell card renders from JSON, so the
// runtime lane has to say separately whether the live app data is actually
// behind, merely formatted differently, or blocked by missing structured data.
function getHigherLevelsRuntimeReviewMeta(
    classification: NonNullable<NonNullable<GateResult['bucketDetails']>['higherLevelsRuntime']>['classification'],
): {
    severityLabel: string;
    severityTone: string;
} {
    if (classification === 'missing_runtime_higher_levels') {
        return { severityLabel: 'High Severity', severityTone: 'text-red-300' };
    }

    if (classification === 'real_runtime_drift') {
        return { severityLabel: 'Review Needed', severityTone: 'text-amber-300' };
    }

    if (classification === 'formatting_runtime_residue') {
        return { severityLabel: 'Low Severity', severityTone: 'text-sky-300' };
    }

    if (classification === 'aligned') {
        return { severityLabel: 'Aligned', severityTone: 'text-emerald-300' };
    }

    return { severityLabel: 'Blocked', severityTone: 'text-gray-300' };
}

// Components runtime review answers a narrower question than the canonical
// Components bucket above: is the structured V/S/M header still saying the same
// thing as the live runtime spell JSON the glossary actually renders?
function getComponentsRuntimeReviewMeta(
    classification: NonNullable<NonNullable<GateResult['bucketDetails']>['componentsRuntime']>['classification'],
): {
    severityLabel: string;
    severityTone: string;
} {
    if (classification === 'missing_runtime_components') {
        return { severityLabel: 'High Severity', severityTone: 'text-red-300' };
    }

    if (classification === 'real_runtime_drift') {
        return { severityLabel: 'Review Needed', severityTone: 'text-amber-300' };
    }

    if (classification === 'model_display_boundary') {
        return { severityLabel: 'Model Boundary', severityTone: 'text-violet-300' };
    }

    if (classification === 'aligned') {
        return { severityLabel: 'Aligned', severityTone: 'text-emerald-300' };
    }

    return { severityLabel: 'Blocked', severityTone: 'text-gray-300' };
}

// Material Component runtime review is a distinct lane from the source-facing
// Material Component bucket above. The glossary spell card renders from runtime
// JSON, so this helper tells the reviewer whether the live app data is behind,
// merely worded differently, or blocked by missing structured data.
function getMaterialComponentRuntimeReviewMeta(
    classification: NonNullable<NonNullable<GateResult['bucketDetails']>['materialComponentRuntime']>['classification'],
): {
    severityLabel: string;
    severityTone: string;
} {
    if (classification === 'missing_runtime_material_component') {
        return { severityLabel: 'High Severity', severityTone: 'text-red-300' };
    }

    if (
        classification === 'consumed_state_runtime_drift'
        || classification === 'cost_runtime_drift'
        || classification === 'real_runtime_drift'
    ) {
        return { severityLabel: 'Review Needed', severityTone: 'text-amber-300' };
    }

    if (classification === 'model_display_boundary') {
        return { severityLabel: 'Model Boundary', severityTone: 'text-violet-300' };
    }

    if (classification === 'aligned') {
        return { severityLabel: 'Aligned', severityTone: 'text-emerald-300' };
    }

    return { severityLabel: 'Blocked', severityTone: 'text-gray-300' };
}

// The audit already produces a spell-specific summary for each supported bucket.
// This helper keeps that "what is actually wrong with this spell?" sentence in
// one place so every bucket panel surfaces it the same way.
function renderBucketProblem(problem: string | null | undefined): React.ReactNode {
    if (!problem || problem.trim().length === 0) return null;
    return <li>- What is wrong: {problem}</li>;
}

// ============================================================================
// Detailed spell review families
// ============================================================================
// This section owns the deeper review families that were previously embedded in
// the top-level panel. The overview panel now stays compact while this file
// continues to expose the spell-truth detail lanes needed for arbitration work.
// ============================================================================

export const SpellGateBucketSections: React.FC<{
    selectedEntry: GlossaryEntry;
    gateResults: Record<string, GateResult>;
    spellJsonData: SpellData | null;
}> = ({ selectedEntry, gateResults, spellJsonData }) => {
    const gate = gateResults[selectedEntry.id];
    if (!gate) return null;
    const canonicalListingUrl = gate.spellTruth?.listingUrl;
    const durationRuntimeReviewMeta = gate.bucketDetails?.durationRuntime
        ? getDurationRuntimeReviewMeta(gate.bucketDetails.durationRuntime.classification)
        : null;
    const descriptionReviewMeta = gate.bucketDetails?.description
        ? getDescriptionReviewMeta(gate.bucketDetails.description.classification)
        : null;
    const descriptionRuntimeReviewMeta = gate.bucketDetails?.descriptionRuntime
        ? getDescriptionRuntimeReviewMeta(gate.bucketDetails.descriptionRuntime.classification)
        : null;
    const higherLevelsRuntimeReviewMeta = gate.bucketDetails?.higherLevelsRuntime
        ? getHigherLevelsRuntimeReviewMeta(gate.bucketDetails.higherLevelsRuntime.classification)
        : null;
    const componentsRuntimeReviewMeta = gate.bucketDetails?.componentsRuntime
        ? getComponentsRuntimeReviewMeta(gate.bucketDetails.componentsRuntime.classification)
        : null;
    const materialComponentRuntimeReviewMeta = gate.bucketDetails?.materialComponentRuntime
        ? getMaterialComponentRuntimeReviewMeta(gate.bucketDetails.materialComponentRuntime.classification)
        : null;

    return (
        <>
                    {/* This bucket panel exists to make the current Range/Area normalization
                        pass reviewable inside the glossary. It shows the live JSON geometry,
                        the validator-facing structured header display, and the copied canonical
                        display side by side, plus a short interpretation of what kind of
                        mismatch this appears to be. */}
                    {gate.bucketDetails?.rangeArea && (
                        <div className="mt-2">
                            <div className="text-gray-500 font-semibold">Range/Area Bucket</div>
                            <ul className="mt-1 space-y-1 text-amber-300">
                                {renderBucketProblem(gate.bucketDetails.rangeArea.summary)}
                                <li>- Problem statement: {gate.bucketDetails.rangeArea.problemStatement}</li>
                                <li>- Classification: {gate.bucketDetails.rangeArea.classification}</li>
                                <li>- Structured header: {gate.bucketDetails.rangeArea.structuredValue}</li>
                                <li>- Canonical display: {gate.bucketDetails.rangeArea.canonicalValue}</li>
                                {formatRangeAreaGeometry(spellJsonData) && (
                                    <li>- Current spell JSON: {formatRangeAreaGeometry(spellJsonData)}</li>
                                )}
                                {gate.bucketDetails.rangeArea.structuredBreakdown && (
                                    <li>
                                        - Parsed geometry facts: rangeType={gate.bucketDetails.rangeArea.structuredBreakdown.rangeType}
                                        {typeof gate.bucketDetails.rangeArea.structuredBreakdown.rangeDistance === 'number'
                                            ? ` | rangeDistance=${gate.bucketDetails.rangeArea.structuredBreakdown.rangeDistance}`
                                            : ''}
                                        {` | targetingType=${gate.bucketDetails.rangeArea.structuredBreakdown.targetingType}`}
                                        {gate.bucketDetails.rangeArea.structuredBreakdown.areaShape
                                            ? ` | areaShape=${gate.bucketDetails.rangeArea.structuredBreakdown.areaShape}`
                                            : ''}
                                        {typeof gate.bucketDetails.rangeArea.structuredBreakdown.areaSize === 'number'
                                            ? ` | areaSize=${gate.bucketDetails.rangeArea.structuredBreakdown.areaSize}`
                                            : ''}
                                        {gate.bucketDetails.rangeArea.structuredBreakdown.followsCaster
                                            ? ' | followsCaster=true'
                                            : ''}
                                    </li>
                                )}
                                <li>- Interpretation: {gate.bucketDetails.rangeArea.interpretation}</li>
                                <li>- Review verdict: {gate.bucketDetails.rangeArea.reviewVerdict}</li>
                            </ul>
                        </div>
                    )}

                    {/* Canonical -> structured is only half of the Range/Area story.
                        The glossary spell card renders from runtime spell JSON, so this
                        second block answers the runtime question directly: is the live
                        spell JSON still behind the interpreted structured Range/Area
                        data for the currently selected spell? */}
                    {gate.bucketDetails?.rangeAreaRuntime && (
                        <div className="mt-2">
                            <div className="text-gray-500 font-semibold">Range/Area Runtime Review</div>
                            <ul className="mt-1 space-y-1 text-amber-300">
                                {renderBucketProblem(gate.bucketDetails.rangeAreaRuntime.problemStatement)}
                                <li>- Classification: {gate.bucketDetails.rangeAreaRuntime.classification}</li>
                                <li>- Structured value: {gate.bucketDetails.rangeAreaRuntime.structuredValue || '(none)'}</li>
                                <li>- Current JSON value: {gate.bucketDetails.rangeAreaRuntime.currentJsonValue || '(none)'}</li>
                                {gate.bucketDetails.rangeAreaRuntime.structuredBreakdown && (
                                    <li>
                                        - Parsed structured facts: rangeType={gate.bucketDetails.rangeAreaRuntime.structuredBreakdown.rangeType ?? '(unknown)'}
                                        {typeof gate.bucketDetails.rangeAreaRuntime.structuredBreakdown.rangeDistance === 'number'
                                            ? ` | rangeDistance=${gate.bucketDetails.rangeAreaRuntime.structuredBreakdown.rangeDistance}${gate.bucketDetails.rangeAreaRuntime.structuredBreakdown.rangeDistanceUnit ? ` ${gate.bucketDetails.rangeAreaRuntime.structuredBreakdown.rangeDistanceUnit}` : ''}`
                                            : ''}
                                        {gate.bucketDetails.rangeAreaRuntime.structuredBreakdown.areaShape
                                            ? ` | areaShape=${gate.bucketDetails.rangeAreaRuntime.structuredBreakdown.areaShape}`
                                            : ''}
                                        {typeof gate.bucketDetails.rangeAreaRuntime.structuredBreakdown.areaSize === 'number'
                                            ? ` | areaSize=${gate.bucketDetails.rangeAreaRuntime.structuredBreakdown.areaSize}${gate.bucketDetails.rangeAreaRuntime.structuredBreakdown.areaSizeUnit ? ` ${gate.bucketDetails.rangeAreaRuntime.structuredBreakdown.areaSizeUnit}` : ''}`
                                            : ''}
                                    </li>
                                )}
                                {gate.bucketDetails.rangeAreaRuntime.currentJsonBreakdown && (
                                    <li>
                                        - Parsed runtime facts: rangeType={gate.bucketDetails.rangeAreaRuntime.currentJsonBreakdown.rangeType}
                                        {typeof gate.bucketDetails.rangeAreaRuntime.currentJsonBreakdown.rangeDistance === 'number'
                                            ? ` | rangeDistance=${gate.bucketDetails.rangeAreaRuntime.currentJsonBreakdown.rangeDistance}${gate.bucketDetails.rangeAreaRuntime.currentJsonBreakdown.rangeDistanceUnit ? ` ${gate.bucketDetails.rangeAreaRuntime.currentJsonBreakdown.rangeDistanceUnit}` : ''}`
                                            : ''}
                                        {` | targetingType=${gate.bucketDetails.rangeAreaRuntime.currentJsonBreakdown.targetingType}`}
                                        {gate.bucketDetails.rangeAreaRuntime.currentJsonBreakdown.areaShape
                                            ? ` | areaShape=${gate.bucketDetails.rangeAreaRuntime.currentJsonBreakdown.areaShape}`
                                            : ''}
                                        {typeof gate.bucketDetails.rangeAreaRuntime.currentJsonBreakdown.areaSize === 'number'
                                            ? ` | areaSize=${gate.bucketDetails.rangeAreaRuntime.currentJsonBreakdown.areaSize}${gate.bucketDetails.rangeAreaRuntime.currentJsonBreakdown.areaSizeUnit ? ` ${gate.bucketDetails.rangeAreaRuntime.currentJsonBreakdown.areaSizeUnit}` : ''}`
                                            : ''}
                                        {gate.bucketDetails.rangeAreaRuntime.currentJsonBreakdown.followsCaster
                                            ? ' | followsCaster=true'
                                            : ''}
                                    </li>
                                )}
                                <li>- Structured matches current JSON: {gate.bucketDetails.rangeAreaRuntime.structuredMatchesJson ? 'Yes' : 'No'}</li>
                                <li>- Explanation: {gate.bucketDetails.rangeAreaRuntime.explanation}</li>
                                <li>- Review verdict: {gate.bucketDetails.rangeAreaRuntime.reviewVerdict}</li>
                            </ul>
                        </div>
                    )}

                    {/* Material Component is intentionally its own bucket because the
                        raw material note carries a different kind of residue than the
                        broader V/S/M components line. This section shows the compared
                        material note strings alongside the live JSON facts like cost and
                        consumed-state so the reviewer can tell source-shape residue
                        apart from a real material-component mismatch. */}
                    {gate.bucketDetails?.materialComponent && (
                        <div className="mt-2">
                            <div className="text-gray-500 font-semibold">Material Component Review</div>
                            <ul className="mt-1 space-y-1 text-amber-300">
                                {renderBucketProblem(gate.bucketDetails.materialComponent.problemStatement)}
                                <li>- Classification: {gate.bucketDetails.materialComponent.classification}</li>
                                <li>- Interpretation: {gate.bucketDetails.materialComponent.interpretation}</li>
                                <li>- Structured note: {gate.bucketDetails.materialComponent.structuredValue || '(none)'}</li>
                                <li>- Canonical note: {gate.bucketDetails.materialComponent.canonicalValue || '(none)'}</li>
                                <li>- Canonical note is directly comparable: {gate.bucketDetails.materialComponent.canonicalComparableField ? 'Yes' : 'No'}</li>
                                {gate.bucketDetails.materialComponent.normalizedStructuredNote && (
                                    <li>- Normalized structured note: {gate.bucketDetails.materialComponent.normalizedStructuredNote}</li>
                                )}
                                {gate.bucketDetails.materialComponent.normalizedCanonicalNote && (
                                    <li>- Normalized canonical note: {gate.bucketDetails.materialComponent.normalizedCanonicalNote}</li>
                                )}
                                {gate.bucketDetails.materialComponent.currentJsonValue && (
                                    <li>- Current spell JSON: {gate.bucketDetails.materialComponent.currentJsonValue}</li>
                                )}
                                {formatCurrentMaterialComponent(spellJsonData) && (
                                    <li>- Current spell card fields: {formatCurrentMaterialComponent(spellJsonData)}</li>
                                )}
                                {gate.bucketDetails.materialComponent.materialRequired !== undefined && (
                                    <li>- Material required: {gate.bucketDetails.materialComponent.materialRequired ? 'Yes' : 'No'}</li>
                                )}
                                {gate.bucketDetails.materialComponent.materialDescription && (
                                    <li>- Material description: {gate.bucketDetails.materialComponent.materialDescription}</li>
                                )}
                                {typeof gate.bucketDetails.materialComponent.materialCostGp === 'number' && (
                                    <li>- Material cost: {gate.bucketDetails.materialComponent.materialCostGp} gp</li>
                                )}
                                {gate.bucketDetails.materialComponent.consumed !== undefined && (
                                    <li>- Consumed by spell: {gate.bucketDetails.materialComponent.consumed ? 'Yes' : 'No'}</li>
                                )}
                                {typeof gate.bucketDetails.materialComponent.canonicalCostGp === 'number' && (
                                    <li>- Canonical cost: {gate.bucketDetails.materialComponent.canonicalCostGp} gp</li>
                                )}
                                {gate.bucketDetails.materialComponent.canonicalConsumed !== undefined && (
                                    <li>- Canonical says consumed: {gate.bucketDetails.materialComponent.canonicalConsumed ? 'Yes' : 'No'}</li>
                                )}
                                {gate.bucketDetails.materialComponent.descriptionAligned !== undefined && (
                                    <li>- Description text aligned after normalization: {gate.bucketDetails.materialComponent.descriptionAligned ? 'Yes' : 'No'}</li>
                                )}
                                {gate.bucketDetails.materialComponent.costAligned !== undefined && (
                                    <li>- Cost aligned with canonical note: {gate.bucketDetails.materialComponent.costAligned ? 'Yes' : 'No'}</li>
                                )}
                                {gate.bucketDetails.materialComponent.consumedAligned !== undefined && (
                                    <li>- Consumed-state aligned with canonical note: {gate.bucketDetails.materialComponent.consumedAligned ? 'Yes' : 'No'}</li>
                                )}
                            </ul>

                            {/* This is the second Material Component lane the user asked
                                for: structured -> runtime JSON. The canonical block above
                                only explains the source-facing comparison. This section
                                says whether the live glossary spell card data is still
                                behind the interpreted structured material note. */}
                            {gate.bucketDetails.materialComponentRuntime && (
                                <div className="mt-2 border-t border-gray-800 pt-2">
                                    <div className="text-gray-500 font-semibold">Material Component Runtime Review</div>
                                    <ul className="mt-1 space-y-1 text-amber-200">
                                        {renderBucketProblem(gate.bucketDetails.materialComponentRuntime.problemStatement)}
                                        {materialComponentRuntimeReviewMeta && (
                                            <li>
                                                - Severity:{' '}
                                                <span className={materialComponentRuntimeReviewMeta.severityTone}>
                                                    {materialComponentRuntimeReviewMeta.severityLabel}
                                                </span>
                                            </li>
                                        )}
                                        <li>- Classification: {gate.bucketDetails.materialComponentRuntime.classification}</li>
                                        <li>- Review verdict: {gate.bucketDetails.materialComponentRuntime.reviewVerdict}</li>
                                        <li>- Explanation: {gate.bucketDetails.materialComponentRuntime.explanation}</li>
                                        <li>- Structured material note: {gate.bucketDetails.materialComponentRuntime.structuredValue || '(none)'}</li>
                                        <li>- Current JSON material note: {gate.bucketDetails.materialComponentRuntime.currentJsonValue || '(none)'}</li>
                                        <li>- Structured value matches runtime JSON exactly: {gate.bucketDetails.materialComponentRuntime.structuredMatchesJson ? 'Yes' : 'No'}</li>
                                        {gate.bucketDetails.materialComponentRuntime.structuredMaterialRequired !== undefined && (
                                            <li>- Structured layer says material is required: {gate.bucketDetails.materialComponentRuntime.structuredMaterialRequired ? 'Yes' : 'No'}</li>
                                        )}
                                        {gate.bucketDetails.materialComponentRuntime.jsonMaterialRequired !== undefined && (
                                            <li>- Runtime JSON says material is required: {gate.bucketDetails.materialComponentRuntime.jsonMaterialRequired ? 'Yes' : 'No'}</li>
                                        )}
                                        {gate.bucketDetails.materialComponentRuntime.structuredDescription && (
                                            <li>- Structured material description: {gate.bucketDetails.materialComponentRuntime.structuredDescription}</li>
                                        )}
                                        {gate.bucketDetails.materialComponentRuntime.jsonDescription && (
                                            <li>- Runtime JSON material description: {gate.bucketDetails.materialComponentRuntime.jsonDescription}</li>
                                        )}
                                        {gate.bucketDetails.materialComponentRuntime.structuredCostGp !== undefined && (
                                            <li>- Structured material cost: {gate.bucketDetails.materialComponentRuntime.structuredCostGp} gp</li>
                                        )}
                                        {gate.bucketDetails.materialComponentRuntime.jsonCostGp !== undefined && (
                                            <li>- Runtime JSON material cost: {gate.bucketDetails.materialComponentRuntime.jsonCostGp} gp</li>
                                        )}
                                        {gate.bucketDetails.materialComponentRuntime.structuredConsumed !== undefined && (
                                            <li>- Structured consumed-state: {gate.bucketDetails.materialComponentRuntime.structuredConsumed ? 'Yes' : 'No'}</li>
                                        )}
                                        {gate.bucketDetails.materialComponentRuntime.jsonConsumed !== undefined && (
                                            <li>- Runtime JSON consumed-state: {gate.bucketDetails.materialComponentRuntime.jsonConsumed ? 'Yes' : 'No'}</li>
                                        )}
                                        {gate.bucketDetails.materialComponentRuntime.descriptionAligned !== undefined && (
                                            <li>- Description aligned with runtime JSON: {gate.bucketDetails.materialComponentRuntime.descriptionAligned ? 'Yes' : 'No'}</li>
                                        )}
                                        {gate.bucketDetails.materialComponentRuntime.costAligned !== undefined && (
                                            <li>- Cost aligned with runtime JSON: {gate.bucketDetails.materialComponentRuntime.costAligned ? 'Yes' : 'No'}</li>
                                        )}
                                        {gate.bucketDetails.materialComponentRuntime.consumedAligned !== undefined && (
                                            <li>- Consumed-state aligned with runtime JSON: {gate.bucketDetails.materialComponentRuntime.consumedAligned ? 'Yes' : 'No'}</li>
                                        )}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Components residue is usually not "the spell forgot a component".
                        It is more often a disagreement between the normalized Aralia
                        header format and the raw canonical component string, especially
                        around footnote markers or alternate-source inline material text.
                        This panel keeps those cases reviewable without implying that the
                        underlying component facts are wrong. */}
                    {gate.bucketDetails?.components && (
                        <div className="mt-2">
                            <div className="text-gray-500 font-semibold">Components Review</div>
                            <ul className="mt-1 space-y-1 text-amber-300">
                                {renderBucketProblem(gate.bucketDetails.components.summary)}
                                <li>- Review verdict: {gate.bucketDetails.components.reviewVerdict}</li>
                                <li>- Subbucket: {gate.bucketDetails.components.classification}</li>
                                <li>- Classification: {gate.bucketDetails.components.classification}</li>
                                <li>- Interpretation: {gate.bucketDetails.components.interpretation}</li>
                                <li>- Structured V/S/M letters: {gate.bucketDetails.components.structuredLetters || '(none)'}</li>
                                <li>- Canonical V/S/M letters: {gate.bucketDetails.components.canonicalLetters || '(none)'}</li>
                                <li>- V/S/M letters still match: {gate.bucketDetails.components.lettersMatch ? 'Yes' : 'No'}</li>
                                <li>- Structured header: {gate.bucketDetails.components.structuredValue || '(none)'}</li>
                                <li>- Canonical display: {gate.bucketDetails.components.canonicalValue || '(none)'}</li>
                                {gate.bucketDetails.components.currentJsonValue && (
                                    <li>- Current spell JSON: {gate.bucketDetails.components.currentJsonValue}</li>
                                )}
                                {gate.bucketDetails.components.materialRequired !== undefined && (
                                    <li>- Material required: {gate.bucketDetails.components.materialRequired ? 'Yes' : 'No'}</li>
                                )}
                                {gate.bucketDetails.components.materialDescription && (
                                    <li>- Material note: {gate.bucketDetails.components.materialDescription}</li>
                                )}
                            </ul>

                            {/* This is the second Components lane the user asked for:
                                canonical -> structured above, structured -> runtime JSON
                                below. The glossary spell card renders from JSON, so this
                                block has to stay separate instead of hiding behind the
                                source-facing review. */}
                            {gate.bucketDetails.componentsRuntime && (
                                <div className="mt-2 border-t border-gray-800 pt-2">
                                    <div className="text-gray-500 font-semibold">Components Runtime Review</div>
                                    <ul className="mt-1 space-y-1 text-amber-200">
                                        {renderBucketProblem(gate.bucketDetails.componentsRuntime.problemStatement)}
                                        {componentsRuntimeReviewMeta && (
                                            <li>
                                                - Severity:{' '}
                                                <span className={componentsRuntimeReviewMeta.severityTone}>
                                                    {componentsRuntimeReviewMeta.severityLabel}
                                                </span>
                                            </li>
                                        )}
                                        <li>- Subbucket: {gate.bucketDetails.componentsRuntime.classification}</li>
                                        <li>- Classification: {gate.bucketDetails.componentsRuntime.classification}</li>
                                        <li>- Review verdict: {gate.bucketDetails.componentsRuntime.reviewVerdict}</li>
                                        <li>- Explanation: {gate.bucketDetails.componentsRuntime.explanation}</li>
                                        <li>- Structured V/S/M letters: {gate.bucketDetails.componentsRuntime.structuredLetters || '(none)'}</li>
                                        <li>- Current JSON V/S/M letters: {gate.bucketDetails.componentsRuntime.jsonLetters || '(none)'}</li>
                                        <li>- V/S/M letters still match runtime JSON: {gate.bucketDetails.componentsRuntime.lettersMatch ? 'Yes' : 'No'}</li>
                                        <li>- Structured components: {gate.bucketDetails.componentsRuntime.structuredValue || '(none)'}</li>
                                        <li>- Current JSON components: {gate.bucketDetails.componentsRuntime.currentJsonValue || '(none)'}</li>
                                        <li>- Structured value matches runtime JSON exactly: {gate.bucketDetails.componentsRuntime.structuredMatchesJson ? 'Yes' : 'No'}</li>
                                        {gate.bucketDetails.componentsRuntime.materialRequired !== undefined && (
                                            <li>- Runtime JSON says material is required: {gate.bucketDetails.componentsRuntime.materialRequired ? 'Yes' : 'No'}</li>
                                        )}
                                        {gate.bucketDetails.componentsRuntime.materialDescription && (
                                            <li>- Runtime JSON material note: {gate.bucketDetails.componentsRuntime.materialDescription}</li>
                                        )}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Casting Time residue is usually about source-display shorthand rather
                        than wrong spell timing. This bucket shows the normalized current
                        timing, the raw canonical label, and the ritual-expanded timing when
                        the spell can be cast as a ritual. That lets the reviewer see whether
                        the mismatch is just "Ritual" or "*" being folded into the source
                        string, or whether there is a real timing disagreement. */}
                    {gate.bucketDetails?.castingTime && (
                        <div className="mt-2">
                            <div className="text-gray-500 font-semibold">Casting Time Review</div>
                            <ul className="mt-1 space-y-1 text-amber-300">
                                {renderBucketProblem(gate.bucketDetails.castingTime.problemStatement)}
                                <li>- Review verdict: {gate.bucketDetails.castingTime.reviewVerdict}</li>
                                <li>- Classification: {gate.bucketDetails.castingTime.classification}</li>
                                <li>- Interpretation: {gate.bucketDetails.castingTime.interpretation}</li>
                                <li>- Structured header: {gate.bucketDetails.castingTime.structuredValue}</li>
                                <li>- Canonical display: {gate.bucketDetails.castingTime.canonicalValue}</li>
                                {formatCurrentCastingTime(spellJsonData) && (
                                    <li>- Current base casting time: {formatCurrentCastingTime(spellJsonData)}</li>
                                )}
                                {gate.bucketDetails.castingTime.structuredContainsBaseTiming !== undefined && (
                                    <li>- Structured header still contains the base timing fact: {gate.bucketDetails.castingTime.structuredContainsBaseTiming ? 'Yes' : 'No'}</li>
                                )}
                                {gate.bucketDetails.castingTime.canonicalContainsBaseTiming !== undefined && (
                                    <li>- Canonical display still contains the base timing fact: {gate.bucketDetails.castingTime.canonicalContainsBaseTiming ? 'Yes' : 'No'}</li>
                                )}
                                {gate.bucketDetails.castingTime.ritual !== undefined && (
                                    <li>- Ritual enabled: {gate.bucketDetails.castingTime.ritual ? 'Yes' : 'No'}</li>
                                )}
                                {gate.bucketDetails.castingTime.ritualCastingTime && (
                                    <li>- Ritual cast time: {gate.bucketDetails.castingTime.ritualCastingTime}</li>
                                )}
                            </ul>

                            {/* The glossary renders the runtime spell JSON, not the
                                structured markdown header. This subsection makes that
                                second comparison phase explicit so the reviewer can see
                                whether the runtime layer is actually behind or whether
                                the structured header is merely less normalized. */}
                            {gate.bucketDetails.castingTime.structuredVsJson && (
                                <div className="mt-2 border-t border-gray-800 pt-2">
                                    <div className="text-gray-500 font-semibold">Structured -&gt; JSON</div>
                                    <ul className="mt-1 space-y-1 text-amber-200">
                                        <li>- What is wrong: {gate.bucketDetails.castingTime.structuredVsJson.problemStatement}</li>
                                        <li>- Review verdict: {gate.bucketDetails.castingTime.structuredVsJson.reviewVerdict}</li>
                                        <li>- Classification: {gate.bucketDetails.castingTime.structuredVsJson.classification}</li>
                                        <li>- Structured header: {gate.bucketDetails.castingTime.structuredVsJson.structuredValue}</li>
                                        <li>- Current JSON base casting time: {gate.bucketDetails.castingTime.structuredVsJson.currentJsonBaseCastingTime || '(unavailable)'}</li>
                                        <li>- Current JSON ritual flag: {gate.bucketDetails.castingTime.structuredVsJson.currentJsonRitual === undefined ? '(unavailable)' : gate.bucketDetails.castingTime.structuredVsJson.currentJsonRitual ? 'true' : 'false'}</li>
                                        {gate.bucketDetails.castingTime.structuredVsJson.currentJsonRitualCastingTime && (
                                            <li>- Current JSON ritual cast time: {gate.bucketDetails.castingTime.structuredVsJson.currentJsonRitualCastingTime}</li>
                                        )}
                                        <li>- Structured header matches runtime JSON: {gate.bucketDetails.castingTime.structuredVsJson.structuredMatchesJson ? 'Yes' : 'No'}</li>
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Duration needs its own review block because the copied canonical
                        snapshot still stores some source-display strings in a flattened
                        form. This panel makes the live JSON breakdown visible so the
                        reviewer can tell "the source says Concentration 1 Minute" apart
                        from "the spell actually stores the wrong duration facts". */}
                    {gate.bucketDetails?.duration && (
                        <div className="mt-2">
                            <div className="text-gray-500 font-semibold">Duration Review</div>
                            <ul className="mt-1 space-y-1 text-amber-300">
                                {renderBucketProblem(gate.bucketDetails.duration.problemStatement)}
                                <li>- Severity: {gate.bucketDetails.duration.severity}</li>
                                <li>- Semantic status: {gate.bucketDetails.duration.semanticStatus}</li>
                                <li>- Classification: {gate.bucketDetails.duration.classification}</li>
                                <li>- Interpretation: {gate.bucketDetails.duration.interpretation}</li>
                                <li>- Recommended action: {gate.bucketDetails.duration.recommendedAction}</li>
                                <li>- Structured header: {gate.bucketDetails.duration.structuredValue}</li>
                                <li>- Canonical display: {gate.bucketDetails.duration.canonicalValue}</li>
                                {gate.bucketDetails.duration.canonicalBreakdown && (
                                    <li>
                                        - Canonical breakdown: concentration={gate.bucketDetails.duration.canonicalBreakdown.concentration ? 'true' : 'false'}
                                        {` | duration=${gate.bucketDetails.duration.canonicalBreakdown.durationText}`}
                                    </li>
                                )}
                                {formatCurrentDuration(spellJsonData) && (
                                    <li>- Current spell JSON: {formatCurrentDuration(spellJsonData)}</li>
                                )}
                                {gate.bucketDetails.duration.structuredBreakdown && (
                                    <li>
                                        - Parsed duration facts: type={gate.bucketDetails.duration.structuredBreakdown.type}
                                        {typeof gate.bucketDetails.duration.structuredBreakdown.value === 'number'
                                            ? ` | value=${gate.bucketDetails.duration.structuredBreakdown.value}`
                                            : ''}
                                        {gate.bucketDetails.duration.structuredBreakdown.unit
                                            ? ` | unit=${gate.bucketDetails.duration.structuredBreakdown.unit}`
                                            : ''}
                                        {` | concentration=${gate.bucketDetails.duration.structuredBreakdown.concentration ? 'true' : 'false'}`}
                                    </li>
                                )}
                            </ul>

                            {/* The canonical duration review above only answers whether
                                the interpreted structured layer still agrees with the
                                copied source snapshot. The glossary spell card renders
                                from runtime spell JSON, so this second block answers
                                the runtime question directly for the selected spell. */}
                            {gate.bucketDetails.durationRuntime && (
                                <div className="mt-2 border-t border-gray-800 pt-2">
                                    <div className="text-gray-500 font-semibold">Structured -&gt; JSON</div>
                                    <ul className="mt-1 space-y-1 text-amber-200">
                                        {renderBucketProblem(gate.bucketDetails.durationRuntime.problemStatement)}
                                        {durationRuntimeReviewMeta && (
                                            <li>
                                                - Severity:{' '}
                                                <span className={durationRuntimeReviewMeta.severityTone}>
                                                    {durationRuntimeReviewMeta.severityLabel}
                                                </span>
                                            </li>
                                        )}
                                        <li>- Classification: {gate.bucketDetails.durationRuntime.classification}</li>
                                        <li>- Review verdict: {gate.bucketDetails.durationRuntime.reviewVerdict}</li>
                                        <li>- Explanation: {gate.bucketDetails.durationRuntime.explanation}</li>
                                        <li>- Structured value: {gate.bucketDetails.durationRuntime.structuredValue || '(none)'}</li>
                                        <li>- Current JSON value: {gate.bucketDetails.durationRuntime.currentJsonValue || '(none)'}</li>
                                        {gate.bucketDetails.durationRuntime.structuredBreakdown && (
                                            <li>
                                                - Parsed structured facts: type={gate.bucketDetails.durationRuntime.structuredBreakdown.type ?? '(unknown)'}
                                                {typeof gate.bucketDetails.durationRuntime.structuredBreakdown.value === 'number'
                                                    ? ` | value=${gate.bucketDetails.durationRuntime.structuredBreakdown.value}`
                                                    : ''}
                                                {gate.bucketDetails.durationRuntime.structuredBreakdown.unit
                                                    ? ` | unit=${gate.bucketDetails.durationRuntime.structuredBreakdown.unit}`
                                                    : ''}
                                                {gate.bucketDetails.durationRuntime.structuredBreakdown.concentration !== undefined
                                                    ? ` | concentration=${gate.bucketDetails.durationRuntime.structuredBreakdown.concentration ? 'true' : 'false'}`
                                                    : ''}
                                            </li>
                                        )}
                                        {gate.bucketDetails.durationRuntime.currentJsonBreakdown && (
                                            <li>
                                                - Parsed runtime facts: type={gate.bucketDetails.durationRuntime.currentJsonBreakdown.type}
                                                {typeof gate.bucketDetails.durationRuntime.currentJsonBreakdown.value === 'number'
                                                    ? ` | value=${gate.bucketDetails.durationRuntime.currentJsonBreakdown.value}`
                                                    : ''}
                                                {gate.bucketDetails.durationRuntime.currentJsonBreakdown.unit
                                                    ? ` | unit=${gate.bucketDetails.durationRuntime.currentJsonBreakdown.unit}`
                                                    : ''}
                                                {` | concentration=${gate.bucketDetails.durationRuntime.currentJsonBreakdown.concentration ? 'true' : 'false'}`}
                                            </li>
                                        )}
                                        <li>- Structured value matches runtime JSON: {gate.bucketDetails.durationRuntime.structuredMatchesJson ? 'Yes' : 'No'}</li>
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Description mismatches are more nuanced than a simple "different text"
                        warning. This bucket tells the reviewer whether the issue is:
                        - a real prose drift problem,
                        - a missing structured description,
                        - or an audit-shape / formatting residue case where the canonical
                          prose likely exists under Rules Text already. */}
                    {gate.bucketDetails?.description && (
                        <div className="mt-2">
                            <div className="text-gray-500 font-semibold">Description Review</div>
                            <ul className="mt-1 space-y-1 text-amber-300">
                                {renderBucketProblem(gate.bucketDetails.description.summary)}
                                {descriptionReviewMeta && (
                                    <>
                                        <li>
                                            - Severity:{' '}
                                            <span className={descriptionReviewMeta.severityTone}>
                                                {descriptionReviewMeta.severityLabel}
                                            </span>
                                        </li>
                                        <li>- Specific problem: {descriptionReviewMeta.problem}</li>
                                        <li>- Suggested review step: {descriptionReviewMeta.nextStep}</li>
                                    </>
                                )}
                                <li>- Classification: {gate.bucketDetails.description.classification}</li>
                                <li>- Interpretation: {gate.bucketDetails.description.interpretation}</li>
                                <li>- Structured excerpt: {gate.bucketDetails.description.structuredValue || '(none)'}</li>
                                <li>- Canonical excerpt: {gate.bucketDetails.description.canonicalValue || '(stored under raw Rules Text / not separately extracted)'}</li>
                            </ul>
                        </div>
                    )}

                    {/* This is the second Description lane the user asked for:
                        structured -> runtime JSON. The spell card renders from
                        spell JSON, so this block must stay separate from the
                        canonical review above instead of being folded into it. */}
                    {gate.bucketDetails?.descriptionRuntime && (
                        <div className="mt-2">
                            <div className="text-gray-500 font-semibold">Description Runtime Review</div>
                            <ul className="mt-1 space-y-1 text-amber-300">
                                {renderBucketProblem(gate.bucketDetails.descriptionRuntime.problemStatement)}
                                {descriptionRuntimeReviewMeta && (
                                    <li>
                                        - Severity:{' '}
                                        <span className={descriptionRuntimeReviewMeta.severityTone}>
                                            {descriptionRuntimeReviewMeta.severityLabel}
                                        </span>
                                    </li>
                                )}
                                <li>- Classification: {gate.bucketDetails.descriptionRuntime.classification}</li>
                                <li>- Review verdict: {gate.bucketDetails.descriptionRuntime.reviewVerdict}</li>
                                <li>- Explanation: {gate.bucketDetails.descriptionRuntime.explanation}</li>
                                <li>- Structured Description: {gate.bucketDetails.descriptionRuntime.structuredValue || '(none)'}</li>
                                <li>- Current JSON Description: {gate.bucketDetails.descriptionRuntime.currentJsonValue || '(none)'}</li>
                            </ul>
                        </div>
                    )}

                    {/* Classes is a source-shape-heavy bucket. The canonical snapshots
                        currently preserve access under raw `Available For` lines rather
                        than a dedicated `Classes` field, so the gate checker needs to
                        show whether the structured header still matches live JSON before
                        anyone mistakes this residue for real base-class drift. */}
                    {gate.bucketDetails?.classes && (
                        <div className="mt-2">
                            <div className="text-gray-500 font-semibold">Classes Review</div>
                            <ul className="mt-1 space-y-1 text-amber-300">
                                {renderBucketProblem(gate.bucketDetails.classes.problemStatement)}
                                <li>- Classification: {gate.bucketDetails.classes.classification}</li>
                                <li>- Review verdict: {gate.bucketDetails.classes.reviewVerdict}</li>
                                <li>- Interpretation: {gate.bucketDetails.classes.interpretation}</li>
                                <li>- Structured header: {gate.bucketDetails.classes.structuredValue || '(none)'}</li>
                                <li>- Canonical field: {gate.bucketDetails.classes.canonicalValue || '(stored under raw Available For / not separately extracted)'}</li>
                                <li>- Structured header matches current JSON: {gate.bucketDetails.classes.structuredMatchesJson ? 'Yes' : 'No'}</li>
                                <li>- Current spell JSON base classes: {gate.bucketDetails.classes.currentClasses.join(', ') || '(none)'}</li>
                                {gate.bucketDetails.classes.canonicalUsesAvailableFor && (
                                    <li>- Canonical storage shape: class access is currently preserved under the snapshot&apos;s `Available For` list.</li>
                                )}
                                {gate.bucketDetails.classes.canonicalBaseClasses.length > 0 && (
                                    <li>- Comparable canonical base classes: {gate.bucketDetails.classes.canonicalBaseClasses.join(', ')}</li>
                                )}
                                {gate.bucketDetails.classes.canonicalOnlyEntries.length > 0 && (
                                    <li>- Canonical-only entries: {gate.bucketDetails.classes.canonicalOnlyEntries.join(', ')}</li>
                                )}
                                {gate.bucketDetails.classes.structuredOnlyEntries.length > 0 && (
                                    <li>- Structured-only entries: {gate.bucketDetails.classes.structuredOnlyEntries.join(', ')}</li>
                                )}
                            </ul>
                        </div>
                    )}

                    {/* Higher Levels is a special bucket because the structured markdown
                        and live spell JSON often still agree with each other, while the
                        canonical snapshot stores the scaling text inline under Rules Text
                        or prefixes it with a source heading. This panel makes that exact
                        distinction visible so reviewers can tell "display-shape residue"
                        apart from a real scaling-text disagreement. */}
                    {gate.bucketDetails?.higherLevels && (
                        <div className="mt-2">
                            <div className="text-gray-500 font-semibold">Higher Levels Review</div>
                            <ul className="mt-1 space-y-1 text-amber-300">
                                {renderBucketProblem(gate.bucketDetails.higherLevels.summary)}
                                <li className={gate.bucketDetails.higherLevels.severityLabel === 'Review Needed' ? 'text-red-300' : 'text-sky-300'}>
                                    - Severity: {gate.bucketDetails.higherLevels.severityLabel}
                                </li>
                                <li>- Classification: {gate.bucketDetails.higherLevels.classification}</li>
                                <li>- Subbucket: {gate.bucketDetails.higherLevels.subbucket}</li>
                                <li>- Reviewer conclusion: {gate.bucketDetails.higherLevels.reviewerConclusion}</li>
                                <li>- Recommended next step: {gate.bucketDetails.higherLevels.nextStep}</li>
                                <li>- Interpretation: {gate.bucketDetails.higherLevels.interpretation}</li>
                                <li>- Structured header: {gate.bucketDetails.higherLevels.structuredValue || '(none)'}</li>
                                <li>- Canonical field: {gate.bucketDetails.higherLevels.canonicalValue || '(stored inline under raw Rules Text / not separately extracted)'}</li>
                                <li>- Structured header matches current JSON: {gate.bucketDetails.higherLevels.structuredMatchesJson ? 'Yes' : 'No'}</li>
                                <li>- Structured text matches canonical after normalization: {gate.bucketDetails.higherLevels.normalizedValuesMatch ? 'Yes' : 'No'}</li>
                                {formatCurrentHigherLevels(spellJsonData) && (
                                    <li>- Current spell JSON: {formatCurrentHigherLevels(spellJsonData)}</li>
                                )}
                            </ul>

                            {/* This is the second Higher Levels lane the gate checker
                                was missing. The canonical review above can still be
                                informative even when the glossary spell card is
                                actually stale, because the card renders from runtime
                                JSON rather than the structured markdown header. */}
                            {gate.bucketDetails.higherLevelsRuntime && (
                                <div className="mt-2 border-t border-gray-800 pt-2">
                                    <div className="text-gray-500 font-semibold">Higher Levels Runtime Review</div>
                                    <ul className="mt-1 space-y-1 text-amber-200">
                                        {renderBucketProblem(gate.bucketDetails.higherLevelsRuntime.problemStatement)}
                                        {higherLevelsRuntimeReviewMeta && (
                                            <li>
                                                - Severity:{' '}
                                                <span className={higherLevelsRuntimeReviewMeta.severityTone}>
                                                    {higherLevelsRuntimeReviewMeta.severityLabel}
                                                </span>
                                            </li>
                                        )}
                                        <li>- Classification: {gate.bucketDetails.higherLevelsRuntime.classification}</li>
                                        <li>- Subbucket: {gate.bucketDetails.higherLevelsRuntime.subbucket}</li>
                                        <li>- Review verdict: {gate.bucketDetails.higherLevelsRuntime.reviewVerdict}</li>
                                        <li>- Explanation: {gate.bucketDetails.higherLevelsRuntime.explanation}</li>
                                        <li>- Structured Higher Levels: {gate.bucketDetails.higherLevelsRuntime.structuredValue || '(none)'}</li>
                                        <li>- Current JSON Higher Levels: {gate.bucketDetails.higherLevelsRuntime.currentJsonValue || '(none)'}</li>
                                        <li>- Structured value matches runtime JSON exactly: {gate.bucketDetails.higherLevelsRuntime.structuredMatchesJson ? 'Yes' : 'No'}</li>
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Subclass access is the current policy-heavy bucket. Canonical
                        snapshots preserve raw Available For subclass/domain lines,
                        while the normalized spell JSON intentionally drops repeated-base
                        subclass entries that the validator treats as redundant. This
                        panel makes that distinction visible so the reviewer can tell
                        "policy normalization" apart from real missing access data. */}
                    {gate.bucketDetails?.subClasses && (
                        <div className="mt-2">
                            <div className="text-gray-500 font-semibold">Sub-Classes Review</div>
                            <ul className="mt-1 space-y-1 text-amber-300">
                                {renderBucketProblem(gate.bucketDetails.subClasses.summary)}
                                <li>- Classification: {gate.bucketDetails.subClasses.classification}</li>
                                <li>- Interpretation: {gate.bucketDetails.subClasses.interpretation}</li>
                                <li>- Structured header: {gate.bucketDetails.subClasses.structuredValue || '(none)'}</li>
                                <li>- Canonical snapshot: {gate.bucketDetails.subClasses.canonicalValue || '(none)'}</li>
                                <li>- Current base classes: {gate.bucketDetails.subClasses.currentClasses.join(', ') || '(none)'}</li>
                                <li>- Current JSON sub-classes: {gate.bucketDetails.subClasses.currentSubClasses.join(', ') || '(none)'}</li>
                                <li>- Verification state: {gate.bucketDetails.subClasses.verificationState || '(unknown)'}</li>
                                {gate.bucketDetails.subClasses.repeatedBaseEntries.length > 0 && (
                                    <li>- Repeated-base canonical entries: {gate.bucketDetails.subClasses.repeatedBaseEntries.join(', ')}</li>
                                )}
                                {gate.bucketDetails.subClasses.canonicalOnlyEntries.length > 0 && (
                                    <li>- Canonical-only entries: {gate.bucketDetails.subClasses.canonicalOnlyEntries.join(', ')}</li>
                                )}
                                {gate.bucketDetails.subClasses.structuredOnlyEntries.length > 0 && (
                                    <li>- Structured-only entries: {gate.bucketDetails.subClasses.structuredOnlyEntries.join(', ')}</li>
                                )}
                                {gate.bucketDetails.subClasses.malformedEntries.length > 0 && (
                                    <li>- Malformed entries: {gate.bucketDetails.subClasses.malformedEntries.join(', ')}</li>
                                )}
                            </ul>

                            {/* This is the second Sub-Classes lane the gate checker was
                                missing. The canonical review above explains whether the
                                interpreted structured layer still matches the copied source
                                surface. This runtime review answers the app-layer question
                                directly: does the glossary-facing spell JSON still carry
                                the same normalized subclass access as the structured layer? */}
                            {gate.bucketDetails.subClassesRuntime && (
                                <div className="mt-2 border-t border-gray-800 pt-2">
                                    <div className="text-gray-500 font-semibold">Sub-Classes Runtime Review</div>
                                    <ul className="mt-1 space-y-1 text-amber-200">
                                        {renderBucketProblem(gate.bucketDetails.subClassesRuntime.problemStatement)}
                                        <li>- Classification: {gate.bucketDetails.subClassesRuntime.classification}</li>
                                        <li>- Review verdict: {gate.bucketDetails.subClassesRuntime.reviewVerdict}</li>
                                        <li>- Explanation: {gate.bucketDetails.subClassesRuntime.explanation}</li>
                                        <li>- Structured Sub-Classes: {gate.bucketDetails.subClassesRuntime.structuredValue || '(none)'}</li>
                                        <li>- Current JSON value: {gate.bucketDetails.subClassesRuntime.currentJsonValue || '(none)'}</li>
                                        <li>- Current base classes: {gate.bucketDetails.subClassesRuntime.currentBaseClasses.join(', ') || '(none)'}</li>
                                        <li>- Current JSON sub-classes: {gate.bucketDetails.subClassesRuntime.currentJsonSubClasses.join(', ') || '(none)'}</li>
                                        <li>- Verification state: {gate.bucketDetails.subClassesRuntime.verificationState || '(unknown)'}</li>
                                        <li>- Structured value matches runtime JSON exactly: {gate.bucketDetails.subClassesRuntime.structuredMatchesJson ? 'Yes' : 'No'}</li>
                                        {gate.bucketDetails.subClassesRuntime.structuredOnlyEntries.length > 0 && (
                                            <li>- Structured-only entries: {gate.bucketDetails.subClassesRuntime.structuredOnlyEntries.join(', ')}</li>
                                        )}
                                        {gate.bucketDetails.subClassesRuntime.jsonOnlyEntries.length > 0 && (
                                            <li>- JSON-only entries: {gate.bucketDetails.subClassesRuntime.jsonOnlyEntries.join(', ')}</li>
                                        )}
                                        {gate.bucketDetails.subClassesRuntime.redundantJsonEntries.length > 0 && (
                                            <li>- Redundant JSON entries: {gate.bucketDetails.subClassesRuntime.redundantJsonEntries.join(', ')}</li>
                                        )}
                                        {gate.bucketDetails.subClassesRuntime.malformedStructuredEntries.length > 0 && (
                                            <li>- Malformed structured entries: {gate.bucketDetails.subClassesRuntime.malformedStructuredEntries.join(', ')}</li>
                                        )}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {canonicalListingUrl && (
                        <div className="mt-2">
                            <div className="text-gray-500 font-semibold">Canonical Listing</div>
                            <a
                                href={canonicalListingUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 inline-block text-sky-300 hover:text-sky-200 underline break-all"
                            >
                                {canonicalListingUrl}
                            </a>
                        </div>
                    )}
            {/* Keep the older fidelity audit visible as a separate section. That work still answers
                engine-coverage questions that are distinct from schema validity and canonical drift. */}
        </>
    );
};

export default SpellGateBucketSections;
