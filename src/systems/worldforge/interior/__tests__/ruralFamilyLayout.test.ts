/** Fresh farm recipes improve sleeping space without regenerating retained homes. */
import {describe,it,expect} from 'vitest';
import {blueprintForPlot,type InteriorPlotInput} from '../generateInterior';
import {generateBuilding} from '../generateBuilding';
import {seatRuralSharedEntry,ruralFamilyMissingBeds,ruralFamilyMissingSeats,ruralFamilyPrivateAccessIssues,planRuralFamilyGround,wireRuralSharedBedrooms,ruralFamilyMixedSleepingRooms,ruralFamilyMissingLivingBasics,ruralFamilyStairDeficit} from '../ruralFamilyLayout';
import {householdLivingGeometryIssues} from '../householdLivingPlan';
import {captureObservedBuildingSource,buildingPlanSignature} from '../buildingSource';
import {canonicalTownSeedPath} from '../../town/canonicalTown';
import {generateHousehold} from '../../town/household';
import {briefFromHousehold} from '../../town/householdBrief';
import {rootSeedPath} from '../../seedPath';
import type {BlueprintDoor} from '../blueprintTypes';
const townSeed=canonicalTownSeedPath(42,702),plotId=1000001;
const family=generateHousehold(townSeed,'f1',6,'farmstead');
const input:InteriorPlotInput={id:plotId,footprint:[[0,0],[30,0],[30,45],[0,45]],role:'farm',buildingType:'farmstead',storeys:1,
 household:briefFromHousehold(family,{wealth:'common',worksAtHome:false})};
const candidate=()=>blueprintForPlot({...input,householdLayoutRecipe:'rural-family-v1'},townSeed);

describe('explicit fresh rural family recipe',()=>{
 it('seats the recorded six-person family where the earlier farm plan lacked beds',()=>{
  const old=blueprintForPlot(input,townSeed),before=JSON.stringify(old),next=candidate();
  expect(ruralFamilyMissingBeds(old)).toBeGreaterThan(0);expect(ruralFamilyMissingBeds(next)).toBe(0);
  expect(ruralFamilyPrivateAccessIssues(next)).toEqual([]);expect(ruralFamilyMissingSeats(next)).toBe(0);expect(next.household).toEqual(old.household);
  expect(next.widthFt).toBeLessThanOrEqual(30);expect(next.depthFt).toBeLessThanOrEqual(45);
  expect(blueprintForPlot(input,townSeed)).toBe(old);expect(JSON.stringify(old)).toBe(before);
  expect(candidate()).toEqual(next);expect(next).not.toBe(old);
  const ground=next.floors.find(f=>f.level===0)!,entry=ground.doors.find(d=>d.isEntry)!;
  expect(entry.y).toBe(0);expect(ground.rooms.find(r=>r.id===entry.b)!.purpose).toBe('corridor');
  expect(ruralFamilyMixedSleepingRooms(next)).toBe(0);expect(ruralFamilyMissingLivingBasics(next)).toBe(0);
  expect(ruralFamilyStairDeficit(next)).toBe(0);
  expect(householdLivingGeometryIssues(next)).toEqual([]);
 });
 it('retains an observed foundation even when the newer recipe is requested',()=>{
  const old=structuredClone(blueprintForPlot(input,townSeed));
  const source=captureObservedBuildingSource({worldSeed:42,burgId:702,plotId,cellId:1,
   observedAt:'0351-01-07T00:11:23.000Z',position:{tileX:1,tileY:0,xM:4,zM:4,yM:0},
   site:{xM:4,zM:4,surfaceY:0,rotationY:0,doorZSign:-1},historySignature:'[]',plan:old,household:family,workplaceOnly:false,manifests:[]},buildingPlanSignature(old));
  const loaded=blueprintForPlot({...input,householdLayoutRecipe:'rural-family-v1',retainedSource:{worldSeed:42,burgId:702,source}},townSeed);
  expect(loaded).toEqual(old);expect(ruralFamilyMissingBeds(loaded)).toBeGreaterThan(0);
 });
 it('requires an explicit resident farm and both allocated lot limits',()=>{
  const base={buildingId:1,type:'farmstead' as const,seedPath:rootSeedPath(42),household:input.household,householdLayoutRecipe:'rural-family-v1' as const,maxWidthFt:30,maxDepthFt:45};
  expect(()=>generateBuilding({...base,type:'cottage'})).toThrow(/resident farm and lot/);
  expect(()=>generateBuilding({...base,household:undefined})).toThrow(/resident farm and lot/);
  expect(()=>generateBuilding({...base,maxDepthFt:undefined})).toThrow(/resident farm and lot/);
 });
 it('counts beds in assigned rooms rather than borrowing an unrelated spare bed',()=>{
  const plan=structuredClone(candidate()),floor=plan.floors.find(f=>f.level===0)!;
  const room=floor.rooms.find(r=>r.forSlot)!,bed=floor.furnishings.find(f=>f.roomId===room.id&&f.kind==='bed')!;
  const other=floor.rooms.find(r=>r.id!==room.id)!;
  bed.roomId=other.id;
  expect(ruralFamilyMissingBeds(plan)).toBeGreaterThan(0);
 });
 it('detects a sleeping room that is accessible only through a different private room',()=>{
  const plan=structuredClone(candidate()),floor=plan.floors.find(f=>f.level===0)!;
  floor.rooms=floor.rooms.slice(0,3);floor.rooms.forEach((r,i)=>{r.purpose=i===0?'hall':'bedroom';});
  const [a,b,c]=floor.rooms.map(r=>r.id);
  const door=(from:number,to:number,isEntry=false):BlueprintDoor=>({a:from,b:to,x:2.5,y:0,axis:'x',isEntry,openDir:{nx:0,ny:1},swingInto:to});
  floor.doors=[door(-1,a,true),door(a,b),door(b,c)];plan.floors=[floor];plan.stairs=[];
  expect(ruralFamilyPrivateAccessIssues(plan)).toContain('private-through route 0:'+c);
  floor.doors.push(door(a,c));expect(ruralFamilyPrivateAccessIssues(plan)).toEqual([]);
 });
 it('moves shared entry purpose to frontage without losing the displaced sleeping claims',()=>{
  const rooms=structuredClone(candidate().floors.find(f=>f.level===0)!.rooms);
  const originalTags=rooms.flatMap(r=>r.forSlot?.split(',')??[]).sort();
  seatRuralSharedEntry(rooms);expect(rooms.flatMap(r=>r.forSlot?.split(',')??[]).sort()).toEqual(originalTags);
  expect(rooms.find(r=>r.isMain)!.cells.some(c=>c.cy===0)).toBe(true);
 });
});


describe('explicit rural room program',()=>{
 it('gives the larger sibling group the wider room without duplicate cells or claims',()=>{
  const program=planRuralFamilyGround(6,9,input.household!)!;
  const kids=program.rooms.find(r=>r.forSlot?.includes('child:0'))!,parents=program.rooms.find(r=>r.forSlot?.includes('head'))!;
  expect(kids.bbox.w).toBeGreaterThan(parents.bbox.w);
  expect(kids.forSlot?.split(',')).toHaveLength(5);
  expect(parents.forSlot?.split(',')).toEqual(['head']);
  const cells=program.rooms.flatMap(r=>r.cells.map(c=>c.cx+','+c.cy));
  expect(cells).toHaveLength(54);expect(new Set(cells).size).toBe(54);
  expect(program.rooms.flatMap(r=>r.forSlot?.split(',')??[]).sort()).toEqual(input.household!.slots.map(s=>s.tag).sort());
  expect(planRuralFamilyGround(4,9,input.household!)).toBeUndefined();
  expect(planRuralFamilyGround(6,9,{...input.household!,slots:[...input.household!.slots,{tag:'kin:0',role:'kin',ageBand:'adult'}]})).toBeUndefined();
 });
 it('replaces private-through access while preserving working shared entrances',()=>{
  const eight=briefFromHousehold(generateHousehold(townSeed,'f-large',8,'farmstead'),{wealth:'common',worksAtHome:false});
  const {rooms}=planRuralFamilyGround(7,9,eight)!;
  const opening=(a:number,b:number):BlueprintDoor=>({a,b,x:15,y:17.5,axis:'y',isEntry:false,swingInto:b,openDir:{nx:-1,ny:0}});
  const publicA=opening(1,3),publicB=opening(2,4),doors=[opening(0,1),opening(0,2),publicA,publicB,opening(3,5)];
  wireRuralSharedBedrooms(rooms,doors);
  expect(doors).toContain(publicA);expect(doors).toContain(publicB);
  expect(doors.some(d=>d.a===3&&d.b===5)).toBe(false);
  expect(doors.some(d=>d.a===0&&d.b===5&&d.clearWidthFt===4)).toBe(true);
 });
 it('keeps the recorded Greenhill children together when stairs use strict fitting',()=>{
  const seed=canonicalTownSeedPath(42,12),household=generateHousehold(seed,'f37',4,'farmstead');
  const plan=blueprintForPlot({id:1000037,role:'farm',buildingType:'farmstead',storeys:1,
    // The recorded allocated plot is 40 by 30 ft; the footprint adapter
    // produces the canonical 30 by 40 ft floor. Keep its actual source style.
    footprint:[[40,30],[40,0],[0,0],[0,30]],style:{cultureType:'Generic',climate:'temperate',wealth:'common',ageBand:'new',architecture:{settlementKey:'burg:12',districtKey:'rural:farm-parent:8',buildingKey:'farm:f37'}},
    household:briefFromHousehold(household,{wealth:'common',worksAtHome:false}),householdLayoutRecipe:'rural-family-v1'},seed);
  expect(ruralFamilyMissingBeds(plan)).toBe(0);expect(ruralFamilyMixedSleepingRooms(plan)).toBe(0);
  expect(ruralFamilyPrivateAccessIssues(plan)).toEqual([]);expect(householdLivingGeometryIssues(plan)).toEqual([]);
  expect(plan.floors.flatMap(f=>f.rooms).some(r=>r.forSlot?.split(',').sort().join(',')==='child:0,child:1')).toBe(true);
 });
});

describe('shared rural frontage geometry',()=>{
 it('matches the five-foot spine for odd/even widths and declines unsupported grids',async()=>{
  const {ruralFamilyFrontageOffsetFt,ruralFamilySpineColumn}=await import('../../town/ruralHouseGeometry');
  for(const width of [25,30,35,40]){
    const program=planRuralFamilyGround(width/5,9,input.household!)!;
    const spine=program.rooms.find(room=>room.isCorridor)!;
    expect(spine.bbox.x+2.5-width/2).toBe(ruralFamilyFrontageOffsetFt(width));
    expect(spine.bbox.x/5).toBe(ruralFamilySpineColumn(width/5));
  }
  expect(()=>ruralFamilyFrontageOffsetFt(31)).toThrow(/grid/);
  expect(()=>ruralFamilyFrontageOffsetFt(20)).toThrow(/columns/);
  expect(()=>ruralFamilySpineColumn(5.5)).toThrow(/columns/);
 });
});
