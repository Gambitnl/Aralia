/**
 * This file contains unit tests for the MovementEventEmitter class.
 *
 * It validates that listeners can be registered and deregistered for pre-movement and post-movement events,
 * that movement distance is calculated correctly, that movement can be cancelled by listeners, and that the
 * singleton test isolation helper functions as expected.
 *
 * Runs on: vitest.
 * Depends on: MovementEventEmitter, combatEmitters test isolation utility.
 */

// ============================================================================
// Imports
// ============================================================================

import { describe, it, expect } from 'vitest';
import { MovementEventEmitter } from '../MovementEventEmitter';
import { isolateMovementEmitter } from '../../../test/combatEmitters';

// ============================================================================
// Test Suite: MovementEventEmitter and Test Isolation
// ============================================================================

describe('MovementEventEmitter', () => {
    it('calculates distance correctly and triggers pre-movement listeners', async () => {
        await isolateMovementEmitter(async (emitter) => {
            let preMovementTriggered = false;
            let eventData: any = null;

            emitter.onPreMovement((evt) => {
                preMovementTriggered = true;
                eventData = evt;
            });

            // Move from {x: 0, y: 0} to {x: 3, y: 4} (distance should be sqrt(3^2 + 4^2) = 5).
            const result = await emitter.emitPreMovement(
                'creature-1',
                { x: 0, y: 0 },
                { x: 3, y: 4 },
                'willing'
            );

            expect(preMovementTriggered).toBe(true);
            expect(result.distance).toBeCloseTo(5);
            expect(result.isCancelled).toBe(false);
            expect(eventData).toBeDefined();
            expect(eventData?.creatureId).toBe('creature-1');
            expect(eventData?.movementType).toBe('willing');
        });
    });

    it('allows pre-movement listeners to cancel movement', async () => {
        await isolateMovementEmitter(async (emitter) => {
            emitter.onPreMovement((evt) => {
                evt.isCancelled = true;
            });

            const result = await emitter.emitPreMovement(
                'creature-1',
                { x: 0, y: 0 },
                { x: 3, y: 4 },
                'willing'
            );

            expect(result.isCancelled).toBe(true);
        });
    });

    it('allows removing pre-movement listeners', async () => {
        await isolateMovementEmitter(async (emitter) => {
            let triggerCount = 0;
            const listener = () => {
                triggerCount++;
            };

            emitter.onPreMovement(listener);
            await emitter.emitPreMovement('creature-1', { x: 0, y: 0 }, { x: 1, y: 1 }, 'willing');
            expect(triggerCount).toBe(1);

            emitter.offPreMovement(listener);
            await emitter.emitPreMovement('creature-1', { x: 0, y: 0 }, { x: 1, y: 1 }, 'willing');
            expect(triggerCount).toBe(1);
        });
    });

    it('allows registering and triggering post-movement listeners', async () => {
        await isolateMovementEmitter(async (emitter) => {
            let postMovementTriggered = false;
            
            emitter.onMovement(() => {
                postMovementTriggered = true;
            });

            await emitter.emitMovement('creature-1', { x: 0, y: 0 }, { x: 3, y: 4 }, 'forced');

            expect(postMovementTriggered).toBe(true);
        });
    });

    it('allows removing post-movement listeners', async () => {
        await isolateMovementEmitter(async (emitter) => {
            let triggerCount = 0;
            const listener = () => {
                triggerCount++;
            };

            emitter.onMovement(listener);
            await emitter.emitMovement('creature-1', { x: 0, y: 0 }, { x: 1, y: 1 }, 'forced');
            expect(triggerCount).toBe(1);

            emitter.offMovement(listener);
            await emitter.emitMovement('creature-1', { x: 0, y: 0 }, { x: 1, y: 1 }, 'forced');
            expect(triggerCount).toBe(1);
        });
    });

    it('guarantees complete test isolation using isolateMovementEmitter helper', async () => {
        const defaultInstance = MovementEventEmitter.getInstance();
        let defaultTriggered = false;
        
        const defaultListener = () => {
            defaultTriggered = true;
        };
        defaultInstance.onPreMovement(defaultListener);

        await isolateMovementEmitter(async (isolatedEmitter) => {
            let isolatedTriggered = false;
            isolatedEmitter.onPreMovement(() => {
                isolatedTriggered = true;
            });

            await isolatedEmitter.emitPreMovement('creature-1', { x: 0, y: 0 }, { x: 1, y: 1 }, 'willing');
            expect(isolatedTriggered).toBe(true);
            expect(defaultTriggered).toBe(false);
        });

        await defaultInstance.emitPreMovement('creature-1', { x: 0, y: 0 }, { x: 1, y: 1 }, 'willing');
        expect(defaultTriggered).toBe(true);

        defaultInstance.offPreMovement(defaultListener);
    });
});
