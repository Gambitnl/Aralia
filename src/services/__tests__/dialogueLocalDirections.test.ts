/** The normal dialogue control publishes source directions once, with no model or travel side effects. */
import React from 'react';
import {getGameDay} from '../../utils/core';
import { DiscoveryType } from '../../types';
import { logReducer } from '../../state/reducers/logReducer';
import type { AppAction } from '../../state/actionTypes';
import DiscoveryLogPane from '../../components/Logbook/DiscoveryLogPane';

import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { createMockGameState } from '../../utils/core/factories';
import type { GameState, PlayerCharacter, RichNPC } from '../../types';
import { processTopicSelection } from '../dialogueService';
import { DialogueInterface } from '../../components/Dialogue/DialogueInterface';
import { useDialogueSystem } from '../../hooks/useDialogueSystem';
import { CURRENT_TOWN_LAYOUT_REVISION } from '../../systems/worldforge/town/townLayoutRevision';

const officeMap=vi.hoisted(()=>({y:-300,present:true}));
beforeEach(()=>Object.assign(officeMap,{y:-300,present:true}));
vi.mock('../../systems/worldforge/bridge/legacySubmapBridge',()=>({getBridgeAtlas:()=>({pack:{burgs:{253:{i:253,cell:1885,name:'Putivl'}}}})}));
vi.mock('../../systems/worldforge/townsim/chronicleForLocation',()=>({burgIdForLocation:({cellId}:{cellId:number})=>cellId===1885?253:undefined}));
vi.mock('../../systems/worldforge/townsim/householdNpc',async importOriginal=>({...await importOriginal<typeof import('../../systems/worldforge/townsim/householdNpc')>(),householdNpcAliveAt:()=>true,householdNpcDescription:()=> 'A local tavern keeper.'}));
vi.mock('../../systems/worldforge/town/canonicalTown',()=>({townSpanFtForBurg:()=>1000,canonicalArtifactTownForSiteFromAtlas:()=>({plan:{plots:[{id:27,role:'market',footprint:[[295,-305],[305,-305],[305,-295],[295,-295]],pop:{buildingType:'tavern',residential:false,proprietorHomeId:'b143'}},...(officeMap.present?[{id:168,role:'temple',footprint:[[-5,officeMap.y-5],[5,officeMap.y-5],[5,officeMap.y+5],[-5,officeMap.y+5]]}]:[])]}})}));
afterEach(cleanup);
const make=()=>{
  const npc={id:'hilda',name:'Hilda Fairbourne',role:'merchant',businessId:'tavern',occupation:'taverner',
    worldforgeHousehold:{burgId:253,memberId:'b143:head'},initialPersonalityPrompt:'Hilda keeps the tavern.'} as unknown as RichNPC;
  const session={npcId:'hilda',discussedTopicIds:[] as string[]};
  const state=createMockGameState({worldSeed:7,currentLocationId:'cell_1885',playerCell:{cellId:1885,localeCoords:{x:0,y:0}},generatedNpcs:{hilda:npc},activeDialogueSession:session,
    npcMemory:{hilda:{disposition:50,knownFacts:[],suspicion:0,goals:[],lastInteractionTimestamp:0}},
    worldBusinesses:{tavern:{id:'tavern',name:'The Gilded Wonders',ownerId:'hilda',burgId:253,plotId:27,locationId:'cell_1885',stock:[]}} as unknown as GameState['worldBusinesses']});
  return {npc,session,state};
};
describe('factual local directions in normal dialogue',()=>{
  it('answers the existing directions topic from the source geometry',()=>{
    const p=make(),before=JSON.stringify(p.state);
    const result=processTopicSelection('global_directions',p.state,{...p.session,discussedTopicIds:[]},0,p.npc);
    expect(result.directReply?.text).toContain('northeastern part of town');
    expect(result.unlocks).toEqual([]); expect(result.deductions).toBeUndefined();
    expect(JSON.stringify(p.state)).toBe(before);
  });
  it('delivers through the existing control and hook without a generation request, visited-place or resource award',()=>{
    const p=make(),dispatch=vi.fn(),generate=vi.fn(),update=vi.fn();
    function Harness(){const hook=useDialogueSystem(p.state,dispatch);return React.createElement(DialogueInterface,{npc:p.npc,isOpen:true,session:p.session,gameState:p.state,
      playerCharacter:{id:'fianna',abilityScores:{Charisma:10}} as PlayerCharacter,onClose:vi.fn(),onUpdateSession:update,onGenerateResponse:generate,onTopicOutcome:hook.handleTopicOutcome});}
    render(React.createElement(Harness)); fireEvent.click(screen.getByRole('button',{name:'I need directions.'}));
    expect(screen.getByText(/You're in Putivl/)).toHaveTextContent('The Gilded Wonders is my tavern');
    expect(generate).not.toHaveBeenCalled(); expect(update).toHaveBeenCalledOnce();
    expect(dispatch.mock.calls.map(c=>c[0].type)).toEqual(['DISCUSS_TOPIC','SET_LAST_NPC_INTERACTION','ADD_DISCOVERY_ENTRY']);
    expect(p.session.discussedTopicIds).toEqual([]);
  });
  it('revalidates a town change before publishing the direct answer',()=>{
    const p=make(),result=processTopicSelection('global_directions',p.state,{...p.session,discussedTopicIds:[]},0,p.npc),dispatch=vi.fn();
    const changed={...p.state,playerCell:{cellId:99,localeCoords:{x:0,y:0}}} as GameState;
    // The existing publication guard is also exposed through the controller hook.
    const outcome=renderHook(()=>useDialogueSystem(changed,dispatch)).result.current.handleTopicOutcome;
    expect(()=>outcome(result,'global_directions')).toThrow('no longer available');
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe('directions retained in the existing player Logbook',()=>{
  const publish=()=>{
    const p=make(),dispatch=vi.fn();
    function Harness(){const hook=useDialogueSystem(p.state,dispatch);return React.createElement(DialogueInterface,{npc:p.npc,isOpen:true,session:p.session,gameState:p.state,
      playerCharacter:{id:'fianna',abilityScores:{Charisma:10}} as PlayerCharacter,onClose:vi.fn(),onUpdateSession:vi.fn(),onGenerateResponse:vi.fn(),onTopicOutcome:hook.handleTopicOutcome});}
    render(React.createElement(Harness));fireEvent.click(screen.getByRole('button',{name:'I need directions.'}));
    return {p,actions:dispatch.mock.calls.map(c=>c[0] as AppAction)};
  };
  const logged=(state:GameState,actions:AppAction[])=>actions.reduce((s,a)=>({...s,...logReducer(s,a)}),state);
  it('retains the actually heard speaker and words after transient replies clear and the save round trip',()=>{
    const {p,actions}=publish(),state=logged(p.state,actions);
    expect(state.discoveryLog).toHaveLength(1);
    const entry=state.discoveryLog[0];expect(entry.type).toBe(DiscoveryType.NPC_INTERACTION);
    expect(entry.source).toEqual({type:'NPC',id:'hilda',name:'Hilda Fairbourne'});
    expect(entry.content).toContain("You're in Putivl. The Gilded Wonders is my tavern, in the northeastern part of town.");
    expect(entry.gameTime).toBe(p.state.gameTime.toISOString());
    expect(entry.worldMapCoordinates).toBeUndefined();expect(state.discoveredHiddenSites).toEqual(p.state.discoveredHiddenSites);
    const reloaded=JSON.parse(JSON.stringify({...state,lastNpcResponse:null,lastInteractedNpcId:null})) as GameState;
    cleanup();render(React.createElement(DiscoveryLogPane,{isOpen:true,entries:reloaded.discoveryLog,unreadCount:1,onClose:vi.fn(),onMarkRead:vi.fn(),onMarkAllRead:vi.fn(),npcMemory:p.state.npcMemory,allNpcs:{hilda:p.npc}}));
    fireEvent.change(screen.getByPlaceholderText('Search entries...'),{target:{value:'Gilded Wonders'}});
    expect(screen.getByText(/You're in Putivl/)).toBeVisible();
    expect(screen.getByRole('heading',{name:'Directions from Hilda Fairbourne'})).toBeVisible();
  });
  it('does not duplicate the same advice when its publication is repeated before a rerender',()=>{
    const {p,actions}=publish(),first=logged(p.state,actions),again=logged(first,actions);
    expect(first.discoveryLog).toHaveLength(1);expect(again.discoveryLog).toEqual(first.discoveryLog);
    expect(again.unreadDiscoveryCount).toBe(first.unreadDiscoveryCount);
  });
  it('retains changed advice and a different source instead of erasing meaningful accounts',()=>{
    const {p,actions}=publish(),account=actions.find(a=>a.type==='ADD_DISCOVERY_ENTRY');
    expect(account).toBeDefined();if(!account||account.type!=='ADD_DISCOVERY_ENTRY')return;
    const first=logged(p.state,[account]);
    const changed={...account,payload:{...account.payload,content:'The public tavern has moved to another street.'}} as AppAction;
    const other={...account,payload:{...account.payload,source:{type:'NPC',id:'other',name:'Another keeper'}}} as AppAction;
    const foreign={...account,payload:{...account.payload,id:account.payload.id?.replace('npc-directions:7:','npc-directions:8:')}} as AppAction;
    expect(logged(first,[changed,other,foreign]).discoveryLog).toHaveLength(4);
    const routine={...account,payload:{...account.payload,flags:[]}} as AppAction;
    expect(logged(first,[routine,routine]).discoveryLog).toHaveLength(3);
  });
});

const makePriest=()=>{
 const p=make(),day=getGameDay(p.state.gameTime);delete p.state.worldBusinesses.tavern;delete p.npc.businessId;p.npc.role='civilian';p.npc.occupation='keeps the household';
 // A saved town with no layoutRevision now gives only "You're in <town>." (no
 // building directions until source admission), so the fixture states the current one.
 p.state.townSim={253:{burgId:253,layoutRevision:CURRENT_TOWN_LAYOUT_REVISION,villagers:{84:{occupantId:84,name:p.npc.name,householdMemberId:'b143:head',homePlotId:143,bornDay:day-50*365,role:'priest',parentIds:[],childIds:[]}},lastSimDay:day,nextVillagerId:85}} as unknown as GameState['townSim'];return p;
};
describe('priest guidance through existing dialogue publication',()=>{
 const publishPriest=()=>{
  const p=makePriest(),dispatch=vi.fn(),generate=vi.fn();
  function Harness(){const hook=useDialogueSystem(p.state,dispatch);return React.createElement(DialogueInterface,{npc:p.npc,isOpen:true,session:p.session,gameState:p.state,playerCharacter:{id:'sana',abilityScores:{Charisma:10}} as PlayerCharacter,onClose:vi.fn(),onUpdateSession:vi.fn(),onGenerateResponse:generate,onTopicOutcome:hook.handleTopicOutcome});}
  render(React.createElement(Harness));fireEvent.click(screen.getByRole('button',{name:'I need directions.'}));return {p,dispatch,generate};
 };
 it('uses the existing public question, spoken reply and learned-directions Logbook without a generated request or reward',()=>{
  const {p,dispatch,generate}=publishPriest();expect(screen.getByText(/You're in Putivl/)).toHaveTextContent('The temple is in the northern part of town.');
  expect(generate).not.toHaveBeenCalled();expect(dispatch.mock.calls.map(c=>c[0].type)).toEqual(['DISCUSS_TOPIC','SET_LAST_NPC_INTERACTION','ADD_DISCOVERY_ENTRY']);
  const a=dispatch.mock.calls.find(c=>c[0].type==='ADD_DISCOVERY_ENTRY')![0] as Extract<AppAction,{type:'ADD_DISCOVERY_ENTRY'}>;
  expect(a.payload.source).toEqual({type:'NPC',id:p.npc.id,name:p.npc.name});expect(a.payload.content).toContain('The temple is in the northern part of town.');
  expect(a.payload.worldMapCoordinates).toBeUndefined();expect(p.state.discoveredHiddenSites).toEqual([]);expect(p.session.discussedTopicIds).toEqual([]);
 });
 it.each(['changed-office','changed-temple','missing-temple'])('rejects %s before publishing a now-stale answer',kind=>{
  const p=makePriest(),result=processTopicSelection('global_directions',p.state,{...p.session,discussedTopicIds:[]},0,p.npc),dispatch=vi.fn();
  if(kind==='changed-office')p.state.townSim[253].villagers[84].role='lord';if(kind==='changed-temple')officeMap.y=300;if(kind==='missing-temple')officeMap.present=false;
  const outcome=renderHook(()=>useDialogueSystem(p.state,dispatch)).result.current.handleTopicOutcome;
  expect(()=>outcome(result,'global_directions')).toThrow('no longer available');expect(dispatch).not.toHaveBeenCalled();
 });
 it('retains original heard temple wording and speaker in the Logbook after save reload and a later office change',()=>{
  const {p,dispatch}=publishPriest(),actions=dispatch.mock.calls.map(c=>c[0] as AppAction);let saved=actions.reduce((s,a)=>({...s,...logReducer(s,a)}),p.state);
  saved=JSON.parse(JSON.stringify(saved));saved.townSim[253].villagers[84].role='lord';cleanup();
  render(React.createElement(DiscoveryLogPane,{isOpen:true,entries:saved.discoveryLog,unreadCount:1,onClose:vi.fn(),onMarkRead:vi.fn(),onMarkAllRead:vi.fn(),npcMemory:saved.npcMemory,allNpcs:{hilda:p.npc}}));
  fireEvent.change(screen.getByPlaceholderText('Search entries...'),{target:{value:'temple'}});expect(screen.getByText(/You're in Putivl/)).toHaveTextContent('The temple is in the northern part of town.');expect(screen.getByRole('heading',{name:'Directions from Hilda Fairbourne'})).toBeVisible();expect(saved.discoveryLog).toHaveLength(1);
 });
});
