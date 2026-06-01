/**
 * This file contains unit tests for the AttackEventEmitter class.
 *
 * It validates that listeners can be registered and deregistered for pre-attack and post-attack events,
 * that pre-attack events can be cancelled or redirected, and that the singleton test isolation helper
 * prevents state leakages between test cases.
 *
 * Runs on: vitest.
 * Depends on: AttackEventEmitter, combatEmitters test isolation utility.
 */

// ============================================================================
// Imports
// ============================================================================

import { describe, it, expect } from 'vitest';
import { AttackEventEmitter } from '../AttackEventEmitter';
import { isolateAttackEmitter } from '../../../test/combatEmitters';

// ============================================================================
// Test Suite: AttackEventEmitter and Test Isolation
// ============================================================================

describe('AttackEventEmitter', () => {
    it('allows registering and triggering pre-attack listeners', async () => {
        await isolateAttackEmitter(async (emitter) => {
            let preAttackTriggered = false;
            let eventData: any = null;

            // Register a pre-attack listener.
            emitter.onPreAttack((evt) => {
                preAttackTriggered = true;
                eventData = evt;
            });

            // Emit pre-attack event.
            const result = await emitter.emitPreAttack('attacker-1', 'target-1', 'weapon', 'melee');

            // Assertions:
            expect(preAttackTriggered).toBe(true);
            expect(result.isCancelled).toBe(false);
            expect(eventData).toBeDefined();
            expect(eventData?.attackerId).toBe('attacker-1');
            expect(eventData?.targetId).toBe('target-1');
            expect(eventData?.attackType).toBe('weapon');
            expect(eventData?.weaponType).toBe('melee');
        });
    });

    it('allows pre-attack listeners to cancel attacks', async () => {
        await isolateAttackEmitter(async (emitter) => {
            // Register a listener that cancels the attack.
            emitter.onPreAttack((evt) => {
                evt.isCancelled = true;
            });

            const result = await emitter.emitPreAttack('attacker-1', 'target-1', 'weapon');

            // Assertions:
            expect(result.isCancelled).toBe(true);
        });
    });

    it('allows pre-attack listeners to redirect targets', async () => {
        await isolateAttackEmitter(async (emitter) => {
            // Register a listener that redirects the attack.
            emitter.onPreAttack((evt) => {
                evt.redirectTargetId = 'target-redirected';
            });

            const result = await emitter.emitPreAttack('attacker-1', 'target-1', 'weapon');

            // Assertions:
            expect(result.redirectTargetId).toBe('target-redirected');
        });
    });

    it('allows removing pre-attack listeners', async () => {
        await isolateAttackEmitter(async (emitter) => {
            let triggerCount = 0;
            const listener = () => {
                triggerCount++;
            };

            emitter.onPreAttack(listener);
            
            // First emit should trigger it.
            await emitter.emitPreAttack('attacker-1', 'target-1', 'weapon');
            expect(triggerCount).toBe(1);

            // Remove it and emit again.
            emitter.offPreAttack(listener);
            await emitter.emitPreAttack('attacker-1', 'target-1', 'weapon');
            expect(triggerCount).toBe(1); // Should still be 1.
        });
    });

    it('allows registering and triggering post-attack listeners', async () => {
        await isolateAttackEmitter(async (emitter) => {
            let postAttackTriggered = false;
            
            emitter.onAttack(() => {
                postAttackTriggered = true;
            });

            await emitter.emitAttack('attacker-1', 'target-1', 'weapon');

            expect(postAttackTriggered).toBe(true);
        });
    });

    it('allows removing post-attack listeners', async () => {
        await isolateAttackEmitter(async (emitter) => {
            let triggerCount = 0;
            const listener = () => {
                triggerCount++;
            };

            emitter.onAttack(listener);
            await emitter.emitAttack('attacker-1', 'target-1', 'weapon');
            expect(triggerCount).toBe(1);

            emitter.offAttack(listener);
            await emitter.emitAttack('attacker-1', 'target-1', 'weapon');
            expect(triggerCount).toBe(1);
        });
    });

    it('guarantees complete test isolation using isolateAttackEmitter helper', async () => {
        // Step 1: Access the default global singleton instance and add a listener.
        const defaultInstance = AttackEventEmitter.getInstance();
        let defaultTriggered = false;
        
        const defaultListener = () => {
            defaultTriggered = true;
        };
        defaultInstance.onPreAttack(defaultListener);

        // Step 2: Run an isolated block. The listener on the default singleton should NOT fire.
        await isolateAttackEmitter(async (isolatedEmitter) => {
            let isolatedTriggered = false;
            isolatedEmitter.onPreAttack(() => {
                isolatedTriggered = true;
            });

            const result = await isolatedEmitter.emitPreAttack('attacker-1', 'target-1', 'weapon');
            expect(isolatedTriggered).toBe(true);
            expect(defaultTriggered).toBe(false); // Default listener was bypassed.
        });

        // Step 3: Emit on the default singleton. The listener on the default singleton SHOULD still fire.
        await defaultInstance.emitPreAttack('attacker-1', 'target-1', 'weapon');
        expect(defaultTriggered).toBe(true);

        // Cleanup: remove our listener.
        defaultInstance.offPreAttack(defaultListener);
    });
});
