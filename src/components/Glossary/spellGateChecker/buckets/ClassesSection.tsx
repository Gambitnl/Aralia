import React from 'react';
import type { GateResult } from '../useSpellGateChecks';
import { renderBucketProblem } from './sectionShared';

export const ClassesSection: React.FC<{ gate: GateResult }> = ({ gate }) => {
    return (
        <>
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
        </>
    );
};
