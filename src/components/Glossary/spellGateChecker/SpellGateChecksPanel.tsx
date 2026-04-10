// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/04/2026, 17:44:48
 * Dependents: components/Glossary/spellGateChecker/index.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file SpellGateChecksPanel.tsx
 * This file renders the overview shell for the glossary spell gate checker.
 *
 * The previous single-file panel had grown into one very large renderer that
 * mixed summary status, spell-truth overview, and bucket-by-bucket forensic
 * details in one place. This file now owns only the high-level "what failed?"
 * surface, while SpellGateBucketSections.tsx owns the deeper review families.
 *
 * Called by: GlossaryEntryPanel.tsx
 * Depends on: GateResult data from useSpellGateChecks.ts and SpellGateBucketSections.tsx
 */

import React from 'react';
import type { GlossaryEntry } from '../../../types';
import type { GateResult } from './useSpellGateChecks';
import type { SpellData } from '../SpellCardTemplate';
import { buildSpecificIssueList, getPrimaryIssue } from './spellGateIssueSummary';
import { SpellGateBucketSections } from './SpellGateBucketSections';

// ============================================================================
// Overview helpers
// ============================================================================
// The detailed bucket review lives in a sibling file now. This file keeps only
// the compact summary that answers three quick questions:
// - what is wrong
// - what failed at the checklist level
// - what broader spell-truth surfaces are currently flagging the spell
// ============================================================================

function buildChecklist(gate: GateResult) {
    return [
        { label: 'Manifest path under correct level', ok: gate.checklist.manifestPathOk },
        { label: 'Spell JSON exists', ok: gate.checklist.spellJsonExists },
        { label: 'Spell JSON passes schema', ok: gate.checklist.spellJsonValid },
        { label: 'No known behavior gaps', ok: gate.checklist.noKnownGaps },
        { label: 'Class/subclass access has been verified', ok: gate.checklist.classAccessVerified },
        { label: 'Canonical top-level review is aligned', ok: gate.checklist.canonicalTopLevelAligned },
        { label: 'Structured markdown matches runtime spell JSON', ok: gate.checklist.structuredJsonAligned },
    ].filter((check): check is { label: string; ok: boolean } => typeof check.ok === 'boolean');
}

export const SpellGateChecksPanel: React.FC<{
    selectedEntry: GlossaryEntry;
    gateResults: Record<string, GateResult>;
    spellJsonData: SpellData | null;
}> = ({ selectedEntry, gateResults, spellJsonData }) => {
    const gate = gateResults[selectedEntry.id];
    if (!gate) return null;

    const primaryIssue = getPrimaryIssue(gate);
    const specificIssues = buildSpecificIssueList(gate);
    const checks = buildChecklist(gate);

    return (
        <div className="mt-4 p-3 border border-gray-700 rounded bg-gray-900/70 text-sm">
            <div className="font-semibold mb-2 text-gray-200">Spell Gate Checks: {selectedEntry.title}</div>

            {primaryIssue && (
                <div className="mb-2 rounded border border-amber-700/60 bg-amber-950/40 px-2 py-1 text-xs text-amber-200">
                    <span className="font-semibold">What is wrong:</span> {primaryIssue}
                </div>
            )}

            <ul className="space-y-1 text-gray-300">
                {checks.map((check) => (
                    <li key={check.label} className="flex items-center gap-2">
                        <span className={`inline-block w-4 text-center ${check.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                            {check.ok ? '\u2713' : '\u2715'}
                        </span>
                        <span>{check.label}</span>
                    </li>
                ))}

                {gate.status === 'gap' && (
                    <li className="text-amber-300 mt-1">
                        Marked as a gap: This spell has engine-level limitations or spell-truth work still pending.
                    </li>
                )}
            </ul>

            {specificIssues.length > 0 && (
                <div className="mt-2 text-xs border-t border-gray-700 pt-2">
                    <div className="text-gray-400 uppercase tracking-tighter font-bold">Specific Issues Right Now</div>
                    <ul className="mt-1 space-y-1 text-amber-200">
                        {specificIssues.slice(0, 12).map((issue) => (
                            <li key={issue}>- {issue}</li>
                        ))}
                    </ul>
                    {specificIssues.length > 12 && (
                        <div className="mt-1 text-gray-500 italic">
                            +{specificIssues.length - 12} more issue note(s)
                        </div>
                    )}
                </div>
            )}

            {gate.schemaIssues && gate.schemaIssues.length > 0 && (
                <div className="mt-2 text-xs border-t border-gray-700 pt-2">
                    <div className="text-gray-400 uppercase tracking-tighter font-bold">Schema Issues</div>
                    <ul className="mt-1 space-y-1 text-red-300">
                        {gate.schemaIssues.slice(0, 8).map((issue) => (
                            <li key={issue}>- {issue}</li>
                        ))}
                    </ul>
                    {gate.schemaIssues.length > 8 && (
                        <div className="mt-1 text-gray-500 italic">
                            +{gate.schemaIssues.length - 8} more schema issue(s)
                        </div>
                    )}
                </div>
            )}

            {gate.spellTruth && (
                <div className="mt-2 text-xs border-t border-gray-700 pt-2">
                    <div className="text-gray-400 uppercase tracking-tighter font-bold">Spell Truth Review</div>

                    {gate.spellTruth.localFlags.length > 0 && (
                        <div className="mt-1">
                            <div className="text-gray-500 font-semibold">Local Data Flags</div>
                            <ul className="mt-1 space-y-1 text-amber-300">
                                {gate.spellTruth.localFlags.map((flag) => (
                                    <li key={flag}>- {flag}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {gate.spellTruth.canonicalReviewState && (
                        <div className="mt-2">
                            <div className="text-gray-500 font-semibold">Canonical Review State</div>
                            <div className="mt-1 text-gray-300">{gate.spellTruth.canonicalReviewState}</div>
                        </div>
                    )}

                    {gate.spellTruth.structuredJsonReviewState && (
                        <div className="mt-2">
                            <div className="text-gray-500 font-semibold">Structured -&gt; JSON Review State</div>
                            <div className="mt-1 text-gray-300">{gate.spellTruth.structuredJsonReviewState}</div>
                        </div>
                    )}

                    {gate.spellTruth.canonicalMismatchFields.length > 0 && (
                        <div className="mt-2">
                            <div className="text-gray-500 font-semibold">Canonical Drift Fields</div>
                            <div className="mt-1 text-amber-300">{gate.spellTruth.canonicalMismatchFields.join(', ')}</div>
                        </div>
                    )}

                    {gate.spellTruth.canonicalMismatchSummaries.length > 0 && (
                        <div className="mt-2">
                            <div className="text-gray-500 font-semibold">Canonical Drift Samples</div>
                            <ul className="mt-1 space-y-1 text-amber-300">
                                {gate.spellTruth.canonicalMismatchSummaries.slice(0, 5).map((summary) => (
                                    <li key={summary}>- {summary}</li>
                                ))}
                            </ul>
                            {gate.spellTruth.canonicalMismatchSummaries.length > 5 && (
                                <div className="mt-1 text-gray-500 italic">
                                    +{gate.spellTruth.canonicalMismatchSummaries.length - 5} more canonical note(s)
                                </div>
                            )}
                        </div>
                    )}

                    {gate.spellTruth.structuredJsonMismatchFields.length > 0 && (
                        <div className="mt-2">
                            <div className="text-gray-500 font-semibold">Structured -&gt; JSON Drift Fields</div>
                            <div className="mt-1 text-amber-300">{gate.spellTruth.structuredJsonMismatchFields.join(', ')}</div>
                        </div>
                    )}

                    {gate.spellTruth.structuredJsonMismatchSummaries.length > 0 && (
                        <div className="mt-2">
                            <div className="text-gray-500 font-semibold">Structured -&gt; JSON Drift Samples</div>
                            <ul className="mt-1 space-y-1 text-amber-300">
                                {gate.spellTruth.structuredJsonMismatchSummaries.slice(0, 5).map((summary) => (
                                    <li key={summary}>- {summary}</li>
                                ))}
                            </ul>
                            {gate.spellTruth.structuredJsonMismatchSummaries.length > 5 && (
                                <div className="mt-1 text-gray-500 italic">
                                    +{gate.spellTruth.structuredJsonMismatchSummaries.length - 5} more structured/json note(s)
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <SpellGateBucketSections
                selectedEntry={selectedEntry}
                gateResults={gateResults}
                spellJsonData={spellJsonData}
            />

            {gate.gapAnalysis && (
                <div className="mt-2 text-xs border-t border-gray-700 pt-2">
                    <div className="text-gray-400 uppercase tracking-tighter font-bold">Audit Status</div>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            gate.gapAnalysis.state === 'analyzed_clean'
                                ? 'bg-emerald-900 text-emerald-300'
                                : gate.gapAnalysis.state === 'analyzed_with_gaps'
                                    ? 'bg-amber-900 text-amber-300'
                                    : 'bg-gray-700 text-gray-400'
                        }`}>
                            {gate.gapAnalysis.state.replace('_', ' ')}
                        </span>
                        <span className="text-gray-500 italic">Last Audit: {gate.gapAnalysis.lastAuditDate || 'Never'}</span>
                    </div>
                    {gate.gapAnalysis.notes && (
                        <p className="mt-1.5 text-gray-400 line-clamp-3 hover:line-clamp-none transition-all">{gate.gapAnalysis.notes}</p>
                    )}
                </div>
            )}

            {gate.status === 'fail' && gate.reasons.length > 0 && (
                <div className="mt-2 text-xs border-t border-gray-700 pt-2 text-red-300">
                    Issues: {gate.reasons.join('; ')}
                </div>
            )}
        </div>
    );
};

export default SpellGateChecksPanel;
