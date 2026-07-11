import React from 'react';
import type { GlossaryEntry } from '../../../../types';
import type { GateResult } from '../useSpellGateChecks';
import type { SpellData } from '../../SpellCardTemplate';
import { RangeAreaSection } from './RangeAreaSection';
import { MaterialComponentSection } from './MaterialComponentSection';
import { ComponentsSection } from './ComponentsSection';
import { CastingTimeSection } from './CastingTimeSection';
import { DurationSection } from './DurationSection';
import { DescriptionSection } from './DescriptionSection';
import { ClassesSection } from './ClassesSection';
import { HigherLevelsSection } from './HigherLevelsSection';
import { SubClassesSection } from './SubClassesSection';

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
    return (
        <>
            <RangeAreaSection gate={gate} spellJsonData={spellJsonData} />
            <MaterialComponentSection gate={gate} spellJsonData={spellJsonData} />
            <ComponentsSection gate={gate} spellJsonData={spellJsonData} />
            <CastingTimeSection gate={gate} spellJsonData={spellJsonData} />
            <DurationSection gate={gate} spellJsonData={spellJsonData} />
            <DescriptionSection gate={gate} />
            <ClassesSection gate={gate} />
            <HigherLevelsSection gate={gate} spellJsonData={spellJsonData} />
            <SubClassesSection gate={gate} />
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
