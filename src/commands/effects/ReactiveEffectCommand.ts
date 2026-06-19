// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/06/2026, 23:50:22
 * Dependents: commands/factory/SpellCommandFactory.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/commands/effects/ReactiveEffectCommand.ts
 * Command for handling effects that trigger based on future events or require sustaining.
 */
import { BaseEffectCommand } from '../base/BaseEffectCommand';
import { CommandContext, SpellCommand } from '../base/SpellCommand';
import { CommandExecutor } from '../base/CommandExecutor';
import { CombatState } from '../../types/combat';
import { SpellEffect } from '../../types/spells';
import { generateId } from '../../utils/combatUtils';
import { movementEvents, MovementEvent } from '../../systems/combat/MovementEventEmitter';
import { attackEvents, AttackEvent } from '../../systems/combat/AttackEventEmitter';
import { combatEvents, CastEvent } from '../../systems/events/CombatEvents';
import { sustainActionSystem, SustainedSpell } from '../../systems/combat/SustainActionSystem';
import { logger } from '../../utils/logger';
import { DamageCommand } from './DamageCommand';
import { HealingCommand } from './HealingCommand';
import { StatusConditionCommand } from './StatusConditionCommand';
import { MovementCommand } from './MovementCommand';
import { AttackRollModifierCommand } from './AttackRollModifierCommand';
import { SummoningCommand } from './SummoningCommand';
import { TerrainCommand } from './TerrainCommand';
import { UtilityCommand } from './UtilityCommand';
import { DefensiveCommand } from './DefensiveCommand';

type ReactiveEvent = MovementEvent | AttackEvent | CastEvent;
type DurationLike = { type?: string; unit?: string; value?: number };

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

    execute(state: CombatState): CombatState {
        const trigger = this.effect.trigger;
        const durationRounds = this.getDurationInRounds();
        // Preserve legacy state that may not initialize reactiveTriggers.
        const newTriggers = [...(state.reactiveTriggers ?? [])];

        const triggerId = generateId();
        newTriggers.push({
            id: triggerId,
            sourceEffect: this.effect,
            sourceSpellId: this.context.spellId,
            sourceSpellName: this.context.spellName,
            casterId: this.context.caster.id,
            targetId: this.context.targets[0]?.id, // Bind to specific target
            createdTurn: state.turnState.currentTurn,
            expiresAtRound: durationRounds ? state.turnState.currentTurn + durationRounds : undefined
        });

        // Register event listeners based on trigger type.
        this.registerEventListeners(triggerId);

        // Handle sustain requirements.
        if (trigger.type === 'on_caster_action' && trigger.sustainCost) {
            this.registerSustainRequirement(triggerId);
        }

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
    private registerEventListeners(_triggerId: string): void {
        const trigger = this.effect.trigger;
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

        const sustainCost: { actionType: 'action' | 'bonus_action' | 'reaction'; optional: boolean } =
            typeof this.effect.trigger.sustainCost === 'number'
                ? { actionType: 'action', optional: false }
                : this.effect.trigger.sustainCost;

        const sustainedSpell: SustainedSpell = {
            spellId: this.context.spellId,
            casterId: this.context.caster.id,
            targetIds: this.context.targets.map(t => t.id),
            sustainCost,
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
        const delegatedPayload = this.context.delegatedReactivePayload;

        // Older reactive registrations do not yet carry a delegated payload.
        // Preserve their existing behavior: report the trigger and leave any
        // inline executor behavior untouched instead of inventing missing data.
        if (!delegatedPayload) {
            logger.info(`Reactive effect triggered: ${this.effect.type} for ${this.context.spellName}`, { event });
            return;
        }

        const currentState = delegatedPayload.getState();
        const delegatedTargets = delegatedPayload.resolveTargets?.({
            event,
            state: currentState,
            commandContext: this.context
        }) ?? this.context.targets;
        const delegatedContext: CommandContext = {
            ...this.context,
            targets: delegatedTargets
        };

        // Rehydrate the payload as the same concrete effect commands used for
        // immediate spell execution, then run that list through CommandExecutor
        // so reactive effects share logging, ordering, and failure behavior.
        const commands = delegatedPayload.effects
            .map(effect => this.createDelegatedCommand(effect, delegatedContext))
            .filter((command): command is SpellCommand => command !== null);

        if (commands.length === 0) {
            logger.warn(`Reactive effect for ${this.context.spellName} had no supported delegated commands`, {
                event,
                effectTypes: delegatedPayload.effects.map(effect => effect.type)
            });
            return;
        }

        const result = await CommandExecutor.execute(commands, currentState);
        if (result.success) {
            delegatedPayload.commitState(result.finalState);
            logger.info(`Reactive effect triggered: ${this.effect.type} for ${this.context.spellName}`, { event });
            return;
        }

        // Failed delegated commands leave the old live state in place. The
        // executor has already logged the command-level failure, so this warning
        // only ties the failure back to the waiting reactive spell.
        logger.warn(`Reactive effect for ${this.context.spellName} failed during delegated execution`, {
            event,
            error: result.error?.message
        });
    }

    /**
     * Builds the normal command object for a delegated payload effect.
     *
     * This intentionally supports the already-owned sibling effect command set
     * and leaves nested reactive effects or rider registration for later scoped
     * work. That keeps this T2 slice focused on delegated payload execution.
     */
    private createDelegatedCommand(effect: SpellEffect, context: CommandContext): SpellCommand | null {
        switch (effect.type) {
            case 'DAMAGE':
                return new DamageCommand(effect, context);
            case 'HEALING':
                return new HealingCommand(effect, context);
            case 'STATUS_CONDITION':
                return new StatusConditionCommand(effect, context);
            case 'ATTACK_ROLL_MODIFIER':
                return new AttackRollModifierCommand(effect, context);
            case 'MOVEMENT':
                return new MovementCommand(effect, context);
            case 'SUMMONING':
                return new SummoningCommand(effect, context);
            case 'TERRAIN':
                return new TerrainCommand(effect, context);
            case 'UTILITY':
                return new UtilityCommand(effect, context);
            case 'DEFENSIVE':
                return new DefensiveCommand(effect, context);
            default:
                return null;
        }
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
        const effectDuration = (this.effect as { duration?: DurationLike }).duration;
        let duration = effectDuration;

        // 2. Fallback to spell duration from context if not on effect
        // triggers like 'on_caster_action' for sustain rely on the spell's duration
        if (!duration && this.context.effectDuration) {
            duration = this.context.effectDuration as DurationLike;
        }

        if (!duration) {
            return undefined;
        }

        // Handle EffectDuration structure { type: 'rounds' | 'minutes', value: number }
        if (duration.type === 'rounds') return duration.value ?? 1;
        if (duration.type === 'minutes') return (duration.value ?? 1) * 10;

        // Handle Legacy/Spell Duration structure { unit: 'round' | 'minute', value: number }
        if (duration.unit === 'round') return duration.value ?? 1;
        if (duration.unit === 'minute') return (duration.value ?? 1) * 10;

        // Handle "special" or other types by returning undefined (infinite/conditional)
        return undefined;
    }

    get description(): string {
        return `Reactive trigger: ${this.effect.trigger.type}`;
    }
}
