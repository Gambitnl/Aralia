/** Migration drafts must keep the played household's original objects and
 * goods. A successful object match never hides unresolved door privacy. */
import {describe,expect,it} from 'vitest';
import observed from './fixtures/observedBuildingSources.json';
import type {ObservedBuildingSource} from '../buildingSource';
import {proposeHouseholdLivingPlan,householdLivingGeometryIssues} from '../householdLivingPlan';
import {proposeHouseholdLayoutReferences} from '../householdLayoutReferences';
import {canonicalTownSeedPath} from '../../town/canonicalTown';
import {computeOccupancy} from '../occupancy';
import {CONTAINER_KINDS} from '../manifests';

const source=observed.home as unknown as ObservedBuildingSource;
function fixture(){
  const before=structuredClone(source);
  const after=proposeHouseholdLivingPlan(before.plan,canonicalTownSeedPath(before.worldSeed,before.burgId),
    {ageByTag:{'child:0':8,'child:1':9,'child:2':4,'child:3':8,'child:4':4},stairProfile:'legacy'})!.plan;
  return {before,after};
}
const refKey=(r:{level:number;index:number})=>r.level+':'+r.index;
describe('original household layout reference drafts (legacy prosperous program)',()=>{
  it('gives the reached poor cottage its own modest shared-hall recipe',()=>{
    const poor=observed.poorHome as unknown as ObservedBuildingSource,before=structuredClone(poor);
    expect(poor.plan.household?.wealth).toBe('poor');
    expect(poor.household?.members).toHaveLength(4);
    const out=proposeHouseholdLivingPlan(poor.plan,canonicalTownSeedPath(poor.worldSeed,poor.burgId))!;
    expect(out.recipe).toBe('shared-hall-cottage-v1');
    expect(out.plan.floors).toHaveLength(1);
    expect(out.plan.footprintCells).toEqual(poor.plan.footprintCells);
    expect(poor).toEqual(before);
  });
  it('joins all six reached cottage objects and both owned stores without generating more goods',()=>{
    const poor=observed.poorHome as unknown as ObservedBuildingSource,snapshot=structuredClone(poor);
    const out=proposeHouseholdLivingPlan(poor.plan,canonicalTownSeedPath(poor.worldSeed,poor.burgId))!;
    const draft=proposeHouseholdLayoutReferences(poor.plan,out.plan,poor.household!,poor.manifests,out.referenceChanges);
    expect(draft.issues).toEqual([]);expect(draft.furnishings).toHaveLength(6);
    expect(new Set(draft.furnishings.map(m=>refKey(m.to))).size).toBe(6);
    expect(draft.manifests).toHaveLength(2);
    for(const [i,m]of poor.manifests.entries()){
      const target=draft.furnishings.find(x=>x.from.level===m.level&&x.from.index===m.furnishingIndex)!.to;
      expect(draft.manifests[i]).toEqual({...m,level:target.level,furnishingIndex:target.index});
    }
    expect(draft.rooms.find(r=>r.from.roomId===1)?.to).toEqual([{level:0,roomId:0}]);
    expect(draft.doors.map(d=>d.status)).toEqual(['merged-opening','aliased','aliased']);
    expect(draft.doors[0].to).toEqual([]);expect(draft.doors[2].to).toHaveLength(1);
    const omitted=proposeHouseholdLayoutReferences(poor.plan,out.plan,poor.household!,poor.manifests);
    expect(omitted.issues).toContain('unmapped room 0:1');
    expect(omitted.doors[2].status).toBe('removed');expect(poor).toEqual(snapshot);
  });
  it('refuses private-room merges and entrance aliases to an interior opening',()=>{
    const poor=observed.poorHome as unknown as ObservedBuildingSource;
    const out=proposeHouseholdLivingPlan(poor.plan,canonicalTownSeedPath(poor.worldSeed,poor.burgId))!;
    const bad=structuredClone(poor.plan);bad.floors[0].rooms.find(r=>r.id===1)!.isCorridor=false;
    expect(()=>proposeHouseholdLayoutReferences(bad,out.plan,poor.household!,poor.manifests,out.referenceChanges)).toThrow('Invalid public room merge');
    const changes=structuredClone(out.referenceChanges!);changes.entranceRelocations[0].toIndex=0;
    expect(()=>proposeHouseholdLayoutReferences(poor.plan,out.plan,poor.household!,poor.manifests,changes)).toThrow('Invalid same-wall entrance relocation');
  });
  it('preserves every poor-home object and ownership join under an unchanged layout without claiming capacity',()=>{
    const poor=observed.poorHome as unknown as ObservedBuildingSource;
    const draft=proposeHouseholdLayoutReferences(poor.plan,poor.plan,poor.household!,poor.manifests);
    expect(draft.issues).toEqual([]);expect(draft.furnishings).toHaveLength(6);
    expect(draft.furnishings.every(m=>JSON.stringify(m.from)===JSON.stringify(m.to))).toBe(true);
    expect(draft.manifests).toEqual(poor.manifests);
    expect(draft.doors.every(d=>d.status==='aliased'&&d.to.length===1&&d.from===d.to[0])).toBe(true);
    // This is reference continuity only. The observed two beds still leave
    // both children without a furnishing; the mapper must not invent bedding.
    const sleepers=computeOccupancy(poor.plan,poor.household!,{worksAtHome:false}).stationsByHour[3];
    expect(sleepers.filter(s=>s.furnishingIndex===undefined)).toHaveLength(2);
  });
  it('maps every original furnishing once and keeps all original contents and owners',()=>{
    const {before,after}=fixture(),snapshot=structuredClone({before,after});
    const draft=proposeHouseholdLayoutReferences(before.plan,after,before.household!,before.manifests);
    expect(draft.furnishings).toHaveLength(21);
    expect(new Set(draft.furnishings.map(m=>refKey(m.from))).size).toBe(21);
    expect(new Set(draft.furnishings.map(m=>refKey(m.to))).size).toBe(21);
    expect(draft.issues.filter(s=>!s.startsWith('door '))).toEqual([]);
    for(const [i,original]of before.manifests.entries()){
      const target=draft.furnishings.find(m=>m.from.level===original.level&&m.from.index===original.furnishingIndex)!.to;
      expect(draft.manifests[i]).toEqual({...original,level:target.level,furnishingIndex:target.index});
    }
    const additional=draft.manifests.slice(before.manifests.length);
    expect(additional.length).toBeGreaterThan(0);
    expect(additional.every(m=>m.ownerHomeId==='b34'&&m.entries.length===0)).toBe(true);
    expect(draft.manifests).toHaveLength(after.floors.flatMap(f=>f.furnishings).filter(p=>CONTAINER_KINDS.has(p.kind)).length);
    draft.manifests[0].entries[0].qty+=1;
    expect({before,after}).toEqual(snapshot);
  });
  it('keeps each of the eight original beds with its original named member, including duplicate sibling names',()=>{
    const {before,after}=fixture();
    const draft=proposeHouseholdLayoutReferences(before.plan,after,before.household!,before.manifests);
    const old=computeOccupancy(before.plan,before.household!,{worksAtHome:false}).stationsByHour[3];
    const next=computeOccupancy(after,before.household!,{worksAtHome:false}).stationsByHour[3];
    expect(draft.furnishings.filter(m=>m.from.kind==='bed')).toHaveLength(8);
    for(const station of old.filter(s=>s.furnishingIndex!==undefined)){
      const alias=draft.furnishings.find(m=>m.from.level===station.level&&m.from.index===station.furnishingIndex)!;
      expect(alias.to).toMatchObject({kind:'bed',level:next[station.memberIndex].level,index:next[station.memberIndex].furnishingIndex});
    }
    expect(next[8].furnishingIndex).toBeDefined();
  });
  it('moves a split sibling room chest without taking the younger sibling room storage places',()=>{
    const {before,after}=fixture();
    const draft=proposeHouseholdLayoutReferences(before.plan,after,before.household!,before.manifests);
    const split=draft.furnishings.find(m=>m.from.level===1&&m.from.index===5)!;
    expect(split.to).toMatchObject({kind:'chest',level:2,roomId:0});
    for(const index of [7,8])expect(draft.furnishings.find(m=>m.from.level===1&&m.from.index===index)!.to)
      .toMatchObject({kind:'chest',level:1,roomId:1});
    expect(draft.rooms.find(m=>m.from.level===1&&m.from.roomId===2)!.to)
      .toEqual([{level:1,roomId:1},{level:2,roomId:0}]);
  });
  it('aliases the original entrance index explicitly and refuses to guess former bedroom-through-bedroom privacy',()=>{
    const {before,after}=fixture();
    const draft=proposeHouseholdLayoutReferences(before.plan,after,before.household!,before.manifests);
    expect(draft.doors).toHaveLength(before.plan.floors.flatMap(f=>f.doors).length);
    expect(draft.doors.find(d=>d.from.startsWith('0:3:'))).toEqual({from:'0:3:x:-3.8100:-3.0480',to:['0:2:x:-3.8100:-3.0480'],status:'aliased'});
    expect(draft.doors.some(d=>d.status==='removed')).toBe(true);
    expect(draft.doors.some(d=>d.status==='privacy-change'&&d.to.length===0)).toBe(true);
    expect(draft.issues.some(s=>s.startsWith('door privacy-change'))).toBe(true);
  });
  it('reports missing furniture and original contents rather than dropping them or rerolling goods',()=>{
    const {before,after}=fixture();
    const target=after.floors.find(f=>f.level===1)!;
    target.furnishings=target.furnishings.filter(p=>p.kind!=='chest');
    const draft=proposeHouseholdLayoutReferences(before.plan,after,before.household!,before.manifests.slice(1));
    expect(draft.issues.some(s=>s.startsWith('unmapped furnishing'))).toBe(true);
    expect(draft.issues).toContain('missing original container contents 0:2');
  });
  it('rejects duplicate, foreign or mismatched original ownership joins',()=>{
    const {before,after}=fixture();
    for(const manifests of [
      [...before.manifests,before.manifests[0]],
      [{...before.manifests[0],ownerHomeId:'somebody-else'}],
      [{...before.manifests[0],kind:'chest'}]
    ])expect(()=>proposeHouseholdLayoutReferences(before.plan,after,before.household!,manifests)).toThrow('original household container');
    expect(()=>proposeHouseholdLayoutReferences(before.plan,{...after,buildingId:35},before.household!,before.manifests)).toThrow('same building');
  });
});

it('preserves goods and named bed references while refusing unresolved wider-proposal circulation aliases',()=>{
 const before=structuredClone(source),out=proposeHouseholdLivingPlan(before.plan,canonicalTownSeedPath(before.worldSeed,before.burgId),
   {ageByTag:{'child:0':8,'child:1':9,'child:2':4,'child:3':8,'child:4':4}})!;
 expect(out.recipe).toBe('public-landing-household-v2');expect(out.issues).toEqual([]);
 const snapshot=structuredClone({before,after:out.plan});
 const draft=proposeHouseholdLayoutReferences(before.plan,out.plan,before.household!,before.manifests);
 expect(draft.furnishings).toHaveLength(21);expect(new Set(draft.furnishings.map(item=>refKey(item.to))).size).toBe(21);
 expect(draft.issues.filter(issue=>!issue.startsWith('door '))).toEqual(['unmapped room 0:4','unmapped room 1:5']);
 for(const [index,original]of before.manifests.entries()){
  const target=draft.furnishings.find(item=>item.from.level===original.level&&item.from.index===original.furnishingIndex)!.to;
  expect(draft.manifests[index]).toEqual({...original,level:target.level,furnishingIndex:target.index});
 }
 expect({before,after:out.plan}).toEqual(snapshot);
});

describe('explicit wealthy public circulation references',()=>{
 function wide(){const before=structuredClone(source),out=proposeHouseholdLivingPlan(before.plan,canonicalTownSeedPath(before.worldSeed,before.burgId),
   {ageByTag:{'child:0':8,'child:1':9,'child:2':4,'child:3':8,'child:4':4}})!;return {before,out};}
 it('maps retained stair circulation cells explicitly while leaving privacy issues visible',()=>{
  const {before,out}=wide(),snapshot=structuredClone({before,out});
  expect(out.referenceChanges!.circulationAliases).toEqual([{level:0,fromRoomId:4,toRoomId:2},{level:1,fromRoomId:5,toRoomId:2}]);
  const draft=proposeHouseholdLayoutReferences(before.plan,out.plan,before.household!,before.manifests,out.referenceChanges);
  expect(draft.issues.filter(issue=>!issue.startsWith('door '))).toEqual([]);
  for(const alias of out.referenceChanges!.circulationAliases!)expect(draft.rooms.find(room=>room.from.level===alias.level&&room.from.roomId===alias.fromRoomId)!.to).toEqual([{level:alias.level,roomId:alias.toRoomId}]);
  expect(draft.furnishings).toHaveLength(21);expect(draft.issues).toHaveLength(4);
  expect(draft.issues.every(issue=>issue.startsWith('door privacy-change '))).toBe(true);
  expect(draft.doors.some(door=>door.status==='privacy-change'&&door.to.length===0)).toBe(true);
  for(const [index,manifest]of before.manifests.entries()){const target=draft.furnishings.find(item=>item.from.level===manifest.level&&item.from.index===manifest.furnishingIndex)!.to;expect(draft.manifests[index]).toEqual({...manifest,level:target.level,furnishingIndex:target.index});}
  expect({before,out}).toEqual(snapshot);
 });
 it('names the unique shared kitchen replacement without guessing when intent is absent',()=>{
  const {before,out}=wide();
  expect(out.referenceChanges!.kitchenDoorAliases).toEqual([{level:0,fromIndex:0,toIndex:1}]);
  const snapshot=structuredClone({before,out});
  const draft=proposeHouseholdLayoutReferences(before.plan,out.plan,before.household!,before.manifests,out.referenceChanges);
  expect(draft.doors.find(door=>door.from==='0:0:y:1.5240:-2.2860')).toEqual({
    from:'0:0:y:1.5240:-2.2860',to:['0:1:y:1.5240:0.7620'],status:'aliased'});
  const omitted=structuredClone(out.referenceChanges!);delete omitted.kitchenDoorAliases;
  const unresolved=proposeHouseholdLayoutReferences(before.plan,out.plan,before.household!,before.manifests,omitted);
  expect(unresolved.issues).toContain('door removed 0:0:y:1.5240:-2.2860');
  expect({before,out}).toEqual(snapshot);
 });
 it.each(['duplicate','source-exterior','source-private','target-exterior','target-without-kitchen','missing-index','shifted-frame','source-bed','target-bed','ambiguous-kitchen'])(
  'refuses %s kitchen door intent',kind=>{
   const {before,out}=wide(),changes=structuredClone(out.referenceChanges!);
   const alias=changes.kitchenDoorAliases![0];
   // Isolate the kitchen validation from the separately tested circulation gate.
   changes.circulationAliases=[];
   if(kind==='duplicate')changes.kitchenDoorAliases!.push({...alias});
   if(kind==='source-exterior')alias.fromIndex=3;
   if(kind==='source-private')alias.fromIndex=2;
   if(kind==='target-exterior')alias.toIndex=2;
   if(kind==='target-without-kitchen')alias.toIndex=0;
   if(kind==='missing-index')alias.toIndex=999;
   if(kind==='shifted-frame')out.plan.siteOriginFt={x:123,y:45};
   const sourceFloor=before.plan.floors[0],targetFloor=out.plan.floors[0];
   if(kind==='source-bed')sourceFloor.furnishings.push({kind:'bed',roomId:sourceFloor.doors[0].a,x:2.5,y:2.5,rotation:0});
   if(kind==='target-bed')targetFloor.furnishings.push({kind:'bed',roomId:targetFloor.doors[1].a,x:2.5,y:2.5,rotation:0});
   if(kind==='ambiguous-kitchen')targetFloor.rooms.find(room=>room.id===0)!.purpose='kitchen';
   const snapshot=structuredClone({before,out,changes});
   expect(()=>proposeHouseholdLayoutReferences(before.plan,out.plan,before.household!,before.manifests,changes)).toThrow('Invalid shared kitchen door alias.');
   expect({before,out,changes}).toEqual(snapshot);
  });
 it('reviews all four obsolete private openings by member identity without authorizing state transfer',()=>{
  const {before,out}=wide(),snapshot=structuredClone({before,out});
  const draft=proposeHouseholdLayoutReferences(before.plan,out.plan,before.household!,before.manifests,out.referenceChanges);
  expect(draft.privateDoorReviews).toHaveLength(4);
  for(const review of draft.privateDoorReviews!){
    expect(draft.doors.find(door=>door.from===review.from)).toEqual({from:review.from,to:[],status:'privacy-change'});
    expect(review.oldStatePolicy).toBe('retain-original-key-only');
    expect(review.blockers).toEqual(['private-access-policy','current-saved-door-states','operable-private-leaves-and-native-verification']);
    expect(review.sourceRooms).toHaveLength(2);
    expect(review.destinationRooms.every(room=>room.entryDoorIds.length===1)).toBe(true);
    const previousMembers=review.sourceRooms.flatMap(room=>room.memberIndices);
    expect(previousMembers.every(member=>review.destinationRooms.some(room=>room.memberIndices.includes(member)))).toBe(true);
  }
  // The two Larks are distinct people. A changed sharing group is visible,
  // including the servant who previously had no assigned bed.
  const siblings=draft.privateDoorReviews![1];
  expect(siblings.sourceRooms.map(room=>room.memberIndices)).toEqual([[4,5],[2]]);
  expect(siblings.destinationRooms.map(room=>room.memberIndices)).toEqual([[4,6],[2,5]]);
  const staff=draft.privateDoorReviews![3];
  expect(staff.sourceRooms[0].memberIndices).toEqual([7]);
  expect(staff.destinationRooms[0].memberIndices).toEqual([7,8]);
  draft.privateDoorReviews![0].destinationRooms[0].memberIndices.push(999);
  expect({before,out}).toEqual(snapshot);
 });
 it('keeps missing or duplicate private entries as explicit review blockers',()=>{
  for(const mode of ['missing','duplicate']){
   const {before,out}=wide(),floor=out.plan.floors.find(floor=>floor.level===2)!;
   if(mode==='missing')floor.doors.splice(0,1);else floor.doors.push(structuredClone(floor.doors[0]));
   const draft=proposeHouseholdLayoutReferences(before.plan,out.plan,before.household!,before.manifests,out.referenceChanges);
   expect(draft.privateDoorReviews!.some(review=>review.blockers.includes('nonunique-private-entry'))).toBe(true);
   expect(draft.issues.filter(issue=>issue.startsWith('door privacy-change '))).toHaveLength(4);
  }
 });
 it('does not mistake blueprint private openings for projected operable door leaves',async()=>{
  const {buildInteriorParts}=await import('../../bridge/interiorParts');
  const {before,out}=wide(),draft=proposeHouseholdLayoutReferences(before.plan,out.plan,before.household!,before.manifests,out.referenceChanges);
  const parts=buildInteriorParts({id:34,role:'house',storeys:4,footprint:[[0,0],[30,0],[30,20],[0,20]]},
   canonicalTownSeedPath(before.worldSeed,before.burgId),12.192,[],out.plan);
  const leaves=parts.flatMap(part=>part.door?[part.door.id]:[]);
  expect(leaves).toEqual(['0:2:x:-3.8100:-3.0480']);
  const privateCandidates=draft.privateDoorReviews!.flatMap(review=>review.destinationRooms.flatMap(room=>room.entryDoorIds));
  expect(privateCandidates.length).toBeGreaterThan(0);
  expect(privateCandidates.every(id=>!leaves.includes(id))).toBe(true);
 });
 it('reports a shared bedroom doorway as ambiguous when occupants get separate private rooms',()=>{
  const {before,out}=wide(),first=out.plan.floors.find(floor=>floor.level===1)!,top=out.plan.floors.find(floor=>floor.level===3)!;
  first.rooms.find(room=>room.id===0)!.forSlot='head';
  const secondBed=first.furnishings.filter(piece=>piece.roomId===0&&piece.kind==='bed')[1];
  const chest=first.furnishings.filter(piece=>piece.roomId===0&&piece.kind==='chest')[1];
  first.furnishings=first.furnishings.filter(piece=>piece!==secondBed&&piece!==chest);
  const spouseRoom=top.rooms.find(room=>room.id===1)!;spouseRoom.purpose='bedroom';spouseRoom.forSlot='spouse';
  top.furnishings=top.furnishings.filter(piece=>piece.roomId!==1);
  top.furnishings.push({...secondBed,roomId:1,x:25,y:1.9404199475065615,rotation:90},
    {...chest,roomId:1,x:28.059580052493438,y:8});
  expect(householdLivingGeometryIssues(out.plan)).toEqual([]);
  const draft=proposeHouseholdLayoutReferences(before.plan,out.plan,before.household!,before.manifests,out.referenceChanges);
  const split=draft.doors.filter(door=>door.to.length>1);expect(split.length).toBeGreaterThan(0);
  for(const door of split){expect(door.status).toBe('ambiguous');expect(draft.issues).toContain('door ambiguous '+door.from);}
  expect(draft.doors.filter(door=>door.status==='aliased').every(door=>door.to.length===1)).toBe(true);
 });
 it.each(['duplicate','private-source','private-target','missing-target','missing-cell','bed-in-source','shifted-frame'])(
  'refuses %s circulation intent before mapping contents',kind=>{
   const {before,out}=wide(),changes=structuredClone(out.referenceChanges!);
   if(kind==='duplicate')changes.circulationAliases!.push({...changes.circulationAliases![0]});
   if(kind==='private-source')before.plan.floors[0].rooms.find(room=>room.id===4)!.purpose='bedroom';
   if(kind==='private-target')out.plan.floors[0].rooms.find(room=>room.id===2)!.forSlot='head';
   if(kind==='missing-target')changes.circulationAliases![0].toRoomId=999;
   if(kind==='missing-cell'){const old=before.plan.floors[0].rooms.find(room=>room.id===4)!.cells[0];out.plan.floors[0].rooms.find(room=>room.id===2)!.cells=out.plan.floors[0].rooms.find(room=>room.id===2)!.cells.filter(cell=>cell.cx!==old.cx||cell.cy!==old.cy);}
   if(kind==='bed-in-source')before.plan.floors[0].furnishings.push({kind:'bed',roomId:4,x:2.5,y:12.5,rotation:0});
   if(kind==='shifted-frame')out.plan.siteOriginFt={x:123,y:45};
   expect(()=>proposeHouseholdLayoutReferences(before.plan,out.plan,before.household!,before.manifests,changes)).toThrow('Invalid public circulation alias.');
  });
});

it('refuses ambiguous door-state application without changing any saved keys',async()=>{
 const {freezeHouseholdLayoutRevision,householdLayoutDoorStates}=await import('../householdLayoutRevision');
 const poor=structuredClone(observed.poorHome) as unknown as ObservedBuildingSource;
 const proposal=proposeHouseholdLivingPlan(poor.plan,canonicalTownSeedPath(poor.worldSeed,poor.burgId))!;
 const outside={tileX:4079,tileY:0,xM:477.353295555244,zM:485.91232295117925,yM:5.364260758100921};
 const receipt=freezeHouseholdLayoutRevision(poor.plan,poor.household!,poor.manifests,proposal,'0351-01-01T07:44:33.000Z',outside);
 // Tamper with an otherwise valid disposable receipt: both targets are real
 // leaves, but one old opening cannot authorize copying to both of them.
 const leaves=receipt.references.doors.filter(door=>door.status==='aliased');
 const ambiguous=leaves[0];ambiguous.status='ambiguous';ambiguous.to.push(leaves[1].to[0]);
 const states={[ambiguous.from]:true,legacy:true},snapshot=structuredClone(states);
 expect(()=>householdLayoutDoorStates(receipt,states)).toThrow('The recorded household layout no longer preserves its original source and references.');
 expect(states).toEqual(snapshot);
});
