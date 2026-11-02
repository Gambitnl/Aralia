import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import { COMPANIONS } from '@/data/companions';
import { createMockGameState, createMockPlayerCharacter } from '@/utils/core/factories';
import { qualifyPartyJourneyArrival } from '../partyJourneyArrival';
const water = vi.hoisted(() => ({ y: undefined as number | undefined }));
vi.mock('@/systems/world3d/groundSurfaceYM', () => ({ groundSurfaceYM: () => 0 }));
vi.mock('@/systems/worldforge/bridge/groundWaterSurfaceQuery', () => ({ inspectGroundWater: () => ({status: 'valid', surfaceY: water.y}) }));
vi.mock('../initialTownEntry', async original => ({ ...await original<typeof import('../initialTownEntry')>(), measureEntryActors: (people: Array<{ id: string }>) => people.map(p => ({ id: p.id, offset: { x: 0, z: 0 }, body: { halfWidthM: .4, heightM: 1.7 } })) }));
function ground() { return { extentMetersX: 100, extentMetersZ: 100, towns: [], buildings: [], roads: [], plazas: [], decks: [], walls: [], rivers: [] } as unknown as GroundWorld; }
function state() {
  const c = structuredClone(COMPANIONS.elara_vance); c.inParty = true;
  c.whereabouts = { worldSeed: 77, locationId: 'cell_1', observedAt: 1, source: 'party', position: { xM: 10, yM: 0, zM: 10 } };
  c.journey = { id: 'actual-leg', worldSeed: 77, from: { locationId: 'cell_1', cellId: 1, position: c.whereabouts.position! }, to: { locationId: 'cell_3', cellId: 3 }, intendedCellId: 3, routeCells: [1, 3], departedAt: 1, arrivalAt: 2, status: 'awaiting-arrival' };
  return createMockGameState({ worldSeed: 77, currentLocationId: 'cell_3', playerCell: { cellId: 3, localeCoords: null }, gameTime: new Date(2), companions: { [c.id]: c }, party: [createMockPlayerCharacter(), createMockPlayerCharacter({ id: c.id })] });
}
describe('source-qualified shared journey arrival', () => {
  beforeEach(() => { water.y = undefined; });
  it('admits a dry clear wilderness formation without rewriting departure or ground', () => {
    const s = state(), g = ground(), old = structuredClone(s), result = qualifyPartyJourneyArrival(g, s, { x: 50, z: 50 });
    expect(result.error).toBeUndefined(); expect(result.arrivals).toEqual([{ companionId: 'elara_vance', journeyId: 'actual-leg', position: { xM: 52.25, yM: 0, zM: 50 } }]);
    expect(s).toEqual(old); expect(g.buildings).toEqual([]);
  });
  it('keeps public geometry mandatory in towns', () => {
    const g = ground(); g.towns = [{}] as GroundWorld['towns'];
    expect(qualifyPartyJourneyArrival(g, state(), { x: 50, z: 50 }).error).toMatch(/No clear arrival/);
    g.plazas = [{ pointsM: [{ x: 30, z: 30 }, { x: 70, z: 30 }, { x: 70, z: 70 }, { x: 30, z: 70 }] }] as GroundWorld['plazas'];
    expect(qualifyPartyJourneyArrival(g, state(), { x: 50, z: 50 }).arrivals).toHaveLength(1);
  });
  it('does not place a person in water', () => {
    water.y = 10; expect(qualifyPartyJourneyArrival(ground(), state(), { x: 50, z: 50 }).arrivals).toEqual([]);
  });
  it('does not place a person inside an occupied structure', () => {
    const g = ground(); g.buildings = [{ cornersM: [{ x: 30, z: 30 }, { x: 70, z: 30 }, { x: 70, z: 70 }, { x: 30, z: 70 }] }] as GroundWorld['buildings'];
    expect(qualifyPartyJourneyArrival(g, state(), { x: 50, z: 50 }).arrivals).toEqual([]);
  });
  it('does not overlap an already placed person', () => {
    expect(qualifyPartyJourneyArrival(ground(), state(), { x: 50, z: 50 }, [{ id: 'source-resident', xM: 50, zM: 50, radius: 20 }]).arrivals).toEqual([]);
  });
  it.each(['arrived', 'foreign-world', 'before-arrival', 'no-receipt'] as const)('never relocates %s state', kind => {
    const s = state();
    if (kind === 'arrived') s.companions.elara_vance.journey!.status = 'arrived';
    if (kind === 'foreign-world') s.companions.elara_vance.journey!.worldSeed = 78;
    if (kind === 'before-arrival') s.gameTime = new Date(1);
    if (kind === 'no-receipt') s.companions.elara_vance.journey = undefined;
    expect(qualifyPartyJourneyArrival(ground(), s, { x: 50, z: 50 }).arrivals).toEqual([]);
  });
});
