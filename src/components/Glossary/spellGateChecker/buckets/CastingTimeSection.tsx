import React from 'react';
import type { GateResult } from '../useSpellGateChecks';
import type { SpellData } from '../../SpellCardTemplate';
import { renderBucketProblem } from './sectionShared';

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

export const CastingTimeSection: React.FC<{ gate: GateResult; spellJsonData: SpellData | null }> = ({ gate, spellJsonData }) => {
    return (
        <>
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
        </>
    );
};
