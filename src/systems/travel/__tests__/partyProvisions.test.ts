import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAppTravelActions } from '@/hooks/app/useAppTravelActions';
import type { WorldCellView } from '@/types';
import { COMPANIONS } from '@/data/companions';
import { createMockGameState, createMockItem, createMockPlayerCharacter } from '@/utils/core/factories';
import { partyProvisionInventory, spendPartyProvisions } from '../partyProvisions';
import { daysOfFood, daysOfWater } from '../provisioning';
import { companionReducer } from '@/state/reducers/companionReducer';
function ready() {
  const c = structuredClone(COMPANIONS.elara_vance); c.inParty = true;
  const food = createMockItem({ id: 'rations', quantity: 2, description: 'Aged personal food', age: 4 } as Parameters<typeof createMockItem>[0]);
  const water = createMockItem({ id: 'water-day', quantity: 2, description: 'Own sealed water' });
  c.inventory = [food, water];
  const remote = structuredClone(COMPANIONS.kaelen_thorne); remote.inParty = false; remote.inventory = [createMockItem({ id: 'rations', quantity: 100 })];
  return createMockGameState({ inventory: [createMockItem({ id: 'rations', quantity: 2 }), createMockItem({ id: 'water-day', quantity: 2 })], companions: { [c.id]: c, [remote.id]: remote }, party: [createMockPlayerCharacter(), createMockPlayerCharacter({ id: c.id })] });
}
describe('traveling personal provisions', () => {
  it('quotes actual party bags and excludes the absent person', () => {
    const s = ready(), pool = partyProvisionInventory(s);
    expect(daysOfFood(pool)).toBe(4); expect(daysOfWater(pool)).toBe(4); expect(s.companions.kaelen_thorne.inventory![0].quantity).toBe(100);
  });
  it('uses each person’s own share and conserves every retained stack attribute', () => {
    const s = ready(), old = structuredClone(s), p = spendPartyProvisions(s, 2, 2)!;
    expect(p.inventory!.map(i => i.quantity)).toEqual([1, 1]); expect(p.companions!.elara_vance.inventory!.map(i => i.quantity)).toEqual([1, 1]);
    expect(p.companions!.elara_vance.inventory![0]).toEqual({ ...s.companions.elara_vance.inventory![0], quantity: 1 });
    expect(p.companions!.kaelen_thorne).toBe(s.companions.kaelen_thorne); expect(p.companions!.elara_vance.memories).toBe(s.companions.elara_vance.memories); expect(s).toEqual(old);
    expect(daysOfFood(partyProvisionInventory({ ...s, ...p }))).toBe(2);
  });
  it('uses shared provisions when a traveler has no personal food', () => {
    const s = ready(); s.companions.elara_vance.inventory = [];
    const p = spendPartyProvisions(s, 2, 2)!; expect(p.inventory).toEqual([]); expect(p.companions!.elara_vance.inventory).toEqual([]);
  });
  it('can consume consenting personal stores when the shared bag is empty', () => {
    const s = ready(); s.inventory = []; const p = spendPartyProvisions(s, 2, 2)!;
    expect(p.companions!.elara_vance.inventory).toEqual([]); expect(p.companions!.kaelen_thorne).toBe(s.companions.kaelen_thorne);
  });
  it('reserves food and water together and leaves both unchanged on shortage', () => {
    const s = ready(), before = structuredClone(s); expect(spendPartyProvisions(s, 2, 5)).toBeNull(); expect(s).toEqual(before);
  });
  it.each([-1, NaN, Infinity])('rejects invalid quote %s', amount => { expect(spendPartyProvisions(ready(), amount, 1)).toBeNull(); });
  it('preserves fractional resource days rather than removing an entire personal stack', () => {
    const s = ready(), p = spendPartyProvisions(s, 1, 1)!;
    expect(p.inventory![0].quantity).toBe(1.5); expect(p.companions!.elara_vance.inventory![0].quantity).toBe(1.5);
  });
  it('uses the existing companion reducer to settle both bags in one update', () => {
    const s = ready(), p = companionReducer(s, { type: 'SPEND_TRAVEL_PROVISIONS', payload: { rations: 2, water: 2 } });
    expect(p.inventory![0].quantity).toBe(1); expect(p.companions!.elara_vance.inventory![0].quantity).toBe(1);
  });
  it('commits one pooled spend through travel and leaves absent companions out of supply fallout', () => {
    const s = ready(); s.currentLocationId = 'cell_1'; s.playerCell = { cellId: 1, localeCoords: null };
    s.playerGroundPos = { tileX: 1, tileY: 0, xM: 10, yM: 0, zM: 10 };
    s.companions.elara_vance.whereabouts = { worldSeed: s.worldSeed!, locationId: 'cell_1', source: 'party', observedAt: 1, position: { xM: 8, yM: 0, zM: 10 } };
    const dispatch = vi.fn(), { result } = renderHook(() => useAppTravelActions(s, dispatch, vi.fn()));
    result.current.handleTileClick(0, 0, { cellId: 42, x: 0, y: 0, biomeId: 'plains', discovered: true, isPlayerCurrent: false } as WorldCellView,
      { seconds: 3600, destinationCell: { cellId: 42, anchor: { cellId: 42 } }, routeLineage: { fromCellId: 1, intendedCellId: 42, cells: [1, 42] }, provision: { rationsToSpend: 2, waterToSpend: 2, companionLoyaltyDelta: -1 } });
    const actions = dispatch.mock.calls.map(([action]) => action);
    expect(actions.filter(a => a.type === 'SPEND_TRAVEL_PROVISIONS')).toEqual([{ type: 'SPEND_TRAVEL_PROVISIONS', payload: { rations: 2, water: 2 } }]);
    expect(actions.some(a => a.type === 'REMOVE_ITEM')).toBe(false);
    expect(actions.filter(a => a.type === 'ADJUST_COMPANION_LOYALTY').map(a => a.payload.companionId)).toEqual(['elara_vance']);
  });
});
