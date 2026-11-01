/** Meetings must use a real nearby household member, not a destination or a
 * duplicate stranger. Family facts must survive the rich-NPC generation bridge. */
import { describe, expect, it } from 'vitest';
import { createHouseholdResidentNpc, civicResidentHomePlot, residentMemberIndex, residentNpcId, residentReachError, type ResidentPick } from '../groundResidentInteraction';
import type { TownBuildingVisit } from '../../Worldforge/townBuildingVisit';
import { householdMemberIdentity } from '../../../systems/worldforge/town/householdBrief';
import { siteLocalToScene } from '../interiorPlacement';
import { reconcileHouseholdNpc } from '../../../systems/worldforge/townsim/householdNpc';

const cells = Array.from({length: 9}, (_, i) => ({cx: i % 3, cy: Math.floor(i / 3)}));
const visit = {townName: 'Sypege', household: {homeId: 'b1', surname: 'Hartdown', occupation: 'farmer', summary: 'The Hartdowns, a farming household.', members: [
  {name: 'Bryn Hartdown', role: 'head', age: 36, ageBand: 'adult', occupation: 'farmer', race: 'Human'},
  {name: 'Cob Hartdown', role: 'child', age: 8, ageBand: 'child', occupation: '', race: 'Human'},
  {name: 'Nessa Westley', role: 'lodger', age: 29, ageBand: 'adult', occupation: 'baker', race: 'Human'},
]}, plan: {widthFt: 30, depthFt: 15, floors: [0, 1].map(level => ({level, rooms: [{id: 1, cells}]}))}} as unknown as TownBuildingVisit;
const memberId = householdMemberIdentity(visit.household!, 0);

function pick(yaw = 0, sign = -1): ResidentPick {
  return {siteId: 'wf-plot-10-1', memberId, activity: 'chores', pose: {xM: 0, zM: 0, yM: 0},
    transform: {groupX: 20, groupZ: 30, surfaceY: 4, rotationY: yaw, doorZSign: sign}};
}
function pose(p: ResidentPick, xFt = 7.5, yFt = 7.5, level = 0) {
  const t = p.transform;
  const point = siteLocalToScene((xFt - 15) * .3048, (yFt - 7.5) * .3048, {gx: t.groupX, gz: t.groupZ, rotationY: t.rotationY, doorZSign: t.doorZSign});
  return {xM: point.x, zM: point.z, yM: t.surfaceY + level * 10 * .3048};
}

describe('physical resident meetings', () => {
  it('keeps two current namesakes distinct when one old life record cannot identify either child', () => {
    const home={...visit.household!,members:[...visit.household!.members,{...visit.household!.members[1]}]};
    const source={...visit,household:home};
    const npc=createHouseholdResidentNpc(source,0,'parent',42,10);
    const life={villagers:{77:{occupantId:77,name:'Cob Hartdown',homePlotId:1,bornDay:-10000,diedDay:-1}}};
    const revised=reconcileHouseholdNpc(npc,home,0,10,'Sypege',undefined,life,3);
    const children=revised.biography.family.filter(relative=>relative.name==='Cob Hartdown');
    expect(children).toHaveLength(2);
    expect(new Set(children.map(child=>child.id)).size).toBe(2);
    expect(children.every(child=>child.isAlive)).toBe(true);
    expect(revised.initialPersonalityPrompt).toContain('life record unresolved');
    expect(revised.initialPersonalityPrompt).not.toContain('deceased');
  });
  it('keeps a deceased parent in family history without claiming they are alive or resetting memory', () => {
    const npc=createHouseholdResidentNpc(visit,1,'child',42,10);
    const memory=npc.memory;
    const life={villagers:{77:{occupantId:77,name:'Bryn Hartdown',homePlotId:1,bornDay:-10000,diedDay:-1}}};
    const revised=reconcileHouseholdNpc(npc,visit.household!,1,10,'Sypege',undefined,life,3);
    expect(revised.biography.family).toEqual([expect.objectContaining({name:'Bryn Hartdown',relation:'parent',isAlive:false})]);
    expect(revised.initialPersonalityPrompt).toContain('farmer, deceased');
    expect(revised.memory).toBe(memory);
    expect(revised.id).toBe(npc.id);
    expect(reconcileHouseholdNpc(revised,visit.household!,1,10,'Sypege',undefined,life,3)).toBe(revised);
  });
  for (const yaw of [0, .7, -2.2]) for (const sign of [-1, 1]) it(`uses the actual room under yaw ${yaw}, mirror ${sign}`, () => {
    const p = pick(yaw, sign); p.pose = pose(p);
    expect(residentReachError(visit, p, pose(p, 9))).toBeNull();
    expect(residentReachError(visit, p, pose(p, 9, 7.5, 1))).toContain('same room and floor');
    expect(residentReachError(visit, p, pose(p, 15.1))).toContain('same room and floor');
  });
  it('rejects missing bodies, stale identities, distant feet and pending arrival', () => {
    const p = pick(); p.pose = pose(p, 1);
    expect(residentReachError(visit, null, pose(p))).toContain('no longer');
    expect(residentReachError(visit, {...p, memberId: 'missing'}, pose(p))).toContain('no longer');
    expect(residentReachError(visit, p, pose(p, 14))).toContain('Move closer');
    expect(residentReachError(visit, p, null)).toContain('arrives');
    expect(residentReachError(visit, p, {...pose(p), yM: NaN})).toContain('arrives');
  });
  it('keeps stable household identities distinct while reusing keeper memory ids', () => {
    expect(residentMemberIndex(visit, memberId)).toBe(0);
    expect(residentNpcId(10, memberId)).not.toBe(residentNpcId(11, memberId));
    expect(residentNpcId(10, memberId, 0)).toBe('npc_burg_10_plot_0');
  });
  it('replaces generated strangers and random family prose with the actual household', () => {
    const npc = createHouseholdResidentNpc(visit, 0, residentNpcId(10, memberId), 42, 10);
    expect(npc.name).toBe('Bryn Hartdown');
    expect(npc.biography.age).toBe(36);
    expect(npc.biography.family).toEqual([{id: 'npc_burg_10_member_b1:child:0', name: 'Cob Hartdown', age: 8, occupation: '', relation: 'child', isAlive: true}]);
    expect(npc.biography.background).toBeUndefined();
    expect(npc.initialPersonalityPrompt).toContain('Nessa Westley (lodger');
    expect(npc.memory!.lastInteractionTimestamp).toBe(0);
    expect(npc.memory!.knownFacts).toHaveLength(0);
  });
  it('records children’s actual parents without inventing lodger relationships', () => {
    const npc = createHouseholdResidentNpc(visit, 1, 'child', 42, 10);
    expect(npc.biography.age).toBe(8);
    expect(npc.biography.classId).toBe('commoner');
    expect(npc.equippedItems).toEqual({});
    expect(npc.visual?.description).toContain('child Human');
    expect(npc.biography.family.map(m => [m.name, m.relation])).toEqual([['Bryn Hartdown', 'parent']]);
  });
});


describe('source-admitted street contact',()=>{
 const clearGround={cols:1,rows:1,heights:[0],buildings:[]} as unknown as import('../../../systems/worldforge/bridge/groundChunkLoader').GroundWorld;
 const streetPick=()=>({...pick(),streetOwned:true,pose:{xM:50.8,zM:50,yM:0}});
 it('allows a nearby outdoor conversation without projecting either person into the home room',()=>{
  const p=streetPick(),player={xM:49.2,zM:50,yM:0};const before=JSON.stringify({p,player,ground:clearGround});
  expect(residentReachError(visit,p,player,{ground:clearGround})).toBeNull();expect(JSON.stringify({p,player,ground:clearGround})).toBe(before);
  expect(residentReachError(visit,{...p,streetOwned:undefined},player)).toContain('same room');
 });
 it('requires the actual source ground and retains range, floor and identity admission',()=>{
  const p=streetPick(),player={xM:49.2,zM:50,yM:0};
  expect(residentReachError(visit,p,player)).not.toBeNull();
  expect(residentReachError(visit,p,{...player,xM:45},{ground:clearGround})).toContain('Move closer');
  expect(residentReachError(visit,p,{...player,yM:1},{ground:clearGround})).not.toBeNull();
  expect(residentReachError(visit,{...p,memberId:'missing'},player,{ground:clearGround})).toContain('no longer');
 });
 it('does not talk through the same closed door that blocks native walking, and rechecks its open state',()=>{
  const p=streetPick(),player={xM:49.2,zM:50,yM:0};
  const door={x:0,z:0,w:.16,d:1,h:2.2,colorHex:'#65462f',door:{id:'entry',axis:'y' as const,swingX:1,swingZ:1}};
  const ground={...clearGround,buildings:[{id:'door-house',xM:50,zM:50,cornersM:[{x:45,z:45},{x:55,z:45},{x:55,z:55},{x:45,z:55}],parts:[door]}]} as unknown as typeof clearGround;
  expect(residentReachError(visit,p,player,{ground})).not.toBeNull();
  expect(residentReachError(visit,p,player,{ground,openDoors:new Set(['door-house/entry'])})).toBeNull();
  expect(residentReachError(visit,p,player,{ground,openDoors:new Set()})).not.toBeNull();
 });
});


describe('first physical registration uses the same life facts as reload', () => {
  for (const deceased of [false, true]) it(`retains a parent's ${deceased ? 'recorded death' : 'living status'} from first contact`, () => {
    const life = {villagers: {77: {occupantId: 77, name: 'Bryn Hartdown', homePlotId: 1, householdMemberId: 'b1:head', bornDay: -10000, ...(deceased ? {diedDay: 2} : {})}}};
    const npc = createHouseholdResidentNpc(visit, 1, 'child', 42, 10, undefined, life, 3);
    expect(npc.biography.family).toEqual([expect.objectContaining({name: 'Bryn Hartdown', lifeStatus: deceased ? 'deceased' : 'alive', isAlive: !deceased})]);
    // A normal load with the same real day must not repair the new person's
    // family or regenerate their signature after the meeting was already saved.
    expect(reconcileHouseholdNpc(npc, visit.household!, 1, 10, 'Sypege', undefined, life, 3)).toBe(npc);
    expect(npc.memory!.knownFacts).toEqual([]);
  });
});


describe('one household person at a public institution', () => {
  const rosters=()=>[{burgId:675,occupants:[{id:145,name:'Faelan Ironsmith',householdMemberId:'b54:spouse',homePlotId:54,ageBand:'elder',occupation:'resident',civicWorkplace:{role:'priest',plotId:168}}]}] as import('../../../systems/worldforge/roster/types').TownRoster[];
  it('resolves only the explicit same-town duty back to its real home without changing NPC identity', () => {
    const source=rosters(),before=JSON.stringify(source);
    expect(civicResidentHomePlot(675,168,'b54:spouse',source)).toBe(54);
    expect(residentNpcId(675,'b54:spouse',source[0].occupants[0].workPlotId)).toBe('npc_burg_675_member_b54:spouse');
    expect(JSON.stringify(source)).toBe(before);
    expect(civicResidentHomePlot(676,168,'b54:spouse',source)).toBeUndefined();
    expect(civicResidentHomePlot(675,49,'b54:spouse',source)).toBeUndefined();
    expect(civicResidentHomePlot(675,168,'b54:head',source)).toBeUndefined();
  });
  it('refuses ambiguous, stale, child, retired and merchant duty rows', () => {
    for(const kind of ['duplicate','home','child','retired','merchant'] as const){
      const source=rosters(),p=source[0].occupants[0];
      if(kind==='duplicate')source[0].occupants.push({...p,id:146});
      if(kind==='home')p.homePlotId=55;
      if(kind==='child')p.ageBand='child';
      if(kind==='retired')p.retired=true;
      if(kind==='merchant')p.workPlotId=7;
      expect(civicResidentHomePlot(675,168,'b54:spouse',source),kind).toBeUndefined();
    }
  });
  it('uses the actual temple room for physical reach while retaining home-family admission', () => {
    const p=pick();p.siteId='wf-plot-10-99';p.pose=pose(p,17.5);
    const player=pose(p,18.5);
    const space={...visit,plot:{id:99},household:undefined,plan:{widthFt:40,depthFt:30,floors:[{level:0,rooms:[{id:88,cells:[{cx:4,cy:3}]}]}]}} as unknown as TownBuildingVisit;
    const ground={buildings:[],cols:1,rows:1,heights:[0]} as unknown as import('../../../systems/worldforge/bridge/groundChunkLoader').GroundWorld;
    expect(residentReachError(visit,p,player)).toContain('same room');
    expect(residentReachError(visit,p,player,{ground,spaceVisit:space})).toBeNull();
    expect(residentReachError(visit,{...p,memberId:'missing'},player,{ground,spaceVisit:space})).toContain('no longer');
    expect(residentReachError(visit,p,pose(p,18.5,7.5,1),{ground,spaceVisit:space})).toContain('same room');
    expect(residentReachError(visit,{...p,siteId:'wf-plot-10-100'},player,{ground,spaceVisit:space})).toContain('moved');
  });
});
