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
  it('retains root and child hazard examinations without accepting hazard rewards or foreign keys',()=>{
    const identity=canonicalIdentity(),root=`object.v1:${identity.dungeonId}:trap:0`;
    const child=`object.v1:${canonicalDungeonId(`${identity.seedPath}/level:1`)}:trap:2`;
    const record=recordDungeonProgress(enterDungeonExpedition(identity),{objectFindings:{[root]:'examined',[child]:'examined'}});
    const raw=JSON.parse(JSON.stringify(record));
    Object.assign(raw.progress.objectFindings,{[`object.v1:${identity.dungeonId}:trap:3`]:'collected','object.v1:foreign:trap:0':'examined'});
    const restored=normalizeDungeonExpeditionLedger({[identity.dungeonId]:raw})[identity.dungeonId];
    expect(restored.progress.objectFindings).toEqual({[root]:'examined',[child]:'examined'});
    expect(restored.progress.claimedTreasureIds).toEqual([]);
    expect(restored.progress.clearedEncounterIds).toEqual([]);
  });
  it('keeps root and child surface observations through reload while rejecting surface collection and foreign keys',()=>{
    const identity=canonicalIdentity();
    const root=`object.v1:${identity.dungeonId}:surface:bloom:16`;
    const child=`object.v1:${canonicalDungeonId(`${identity.seedPath}/level:1`)}:surface:bloom:17`;
    let record=recordDungeonProgress(enterDungeonExpedition(identity),{objectFindings:{[root]:'examined',[child]:'examined'}});
    record=recordDungeonProgress(record,{objectFindings:{[root]:'collected'}});
    const raw=JSON.parse(JSON.stringify(record));
    Object.assign(raw.progress.objectFindings,{
      [`object.v1:${identity.dungeonId}:surface:bloom:18`]:'collected',
      [`object.v1:${identity.dungeonId}:surface:unknown:19`]:'examined',
      'object.v1:foreign:surface:bloom:20':'examined',
    });
    const restored=normalizeDungeonExpeditionLedger({[identity.dungeonId]:raw})[identity.dungeonId];
    expect(restored.progress.objectFindings).toEqual({[root]:'examined',[child]:'examined'});
    expect(restored.progress.claimedTreasureIds).toEqual([]);
    expect(restored.progress.clearedEncounterIds).toEqual([]);
  });
  it('keeps separate source enemy health through save normalization and drops malformed or foreign HP', () => {
    const identity = canonicalIdentity();
    const rootEvent = `encounter.v1:${identity.dungeonId}:room:1:cell:2,3`;
    const childEvent = `encounter.v1:${canonicalDungeonId(`${identity.seedPath}/level:1`)}:room:2:cell:4,5`;
    const damaged = recordDungeonProgress(enterDungeonExpedition(identity), {
      encounterHitPoints: {[rootEvent]: 7, [childEvent]: 11},
    });
    const updated = recordDungeonProgress(damaged, {encounterHitPoints: {[rootEvent]: 3}});
    const raw = JSON.parse(JSON.stringify(retreatDungeonExpedition(updated)));
    Object.assign(raw.progress.encounterHitPoints, {
      [`encounter.v1:other-dungeon:room:1:cell:2,3`]: 1,
      [`encounter.v1:${identity.dungeonId}:room:4:cell:2,3`]: -1,
      [`encounter.v1:${identity.dungeonId}:room:5:cell:2,3`]: 2.5,
      [`encounter.v1:${identity.dungeonId}:room:6:cell:2,3`]: Infinity,
      [`encounter.v1:${identity.dungeonId}:room:7:cell:2,3`]: '3',
      [`encounter.v1:${identity.dungeonId}:unrelated`]: 3,
    });
    const loaded = normalizeDungeonExpeditionLedger({[identity.dungeonId]: raw})[identity.dungeonId];
    const revisited = enterDungeonExpedition(identity, loaded);
    expect(revisited.progress.encounterHitPoints).toEqual({[rootEvent]: 3, [childEvent]: 11});
    expect(damaged.progress.encounterHitPoints).toEqual({[rootEvent]: 7, [childEvent]: 11});
    expect(revisited.progress.clearedEncounterIds).toEqual([]);
    expect(revisited.progress.claimedTreasureIds).toEqual([]);
    expect(normalizeDungeonExpeditionLedger({[identity.dungeonId]: enterDungeonExpedition(identity)})[identity.dungeonId].progress.encounterHitPoints).toBeUndefined();
  });

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
