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
import { buildTownSimStateForBurg } from '../townSimRegistration';
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
    expect(kinds).toContain('ruin');
  }, 20000);
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
});
