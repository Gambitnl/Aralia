/** The played inn and school share proprietor identity with a separate home.
 * Their rooms must serve the workplace without rehousing that whole family.
 * Real guest permission still requires the existing keeper, quote and payment. */
import {beforeAll,describe,expect,it} from 'vitest';
import {createHash} from 'node:crypto';
import {townBuildingVisit} from '@/components/Worldforge/townBuildingVisit';
import {guestBedsForVisit} from '@/systems/gameplay/lodging';
import {programForBrief} from '@/systems/worldforge/interior/briefProgram';
import {generateBuilding} from '@/systems/worldforge/interior/generateBuilding';
import {rootSeedPath} from '@/systems/worldforge/seedPath';

describe('the played nonresidential buildings keep their actual use',()=>{
 let inn:ReturnType<typeof townBuildingVisit>,school:ReturnType<typeof townBuildingVisit>,home:ReturnType<typeof townBuildingVisit>;
 beforeAll(()=>{
  inn=townBuildingVisit(1793146029630,675,10);
  school=townBuildingVisit(1793146029630,675,11);
  home=townBuildingVisit(1793146029630,675,71);
 },60000);
 it('keeps the proprietor identity and trade, without claiming the remote family sleeps in the inn',()=>{
  expect(inn.workplaceOnly).toBe(true);
  expect(inn.plan.household?.homeId).toBe('b9');
  expect(inn.plan.household?.slots).toHaveLength(9);
  expect(inn.plan.household?.trade).toBe('innkeeper');
  expect(inn.plan.floors.flatMap(f=>f.rooms.filter(r=>r.forSlot))).toEqual([]);
 });
 it('furnishes the separate school for study rather than its teacher and home lodgers',()=>{
  expect(school.workplaceOnly).toBe(true);
  expect(school.plan.household?.homeId).toBe('b71');
  expect(school.plan.household?.slots).toHaveLength(13);
  expect(school.plan.floors.flatMap(f=>f.rooms.filter(r=>r.forSlot))).toEqual([]);
  expect(school.plan.floors.flatMap(f=>f.furnishings.filter(p=>p.kind==='bed'))).toEqual([]);
  expect(school.plan.floors.find(f=>f.level===1)?.rooms.filter(r=>!r.isCorridor).every(r=>r.purpose==='study')).toBe(true);
 });
 it('uses the inn program for real unassigned guest rooms, keeping paid permission separate',()=>{
  const beds=guestBedsForVisit(inn);
  expect(beds.length).toBeGreaterThan(0);
  for(const bed of beds){
   const room=inn.plan.floors.find(f=>f.level===bed.level)?.rooms.find(r=>r.id===bed.roomId);
   expect(room?.purpose).toBe('guest-room');
   expect(room?.forSlot).toBeUndefined();
  }
 });
 it('preserves the crowded residential home exactly, including every named sleeping claim',()=>{
  expect(home.workplaceOnly).toBe(false);
  expect(createHash('sha256').update(JSON.stringify(home.plan)).digest('hex')).toBe('2ff73787305bcf420aa978e0b7497c8c28dd76334f33c8ed76dd893985e4c988');
  expect(home.plan.household?.slots).toHaveLength(13);
 });
 it('keeps legacy resident briefs on their existing bedroom program',()=>{
  const brief=inn.plan.household!;
  const legacy={...brief,residential:undefined},resident={...brief,residential:true};
  expect(programForBrief('inn',legacy)).toEqual(programForBrief('inn',resident));
  expect(programForBrief('inn',legacy).bedrooms).toHaveLength(4);
 });
 it('does not reuse a cached residential plan for the same owner at a separate workplace',()=>{
  const brief=inn.plan.household!;
  const legacy={...brief,residential:undefined};
  const input={buildingId:10,type:'inn' as const,storeys:2,seedPath:rootSeedPath(1793146029630)};
  const homePlan=generateBuilding({...input,household:legacy});
  const workplacePlan=generateBuilding({...input,household:{...brief,residential:false}});
  expect(homePlan.floors.some(f=>f.rooms.some(r=>r.forSlot))).toBe(true);
  expect(workplacePlan.household?.residential).toBe(false);
  expect(workplacePlan.floors.some(f=>f.rooms.some(r=>r.forSlot))).toBe(false);
  expect(workplacePlan).not.toBe(homePlan);
  expect(generateBuilding({...input,household:legacy})).toBe(homePlan);
 });
});
