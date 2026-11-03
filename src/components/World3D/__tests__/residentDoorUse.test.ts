import { describe, expect, it, vi } from 'vitest';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { LoadedChunk, BuildingOccupantRender } from '@/systems/world3d/types';
import { createResidentDoorSampler, mergeResidentDoorOpens } from '../residentDoorUse';
import * as groundMotion from '@/systems/worldforge/bridge/groundAgentMotion';
import { occupantLocationAt } from '@/systems/worldforge/roster/occupantSchedule';
import type { TownPlan } from '@/systems/worldforge/artifacts';

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
    // GG-606: street positions are kept per ground and clock (a pure function of
    // both), so the moved body is a new ground state, not the same ground again.
    expect(createResidentDoorSampler({...ground},loaded,{x:0,z:0})(8).size).toBe(0);
    spy.mockRestore();
  });
  it('opens the home leaf for an errand trip when the town street graph is known (GG-601)',()=>{
    const {loaded,ground,occ}=fixture();
    // A resident with no job: their OUT block is an errand to the market.
    const person={id:84,householdMemberId:'b34:head',name:occ.name,homePlotId:34,occupation:'resident',ageBand:'adult'} as const;
    const out=Array.from({length:24},(_,h)=>h).filter(h=>occupantLocationAt(person as never,h).activity==='out');
    expect(out.length).toBeGreaterThan(0);
    occ.stationsByHour=Array.from({length:24},(_,h)=>out.includes(h)?null:{xFt:0,yFt:10,level:0,activity:'hearthside'});
    const plan={burgId:675,streets:[{id:1,widthFt:10,centerline:[[-50,0],[600,0]]}],plots:[
      {id:34,role:'house',footprint:[[0,5],[20,5],[20,25],[0,25]]},
      {id:200,role:'market',footprint:[[200,5],[220,5],[220,25],[200,25]]}]} as unknown as TownPlan;
    const spy=vi.spyOn(groundMotion,'groundAgentScenePositions');
    spy.mockReturnValue([{burgId:675,occupantId:84,name:occ.name,xM:0,zM:0,surfaceY:0,moving:true}] as never);
    const leaving=out[0]+0.01;
    const withoutGraph={rosters:[{burgId:675,occupants:[person]}]} as unknown as GroundWorld;
    expect(createResidentDoorSampler(withoutGraph,loaded,{x:0,z:0})(leaving).size).toBe(0);
    const withGraph={...withoutGraph,townPlans:[{burgId:675,plan}]} as unknown as GroundWorld;
    expect([...createResidentDoorSampler(withGraph,loaded,{x:0,z:0})(leaving)]).toEqual([['wf-plot-675-34/entry',[occ.name]]]);
    spy.mockRestore();
    void ground;
  });
  it('never erases or mutates player-saved door opens when resident use ends',()=>{
    const saved=new Set(['shop/player-open']),users=new Map([['home/entry',['Fenna Hartham']]]);
    expect([...mergeResidentDoorOpens(saved,users)!]).toEqual(['shop/player-open','home/entry']);
    expect([...saved]).toEqual(['shop/player-open']);expect(users.size).toBe(1);
    expect(mergeResidentDoorOpens(saved,new Map())).toBe(saved);
    expect(mergeResidentDoorOpens(undefined,new Map())).toBeUndefined();
  });
});
