/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/06/2026, 01:14:48
 * Dependents: commands/effects/ReactiveEffectCommand.ts, test/combatEmitters.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file implements the event emitter for all attack-related actions in combat.
 *
 * It allows registering event listeners that can run BEFORE an attack (to potentially cancel
 * or redirect it, e.g., Sanctuary, Shield) or AFTER an attack (to trigger side-effects or logging).
 * It is structured as a singleton so that any part of the combat engine can register or emit events
 * on the same central bus.
 *
 * Called by: useActionExecutor, ReactiveEffectCommand, and various combat rule validators.
 * Depends on: None.
 */
export interface AttackEvent {
    attackerId: string;
    targetId: string;
    attackType: 'weapon' | 'spell' | 'unarmed';
    weaponType?: 'melee' | 'ranged';
    isCancelled: boolean;
    redirectTargetId?: string;
}
type AttackListener = (event: AttackEvent) => void | Promise<void>;
export declare class AttackEventEmitter {
    private listeners;
    private preAttackListeners;
    /**
     * Register a listener that gets called BEFORE an attack occurs
     * Listeners can cancel the attack or redirect it
     */
    onPreAttack(listener: AttackListener): void;
    /**
     * Register a listener that gets called AFTER an attack occurs
     */
    onAttack(listener: AttackListener): void;
    /**
     * Remove a pre-attack listener
     */
    offPreAttack(listener: AttackListener): void;
    /**
     * Remove a post-attack listener
     */
    offAttack(listener: AttackListener): void;
    /**
     * Emit a pre-attack event. Call this when a creature attempts to attack.
     * Returns the event after all pre-attack listeners have processed it.
     * The attack should be cancelled if event.isCancelled is true, or redirected
     * to event.redirectTargetId if set.
     */
    emitPreAttack(attackerId: string, targetId: string, attackType: 'weapon' | 'spell' | 'unarmed', weaponType?: 'melee' | 'ranged'): Promise<AttackEvent>;
    /**
     * Emit a post-attack event. Call this after an attack has occurred (whether it hit or missed).
     */
    emitAttack(attackerId: string, targetId: string, attackType: 'weapon' | 'spell' | 'unarmed', weaponType?: 'melee' | 'ranged'): Promise<void>;
    private static instance;
    /**
     * Get the active singleton instance.
     */
    static getInstance(): AttackEventEmitter;
    /**
     * Set the current singleton instance. Useful for mocking/isolating tests.
     */
    static setInstance(instance: AttackEventEmitter | null): void;
    /**
     * Create a completely fresh instance of AttackEventEmitter.
     * Useful for isolating events in unit tests.
     */
    static createFresh(): AttackEventEmitter;
}
export declare const attackEvents: AttackEventEmitter;
export {};
