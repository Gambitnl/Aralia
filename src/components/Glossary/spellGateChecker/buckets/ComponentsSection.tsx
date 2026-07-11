import React from 'react';
import type { GateResult } from '../useSpellGateChecks';
import type { SpellData } from '../../SpellCardTemplate';
import { renderBucketProblem } from './sectionShared';

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

export const ComponentsSection: React.FC<{ gate: GateResult; spellJsonData: SpellData | null }> = ({ gate }) => {
    const componentsRuntimeReviewMeta = gate.bucketDetails?.componentsRuntime
        ? getComponentsRuntimeReviewMeta(gate.bucketDetails.componentsRuntime.classification)
        : null;
    return (
        <>
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
        </>
    );
};
