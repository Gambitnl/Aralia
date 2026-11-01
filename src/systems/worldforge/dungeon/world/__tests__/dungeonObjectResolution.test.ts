import {beforeEach,describe,expect,it,vi} from 'vitest';
import {GamePhase} from '../../../../../types/core';
import {ItemType} from '../../../../../types/items';
import {createMockGameState,createMockPlayerCharacter} from '../../../../../utils/core/factories';
import {generateDungeon} from '../../generateDungeon';
import {OverlayKind,type DungeonPlan} from '../../types';
import {canonicalDungeonId} from '../dungeonIdentity';
import {dungeonEntrancePlayerCell,moveDungeonPlayer} from '../dungeonGameplay';
import {dungeonObjectId} from '../dungeonObjectActions';
import {enterDungeonExpedition,recordDungeonProgress,normalizeDungeonExpeditionLedger,retreatDungeonExpedition} from '../dungeonLifecycle';
import {resolveDungeonObject} from '../dungeonObjectResolution';
import {dungeonCaches} from '../dungeonCaches';

const fixture=vi.hoisted(()=>({plan:null as DungeonPlan|null}));
vi.mock('../deriveIdentity',async original=>({...await original<typeof import('../deriveIdentity')>(),
  generateDungeonForIdentity:()=>fixture.plan}));
const seedPath='wf:42/cell:751/dungeon:m28';
const identity={seedPath,dungeonId:canonicalDungeonId(seedPath)};
const original=generateDungeon({seed:42,seedPath,params:{theme:'crypt'}});
const player=dungeonEntrancePlayerCell(original);
const adjacent=moveDungeonPlayer(original,player,'east');
// Test-only authored coin exercises inventory settlement; no live props or outcomes are inserted.
const plan={...original,props:[{kind:'dropped-coins',x:adjacent.x*5,y:adjacent.y*5,rot:0 as const,scale:1,roomId:original.entranceId}]};
const position={depth:0,playerCell:player,entranceKind:'ruin-door' as const,
  returnContext:{worldSeed:42,cellId:751,tileX:25,tileY:16,xM:4,zM:5}};
const objectId=dungeonObjectId(identity,0);
const request={dungeonId:identity.dungeonId,objectId,intent:'examine' as const};
function startingState(){
  const state=createMockGameState({phase:GamePhase.PLAYING,worldSeed:42,
    party:[createMockPlayerCharacter({hp:9,maxHp:9})],inventory:[]});
  state.playerCell={cellId:751,localeCoords:{x:0,y:0}};
  state.dungeonExpeditions={[identity.dungeonId]:recordDungeonProgress(enterDungeonExpedition(identity),{
    activeVisit:position,exploredCellKeysByLevel:{'level:0':[`${player.x},${player.y}`,`${adjacent.x},${adjacent.y}`]},
  })};
  return state;
}

describe('atomic source-object settlement',()=>{
  beforeEach(()=>{fixture.plan=plan;});
  it('revalidates source surface observation and persists it without spending or awarding anything',()=>{
    fixture.plan={...plan,props:[],overlay:new Uint8Array(plan.overlay.length)};
    const origin=player.y*plan.W+player.x;
    fixture.plan.overlay[origin]=OverlayKind.Bloom;
    const key=`object.v1:${identity.dungeonId}:surface:bloom:${origin}`;
    let state=startingState();
    state={...state,...resolveDungeonObject(state,{...request,objectId:key})};
    state.dungeonExpeditions=normalizeDungeonExpeditionLedger(JSON.parse(JSON.stringify(state.dungeonExpeditions)));
    expect(state.dungeonExpeditions[identity.dungeonId].progress.objectFindings).toEqual({[key]:'examined'});
    expect(state.inventory).toEqual([]);expect(state.gold).toBe(startingState().gold);expect(state.party[0].hp).toBe(9);
    expect(state.dungeonExpeditions[identity.dungeonId].progress.claimedTreasureIds).toEqual([]);
    expect(state.dungeonExpeditions[identity.dungeonId].progress.clearedEncounterIds).toEqual([]);
    expect(resolveDungeonObject(state,{...request,objectId:key})).toEqual({});
    expect(resolveDungeonObject(state,{...request,objectId:key,intent:'collect'})).toEqual({});
  });
  it('lights one owned torch only from a reachable canonical fixed flame without claiming it',()=>{
    fixture.plan={...plan,props:plan.props.map(prop=>({...prop,kind:'torch' as const}))};
    const state=startingState();
    state.inventory=[{id:'torch',name:'Torch',description:'Bought torch',type:ItemType.Consumable,quantity:1,acquiredAt:123}];
    const lit=resolveDungeonObject(state,{...request,intent:'light_torch',inventoryIndex:0});
    expect(lit.inventory).toEqual([]);
    expect(lit.underdark?.activeLightSources[0].sourceItem?.acquiredAt).toBe(123);
    expect(lit.dungeonExpeditions).toBeUndefined();
    expect(fixture.plan.props[0].kind).toBe('torch');
    expect(resolveDungeonObject({...state,...lit},{...request,intent:'light_torch',inventoryIndex:0})).toEqual({});
    expect(resolveDungeonObject(state,{...request,objectId:objectId+'foreign',intent:'light_torch',inventoryIndex:0})).toEqual({});
    fixture.plan=plan;
    expect(resolveDungeonObject(state,{...request,intent:'light_torch',inventoryIndex:0})).toEqual({});
  });
  it('secures the complete fixed cache bundle and its claim together, exactly once after reload',()=>{
    // Explicit test-only treasure room isolates settlement without awarding a live expedition.
    fixture.plan={...plan,rooms:plan.rooms.map(room=>room.id===plan.entranceId?{...room,type:'treasure' as const}:room),
      spawns:[],traps:[],overlay:new Uint8Array(plan.overlay.length)};
    const cache=dungeonCaches(fixture.plan,identity).find(cache=>cache.roomId===plan.entranceId)!;
    const id=`object.v1:${identity.dungeonId}:cache:${cache.roomId}`;
    let state=startingState();
    state={...state,...resolveDungeonObject(state,{...request,objectId:id})};
    expect(state.dungeonExpeditions![identity.dungeonId].progress.objectFindings?.[id]).toBe('examined');
    state={...state,...resolveDungeonObject(state,{...request,objectId:id,intent:'collect'})};
    expect(state.inventory).toHaveLength(cache.contents[0].quantity);
    expect(state.inventory.every(item=>item.id==='gold_piece'&&item.sourceId===id)).toBe(true);
    expect(state.dungeonExpeditions![identity.dungeonId].progress.claimedTreasureIds).toEqual([cache.id]);
    expect(state.dungeonExpeditions![identity.dungeonId].progress.clearedEncounterIds).toEqual([]);
    state.dungeonExpeditions=normalizeDungeonExpeditionLedger(JSON.parse(JSON.stringify(state.dungeonExpeditions)));
    expect(resolveDungeonObject(state,{...request,objectId:id,intent:'collect'})).toEqual({});
    expect(state.inventory).toHaveLength(cache.contents[0].quantity);
    expect(state.party[0].hp).toBe(9);
  });
  it('settles one real inventory item with its source finding and preserves it through reload/revisit',()=>{
    let state=startingState();
    state={...state,...resolveDungeonObject(state,request)};
    expect(state.inventory).toHaveLength(0);
    state={...state,...resolveDungeonObject(state,{...request,intent:'collect'})};
    expect(state.inventory).toHaveLength(1);
    expect(state.inventory[0]).toMatchObject({id:'gold_piece',sourceId:objectId,type:'treasure'});
    expect(state.inventory[0].acquiredAt).toBeDefined();
    expect(state.gold).toBe(startingState().gold);
    expect(state.dungeonExpeditions![identity.dungeonId].progress.claimedTreasureIds).toEqual([]);
    state.dungeonExpeditions=normalizeDungeonExpeditionLedger(JSON.parse(JSON.stringify(state.dungeonExpeditions)));
    state={...state,...resolveDungeonObject(state,{...request,intent:'collect'})};
    expect(state.inventory).toHaveLength(1);
    const previous=state.dungeonExpeditions![identity.dungeonId];
    state.dungeonExpeditions![identity.dungeonId]=recordDungeonProgress(enterDungeonExpedition(identity,retreatDungeonExpedition(previous)),{activeVisit:position});
    expect(resolveDungeonObject(state,{...request,intent:'collect'})).toEqual({});
    expect(state.inventory).toHaveLength(1);
  });
  it('refuses remote, foreign, unobserved, terminal and downed-party collection without a finding',()=>{
    for(const state of [
      {...startingState(),worldSeed:43},
      {...startingState(),phase:GamePhase.COMBAT},
      {...startingState(),party:[createMockPlayerCharacter({hp:0})]},
    ]) expect(resolveDungeonObject(state,request)).toEqual({});
    const remote=startingState();
    remote.dungeonExpeditions![identity.dungeonId].progress.activeVisit={...position,playerCell:{x:-1,y:-1}};
    expect(resolveDungeonObject(remote,request)).toEqual({});
    expect(resolveDungeonObject(startingState(),{...request,intent:'collect'})).toEqual({});
    expect(resolveDungeonObject(startingState(),{...request,objectId:objectId+'foreign'})).toEqual({});
  });
});
