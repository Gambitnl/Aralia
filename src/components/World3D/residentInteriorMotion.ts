/** Opt-in residents follow source-permitted rooms and real stair supports.
 * The schedule supplies a destination; this controller advances accepted feet
 * at walking speed instead of interpolating through walls. A closed claimed
 * door leads to a reachable swing-clear stance, then the existing door owner
 * decides whether it may open. Nothing here writes doors, saves or consent. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/11/2026, 18:13:13
 * Dependents: components/World3D/InteriorOccupants.tsx
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {GroundWorld} from '@/systems/worldforge/bridge/groundChunkLoader';
import type {SitePart} from '@/systems/worldforge/bridge/interiorParts';
import type {SiteGroupTransform} from '@/systems/worldforge/bridge/sitePartTransform';
import {worldOffsetToSiteLocal} from '@/systems/worldforge/bridge/sitePartTransform';
import type {ResidentPrivateDoorAccess} from '@/systems/worldforge/bridge/buildingOccupancy';
import {createGroundInteriorRouteSearch,createInteriorRouteTask,groundInteriorRouteSteps,type InteriorRouteSearch,type InteriorRouteSearchUpdate,type InteriorRouteFoot,type InteriorRouteQuery,type InteriorRouteResult} from './groundInteriorRoute';
import {resolveGroundWalk,canGroundBodyTurn,isGroundBodyClear} from './groundBuildingMotion';
import {actorSpaceOverlaps,clipActorStep,canActorTurn,yieldActorStep,type ActorBody,type ActorSpace} from './actorPersonalSpace';
import {doorBodyClearance,DOOR_BODY_REACH_M} from './doorBodyClearance';

export interface ResidentRouteDoor {part:SitePart;transform:SiteGroupTransform}
export interface ResidentInteriorRouteContext {
 ground:GroundWorld;key:string;body:ActorBody;bodies:ActorSpace;query:InteriorRouteQuery;
 /** Immutable source-location identity; changing it invalidates prior paths. */
 policyToken:object;doors:ResidentRouteDoor[];
 /** One shared allowance for the mounted interior layer, keyed by render frame. */
 planningFrame?:{id:number;budget:ResidentPlanningFrameBudget};
}
export interface ResidentInteriorRouteState {
 ground?:GroundWorld;surfaces?:InteriorRouteQuery['surfaces'];policyToken?:object;signature?:string;expected?:InteriorRouteFoot;
 points?:InteriorRouteFoot[];stance?:boolean;retrySeconds?:number;failureFingerprint?:string;recoveryFingerprint?:string;
 pending?:{search:InteriorRouteSearch;stance:boolean;fingerprint:string;facing?:number};
}
export interface ResidentInteriorStep {position:InteriorRouteFoot;moving:boolean;rotationY:number;status:'walking'|'at-station'|'waiting-for-door'|'planning'|'blocked'}
const distance=(a:InteriorRouteFoot,b:InteriorRouteFoot)=>Math.hypot(a.xM-b.xM,a.yM-b.yM,a.zM-b.zM);
/** A square clearance query must cover every corner of the measured body at
 * any facing. This conservative radius can refuse a narrow path; it never
 * shrinks a wide body merely to fit the existing stair proposal. */
export function residentRouteRadius(body:ActorBody):number {
 const f=body.footprint;
 if(!Number.isFinite(body.radiusM)||body.radiusM<=0||!Number.isFinite(body.heightM)||body.heightM<=0)return NaN;
 if(!Number.isFinite(body.marginM??0)||(body.marginM??0)<0)return NaN;
 if(!f)return body.radiusM+(body.marginM??0);
 if(![f.minXM,f.maxXM,f.minZM,f.maxZM,f.yawRad].every(Number.isFinite)||f.minXM>=f.maxXM||f.minZM>=f.maxZM)return NaN;
 return Math.max(body.radiusM,...[f.minXM,f.maxXM].flatMap(x=>[f.minZM,f.maxZM].map(z=>Math.hypot(x,z))))+Math.max(0,body.marginM??0);
}

/** Use the reported box and current facing. Radius remains a broad bound
 * and compatibility proxy when no box has been measured. */
function residentMeasuredQuery(query:InteriorRouteQuery,body:ActorBody):InteriorRouteQuery {
 return {...query,bodyFootprint:body.footprint?{...body.footprint,marginM:body.marginM??0}:undefined};
}

/** Sample both sides and the hinge/end neighborhoods, then require a complete
 * physical route and all-body turn clearance. Candidate exhaustion is a
 * bounded refusal, not a claim that no operating stance could exist. */
function* residentDoorApproachSteps(from:InteriorRouteFoot,context:ResidentInteriorRouteContext):Generator<void,InteriorRouteResult,void> {
 const {body,bodies,key,ground}=context,query=residentMeasuredQuery(context.query,body),candidates:Array<{point:InteriorRouteFoot;door:ResidentRouteDoor}>=[];
 for(const door of context.doors){const {part,transform:t}=door;if(!part.door)continue;
  const length=part.door.axis==='x'?part.w:part.d,r=query.bodyRadiusM;
  for(const along of [-length/2-r-.08,-length/2+.1,0,length/2-.1,length/2+r+.08])for(const side of [-1,1])for(const gap of [r+.12,r+.5]){
   yield;
   const x=part.x+(part.door.axis==='x'?along:side*gap),z=part.z+(part.door.axis==='y'?along:side*gap);
   if(Math.hypot(Math.max(0,Math.abs(x-part.x)-part.w/2),Math.max(0,Math.abs(z-part.z)-part.d/2))>DOOR_BODY_REACH_M)continue;
   const c=Math.cos(t.rotationY),s=Math.sin(t.rotationY),lz=z*-t.doorZSign;
   const point={xM:t.groupX+x*c+lz*s,zM:t.groupZ-x*s+lz*c,yM:t.surfaceY+(part.baseY??0)};
   if(!query.acceptsFoot(point)||actorSpaceOverlaps(point,key,{...body,...point},bodies))continue;
   if(query.bodyFootprint&&!isGroundBodyClear(ground,point,query.standingHeightM,query.bodyFootprint,query.doors,query.surfaces))continue;
   // Turn clearance alone can select a point inside a wall or cabinet.
   // The walking owner allows old embedded feet to escape, so an idle query
   // cannot prove a new stance is clear. Tiny opposing supported sweeps must
   // all remain free before spending a bounded grid search on this point.
   let free=true;
   for(const [dx,dz]of [[.005,0],[-.005,0],[0,.005],[0,-.005]]){
    yield;const target={xM:point.xM+dx,zM:point.zM+dz};
    const probe=resolveGroundWalk(ground,point,target,query.doors,query.surfaces,query.standingHeightM,query.bodyRadiusM,query.bodyFootprint);
    if(probe.blocked||Math.hypot(probe.xM-target.xM,probe.zM-target.zM)>1e-6||Math.abs(probe.yM-point.yM)>=.02||!query.acceptsFoot(probe)){free=false;break;}
   }if(!free)continue;
   const proposed=new Map(bodies);proposed.set(key,{...body,...point});
   yield;const clear=doorBodyClearance(part,t,proposed);if(clear.valid&&!clear.blockers.length)candidates.push({point,door});
  }
 }
 candidates.sort((a,b)=>distance(from,a.point)-distance(from,b.point));
 for(const {point}of candidates.slice(0,12)){
  const route=yield* groundInteriorRouteSteps(ground,from,point,{...query,maxNodes:Math.min(500,query.maxNodes)});
  if(route.kind==='route')return route;
 }
 return {kind:'refused',reason:'no-grid-route',expanded:0};
}

/** Batch diagnostic compatibility; live actors advance the same steps through
 * a shared budget instead of draining them in a render frame. */
export function findResidentDoorApproach(from:InteriorRouteFoot,context:ResidentInteriorRouteContext):InteriorRouteFoot[]|null {
 const task=createInteriorRouteTask(residentDoorApproachSteps(from,context),context.query.doors);
 for(;;){const step=task.advance({maxWork:Number.MAX_SAFE_INTEGER,maxMs:Infinity});if(step.kind==='done')return step.result.kind==='route'?step.result.points:null;}
}

export interface ResidentPlanningFrameBudget {
 /** Work/time cover all validated tasks run by this call; its result belongs
  * only to the named resident and never advances another body. */
 advance:(key:string,frame:number,search:InteriorRouteSearch)=>InteriorRouteSearchUpdate;
 cancel:(key:string,search:InteriorRouteSearch)=>void;forget:(key:string)=>void;
}
/** One cooperative allowance across all nearby residents, with least-work-served
 * fairness. Jobs run only after their actor validates them in this frame.
 * Results wait for that actor's next validation. Cancel removes their
 * authority to resume; unmounted/inactive registrations cannot block peers. */
export function createResidentPlanningFrameBudget(maxMs=2,maxWork=128,now=()=>performance.now()):ResidentPlanningFrameBudget {
 if(!(maxMs>0)||!Number.isSafeInteger(maxWork)||maxWork<=0)throw new RangeError('A frame allowance needs positive time and work budgets.');
 type Entry={search?:InteriorRouteSearch;completed?:{search:InteriorRouteSearch;result:InteriorRouteResult};turn:number;seen:number};
 const entries=new Map<string,Entry>();let frameId:number|undefined,sequence=0,spentMs=0,spentWork=0;
 const pending=():InteriorRouteSearchUpdate=>({kind:'pending',work:0,elapsedMs:0});
 return {cancel:(key,search)=>{const e=entries.get(key);if(e?.search===search)e.search=undefined;if(e?.completed?.search===search)e.completed=undefined;search.cancel();},forget:key=>{const e=entries.get(key);if(!e?.search&&!e?.completed)entries.delete(key);},
  advance:(key,frame,search)=>{
   if(!Number.isFinite(frame))return pending();
   if(frameId!==frame){frameId=frame;sequence++;spentMs=0;spentWork=0;for(const [id,e]of entries)if(e.seen<sequence-1)entries.delete(id);}
   let entry=entries.get(key);if(!entry){entry={turn:0,seen:sequence};entries.set(key,entry);}entry.seen=sequence;
   if(entry.completed?.search===search)return {kind:'done',result:entry.completed.result,work:0,elapsedMs:0};
   entry.completed=undefined;entry.search=search;let work=0,elapsedMs=0;
   // Call order must not discard the remaining allowance. Earlier actors may
   // have already validated a job and returned pending. Once the oldest job
   // is ready, continue any validated jobs here, retaining their pure result
   // until their own actor next checks source/body/feet authority. Never run
   // a previous-frame job before its actor validates it in this frame.
   while(spentWork<maxWork&&spentMs<maxMs){
    let next:Entry|undefined,turn=Infinity,id:string|undefined;
    for(const [candidate,e]of entries)if(e.search&&(e.turn<turn||e.turn===turn&&(id===undefined||candidate<id))){next=e;turn=e.turn;id=candidate;}
    if(!next||next.seen!==sequence)break;
    const sole=[...entries.values()].filter(e=>e.search).length===1;
    const job=next.search!,update=job.advance({maxWork:Math.min(sole?maxWork:16,maxWork-spentWork),maxMs:Math.min(sole?maxMs:.5,maxMs-spentMs),now});
    spentWork+=update.work;spentMs+=update.elapsedMs;work+=update.work;elapsedMs+=update.elapsedMs;next.turn+=update.work;
    if(update.kind==='done'){next.completed={search:job,result:update.result};next.search=undefined;}
    else if(!update.work)break;
   }
   const done=entries.get(key)?.completed;
   return done?.search===search?{kind:'done',result:done.result,work,elapsedMs}:{kind:'pending',work,elapsedMs};
  }};
}

/** Cancel only this resident's pending job; accepted feet and door state are
 * untouched. Used when source authority disappears or the actor unmounts. */
export function cancelResidentInteriorPlanning(key:string,state:ResidentInteriorRouteState,budget?:ResidentPlanningFrameBudget):void {
 if(state.pending){if(budget)budget.cancel(key,state.pending.search);else state.pending.search.cancel();state.pending=undefined;}
}

/** One bounded physical step. Paths are transient and invalidated by source,
 * destination, body dimensions, door state or an unexpected accepted position.
 * Current bodies and geometry are checked again while following every segment;
 * a newly blocked resident waits/replans and never snaps to a schedule point. */
export function advanceResidentInteriorRoute(from:InteriorRouteFoot,goal:InteriorRouteFoot,deltaSeconds:number,context:ResidentInteriorRouteContext,state:ResidentInteriorRouteState):ResidentInteriorStep {
 const {ground,key,body,bodies}=context,query=residentMeasuredQuery(context.query,body);
 const cancel=()=>cancelResidentInteriorPlanning(key,state,context.planningFrame?.budget);
 const hold=(status:ResidentInteriorStep['status']='blocked'):ResidentInteriorStep=>({position:{...from},moving:false,rotationY:body.footprint?.yawRad??0,status});
 if(!Number.isFinite(deltaSeconds)||deltaSeconds<0||![from.xM,from.yM,from.zM,goal.xM,goal.yM,goal.zM,query.bodyRadiusM,query.standingHeightM].every(Number.isFinite)
  ||query.bodyRadiusM<=0||query.standingHeightM<=0||query.standingHeightM+1e-8<body.heightM||!Number.isFinite(residentRouteRadius(body))||query.bodyRadiusM+1e-8<residentRouteRadius(body)){cancel();return hold();}
 if([...bodies.values()].some(b=>![b.xM,b.yM,b.zM,residentRouteRadius(b)].every(Number.isFinite))){cancel();return hold();}
 const signature=JSON.stringify([goal.xM,goal.yM,goal.zM,body.radiusM,body.heightM,body.marginM??0,query.bodyRadiusM,query.standingHeightM,query.bodyFootprint&&[query.bodyFootprint.minXM,query.bodyFootprint.maxXM,query.bodyFootprint.minZM,query.bodyFootprint.maxZM,query.bodyFootprint.marginM??0],query.grid,query.maxNodes,query.coarseSearch&&[query.coarseSearch.stepMultiplier,query.coarseSearch.maxNodes],query.surfaces?.supportReadyAt?.(from.xM,from.zM),query.surfaces?.supportReadyAt?.(goal.xM,goal.zM),[...query.doors].sort(),context.doors.map(d=>[d.part.door?.id,d.transform])]);
 if(state.ground!==ground||state.surfaces!==query.surfaces||state.policyToken!==context.policyToken||state.signature!==signature||state.expected&&distance(from,state.expected)>.005){
  cancel();state.ground=ground;state.surfaces=query.surfaces;state.policyToken=context.policyToken;state.signature=signature;state.points=undefined;state.stance=false;state.retrySeconds=0;state.failureFingerprint=undefined;state.recoveryFingerprint=undefined;
 }
 state.expected={...from};
 let crowdStamp:string|undefined;
 const readCrowdStamp=()=>crowdStamp??=JSON.stringify([body.footprint?.yawRad,[...bodies].filter(([id])=>id!==key).sort(([a],[b])=>a.localeCompare(b)).map(([id,b])=>[id,b.xM,b.yM,b.zM,b.radiusM,b.heightM,b.marginM,b.footprint])]);
 if(!query.acceptsFoot(from)){cancel();return hold();}
 // An existing contact must be able to relax before the route planner admits
 // its start, including a resident already at the hourly station. Reuse the
 // personal-space owner: keep facing, real supports, every body and source
 // room limits. This local same-floor escape grants no door or bedroom access.
 if(actorSpaceOverlaps(from,key,body,bodies)){
  cancel();state.points=undefined;state.stance=false;state.retrySeconds=0;state.failureFingerprint=undefined;
  if(deltaSeconds===0)return hold();
  const stamp=JSON.stringify([from.xM,from.yM,from.zM,Math.min(.1,deltaSeconds),readCrowdStamp()]);
  // Keep a blocked pose quiet until bodies, source, feet or step allowance
  // change. Repeating the same local probes every frame adds no escape.
  if(state.recoveryFingerprint===stamp)return hold();
  const probe=(target:InteriorRouteFoot):InteriorRouteFoot|null=>{
   const count=Math.max(1,Math.ceil(Math.hypot(target.xM-from.xM,target.zM-from.zM)/.04));let point={...from};
   for(let i=1;i<=count;i++){
    const requested={xM:from.xM+(target.xM-from.xM)*i/count,zM:from.zM+(target.zM-from.zM)*i/count};
    const reached=resolveGroundWalk(ground,point,requested,query.doors,query.surfaces,query.standingHeightM,query.bodyRadiusM,query.bodyFootprint);
    const clipped=clipActorStep(point,reached,key,{...body,...point},bodies);
    if(reached.blocked||Math.abs(reached.yM-from.yM)>.08||!query.acceptsFoot(reached)||clipped.blocked||distance(clipped,reached)>.00001)return null;
    point={xM:reached.xM,yM:reached.yM,zM:reached.zM};
   }return point;
  };
  const reached=yieldActorStep(from,goal,key,{...body,...from},bodies,1.2*Math.min(.1,deltaSeconds),probe,bodies);
  if(distance(from,reached)<=1e-6){state.recoveryFingerprint=stamp;return hold();}
  state.recoveryFingerprint=undefined;state.expected={xM:reached.xM,yM:reached.yM,zM:reached.zM};
  return {position:{...state.expected},moving:true,rotationY:body.footprint?.yawRad??0,status:'walking'};
 }
 state.recoveryFingerprint=undefined;
 if(distance(from,goal)<.025){cancel();return hold('at-station');}
 // A static refusal is retried only after relevant bodies, doors, source or
 // destination change. Repeating the same failed whole-house search every
 // few frames would stall a furnished room without adding new evidence.
 const fingerprint=readCrowdStamp();
 if(state.pending&&state.pending.facing!==body.footprint?.yawRad)cancel();
 if(!state.points&&state.failureFingerprint===fingerprint)return hold();
 state.retrySeconds=Math.max(0,(state.retrySeconds??0)-Math.min(.1,deltaSeconds));
 if(!state.points&&!state.pending&&state.retrySeconds===0){
  // A frozen crowd proposes a route; it does not authorize movement. Keep
  // planning progress while people move elsewhere, then sweep every actual
  // step/turn against today's bodies. Cancelling for every bystander motion
  // prevented even an empty stair route from ever finishing.
  // DEBT: A new blocker may still require a later replan or a wait. This is
  // not reciprocal crowd avoidance or a guarantee that opposing trips finish.
  const copyBody=(b:ActorBody):ActorBody=>({...b,footprint:b.footprint?{...b.footprint}:undefined});
  const snapshotBody=copyBody(body),snapshotBodies=new Map([...bodies].map(([id,b])=>[id,copyBody(b)]));
  // A family member may still occupy the next activity's destination while
  // preparing to leave. Let the route proposal approach that body; today's
  // full ledger still clips every physical step, so arrival waits for space.
  // Only destination blockers are omitted from this frozen proposal. Aisle
  // bystanders and all door-operating stances retain their original checks.
  const proposalBodies=new Map(snapshotBodies);
  if(!context.doors.length)for(const [id,other]of snapshotBodies){
   if(id!==key&&actorSpaceOverlaps(goal,key,{...snapshotBody,...goal},new Map([[id,other]])))proposalBodies.delete(id);
  }
  const admitted={...query,grid:{...query.grid},acceptsFoot:(p:InteriorRouteFoot)=>query.acceptsFoot(p)&&!actorSpaceOverlaps(p,key,{...snapshotBody,...p},proposalBodies)};
  // Closed claimed leaves require a physically reachable operating stance.
  // This uses the same sliced allowance as a room/stair route and never opens
  // a door or grants access while work is pending.
  const search=context.doors.length?createInteriorRouteTask(residentDoorApproachSteps({...from},{...context,body:snapshotBody,bodies:snapshotBodies,query:admitted,doors:[...context.doors]}),query.doors)
   :createGroundInteriorRouteSearch(ground,from,goal,admitted);
  state.pending={search,stance:context.doors.length>0,fingerprint,facing:body.footprint?.yawRad};
 }
 if(state.pending){
  const job=state.pending,frame=context.planningFrame;
  const update=frame?frame.budget.advance(key,frame.id,job.search):job.search.advance({maxWork:32,maxMs:1});
  if(update.kind==='pending')return hold('planning');
  state.pending=undefined;
  if(update.result.kind==='route'){state.points=update.result.points.slice(1);state.stance=job.stance;state.failureFingerprint=undefined;}
  else {state.retrySeconds=.5;state.failureFingerprint=job.fingerprint;}
 }
 let point={...from},budget=1.2*Math.min(.1,deltaSeconds),rotationY=body.footprint?.yawRad??0;
 for(let segment=0;segment<64&&state.points?.length&&budget>1e-7;segment++){
  const target=state.points[0],horizontal=Math.hypot(target.xM-point.xM,target.zM-point.zM);
  if(distance(point,target)<1e-6){state.points.shift();continue;}
  const share=horizontal>0?Math.min(1,budget/horizontal):1;
  const requested={xM:point.xM+(target.xM-point.xM)*share,zM:point.zM+(target.zM-point.zM)*share};
  const facing=Math.atan2(requested.xM-point.xM,requested.zM-point.zM);
  const currentBody={...body,...point,footprint:body.footprint?{...body.footprint,yawRad:rotationY}:undefined};
  const currentFoot=currentBody.footprint?{...currentBody.footprint,marginM:body.marginM??0}:undefined;
  // Admit the complete turn against people AND canonical solids before using
  // its new facing for translation. Otherwise retain facing and sidestep.
  const turn=canActorTurn(point,key,currentBody,facing,bodies)&&(!currentFoot||canGroundBodyTurn(ground,point,query.standingHeightM,currentFoot,facing,query.doors,query.surfaces));
  let oriented=turn?{...currentBody,footprint:currentBody.footprint?{...currentBody.footprint,yawRad:facing}:undefined}:currentBody;
  const walkWith=(person:typeof currentBody)=>resolveGroundWalk(ground,point,requested,query.doors,query.surfaces,query.standingHeightM,query.bodyRadiusM,person.footprint?{...person.footprint,marginM:person.marginM??0}:undefined);
  let reached=walkWith(oriented);
  if(reached.blocked&&turn&&currentFoot){const retained=walkWith(currentBody);if(!retained.blocked){oriented=currentBody;reached=retained;}}
  const clipped=clipActorStep(point,reached,key,{...oriented,...point},bodies);
  if(reached.blocked||distance(point,reached)<1e-8||!query.acceptsFoot(reached)){state.points=undefined;state.retrySeconds=.5;state.failureFingerprint=undefined;break;}
  if(clipped.blocked||distance(clipped,reached)>.00001){
   // Waiting for the destination's occupant does not change the static path.
   // Keep it only when removing those goal occupants clears this exact step;
   // an unrelated aisle obstruction still needs the original detour/replan.
   const besideDestination=new Map(bodies);let occupied=false;
   for(const [id,other]of bodies)if(id!==key&&actorSpaceOverlaps(goal,key,{...oriented,...goal},new Map([[id,other]]))){besideDestination.delete(id);occupied=true;}
   const withoutGoal=clipActorStep(point,reached,key,{...oriented,...point},besideDestination);
   if(!occupied||withoutGoal.blocked||distance(withoutGoal,reached)>.00001){state.points=undefined;state.retrySeconds=.5;state.failureFingerprint=undefined;}
   break;
  }
  rotationY=oriented.footprint?.yawRad??facing;point={xM:reached.xM,yM:reached.yM,zM:reached.zM};budget-=Math.hypot(point.xM-state.expected!.xM,point.zM-state.expected!.zM);state.expected={...point};
  if(share===1)state.points.shift();
 }
 const moving=distance(from,point)>1e-6;state.expected={...point};
 return {position:point,moving,rotationY,status:moving?'walking':state.stance&&state.points?.length===0?'waiting-for-door':distance(point,goal)<.025?'at-station':'blocked'};
}

/** Build a foot-region policy from the exact resident packet and actual slab
 * heights. Stairs admit only their recorded shaft/landings between adjoining floors;
 * a missing room/stair packet refuses rather than borrowing another bedroom. */
export function residentRouteRegion(access:ResidentPrivateDoorAccess,memberId:string,transform:SiteGroupTransform,originFt:{x:number;y:number},floorTops:ReadonlyMap<number,number>):((point:InteriorRouteFoot)=>boolean)|null {
 if(access.memberId!==memberId||!access.routeRooms||!access.routeStairs||![-1,1].includes(transform.doorZSign))return null;
 if(![originFt.x,originFt.y,transform.groupX,transform.groupZ,transform.rotationY,transform.surfaceY].every(Number.isFinite))return null;
 const validCell=(cell:{cx:number;cy:number})=>Number.isSafeInteger(cell.cx)&&Number.isSafeInteger(cell.cy);
 if(access.routeRooms.some(room=>!Number.isSafeInteger(room.level)||!floorTops.has(room.level)||room.cells.some(c=>!validCell(c)))
  ||access.routeStairs.some(stair=>!floorTops.has(stair.fromLevel)||!floorTops.has(stair.fromLevel+1)||stair.cells.some(c=>!validCell(c))))return null;
 const rooms=access.routeRooms,stairs=access.routeStairs;
 return point=>{
  const local=worldOffsetToSiteLocal(point.xM-transform.groupX,point.zM-transform.groupZ,transform.rotationY);
  const cx=Math.floor((local.lx/.3048+originFt.x)/5+1e-8),cy=Math.floor((local.lz*-transform.doorZSign/.3048+originFt.y)/5+1e-8);
  const contains=(cells:Array<{cx:number;cy:number}>)=>cells.some(cell=>cell.cx===cx&&cell.cy===cy);
  return rooms.some(room=>Math.abs(point.yM-floorTops.get(room.level)!)<.08&&contains(room.cells))
   ||stairs.some(stair=>point.yM>=floorTops.get(stair.fromLevel)!-.02&&point.yM<=floorTops.get(stair.fromLevel+1)!+.02&&contains(stair.cells));
 };
}

/** Representation is not route/door authority. A bounded street roster can
 * omit a real household member; retain that source body at its accepted feet
 * while the missing join is repaired. The initial station is used only when
 * there has never been an observed/accepted placement, never on a later hour. */
export function heldResidentFoot(accepted:InteriorRouteFoot|null|undefined,observed:InteriorRouteFoot|null|undefined,previous:InteriorRouteFoot|null|undefined,initialStation:InteriorRouteFoot|null|undefined):InteriorRouteFoot|null {
 for(const point of [accepted,observed,previous,initialStation])if(point&&[point.xM,point.yM,point.zM].every(Number.isFinite))return {...point};
 return null;
}
