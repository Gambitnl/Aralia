/**
 * Draft the identity joins needed before an established household can change
 * its rooms. Every old furnishing gets one new location; a person's existing
 * bed follows that person, and owned containers follow their original users.
 * Contents are copied exactly. Additional containers start empty and owned.
 *
 * This does not admit a layout, write a save or grant access. Ambiguous privacy
 * changes and removed doors remain explicit issues for the admission owner.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/11/2026, 15:05:28
 * Dependents: systems/worldforge/interior/householdLayoutRevision.ts, systems/worldforge/interior/householdLivingPlan.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {BlueprintPlan, BlueprintRoom} from './blueprintTypes';
import {blueprintSiteOrigin, cellKey} from './blueprintTypes';
import type {ContainerManifest} from './manifests';
import {CONTAINER_KINDS} from './manifests';
import type {Household} from '../town/household';
import {computeOccupancy} from './occupancy';
import {siteDoorId} from '../bridge/sitePartTransform';

export interface HouseholdFurnishingRef {
  level: number; index: number; roomId: number; kind: string;
}
export interface HouseholdRoomRef {level: number; roomId: number}
/** Explicit structural intent from the room-program proposal. Validation below
 * confines these joins to a shared hall merge, preserved public circulation
 * cells and the same exterior wall. None of them grants a private room. */
export interface HouseholdLayoutReferenceChanges {
  publicRoomMerges: Array<{level:number;fromRoomId:number;toRoomId:number}>;
  entranceRelocations: Array<{level:number;fromIndex:number;toIndex:number}>;
  circulationAliases?: Array<{level:number;fromRoomId:number;toRoomId:number}>;
  kitchenDoorAliases?: Array<{level:number;fromIndex:number;toIndex:number}>;
}
/** Review facts for an obsolete bedroom-through-bedroom opening. Member indices
 * preserve duplicate names; replacement entries are candidates, never aliases.
 * Retirement, live states and operable private leaves still need qualification. */
export interface HouseholdPrivateDoorReview {
  from: string;
  sourceRooms: Array<HouseholdRoomRef & {memberIndices:number[]}>;
  destinationRooms: Array<HouseholdRoomRef & {memberIndices:number[];entryDoorIds:string[]}>;
  oldStatePolicy: 'retain-original-key-only';
  blockers: string[];
}
export interface HouseholdLayoutReferences {
  furnishings: Array<{from: HouseholdFurnishingRef; to: HouseholdFurnishingRef}>;
  rooms: Array<{from: HouseholdRoomRef; to: HouseholdRoomRef[]}>;
  doors: Array<{from: string; to: string[]; status: 'aliased' | 'ambiguous' | 'removed' | 'privacy-change' | 'merged-opening'}>;
  manifests: ContainerManifest[];
  privateDoorReviews?: HouseholdPrivateDoorReview[];
  issues: string[];
}
const key = (r: {level: number; index: number}) => r.level + ':' + r.index;
const roomKey = (r: HouseholdRoomRef) => r.level + ':' + r.roomId;
const sleepingRoom = (room: BlueprintRoom) => ['bedroom','servant-room','private-room','solar','guest-room'].includes(room.purpose);
const sharedStorage = new Set(['hall','kitchen','pantry','storage','cellar']);

/** Original object identity survives even when its new index or floor differs.
 * Matching never uses a resident's display name: duplicate siblings are distinct.
 * An augmenting match reserves limited chest places for their actual old users,
 * rather than letting the first split bedroom take another child's only storage.
 */
export function proposeHouseholdLayoutReferences(before: BlueprintPlan, after: BlueprintPlan,
  household: Household, manifests: readonly ContainerManifest[], changes?: HouseholdLayoutReferenceChanges): HouseholdLayoutReferences {
  if (before.buildingId !== after.buildingId || before.household?.homeId !== household.homeId
    || after.household?.homeId !== household.homeId) throw new Error('Household layout references need the same building and household.');
  // A caller must name each changed reference; geometry resemblance alone
  // never grants a relocated entrance or folds private rooms into a hall.
  for(const merge of changes?.publicRoomMerges??[]){
    const source=before.floors.find(f=>f.level===merge.level),target=after.floors.find(f=>f.level===merge.level);
    const old=source?.rooms.find(r=>r.id===merge.fromRoomId),hall=source?.rooms.find(r=>r.id===merge.toRoomId),next=target?.rooms.find(r=>r.id===merge.toRoomId);
    const union=[...(old?.cells??[]),...(hall?.cells??[])];
    if(!old?.isCorridor||old.forSlot||hall?.purpose!=='hall'||next?.purpose!=='hall'
      ||hall.forSlot!==next.forSlot||union.length!==next.cells.length
      ||!union.every(c=>next.cells.some(p=>cellKey(p.cx,p.cy)===cellKey(c.cx,c.cy)))
      ||target!.rooms.some(r=>r.id===merge.fromRoomId))throw new Error('Invalid public room merge.');
  }
  // A larger open stair/spine can retain an old circulation region without
  // pretending that a private bedroom or shifted source frame is equivalent.
  const circulationKeys=new Set<string>();
  const beforeFrame=blueprintSiteOrigin(before),afterFrame=blueprintSiteOrigin(after);
  for(const alias of changes?.circulationAliases??[]){
    const key=alias.level+':'+alias.fromRoomId;
    const source=before.floors.find(f=>f.level===alias.level),target=after.floors.find(f=>f.level===alias.level);
    const old=source?.rooms.find(r=>r.id===alias.fromRoomId),next=target?.rooms.find(r=>r.id===alias.toRoomId);
    if(circulationKeys.has(key)||changes?.publicRoomMerges.some(merge=>merge.level===alias.level&&merge.fromRoomId===alias.fromRoomId)
      ||beforeFrame.x!==afterFrame.x||beforeFrame.y!==afterFrame.y
      ||!old?.isCorridor||old.purpose!=='corridor'||old.forSlot||!old.cells.length
      ||!next?.isCorridor||next.purpose!=='corridor'||next.forSlot
      ||source!.furnishings.some(piece=>piece.roomId===old.id&&piece.kind==='bed')
      ||target!.furnishings.some(piece=>piece.roomId===next.id&&piece.kind==='bed')
      ||!old.cells.every(cell=>next.cells.some(candidate=>cellKey(candidate.cx,candidate.cy)===cellKey(cell.cx,cell.cy))))throw new Error('Invalid public circulation alias.');
    circulationKeys.add(key);
  }
  for(const move of changes?.entranceRelocations??[]){
    const old=before.floors.find(f=>f.level===move.level)?.doors[move.fromIndex],next=after.floors.find(f=>f.level===move.level)?.doors[move.toIndex];
    const atExterior=(p:BlueprintPlan,d:NonNullable<typeof old>)=>d.axis==='x'?(d.y===0||d.y===p.depthFt):(d.x===0||d.x===p.widthFt);
    if(!old?.isEntry||!next?.isEntry||old.axis!==next.axis||!atExterior(before,old)||!atExterior(after,next)
      ||(old.axis==='x'?old.y!==next.y:old.x!==next.x)||before.widthFt!==after.widthFt||before.depthFt!==after.depthFt
      ||old.a!==next.a||old.b!==next.b)throw new Error('Invalid same-wall entrance relocation.');
  }
  const original = computeOccupancy(before, household, {worksAtHome: false}).stationsByHour[3];
  const revised = computeOccupancy(after, household, {worksAtHome: false}).stationsByHour[3];
  const pieces = (plan: BlueprintPlan) => plan.floors.flatMap(f => f.furnishings.map((p,index) =>
    ({level:f.level,index,roomId:p.roomId,kind:p.kind})));
  const oldPieces=pieces(before), newPieces=pieces(after), issues:string[]=[];
  const findRoom=(plan:BlueprintPlan,r:HouseholdRoomRef) => plan.floors.find(f=>f.level===r.level)!.rooms.find(room=>room.id===r.roomId)!;
  const occupants=(rows:typeof original,r:HouseholdRoomRef) => rows.filter(s=>s.level===r.level&&s.roomId===r.roomId).map(s=>s.memberIndex);
  const bedOwner=(rows:typeof original,r:HouseholdFurnishingRef) => rows.find(s=>s.level===r.level&&s.furnishingIndex===r.index)?.memberIndex;
  const choices=oldPieces.map(old=>newPieces.map((next,index)=>({next,index})).filter(({next})=>{
    if(next.kind!==old.kind)return false;
    if(old.kind==='bed'){
      const member=bedOwner(original,old);
      return member!==undefined&&bedOwner(revised,next)===member;
    }
    const a=findRoom(before,old),b=findRoom(after,next);
    if(sleepingRoom(a)){
      const users=occupants(original,old);
      return sleepingRoom(b)&&occupants(revised,next).some(member=>users.includes(member));
    }
    // Food/general household stores may move to the shared ground hall, but
    // never become an apparently personal chest in a different private room.
    return next.level===old.level&&(a.purpose===b.purpose
      || (CONTAINER_KINDS.has(old.kind)&&sharedStorage.has(a.purpose)&&sharedStorage.has(b.purpose)));
  }).sort((a,b)=>Number(findRoom(after,b.next).purpose===findRoom(before,old).purpose)
    -Number(findRoom(after,a.next).purpose===findRoom(before,old).purpose)||a.index-b.index).map(c=>c.index));
  const owner=new Map<number,number>();
  function match(oldIndex:number,seen:Set<number>):boolean {
    for(const target of choices[oldIndex]){
      if(seen.has(target))continue;seen.add(target);
      const displaced=owner.get(target);
      if(displaced===undefined||match(displaced,seen)){owner.set(target,oldIndex);return true;}
    }
    return false;
  }
  for(let i=0;i<oldPieces.length;i++)if(!match(i,new Set()))issues.push('unmapped furnishing '+key(oldPieces[i]));
  const byOld=new Map([...owner].map(([next,old])=>[old,next]));
  const furnishings=oldPieces.flatMap((from,index)=>{
    const target=byOld.get(index);return target===undefined?[]:[{from,to:newPieces[target]}];
  });
  const bySource=new Map(furnishings.map(m=>[key(m.from),m.to]));
  const contents:ContainerManifest[]=[], populated=new Set<string>(),sourceContainers=new Set<string>();
  for(const manifest of manifests){
    const sourceKey=manifest.level+':'+manifest.furnishingIndex;
    const old=oldPieces.find(p=>key(p)===sourceKey),next=bySource.get(sourceKey);
    if(!old||old.kind!==manifest.kind||!CONTAINER_KINDS.has(old.kind)||manifest.ownerHomeId!==household.homeId
      ||sourceContainers.has(sourceKey))throw new Error('Invalid or duplicate original household container.');
    sourceContainers.add(sourceKey);
    if(!next)continue;
    populated.add(key(next));
    contents.push({...structuredClone(manifest),level:next.level,furnishingIndex:next.index});
  }
  for(const old of oldPieces.filter(p=>CONTAINER_KINDS.has(p.kind)))
    if(!sourceContainers.has(key(old)))issues.push('missing original container contents '+key(old));
  // Empty is deliberate: a layout correction must not roll a second set of
  // goods or mint money merely because it provides adequate storage.
  for(const next of newPieces.filter(p=>CONTAINER_KINDS.has(p.kind)))if(!populated.has(key(next)))
    contents.push({level:next.level,furnishingIndex:next.index,kind:next.kind,ownerHomeId:household.homeId,entries:[]});
  const inShaft=(plan:BlueprintPlan,r:HouseholdRoomRef) => {
    const shaft=new Set(plan.stairs.filter(s=>s.fromLevel===r.level||s.fromLevel+1===r.level)
      .flatMap(s=>s.layout?.shaftCells??[]).map(c=>cellKey(c.cx,c.cy)));
    return findRoom(plan,r).cells.every(c=>shaft.has(cellKey(c.cx,c.cy)));
  };
  const rooms=before.floors.flatMap(f=>f.rooms.map(old=>{
    const from={level:f.level,roomId:old.id},users=occupants(original,from);
    const to=after.floors.flatMap(next=>next.rooms.filter(room=>{
      const ref={level:next.level,roomId:room.id};
      if(changes?.publicRoomMerges.some(m=>m.level===f.level&&m.fromRoomId===old.id))
        return next.level===f.level&&changes.publicRoomMerges.some(m=>m.level===f.level&&m.fromRoomId===old.id&&m.toRoomId===room.id);
      if(changes?.circulationAliases?.some(alias=>alias.level===f.level&&alias.fromRoomId===old.id))
        return next.level===f.level&&changes.circulationAliases.some(alias=>alias.level===f.level&&alias.fromRoomId===old.id&&alias.toRoomId===room.id);
      if(sleepingRoom(old))return sleepingRoom(room)&&occupants(revised,ref).some(member=>users.includes(member));
      return next.level===f.level&&room.purpose===old.purpose&&inShaft(before,from)===inShaft(after,ref);
    }).map(room=>({level:next.level,roomId:room.id})));
    if(!to.length)issues.push('unmapped room '+roomKey(from));
    return {from,to};
  }));
  const roomTargets=(level:number,roomId:number) => rooms.find(r=>r.from.level===level&&r.from.roomId===roomId)?.to??[];
  // An explicit shared kitchen gate can move from the hall to a landing.
  // Its unique kitchen identity and both shared endpoints must survive; this
  // never substitutes for an exterior or private-bedroom doorway decision.
  const kitchenDoorTargets=new Map<string,number>(),kitchenTargets=new Set<string>();
  for(const alias of changes?.kitchenDoorAliases??[]){
    const source=before.floors.find(floor=>floor.level===alias.level),target=after.floors.find(floor=>floor.level===alias.level);
    const old=source?.doors[alias.fromIndex],next=target?.doors[alias.toIndex];
    const oldRooms=old?[source?.rooms.find(room=>room.id===old.a),source?.rooms.find(room=>room.id===old.b)]:[];
    const newRooms=next?[target?.rooms.find(room=>room.id===next.a),target?.rooms.find(room=>room.id===next.b)]:[];
    const pair=(list:typeof oldRooms)=>list.length===2&&list.every(room=>room&&!room.forSlot&&['hall','corridor','kitchen'].includes(room.purpose))
      &&list.filter(room=>room?.purpose==='kitchen').length===1;
    const oldKitchen=oldRooms.find(room=>room?.purpose==='kitchen'),newKitchen=newRooms.find(room=>room?.purpose==='kitchen');
    const anchors=oldKitchen?roomTargets(alias.level,oldKitchen.id):[];
    const from=alias.level+':'+alias.fromIndex,to=alias.level+':'+alias.toIndex;
    if(kitchenDoorTargets.has(from)||kitchenTargets.has(to)||old?.isEntry!==false||next?.isEntry!==false
      ||beforeFrame.x!==afterFrame.x||beforeFrame.y!==afterFrame.y||!pair(oldRooms)||!pair(newRooms)
      ||anchors.length!==1||anchors[0].level!==alias.level||anchors[0].roomId!==newKitchen?.id
      ||source!.furnishings.some(piece=>piece.kind==='bed'&&oldRooms.some(room=>room?.id===piece.roomId))
      ||target!.furnishings.some(piece=>piece.kind==='bed'&&newRooms.some(room=>room?.id===piece.roomId)))throw new Error('Invalid shared kitchen door alias.');
    kitchenDoorTargets.set(from,alias.toIndex);kitchenTargets.add(to);
  }
  const originBefore=blueprintSiteOrigin(before),originAfter=blueprintSiteOrigin(after);
  const privateDoorReviews:HouseholdPrivateDoorReview[]=[];
  const doors=before.floors.flatMap(f=>f.doors.map((d,index)=>{
    const from=siteDoorId(f.level,index,d.axis,(d.x-originBefore.x)*.3048,(d.y-originBefore.y)*.3048);
    const a=f.rooms.find(r=>r.id===d.a),b=f.rooms.find(r=>r.id===d.b);
    const privateRooms=[a,b].filter((r):r is BlueprintRoom=>!!r&&sleepingRoom(r));
    // A former bedroom-through-bedroom door has no single equivalent public
    // landing door. Keep that ambiguity visible until privacy/state policy is
    // deliberately resolved; never copy its open state to both bedrooms.
    const privacyChange=!d.isEntry&&privateRooms.length===2;
    if(privacyChange){
      const sourceRooms=privateRooms.map(room=>({level:f.level,roomId:room.id,memberIndices:occupants(original,{level:f.level,roomId:room.id})}));
      const targets=new Map<string,HouseholdRoomRef>();
      for(const room of sourceRooms)for(const target of roomTargets(room.level,room.roomId))targets.set(roomKey(target),target);
      const destinationRooms=[...targets.values()].map(ref=>{
        const floor=after.floors.find(candidate=>candidate.level===ref.level)!;
        const entryDoorIds=floor.doors.flatMap((entry,i)=>{
          if(entry.isEntry||entry.a!==ref.roomId&&entry.b!==ref.roomId)return [];
          const shared=floor.rooms.find(room=>room.id===(entry.a===ref.roomId?entry.b:entry.a));
          if(!shared?.isCorridor||shared.forSlot||!['hall','corridor'].includes(shared.purpose)
            ||floor.furnishings.some(piece=>piece.kind==='bed'&&piece.roomId===shared.id))return [];
          return [siteDoorId(ref.level,i,entry.axis,(entry.x-originAfter.x)*.3048,(entry.y-originAfter.y)*.3048)];
        });
        return {...ref,memberIndices:occupants(revised,ref),entryDoorIds};
      });
      // A review does not resolve privacy: retain every old state key and never
      // fan its value into these independently owned new bedroom entrances.
      const blockers=['private-access-policy','current-saved-door-states','operable-private-leaves-and-native-verification'];
      if(sourceRooms.some(room=>!room.memberIndices.length))blockers.push('unclaimed-source-room');
      if(destinationRooms.some(room=>room.entryDoorIds.length!==1))blockers.push('nonunique-private-entry');
      const users=new Set(sourceRooms.flatMap(room=>room.memberIndices));
      if([...users].some(member=>!destinationRooms.some(room=>room.memberIndices.includes(member)))
        ||destinationRooms.some(room=>!sleepingRoom(findRoom(after,room))))blockers.push('unresolved-sleeping-claims');
      privateDoorReviews.push({from,sourceRooms,destinationRooms,oldStatePolicy:'retain-original-key-only',blockers});
    }
    const kitchenTarget=kitchenDoorTargets.get(f.level+':'+index);
    const to=privacyChange?[]:after.floors.flatMap(next=>next.doors.flatMap((n,i)=>{
      let same=false;
      if(d.isEntry)same=n.isEntry&&f.level===next.level&&((d.axis===n.axis&&d.x===n.x&&d.y===n.y)
        ||!!changes?.entranceRelocations.some(m=>m.level===f.level&&m.fromIndex===index&&m.toIndex===i));
      else if(kitchenTarget!==undefined)same=!n.isEntry&&next.level===f.level&&i===kitchenTarget;
      else if(!n.isEntry&&privateRooms.length===1){
        const claims=roomTargets(f.level,privateRooms[0].id).filter(r=>r.level===next.level);
        same=claims.some(r=>(n.a===r.roomId&&next.rooms.find(x=>x.id===n.b)?.isCorridor)
          ||(n.b===r.roomId&&next.rooms.find(x=>x.id===n.a)?.isCorridor));
      }else if(!n.isEntry){
        const left=roomTargets(f.level,d.a),right=roomTargets(f.level,d.b);
        same=left.some(l=>right.some(r=>l.level===next.level&&r.level===next.level
          &&((n.a===l.roomId&&n.b===r.roomId)||(n.b===l.roomId&&n.a===r.roomId))));
      }
      return same?[siteDoorId(next.level,i,n.axis,(n.x-originAfter.x)*.3048,(n.y-originAfter.y)*.3048)]:[];
    }));
    // A removed shared opening has no leaf in the revised room. Its old
    // qualified key must be archived, never aliased to a different doorway.
    const merged=!d.isEntry&&!privateRooms.length&&roomTargets(f.level,d.a).some(l=>roomTargets(f.level,d.b).some(r=>l.level===r.level&&l.roomId===r.roomId));
    // One old leaf must not fan its saved open state out to several private
    // entries when a sibling room splits. Keep all candidates for review.
    const status=privacyChange?'privacy-change':to.length===1?'aliased':to.length>1?'ambiguous':merged?'merged-opening':'removed';
    if(status!=='aliased'&&status!=='merged-opening')issues.push('door '+status+' '+from);
    return {from,to,status} as HouseholdLayoutReferences['doors'][number];
  }));
  return {furnishings,rooms,doors,manifests:contents,...(privateDoorReviews.length?{privateDoorReviews}:{}),issues};
}
