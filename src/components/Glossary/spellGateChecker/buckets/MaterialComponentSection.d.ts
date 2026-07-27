import React from 'react';
import type { GateResult } from '../useSpellGateChecks';
import type { SpellData } from '../../SpellCardTemplate';
export declare const MaterialComponentSection: React.FC<{
    gate: GateResult;
    spellJsonData: SpellData | null;
}>;
