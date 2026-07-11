import React from 'react';
import type { GateResult } from '../useSpellGateChecks';
import type { SpellData } from '../../SpellCardTemplate';
import { renderBucketProblem } from './sectionShared';

// Higher-level scaling text already lives on the runtime spell JSON. We surface
// it in the gate checker so reviewers can see whether the structured header is
// still aligned with the live game-system data even when the canonical snapshot
// chose to keep the same scaling text inline under Rules Text.

function formatCurrentHigherLevels(spell: SpellData | null): string | null {
    if (!spell?.higherLevels) return null;

    const normalized = spell.higherLevels.trim();
    return normalized.length > 0 ? normalized : null;
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

export const HigherLevelsSection: React.FC<{ gate: GateResult; spellJsonData: SpellData | null }> = ({ gate, spellJsonData }) => {
    const higherLevelsRuntimeReviewMeta = gate.bucketDetails?.higherLevelsRuntime
        ? getHigherLevelsRuntimeReviewMeta(gate.bucketDetails.higherLevelsRuntime.classification)
        : null;
    return (
        <>
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
        </>
    );
};
