/**
 * @file worldFactStore.test.ts
 * Tests for the durable global fact store helpers (DIAL-002 + DIAL-004).
 * Covers: learn/idempotence, semantic keys, legacy-save healing, and the
 * save/reload JSON round trip.
 */
import { describe, it, expect } from 'vitest';
import {
  createEmptyWorldFactStore,
  normalizeWorldFactStore,
  learnWorldFact,
  hasWorldFact,
  getWorldFact,
  listWorldFacts,
  topicUnlockKey,
} from '../worldFactStore';

describe('worldFactStore', () => {
  it('creates an empty versioned store', () => {
    const store = createEmptyWorldFactStore();
    expect(store.version).toBe(1);
    expect(store.facts).toEqual({});
  });

  it('learns a fact with provenance and defaults', () => {
    const store = learnWorldFact(createEmptyWorldFactStore(), {
      key: topicUnlockKey('ask_about_ruins'),
      sourceNpcId: 'npc_a',
      sourceTopicId: 'rumor_ruins',
      learnedAt: 12345,
    });
    const fact = getWorldFact(store, topicUnlockKey('ask_about_ruins'))!;
    expect(fact.scope).toBe('global');
    expect(fact.sourceNpcId).toBe('npc_a');
    expect(fact.learnedAt).toBe(12345);
    expect(fact.id).toBeTruthy();
    expect(hasWorldFact(store, topicUnlockKey('ask_about_ruins'))).toBe(true);
  });

  it('is idempotent: learning a known key returns the SAME store reference', () => {
    const once = learnWorldFact(createEmptyWorldFactStore(), { key: 'k1', learnedAt: 1 });
    const twice = learnWorldFact(once, { key: 'k1', learnedAt: 999, sourceNpcId: 'other' });
    expect(twice).toBe(once);
    // Original provenance preserved.
    expect(getWorldFact(twice, 'k1')!.learnedAt).toBe(1);
  });

  it('does not mutate the input store (immutability for reducer use)', () => {
    const base = createEmptyWorldFactStore();
    const next = learnWorldFact(base, { key: 'k2', learnedAt: 2 });
    expect(base.facts).toEqual({});
    expect(next).not.toBe(base);
    expect(hasWorldFact(next, 'k2')).toBe(true);
  });

  it('hasWorldFact tolerates an undefined store (legacy saves)', () => {
    expect(hasWorldFact(undefined, 'anything')).toBe(false);
    expect(getWorldFact(undefined, 'anything')).toBeUndefined();
    expect(listWorldFacts(undefined)).toEqual([]);
  });

  it('normalize heals missing/malformed stores from legacy saves', () => {
    expect(normalizeWorldFactStore(undefined)).toEqual(createEmptyWorldFactStore());
    expect(normalizeWorldFactStore(null)).toEqual(createEmptyWorldFactStore());
    expect(normalizeWorldFactStore('garbage')).toEqual(createEmptyWorldFactStore());
    expect(normalizeWorldFactStore({ version: 99, facts: 'nope' })).toEqual(
      createEmptyWorldFactStore()
    );
  });

  it('normalize keeps a valid store intact (same facts survive)', () => {
    const store = learnWorldFact(createEmptyWorldFactStore(), {
      key: 'kept',
      learnedAt: 7,
    });
    const healed = normalizeWorldFactStore(store);
    expect(hasWorldFact(healed, 'kept')).toBe(true);
  });

  it('normalize drops malformed fact entries but keeps well-formed ones', () => {
    const raw = {
      version: 1,
      facts: {
        good: { id: 'x', key: 'good', scope: 'global', learnedAt: 1 },
        bad: { nonsense: true },
        worse: null,
      },
    };
    const healed = normalizeWorldFactStore(raw);
    expect(hasWorldFact(healed, 'good')).toBe(true);
    expect(hasWorldFact(healed, 'bad')).toBe(false);
    expect(Object.keys(healed.facts)).toEqual(['good']);
  });

  it('survives a save/reload round trip (JSON serialize -> normalize)', () => {
    let store = createEmptyWorldFactStore();
    store = learnWorldFact(store, {
      key: topicUnlockKey('secret_passage'),
      sourceNpcId: 'npc_a',
      sourceTopicId: 'bribe_guard',
      learnedAt: 42,
    });
    store = learnWorldFact(store, {
      key: 'region_secret:mistmoor',
      scope: 'region',
      regionId: 'mistmoor',
      learnedAt: 43,
    });

    const reloaded = normalizeWorldFactStore(JSON.parse(JSON.stringify(store)));
    expect(hasWorldFact(reloaded, topicUnlockKey('secret_passage'))).toBe(true);
    expect(getWorldFact(reloaded, 'region_secret:mistmoor')!.regionId).toBe('mistmoor');
    expect(listWorldFacts(reloaded)).toHaveLength(2);
  });

  it('topicUnlockKey is stable and namespaced', () => {
    expect(topicUnlockKey('ask_about_ruins')).toBe('topic_unlocked:ask_about_ruins');
  });
});
