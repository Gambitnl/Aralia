import React from 'react';
import type { GlossaryEntry } from '../../../../types';
import type { GateResult } from '../useSpellGateChecks';
import type { SpellData } from '../../SpellCardTemplate';
export declare const SpellGateBucketSections: React.FC<{
    selectedEntry: GlossaryEntry;
    gateResults: Record<string, GateResult>;
    spellJsonData: SpellData | null;
}>;
export default SpellGateBucketSections;
