/**
 * This file proves the durable lifecycle contract for one real world-grown dungeon.
 *
 * It begins with the authoritative world site identity, exercises entry, additive progress,
 * retreat, completion, JSON save/load migration, and revisit, then checks that completion,
 * cleared content, per-level parchment discovery, and compact child-level return receipts never
 * reset. It does not invent room interactions or completion rules; stable identifiers are supplied
 * directly as the authoritative gameplay boundaries would supply them.
 *
 * Called by: the focused dungeon lifecycle Vitest verification lane.
 * Depends on: canonical dungeon identities and the pure lifecycle transition helpers.
 */

// ============================================================================
// Test Dependencies
// ============================================================================

import { describe, expect, it } from 'vitest';
import { dungeonIdentityForSite } from '../deriveIdentity';
import { canonicalDungeonId } from '../dungeonIdentity';
import { enumerateDungeonSites } from '../dungeonSites';
import {
  completeDungeonExpedition,
  enterDungeonExpedition,
  normalizeDungeonExpeditionLedger,
  recordDungeonProgress,
  retreatDungeonExpedition,
} from '../dungeonLifecycle';
import { DUNGEON_SURFACE_LEVEL_ID } from '../dungeonMap';

const WORLD_SEED = 42;

// ============================================================================
// Canonical World Receipt Fixture
// ============================================================================
// The fixture uses the same enumerated site identity attached to GroundWorld entrances, avoiding a
// second test-only dungeon key policy.
// ============================================================================

function canonicalIdentity() {
  const site = enumerateDungeonSites(WORLD_SEED)[0];
  if (!site) throw new Error('Lifecycle test world has no canonical dungeon site.');
  return dungeonIdentityForSite(site);
}

// ============================================================================
// Full Durable Lifecycle
// ============================================================================

describe('persistent dungeon lifecycle', () => {
  it('preserves progress and completion through retreat, save/load, and revisit', () => {
    const identity = canonicalIdentity();
    const entered = enterDungeonExpedition(identity);
    const childSeedPath = `${identity.seedPath}/level:1`;

    // Stable ids stand in for future authoritative gameplay events. The lifecycle stores them but
    // does not decide when they should be emitted.
    const progressed = recordDungeonProgress(entered, {
      clearedEncounterIds: ['encounter:entry', 'encounter:entry'],
      openedRouteIds: ['route:sealed-wing'],
      claimedTreasureIds: ['treasure:builder-vault'],
      objectives: {
        'objective:reach-vault': 'active',
        'objective:survive-guardian': 'completed',
      },
      exploredCellKeysByLevel: {
        [DUNGEON_SURFACE_LEVEL_ID]: ['11,12', '12,12', '11,12'],
        'level:future-proof': ['2,3'],
      },
      levelVisits: {
        'level:0': {
          levelId: 'level:0',
          depth: 0,
          identity,
          parentLevelId: null,
          entryCellKey: '11,12',
          downTransitionCellKey: '20,22',
        },
        'level:1': {
          levelId: 'level:1',
          depth: 1,
          identity: { dungeonId: canonicalDungeonId(childSeedPath), seedPath: childSeedPath },
          parentLevelId: 'level:0',
          entryCellKey: '3,4',
          parentReturnCellKey: '20,22',
        },
      },
    });
    const repeatedProgress = recordDungeonProgress(progressed, {
      objectives: { 'objective:survive-guardian': 'active' },
      exploredCellKeysByLevel: {
        [DUNGEON_SURFACE_LEVEL_ID]: ['13,12'],
      },
    });
    const retreated = retreatDungeonExpedition(repeatedProgress);
    const completed = completeDungeonExpedition(retreated);
    const savedLedger = { [identity.dungeonId]: completed };

    // JSON is the save-service boundary. Migration reconstructs a normalized plain-data ledger.
    const loadedLedger = normalizeDungeonExpeditionLedger(
      JSON.parse(JSON.stringify(savedLedger)) as unknown,
    );
    const revisited = enterDungeonExpedition(identity, loadedLedger[identity.dungeonId]);

    expect(entered).toMatchObject({
      hasEntered: true,
      visitPhase: 'active',
      completion: 'incomplete',
      visitCount: 1,
      hasRevisited: false,
    });
    expect(revisited).toMatchObject({
      identity,
      visitPhase: 'active',
      completion: 'completed',
      visitCount: 2,
      hasRevisited: true,
    });
    expect(revisited.progress).toEqual({
      clearedEncounterIds: ['encounter:entry'],
      openedRouteIds: ['route:sealed-wing'],
      claimedTreasureIds: ['treasure:builder-vault'],
      objectives: {
        'objective:reach-vault': 'active',
        'objective:survive-guardian': 'completed',
      },
      exploredCellKeysByLevel: {
        [DUNGEON_SURFACE_LEVEL_ID]: ['11,12', '12,12', '13,12'],
        'level:future-proof': ['2,3'],
      },
      levelVisits: {
        'level:0': {
          levelId: 'level:0',
          depth: 0,
          identity,
          parentLevelId: null,
          entryCellKey: '11,12',
          downTransitionCellKey: '20,22',
        },
        'level:1': {
          levelId: 'level:1',
          depth: 1,
          identity: { dungeonId: canonicalDungeonId(childSeedPath), seedPath: childSeedPath },
          parentLevelId: 'level:0',
          entryCellKey: '3,4',
          parentReturnCellKey: '20,22',
        },
      },
    });
  });

  it('migrates missing legacy state to empty and rejects mismatched receipt keys', () => {
    const identity = canonicalIdentity();
    const record = enterDungeonExpedition(identity);

    expect(normalizeDungeonExpeditionLedger(undefined)).toEqual({});
    expect(normalizeDungeonExpeditionLedger({
      [identity.dungeonId]: {
        ...record,
        schemaVersion: 1,
        progress: {
          ...record.progress,
          exploredCellKeysByLevel: undefined,
          levelVisits: undefined,
        },
      },
    })[identity.dungeonId]?.progress).toMatchObject({
      exploredCellKeysByLevel: {},
      levelVisits: {},
    });
    expect(
      normalizeDungeonExpeditionLedger({
        'wf-dungeon-wrong-key': record,
      }),
    ).toEqual({});
  });

  it('rejects an id that does not match the frozen seed path before state is created', () => {
    const identity = canonicalIdentity();

    expect(() =>
      enterDungeonExpedition({ ...identity, dungeonId: 'wf-dungeon-detached' }),
    ).toThrow(/canonical seed path/i);
  });
});
