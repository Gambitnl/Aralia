import React from 'react';
import type { GateResult } from '../useSpellGateChecks';
import type { SpellData } from '../../SpellCardTemplate';
import { renderBucketProblem } from './sectionShared';

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

export const DurationSection: React.FC<{ gate: GateResult; spellJsonData: SpellData | null }> = ({ gate, spellJsonData }) => {
    const durationRuntimeReviewMeta = gate.bucketDetails?.durationRuntime
        ? getDurationRuntimeReviewMeta(gate.bucketDetails.durationRuntime.classification)
        : null;
    return (
        <>
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
        </>
    );
};
