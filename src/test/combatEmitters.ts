/**
 * This file provides helper utilities to isolate combat system singletons during unit tests.
 *
 * It defines wrapper functions that create fresh instances of combat event emitters and
 * trackers, swap them in as the active singletons for the duration of a test block, and then
 * clean up and restore the original instances afterward. This prevents test state leakage.
 *
 * Called by: Combat system unit tests (e.g. AttackEventEmitter.test.ts).
 * Depends on: AttackEventEmitter, MovementEventEmitter, SustainActionSystem.
 */

// ============================================================================
// Imports
// ============================================================================

import { AttackEventEmitter } from '../systems/combat/AttackEventEmitter';
import { MovementEventEmitter } from '../systems/combat/MovementEventEmitter';
import { SustainActionSystem } from '../systems/combat/SustainActionSystem';

// ============================================================================
// Isolation Helper Functions
// ============================================================================

/**
 * Runs a function with a isolated, fresh instance of AttackEventEmitter.
 * Restores the original active instance after the function completes.
 */
export function isolateAttackEmitter<T>(fn: (emitter: AttackEventEmitter) => T): T {
    // 1. Create a fresh instance.
    const fresh = AttackEventEmitter.createFresh();
    // 2. Backup the original singleton.
    const original = AttackEventEmitter.getInstance();
    // 3. Swap in the fresh instance.
    AttackEventEmitter.setInstance(fresh);
    
    try {
        // 4. Run the test block.
        return fn(fresh);
    } finally {
        // 5. Restore the original singleton to keep other tests unaffected.
        AttackEventEmitter.setInstance(original);
    }
}

/**
 * Runs a function with a isolated, fresh instance of MovementEventEmitter.
 * Restores the original active instance after the function completes.
 */
export function isolateMovementEmitter<T>(fn: (emitter: MovementEventEmitter) => T): T {
    // 1. Create a fresh instance.
    const fresh = MovementEventEmitter.createFresh();
    // 2. Backup the original singleton.
    const original = MovementEventEmitter.getInstance();
    // 3. Swap in the fresh instance.
    MovementEventEmitter.setInstance(fresh);
    
    try {
        // 4. Run the test block.
        return fn(fresh);
    } finally {
        // 5. Restore the original singleton to keep other tests unaffected.
        MovementEventEmitter.setInstance(original);
    }
}

/**
 * Runs a function with a isolated, fresh instance of SustainActionSystem.
 * Restores the original active instance after the function completes.
 */
export function isolateSustainSystem<T>(fn: (system: SustainActionSystem) => T): T {
    // 1. Create a fresh instance.
    const fresh = SustainActionSystem.createFresh();
    // 2. Backup the original singleton.
    const original = SustainActionSystem.getInstance();
    // 3. Swap in the fresh instance.
    SustainActionSystem.setInstance(fresh);
    
    try {
        // 4. Run the test block.
        return fn(fresh);
    } finally {
        // 5. Restore the original singleton to keep other tests unaffected.
        SustainActionSystem.setInstance(original);
    }
}
