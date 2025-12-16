/**
 * @file src/commands/effects/ReactiveEffectCommand.ts
 * Command for handling effects that trigger based on future events or require sustaining.
 */
import { BaseEffectCommand } from '../base/BaseEffectCommand';
import { CombatState } from '../../types/combat';
import { generateId } from '../../utils/combatUtils';
import { movementEvents, MovementEventEmitter, MovementEvent } from '../../systems/combat/MovementEventEmitter';
import { attackEvents, AttackEventEmitter, AttackEvent } from '../../systems/combat/AttackEventEmitter';
import { combatEvents, CastEvent } from '../../systems/events/CombatEvents';
import { sustainActionSystem, SustainedSpell } from '../../systems/combat/SustainActionSystem';
import { logger } from '../../utils/logger';

type ReactiveEvent = MovementEvent | AttackEvent | CastEvent;

/**
 * Command that registers reactive triggers or sustain requirements for a spell.
 *
 * Unlike standard commands (like DamageCommand) which apply their effects immediately upon execution,
 * ReactiveEffectCommand sets up listeners for future events or registers the spell as needing
 * sustain actions in subsequent turns.
 *
 * Use cases:
 * - **Reactions:** Spells like *Shield* or *Hellish Rebuke* that trigger off specific events (attacks, damage).
 * - **Sustained Effects:** Spells like *Witch Bolt* or *Call Lightning* that allow/require actions in future turns.
 * - **Traps/Wards:** Effects like *Glyph of Warding* that wait for a trigger condition.
 */
export class ReactiveEffectCommand extends BaseEffectCommand {
    private registeredListeners: (() => void)[] = []; // Store cleanup functions

    /**
     * Executes the command by registering the appropriate triggers in the combat state
     * and setting up event listeners for the reactive effect.
     *
     * @param state - The current combat state.
     * @returns The updated combat state with new reactive triggers.
     */
    execute(state: CombatState): CombatState {
        const trigger = this.effect.trigger;
        const newTriggers = [...(state.reactiveTriggers || [])];

        const durationRounds = this.getDurationInRounds();

        // Create a new trigger entry
        const triggerId = generateId();
        newTriggers.push({
            id: triggerId,
            sourceEffect: this.effect,
            casterId: this.context.caster.id,
            targetId: this.context.targets[0]?.id, // Bind to specific target
            createdTurn: state.turnState.currentTurn,
            expiresAtRound: durationRounds ? state.turnState.currentTurn + durationRounds : undefined
        });

        // Register event listeners based on trigger type
        this.registerEventListeners(triggerId);

        // Handle sustain requirements
        if (trigger.type === 'on_caster_action' && trigger.sustainCost) {
            this.registerSustainRequirement(triggerId);
        }

        // We must ensure reactiveTriggers exists since we just added it to the interface
        // but existing runtime state might not have it initialized if derived from older logic
        const nextState = {
            ...state,
            reactiveTriggers: newTriggers
        };

        return this.addLogEntry(nextState, {
            type: 'status',
            message: `${this.context.spellName} awaits trigger: ${trigger.type}`,
            characterId: this.context.caster.id,
            targetIds: this.context.targets.map(t => t.id)
        });
    }

    /**
     * Registers the actual event listeners with the system event emitters (Movement, Attack, Combat).
     * These listeners will fire `executeReactiveEffect` when conditions are met.
     *
     * @param triggerId - The unique ID of the trigger being registered.
     */
    private registerEventListeners(triggerId: string): void {
        const trigger = this.effect.trigger;
        const casterId = this.context.caster.id;
        const targetId = this.context.targets[0]?.id;

        switch (trigger.type) {
            case 'on_target_move':
                if (targetId) {
                    const listener = async (event: MovementEvent) => {
                        // Check if movement matches our criteria
                        if (event.creatureId !== targetId) return;

                        const movementType = trigger.movementType || 'any';
                        if (movementType !== 'any' && event.movementType !== movementType) return;

                        // Trigger the effect
                        await this.executeReactiveEffect(event);
                    };

                    movementEvents.onMovement(listener);
                    this.registeredListeners.push(() => movementEvents.offMovement(listener));
                }
                break;

            case 'on_target_attack':
                if (targetId) {
                    const listener = async (event: AttackEvent) => {
                        // Check if this is an attack against our target
                        if (event.targetId !== targetId) return;

                        // Trigger the effect (save vs lose attack for compelled duel)
                        await this.executeReactiveEffect(event);
                    };

                    attackEvents.onPreAttack(listener);
                    this.registeredListeners.push(() => attackEvents.offPreAttack(listener));
                }
                break;

            case 'on_target_cast':
                if (targetId) {
                    const listener = (event: CastEvent) => {
                        if (event.casterId !== targetId) return;
                        this.executeReactiveEffect(event);
                    };

                    combatEvents.on('unit_cast', listener);
                    this.registeredListeners.push(() => combatEvents.off('unit_cast', listener));
                }
                break;

            case 'on_caster_action':
                // This is handled by sustain system, but we might want to listen for specific actions
                break;
        }
    }

    /**
     * Registers the spell with the SustainActionSystem if it requires ongoing concentration/actions.
     *
     * @param triggerId - The unique ID of the trigger associated with the sustain requirement.
     */
    private registerSustainRequirement(triggerId: string): void {
        if (!this.effect.trigger.sustainCost) return;

        const sustainedSpell: SustainedSpell = {
            spellId: this.context.spellId,
            casterId: this.context.caster.id,
            targetIds: this.context.targets.map(t => t.id),
            sustainCost: this.effect.trigger.sustainCost,
            effectIds: [triggerId], // This effect needs sustaining
            sustainedThisTurn: false
        };

        sustainActionSystem.registerSustainedSpell(sustainedSpell);
    }

    /**
     * The callback executed when a registered event fires.
     *
     * @param event - The event data (Movement, Attack, or Cast).
     */
    private async executeReactiveEffect(event: ReactiveEvent): Promise<void> {
        // This would execute the actual effect when triggered
        // For now, we'll emit a log message - in a full implementation,
        // this would create and execute the appropriate command
        logger.info(`Reactive effect triggered: ${this.effect.type} for ${this.context.spellName}`, { event });
    }

    /**
     * Cleanup method to remove registered listeners when effect expires or is removed.
     * Prevents memory leaks and zombie triggers.
     */
    cleanup(): void {
        this.registeredListeners.forEach(cleanup => cleanup());
        this.registeredListeners = [];

        // Remove from sustain system if applicable
        if (this.effect.trigger.type === 'on_caster_action') {
            sustainActionSystem.removeSustainedSpell(this.context.caster.id, this.context.spellId);
        }
    }

    private getDurationInRounds(): number | undefined {
        // 1. Try to get duration from the effect itself (e.g. MovementTriggerDebuff might have it)
        const effectAny = this.effect as any;
        let duration = effectAny.duration;

        // TODO: Use the originating spell duration for sustain/reactive windows (e.g., Witch Bolt) when effect duration is absent.
        // 2. Fallback to spell duration from context if not on effect
        // triggers like 'on_caster_action' for sustain rely on the spell's duration
        if (!duration && this.context.effectDuration) {
            duration = this.context.effectDuration;
        }

        if (!duration) return undefined;

        // Handle EffectDuration structure { type: 'rounds' | 'minutes', value: number }
        if (duration.type === 'rounds') return duration.value || 1;
        if (duration.type === 'minutes') return (duration.value || 1) * 10;

        // Handle Legacy/Spell Duration structure { unit: 'round' | 'minute', value: number }
        if (duration.unit === 'round') return duration.value || 1;
        if (duration.unit === 'minute') return (duration.value || 1) * 10;

        return undefined;
    }

    get description(): string {
        return `Reactive trigger: ${this.effect.trigger.type}`;
    }
}
