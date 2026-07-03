// @dependencies-start
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
// @dependencies-end

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

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface AttackEvent {
    attackerId: string;
    targetId: string;
    attackType: 'weapon' | 'spell' | 'unarmed';
    weaponType?: 'melee' | 'ranged';
    isCancelled: boolean;
    redirectTargetId?: string; // For spells like sanctuary that can redirect attacks
}

type AttackListener = (event: AttackEvent) => void | Promise<void>;

export class AttackEventEmitter {
    private listeners: AttackListener[] = [];
    private preAttackListeners: AttackListener[] = [];

    /**
     * Register a listener that gets called BEFORE an attack occurs
     * Listeners can cancel the attack or redirect it
     */
    onPreAttack(listener: AttackListener): void {
        this.preAttackListeners.push(listener);
    }

    /**
     * Register a listener that gets called AFTER an attack occurs
     */
    onAttack(listener: AttackListener): void {
        this.listeners.push(listener);
    }

    /**
     * Remove a pre-attack listener
     */
    offPreAttack(listener: AttackListener): void {
        this.preAttackListeners = this.preAttackListeners.filter(l => l !== listener);
    }

    /**
     * Remove a post-attack listener
     */
    offAttack(listener: AttackListener): void {
        this.listeners = this.listeners.filter(l => l !== listener);
    }

    /**
     * Emit a pre-attack event. Call this when a creature attempts to attack.
     * Returns the event after all pre-attack listeners have processed it.
     * The attack should be cancelled if event.isCancelled is true, or redirected
     * to event.redirectTargetId if set.
     */
    async emitPreAttack(
        attackerId: string,
        targetId: string,
        attackType: 'weapon' | 'spell' | 'unarmed',
        weaponType?: 'melee' | 'ranged'
    ): Promise<AttackEvent> {
        const event: AttackEvent = {
            attackerId,
            targetId,
            attackType,
            weaponType,
            isCancelled: false
        };

        // Call all pre-attack listeners
        for (const listener of this.preAttackListeners) {
            await listener(event);
            // Continue processing even if cancelled - all listeners should have a chance to respond
        }

        return event;
    }

    /**
     * Emit a post-attack event. Call this after an attack has occurred (whether it hit or missed).
     */
    async emitAttack(
        attackerId: string,
        targetId: string,
        attackType: 'weapon' | 'spell' | 'unarmed',
        weaponType?: 'melee' | 'ranged'
    ): Promise<void> {
        const event: AttackEvent = {
            attackerId,
            targetId,
            attackType,
            weaponType,
            isCancelled: false
        };

        // Call all post-attack listeners
        for (const listener of this.listeners) {
            await listener(event);
        }
    }

    // ============================================================================
    // Singleton Instance and Test Isolation Controls
    // ============================================================================

    // The shared single instance of the emitter.
    private static instance: AttackEventEmitter;

    /**
     * Get the active singleton instance.
     */
    static getInstance(): AttackEventEmitter {
        if (!AttackEventEmitter.instance) {
            AttackEventEmitter.instance = new AttackEventEmitter();
        }
        return AttackEventEmitter.instance;
    }

    /**
     * Set the current singleton instance. Useful for mocking/isolating tests.
     */
    static setInstance(instance: AttackEventEmitter | null): void {
        AttackEventEmitter.instance = instance as AttackEventEmitter;
    }

    /**
     * Create a completely fresh instance of AttackEventEmitter.
     * Useful for isolating events in unit tests.
     */
    static createFresh(): AttackEventEmitter {
        return new AttackEventEmitter();
    }
}

export const attackEvents = AttackEventEmitter.getInstance();







