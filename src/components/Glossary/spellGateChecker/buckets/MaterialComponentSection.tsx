import React from 'react';
import type { GateResult } from '../useSpellGateChecks';
import type { SpellData } from '../../SpellCardTemplate';
import { renderBucketProblem } from './sectionShared';

// Material Component is narrower than the broader Components line. This helper
// keeps the live spell-card-facing material facts visible so the reviewer can
// compare the raw material note bucket against what the current glossary spell
// card actually knows how to render.

function formatCurrentMaterialComponent(spell: SpellData | null): string | null {
    if (!spell?.components?.material) return null;

    return `material=true | description=${spell.components.materialDescription || '(none)'}`;
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

export const MaterialComponentSection: React.FC<{ gate: GateResult; spellJsonData: SpellData | null }> = ({ gate, spellJsonData }) => {
    const materialComponentRuntimeReviewMeta = gate.bucketDetails?.materialComponentRuntime
        ? getMaterialComponentRuntimeReviewMeta(gate.bucketDetails.materialComponentRuntime.classification)
        : null;
    return (
        <>
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
        </>
    );
};
