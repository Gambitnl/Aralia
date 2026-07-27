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
import { AttackEventEmitter } from '../systems/combat/AttackEventEmitter';
import { MovementEventEmitter } from '../systems/combat/MovementEventEmitter';
import { SustainActionSystem } from '../systems/combat/SustainActionSystem';
/**
 * Runs a function with a isolated, fresh instance of AttackEventEmitter.
 * Restores the original active instance after the function completes.
 */
export declare function isolateAttackEmitter<T>(fn: (emitter: AttackEventEmitter) => T): T;
/**
 * Runs a function with a isolated, fresh instance of MovementEventEmitter.
 * Restores the original active instance after the function completes.
 */
export declare function isolateMovementEmitter<T>(fn: (emitter: MovementEventEmitter) => T): T;
/**
 * Runs a function with a isolated, fresh instance of SustainActionSystem.
 * Restores the original active instance after the function completes.
 */
export declare function isolateSustainSystem<T>(fn: (system: SustainActionSystem) => T): T;
