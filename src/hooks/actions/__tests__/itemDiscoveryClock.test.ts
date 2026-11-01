/** Ancient in-game dates must not inherit the host's historical civil-time offset. */
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {createMockGameState,createMockPlayerCharacter} from '../../../utils/core/factories';
import {handleSearchArea,handleTakeItem,handleHarvestResource} from '../handleItemInteraction';
import type {AppAction} from '../../../state/actionTypes';
vi.mock('../../../systems/exploration/forage',()=>({forageWilderness:()=>({itemIds:['shiny_coin']})}));
vi.mock('../../../services/geminiService',()=>({generateHarvestLoot:vi.fn(async()=>({data:{items:[{id:'herb',name:'Herb',description:'Fixture herb'}]}}))}));
const time=new Date('0351-01-02T19:46:30.000Z');
beforeEach(()=>{
 const original=Date.prototype.toLocaleTimeString;
 vi.spyOn(Date.prototype,'toLocaleTimeString').mockImplementation(function(this:Date,locales,options){
  return options?.timeZone==='UTC' ? original.call(this,'en-US',options) : '08:04 PM';
 });
});
afterEach(()=>vi.restoreAllMocks());
describe('item discovery uses the game clock',()=>{
 it.each(['search','take','harvest'] as const)('stamps %s in UTC while preserving its normal outcome',async kind=>{
  const state=createMockGameState({currentLocationId:'cell_42',worldSeed:7,gameTime:time,party:[createMockPlayerCharacter()],dynamicLocationItemIds:kind==='take'?{cell_42:['shiny_coin']}:{} });
  const dispatch=vi.fn<(action:AppAction)=>void>(),addMessage=vi.fn();
  if(kind==='search')await handleSearchArea({gameState:state,dispatch,addMessage});
  if(kind==='take')await handleTakeItem({gameState:state,dispatch,addMessage,action:{type:'take_item',label:'Take',targetId:'shiny_coin',payload:{itemId:'shiny_coin'}}});
  if(kind==='harvest')await handleHarvestResource({gameState:state,dispatch,addMessage,addGeminiLog:vi.fn(),action:{type:'HARVEST_RESOURCE',label:'Harvest',payload:{harvestContext:'Fixture herb'}}});
  const actions=dispatch.mock.calls.map(([action])=>action);
  const entry=actions.find(a=>a.type==='ADD_DISCOVERY_ENTRY')?.payload ?? actions.find(a=>a.type==='APPLY_TAKE_ITEM_UPDATE')?.payload.discoveryEntry;
  expect(entry).toBeDefined();expect(entry?.gameTime).toBe('07:46 PM');
  expect(state.gameTime.toISOString()).toBe('0351-01-02T19:46:30.000Z');
 });
});
