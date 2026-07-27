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
export declare class MovementEventEmitter {
    private listeners;
    private preMovementListeners;
    /**
     * Register a listener that gets called BEFORE movement occurs
     * Listeners can cancel movement by setting event.isCancelled = true
     */
    onPreMovement(listener: MovementListener): void;
    /**
     * Register a listener that gets called AFTER movement occurs
     */
    onMovement(listener: MovementListener): void;
    /**
     * Remove a pre-movement listener
     */
    offPreMovement(listener: MovementListener): void;
    /**
     * Remove a post-movement listener
     */
    offMovement(listener: MovementListener): void;
    /**
     * Emit a movement event. Call this when a creature attempts to move.
     * Returns the event after all pre-movement listeners have processed it.
     */
    emitPreMovement(creatureId: string, from: Position, to: Position, movementType: 'willing' | 'forced'): Promise<MovementEvent>;
    /**
     * Emit a post-movement event. Call this after movement has successfully occurred.
     */
    emitMovement(creatureId: string, from: Position, to: Position, movementType: 'willing' | 'forced'): Promise<void>;
    private static instance;
    /**
     * Get the active singleton instance.
     */
    static getInstance(): MovementEventEmitter;
    /**
     * Set the current singleton instance. Useful for mocking/isolating tests.
     */
    static setInstance(instance: MovementEventEmitter | null): void;
    /**
     * Create a completely fresh instance of MovementEventEmitter.
     * Useful for isolating events in unit tests.
     */
    static createFresh(): MovementEventEmitter;
}
export declare const movementEvents: MovementEventEmitter;
export {};
