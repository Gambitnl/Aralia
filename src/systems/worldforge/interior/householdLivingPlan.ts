/** Coherent room-program proposals for crowded modest and prosperous homes.
 * Reuses canonical rooms, return stairs, furnishing recipes, roof and history.
 * This pure candidate never replaces a saved source or moves an actor. A
 * retained home still needs a validated contents/reference migration and an
 * outside-position admission transaction before it may adopt the result. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/10/2026, 22:45:21
 * Dependents: state/reducers/townReducer.ts, systems/worldforge/interior/householdLayoutRevision.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {BlueprintPlan, BlueprintFloor, BlueprintRoom, BlueprintDoor, BlueprintFurnishing, Cell, MemberSlot} from './blueprintTypes';
import {cellKey} from './blueprintTypes';
import type {HouseholdLayoutReferenceChanges} from './householdLayoutReferences';
import {roomWithCells, stairDoorCells, returnStairPoint} from './stairLayout';
import {buildWalls} from './walls';
import {furnishHouseholdBuilding, furnishingFootprint} from './householdFurnish';
import {roomFurnishingsReachable} from './buildingLayoutRepair';
import {solveRoof} from './roofPlan';
import {childSeedPath, type SeedPath} from '../seedPath';

export interface HouseholdLivingProposal {plan: BlueprintPlan; issues: string[]; recipe: 'public-landing-household-v1' | 'public-landing-household-v2' | 'public-landing-household-v3' | 'shared-hall-cottage-v1'; referenceChanges?: HouseholdLayoutReferenceChanges}
const cells = (x: number,y: number,w: number,h: number): Cell[] => Array.from({length:w*h},(_,i)=>({cx:x+i%w,cy:y+Math.floor(i/w)}));
const same = (a: unknown,b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function room(id: number,purpose: BlueprintRoom['purpose'],owned: Cell[],tags?: string): BlueprintRoom {
  return roomWithCells({id,purpose,cells:[],area:0,anchor:owned[0],bbox:{x:0,y:0,w:0,d:0},isMain:id===0,isCorridor:purpose==='corridor',...(tags?{forSlot:tags}:{})},owned);
}
function door(floor: BlueprintFloor,x: number,y: number,axis: 'x'|'y'): BlueprintDoor {
  const sides=stairDoorCells({x,y,axis}).map(c=>floor.rooms.find(r=>r.cells.some(p=>same(p,c))));
  if(!sides[0]||!sides[1]||sides[0].id===sides[1].id)throw new Error('Household door must join two actual rooms.');
  const into=sides.find(r=>r!.purpose!=='corridor')??sides[1],sign=into===sides[1]?1:-1;
  return {a:sides.find(r=>r!==into)!.id,b:into!.id,x,y,axis,isEntry:false,clearWidthFt:4,swingInto:into!.id,openDir:{nx:axis==='y'?sign:0,ny:axis==='x'?sign:0}};
}
function pairs(slots: MemberSlot[]): string[][] {return Array.from({length:Math.ceil(slots.length/2)},(_,i)=>slots.slice(i*2,i*2+2).map(s=>s.tag));}

/** Sleeping rooms face a shared spine with full-width return stairs. The
 * body-aware proposal reserves a larger shaft before assigning bedrooms; a
 * nine-person household needs four explicit stories in this retained shell.
 * The earlier narrower three-story draft remains an explicit legacy option.
 * Neither proposal is an adopted source or an inferred renderer extension.
 * Initial scope is the measured rectangular30x20ft townhouse family; irregular
 * parcels, attached walls and unsupported histories keep their old plan. */
export function proposeHouseholdLivingPlan(before: BlueprintPlan,seed: SeedPath,options: {ageByTag?: Readonly<Record<string,number>>;maxStoreys?:number;stairProfile?:'legacy'|'body';privateDoorLeaves?:boolean}={}): HouseholdLivingProposal|undefined {
  if(before.doorLeafProfile!==undefined||options.privateDoorLeaves&&(before.type==='cottage'||options.stairProfile==='legacy'))return;
  if(before.type==='cottage')return proposeSharedHallCottage(before,seed);
  const brief=before.household;
  if(before.type!=='townhouse'||!brief||brief.residential===false||brief.worksAtHome||brief.wealth!=='wealthy'||brief.slots.length<7
    ||before.widthFt!==30||before.depthFt!==20||before.footprintCells.length!==24
    ||cells(0,0,6,4).some(c=>!before.footprintCells.some(p=>same(p,c)))
    ||before.ensemble?.partyWallLeft||before.ensemble?.partyWallRight||before.liveHistory?.eventsApplied
    ||before.floors.some(f=>f.level<0)||!before.floors.find(f=>f.level===0)?.doors.some(d=>d.isEntry&&d.x===2.5&&d.y===0&&d.axis==='x'))return;
  // Retain the earlier draft explicitly for comparison. The current proposal
  // reserves real body-width flights and shared circulation before bedrooms.
  const wide=options.stairProfile!=='legacy';
  const children=brief.slots.filter(s=>s.role==='child').sort((a,b)=>(options.ageByTag?.[a.tag]??0)-(options.ageByTag?.[b.tag]??0)||a.tag.localeCompare(b.tag));
  // The new sleeping program needs actual child ages; missing evidence must
  // not silently put an arbitrary tagged child farthest from the parents.
  if(wide&&children.some(child=>!Number.isFinite(options.ageByTag?.[child.tag])||options.ageByTag![child.tag]<0))return;
  const couple=brief.slots.filter(s=>s.role==='head'||s.role==='spouse').map(s=>s.tag);
  const servants=pairs(brief.slots.filter(s=>s.role==='servant'));
  // Give the youngest pair a room beside the parents. Single/older children
  // and service rooms receive real separate doors, never a public bed route.
  const childGroups=pairs(children),groups=[couple,...childGroups.filter(g=>g.length===2),...servants,...childGroups.filter(g=>g.length===1),
    ...brief.slots.filter(s=>['elder','kin','lodger'].includes(s.role)).map(s=>[s.tag])].filter(g=>g.length);
  if(groups.some(g=>g.length>2))return;
  const largeGroups=groups.filter(g=>g.length===2),singleGroups=groups.filter(g=>g.length===1);
  const sleepingFloors=wide?Math.ceil(groups.length/2):Math.max(Math.ceil(largeGroups.length/2),Math.ceil((largeGroups.length+singleGroups.length)/3));
  const storeys=1+sleepingFloors;
  if(storeys>Math.max(2,options.maxStoreys??(wide?4:3)))return;
  const plan=structuredClone(before),sourceGround=before.floors.find(f=>f.level===0)!;
  const layout=wide?{kind:'return' as const,origin:{x:15,y:20},runDir:{dx:-1,dy:0},acrossDir:{dx:0,dy:-1},shaftCells:cells(0,2,3,2),landingCells:[{cx:3,cy:3},{cx:3,cy:2}],flightWidthFt:4.5,flightRunFt:10,landingDepthFt:5,risesPerFlight:10}:{kind:'return' as const,origin:{x:10,y:20},runDir:{dx:-1,dy:0},acrossDir:{dx:0,dy:-1},shaftCells:cells(0,2,2,2),landingCells:[{cx:2,cy:3},{cx:2,cy:2}],flightWidthFt:3.5,flightRunFt:7,landingDepthFt:3,risesPerFlight:9};
  const ground: BlueprintFloor={...structuredClone(sourceGround),rooms:[room(0,'hall',cells(0,0,6,2)),room(1,'kitchen',cells(4,2,2,2)),...(wide?[room(2,'corridor',cells(0,2,4,2))]:[room(2,'corridor',cells(2,2,2,2)),room(4,'corridor',layout.shaftCells)])],doors:[],furnishings:[]};
  ground.rooms.find(r=>r.id===0)!.mealForSlot=brief.slots.filter(s=>s.role!=='servant').map(s=>s.tag).join(',');
  ground.rooms.find(r=>r.id===1)!.mealForSlot=brief.slots.filter(s=>s.role==='servant').map(s=>s.tag).join(',');
  // Preserve the original entrance geometry. The dining area does not need a
  // second kitchen door through its seating: use the public rear hall instead.
  // Door indexes change here, so saved adoption must explicitly alias the old
  // entrance and classify every other old opening before admitting this plan.
  const entry={...structuredClone(sourceGround.doors.find(d=>d.isEntry)!),clearWidthFt:4};
  ground.doors=wide?[door(ground,17.5,10,'x'),door(ground,20,12.5,'y'),entry]:[door(ground,12.5,10,'x'),door(ground,20,12.5,'y'),entry,door(ground,10,17.5,'y')];
  plan.floors=[ground];
  for(let level=1;level<storeys;level++){
    const left=largeGroups.shift()??singleGroups.shift(),right=largeGroups.shift()??singleGroups.shift(),rear=wide?undefined:singleGroups.shift();
    if(wide){
      // The public spine reaches both sleeping rooms without crossing a
      // flight or private room. Stairs and their landing share circulation;
      // a leaf across this narrow landing would obstruct the next flight.
      const purpose=(tags:string[]|undefined)=>!tags?'study' as const:tags.some(t=>t.startsWith('servant:'))?'servant-room' as const:'bedroom' as const;
      const floor:BlueprintFloor={...structuredClone(sourceGround),level,rooms:[room(0,purpose(left),cells(0,0,3,2),left?.join(',')),
        room(1,purpose(right),cells(4,0,2,4),right?.join(',')),room(2,'corridor',[...cells(0,2,4,2),...cells(3,0,1,2)])],doors:[],furnishings:[]};
      floor.doors=[door(floor,15,7.5,'y'),door(floor,20,12.5,'y')];
      plan.floors.push(floor);continue;
    }
    const floor: BlueprintFloor={...structuredClone(sourceGround),level,rooms:[room(0,!left?'study':left.some(t=>t.startsWith('servant:'))?'servant-room':'bedroom',cells(0,0,3,2),left?.join(',')),
      room(1,!right?'study':right.some(t=>t.startsWith('servant:'))?'servant-room':'bedroom',cells(3,0,3,2),right?.join(',')),
      room(2,'corridor',cells(2,2,2,2)),room(3,rear?'bedroom':'study',cells(4,2,2,2),rear?.join(',')),room(4,'corridor',layout.shaftCells)],doors:[],furnishings:[]};
    floor.doors=[door(floor,12.5,10,'x'),door(floor,17.5,10,'x'),door(floor,20,17.5,'y'),door(floor,10,12.5,'y')];
    plan.floors.push(floor);
  }
  const blocked=new Set(layout.shaftCells.map(c=>cellKey(c.cx,c.cy)));
  furnishHouseholdBuilding(plan.floors,blocked,brief.slots.filter(s=>s.role==='servant').length);
  // The ground hall combines dining with a clear left-side living/circulation
  // bay. Wall-side tables and benches facing them leave a full-width passage
  // behind the seating; the end chair has a separate rear approach. Actual
  // family seating poses/capacity still need native qualification. The kitchen
  // has a separate work/meal table. All pieces use the shared physical catalog.
  const gp=(kind:string,roomId:number,x:number,y:number,rotation:BlueprintFurnishing['rotation']=0):BlueprintFurnishing=>({kind,roomId,x,y,rotation});
  ground.furnishings=[gp('hearth',0,1.448293963254593,7.403412073490813,90),gp('bench',0,wide?16:10,1),
    gp('table',0,wide?10:17.5,2),gp('table',0,22.75,2),
    ...(wide?[10,22.75]:[17.5,22.75]).map(x=>gp('bench',0,x,5.3)),gp('chair',0,27,2),
    gp('barrel',0,4.5,8.55),gp('barrel',0,7.1,8.55),
    gp('hearth',1,28.551706036745407,12.596587926509186,90),gp('table',1,25.55,16.7,90),gp('bench',1,21,17.05,90)];
  if(wide){
    // Dining serves the whole family while the route from the street to the
    // rear landing stays continuous. Provisions face the central aisle; the
    // spare reading bench occupies an upstairs alcove beyond through traffic.
    const tables=ground.furnishings.filter(p=>p.roomId===0&&p.kind==='table');
    const benches=ground.furnishings.filter(p=>p.roomId===0&&p.kind==='bench');
    const barrels=ground.furnishings.filter(p=>p.roomId===0&&p.kind==='barrel');
    Object.assign(tables[0],{x:11,y:2.7,rotation:90});
    Object.assign(benches[1],{x:8.1,y:2.7,rotation:90});benches[2].y=4.8;
    Object.assign(barrels[0],{x:15,y:1.5});Object.assign(barrels[1],{x:18,y:1.5});
    const reading=benches[0];ground.furnishings=ground.furnishings.filter(p=>p!==reading);
    Object.assign(reading,{roomId:2,x:19.2,y:2.7,rotation:90});plan.floors[1].furnishings.push(reading);
  }
  for(const floor of plan.floors.filter(f=>f.level>0)){
    if(wide){
      const right=floor.rooms.find(r=>r.id===1)!;
      floor.furnishings=floor.furnishings.filter(p=>p.roomId!==1);
      if(right.forSlot){
        floor.furnishings.push(gp('bed',1,25,1.9404199475065615,90));
        if(right.forSlot.split(',').length===2)floor.furnishings.push(gp('bed',1,25,18.059580052493438,90));
        floor.furnishings.push(gp('chest',1,28.059580052493438,8),gp('chest',1,28.059580052493438,12));
      }else floor.furnishings.push(gp('desk',1,25,1.448293963254593),gp('chair',1,25,4),gp('shelf',1,28.715748031496062,10,90));
      continue;
    }
    const rear=floor.rooms.find(r=>r.id===3)!;
    floor.furnishings=floor.furnishings.filter(p=>p.roomId!==3);
    floor.furnishings.push(...(rear.forSlot?[gp('bed',3,23.580839895013124,11.940419947506562,90),gp('chest',3,28.059580052493438,18.715748031496062),gp('chest',3,28.059580052493438,15.29)]
      :[gp('desk',3,25,11.448293963254593),gp('chair',3,25,14),gp('shelf',3,28.715748031496062,16,90)]));
  }
  // Large sleeping wings use opposing headboards along the front wall. Their
  // broad shared side aisle can accommodate the measured armored visitor and
  // a resident; the little bedside gaps are not counted as public circulation.
  for(const floor of plan.floors.filter(f=>f.level>0))for(const r of floor.rooms.filter(r=>r.forSlot&&r.bbox.w===15)){
    const count=r.forSlot!.split(',').length;
    floor.furnishings=floor.furnishings.filter(p=>p.roomId!==r.id);
    const piece=(kind:string,x:number,y:number,rotation:BlueprintFurnishing['rotation']):BlueprintFurnishing=>({kind,roomId:r.id,x:r.bbox.x+x,y:r.bbox.y+y,rotation});
    floor.furnishings.push(piece('bed',3.580839895013123,1.9404199475065615,90));
    if(count===2)floor.furnishings.push(piece('bed',11.419160104986876,1.9404199475065615,270));
    const chestX=r.id===1?[13.059580052493438,8.715748031496062]:[1.9404199475065615,6.284251968503938];
    floor.furnishings.push(...chestX.map(x=>piece('chest',x,8.715748031496062,0)));
  }
  // Smaller families can leave a front wing spare. Use it as a real study,
  // with its shelves opposite the landing door, rather than generating an
  // unassigned bedroom whose generic chest can block that mirrored entrance.
  for(const floor of plan.floors.filter(f=>f.level>0))for(const r of floor.rooms.filter(r=>!r.forSlot&&r.purpose==='study'&&r.bbox.w===15)){
    floor.furnishings=floor.furnishings.filter(p=>p.roomId!==r.id);
    floor.furnishings.push(gp('desk',r.id,r.bbox.x+7.5,1.448293963254593),gp('chair',r.id,r.bbox.x+7.5,4),gp('shelf',r.id,r.bbox.x+(r.id===0?1.284251968503937:13.715748031496063),6,90));
  }
  plan.stairs=Array.from({length:storeys-1},(_,fromLevel)=>({...returnStairPoint(layout,2.5,2.5),fromLevel,layout:structuredClone(layout)}));
  for(const floor of plan.floors){
    const grid=Array.from({length:4},()=>Array<number>(6).fill(-1));
    for(const r of floor.rooms)for(const c of r.cells)grid[c.cy][c.cx]=r.id;
    const rebuilt=buildWalls(childSeedPath(childSeedPath(seed,'building:'+before.buildingId),'floor:'+floor.level),grid,floor.doors,floor.rooms);
    floor.walls=rebuilt.walls;floor.wallRuns=rebuilt.wallRuns;floor.windows=rebuilt.windows;
  }
  // Roof coordinates are relative to the wall top. Identical mass/style keeps
  // its shape while the new explicit storey raises that top; flues follow the
  // actual proposed hearths. No fictional construction event is generated.
  if(plan.styleResolved)plan.roof=solveRoof({masses:plan.masses,footprintCells:plan.footprintCells,style:plan.styleResolved,hearths:plan.floors.flatMap(f=>f.furnishings).filter(p=>p.kind==='hearth').map(p=>({x:p.x,y:p.y})),windowlessUpperRooms:[],partyWallLeft:false,partyWallRight:false,wallTopFt:storeys*10});
  // Name only uniquely retained public circulation regions. The reference
  // owner independently validates these cells and keeps door privacy separate.
  const circulationAliases=wide?before.floors.flatMap(floor=>floor.rooms.flatMap(old=>{
    if(!old.isCorridor||old.purpose!=='corridor'||old.forSlot||!old.cells.length
      ||floor.furnishings.some(piece=>piece.roomId===old.id&&piece.kind==='bed'))return [];
    const targets=plan.floors.find(next=>next.level===floor.level)?.rooms.filter(room=>room.isCorridor&&room.purpose==='corridor'&&!room.forSlot
      &&old.cells.every(cell=>room.cells.some(candidate=>cellKey(candidate.cx,candidate.cy)===cellKey(cell.cx,cell.cy))))??[];
    return targets.length===1&&targets[0].id!==old.id?[{level:floor.level,fromRoomId:old.id,toRoomId:targets[0].id}]:[];
  })):[];
  // Replacing the hall connection with a shared landing keeps one specific
  // kitchen gate. Carry its identity, never an invented open/closed value.
  const kitchenCandidates=wide?before.floors.flatMap(floor=>floor.doors.flatMap((old,fromIndex)=>{
    const sourceRooms=floor.rooms.filter(room=>room.id===old.a||room.id===old.b);
    const shared=(rooms:BlueprintRoom[])=>rooms.length===2&&rooms.every(room=>!room.forSlot&&['hall','corridor','kitchen'].includes(room.purpose))
      &&rooms.filter(room=>room.purpose==='kitchen').length===1;
    if(old.isEntry||!shared(sourceRooms)||floor.furnishings.some(piece=>piece.kind==='bed'&&sourceRooms.some(room=>room.id===piece.roomId)))return [];
    const target=plan.floors.find(next=>next.level===floor.level);
    const choices=target?.doors.flatMap((next,toIndex)=>!next.isEntry&&shared(target.rooms.filter(room=>room.id===next.a||room.id===next.b))
      ?[{level:floor.level,fromIndex,toIndex}]:[])??[];
    return choices.length===1?choices:[];
  })):[];
  const kitchenDoorAliases=kitchenCandidates.filter(alias=>kitchenCandidates.filter(other=>other.level===alias.level&&other.toIndex===alias.toIndex).length===1);
  // Only the explicit v3 candidate adds closed private leaves. Existing v2
  // drafts and saved sources retain their exact shape and passage behavior.
  if(options.privateDoorLeaves)plan.doorLeafProfile='private-room-leaves-v1';
  return {plan,issues:householdProposalIssues(before,plan),recipe:options.privateDoorLeaves?'public-landing-household-v3':wide?'public-landing-household-v2':'public-landing-household-v1',
    ...(wide?{referenceChanges:{publicRoomMerges:[],entranceRelocations:[],circulationAliases,kitchenDoorAliases}}:{})};
}

/** Shared geometric/history gates for both modest and prosperous programs.
 * Each trial owns a clone; source observations never receive retargeted history. */
function householdProposalIssues(before:BlueprintPlan,plan:BlueprintPlan):string[]{
  const issues=householdLivingGeometryIssues(plan);
  // History targets remain source facts. Retarget unchanged wall surfaces by
  // their actual geometry; incompatible evidence is an admission issue.
  for(const feature of plan.backstory?.features??[]){if('wallRunIndex'in feature){const old=before.floors.find(f=>f.level===feature.floorLevel)?.wallRuns[feature.wallRunIndex],floor=plan.floors.find(f=>f.level===feature.floorLevel);const index=floor?.wallRuns.findIndex(w=>old&&['x1','y1','x2','y2','nx','ny','thicknessFt'].every(k=>w[k as keyof typeof w]===old[k as keyof typeof old]));if(index===undefined||index<0)issues.push('history wall target');else feature.wallRunIndex=index;}else if(feature.kind==='re-roofed'&&(!before.roof||!plan.roof||!same(before.roof.planes[feature.planeIndex],plan.roof.planes[feature.planeIndex])))issues.push('history roof target');}
  return [...new Set(issues)];
}

/** The reached modest cottage already sleeps its family in one shared hall.
 * Reclaim its redundant corridor, retain the kitchen and give every sleeper a
 * full-size bed. No extra land, storey, job room or fictional goods are added.
 * A wider entrance moves along the same front wall into the shared aisle;
 * admission must explicitly map that old door and archive the removed opening.
 */
function proposeSharedHallCottage(before:BlueprintPlan,seed:SeedPath):HouseholdLivingProposal|undefined{
  const brief=before.household,old=before.floors.find(f=>f.level===0);
  const sameCells=(a:Cell[],b:Cell[])=>a.length===b.length&&a.every(c=>b.some(p=>same(p,c)));
  if(!brief||brief.residential===false||brief.worksAtHome||brief.wealth==='wealthy'
    ||before.ensemble?.partyWallLeft||before.ensemble?.partyWallRight
    ||brief.slots.length<2||brief.slots.length>4||brief.slots.some(s=>!['head','spouse','child'].includes(s.role))
    ||before.widthFt!==25||before.depthFt!==15||before.floors.length!==1||!old||before.stairs.length
    ||before.footprintCells.length!==15||cells(0,0,5,3).some(c=>!before.footprintCells.some(p=>same(p,c)))
    ||!old.rooms.some(r=>r.id===0&&r.purpose==='hall'&&sameCells(r.cells,cells(0,0,2,3)))
    ||!old.rooms.some(r=>r.id===1&&r.isCorridor&&sameCells(r.cells,cells(2,0,1,3)))
    ||!old.rooms.some(r=>r.id===2&&r.purpose==='kitchen'&&sameCells(r.cells,cells(3,0,2,3)))
    ||!old.doors.some(d=>d.isEntry&&d.axis==='x'&&d.x===7.5&&d.y===0))return;
  const plan=structuredClone(before),floor=plan.floors[0];
  floor.rooms=[room(0,'hall',cells(0,0,3,3),brief.slots.map(s=>s.tag).join(',')),room(2,'kitchen',cells(3,0,2,3))];
  const entry={...structuredClone(old.doors.find(d=>d.isEntry)!),a:-1,b:0,x:12.5,y:0,clearWidthFt:4,swingInto:0,openDir:{nx:0,ny:1}};
  floor.doors=[door(floor,15,7.5,'y'),entry];
  const piece=(kind:string,roomId:number,x:number,y:number,rotation:BlueprintFurnishing['rotation']=0):BlueprintFurnishing=>({kind,roomId,x,y,rotation});
  // The bed bank leaves a continuous shared aisle beside all four foot ends.
  // The original beds are identified separately by the reference migration;
  // coordinates and array order alone never transfer someone's ownership.
  floor.furnishings=brief.slots.map((_,i)=>piece('bed',0,3.580839895013124,1.940419947506562+i*3.580839895013124,90));
  floor.furnishings.push(piece('barrel',0,13.551706036745407,13.551706036745407),
    piece('hearth',2,16.448293963254592,2.596587926509186,90),
    piece('barrel',2,21.448293963254592,1.448293963254593),
    piece('table',2,23.223622047244096,12.0753280839895,90),
    piece('bench',2,19.8,12.0753280839895,90),piece('chair',2,23.4,7.5));
  const grid=Array.from({length:3},(_,cy)=>Array.from({length:5},(_,cx)=>cx<3?0:2));
  const rebuilt=buildWalls(childSeedPath(childSeedPath(seed,'building:'+before.buildingId),'floor:0'),grid,floor.doors,floor.rooms);
  floor.walls=rebuilt.walls;floor.wallRuns=rebuilt.wallRuns;
  // The footprint, hearth and roof are unchanged. Keep the actual old windows,
  // roof stock, sagging ridge and later mass instead of rerolling their history.
  floor.windows=structuredClone(old.windows);
  return {plan,issues:householdProposalIssues(before,plan),recipe:'shared-hall-cottage-v1',referenceChanges:{
    publicRoomMerges:[{level:0,fromRoomId:1,toRoomId:0}],
    entranceRelocations:[{level:0,fromIndex:old.doors.findIndex(d=>d.isEntry),toIndex:1}],
  }};
}

/** Validate the furnished geometry of a frozen proposal without generating it.
 * Saved revisions keep their exact coordinates while sharing body/door gates. */
export function householdLivingGeometryIssues(plan:BlueprintPlan):string[]{
  const issues:string[]=[];
  const bodyWidthFt=1.2/.3048;
  for(const stair of plan.stairs){
    const layout=stair.layout;
    if(!layout||![layout.flightWidthFt,layout.landingDepthFt].every(Number.isFinite)
      ||layout.flightWidthFt<bodyWidthFt||layout.landingDepthFt<bodyWidthFt)issues.push('stair body width '+stair.fromLevel);
    if(!layout)continue;
    for(const [level,across]of [[stair.fromLevel,2.5],[stair.fromLevel+1,7.5]]){
      const floor=plan.floors.find(f=>f.level===level),point=returnStairPoint(layout,0,across);
      if(!floor){issues.push('missing stair floor '+level);continue;}
      const portal={...point,axis:layout.runDir.dx===0?'x' as const:'y' as const};
      const sides=stairDoorCells(portal).map(cell=>floor.rooms.find(room=>room.cells.some(c=>same(c,cell))));
      if(sides.some(room=>!room)){issues.push('missing stair portal '+level);continue;}
      if(sides.some(room=>room!.forSlot))issues.push('stair through sleeping room '+level);
      if(sides[0]!.id!==sides[1]!.id&&!floor.doors.some(door=>[door.a,door.b].includes(sides[0]!.id)
        &&[door.a,door.b].includes(sides[1]!.id)&&door.axis===portal.axis
        &&Math.hypot(door.x-point.x,door.y-point.y)<1e-6&&(door.clearWidthFt??3)>=bodyWidthFt))issues.push('blocked stair portal '+level);
    }
  }
  // An empty shaft is not walking floor. Audit only the public landing/spine
  // cells outside every adjacent flight, including their real door approaches.
  for(const floor of plan.floors){
    const shaft=new Set(plan.stairs.filter(stair=>stair.fromLevel===floor.level||stair.fromLevel+1===floor.level)
      .flatMap(stair=>stair.layout?.shaftCells??[]).map(cell=>cellKey(cell.cx,cell.cy)));
    const corridorRooms=floor.rooms.filter(room=>room.isCorridor).map(room=>({room,owned:room.cells.filter(cell=>!shaft.has(cellKey(cell.cx,cell.cy)))})).filter(({owned})=>owned.length);
    const audit={...floor,rooms:floor.rooms.map(room=>{const corridor=corridorRooms.find(c=>c.room.id===room.id);return corridor?roomWithCells(room,corridor.owned):room;})};
    for(const {room}of corridorRooms)if(!roomFurnishingsReachable(audit,room.id,.25,1.2,reason=>issues.push('corridor detail '+floor.level+':'+room.id+' '+reason)))issues.push('corridor body route '+floor.level+':'+room.id);
  }
  // A clear room graph cannot excuse a visible object through a wall or in a
  // door swing. Check the complete catalog rectangle and both sides of every
  // proposed opening, including pieces assigned to a neighbouring room.
  for(const floor of plan.floors)for(const piece of floor.furnishings){
    const r=floor.rooms.find(room=>room.id===piece.roomId),box=furnishingFootprint(piece);
    const owned=new Set(r?.cells.map(c=>cellKey(c.cx,c.cy))??[]);
    for(let cy=Math.floor(box.top/5);cy<=Math.floor((box.bottom-1e-8)/5);cy++)
      for(let cx=Math.floor(box.left/5);cx<=Math.floor((box.right-1e-8)/5);cx++)
        if(!owned.has(cellKey(cx,cy)))issues.push('furniture outside room '+floor.level+':'+piece.roomId);
    for(const d of floor.doors){
      const half=(d.clearWidthFt??3)/2,depth=d.clearWidthFt??3;
      const sweep=d.axis==='x'?{left:d.x-half,right:d.x+half,top:d.y-depth,bottom:d.y+depth}
        :{left:d.x-depth,right:d.x+depth,top:d.y-half,bottom:d.y+half};
      if(box.left<sweep.right&&box.right>sweep.left&&box.top<sweep.bottom&&box.bottom>sweep.top)
        issues.push('furniture in doorway '+floor.level+':'+piece.roomId);
    }
  }
  for(const floor of plan.floors)for(const r of floor.rooms.filter(r=>!r.isCorridor)){
    const expected=r.forSlot?.split(',').length??0,actual=floor.furnishings.filter(p=>p.roomId===r.id&&p.kind==='bed').length;
    if(actual<expected)issues.push('missing sleeping places '+floor.level+':'+r.id);
    if(!roomFurnishingsReachable(floor,r.id,.25,1.2,reason=>issues.push('body detail '+floor.level+':'+r.id+' '+reason)))issues.push('body route '+floor.level+':'+r.id);
    const pieces=floor.furnishings.filter(p=>p.roomId===r.id);
    for(let i=0;i<pieces.length;i++){const a=furnishingFootprint(pieces[i]);for(let j=i+1;j<pieces.length;j++){const b=furnishingFootprint(pieces[j]);if(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)issues.push('overlapping furniture '+floor.level+':'+r.id);}}
  }
  return [...new Set(issues)];
}
