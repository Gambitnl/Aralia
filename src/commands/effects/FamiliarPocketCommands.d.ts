import { BaseEffectCommand } from '../base/BaseEffectCommand';
import { CommandContext } from '../base/SpellCommand';
import { CombatState, Position } from '../../types/combat';
/**
 * These commands move a Find Familiar-style summon between the combat map and a
 * recoverable pocket state.
 *
 * The active summon runtime still creates familiars through SummoningCommand.
 * This file does not add player UI buttons yet. It provides the missing runtime
 * state transition so a future UI/action slice can dismiss a familiar without
 * destroying the bond, then restore that same familiar later.
 *
 * Called by: future familiar dismissal/reappearance action wiring.
 * Depends on: CombatState.pocketedSummons and summonMetadata identity fields.
 */
export interface FamiliarPocketOptions {
    familiarId?: string;
    position?: Position;
}
export declare class DismissFamiliarToPocketCommand extends BaseEffectCommand {
    protected context: CommandContext;
    private options;
    constructor(context: CommandContext, options?: FamiliarPocketOptions);
    execute(state: CombatState): CombatState;
    get description(): string;
    private findOnMapFamiliar;
    private isFamiliar;
}
export declare class RecallFamiliarFromPocketCommand extends BaseEffectCommand {
    protected context: CommandContext;
    private options;
    constructor(context: CommandContext, options?: FamiliarPocketOptions);
    execute(state: CombatState): CombatState;
    get description(): string;
    private findPocketedFamiliar;
    private isFamiliar;
    private findRecallPosition;
    private isOccupied;
    private isWithinBounds;
}
