/**
 * This file provides helper utilities to isolate combat system singletons during unit tests.
 *
 * It defines wrapper functions that create fresh instances of combat singletons, swap them in
 * as the active instance for the duration of a test block, and then clean up and restore the
 * original instances afterward. This prevents test state leakage.
 *
 * `isolateAttackEmitter` and `isolateMovementEmitter` were removed with
 * `AttackEventEmitter` and `MovementEventEmitter` (agora-f821.45): no production
 * file ever emitted on either bus, so both emitters and their listeners were
 * dead. The live attack and movement reaction paths run through
 * `useActionExecutor` and the command layer instead.
 *
 * Called by: Combat system unit tests (e.g. SustainActionSystem.test.ts).
 * Depends on: SustainActionSystem.
 */

// ============================================================================
// Imports
// ============================================================================

import { SustainActionSystem } from '../systems/combat/SustainActionSystem';

// ============================================================================
// Isolation Helper Functions
// ============================================================================

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
