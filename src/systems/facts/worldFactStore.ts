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

import { generateId } from '../../utils/core/idGenerator';
import type {
  WorldFact,
  WorldFactStore,
  WorldFactScope,
  LearnWorldFactInput,
} from '../../types/facts';

export type { WorldFact, WorldFactStore, WorldFactScope, LearnWorldFactInput };

/** Semantic-key namespace for dialogue topic unlocks (cross-NPC propagation). */
export function topicUnlockKey(topicId: string): string {
  return `topic_unlocked:${topicId}`;
}

export function createEmptyWorldFactStore(): WorldFactStore {
  return { version: 1, facts: {} };
}

function isValidFact(raw: unknown): raw is WorldFact {
  if (typeof raw !== 'object' || raw === null) return false;
  const fact = raw as Partial<WorldFact>;
  return (
    typeof fact.id === 'string' &&
    typeof fact.key === 'string' &&
    fact.key.length > 0 &&
    (fact.scope === 'global' || fact.scope === 'region' || fact.scope === 'npc') &&
    typeof fact.learnedAt === 'number'
  );
}

/**
 * Heals a raw (possibly legacy, missing, or hand-edited) store into a valid
 * one. Malformed fact entries are dropped rather than allowed to poison
 * lookups; a malformed container becomes an empty store.
 */
export function normalizeWorldFactStore(raw: unknown): WorldFactStore {
  if (typeof raw !== 'object' || raw === null) return createEmptyWorldFactStore();
  const candidate = raw as Partial<WorldFactStore>;
  if (candidate.version !== 1 || typeof candidate.facts !== 'object' || candidate.facts === null) {
    return createEmptyWorldFactStore();
  }
  const facts: Record<string, WorldFact> = {};
  for (const [key, fact] of Object.entries(candidate.facts)) {
    if (isValidFact(fact)) {
      facts[key] = fact;
    }
  }
  return { version: 1, facts };
}

/**
 * Learns a fact. Pure: returns a new store, or the SAME reference when the
 * key is already known (first provenance wins — a fact is learned once).
 */
export function learnWorldFact(store: WorldFactStore, input: LearnWorldFactInput): WorldFactStore {
  if (!input.key) return store;
  if (store.facts[input.key]) return store;

  const fact: WorldFact = {
    id: generateId(),
    key: input.key,
    value: input.value,
    scope: input.scope ?? 'global',
    regionId: input.regionId,
    npcId: input.npcId,
    sourceNpcId: input.sourceNpcId,
    sourceTopicId: input.sourceTopicId,
    learnedAt: input.learnedAt ?? Date.now(),
  };

  return {
    version: 1,
    facts: { ...store.facts, [input.key]: fact },
  };
}

/** Does the player durably know this fact? Tolerates missing stores (legacy saves). */
export function hasWorldFact(store: WorldFactStore | undefined, key: string): boolean {
  return !!store?.facts?.[key];
}

export function getWorldFact(
  store: WorldFactStore | undefined,
  key: string
): WorldFact | undefined {
  return store?.facts?.[key];
}

export function listWorldFacts(store: WorldFactStore | undefined): WorldFact[] {
  return store ? Object.values(store.facts) : [];
}
