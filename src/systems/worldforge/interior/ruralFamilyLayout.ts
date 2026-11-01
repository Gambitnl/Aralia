/**
 * Explicit new-farm layout choices and their source-level sleeping/access checks.
 * The ordinary generator and retained saved foundations never opt in implicitly.
 * These checks count assigned beds and room-graph privacy; they do not prove
 * body passage, door swing, terrain, camera comfort or lawful player access.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/11/2026, 13:35:11
 * Dependents: systems/worldforge/interior/generateBuilding.ts, systems/worldforge/interior/generateInterior.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {BlueprintPlan,BlueprintRoom,BlueprintDoor,HouseholdBrief} from './blueprintTypes';
import {roomFurnishingsReachable} from './buildingLayoutRepair';
import {furnishingFootprint,type HouseholdFurnishingOptions} from './householdFurnish';
import {roomWithCells} from './stairLayout';
import {ruralFamilySpineColumn} from '../town/ruralHouseGeometry';
export const RURAL_FAMILY_LAYOUT_RECIPE='rural-family-v1' as const;
export type RuralFamilyLayoutRecipe=typeof RURAL_FAMILY_LAYOUT_RECIPE;

/** Balanced partitions can put the largest room inside. Give the shared hall
 * actual street frontage before doors or stairs are constructed, carrying the
 * displaced room purpose and all named sleeping claims rather than losing them. */
export function seatRuralSharedEntry(rooms:BlueprintRoom[]):void{
 const main=rooms.find(r=>r.isMain);
 const street=rooms.filter(r=>r.cells.some(c=>c.cy===0)).sort((a,b)=>b.cells.length-a.cells.length||a.id-b.id)[0];
 if(!main||!street)throw new Error('Rural family rooms need a shared street entrance.');
 if(street===main)return;
 const purpose=street.purpose,tags=street.forSlot;
 street.purpose=main.purpose;street.forSlot=main.forSlot;street.isMain=true;
 main.purpose=purpose;main.forSlot=tags;main.isMain=false;
}

/** A spare bed in another room cannot pay the assigned sleeper's deficit. */
export function ruralFamilyMissingBeds(plan:BlueprintPlan):number{
 let missing=0;const assigned=new Map<string,number>();
 for(const floor of plan.floors.filter(f=>f.level>=0))for(const room of floor.rooms){
  const tags=room.forSlot?.split(',').filter(Boolean)??[];
  for(const tag of tags)assigned.set(tag,(assigned.get(tag)??0)+1);
  const beds=floor.furnishings.filter(f=>f.roomId===room.id&&f.kind==='bed').length;
  missing+=Math.max(0,tags.length-beds);
 }
 for(const slot of plan.household?.slots??[])if(assigned.get(slot.tag)!==1)missing++;
 return missing;
}

/** Shared rooms and bedroom doors should be reached without crossing a
 * different private sleeping room. This graph check is distinct from physical
 * reach and ownership; native door/body checks remain mandatory. */
export function ruralFamilyPrivateAccessIssues(plan:BlueprintPlan):string[]{
 const privatePurposes=new Set(['bedroom','guest-room','private-room','solar','servant-room']);
 const nodes=new Map<string,{private:boolean;adj:Set<string>}>();
 const key=(level:number,id:number)=>level+':'+id;
 for(const floor of plan.floors)for(const room of floor.rooms)nodes.set(key(floor.level,room.id),{private:privatePurposes.has(room.purpose),adj:new Set()});
 const connect=(a:string,b:string)=>{if(nodes.has(a)&&nodes.has(b)){nodes.get(a)!.adj.add(b);nodes.get(b)!.adj.add(a);}};
 for(const floor of plan.floors)for(const door of floor.doors.filter(d=>!d.isEntry))connect(key(floor.level,door.a),key(floor.level,door.b));
 const roomAt=(level:number,x:number,y:number)=>plan.floors.find(f=>f.level===level)?.rooms.find(r=>r.cells.some(c=>Math.floor(x/5)===c.cx&&Math.floor(y/5)===c.cy));
 for(const stair of plan.stairs){const a=roomAt(stair.fromLevel,stair.x,stair.y),b=roomAt(stair.fromLevel+1,stair.x,stair.y);if(a&&b)connect(key(stair.fromLevel,a.id),key(stair.fromLevel+1,b.id));}
 const ground=plan.floors.find(f=>f.level===0),entry=ground?.doors.find(d=>d.isEntry);
 if(!entry)return ['missing shared entrance'];
 const start=key(0,entry.b),seen=new Set<string>(),queue=[start];
 for(let i=0;i<queue.length;i++){const id=queue[i],node=nodes.get(id);if(!node||seen.has(id)||node.private)continue;seen.add(id);for(const next of node.adj)if(!seen.has(next))queue.push(next);}
 return [...nodes].filter(([id,node])=>node.private?![...node.adj].some(a=>seen.has(a)):!seen.has(id)).map(([id])=>'private-through route '+id);
}

/** Real catalog benches seat two; chairs seat one. Only shared living/cooking
 * rooms count, so a chair in a private bedroom cannot hide missing family seats. */
export function ruralFamilyMissingSeats(plan:BlueprintPlan):number{
 const seats=plan.floors.filter(f=>f.level>=0).reduce((total,floor)=>total+floor.rooms.filter(r=>r.purpose==='hall'||r.purpose==='kitchen')
   .reduce((n,room)=>n+floor.furnishings.filter(p=>p.roomId===room.id).reduce((n,p)=>n+(p.kind==='bench'?2:p.kind==='chair'?1:0),0),0),0);
 return Math.max(0,(plan.household?.slots.length??0)-seats);
}

/** Bounded selection screen with the existing 1.2 m body profile on a coarse
 * half-foot grid, plus exact door-sweep overlaps. Fine source/native checks
 * remain separate; a lower score cannot certify actual passage or camera use. */
export function ruralFamilyCirculationDeficit(plan:BlueprintPlan):number{
 let issues=0;
 for(const floor of plan.floors){
   for(const room of floor.rooms)if((!room.isCorridor||room.bbox.w===5&&room.bbox.d>=35)&&!roomFurnishingsReachable(floor,room.id,.5,1.2))issues++;
   for(const piece of floor.furnishings){const box=furnishingFootprint(piece);
     for(const door of floor.doors){const half=(door.clearWidthFt??3)/2,depth=door.clearWidthFt??3;
       const sweep=door.axis==='x'?{left:door.x-half,right:door.x+half,top:door.y-depth,bottom:door.y+depth}
         :{left:door.x-depth,right:door.x+depth,top:door.y-half,bottom:door.y+half};
       // A known door-sweep overlap outranks coarse-grid route counts.
       if(box.left<sweep.right&&box.right>sweep.left&&box.top<sweep.bottom&&box.bottom>sweep.top)issues+=100;
     }
   }
 }return issues;
}


/** Prototype clearance is deliberately explicit. This is the existing strict
 * survey envelope, not a claim about the current player's measured geometry. */
export const RURAL_FAMILY_FURNISHING:Readonly<HouseholdFurnishingOptions>={
 walkingWidthM:1.2,walkingGridStepFt:.5,seatingTrials:16,reserveDoorSweeps:true,reachAllFurniture:true,compactBeds:true,
};

/** Use the allocated rectangle for shared living and distinct sleeping groups.
 * The wider front wing serves the hall/stairs. A larger sibling group gets the
 * wider rear room, rather than silently overflowing into the parents' room.
 * Unsupported household roles retain the existing balanced-partition fallback.
 * Exact ages, cultural exceptions and native two-person circulation remain
 * separate qualification work; a five-foot corridor is not a passing camera test. */
export function planRuralFamilyGround(cols:number,rows:number,brief:HouseholdBrief,frontRows:3|4=3){
 if(!Number.isInteger(cols)||cols<5)return;
 const left=ruralFamilySpineColumn(cols),right=cols-left-1,front=frontRows,rear=rows-front;
 if(left<2||right<2||rear<(frontRows===3?4:3)||brief.slots.some(s=>!['head','spouse','child'].includes(s.role)))return;
 const parents=brief.slots.filter(s=>s.role==='head'||s.role==='spouse').map(s=>s.tag);
 const kids=brief.slots.filter(s=>s.role==='child').map(s=>s.tag);
 const rect=(x:number,y:number,w:number,h:number)=>Array.from({length:w*h},(_,i)=>({cx:x+i%w,cy:y+Math.floor(i/w)}));
 const room=(id:number,purpose:BlueprintRoom['purpose'],owned:ReturnType<typeof rect>,tags:string[]=[])=>roomWithCells({id,purpose,cells:[],area:0,anchor:owned[0],bbox:{x:0,y:0,w:0,d:0},isMain:id===0,isCorridor:id===0,...(tags.length?{forSlot:tags.join(',')}:{})},owned);
 const split=cols>=7&&kids.length>4,sideKids=split?kids.slice(0,kids.length-4):[];
 const parentRows=split?Math.floor(rear/2):rear,kidsInWiderRoom=!split&&left>right&&kids.length>parents.length;
 const rooms=[room(0,'corridor',rect(left,0,1,rows)),room(1,'hall',rect(0,0,left,front)),room(2,'kitchen',rect(left+1,0,right,front)),
 room(3,'bedroom',rect(0,front,left,parentRows),kidsInWiderRoom?kids:parents),
 room(4,kids.length?'bedroom':'pantry',rect(left+1,front,right,rear),kidsInWiderRoom?parents:split?kids.slice(sideKids.length):kids)];
 if(split)rooms.push(room(5,'bedroom',rect(0,front+parentRows,left,rear-parentRows),sideKids));
 const grid=Array.from({length:rows},()=>Array<number>(cols).fill(-1));
 for(const room of rooms)for(const cell of room.cells)grid[cell.cy][cell.cx]=room.id;
 return {rooms,grid};
}

/** A connectivity tree can choose a private bedroom as the only route to a
 * sibling's room. Replace that opening with shared access before walls/furniture
 * are built. Keep working entrances via halls/kitchens: redundant openings can
 * otherwise remove the only usable furniture bay in a modest room. */
export function wireRuralSharedBedrooms(rooms:BlueprintRoom[],doors:BlueprintDoor[]):void{
 const spine=rooms.find(r=>r.isCorridor&&r.bbox.w===5&&r.bbox.d>=35);
 if(!spine)return;
 for(const room of rooms.filter(r=>r.forSlot)){
  if(doors.some(d=>{const other=d.a===room.id?d.b:d.b===room.id?d.a:undefined;return other!==undefined&&rooms.some(r=>r.id===other&&!r.forSlot);}))continue;
  const edges=room.cells.flatMap(c=>spine.cells.filter(s=>s.cy===c.cy&&Math.abs(s.cx-c.cx)===1).map(s=>({c,s})))
   .sort((a,b)=>Math.abs(a.c.cy-room.anchor.cy)-Math.abs(b.c.cy-room.anchor.cy));
  const edge=edges[0];if(!edge)continue;
  for(let i=doors.length-1;i>=0;i--){const d=doors[i],other=d.a===room.id?d.b:d.b===room.id?d.a:undefined;
   if(other!==undefined&&rooms.some(r=>r.id===other&&r.forSlot))doors.splice(i,1);}
  doors.push({a:spine.id,b:room.id,x:Math.max(edge.c.cx,edge.s.cx)*5,y:edge.c.cy*5+2.5,axis:'y',isEntry:false,
   openDir:{nx:Math.sign(edge.c.cx-edge.s.cx),ny:0},swingInto:room.id,clearWidthFt:4});
 }
}

/** Prefer separate adult/child sleeping groups when they fit. Sharing is not
 * universally forbidden, but the prototype must not choose it merely because
 * a tag happened to be last. Actual household/cultural exceptions need evidence. */
export function ruralFamilyMixedSleepingRooms(plan:BlueprintPlan):number{
 return plan.floors.filter(f=>f.level>=0).reduce((n,f)=>n+f.rooms.filter(r=>{
  const tags=r.forSlot?.split(',')??[];
  return tags.some(t=>t==='head'||t==='spouse')&&tags.some(t=>t.startsWith('child:'));
 }).length,0);
}

/** A household still needs a meal/work table, warmth and provisions after its beds fit. */
export function ruralFamilyMissingLivingBasics(plan:BlueprintPlan):number{
 const pieces=plan.floors.filter(f=>f.level>=0).flatMap(f=>f.furnishings.filter(p=>
  f.rooms.some(r=>r.id===p.roomId&&(r.purpose==='hall'||r.purpose==='kitchen'))));
 return Number(!pieces.some(p=>p.kind==='table'))+Number(!pieces.some(p=>p.kind==='hearth'))
   +Number(!pieces.some(p=>p.kind==='barrel'));
}


/** A clear furnished room cannot excuse a compact or undersized stair. The
 * explicit prototype prefers a reserved return flight/landing for its body
 * profile; any fallback remains a recorded qualification deficit. */
export function ruralFamilyStairDeficit(plan:BlueprintPlan):number{
 const width=RURAL_FAMILY_FURNISHING.walkingWidthM!;
 return plan.stairs.filter(s=>!s.layout||s.layout.flightWidthFt*.3048<width||s.layout.landingDepthFt*.3048<width).length;
}
