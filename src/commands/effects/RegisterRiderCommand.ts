/**
 * @file src/commands/effects/RegisterRiderCommand.ts
 * Command for registering effects that trigger on future attacks ("Riders").
 */
import { BaseEffectCommand } from '../base/BaseEffectCommand';
import { CommandContext } from '../base/SpellCommand';
import { SpellEffect, isDamageEffect } from '@/types/spells';
import { CombatState, ActiveRider } from '@/types/combat';
import { AttackRiderSystem } from '../../systems/combat/AttackRiderSystem';

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
export class RegisterRiderCommand extends BaseEffectCommand {
    private riderSystem: AttackRiderSystem;

    constructor(
        effect: SpellEffect,
        context: CommandContext
    ) {
        super(effect, context);
        this.riderSystem = new AttackRiderSystem();
    }

    /**
     * Executes the command to register the rider.
     *
     * Validates that the effect is a damage effect (currently the only supported rider type),
     * creates an {@link ActiveRider} object, and updates the combat state.
     *
     * @param state - The current combat state.
     * @returns The updated combat state with the new rider registered.
     */
    execute(state: CombatState): CombatState {
        if (!isDamageEffect(this.effect)) {
            // Warning: Rider registered for non-damage effect. 
            // For now we only support Damage Riders properly.
            // If we want to support generic effects trigger on hit, we'd need to expand logic.
            return state;
        }

        // Create the rider object
        const rider: ActiveRider = {
            id: `rider-${this.context.spellId}-${Date.now()}`,
            spellId: this.context.spellId,
            casterId: this.context.caster.id,
            sourceName: this.context.spellName,
            targetId: this.getSpecificTargetId(),
            effect: this.effect,
            consumption: this.effect.trigger.consumption || 'unlimited',
            attackFilter: this.effect.trigger.attackFilter || {},
            usedThisTurn: false,
            duration: {
                type: 'minutes',
                value: 1 // Default duration, ideally should come from context/spell
            }
        };

        const newState = this.riderSystem.registerRider(state, rider);

        return this.addLogEntry(newState, {
            type: 'status',
            message: `${this.context.caster.name} gains rider effect from ${this.context.spellName}`,
            characterId: this.context.caster.id,
            data: { rider }
        });
    }

    get description(): string {
        return `Register rider from ${this.context.spellName}`;
    }

    /**
     * Determines if the rider is locked to a specific target.
     *
     * Spells like *Hex* or *Hunter's Mark* only trigger against the marked target.
     * Spells like *Divine Favor* trigger against any target.
     *
     * @returns The ID of the specific target if applicable, otherwise undefined.
     */
    private getSpecificTargetId(): string | undefined {
        // If the spell targets a specific enemy (Hex/Hunter's Mark), we return that target ID.
        if (this.context.targets.length === 1 && this.context.targets[0].id !== this.context.caster.id) {
            return this.context.targets[0].id;
        }
        return undefined;
    }
}
