import React from 'react';
import type { GateResult } from '../useSpellGateChecks';
import { renderBucketProblem } from './sectionShared';

export const SubClassesSection: React.FC<{ gate: GateResult }> = ({ gate }) => {
    return (
        <>
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
        </>
    );
};
