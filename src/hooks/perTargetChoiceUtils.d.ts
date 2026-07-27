/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/06/2026, 18:57:22
 * Dependents: hooks/useAbilitySystem.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { Spell } from '../types/spells';
import { CombatCharacter } from '../types/combat';
export type PerTargetChoicesByTargetId = Record<string, string>;
export type SpellWithPerTargetChoices = Spell & {
    perTargetChoicesByTargetId?: PerTargetChoicesByTargetId;
    perTargetChoicePromptTargetName?: string;
};
export declare const addPerTargetChoicesToSpell: (spell: Spell, perTargetChoicesByTargetId: PerTargetChoicesByTargetId) => SpellWithPerTargetChoices;
export declare const getPerTargetChoicesFromSpell: (spell: Spell) => PerTargetChoicesByTargetId | undefined;
export declare const createPerTargetChoicePromptSpell: (spell: Spell, target: CombatCharacter) => SpellWithPerTargetChoices;
export declare const requestPerTargetChoices: (spell: Spell, targets: CombatCharacter[], requestInput: (spell: Spell, onConfirm: (input: string) => void) => void, onComplete: (choicesByTargetId: PerTargetChoicesByTargetId) => void) => void;
