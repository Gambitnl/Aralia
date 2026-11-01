/** Proves actual household activity space rather than merely different dots. */
import { describe, expect, it } from 'vitest';
import { DOOR_CLEAR_FT } from '../../../world3d/buildingModels';
import { computeOccupancy } from '../occupancy';
import { ACTIVITY_SEPARATION_FT, placeActivityStations } from '../activityPositions';
import type { BlueprintPlan } from '../blueprintTypes';
import type { OccupantStation } from '../occupancy';
import { furnishingFootprint } from '../householdFurnish';
import { townBuildingVisit } from '../../../../components/Worldforge/townBuildingVisit';
import { renderBlueprintSvg } from '../renderBlueprintSvg';

const SEED = 1793146029630;
// GG-552 (2026-11-01): the town-look rules re-lay out every NEW town (Remy's
// ruling q2, layout revision 2). These real Sypege households keep the layout
// their save was made with, so every visit here reads layout revision 1.
const SAVED = 1 as const;
describe('station space in real Sypege homes', () => {
  it('keeps an explicit meal room shortage visible while preserving legacy shared overflow', () => {
    const plan={stairs:[],floors:[{level:0,rooms:[
      {id:0,purpose:'hall',cells:[{cx:0,cy:0}],anchor:{cx:0,cy:0},mealForSlot:'head'},
      {id:1,purpose:'hall',cells:[{cx:1,cy:0},{cx:2,cy:0},{cx:1,cy:1},{cx:2,cy:1}],anchor:{cx:1,cy:0}}
    ],doors:[{a:0,b:1,x:5,y:2.5,axis:'y'}],furnishings:[
      {kind:'table',roomId:0,x:2.5,y:2.5,rotation:0},{kind:'table',roomId:1,x:12.5,y:7.5,rotation:0}
    ]}]} as unknown as BlueprintPlan;
    const station:OccupantStation={memberIndex:0,hour:18,where:'home',level:0,roomId:0,activity:'meal',furnishingIndex:0};
    placeActivityStations(plan,[station]);
    expect(station).toMatchObject({roomId:0,furnishingIndex:0,standingIssue:'no-clear-space'});
    expect(station.standingPosition).toBeUndefined();
    const legacy=structuredClone(plan);delete legacy.floors[0].rooms[0].mealForSlot;
    const oldStation:OccupantStation={memberIndex:0,hour:18,where:'home',level:0,roomId:0,activity:'meal',furnishingIndex:0};
    placeActivityStations(legacy,[oldStation]);
    expect(oldStation).toMatchObject({roomId:1,furnishingIndex:1});
    expect(oldStation.standingPosition).toBeDefined();expect(oldStation.standingIssue).toBeUndefined();
  });
  it('keeps a resident in the door-connected part of a room rather than an isolated clear pocket', () => {
    const room = {id: 0, cells: [0, 1, 2].map(cx => ({cx, cy: 0})), anchor: {cx: 2, cy: 0}};
    const plan = {stairs: [], floors: [{level: 0, rooms: [room], doors: [{a: -1, b: 0, x: 0, y: 2.5, axis: 'y'}], furnishings: [{kind: 'bed', roomId: 0, x: 7.5, y: 2.5, rotation: 0}]}]} as unknown as BlueprintPlan;
    const station: OccupantStation = {memberIndex: 0, hour: 10, where: 'home', level: 0, roomId: 0, activity: 'chores'};
    placeActivityStations(plan, [station]);
    expect(station.standingPosition).toBeDefined();
    expect(station.standingPosition!.xFt).toBeLessThan(7.5);
  });
  it('reports a genuinely full room without removing a household member or claiming a clear position', () => {
    const plan = {stairs: [], floors: [{level: 0, rooms: [{id: 0, cells: [{cx: 0, cy: 0}], anchor: {cx: 0, cy: 0}}], doors: [], furnishings: [{kind: 'table', roomId: 0, x: 2.5, y: 2.5, rotation: 0}]}]} as unknown as BlueprintPlan;
    const station: OccupantStation = {memberIndex: 4, hour: 18, where: 'home', level: 0, roomId: 0, activity: 'meal', furnishingIndex: 0};
    placeActivityStations(plan, [station]);
    expect(station).toMatchObject({memberIndex: 4, where: 'home', activity: 'meal', standingIssue: 'no-clear-space'});
    expect(station.standingPosition).toBeUndefined();
  });
  it('gives all four Hartdown children clear, distinct chores positions without changing their lives', () => {
    const visit = townBuildingVisit(SEED, 10, 1, undefined, undefined, SAVED), home = visit.household!;
    const before = JSON.stringify({plan: visit.plan, home});
    const occ = computeOccupancy(visit.plan, home, {worksAtHome: false});
    const children = occ.stationsByHour[10].filter(s => home.members[s.memberIndex].ageBand === 'child');
    expect(children).toHaveLength(4);
    for (const station of children) {
      expect(station.activity).toBe('chores');
      expect(station.standingIssue).toBeUndefined();
      const p = station.standingPosition!;
      expect(p).toBeDefined();
      const floor = visit.plan.floors.find(f => f.level === station.level)!;
      const room = floor.rooms.find(r => r.id === station.roomId)!;
      for (const dx of [-1, 1]) for (const dy of [-1, 1]) expect(room.cells.some(c => c.cx === Math.floor((p.xFt + dx * .999) / 5) && c.cy === Math.floor((p.yFt + dy * .999) / 5))).toBe(true);
      for (const piece of floor.furnishings) {
        const b = furnishingFootprint(piece);
        expect(p.xFt + 1 <= b.left || p.xFt - 1 >= b.right || p.yFt + 1 <= b.top || p.yFt - 1 >= b.bottom).toBe(true);
      }
      for (const other of children) if (other !== station) expect(Math.hypot(p.xFt - other.standingPosition!.xFt, p.yFt - other.standingPosition!.yFt)).toBeGreaterThanOrEqual(ACTIVITY_SEPARATION_FT);
    }
    expect(JSON.stringify({plan: visit.plan, home})).toBe(before);
    expect(computeOccupancy(visit.plan, home, {worksAtHome: false})).toEqual(occ);
    expect(occ.stationsByHour[9].filter(s => home.members[s.memberIndex].ageBand === 'child').every(s => s.where === 'out')).toBe(true);
    const svg = renderBlueprintSvg(visit.plan, 0, {occupancy: occ, hour: 10, members: home.members});
    expect(svg).toContain('data-station="chores"');
  });
  it('keeps actual bed assignments while moving standing meals out of furniture', () => {
    for (const plot of [1, 2, 5]) {
      const visit = townBuildingVisit(SEED, 10, plot, undefined, undefined, SAVED);
      const occ = computeOccupancy(visit.plan, visit.household!, {worksAtHome: false});
      for (const station of occ.stationsByHour[2]) {
        expect(station.standingPosition).toBeUndefined();
        const floor = visit.plan.floors.find(f => f.level === station.level)!;
        expect(floor.furnishings[station.furnishingIndex!].kind).toBe('bed');
      }
      for (const station of occ.stationsByHour[18]) {
        expect(station.standingPosition, `plot ${plot} member ${station.memberIndex}`).toBeDefined();
        expect(station.standingIssue).toBeUndefined();
      }
    }
  });
});

describe('a crowded household supper uses its connected common space', () => {
  it('fits the real thirteen-person Menaikon household without changing its people or blueprint', () => {
    const visit = townBuildingVisit(SEED, 675, 54, undefined, undefined, SAVED);
    const before = JSON.stringify({plan: visit.plan, home: visit.household});
    const occ = computeOccupancy(visit.plan, visit.household!, {worksAtHome: false});
    const meals = occ.stationsByHour[18];
    expect(meals).toHaveLength(13);
    expect(new Set(meals.map(s => s.memberIndex)).size).toBe(13);
    expect(new Set(meals.map(s => s.roomId)).size).toBeGreaterThan(1);
    for (const s of meals) {
      expect(s).toMatchObject({where: 'home', activity: 'meal', level: 0});
      expect(s.standingIssue).toBeUndefined();
      expect(s.standingPosition).toBeDefined();
      const floor = visit.plan.floors.find(f => f.level === s.level)!;
      const room = floor.rooms.find(r => r.id === s.roomId)!;
      expect(['kitchen', 'hall', 'common-room', 'great-hall']).toContain(room.purpose);
      if(s.furnishingIndex !== undefined) expect(floor.furnishings[s.furnishingIndex].roomId).toBe(s.roomId);
      for (const other of meals) if (other !== s && other.roomId === s.roomId) {
        expect(Math.hypot(s.standingPosition!.xFt - other.standingPosition!.xFt, s.standingPosition!.yFt - other.standingPosition!.yFt)).toBeGreaterThanOrEqual((visit.household!.members[s.memberIndex].ageBand === 'child' ? 1 : 1.5) + (visit.household!.members[other.memberIndex].ageBand === 'child' ? 1 : 1.5));
      }
    }
    expect(JSON.stringify({plan: visit.plan, home: visit.household})).toBe(before);
    expect(computeOccupancy(visit.plan, visit.household!, {worksAtHome: false})).toEqual(occ);
  });
  it('never claims private or disconnected rooms to conceal supper capacity failure', () => {
    const room = (id:number, purpose:string, cx:number) => ({id,purpose,cells:[{cx,cy:0}],anchor:{cx,cy:0}});
    const plan = {stairs:[],floors:[{level:0,rooms:[room(0,'kitchen',0),room(1,'private-room',1),room(2,'hall',3)],doors:[{a:0,b:1,x:5,y:2.5,axis:'y'}],furnishings:[{kind:'table',roomId:0,x:2.5,y:2.5,rotation:0}]}]} as unknown as BlueprintPlan;
    const station:OccupantStation={memberIndex:0,hour:18,where:'home',level:0,roomId:0,furnishingIndex:0,activity:'meal'};
    placeActivityStations(plan,[station]);
    expect(station).toMatchObject({roomId:0,standingIssue:'no-clear-space'});
    expect(station.standingPosition).toBeUndefined();
  });
});


describe('evening gatherings use connected shared rooms without blocking the household',()=>{
 it('spreads the actual thirteen-person evening over shared rooms while retaining both real hearths and all lives',()=>{
  const visit=townBuildingVisit(SEED, 675, 54, undefined, undefined, SAVED),before=JSON.stringify({plan:visit.plan,home:visit.household});
  const occupancy=computeOccupancy(visit.plan,visit.household!,{worksAtHome:false});
  for(const hour of [19,20,21]){
   const stations=occupancy.stationsByHour[hour];
   expect(stations).toHaveLength(13);
   expect(new Set(stations.map(s=>s.memberIndex)).size).toBe(13);
   expect(new Set(stations.map(s=>s.roomId)).size).toBeGreaterThan(1);
   for(const s of stations){
    expect(s).toMatchObject({where:'home',activity:'hearthside',level:0});
    expect(s.standingIssue).toBeUndefined();expect(s.standingPosition).toBeDefined();
    const floor=visit.plan.floors.find(f=>f.level===s.level)!,room=floor.rooms.find(r=>r.id===s.roomId)!;
    expect(['kitchen','hall','common-room','great-hall']).toContain(room.purpose);
    if(s.furnishingIndex!==undefined){const furnishing=floor.furnishings[s.furnishingIndex];expect(furnishing.roomId).toBe(s.roomId);expect(furnishing.kind).toBe('hearth');}
    for(const other of stations)if(other!==s&&other.roomId===s.roomId)expect(Math.hypot(s.standingPosition!.xFt-other.standingPosition!.xFt,s.standingPosition!.yFt-other.standingPosition!.yFt)).toBeGreaterThanOrEqual((visit.household!.members[s.memberIndex].ageBand==='child'?1:1.5)+(visit.household!.members[other.memberIndex].ageBand==='child'?1:1.5));
   }
  }
  expect(JSON.stringify({plan:visit.plan,home:visit.household})).toBe(before);
  expect(computeOccupancy(visit.plan,visit.household!,{worksAtHome:false})).toEqual(occupancy);
 });
 it('leaves bedrooms and disconnected hearth rooms unavailable when shared capacity is exhausted',()=>{
  const room=(id:number,purpose:string,cx:number)=>({id,purpose,cells:[{cx,cy:0}],anchor:{cx,cy:0}});
  const plan={stairs:[],floors:[{level:0,rooms:[room(0,'hall',0),room(1,'private-room',1),room(2,'hall',3)],doors:[{a:0,b:1,x:5,y:2.5,axis:'y'}],furnishings:[{kind:'table',roomId:0,x:2.5,y:2.5,rotation:0},{kind:'hearth',roomId:2,x:17.5,y:2.5,rotation:0}]}]} as unknown as BlueprintPlan;
  const station:OccupantStation={memberIndex:0,hour:19,where:'home',level:0,roomId:0,activity:'hearthside'};
  placeActivityStations(plan,[station]);expect(station).toMatchObject({roomId:0,standingIssue:'no-clear-space'});expect(station.standingPosition).toBeUndefined();
 });
});


describe('entry approaches remain usable while the household gathers',()=>{
 it.each([['x',1],['x',-1],['y',1],['y',-1]] as const)('reserves the complete recorded four-foot entry on axis %s inward %s',(axis,normal)=>{
  const sideways=axis==='y';
  const owned=sideways?[{cx:0,cy:0},{cx:1,cy:0}]:[{cx:0,cy:0},{cx:0,cy:1}];
  const room={id:0,purpose:'hall',cells:owned,anchor:owned[normal===1?0:1]};
  const d={a:-1,b:0,isEntry:true,x:sideways?(normal===1?0:10):2.5,y:sideways?2.5:(normal===1?0:10),axis,clearWidthFt:4,openDir:{nx:sideways?normal:0,ny:sideways?0:normal},swingInto:0};
  const plan={stairs:[],floors:[{level:0,rooms:[room],furnishings:[],doors:[d]}]} as unknown as BlueprintPlan;
  const station:OccupantStation={memberIndex:0,hour:10,where:'home',level:0,roomId:0,activity:'chores'};
  placeActivityStations(plan,[station]);
  expect(station.standingIssue).toBeUndefined();
  const p=station.standingPosition!;
  expect((p.xFt-d.x)*d.openDir.nx+(p.yFt-d.y)*d.openDir.ny).toBeGreaterThanOrEqual(5);
 });
 it('keeps the actual entry swing clear without losing anyone in the full-day household schedules',()=>{
  for(const [burg,plot]of [[675,54],[10,1],[10,2],[10,5]]){
   const visit=townBuildingVisit(SEED, burg, plot, undefined, undefined, SAVED),before=JSON.stringify({plan:visit.plan,home:visit.household}),home=visit.household!;
   const occupancy=computeOccupancy(visit.plan,home,{worksAtHome:false});
   for(const stations of occupancy.stationsByHour)for(const s of stations){
    expect(s.standingIssue,burg+':'+plot+' member'+s.memberIndex+' hour'+s.hour).toBeUndefined();
    if(!s.standingPosition)continue;
    const floor=visit.plan.floors.find(f=>f.level===s.level)!,radius=(s.activity==='meal'||s.activity==='hearthside')&&home.members[s.memberIndex].ageBand!=='child'?1.5:1;
    for(const d of floor.doors.filter(d=>d.isEntry)){
     const p=s.standingPosition,across=d.axis==='x'?p.xFt-d.x:p.yFt-d.y,inward=(p.xFt-d.x)*d.openDir.nx+(p.yFt-d.y)*d.openDir.ny;
     expect(Math.abs(across)>=DOOR_CLEAR_FT/2+radius||inward<=-radius||inward>=DOOR_CLEAR_FT+radius,'member'+s.memberIndex+' hour'+s.hour+' across'+across+' inward'+inward).toBe(true);
    }
   }
   expect(occupancy.stationsByHour[20]).toHaveLength(home.members.length);
   expect(JSON.stringify({plan:visit.plan,home:visit.household})).toBe(before);
  }
 });
 it.each([1,-1])('follows a side entry opening inward with normal %s',normal=>{
  const room={id:0,purpose:'hall',cells:[{cx:0,cy:0},{cx:1,cy:0}],anchor:{cx:normal===1?0:1,cy:0}};
  const plan={stairs:[],floors:[{level:0,rooms:[room],furnishings:[],doors:[{a:-1,b:0,isEntry:true,x:normal===1?0:10,y:2.5,axis:'y',openDir:{nx:normal,ny:0},swingInto:0}]}]} as unknown as BlueprintPlan;
  const station:OccupantStation={memberIndex:0,hour:10,where:'home',level:0,roomId:0,activity:'chores'};
  placeActivityStations(plan,[station]);expect(station.standingIssue).toBeUndefined();
  const inward=normal===1?station.standingPosition!.xFt:10-station.standingPosition!.xFt;
  expect(inward).toBeGreaterThanOrEqual(DOOR_CLEAR_FT+1);
 });
 it('retains the existing interior-door policy rather than repeating the rejected whole-passage reservation',()=>{
  const room={id:0,purpose:'hall',cells:[{cx:0,cy:0},{cx:1,cy:0}],anchor:{cx:1,cy:0}},other={id:1,purpose:'private-room',cells:[{cx:2,cy:0}],anchor:{cx:2,cy:0}};
  const plan={stairs:[],floors:[{level:0,rooms:[room,other],furnishings:[],doors:[{a:0,b:1,isEntry:false,x:10,y:2.5,axis:'y',openDir:{nx:-1,ny:0},swingInto:0}]}]} as unknown as BlueprintPlan;
  const station:OccupantStation={memberIndex:0,hour:10,where:'home',level:0,roomId:0,activity:'chores'};
  placeActivityStations(plan,[station]);expect(station.standingPosition).toEqual({xFt:7.5,yFt:2.5});
 });
});


it('keeps a tagged legacy entry clear when its old packet lacks a swing direction',()=>{
 const room={id:0,purpose:'hall',cells:[{cx:0,cy:0},{cx:1,cy:0}],anchor:{cx:0,cy:0}};
 const plan={stairs:[],floors:[{level:0,rooms:[room],furnishings:[],doors:[{a:-1,b:0,isEntry:true,x:0,y:2.5,axis:'y',swingInto:0}]}]} as unknown as BlueprintPlan;
 const station:OccupantStation={memberIndex:0,hour:10,where:'home',level:0,roomId:0,activity:'chores'};
 placeActivityStations(plan,[station]);expect(station.standingPosition!.xFt).toBeGreaterThanOrEqual(DOOR_CLEAR_FT+1);
});


describe('entry improvement preserves established household capacity',()=>{
 it('keeps every previously available daily station in 47 real households',()=>{
  const expectedIssues:Record<string,number>={"10/6":40,"10/7":25,"10/10":13,"10/11":20,"10/14":30,"10/15":55,"10/16":13,"10/23":1,"675/3":25,"675/10":11,"675/11":10,"675/20":1,"675/21":35,"675/23":26};
  let checked=0,skipped=0;
  for(const burg of [10,675])for(let plot=0;plot<24;plot++){
   const visit=townBuildingVisit(SEED, burg, plot, undefined, undefined, SAVED);if(!visit.household){skipped++;continue;}checked++;
   const before=JSON.stringify({plan:visit.plan,home:visit.household});
   const occupancy=computeOccupancy(visit.plan,visit.household,{worksAtHome:false});
   const issues=occupancy.stationsByHour.flatMap(rows=>rows.filter(s=>s.standingIssue));
   expect(issues.length,burg+'/'+plot).toBeLessThanOrEqual(expectedIssues[burg+'/'+plot]??0);
   expect(JSON.stringify({plan:visit.plan,home:visit.household})).toBe(before);
  }
  expect({checked,skipped}).toEqual({checked:47,skipped:1});
 });
 it.each([[10,7],[10,15],[675,21]])('keeps the existing resident in cramped entry room %s/%s pending layout repair',(burg,plot)=>{
  const v=townBuildingVisit(SEED, burg, plot, undefined, undefined, SAVED),o=computeOccupancy(v.plan,v.household!,{worksAtHome:false});
  const head=o.stationsByHour[20].find(s=>s.memberIndex===0)!;
  expect(head.standingIssue).toBeUndefined();expect(head.standingPosition).toBeDefined();
  expect(head.standingPosition!.yFt).toBeLessThan(4.5);
 });
});
