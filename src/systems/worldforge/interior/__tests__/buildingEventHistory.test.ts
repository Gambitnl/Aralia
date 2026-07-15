import { describe, expect, it } from 'vitest';
import { rootSeedPath } from '../../seedPath';
import type { BuildingEvent, BlueprintPlan } from '../blueprintTypes';
import {
  applyHistory,
  appendBuildingEvent,
  buildingEventLogDigest,
  buildingHistoryEventCount,
  snapshotBuildingHistory,
} from '../buildingEventHistory';
import { generateBuilding } from '../generateBuilding';

const STYLE = {
  cultureType: 'Highland',
  climate: 'cold' as const,
  wealth: 'common' as const,
  ageBand: 'old' as const,
  architecture: {
    settlementKey: 'test-town',
    districtKey: 'old-market',
    buildingKey: 'plot-7',
  },
};

function planWithSecondaryMass(): BlueprintPlan {
  for (let seed = 1; seed <= 200; seed++) {
    const plan = generateBuilding({
      buildingId: 7,
      type: 'tavern',
      seedPath: rootSeedPath(seed),
      storeys: 2,
      style: STYLE,
    });
    if (plan.masses.length > 1) return plan;
  }
  throw new Error('test fixture could not find a secondary footprint mass');
}

const FIRE: BuildingEvent = {
  day: 120,
  kind: 'fire-damage',
  payload: { incidentId: 'burg-3:day-120:fire', severity: 2 },
};

describe('applyHistory', () => {
  it('is pure, replayable, and resolves exact room and roof targets', () => {
    const plan = planWithSecondaryMass();
    const before = JSON.stringify(plan);
    const log = [FIRE];
    const first = applyHistory(plan, log);
    const second = applyHistory(plan, log);

    expect(first).toEqual(second);
    expect(JSON.stringify(plan)).toBe(before);
    expect(first).not.toBe(plan);
    expect(first.eventLog).toEqual([FIRE]);
    expect(first.eventLog).not.toBe(log);
    expect(first.liveHistory?.features.some((feature) =>
      feature.kind === 'scorched-room')).toBe(true);
    expect(first.liveHistory?.features.some((feature) =>
      feature.kind === 'roof-hole')).toBe(true);
  });

  it('replays in chronological array order so repair-before-fire differs from fire-before-repair', () => {
    const plan = planWithSecondaryMass();
    const renovation: BuildingEvent = { day: 130, kind: 'renovation' };
    const repaired = applyHistory(plan, [FIRE, renovation]);
    const damagedAgain = applyHistory(plan, [
      { ...renovation, day: 110 },
      FIRE,
    ]);

    expect(repaired.liveHistory?.features.some((feature) =>
      feature.kind === 'scorched-room' || feature.kind === 'roof-hole')).toBe(false);
    expect(repaired.liveHistory?.renovatedBackstory).toBe(true);
    expect(damagedAgain.liveHistory?.features.some((feature) =>
      feature.kind === 'scorched-room')).toBe(true);
  });

  it('boards abandoned buildings and removes boards when they are reoccupied', () => {
    const plan = planWithSecondaryMass();
    const abandoned = applyHistory(plan, [{
      day: 200,
      kind: 'abandonment',
      payload: { boardedFraction: 1 },
    }]);
    const reoccupied = applyHistory(plan, [
      { day: 200, kind: 'abandonment', payload: { boardedFraction: 1 } },
      { day: 240, kind: 'reoccupation', payload: { occupantId: 'family-4' } },
    ]);

    expect(abandoned.liveHistory?.status).toBe('abandoned');
    expect(abandoned.liveHistory?.features.filter((feature) =>
      feature.kind === 'boarded-window')).toHaveLength(
      plan.floors.filter((floor) => floor.level >= 0)
        .reduce((sum, floor) => sum + floor.windows.length, 0),
    );
    expect(reoccupied.liveHistory?.status).toBe('occupied');
    expect(reoccupied.liveHistory?.features.some((feature) =>
      feature.kind === 'boarded-window')).toBe(false);
  });

  it('activates an explicit secondary mass and rejects fake structural targets', () => {
    const plan = planWithSecondaryMass();
    const extended = applyHistory(plan, [{
      day: 300,
      kind: 'extension',
      payload: { massIndex: 1, phase: 2, colorHex: '#887766' },
    }]);

    expect(extended.liveHistory?.features).toContainEqual({
      kind: 'extension-phase',
      massIndex: 1,
      phase: 2,
      colorHex: '#887766',
    });
    expect(() => applyHistory(plan, [{
      day: 300,
      kind: 'extension',
      payload: { massIndex: 0, phase: 1 },
    }])).toThrow(/secondary mass 0/);
  });

  it('keeps non-fire ruins structurally damaged without inventing scorch marks', () => {
    const plan = planWithSecondaryMass();
    const ruined = applyHistory(plan, [
      { day: 90, kind: 'ruin', payload: { cause: 'collapse', severity: 3 } },
    ]);

    expect(ruined.liveHistory?.features.some((feature) => feature.kind === 'roof-hole')).toBe(true);
    expect(ruined.liveHistory?.features.some((feature) => feature.kind === 'ruin-sag')).toBe(true);
    expect(ruined.liveHistory?.features.some((feature) =>
      feature.kind === 'scorched-room')).toBe(false);
  });

  it('rejects out-of-order logs rather than silently changing their meaning', () => {
    const plan = planWithSecondaryMass();
    expect(() => applyHistory(plan, [
      FIRE,
      { day: 119, kind: 'abandonment' },
    ])).toThrow(/precedes prior day/);
  });

  it('stores a stable fixed-log signature and canonical digest', () => {
    const plan = planWithSecondaryMass();
    const log: BuildingEvent[] = [
      FIRE,
      { day: 150, kind: 'abandonment', payload: { boardedFraction: 0.5 } },
      { day: 190, kind: 'ruin', payload: { cause: 'fire', severity: 3 } },
    ];
    const result = applyHistory(plan, log);

    // Fixed-log golden: changing target selection, fold semantics, or the
    // style outcomes preserved by history requires explicit review. This value
    // changed when age-led weathering became part of the resolved style; event
    // targets and the canonical event digest below remain independently pinned.
    expect(result.liveHistory?.historySignature).toBe('11anz1x');
    expect(buildingEventLogDigest(log)).toBe(buildingEventLogDigest([
      { day: 120, kind: 'fire-damage', payload: { severity: 2, incidentId: 'burg-3:day-120:fire' } },
      { day: 150, kind: 'abandonment', payload: { boardedFraction: 0.5 } },
      { day: 190, kind: 'ruin', payload: { severity: 3, cause: 'fire' } },
    ]));
  });
});

describe('appendBuildingEvent', () => {
  it('is immutable and idempotent for one fire incident', () => {
    const first = appendBuildingEvent(undefined, FIRE);
    const duplicate = appendBuildingEvent(first, { ...FIRE, day: 121 });

    expect(first).toEqual([FIRE]);
    expect(duplicate).toEqual(first);
    expect(duplicate).not.toBe(first);
  });

  it('preserves same-day fire idempotence after the incident is snapshotted', () => {
    const plan = planWithSecondaryMass();
    const resolved = applyHistory(plan, [FIRE]);
    const journal = snapshotBuildingHistory(resolved, [FIRE]);
    const duplicate = appendBuildingEvent(journal, FIRE);

    expect(duplicate).toEqual(journal);
    expect(buildingHistoryEventCount(duplicate)).toBe(1);
    expect(JSON.parse(JSON.stringify(journal))).toEqual(journal);
  });
});

describe('version 1 building-history snapshots', () => {
  it('replays the same semantic plan and resumes absolute event ordinals', () => {
    const plan = planWithSecondaryMass();
    const prefix: BuildingEvent[] = [
      FIRE,
      { day: 130, kind: 'abandonment', payload: { boardedFraction: 0.5 } },
      { day: 140, kind: 'reoccupation' },
    ];
    const fullPrefix = applyHistory(plan, prefix);
    const journal = snapshotBuildingHistory(fullPrefix, prefix);
    const replayedPrefix = applyHistory(plan, journal);

    expect(replayedPrefix.liveHistory).toEqual(fullPrefix.liveHistory);
    expect(replayedPrefix.styleResolved).toEqual(fullPrefix.styleResolved);
    expect(buildingEventLogDigest(journal)).toBe(buildingEventLogDigest(prefix));

    const future: BuildingEvent = {
      day: 180,
      kind: 'ruin',
      payload: { cause: 'collapse', severity: 2 },
    };
    const full = applyHistory(plan, [...prefix, future]);
    const compacted = applyHistory(plan, appendBuildingEvent(journal, future));
    expect(compacted.liveHistory).toEqual(full.liveHistory);
    expect(compacted.styleResolved).toEqual(full.styleResolved);
  });

  it('rejects corrupt snapshot metadata before applying saved outcomes', () => {
    const plan = planWithSecondaryMass();
    const journal = snapshotBuildingHistory(applyHistory(plan, [FIRE]), [FIRE]);
    const corrupt = {
      ...journal,
      snapshot: { ...journal.snapshot, eventDigest: 'not-valid!' },
    };

    expect(() => applyHistory(plan, corrupt)).toThrow(/event digest is invalid/);
  });
});
