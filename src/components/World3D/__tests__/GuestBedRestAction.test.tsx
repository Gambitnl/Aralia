/** A reached unreserved bed must not advertise use of a different paid bed. */
import React from 'react';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {TownBuildingVisit} from '../../Worldforge/townBuildingVisit';
import type {LodgingReservation} from '../../../types/rest';
import {createMockGameState} from '../../../utils/core/factories';
import {GuestBedRestAction} from '../GuestBedRestAction';

afterEach(cleanup);
function fixture() {
  const visit = {plan: {type: 'inn', floors: [{level: 1,
    rooms: [{id: 0, purpose: 'guest-room'}, {id: 1, purpose: 'guest-room'}],
    furnishings: [{kind: 'bed', roomId: 0}, {kind: 'chest', roomId: 0}, {kind: 'bed', roomId: 1}],
  }]}} as unknown as TownBuildingVisit;
  const stay: LodgingReservation = {id: 'stay', businessId: 'inn', businessName: 'The Howling Shield',
    keeperId: 'keeper', keeperName: 'Fenna', worldSeed: 42, cellId: 4337,
    locationId: 'cell_4337', burgId: 675, plotId: 35, partyIds: ['sana'],
    beds: [{level: 1, index: 0, roomId: 0}], costGp: .5,
    quotedAt: '0351-01-06T14:55:07.000Z', paidAt: '0351-01-06T14:55:07.000Z',
    expiresAt: '0351-01-07T14:55:07.000Z'};
  const state = createMockGameState({worldSeed: 42, gameTime: new Date('0351-01-06T15:04:00.000Z'),
    lodgingReservations: [stay]});
  return {visit, stay, state, businessId: 'inn', level: 1, index: 2, onUse: vi.fn()};
}

describe('guest-bed examination action', () => {
  it('explains the native wrong-bed case and names the paid room without an action or state change', () => {
    const f = fixture(), before = JSON.stringify(f);
    render(<GuestBedRestAction {...f}/>);
    expect(screen.queryByRole('button', {name: 'Use reserved guest bed'})).toBeNull();
    expect(screen.getByText(/This bed is not included in your reservation/).textContent).toContain('Room 1, floor 1');
    expect(f.onUse).not.toHaveBeenCalled();
    expect(JSON.stringify(f)).toBe(before);
  });
  it('offers only the existing review callback at the exact reserved bed', () => {
    const f = fixture();
    render(<GuestBedRestAction {...f} index={0}/>);
    fireEvent.click(screen.getByRole('button', {name: 'Use reserved guest bed'}));
    expect(f.onUse).toHaveBeenCalledOnce();
    expect(f.state.lodgingReservations?.[0].usedAt).toBeUndefined();
  });
  it('does not confuse a furnishing index on another floor or in another room with the reservation', () => {
    const f = fixture(); f.stay.beds[0].roomId = 9;
    const {rerender} = render(<GuestBedRestAction {...f} index={0}/>);
    expect(screen.queryByRole('button')).toBeNull();
    f.stay.beds[0].roomId = 0; f.stay.beds[0].level = 0;
    rerender(<GuestBedRestAction {...f} index={0}/>);
    expect(screen.queryByRole('button')).toBeNull();
  });
  for (const unavailable of ['expired', 'used', 'foreign-world', 'other-business'] as const) {
    it(`does not offer a bed through an ${unavailable} reservation`, () => {
      const f = fixture();
      if (unavailable === 'expired') f.stay.expiresAt = '0351-01-06T14:00:00.000Z';
      if (unavailable === 'used') f.stay.usedAt = '0351-01-06T14:00:00.000Z';
      if (unavailable === 'foreign-world') f.stay.worldSeed = 99;
      if (unavailable === 'other-business') f.stay.businessId = 'another-inn';
      render(<GuestBedRestAction {...f} index={0}/>);
      expect(screen.queryByRole('button')).toBeNull();
      expect(screen.getByText(/Ask the innkeeper/)).toBeTruthy();
    });
  }
  it('retains private household beds and non-bed furnishings without a use action', () => {
    const f = fixture();
    f.visit.plan.floors[0].rooms[0].forSlot = 'head,spouse';
    const {rerender} = render(<GuestBedRestAction {...f} index={0}/>);
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<GuestBedRestAction {...f} index={1}/>);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
