import { describe, expect, it } from 'vitest';
import {
  createDefaultNpcMemory,
  migrateNpcMemory,
  migrateNpcMemoryRecord,
} from '../npcMemoryMigration';
import { GoalStatus, SuspicionLevel, type KnownFact, type NpcMemory } from '../../../types/world';

/**
 * @file Proves the NPC-memory load migration policy (board task agora-f4e9).
 *
 * The migration is the only thing standing between an old or partially written
 * save and the code that reads `NpcMemory` without guarding. These tests fix
 * the two halves of its contract:
 *   1. it HEALS what is broken (missing arrays, wrong types, corrupt facts), and
 *   2. it PRESERVES everything else — including optional fields it has never
 *      heard of, which is how sibling systems extend NpcMemory while
 *      `src/types/world.ts` is locked.
 *
 * Depends on: src/state/migrations/npcMemoryMigration.ts.
 */

/** A fully canonical fact — nothing about it should ever change on load. */
const canonicalFact: KnownFact = {
  id: 'fact-ward',
  text: 'The player sealed the ward',
  source: 'witnessed',
  isPublic: false,
  timestamp: 880,
  strength: 8,
  lifespan: 30,
  factKey: 'player_sealed_ward',
  confidence: 0.8,
  significance: 8,
};

/** A fully canonical memory used as the round-trip baseline. */
const canonicalMemory = (): NpcMemory => ({
  disposition: -17,
  knownFacts: [canonicalFact],
  suspicion: SuspicionLevel.Suspicious,
  goals: [{ id: 'goal-market', description: 'Protect the night market', status: GoalStatus.Active }],
  facts: ['The player arrived before dawn'],
  lastInteractionTimestamp: 995,
  interactions: [],
  attitude: 23,
  discussedTopics: { winter_supplies: 991 },
  lastInteractionDate: 700,
});

describe('migrateNpcMemory — missing and absent payloads', () => {
  it('returns the neutral default for null and undefined', () => {
    const expected = {
      disposition: 0,
      knownFacts: [],
      suspicion: SuspicionLevel.Unaware,
      goals: [],
    };
    expect(migrateNpcMemory(null)).toEqual(expected);
    expect(migrateNpcMemory(undefined)).toEqual(expected);
    // Non-objects are equally unusable and must not throw.
    expect(migrateNpcMemory('corrupt')).toEqual(expected);
    expect(migrateNpcMemory([1, 2, 3])).toEqual(expected);
    expect(createDefaultNpcMemory()).toEqual(expected);
  });

  it('adds an empty knownFacts array when the save omits the field', () => {
    const migrated = migrateNpcMemory({
      disposition: 4,
      suspicion: SuspicionLevel.Alert,
      goals: [],
    });
    expect(migrated.knownFacts).toEqual([]);
    // Healing one field must not reset the others.
    expect(migrated.disposition).toBe(4);
    expect(migrated.suspicion).toBe(SuspicionLevel.Alert);
  });

  it('adds an empty goals array when the save omits the field', () => {
    const migrated = migrateNpcMemory({ disposition: 4, knownFacts: [] });
    expect(migrated.goals).toEqual([]);
  });

  it('defaults a non-numeric disposition to 0 and a bad suspicion to Unaware', () => {
    const migrated = migrateNpcMemory({
      disposition: 'friendly',
      suspicion: 'very',
      knownFacts: [],
      goals: [],
    });
    expect(migrated.disposition).toBe(0);
    expect(migrated.suspicion).toBe(SuspicionLevel.Unaware);
    // NaN is a number but not a usable one.
    expect(migrateNpcMemory({ disposition: Number.NaN }).disposition).toBe(0);
    // A legitimate 0 and a negative disposition survive.
    expect(migrateNpcMemory({ disposition: 0 }).disposition).toBe(0);
    expect(migrateNpcMemory({ disposition: -42 }).disposition).toBe(-42);
  });
});

describe('migrateNpcMemory — malformed knownFacts', () => {
  it('filters out fact entries missing id, text, or source', () => {
    const migrated = migrateNpcMemory({
      disposition: 1,
      suspicion: SuspicionLevel.Unaware,
      goals: [],
      knownFacts: [
        canonicalFact,
        { text: 'no id', source: 'direct' },
        { id: 'fact-no-text', source: 'direct' },
        { id: 'fact-no-source', text: 'no source' },
        { id: 'fact-bad-source', text: 'unknown provenance', source: 'telepathy' },
        null,
        42,
      ],
    });
    expect(migrated.knownFacts).toHaveLength(1);
    expect(migrated.knownFacts[0].id).toBe('fact-ward');
  });

  it('turns a non-array knownFacts field into an empty array', () => {
    expect(migrateNpcMemory({ knownFacts: 'the watchword' }).knownFacts).toEqual([]);
    expect(migrateNpcMemory({ knownFacts: { a: 1 } }).knownFacts).toEqual([]);
  });

  it('converts legacy plain-string facts into canonical records', () => {
    const migrated = migrateNpcMemory(
      { disposition: 12, knownFacts: ['The player knows the old watchword'], goals: [] },
      1234,
    );
    expect(migrated.knownFacts).toEqual([
      {
        id: expect.any(String),
        text: 'The player knows the old watchword',
        source: 'direct',
        isPublic: true,
        timestamp: 1234,
        strength: 5,
        lifespan: 999,
        confidence: 0.5,
        significance: 5,
      },
    ]);
  });

  it('backfills only the missing strength-derived fields on structured facts', () => {
    const needsBoth: KnownFact = {
      id: 'fact-ritual',
      text: 'The player completed the ritual',
      source: 'witnessed',
      isPublic: false,
      timestamp: 880,
      strength: 8,
      lifespan: 30,
    };
    const needsSignificance: KnownFact = {
      id: 'fact-debt',
      text: 'The player paid their debt',
      source: 'direct',
      isPublic: true,
      timestamp: 900,
      strength: 3,
      lifespan: 90,
      confidence: 0.95,
    };
    const migrated = migrateNpcMemory({ knownFacts: [needsBoth, needsSignificance] });
    expect(migrated.knownFacts).toEqual([
      { ...needsBoth, confidence: 0.8, significance: 8 },
      { ...needsSignificance, significance: 3 },
    ]);
  });

  it('drops non-object goal entries but keeps valid ones', () => {
    const goal = { id: 'g1', description: 'Guard the gate', status: GoalStatus.Active };
    const migrated = migrateNpcMemory({ goals: [goal, 'not a goal', null] });
    expect(migrated.goals).toEqual([goal]);
  });
});

describe('migrateNpcMemory — correct data passes through unchanged', () => {
  it('leaves a canonical memory deep-equal, with untouched values keeping identity', () => {
    const memory = canonicalMemory();
    const migrated = migrateNpcMemory(memory);

    expect(migrated).toEqual(memory);
    // Identity checks prove this is a no-op rather than a deep clone: a
    // defaulting pass that rebuilt these would churn every load.
    expect(migrated.goals).toBe(memory.goals);
    expect(migrated.knownFacts).toBe(memory.knownFacts);
    expect(migrated.knownFacts[0]).toBe(canonicalFact);
    expect(migrated.facts).toBe(memory.facts);
    expect(migrated.interactions).toBe(memory.interactions);
    expect(migrated.discussedTopics).toBe(memory.discussedTopics);
  });

  it('does not mutate the payload it was given', () => {
    const memory = { disposition: 'bad', knownFacts: undefined } as unknown;
    const before = JSON.stringify(memory);
    migrateNpcMemory(memory);
    expect(JSON.stringify(memory)).toBe(before);
  });
});

describe('migrateNpcMemory — unknown optional fields survive', () => {
  /**
   * Sibling systems (npcEmotionalMemory's `emotionalMarkers`,
   * npcWitnessMemory's `witnessedActs`) attach data to NpcMemory through
   * intersection types because `src/types/world.ts` is locked. The migration
   * has never heard of those keys, so it must pass them through verbatim —
   * a migration that rebuilt only the known keys would erase an NPC's grudges
   * on the next load.
   */
  it('passes unknown extension fields through untouched, even while healing', () => {
    const emotionalMarkers = [
      { id: 'marker-1', type: 'grudge', trigger: 'killed_friend', intensity: 0.9 },
    ];
    const witnessedActs = [{ id: 'act-1', crime: 'theft', day: 12 }];
    const raw = {
      // Deliberately broken so the migration definitely does work on this object.
      disposition: 'hostile',
      emotionalMarkers,
      witnessedActs,
      someFutureField: { nested: true },
    };

    const migrated = migrateNpcMemory(raw) as NpcMemory & typeof raw;

    expect(migrated.disposition).toBe(0); // healed
    expect(migrated.emotionalMarkers).toBe(emotionalMarkers); // preserved by reference
    expect(migrated.witnessedActs).toBe(witnessedActs);
    expect(migrated.someFutureField).toEqual({ nested: true });
  });
});

describe('migrateNpcMemory — round trip', () => {
  it('save -> load -> save produces identical data, including extension fields', () => {
    const saved = {
      ...canonicalMemory(),
      emotionalMarkers: [{ id: 'marker-1', type: 'bond', intensity: 0.4, decay_rate: 0 }],
      witnessedActs: [{ id: 'act-1', crime: 'theft', day: 12 }],
    };

    // A save is JSON; serialize to model the real persistence boundary.
    const firstWrite = JSON.stringify(saved);
    const firstLoad = migrateNpcMemory(JSON.parse(firstWrite));
    const secondWrite = JSON.stringify(firstLoad);
    const secondLoad = migrateNpcMemory(JSON.parse(secondWrite));

    expect(secondWrite).toBe(firstWrite);
    expect(JSON.stringify(secondLoad)).toBe(firstWrite);
    // And no data was lost against the in-memory original.
    expect(firstLoad).toEqual(JSON.parse(JSON.stringify(saved)));
  });

  it('is idempotent on a payload that needed repair', () => {
    const broken = {
      disposition: null,
      knownFacts: [canonicalFact, { id: 'bad' }],
      emotionalMarkers: [{ id: 'marker-1' }],
    };
    const once = migrateNpcMemory(broken);
    const twice = migrateNpcMemory(once);
    expect(twice).toEqual(once);
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
  });
});

describe('migrateNpcMemoryRecord', () => {
  it('migrates every entry and tolerates a missing or corrupt record', () => {
    const record = migrateNpcMemoryRecord(
      {
        'npc-legacy': { disposition: 12, knownFacts: ['old watchword'] },
        'npc-current': canonicalMemory(),
        'npc-broken': null,
      },
      555,
    );

    expect(Object.keys(record).sort()).toEqual(['npc-broken', 'npc-current', 'npc-legacy']);
    expect(record['npc-legacy'].knownFacts[0].text).toBe('old watchword');
    expect(record['npc-legacy'].knownFacts[0].timestamp).toBe(555);
    expect(record['npc-legacy'].suspicion).toBe(SuspicionLevel.Unaware);
    expect(record['npc-current']).toEqual(canonicalMemory());
    expect(record['npc-broken']).toEqual(createDefaultNpcMemory());

    expect(migrateNpcMemoryRecord(undefined)).toEqual({});
    expect(migrateNpcMemoryRecord('corrupt')).toEqual({});
  });
});
