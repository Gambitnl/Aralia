/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 21/07/2026, 14:58:22
 * Dependents: commands/effects/DamageCommand.ts, commands/factory/AbilityCommandFactory.ts, commands/factory/SpellCommandFactory.ts, hooks/combat/useActionExecutor.ts, hooks/combat/useTurnManager.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file enforces structured taunt rules such as Compelled Duel.
 *
 * A taunt lives on the compelled target's status effect. These helpers keep
 * attack rolls, willing movement and early-end events on that same contract,
 * without restricting forced movement or teaching combat AI new strategy.
 */
import type { CombatCharacter, Position, StatusEffect } from '@/types/combat';
import type { TauntBreakEvent } from '@/types/spells';
export interface TauntBreakRecord {
    casterId: string;
    targetId: string;
    spellId?: string;
    spellName: string;
    event: TauntBreakEvent;
}
export interface TauntBreakResult {
    characters: CombatCharacter[];
    breaks: TauntBreakRecord[];
}
type TauntEventContext = {
    event: 'caster_attacks_other';
    casterId: string;
    targetIds: string[];
} | {
    event: 'caster_casts_spell_on_other_enemy';
    casterId: string;
    targetIds: string[];
} | {
    event: 'caster_ally_damages_target';
    casterId: string;
    targetId: string;
} | {
    event: 'caster_ends_turn_outside_leash';
    casterId: string;
};
/** Returns true when the compelled creature attacks anyone except its caster. */
export declare const hasTauntAttackDisadvantage: (attacker: CombatCharacter, targetId: string) => boolean;
/**
 * Checks only voluntary move actions. Forced-movement commands do not call
 * this helper, so pushes and pulls remain allowed by design.
 */
export declare const validateTauntWillingMove: (character: CombatCharacter, destination: Position, characters: CombatCharacter[]) => {
    allowed: boolean;
    status?: StatusEffect;
    caster?: CombatCharacter;
};
/**
 * Ends matching taunts and their concentration owner in one immutable update.
 * All status IDs owned by that concentration record are removed, preserving
 * the existing concentration contract rather than creating a second ledger.
 */
export declare const breakTauntsForEvent: (characters: CombatCharacter[], context: TauntEventContext) => TauntBreakResult;
export {};
