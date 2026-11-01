/** Destination disclosure must remain source-bound knowledge, separate from
 * player commitment, consent, secret history and already completed promises. */
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {createMockGameState, createMockPlayerCharacter} from '@/utils/core';
import {COMPANIONS} from '@/data/companions';
import {enumerateDungeonSites} from '@/systems/worldforge/dungeon/world/dungeonSites';
import type {DungeonSite} from '@/systems/worldforge/dungeon/world/dungeonSites';
import {companionReducer} from '../companionReducer';
vi.mock('@/systems/worldforge/dungeon/world/dungeonSites',()=>({enumerateDungeonSites:vi.fn()}));
const source={sourceId:'elara_restore_temple_v1',version:1,worldSeed:77,companionId:'elara_vance',goalId:'restore_temple',name:'Temple of the Morning',entranceName:'Temple of the Morning: Undercroft',builderName:'the Order of the Morning',nearbyBurgId:164,nearbyBurgName:'Neapodes',settlementDistanceCells:1} as const;
const site={sitePath:'wf:77/cell:4414/dungeon:temple-morning-v1',cellId:4414,authoredGoal:source} as DungeonSite;
const selection={companionId:'elara_vance',goalId:'restore_temple',worldSeed:77,sitePath:site.sitePath};
const fresh=()=>createMockGameState({worldSeed:77,currentLocationId:'cell_3052',currentLocationActiveDynamicNpcIds:['elara_vance'],metNpcIds:['elara_vance'],
  party:[createMockPlayerCharacter({id:'mara',name:'Mara Tanner'})],companions:{elara_vance:structuredClone(COMPANIONS.elara_vance)},
  gameTime:new Date('0351-01-01T18:26:00Z'),activeConversation:{id:'elara',participants:['elara_vance'],messages:[],startedAt:1,isPlayerTurn:true,pendingResponse:false}});
const discuss=(state=fresh(),payload=selection)=>companionReducer(state,{type:'DISCUSS_COMPANION_DESTINATION',payload});
beforeEach(()=>vi.mocked(enumerateDungeonSites).mockReturnValue([site]));
describe('public companion destination',()=>{
  it('records the real source and one attributed disclosure without commitment or reward',()=>{
    const state=fresh(),patch=discuss(state),c=patch.companions!.elara_vance;
    expect(c.goals.find(g=>g.id==='restore_temple')!.disclosedDestination).toMatchObject({worldSeed:77,sitePath:site.sitePath,cellId:4414,nearbyBurgName:'Neapodes',sharedAt:state.gameTime.getTime()});
    expect(c.memories.at(-1)!.text).toContain('not a promise');
    expect(patch.discoveryLog![0]).toMatchObject({associatedLocationId:'cell_4414',source:{id:'elara_vance'}});
    expect(patch.activeConversation!.messages.at(-1)!.text).toContain('safe approach');
    expect(patch.activeConversation!.messages.every(m=>m.memoryHandled)).toBe(true);
    for(const key of ['relationships','questline','inventory','whereabouts','identity','inParty'] as const)expect(c[key]).toBe(state.companions.elara_vance[key]);
    for(const key of ['questLog','party','inventory','gold','playerGroundPos'] as const)expect(patch).not.toHaveProperty(key);
    expect(c.goals.map(g=>[g.id,g.status,g.progress,g.isSecret])).toEqual(state.companions.elara_vance.goals.map(g=>[g.id,g.status,g.progress,g.isSecret]));
  });
  it('recalls serialized disclosure without changing its date, memory or log',()=>{
    const first={...fresh(),...discuss()};
    first.companions=JSON.parse(JSON.stringify(first.companions));
    first.gameTime=new Date(first.gameTime.getTime()+3600000);
    const second=discuss(first);
    expect(second.companions!.elara_vance.goals).toBe(first.companions.elara_vance.goals);
    expect(second.companions!.elara_vance.memories).toBe(first.companions.elara_vance.memories);
    expect(second).not.toHaveProperty('discoveryLog');
  });
  it.each(['absent','unmet','closed','pending','npc-turn','secret','completed','wrong-goal','wrong-site','wrong-world','foreign-speaker','missing-source'] as const)('refuses %s',reason=>{
    const state=fresh(),payload={...selection},goal=state.companions.elara_vance.goals.find(g=>g.id==='restore_temple')!;
    if(reason==='absent')state.currentLocationActiveDynamicNpcIds=[];
    if(reason==='unmet')state.metNpcIds=[];
    if(reason==='closed')state.activeConversation=null;
    if(reason==='pending')state.activeConversation!.pendingResponse=true;
    if(reason==='npc-turn')state.activeConversation!.isPlayerTurn=false;
    if(reason==='secret')goal.isSecret=true;
    if(reason==='completed')goal.status='completed';
    if(reason==='wrong-goal')payload.goalId='find_sister';
    if(reason==='wrong-site')payload.sitePath='sewer';
    if(reason==='wrong-world')payload.worldSeed=78;
    if(reason==='foreign-speaker')state.companions.elara_vance.whereabouts={worldSeed:78,locationId:'cell_3052',source:'encounter',observedAt:1};
    if(reason==='missing-source')vi.mocked(enumerateDungeonSites).mockReturnValue([]);
    expect(discuss(state,payload)).toEqual({});
  });
  it('refuses a canonical source belonging to a different full seed',()=>{
    vi.mocked(enumerateDungeonSites).mockReturnValue([{...site,authoredGoal:{...source,worldSeed:78}}]);
    expect(discuss()).toEqual({});
  });
  it('does not replace learned directions if the regenerated catalog selects a different site',()=>{
    const first={...fresh(),...discuss()};
    vi.mocked(enumerateDungeonSites).mockReturnValue([{...site,sitePath:'wf:77/cell:4413/dungeon:temple-morning-v1',cellId:4413}]);
    expect(discuss(first,{...selection,sitePath:'wf:77/cell:4413/dungeon:temple-morning-v1'})).toEqual({});
    expect(first.companions.elara_vance.goals.find(g=>g.id==='restore_temple')!.disclosedDestination!.sitePath).toBe(site.sitePath);
  });
});
