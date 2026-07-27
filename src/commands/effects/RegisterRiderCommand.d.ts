/**
 * @file src/commands/effects/RegisterRiderCommand.ts
 * Command for registering effects that trigger on future attacks ("Riders").
 */
import { BaseEffectCommand } from '../base/BaseEffectCommand';
import { CommandContext } from '../base/SpellCommand';
import { SpellEffect } from '@/types/spells';
import { CombatState } from '@/types/combat';
/**
 * Command that registers a "Rider" effect on a character.
 *
 * A "Rider" is an effect that adds benefits (usually extra damage) to future attacks.
 * Common examples include *Hex*, *Hunter's Mark*, and *Divine Favor*.
 *
 * **Execution Timing:**
 * - The command executes **immediately** to register the rider in the state.
 * - The actual effect (e.g., +1d6 Necrotic) is triggered **later** when the character attacks,
 *   processed by the {@link AttackRiderSystem}.
 *
 * **System Interaction:**
 * - Uses `AttackRiderSystem` to register the new rider.
 * - Adds an `ActiveRider` entry to the combat state.
 *
 * @example
 * // Registers 1d6 Necrotic damage on hits against a specific target (Hex)
 * new RegisterRiderCommand(hexEffect, context).execute(state);
 */
export declare class RegisterRiderCommand extends BaseEffectCommand {
    private riderSystem;
    constructor(effect: SpellEffect, context: CommandContext);
    /**
     * Executes the command to register the rider.
     *
     * Creates an {@link ActiveRider} object and updates the combat state.
     *
     * Earlier versions only accepted damage riders. Smite-style spells also
     * need status and attack-roll payloads to wait for the same triggering hit,
     * so this command now stores the full spell effect and lets the attack
     * runtime decide which executable command can consume it.
     *
     * @param state - The current combat state.
     * @returns The updated combat state with the new rider registered.
     */
    execute(state: CombatState): CombatState;
    get description(): string;
    /**
     * Determines if the rider is locked to a specific target.
     *
     * Spells like *Hex* or *Hunter's Mark* only trigger against the marked target.
     * Spells like *Divine Favor* trigger against any target.
     *
     * @returns The ID of the specific target if applicable, otherwise undefined.
     */
    private getSpecificTargetId;
}
