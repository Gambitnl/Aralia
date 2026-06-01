// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/06/2026, 01:14:58
 * Dependents: commands/effects/ReactiveEffectCommand.ts, test/combatEmitters.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file implements the event emitter for all creature movement in combat.
 *
 * It allows registering event listeners that can run BEFORE movement (to potentially cancel
 * it, e.g., Sentinel feat, grappling, difficult terrain limits) or AFTER movement (to trigger
 * reactions like Opportunity Attacks). It tracks the distance moved and distinguishes between
 * willing and forced movement.
 *
 * Called by: useActionExecutor, useGridMovement, and various combat rule validators.
 * Depends on: Combat types from @/types/combat.
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

import { Position } from '../../types/combat';

export interface MovementEvent {
    creatureId: string;
    from: Position;
    to: Position;
    movementType: 'willing' | 'forced';
    distance: number;
    isCancelled: boolean;
}

type MovementListener = (event: MovementEvent) => void | Promise<void>;

export class MovementEventEmitter {
    private listeners: MovementListener[] = [];
    private preMovementListeners: MovementListener[] = [];

    /**
     * Register a listener that gets called BEFORE movement occurs
     * Listeners can cancel movement by setting event.isCancelled = true
     */
    onPreMovement(listener: MovementListener): void {
        this.preMovementListeners.push(listener);
    }

    /**
     * Register a listener that gets called AFTER movement occurs
     */
    onMovement(listener: MovementListener): void {
        this.listeners.push(listener);
    }

    /**
     * Remove a pre-movement listener
     */
    offPreMovement(listener: MovementListener): void {
        this.preMovementListeners = this.preMovementListeners.filter(l => l !== listener);
    }

    /**
     * Remove a post-movement listener
     */
    offMovement(listener: MovementListener): void {
        this.listeners = this.listeners.filter(l => l !== listener);
    }

    /**
     * Emit a movement event. Call this when a creature attempts to move.
     * Returns the event after all pre-movement listeners have processed it.
     */
    async emitPreMovement(
        creatureId: string,
        from: Position,
        to: Position,
        movementType: 'willing' | 'forced'
    ): Promise<MovementEvent> {
        const distance = Math.sqrt(
            Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2)
        );

        const event: MovementEvent = {
            creatureId,
            from,
            to,
            movementType,
            distance,
            isCancelled: false
        };

        // Call all pre-movement listeners
        for (const listener of this.preMovementListeners) {
            await listener(event);
            if (event.isCancelled) break; // Stop processing if movement is cancelled
        }

        return event;
    }

    /**
     * Emit a post-movement event. Call this after movement has successfully occurred.
     */
    async emitMovement(
        creatureId: string,
        from: Position,
        to: Position,
        movementType: 'willing' | 'forced'
    ): Promise<void> {
        const distance = Math.sqrt(
            Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2)
        );

        const event: MovementEvent = {
            creatureId,
            from,
            to,
            movementType,
            distance,
            isCancelled: false
        };

        // Call all post-movement listeners
        for (const listener of this.listeners) {
            await listener(event);
        }
    }

    // ============================================================================
    // Singleton Instance and Test Isolation Controls
    // ============================================================================

    // The shared single instance of the emitter.
    private static instance: MovementEventEmitter;

    /**
     * Get the active singleton instance.
     */
    static getInstance(): MovementEventEmitter {
        if (!MovementEventEmitter.instance) {
            MovementEventEmitter.instance = new MovementEventEmitter();
        }
        return MovementEventEmitter.instance;
    }

    /**
     * Set the current singleton instance. Useful for mocking/isolating tests.
     */
    static setInstance(instance: MovementEventEmitter | null): void {
        MovementEventEmitter.instance = instance as MovementEventEmitter;
    }

    /**
     * Create a completely fresh instance of MovementEventEmitter.
     * Useful for isolating events in unit tests.
     */
    static createFresh(): MovementEventEmitter {
        return new MovementEventEmitter();
    }
}

export const movementEvents = MovementEventEmitter.getInstance();














