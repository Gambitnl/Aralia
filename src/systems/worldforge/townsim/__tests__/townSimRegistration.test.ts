/**
 * Plan D integration: build a real burg's sim state, and register/advance it
 * through the reducer.
 */
import { worldReducer } from '../../../../state/reducers/worldReducer';
import { createMockGameState } from '../../../../utils/core/factories';
import { getGameDay } from '../../../../utils/core';
import { getTownTilesForGrid } from '../../bridge/legacySubmapBridge';
import { buildTownSimStateForBurg } from '../townSimRegistration';

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
});
