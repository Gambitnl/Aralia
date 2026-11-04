/** Source keeper and guest-bed validation must happen before a room purchase. */
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {GamePhase} from '../../../types';
import {createMockGameState, createMockPlayerCharacter} from '../../../utils/core/factories';
import {townBuildingVisit} from '../../../components/Worldforge/townBuildingVisit';
import {handleBookLodging, handleRequestLodging} from '../handleLodging';
import type {WorldBusiness} from '../../../types/business';
import type {RichNPC} from '../../../types';
import type {LodgingOffer} from '../../../types/rest';
vi.mock('../../../components/Worldforge/townBuildingVisit', () => ({townBuildingVisit: vi.fn()}));
const quote: LodgingOffer = {businessId: 'inn', businessName: 'Source inn', keeperId: 'keeper', keeperName: 'Bram',
  worldSeed: 1, cellId: 1389, locationId: 'cell_1389', burgId: 1, plotId: 106,
  partyIds: ['brea'], beds: [{level: 0, index: 0, roomId: 6}], roomLabels: ['Room 1, ground floor'], costGp: 0.5, quotedAt: '0351-01-01T08:00:00.000Z'};
function fixture() {
  const gameState = createMockGameState({phase: GamePhase.PLAYING, worldSeed: 1, currentLocationId: 'cell_1389',
    playerCell: {cellId: 1389, localeCoords: null}, gameTime: new Date(quote.quotedAt), gold: 18.49,
    party: [createMockPlayerCharacter({id: 'brea'})],
    generatedNpcs: {keeper: {id: 'keeper', name: 'Bram'} as RichNPC},
    worldBusinesses: {inn: {id: 'inn', name: 'Source inn', ownerId: 'keeper', locationId: 'cell_1389', burgId: 1, plotId: 106} as WorldBusiness}});
  return {gameState, dispatch: vi.fn(), addMessage: vi.fn()};
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(townBuildingVisit).mockReturnValue({
    household: {members: [{}]}, plan: {type: 'inn', floors: [{level: 0,
      rooms: [{id: 6, purpose: 'guest-room'}], furnishings: [{kind: 'bed', roomId: 6}]}]},
    occupancy: {stationsByHour: Array.from({length: 24}, () => [{memberIndex: 0, where: 'home', activity: 'work'}])},
  } as unknown as ReturnType<typeof townBuildingVisit>);
});
describe('keeper lodging actions', () => {
  it('refuses a new upper-room quote behind legacy stairs before any payment', async () => {
    const props = fixture(), visit = structuredClone(townBuildingVisit(1, 1, 106));
    visit.plan.floors[0].level = 1;
    visit.plan.stairs = [{fromLevel: 0, x: 2.5, y: 2.5}];
    vi.mocked(townBuildingVisit).mockReturnValue(visit);
    const before = JSON.stringify(props.gameState);
    await handleRequestLodging(props, 'inn');
    expect(props.addMessage).toHaveBeenCalledWith(expect.stringContaining('no usable stair route'), 'system');
    expect(props.dispatch.mock.calls.some(([a]) => ['SHOW_LODGING_OFFER', 'RESERVE_LODGING'].includes(a.type))).toBe(false);
    expect(JSON.stringify(props.gameState)).toBe(before);
  });
  it('withdraws an upstairs quote when its usable stair disappears before confirmation', async () => {
    const props = fixture(), visit = structuredClone(townBuildingVisit(1, 1, 106));
    visit.plan.floors[0].level = 1;
    visit.plan.stairs = [];
    vi.mocked(townBuildingVisit).mockReturnValue(visit);
    await handleBookLodging(props, {...quote, beds: [{level: 1, index: 0, roomId: 6}]});
    expect(props.dispatch.mock.calls.some(([a]) => a.type === 'RESERVE_LODGING')).toBe(false);
    expect(props.dispatch).toHaveBeenCalledWith({type: 'SHOW_LODGING_OFFER', payload: {offer: expect.anything(), error: expect.stringContaining('no usable stair route')}});
  });
  it('quotes the existing owner and bed without spending or resting', async () => {
    const props = fixture();
    await handleRequestLodging(props, 'inn');
    expect(props.dispatch).toHaveBeenCalledWith({type: 'SHOW_LODGING_OFFER', payload: {offer: quote, error: undefined}});
    expect(props.dispatch.mock.calls.some(([a]) => ['RESERVE_LODGING', 'LONG_REST', 'ADVANCE_TIME'].includes(a.type))).toBe(false);
  });
  it('refuses an absent source keeper instead of inventing consent', async () => {
    const props = fixture();
    props.gameState.generatedNpcs = {};
    await handleRequestLodging(props, 'inn');
    expect(props.dispatch.mock.calls.some(([a]) => a.type === 'SHOW_LODGING_OFFER')).toBe(false);
    expect(props.addMessage).toHaveBeenCalledWith(expect.stringContaining('no registered keeper'), 'system');
  });
  it('rechecks the actual guest bed before dispatching atomic payment', async () => {
    const props = fixture();
    const changed = structuredClone(vi.mocked(townBuildingVisit).mock.results[0]?.value ?? townBuildingVisit(1, 1, 106));
    changed.plan.floors[0].rooms[0].purpose = 'bedroom';
    vi.mocked(townBuildingVisit).mockReturnValue(changed);
    await handleBookLodging(props, quote);
    expect(props.dispatch.mock.calls.some(([a]) => a.type === 'RESERVE_LODGING')).toBe(false);
    expect(props.dispatch).toHaveBeenCalledWith({type: 'SHOW_LODGING_OFFER', payload: {offer: quote, error: expect.stringContaining('no guest beds')}});
  });
  it('commits a valid quoted stay once through the payment reducer, without recovery actions', async () => {
    const props = fixture();
    await handleBookLodging(props, quote);
    expect(props.dispatch.mock.calls.filter(([action]) => action.type === 'RESERVE_LODGING')).toEqual([[{type: 'RESERVE_LODGING', payload: quote}]]);
    expect(props.dispatch).toHaveBeenLastCalledWith({type: 'SET_LOADING', payload: {isLoading: false}});
    expect(props.gameState.gold).toBe(18.49);
  });
});
