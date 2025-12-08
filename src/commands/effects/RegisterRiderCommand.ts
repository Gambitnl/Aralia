import { BaseEffectCommand } from '../base/BaseEffectCommand';
import { CommandContext } from '../base/SpellCommand';
import { SpellEffect, isDamageEffect } from '@/types/spells';
import { CombatState, ActiveRider } from '@/types/combat';
import { AttackRiderSystem } from '../../systems/combat/AttackRiderSystem';

export class RegisterRiderCommand extends BaseEffectCommand {
    private riderSystem: AttackRiderSystem;

    constructor(
        effect: SpellEffect,
        context: CommandContext
    ) {
        super(effect, context);
        this.riderSystem = new AttackRiderSystem();
    }

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

    private getSpecificTargetId(): string | undefined {
        // If the spell targets a specific enemy (Hex/Hunter's Mark), we return that target ID.
        if (this.context.targets.length === 1 && this.context.targets[0].id !== this.context.caster.id) {
            return this.context.targets[0].id;
        }
        return undefined;
    }
}
