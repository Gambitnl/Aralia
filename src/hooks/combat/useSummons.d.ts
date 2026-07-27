/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 01/07/2026, 22:47:09
 * Dependents: None (Orphan)
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { CombatCharacter } from '../../types/combat';
import { Spell, SummoningEffect, FamiliarContract } from '../../types/spells';
import { SummonTemplate } from '../../data/summonTemplates';
/**
 * This hook keeps a local list of summoned actors for UI/helper flows.
 *
 * The active spell-casting runtime currently creates combat summons through
 * `SummoningCommand`, not through this hook. We keep this hook aligned with the
 * command metadata shape because older tests still reference it, but it is not
 * the authoritative summon owner and production spell casting should not route
 * through it unless a future parity slice deliberately changes that contract.
 *
 * Called by: helper tests and any future preview-only UI that needs local summon
 * state without claiming ownership of production spell-created actors.
 * Depends on: summon templates and CombatCharacter metadata.
 */
interface UseSummonsProps {
    onSummonAdded?: (summon: CombatCharacter) => void;
    onSummonRemoved?: (summonId: string) => void;
}
interface ResolvedSummonEffect extends Partial<SummoningEffect> {
    duration?: SummoningEffect['duration'];
    familiarContract?: FamiliarContract;
    statBlock?: SummonTemplate;
    formOptions?: string[];
    specialActions?: {
        name: string;
        description: string;
        cost?: string;
        damage?: {
            dice: string;
            type: string;
        };
    }[];
    entityType?: string;
    dismissAction?: boolean;
}
export declare const useSummons: ({ onSummonAdded, onSummonRemoved }?: UseSummonsProps) => {
    summonedEntities: CombatCharacter[];
    addSummon: (caster: CombatCharacter, spell: Spell, summonEffect: ResolvedSummonEffect, position: {
        x: number;
        y: number;
    }, formIndex?: number) => CombatCharacter;
    removeSummon: (summonId: string) => void;
};
export {};
