/**
 * Plan D integration: build a real burg's sim state, register/advance it
 * through the reducer, and prove its real lots carry replayable growth briefs.
 * Canonical geometry matters here because fixture-sized lots cannot prove that
 * additions stay inside the production street plan.
 */
import { worldReducer } from '../../../../state/reducers/worldReducer';
import { createMockGameState } from '../../../../utils/core/factories';
import { getGameDay } from '../../../../utils/core';
import { getTownTilesForGrid } from '../../bridge/legacySubmapBridge';
import { buildTownSimStateForBurg, buildingEvolutionForBurg, townRosterForBurg } from '../townSimRegistration';
import { CURRENT_TOWN_LAYOUT_REVISION } from '../../town/townLayoutRevision';
import { advanceTown } from '../townSimRegistry';
import {
  isBuildingHistoryJournal,
  structuralBuildingHistoryEvents,
} from '../../interior/buildingEventHistory';

const SEED = 12345;
// A real burg in this generated world (atlas is cached per seed).
const firstBurgId = getTownTilesForGrid(SEED, 96, 96)[0]?.burgId;

describe('buildTownSimStateForBurg', () => {
  it('builds a real burg sim state with people, key roles, and start day', () => {
    expect(firstBurgId).toBeDefined();
    const s = buildTownSimStateForBurg(SEED, firstBurgId!, 100);
    expect(s.burgId).toBe(firstBurgId);
    expect(s.layoutRevision).toBe(CURRENT_TOWN_LAYOUT_REVISION);
    expect(Object.keys(s.villagers).length).toBeGreaterThan(0);
    expect(s.lastSimDay).toBe(100);
    const roleHolders = Object.values(s.villagers).filter((v) => v.role).length;
    expect(roleHolders).toBeGreaterThanOrEqual(1);
  });

  it('arrives with a populated chronicle (backstory backfill), not empty', () => {
    // The fix for the "inert on arrival" review finding: a freshly-built town has
    // ~3 years of simulated history, so the diegetic surfaces have content at once.
    const s = buildTownSimStateForBurg(SEED, firstBurgId!, 100);
    expect(s.chronicle.events.length).toBeGreaterThan(0);
    // recent events fall within the player's news window (last ~3 years)
    const recent = s.chronicle.events.filter((e) => e.day > 100 - 3 * 365);
    expect(recent.length).toBeGreaterThan(0);
  });

  it('is deterministic for the same (worldSeed, burgId)', () => {
    const a = buildTownSimStateForBurg(SEED, firstBurgId!, 0);
    const b = buildTownSimStateForBurg(SEED, firstBurgId!, 0);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('registers bounded future additions from real canonical lots', () => {
    const state = buildTownSimStateForBurg(SEED, firstBurgId!, 100);
    const briefs = Object.values(state.buildingEvolution ?? {});

    expect(briefs.length).toBeGreaterThan(0);
    for (const brief of briefs) {
      expect(brief.districtKey.length).toBeGreaterThan(0);
      expect(brief.extensionCandidates.length).toBeGreaterThan(0);
      expect(brief.extensionCandidates.length).toBeLessThanOrEqual(2);
      expect(brief.extensionCandidates.every((candidate) =>
        candidate.roofForm === brief.roofForm)).toBe(true);
    }
  });

  it('a real burg eventually writes a canonical non-fire building change', () => {
    // Registration backfills three years. Shift that window across several
    // calendar years until this fixed world encounters a prosperous outcome;
    // canonical town generation is cached, so the loop remains focused.
    let evolved: ReturnType<typeof buildTownSimStateForBurg> | undefined;
    let extensionPlotId: number | undefined;
    for (let currentDay = 365; currentDay <= 365 * 20; currentDay += 365) {
      const candidate = buildTownSimStateForBurg(SEED, firstBurgId!, currentDay);
      for (const [plotId, events] of Object.entries(candidate.buildingEvents ?? {})) {
        if (structuralBuildingHistoryEvents(events).length > 0) {
          evolved = candidate;
          extensionPlotId = Number(plotId);
          break;
        }
      }
      if (evolved) break;
    }

    expect(evolved).toBeDefined();
    expect(evolved?.chronicle.events.some((event) => event.kind === 'building')).toBe(true);
    const extension = structuralBuildingHistoryEvents(
      evolved?.buildingEvents?.[extensionPlotId!],
    )[0]?.event;
    const brief = evolved?.buildingEvolution?.[extensionPlotId!];
    expect(extension?.kind).toBe('extension');
    if (extension?.kind === 'extension' && extension.payload.mass) {
      expect(brief?.extensionCandidates.some((candidate) =>
        JSON.stringify(candidate.mass) === JSON.stringify(extension.payload.mass))).toBe(true);
      expect(brief?.roofForm).toBe(brief?.extensionCandidates[0].roofForm);
    }
  });
});

describe('canonical building lifecycle', () => {
  it('produces vacancy, reuse, and neglect over a century', () => {
    const initial = buildTownSimStateForBurg(SEED, firstBurgId!, 0);
    const evolved = advanceTown(initial, SEED, 100 * 365);
    const kinds = Object.values(evolved.buildingEvents ?? {})
      .flatMap((history) => isBuildingHistoryJournal(history) ? history.events : history)
      .map((event) => event.kind);

    expect(kinds).toContain('abandonment');
    expect(kinds).toContain('reoccupation');
    // Re-pinned 2026-11-02 (GG-552 rule, GG-563/GG-577 layout): the first
    // burg (512) refills all 24 empty homes before neglect can ruin them, so
    // it shows no ruin in a century. Burg 205 of the same world showed 2.
    // Re-pinned 2026-11-02 (GG-586 market square: the size floor and the
    // market trades re-lay the towns): burgs 512, 205 and 47 show no ruin in
    // a century now; burg 726 shows 1.
    const ruinTown = advanceTown(buildTownSimStateForBurg(SEED, 726, 0), SEED, 100 * 365);
    const ruinKinds = Object.values(ruinTown.buildingEvents ?? {})
      .flatMap((history) => isBuildingHistoryJournal(history) ? history.events : history)
      .map((event) => event.kind);
    expect(ruinKinds).toContain('ruin');
    // 2026-07-20: 20s → 60s. Corner-wedge packing raised canonical town
    // density ~25%, and this century sim scales with building count.
    // 2026-11-02: 60s → 120s for the second town's century.
  }, 120_000);
});

describe('TOWNSIM_REGISTER_BURG reducer (Plan D wiring)', () => {
  it('registers a town once (idempotent), then the daily loop advances it', () => {
    const base = { ...createMockGameState(), worldSeed: SEED };
    const startDay = getGameDay(base.gameTime);

    const r1 = worldReducer(base, { type: 'TOWNSIM_REGISTER_BURG', payload: { burgId: firstBurgId! } } as never);
    expect(r1.townSim![firstBurgId!]).toBeDefined();
    expect(r1.townSim![firstBurgId!].lastSimDay).toBe(startDay);

    // Idempotent: re-registering an already-tracked town changes nothing.
    const withTown = { ...base, townSim: r1.townSim! };
    const r2 = worldReducer(withTown, { type: 'TOWNSIM_REGISTER_BURG', payload: { burgId: firstBurgId! } } as never);
    expect(r2).toEqual({});

    // The registered town advances with game time.
    const r3 = worldReducer(withTown, { type: 'ADVANCE_TIME', payload: { seconds: 4 * 86400 } } as never);
    const newDay = getGameDay(new Date(base.gameTime.getTime() + 4 * 86400 * 1000));
    expect(r3.townSim![firstBurgId!].lastSimDay).toBe(newDay);
  });

  it('hydrates only missing evolution briefs when an old saved burg registers', () => {
    const base = { ...createMockGameState(), worldSeed: SEED };
    const registered = worldReducer(
      base,
      { type: 'TOWNSIM_REGISTER_BURG', payload: { burgId: firstBurgId! } } as never,
    ).townSim![firstBurgId!];
    const oldTown = { ...registered, buildingEvolution: undefined };
    const migrated = worldReducer(
      { ...base, townSim: { [firstBurgId!]: oldTown } },
      { type: 'TOWNSIM_REGISTER_BURG', payload: { burgId: firstBurgId! } } as never,
    ).townSim![firstBurgId!];

    expect(Object.keys(migrated.buildingEvolution ?? {}).length).toBeGreaterThan(0);
    expect(migrated.villagers).toBe(oldTown.villagers);
    expect(migrated.chronicle).toBe(oldTown.chronicle);
    expect(migrated.buildingEvents).toBe(oldTown.buildingEvents);
  });

  // 2026-11-04 (GG-595 follow-up 1): a town saved before 2026-11-02 has no shop
  // records. The next entry fills them from the saved people, once.
  it('fills shop records for an old saved burg without replacing people or history', () => {
    const base = { ...createMockGameState(), worldSeed: SEED };
    const registered = worldReducer(
      base,
      { type: 'TOWNSIM_REGISTER_BURG', payload: { burgId: firstBurgId! } } as never,
    ).townSim![firstBurgId!];
    expect(Object.keys(registered.shops ?? {}).length).toBeGreaterThan(0);
    const oldTown = { ...registered, shops: undefined };
    const filled = worldReducer(
      { ...base, townSim: { [firstBurgId!]: oldTown } },
      { type: 'TOWNSIM_REGISTER_BURG', payload: { burgId: firstBurgId! } } as never,
    ).townSim![firstBurgId!];

    expect(Object.keys(filled.shops!).sort()).toEqual(Object.keys(registered.shops!).sort());
    // Every open shop has a living keeper from the saved people.
    for (const record of Object.values(filled.shops!)) {
      if (record.keeperId === null) continue;
      expect(filled.villagers[record.keeperId]?.diedDay).toBeUndefined();
    }
    expect(filled.villagers).toBe(oldTown.villagers);
    expect(filled.chronicle).toBe(oldTown.chronicle);
    expect(filled.buildingEvolution).toBe(oldTown.buildingEvolution);
    // A second entry changes nothing.
    expect(worldReducer({ ...base, townSim: { [firstBurgId!]: filled } },
      { type: 'TOWNSIM_REGISTER_BURG', payload: { burgId: firstBurgId! } } as never)).toEqual({});
  });
});


describe('saved canonical town layout selection', () => {
  it('retains the selected earlier layout through backfill, daily life and JSON serialization', () => {
    const town = buildTownSimStateForBurg(SEED, firstBurgId!, 100, 1);
    expect(town.layoutRevision).toBe(1);
    const advanced = advanceTown(town, SEED, 102);
    expect(JSON.parse(JSON.stringify(advanced)).layoutRevision).toBe(1);
    expect(townRosterForBurg(SEED, firstBurgId!, 1)).not.toEqual(
      townRosterForBurg(SEED, firstBurgId!, 2),
    );
  });

  it('hydrates missing growth from the saved earlier layout without replacing people or history', () => {
    const base = { ...createMockGameState(), worldSeed: SEED };
    const original = buildTownSimStateForBurg(SEED, firstBurgId!, 100, 1);
    const oldTown = { ...original, buildingEvolution: undefined };
    const result = worldReducer({ ...base, townSim: { [firstBurgId!]: oldTown } },
      { type: 'TOWNSIM_REGISTER_BURG', payload: { burgId: firstBurgId! } } as never);
    const hydrated = result.townSim![firstBurgId!];
    expect(hydrated.layoutRevision).toBe(1);
    expect(hydrated.buildingEvolution).toEqual(buildingEvolutionForBurg(SEED, firstBurgId!, 1));
    expect(hydrated.villagers).toBe(oldTown.villagers);
    expect(hydrated.chronicle).toBe(oldTown.chronicle);
    expect(hydrated.buildingEvents).toBe(oldTown.buildingEvents);
  });

  it('does not guess a revision or hydrate new-lot growth into an unversioned save', () => {
    const base = { ...createMockGameState(), worldSeed: SEED };
    const registered = buildTownSimStateForBurg(SEED, firstBurgId!, 100);
    const oldTown = { ...registered, layoutRevision: undefined, buildingEvolution: undefined, shops: undefined };
    const before = JSON.stringify(oldTown);
    expect(worldReducer({ ...base, townSim: { [firstBurgId!]: oldTown } },
      { type: 'TOWNSIM_REGISTER_BURG', payload: { burgId: firstBurgId! } } as never)).toEqual({});
    expect(JSON.stringify(oldTown)).toBe(before);
  });
});
