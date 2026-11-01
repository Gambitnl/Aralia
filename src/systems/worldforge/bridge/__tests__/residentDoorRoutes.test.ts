/** Physical doors and resident timing must agree without altering source walls,
 * plot footprints, identities or the supplied roster. The rotated fixture is
 * the exact Fenna shop that exposed the plotted-wall/real-door discrepancy. */
import {describe, expect, it} from 'vitest';
import {physicalResidentDoor, residentDoorRoutes} from '../residentDoorRoutes';
import {allGroundAgentsAt} from '../groundAgentMotion';
import {commuteArrivalDelayAtHour} from '../../roster/townSnapshot';
import type {GroundWorld} from '../groundChunkLoader';
import type {TownPlan} from '../../artifacts';
import type {TownRoster, Occupant} from '../../roster/types';

const FT=0.3048;
type Building=GroundWorld['buildings'][number];
const leaf={x:0.45,z:-1.2,w:0.9144,d:0.06,h:2.1336,colorHex:'#754',
 door:{id:'source-entry',level:0,index:0,axis:'x' as const,swingX:0,swingZ:1}};
const plan={burgId:675,plots:[
 {id:10,footprint:[[0,10],[10,10],[10,20],[0,20]]},
 {id:20,footprint:[[100,10],[110,10],[110,20],[100,20]]},
],streets:[{id:1,widthFt:10,centerline:[[0,0],[110,0]]}]} as unknown as TownPlan;
const person:Occupant={id:84,name:'Fenna Hartham',householdMemberId:'b10:head',ageBand:'adult',occupation:'shopkeeper',homePlotId:10,workPlotId:20};
const roster={burgId:675,occupants:[person]} as TownRoster;
function building(plotId:number,centerFt:number,work=false):Building{
 const stations=Array.from({length:24},(_,h)=>((h>=8&&h<18)===work)
  ?{xFt:5,yFt:5,level:0,activity:work?'work' as const:'hearthside' as const}:null);
 return {id:`wf-plot-675-${plotId}`,xM:centerFt*FT,zM:15*FT,heightM:3,role:'house',wallWidthM:2.4,wallDepthM:2.4,
  cornersM:plan.plots.find(p=>p.id===plotId)!.footprint.map(([x,z])=>({x:x*FT,z:z*FT})),
  frontDoorOffsetX:0,frontDoorOffsetZ:-5*FT,parts:[{...leaf,x:work?-0.3:leaf.x}],
  occupants:[{id:84,burgId:675,name:person.name,householdMemberId:person.householdMemberId,
   ageBand:'adult',body:{} as never,stationsByHour:stations}]};
}

describe('resident physical doors',()=>{
 it('uses the actual rotated Fenna leaf instead of the plot-wall midpoint',()=>{
  const b={id:'wf-plot-675-123',xM:416.65119236600026,zM:446.1379914161906,
   cornersM:[{x:422.72341813299136,z:441.8484374336891},{x:420.9407463482179,z:452.21021718318167},
    {x:410.5789665988673,z:450.4275453984082},{x:412.3616383837827,z:440.06576564891566}],
   frontDoorOffsetX:5.180889874604345,frontDoorOffsetZ:0.8913358922448009,
   parts:[{...leaf,x:2.286,z:-4.572}]} as Building;
  const door=physicalResidentDoor(b)!;
  expect(b.xM+door.x).toBeCloseTo(420.7693994899421,9);
  expect(b.zM+door.z).toBeCloseTo(449.16608488951056,9);
 });

 it('routes from real leaf to real leaf and uses that same distance for arrival',()=>{
  const home=building(10,5),work=building(20,105,true),input=[home,work];
  const before=JSON.stringify({plan,roster,input});
  const result=residentDoorRoutes(plan,675,input,roster,{x:0,y:0});
  const atDeparture=allGroundAgentsAt({rosters:[roster],townPlans:[{burgId:675,plan,streetGraph:result.streetGraph}],boundsFeet:{x:0,y:0}} as GroundWorld,18)[0];
  expect(atDeparture.xM).toBeCloseTo(work.xM-0.3,10);
  expect(atDeparture.zM).toBeCloseTo(work.zM-1.2,10);
  const delay=result.buildings[0].occupants![0].interiorArrivalDelayByHour![18];
  expect(delay).toBeCloseTo(commuteArrivalDelayAtHour(result.streetGraph,person,18),12);
  expect(delay).toBeGreaterThan(0);
  const arrived=allGroundAgentsAt({rosters:[roster],townPlans:[{burgId:675,plan,streetGraph:result.streetGraph}],boundsFeet:{x:0,y:0}} as GroundWorld,18+delay+1e-8)[0];
  expect(arrived.xM).toBeCloseTo(home.xM+leaf.x,10);
  expect(arrived.zM).toBeCloseTo(home.zM+leaf.z,10);
  expect(arrived.moving).toBe(false);
  expect(result.buildings[0].parts).toBe(home.parts);
  expect(result.buildings[0].cornersM).toBe(home.cornersM);
  expect(result.buildings[0].occupants![0]).toMatchObject({id:84,name:person.name,householdMemberId:'b10:head'});
  expect(JSON.stringify({plan,roster,input})).toBe(before);
  // Worker structured cloning must retain the derived graph's Map receipts.
  expect(structuredClone(result.streetGraph).plotEntrances.get(10)?.door).toEqual(result.streetGraph.plotEntrances.get(10)?.door);
 });

 it('converts ground meters back through the artifact origin without shifting source geometry',()=>{
  const home=building(10,5),bounds={x:1000,y:2000};
  const shiftedPlan={...plan,plots:plan.plots.map(p=>({...p,footprint:p.footprint.map(([x,y])=>[x+bounds.x,y+bounds.y])})),
   streets:plan.streets.map(s=>({...s,centerline:s.centerline.map(([x,y])=>[x+bounds.x,y+bounds.y])}))} as TownPlan;
  const result=residentDoorRoutes(shiftedPlan,675,[home],roster,bounds);
  expect(result.streetGraph.plotEntrances.get(10)?.door[0]).toBeCloseTo((home.xM+leaf.x)/FT+bounds.x,10);
  expect(result.streetGraph.plotEntrances.get(10)?.door[1]).toBeCloseTo((home.zM+leaf.z)/FT+bounds.y,10);
 });

 it('keeps legacy midpoint routing if no physical entry is known',()=>{
  const home={...building(10,5),parts:[]};
  expect(physicalResidentDoor(home)).toBeUndefined();
  const result=residentDoorRoutes(plan,675,[home],roster,{x:0,y:0});
  expect(result.streetGraph.plotEntrances.get(10)?.door).toEqual([5,10]);
  expect(result.buildings[0].parts).toBe(home.parts);
 });
});
