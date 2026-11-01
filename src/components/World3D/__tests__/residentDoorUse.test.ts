import { describe, expect, it, vi } from 'vitest';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { LoadedChunk, BuildingOccupantRender } from '@/systems/world3d/types';
import { createResidentDoorSampler, mergeResidentDoorOpens } from '../residentDoorUse';
import * as groundMotion from '@/systems/worldforge/bridge/groundAgentMotion';

function fixture() {
  const occ: BuildingOccupantRender = {id:84, burgId:675, householdMemberId:'b34:head', name:'Fenna Hartham', ageBand:'adult', body:{} as never,
    stationsByHour:Array.from({length:24},(_,h)=>h<8 ? {xFt:0,yFt:10,level:0,activity:'hearthside'} : null)};
  const part={x:0,z:0,w:1,h:2,d:0.1,baseY:0,colorHex:'#65462f',door:{id:'entry',level:0,index:0,axis:'x' as const,swingX:0,swingZ:1}};
  const loaded=[{cx:0,cy:0,bundle:{sites:[{id:'wf-plot-675-34',localX:0,localZ:0,surfaceY:0,interiorWidthFt:20,interiorDepthFt:20,
    frontDoorOffsetX:0,frontDoorOffsetZ:0,parts:[part],occupants:[occ]}]}}] as unknown as LoadedChunk[];
  const ground={rosters:[{burgId:675,occupants:[{id:84,householdMemberId:'b34:head',name:occ.name,homePlotId:34,workPlotId:123,occupation:'merchant',ageBand:'adult'}]}]} as unknown as GroundWorld;
  return {loaded,ground,occ};
}

describe('resident entry use',()=>{
  it('opens the assigned leaf during departure, closes after passage, and rebuilds from the same clock',()=>{
    const {loaded,ground}=fixture();
    const sample=createResidentDoorSampler(ground,loaded,{x:0,z:0});
    expect(sample(7.5).size).toBe(0);
    const nearDeparture=8-0.2/3600;
    const users=sample(nearDeparture);
    expect([...users]).toEqual([['wf-plot-675-34/entry',['Fenna Hartham']]]);
    expect(sample(nearDeparture)).toBe(users);
    expect([...createResidentDoorSampler(ground,loaded,{x:0,z:0})(nearDeparture)]).toEqual([...users]);
    expect(sample(9).size).toBe(0);
  });
  it('requires exact source identity and name, not a nearby unrelated resident',()=>{
    const {loaded,ground,occ}=fixture();
    for (const patch of [{householdMemberId:'b99:head'},{name:'A different Fenna'},{burgId:676},{householdMemberId:undefined}]) {
      const original={...occ};Object.assign(occ,patch);
      expect(createResidentDoorSampler(ground,loaded,{x:0,z:0})(8-0.2/3600).size).toBe(0);
      Object.assign(occ,original);
    }
  });
  it('does not open during indoor chores merely because the resident goes out next hour',()=>{
    const {loaded,ground,occ}=fixture();
    // The live Hartham children walk from breakfast to chores at08:00, but
    // their OUT slot starts at09:00. A near-door chore leg is not departure.
    occ.stationsByHour[7]={xFt:14,yFt:10,level:0,activity:'meal'};
    occ.stationsByHour[8]={xFt:9,yFt:10,level:0,activity:'chores'};
    expect(createResidentDoorSampler(ground,loaded,{x:0,z:0})(8+1/3600).size).toBe(0);
    expect(createResidentDoorSampler(ground,loaded,{x:0,z:0})(9-0.2/3600).size).toBe(1);
  });
  it('opens only the actual commute endpoint near a moving street body',()=>{
    const {loaded,ground}=fixture();
    const spy=vi.spyOn(groundMotion,'groundAgentScenePositions');
    spy.mockReturnValue([{burgId:675,occupantId:84,name:'Fenna Hartham',xM:0,zM:0,surfaceY:0,moving:true}] as never);
    expect(createResidentDoorSampler(ground,loaded,{x:0,z:0})(8).size).toBe(1);
    spy.mockReturnValue([{burgId:675,occupantId:84,name:'Fenna Hartham',xM:10,zM:0,surfaceY:0,moving:true}] as never);
    expect(createResidentDoorSampler(ground,loaded,{x:0,z:0})(8).size).toBe(0);
    spy.mockRestore();
  });
  it('never erases or mutates player-saved door opens when resident use ends',()=>{
    const saved=new Set(['shop/player-open']),users=new Map([['home/entry',['Fenna Hartham']]]);
    expect([...mergeResidentDoorOpens(saved,users)!]).toEqual(['shop/player-open','home/entry']);
    expect([...saved]).toEqual(['shop/player-open']);expect(users.size).toBe(1);
    expect(mergeResidentDoorOpens(saved,new Map())).toBe(saved);
    expect(mergeResidentDoorOpens(undefined,new Map())).toBeUndefined();
  });
});
