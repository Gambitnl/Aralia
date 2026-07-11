import React from 'react';
import type { GateResult } from '../useSpellGateChecks';
import { renderBucketProblem } from './sectionShared';

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

export const DescriptionSection: React.FC<{ gate: GateResult }> = ({ gate }) => {
    const descriptionReviewMeta = gate.bucketDetails?.description
        ? getDescriptionReviewMeta(gate.bucketDetails.description.classification)
        : null;
    const descriptionRuntimeReviewMeta = gate.bucketDetails?.descriptionRuntime
        ? getDescriptionRuntimeReviewMeta(gate.bucketDetails.descriptionRuntime.classification)
        : null;
    return (
        <>
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
        </>
    );
};
