/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 21/07/2026, 15:11:40
 * Dependents: commands/factory/SpellCommandFactory.ts
 * Imports: 20 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/commands/effects/ReactiveEffectCommand.ts
 * Command for handling effects that trigger based on future events or require sustaining.
 */
import { BaseEffectCommand } from '../base/BaseEffectCommand';
import { CommandContext } from '../base/SpellCommand';
import { CombatState } from '../../types/combat';
import { ReactiveEffect } from '../../types/spells';
import { MovementEventEmitter } from '../../systems/combat/MovementEventEmitter';
import { AttackEventEmitter } from '../../systems/combat/AttackEventEmitter';
import { CombatEventEmitter } from '../../systems/events/CombatEvents';
/**
 * Event buses used by a reactive command.
 *
 * Normal game commands use the shared buses below. Tests and isolated combat
 * simulations can provide fresh buses so listeners cannot leak between runs.
 */
export interface ReactiveEventEmitters {
    movement: Pick<MovementEventEmitter, 'onMovement' | 'offMovement'>;
    attack: Pick<AttackEventEmitter, 'onPreAttack' | 'offPreAttack'>;
    combat: Pick<CombatEventEmitter, 'on' | 'off'>;
}
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
export declare class ReactiveEffectCommand extends BaseEffectCommand<ReactiveEffect> {
    private readonly eventEmitters;
    private registeredListeners;
    constructor(effect: ReactiveEffect, context: CommandContext, eventEmitters?: ReactiveEventEmitters);
    execute(state: CombatState): CombatState;
    /**
     * Registers the actual event listeners with the system event emitters (Movement, Attack, Combat).
     * These listeners will fire `executeReactiveEffect` when conditions are met.
     *
     * @param triggerId - The unique ID of the trigger being registered.
     */
    private registerEventListeners;
    /**
     * Registers the spell with the SustainActionSystem if it requires ongoing concentration/actions.
     *
     * @param triggerId - The unique ID of the trigger associated with the sustain requirement.
     */
    private registerSustainRequirement;
    /**
     * The callback executed when a registered event fires.
     *
     * @param event - The event data (Movement, Attack, or Cast).
     */
    private executeReactiveEffect;
    /**
     * Builds the normal command object for a delegated payload effect.
     *
     * This intentionally supports the already-owned sibling effect command set
     * and leaves nested reactive effects or rider registration for later scoped
     * work. That keeps this T2 slice focused on delegated payload execution.
     */
    private createDelegatedCommand;
    /**
     * Cleanup method to remove registered listeners when effect expires or is removed.
     * Prevents memory leaks and zombie triggers.
     */
    cleanup(): void;
    private getDurationInRounds;
    get description(): string;
}
