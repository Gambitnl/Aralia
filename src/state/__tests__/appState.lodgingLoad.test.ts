/** Load keeps paid permission and recovery facts, but cannot reopen a stale
 * spend/confirmation dialog or inherit another run's guest beds. */
import {describe, expect, it} from 'vitest';
import {appReducer} from '../appState';
import {createMockGameState} from '../../utils/core/factories';
import type {LodgingReservation} from '../../types/rest';
const stay: LodgingReservation = {
  id: 'lodging:1:inn:paid', businessId: 'inn', businessName: 'Source inn', keeperId: 'keeper', keeperName: 'Bram',
  worldSeed: 1, cellId: 1389, locationId: 'cell_1389', burgId: 1, plotId: 106,
  partyIds: ['brea'], beds: [{level: 0, index: 12, roomId: 6}], costGp: 0.5,
  quotedAt: '0351-01-01T08:00:00.000Z', paidAt: '0351-01-01T08:00:00.000Z', expiresAt: '0351-01-02T08:00:00.000Z',
};
describe('paid lodging load boundary', () => {
  it.each([undefined, '0351-01-01T16:00:00.000Z'])('preserves paid and used-at %s facts while clearing ephemeral commitments', usedAt => {
    const loaded = createMockGameState({lodgingReservations: [{...stay, usedAt}],
      lodgingOffer: {offer: stay}, lodgingRestAdmission: {reservationId: stay.id, bed: stay.beds[0],
        position: {tileX: 1389, tileY: 0, xM: 10, zM: 20, yM: 3}},
      isLongRestModalVisible: true, isShortRestModalVisible: true, gold: 17.99,
      lastLongRestAt: usedAt ?? null});
    const after = appReducer(createMockGameState(), {type: 'LOAD_GAME_SUCCESS', payload: loaded});
    expect(after.lodgingReservations).toEqual(loaded.lodgingReservations);
    expect(after.gold).toBe(17.99);
    expect(after.lastLongRestAt).toBe(usedAt ?? null);
    expect(after.party).toEqual(loaded.party);
    expect(after.inventory).toEqual(loaded.inventory);
    expect(after.lodgingOffer).toBeNull();
    expect(after.lodgingRestAdmission).toBeNull();
    expect(after.isLongRestModalVisible).toBe(false);
    expect(after.isShortRestModalVisible).toBe(false);
  });
  it('loads an old Chronicle without inheriting the current run’s reservation', () => {
    const current = createMockGameState({lodgingReservations: [stay]});
    const legacy = createMockGameState({lodgingReservations: undefined});
    expect(appReducer(current, {type: 'LOAD_GAME_SUCCESS', payload: legacy}).lodgingReservations).toEqual([]);
  });
});
