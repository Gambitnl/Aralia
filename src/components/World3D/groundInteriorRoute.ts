/** Bounded indoor route queries over the existing physical walking solver.
 * Every segment keeps real support, stair steps, solids and headroom. This
 * returns evidence only: it never moves an actor, opens a door or grants access.
 * Callers must supply their admitted region/room policy and body envelope. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/11/2026, 19:29:51
 * Dependents: components/World3D/residentInteriorMotion.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {GroundWorld} from '@/systems/worldforge/bridge/groundChunkLoader';
import {resolveGroundWalk,isValidGroundBodyFootprint,type GroundWalkSurfaces,type GroundBodyFootprint} from './groundBuildingMotion';
export interface InteriorRouteFoot {xM:number;yM:number;zM:number}
export interface InteriorRouteQuery {
  bodyRadiusM:number;standingHeightM:number;
  /** Fixed measured facing for this translation search. Turns are separately
   * rechecked by the follower; this is not an orientation-state path search. */
  bodyFootprint?:GroundBodyFootprint;
  doors:ReadonlySet<string>;surfaces?:GroundWalkSurfaces;
  /** Actual allowed interior/room region. A geometric route is not consent. */
  acceptsFoot:(point:InteriorRouteFoot)=>boolean;
  /** Align fine nodes with the source building; rotated stairs need its axes. */
  grid:{originXM:number;originZM:number;yawRad:number;stepM:number};
  maxNodes:number;
  /** Optional wider proposal for rises over0.5m. It uses the same origin,
   * axes, body and0.04m physical traces. Failure retains the FULL fine budget;
   * reported expansions include both independently bounded passes. */
  coarseSearch?:{stepMultiplier:number;maxNodes:number};
}
export type InteriorRouteResult={kind:'route';points:InteriorRouteFoot[];distanceM:number;expanded:number}
 |{kind:'refused';reason:'invalid-query'|'unsupported-start'|'outside-region'|'no-grid-route'|'search-limit'|'cancelled'|'changed-query';expanded:number};
interface Node {key:string;gx:number;gz:number;point:InteriorRouteFoot;g:number;f:number;parent?:string;edge:InteriorRouteFoot[]}
const distance=(a:InteriorRouteFoot,b:InteriorRouteFoot)=>Math.hypot(a.xM-b.xM,a.yM-b.yM,a.zM-b.zM);
/** Query, do not adopt. A refused bounded grid is not proof that no continuous
 * route exists; search limits and grid failures remain distinct diagnostics.
 * The horizontal envelope is explicit, never guessed from a person's name. */
export function* groundInteriorRouteSteps(ground:GroundWorld,from:InteriorRouteFoot,goal:InteriorRouteFoot,q:InteriorRouteQuery):Generator<void,InteriorRouteResult,void>{
 const invalid=()=>({kind:'refused' as const,reason:'invalid-query' as const,expanded:0});
 if(![from.xM,from.yM,from.zM,goal.xM,goal.yM,goal.zM,q.bodyRadiusM,q.standingHeightM,q.grid.originXM,q.grid.originZM,q.grid.yawRad,q.grid.stepM].every(Number.isFinite)
  ||q.bodyRadiusM<=0||q.standingHeightM<=0||q.grid.stepM<=0||!Number.isSafeInteger(q.maxNodes)||q.maxNodes<=0)return invalid();
 if(q.bodyFootprint!==undefined&&!isValidGroundBodyFootprint(q.bodyFootprint))return invalid();
 const coarse=q.coarseSearch;
 if(coarse!==undefined&&(!coarse||!Number.isSafeInteger(coarse.stepMultiplier)||coarse.stepMultiplier<2||coarse.stepMultiplier>8||!Number.isSafeInteger(coarse.maxNodes)||coarse.maxNodes<=0))return invalid();
 if(!q.acceptsFoot(from)||!q.acceptsFoot(goal))return {kind:'refused',reason:'outside-region',expanded:0};
 yield;
 const initial=resolveGroundWalk(ground,from,from,q.doors,q.surfaces,q.standingHeightM,q.bodyRadiusM,q.bodyFootprint);
 if(initial.blocked)return {kind:'refused',reason:'unsupported-start',expanded:0};
 // Even a zero-distance query preserves accepted feet verbatim.
 if(distance(from,goal)<1e-9)return {kind:'route',points:[{...from}],distanceM:0,expanded:0};
 function* trace(a:InteriorRouteFoot,b:InteriorRouteFoot):Generator<void,InteriorRouteFoot[]|null,void>{
  const dx=b.xM-a.xM,dz=b.zM-a.zM,steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.04));
  let pose={...a};const points:InteriorRouteFoot[]=[];
  for(let i=1;i<=steps;i++){
   const target={xM:a.xM+dx*i/steps,zM:a.zM+dz*i/steps};
   yield;
   const next=resolveGroundWalk(ground,pose,target,q.doors,q.surfaces,q.standingHeightM,q.bodyRadiusM,q.bodyFootprint);
   if(next.blocked||Math.hypot(next.xM-target.xM,next.zM-target.zM)>1e-6||!q.acceptsFoot(next))return null;
   pose={xM:next.xM,yM:next.yM,zM:next.zM};points.push(pose);
  }
  return points;
 };
 const direct=yield* trace(from,goal);
 if(direct&&Math.abs(direct.at(-1)!.yM-goal.yM)<.025)return {kind:'route',points:[{...from},...direct],distanceM:direct.reduce((sum,p,i)=>sum+distance(i?direct[i-1]:from,p),0),expanded:0};
 // A stair trip can find a safe proposal with fewer grid nodes. This is not
 // larger physical stepping: every edge below still samples at most0.04m and
 // checks the same admitted rooms, support and measured box. Keep source axes
 // and origin; feet-anchored trials missed real return-stair routes.
 let coarseExpanded=0;
 if(coarse&&Math.abs(goal.yM-from.yM)>.5){
  const proposal=yield* groundInteriorRouteSteps(ground,from,goal,{...q,coarseSearch:undefined,grid:{...q.grid,stepM:q.grid.stepM*coarse.stepMultiplier},maxNodes:coarse.maxNodes});
  coarseExpanded=proposal.expanded;if(proposal.kind==='route')return proposal;
  // A coarse miss is never proof of no route and must not spend the fine
  // search's existing node allowance. Only the extra work count is retained.
 }
 const c=Math.cos(q.grid.yawRad),s=Math.sin(q.grid.yawRad),step=q.grid.stepM;
 const local=(p:InteriorRouteFoot)=>({x:(p.xM-q.grid.originXM)*c-(p.zM-q.grid.originZM)*s,z:(p.xM-q.grid.originXM)*s+(p.zM-q.grid.originZM)*c});
 const world=(x:number,z:number)=>({xM:q.grid.originXM+x*c+z*s,zM:q.grid.originZM-x*s+z*c});
 const source=local(from),key=(x:number,z:number,y:number)=>x+':'+z+':'+Math.round(y*1000);
 const gx=Math.round(source.x/step),gz=Math.round(source.z/step),start=key(gx,gz,from.yM);
 const first:Node={key:start,gx,gz,point:{...from},g:0,f:distance(from,goal),edge:[]};
 const nodes=new Map([[start,first]]),open=new Set([start]),closed=new Set<string>();let expanded=0;
 function* path(last:Node,tail:InteriorRouteFoot[]):Generator<void,InteriorRouteResult,void>{
  const edges:InteriorRouteFoot[][]=[tail];let node=last;
  while(node.parent){yield;edges.push(node.edge);node=nodes.get(node.parent)!;}
  const points=[{...from}];let distanceM=0,work=0;
  for(const edge of edges.reverse())for(const point of edge){if(work++%64===0)yield;distanceM+=distance(points.at(-1)!,point);points.push(point);}
  return {kind:'route',points,distanceM,expanded:expanded+coarseExpanded};
 };
 while(open.size&&expanded<q.maxNodes){
  yield;
  let current:Node|undefined;
  // Stable minimum selection follows the existing small street-graph search;
  // no new global path cache can outlive a changed door or building source.
  for(const id of open){const candidate=nodes.get(id)!;if(!current||candidate.f<current.f-1e-9||Math.abs(candidate.f-current.f)<1e-9&&candidate.key<current.key)current=candidate;}
  const node=current!;open.delete(node.key);closed.add(node.key);expanded++;
  if(Math.hypot(node.point.xM-goal.xM,node.point.zM-goal.zM)<=step*1.5){
   const tail=yield* trace(node.point,goal);if(tail&&Math.abs(tail.at(-1)!.yM-goal.yM)<.025)return yield* path(node,tail);
  }
  for(const [dx,dz]of [[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[-1,-1],[1,-1]]){
   const x=node.gx+dx,z=node.gz+dz,target=world(x*step,z*step);
   const edge=yield* trace(node.point,{...target,yM:node.point.yM});if(!edge)continue;
   const point=edge.at(-1)!,id=key(x,z,point.yM);if(closed.has(id))continue;
   const cost=node.g+edge.reduce((sum,p,i)=>sum+distance(i?edge[i-1]:node.point,p),0),previous=nodes.get(id);
   if(previous&&previous.g<=cost+1e-9)continue;
   nodes.set(id,{key:id,gx:x,gz:z,point,g:cost,f:cost+distance(point,goal),parent:node.key,edge});open.add(id);
  }
 }
 return {kind:'refused',reason:open.size?'search-limit':'no-grid-route',expanded:expanded+coarseExpanded};
}

export interface InteriorRouteSliceBudget {maxWork:number;maxMs:number;now?:()=>number}
export type InteriorRouteSearchUpdate={kind:'pending';work:number;elapsedMs:number}|{kind:'done';result:InteriorRouteResult;work:number;elapsedMs:number};
export interface InteriorRouteSearch {advance:(budget:InteriorRouteSliceBudget)=>InteriorRouteSearchUpdate;cancel:()=>void}
const doorStamp=(doors:ReadonlySet<string>)=>JSON.stringify([...doors].sort());
/** The same algorithm can run in short slices or drain synchronously off the
 * render path. A work unit is at most one physical probe, node selection or
 * small reconstruction batch. Time limits are cooperative: one atomic probe
 * or cold cache build can exceed them, so this is not an FPS acceptance. */
export function createInteriorRouteTask(steps:Generator<void,InteriorRouteResult,void>,doors:ReadonlySet<string>):InteriorRouteSearch {
 const stamp=doorStamp(doors);let result:InteriorRouteResult|undefined;
 const stop=(reason:'cancelled'|'changed-query')=>{if(!result){result={kind:'refused',reason,expanded:0};steps.return(result);}};
 return {cancel:()=>stop('cancelled'),advance:budget=>{
  if(!Number.isSafeInteger(budget.maxWork)||budget.maxWork<=0||!(budget.maxMs>0))throw new RangeError('A route slice needs positive work and time budgets.');
  const now=budget.now??(()=>performance.now()),start=now();let work=0;
  if(!result&&stamp!==doorStamp(doors))stop('changed-query');
  while(!result&&work<budget.maxWork&&(work===0||now()-start<budget.maxMs)){const next=steps.next();work++;if(next.done)result=next.value;}
  return result?{kind:'done',result,work,elapsedMs:Math.max(0,now()-start)}:{kind:'pending',work,elapsedMs:Math.max(0,now()-start)};
 }};
}
/** Scalar inputs are copied; source geometry and region policy must remain
 * immutable for a task. Its owner cancels on source, body or policy changes.
 * A mutated door set is explicitly rejected rather than mixing two states. */
export function createGroundInteriorRouteSearch(ground:GroundWorld,from:InteriorRouteFoot,goal:InteriorRouteFoot,q:InteriorRouteQuery):InteriorRouteSearch {
 const query={...q,grid:{...q.grid},coarseSearch:q.coarseSearch?{...q.coarseSearch}:q.coarseSearch,bodyFootprint:q.bodyFootprint?{...q.bodyFootprint}:q.bodyFootprint};
 return createInteriorRouteTask(groundInteriorRouteSteps(ground,{...from},{...goal},query),q.doors);
}
/** Compatibility batch query. Live resident frames use the resumable task
 * instead; draining this helper in a render frame can still block that frame. */
export function findGroundInteriorRoute(ground:GroundWorld,from:InteriorRouteFoot,goal:InteriorRouteFoot,q:InteriorRouteQuery):InteriorRouteResult {
 const search=createGroundInteriorRouteSearch(ground,from,goal,q);
 for(;;){const update=search.advance({maxWork:Number.MAX_SAFE_INTEGER,maxMs:Infinity});if(update.kind==='done')return update.result;}
}
