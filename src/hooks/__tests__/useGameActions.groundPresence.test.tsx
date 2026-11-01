/** Stale town actions cannot spend or manufacture contact after a Local journey. */
import {afterEach,describe,expect,it,vi} from 'vitest';
import {act,cleanup,renderHook} from '@testing-library/react';
import {createMockGameState} from '../../utils/core/factories';
import {useGameActions} from '../useGameActions';
import type {Action,NPC} from '../../types';
const mocks=vi.hoisted(()=>({handle:vi.fn()}));
vi.mock('../actions/actionHandlers',()=>({buildActionHandlers:()=>({OPEN_NOTICE_BOARD:mocks.handle,TAKE_BROADSHEET:mocks.handle,OPEN_DYNAMIC_MERCHANT:mocks.handle,talk:mocks.handle,toggle_map:mocks.handle})}));
vi.mock('../../utils/context',()=>({generateGeneralActionContext:()=> 'test context'}));
vi.mock('../../utils/combat',()=>({getDiegeticPlayerActionMessage:()=>null}));
vi.mock('../../systems/worldforge/townsim/chronicleForLocation',()=>({burgIdForLocation:()=>undefined}));
afterEach(()=>{cleanup();vi.clearAllMocks()});
function setup(people:NPC[]=[]){
 const state=createMockGameState({worldSeed:7,playerGroundPos:{tileX:42,tileY:0,xM:457.2,zM:457.2,yM:4},worldBusinesses:{smith:{id:'smith',ownerId:'keeper',burgId:1}} as never});
 const dispatch=vi.fn(),addMessage=vi.fn();
 const {result}=renderHook(()=>useGameActions({gameState:state,dispatch,addMessage,playPcmAudio:vi.fn(),getCurrentLocation:()=>({id:'cell_42',name:'Woodland',exits:{},baseDescription:'',biomeId:'forest'}),getCurrentNPCs:()=>people,getTileTooltipText:()=>''}));
 return {result,dispatch,addMessage};
}
describe('accepted ground service boundary',()=>{
 it.each([
  {type:'OPEN_NOTICE_BOARD',label:'Old board'},
  {type:'TAKE_BROADSHEET',label:'Old paper'},
  {type:'OPEN_DYNAMIC_MERCHANT',label:'Old shop',payload:{merchantType:'shop_blacksmith',buildingId:'keeper',seedKey:'smith'}},
  {type:'talk',label:'Old keeper',targetId:'keeper',payload:{targetNpcId:'keeper'}},
 ] satisfies Action[])('refuses stale $type before its domain handler runs',async action=>{
  const {result,addMessage}=setup();
  await act(async()=>result.current.processAction(action));
  expect(mocks.handle).not.toHaveBeenCalled();
  expect(addMessage).toHaveBeenCalledWith(expect.stringContaining('not at your current position'),'system');
 });
 it('keeps ordinary map inspection available',async()=>{
  const {result}=setup();await act(async()=>result.current.processAction({type:'toggle_map',label:'Map'}));
  expect(mocks.handle).toHaveBeenCalledOnce();
 });
 it('allows talking to a proprietor independently placed here without granting their distant shop',async()=>{
  const {result}=setup([{id:'keeper',name:'Traveling keeper'} as NPC]);
  await act(async()=>result.current.processAction({type:'talk',label:'Talk',targetId:'keeper',payload:{targetNpcId:'keeper'}}));
  expect(mocks.handle).toHaveBeenCalledOnce();
  mocks.handle.mockClear();
  await act(async()=>result.current.processAction({type:'OPEN_DYNAMIC_MERCHANT',label:'Distant shop',payload:{merchantType:'shop_blacksmith',buildingId:'keeper',seedKey:'smith'}}));
  expect(mocks.handle).not.toHaveBeenCalled();
 });
});
