/** Source-place continuity must not turn a remembered person into a follower. */
import { describe, expect, it, vi } from 'vitest';
import { createMockGameState, createMockPlayerCharacter } from '@/utils/core/factories';
import { COMPANIONS } from '@/data/companions';
import { authoredCompanionToRichNpc } from '@/systems/party/authoredCompanionToRichNpc';
import { companionsAtDestination, retainCompanionWhereabouts, separatedCompanion, placeCompanionCast } from '../companionWhereabouts';
import { companionReducer } from '@/state/reducers/companionReducer';

function meeting() {
  const companion=structuredClone(COMPANIONS.elara_vance);
  return createMockGameState({worldSeed:77,currentLocationId:'cell_3052',gameTime:new Date(10000),
    party:[createMockPlayerCharacter({id:'mara'})],companions:{elara_vance:companion},
    generatedNpcs:{elara_vance:authoredCompanionToRichNpc(companion)},currentLocationActiveDynamicNpcIds:['elara_vance']});
}
describe('companion source whereabouts',()=>{
  it('retains only actually placed companions and leaves identity, goals and memory intact',()=>{
    const state=meeting(), companions=retainCompanionWhereabouts(state);
    expect(companions.elara_vance.whereabouts).toEqual({worldSeed:77,locationId:'cell_3052',observedAt:10000,source:'encounter'});
    for(const key of ['identity','goals','memories','relationships'] as const)expect(companions.elara_vance[key]).toBe(state.companions.elara_vance[key]);
    expect(state.companions.elara_vance.whereabouts).toBeUndefined();
  });
  it('does not infer placement from a retained relationship or missing shell',()=>{
    const state=meeting();
    expect(retainCompanionWhereabouts({...state,currentLocationActiveDynamicNpcIds:null})).toBe(state.companions);
    expect(retainCompanionWhereabouts({...state,generatedNpcs:{}})).toBe(state.companions);
  });
  it('does not follow to another place, even if a transient candidate list names them',()=>{
    const state=meeting(), companions=retainCompanionWhereabouts(state);
    expect(companionsAtDestination(state,companions,'cell_3000',['elara_vance','merchant'])).toEqual(['merchant']);
    expect(companionsAtDestination(state,companions,'cell_3052',null)).toEqual(['elara_vance']);
  });
  it('does not place a source record in a different world or while in the party',()=>{
    const state=meeting(), companions=retainCompanionWhereabouts(state);
    expect(companionsAtDestination({...state,worldSeed:78},companions,'cell_3052',null)).toBeNull();
    expect(companionsAtDestination(state,{elara_vance:{...companions.elara_vance,inParty:true}},'cell_3052',null)).toBeNull();
    expect(companionsAtDestination({...state,party:[...state.party,createMockPlayerCharacter({id:'elara_vance'})]},companions,'cell_3052',null)).toBeNull();
  });
  it('preserves the original observation and physical position on subsequent departures',()=>{
    const state=meeting();const companions=retainCompanionWhereabouts(state);
    companions.elara_vance.whereabouts!.position={xM:12,yM:4,zM:20};
    expect(retainCompanionWhereabouts({...state,companions,gameTime:new Date(99999)})).toBe(companions);
  });
  it('records actual separation at the party place without returning to the old meeting',()=>{
    const state=meeting(),companion=retainCompanionWhereabouts(state).elara_vance;
    const away={...state,currentLocationId:'cell_3000',playerGroundPos:{tileX:3000,tileY:0,xM:8,yM:6,zM:9}};
    const separated=separatedCompanion(away,companion,'dismissed');
    expect(separated.whereabouts).toMatchObject({locationId:'cell_3000',position:{xM:8,yM:6,zM:9},source:'dismissed'});
    expect(companionsAtDestination(away,{elara_vance:separated},'cell_3052',null)).toBeNull();
    expect(separated.memories).toBe(companion.memories);
  });
  it('checkpoint rejects stale source, absent speakers and nonfinite coordinates',()=>{
    const state=meeting();
    const payload={companionId:'elara_vance',worldSeed:77,locationId:'cell_3052',position:{xM:12,yM:4,zM:20}};
    for(const altered of [{...payload,worldSeed:78},{...payload,locationId:'cell_3000'},{...payload,position:{...payload.position,yM:Infinity}}]){
      expect(companionReducer(state,{type:'RECORD_COMPANION_POSITION',payload:altered})).toEqual({});
    }
    expect(companionReducer({...state,currentLocationActiveDynamicNpcIds:[]},{type:'RECORD_COMPANION_POSITION',payload})).toEqual({});
  });
  it('physical checkpoint is one-time for this placement and does not follow camera re-entry',()=>{
    const state=meeting(),payload={companionId:'elara_vance',worldSeed:77,locationId:'cell_3052',position:{xM:12,yM:4,zM:20}};
    const first=companionReducer(state,{type:'RECORD_COMPANION_POSITION',payload});
    expect(first.companions!.elara_vance.whereabouts!.position).toEqual(payload.position);
    expect(companionReducer({...state,...first},{type:'RECORD_COMPANION_POSITION',payload:{...payload,position:{xM:100,yM:40,zM:200}}})).toEqual({});
  });
  it('keeps the same physical point after re-entry at a different scene origin',()=>{
    const state=meeting(),cast=[{id:'elara_vance',name:'Elara'}];
    const first=placeCompanionCast(state,cast,[100,0,200],6);
    expect(first.checkpoints[0].position).toEqual({xM:100,yM:6,zM:199});
    const change=companionReducer(state,{type:'RECORD_COMPANION_POSITION',payload:first.checkpoints[0]});
    const revisit=placeCompanionCast({...state,...change},cast,[120,0,230],50);
    expect(revisit.cast[0].position).toEqual([-20,6,-31]);
    expect(revisit.checkpoints).toEqual([]);
    const local=revisit.cast[0].position!;
    expect([120+local[0],local[1],230+local[2]]).toEqual([100,6,199]);
  });
  it('does not move a record between worlds or record missing height during separation',()=>{
    const state=meeting(),companions=retainCompanionWhereabouts(state);
    expect(retainCompanionWhereabouts({...state,worldSeed:78,companions})).toBe(companions);
    const separated=separatedCompanion({...state,playerGroundPos:{tileX:3052,tileY:0,xM:1,zM:2}},companions.elara_vance,'dismissed');
    expect(separated.whereabouts!.position).toBeUndefined();
  });
  it('samples each new person at their own feet and never resamples a retained anchor',()=>{
    const state=meeting(),cast=[{id:'elara_vance',name:'Elara'},{id:'unknown',name:'A passerby'}];
    const sample=vi.fn((x:number,z:number)=>x*.1+z*.2);
    const first=placeCompanionCast(state,cast,[100,0,200],sample);
    for(const person of first.cast){const [x,y,z]=person.position!;expect(y).toBe((100+x)*.1+(200+z)*.2);}
    expect(first.cast[0].position![1]).not.toBe(first.cast[1].position![1]);
    expect(first.checkpoints[0].position.yM).toBe(first.cast[0].position![1]);
    const change=companionReducer(state,{type:'RECORD_COMPANION_POSITION',payload:first.checkpoints[0]});
    const revisit=placeCompanionCast({...state,...change},[cast[0]],[120,0,230],()=>{throw Error('Retained anchor must not be sampled');});
    expect(revisit.cast[0].position).toEqual([first.checkpoints[0].position.xM-120,first.checkpoints[0].position.yM,first.checkpoints[0].position.zM-230]);
    expect(revisit.checkpoints).toEqual([]);
  });
  it('does not display or persist a newly sampled person without a finite surface',()=>{
    const state=meeting();const result=placeCompanionCast(state,[{id:'elara_vance',name:'Elara'}],[100,0,200],()=>NaN);
    expect(result.cast).toEqual([]);expect(result.checkpoints).toEqual([]);
  });
});
