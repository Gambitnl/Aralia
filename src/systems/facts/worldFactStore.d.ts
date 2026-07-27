/**
 * @file src/systems/facts/worldFactStore.ts
 * Pure helpers for the durable, world-level fact store (DIAL-002 + DIAL-004).
 *
 * Decision (Remy, 2026-07-21): NPC unlock-facts — things one NPC tells you
 * that unlock options with OTHER NPCs — live in a durable, save-safe,
 * world-level store. Not per-NPC `KnownFact` (that is what NPCs know about
 * you), not the player-facing `DiscoveryLog` (that is journal presentation).
 *
 * All helpers are pure and reducer-friendly: `learnWorldFact` never mutates
 * and returns the SAME store reference when the fact is already known, so
 * reducers can cheaply detect no-ops. Readers tolerate `undefined` stores so
 * saves created before this system existed load without migration.
 */
import type { WorldFact, WorldFactStore, WorldFactScope, LearnWorldFactInput } from '../../types/facts';
export type { WorldFact, WorldFactStore, WorldFactScope, LearnWorldFactInput };
/** Semantic-key namespace for dialogue topic unlocks (cross-NPC propagation). */
export declare function topicUnlockKey(topicId: string): string;
export declare function createEmptyWorldFactStore(): WorldFactStore;
/**
 * Heals a raw (possibly legacy, missing, or hand-edited) store into a valid
 * one. Malformed fact entries are dropped rather than allowed to poison
 * lookups; a malformed container becomes an empty store.
 */
export declare function normalizeWorldFactStore(raw: unknown): WorldFactStore;
/**
 * Learns a fact. Pure: returns a new store, or the SAME reference when the
 * key is already known (first provenance wins — a fact is learned once).
 */
export declare function learnWorldFact(store: WorldFactStore, input: LearnWorldFactInput): WorldFactStore;
/** Does the player durably know this fact? Tolerates missing stores (legacy saves). */
export declare function hasWorldFact(store: WorldFactStore | undefined, key: string): boolean;
export declare function getWorldFact(store: WorldFactStore | undefined, key: string): WorldFact | undefined;
export declare function listWorldFacts(store: WorldFactStore | undefined): WorldFact[];
