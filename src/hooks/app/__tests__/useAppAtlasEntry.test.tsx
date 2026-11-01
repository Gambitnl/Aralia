/** Map return and focus inspection preserve accepted feet; first ground entry follows an actual arrival. */
import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, renderHook} from '@testing-library/react';
import {createMockGameState} from '../../../utils/core/factories';
import {useAppAtlasEntry} from '../useAppAtlasEntry';
import type {WorldCellView} from '../../../types';
import { quoteLocalGroundJourney } from '../../../systems/worldforge/travel/localGroundJourney';
import type { AtlasGroundDrilldown } from '../../../systems/worldforge/leaf3d/atlasGroundDrilldown';
import type { LocalJourneyQuote } from '../../../systems/worldforge/travel/localGroundJourney';

vi.mock('../../../systems/worldforge/travel/localGroundJourney', () => ({ quoteLocalGroundJourney: vi.fn(), prepareLocalJourneyBattlefield: vi.fn() }));
vi.mock('../../../systems/worldforge/leaf3d/atlasGroundDrilldown', () => ({ atlasGroundAddressFromDrilldown: () => ({ source: 'exact-address' }) }));

vi.mock('../../../systems/worldforge/townsim/chronicleForLocation',()=>({burgIdForCell:()=>undefined}));
afterEach(cleanup);
const cell = {cellId:42, discovered:true} as WorldCellView;
const pose = {tileX:42,tileY:0,xM:18,zM:27,yM:4.5};

describe('Atlas current-body return',()=>{
  it('resumes the exact body without clearing position, native receipt, or location',()=>{
    const dispatch=vi.fn(), setReceipt=vi.fn();
    const state=createMockGameState({currentLocationId:'cell_42',playerCell:{cellId:42,localeCoords:null},playerGroundPos:pose,isMapVisible:true});
    const {result}=renderHook(()=>useAppAtlasEntry(state,dispatch,vi.fn(),setReceipt));
    result.current.handleEnter3DAtCell(0,0,cell,{cellId:42},true);
    expect(dispatch.mock.calls.map(([a])=>a.type)).toEqual(['SET_WORLD_VIEW_MODE','TOGGLE_MAP_VISIBILITY']);
    expect(setReceipt).not.toHaveBeenCalled();
    expect(state.playerGroundPos).toBe(pose);
  });

  it.each([false,true])('refuses an unpriced different-cell entry even with resume=%s',resume=>{
    const dispatch=vi.fn(), receipt=vi.fn();
    const state=createMockGameState({currentLocationId:'cell_41',playerCell:{cellId:41,localeCoords:null},playerGroundPos:{...pose,tileX:41}});
    const {result}=renderHook(()=>useAppAtlasEntry(state,dispatch,vi.fn(),receipt));
    expect(result.current.handleEnter3DAtCell(0,0,cell,{cellId:42},resume)).toMatch(/travel/i);
    expect(dispatch).not.toHaveBeenCalled(); expect(receipt).not.toHaveBeenCalled();
  });

  it('does not reset an accepted body when a Classic inspection focus is selected',()=>{
    const dispatch=vi.fn(),receipt=vi.fn();
    const state=createMockGameState({currentLocationId:'cell_42',playerCell:{cellId:42,localeCoords:null},playerGroundPos:pose});
    const {result}=renderHook(()=>useAppAtlasEntry(state,dispatch,vi.fn(),receipt));
    expect(result.current.handleEnter3DAtCell(0,0,cell,{cellId:42})).toMatch(/position|journey/i);
    expect(dispatch).not.toHaveBeenCalled();expect(receipt).not.toHaveBeenCalled();
  });

  it('retains a native receipt while its body is not yet established',()=>{
    const dispatch=vi.fn(),receipt=vi.fn();
    const state=createMockGameState({currentLocationId:'cell_42',playerCell:{cellId:42,localeCoords:null},playerGroundPos:null,atlasGroundAddress:{worldSeed:7,atlasCellId:42} as never});
    const {result}=renderHook(()=>useAppAtlasEntry(state,dispatch,vi.fn(),receipt));
    expect(result.current.handleEnter3DAtCell(0,0,cell,{cellId:42})).toMatch(/position|journey/i);
    expect(dispatch).not.toHaveBeenCalled();expect(receipt).not.toHaveBeenCalled();
  });

  it('still establishes first ground after the party has actually arrived in the current cell',()=>{
    const dispatch=vi.fn();
    const state=createMockGameState({currentLocationId:'cell_42',playerCell:{cellId:42,localeCoords:null},playerGroundPos:null,atlasGroundAddress:null});
    const {result}=renderHook(()=>useAppAtlasEntry(state,dispatch,vi.fn(),vi.fn()));
    result.current.handleEnter3DAtCell(0,0,cell,{cellId:42});
    expect(dispatch).toHaveBeenCalledWith({type:'SET_PLAYER_GROUND_POS',payload:{position:null}});
    expect(dispatch).toHaveBeenCalledWith({type:'SET_WORLD_VIEW_MODE',payload:'3d'});
  });

});

describe('native Atlas journey admission', () => {
  const drilldown = { atlasCellId: 42, worldSeed: 7, focus: { label: 'Old sewer' }, local: {} } as AtlasGroundDrilldown;
  const quote = { key: 'reviewed', allowed: true, biomeId: 'plains', totalSeconds: 5400, meta: { seconds: 5400, destinationCell: { cellId: 42, anchor: { cellId: 42 } }, provision: { rationsToSpend: 0, waterToSpend: 0, remainderMinutes: 90 } } } as LocalJourneyQuote;
  it.each([undefined, { ...quote, key: 'stale' }])('does not move without a current reviewed journey', reviewed => {
    vi.mocked(quoteLocalGroundJourney).mockReturnValue(quote);
    const dispatch = vi.fn(), receipt = vi.fn();
    const { result } = renderHook(() => useAppAtlasEntry(createMockGameState(), dispatch, vi.fn(), receipt));
    result.current.handleEnterPlayingGroundFromAtlas(drilldown, reviewed);
    expect(dispatch).not.toHaveBeenCalled(); expect(receipt).not.toHaveBeenCalled();
  });
  it('pays time through the travel authority before installing the exact receipt and keeps the map closed', () => {
    vi.mocked(quoteLocalGroundJourney).mockReturnValue(quote);
    const dispatch = vi.fn(), receipt = vi.fn();
    const state = createMockGameState({ worldSeed: 7, currentLocationId: 'cell_42', playerCell: { cellId: 42, localeCoords: null }, isMapVisible: false });
    const { result } = renderHook(() => useAppAtlasEntry(state, dispatch, vi.fn(), receipt));
    result.current.handleEnterPlayingGroundFromAtlas(drilldown, quote);
    expect(dispatch.mock.calls[0][0]).toEqual({ type: 'ADVANCE_TIME', payload: { seconds: 5400 } });
    expect(dispatch.mock.calls.some(([a]) => a.type === 'TOGGLE_MAP_VISIBILITY')).toBe(false);
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_PLAYER_GROUND_POS', payload: { position: null } });
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_ATLAS_GROUND_ADDRESS', payload: { source: 'exact-address' } });
    expect(receipt).toHaveBeenCalledWith(drilldown);
  });
  it('keeps an unaffordable route and a failed source survey from changing presence', () => {
    const dispatch = vi.fn(), receipt = vi.fn();
    const { result } = renderHook(() => useAppAtlasEntry(createMockGameState(), dispatch, vi.fn(), receipt));
    vi.mocked(quoteLocalGroundJourney).mockReturnValue({ ...quote, allowed: false });
    result.current.handleEnterPlayingGroundFromAtlas(drilldown, quote);
    vi.mocked(quoteLocalGroundJourney).mockImplementation(() => { throw new Error('No source route.'); });
    result.current.handleEnterPlayingGroundFromAtlas(drilldown, quote);
    expect(dispatch).not.toHaveBeenCalled(); expect(receipt).not.toHaveBeenCalled();
  });
});
