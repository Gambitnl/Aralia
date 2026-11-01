/**
 * Propose a new rural approach around lots and yards after the cheap straight
 * routes fail. The town planner supplies full-width point/segment admission;
 * this search never waives an obstacle or changes an established street.
 * Existing roster routing follows already-built streets, while combat routing
 * prices creature movement on battle tiles. This source-construction search
 * therefore reuses the town's geometric admission instead of inventing tiles.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/11/2026, 06:15:15
 * Dependents: systems/worldforge/town/ruralHomesteads.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { Pt } from '../submap/submapEngine';
export interface RuralApproachSearch {
  start: Pt;
  targets: readonly Pt[];
  step: number;
  maxExpanded?: number;
  pointClear: (point:Pt)=>boolean;
  /** A public-road junction may use its own admitted round cap rather than a new square turn. */
  targetClear?: (point:Pt)=>boolean;
  /** Another admitted junction on the same indexed public target source. */
  connect?: (point:Pt)=>{point:Pt;targetIndex:number}|undefined;
  estimate?: (point:Pt)=>number;
  onRefusal?: (reason:'invalid-request'|'blocked-start'|'no-admitted-target'|'search-limit'|'disconnected')=>void;
  segmentClear: (from:Pt,to:Pt)=>boolean;
}
export interface RuralApproachResult {points:Pt[];targetIndex:number;expanded:number}
interface Node {x:number;y:number;point:Pt;g:number;h:number;serial:number;parent?:Node}
const less=(a:Node,b:Node)=>a.g+a.h<b.g+b.h||(a.g+a.h===b.g+b.h&&(a.h<b.h||(a.h===b.h&&a.serial<b.serial)));
/** The queue is local to one bounded source search, with stable tie breaking. */
function push(heap:Node[],node:Node){
  heap.push(node);let i=heap.length-1;
  while(i>0){const parent=(i-1)>>1;if(!less(heap[i],heap[parent]))break;[heap[i],heap[parent]]=[heap[parent],heap[i]];i=parent;}
}
function pop(heap:Node[]):Node{
  const first=heap[0],last=heap.pop()!;
  if(heap.length){heap[0]=last;let i=0;while(true){let best=i;const left=i*2+1,right=left+1;
    if(left<heap.length&&less(heap[left],heap[best]))best=left;
    if(right<heap.length&&less(heap[right],heap[best]))best=right;
    if(best===i)break;[heap[i],heap[best]]=[heap[best],heap[i]];i=best;
  }}return first;
}
const distance=(a:Pt,b:Pt)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const finite=(p:Pt)=>p.every(Number.isFinite);

/** Undefined means this bounded search found no admitted connection; it does
 * not establish global unreachability or authorize a smaller clearance. */
export function findRuralApproach(request:RuralApproachSearch):RuralApproachResult|undefined{
  const {start,step,pointClear,segmentClear}=request;
  const limit=Math.min(8000,request.maxExpanded??3000);
  if(!finite(start)||!Number.isFinite(step)||step<=0||!Number.isInteger(limit)||limit<1){request.onRefusal?.('invalid-request');return;}
  if(!pointClear(start)){request.onRefusal?.('blocked-start');return;}
  const targets=request.targets.map((point,index)=>({point,index})).filter(t=>finite(t.point)&&(request.targetClear??pointClear)(t.point));
  // A source street may have blocked seed projections but a clear junction
  // elsewhere. Let its connector prove that junction without admitting the seeds.
  if(!targets.length&&(!request.connect||!request.targets.some(finite))){request.onRefusal?.('no-admitted-target');return;}
  const heuristic=(p:Pt)=>{
    const estimate=request.estimate?.(p);
    return Number.isFinite(estimate)&&estimate!>=0?estimate!:targets.length?Math.min(...targets.map(t=>distance(p,t.point))):0;
  };
  const heap:Node[]=[],best=new Map<string,number>(),pointCache=new Map<string,boolean>();
  let serial=0,expanded=0;
  push(heap,{x:0,y:0,point:[...start],g:0,h:heuristic(start),serial:serial++});best.set('0:0',0);
  const directions=[[-1,0],[0,-1],[1,0],[0,1],[-1,-1],[1,-1],[1,1],[-1,1]] as const;
  while(heap.length&&expanded<limit){
    const node=pop(heap),key=node.x+':'+node.y;
    if(node.g!==best.get(key))continue;
    expanded++;
    // Try an admitted source-street junction near this node, rather than
    // forcing the grid to reproduce a narrow existing street centerline.
    const connection=request.connect?.(node.point);
    const extra=connection&&Number.isInteger(connection.targetIndex)&&connection.targetIndex>=0&&connection.targetIndex<request.targets.length
      &&finite(connection.point)&&(request.targetClear??pointClear)(connection.point)
      ?{point:connection.point,index:connection.targetIndex}:undefined;
    const sightLine=expanded===1;
    const goalChoices=extra?[extra,...targets]:sightLine?[...targets].sort((a,b)=>distance(node.point,a.point)-distance(node.point,b.point)):targets;
    for(const target of goalChoices){
      if((target!==extra&&!sightLine&&distance(node.point,target.point)>step*1.5)||!segmentClear(node.point,target.point))continue;
      const points:Pt[]=[];for(let current:Node|undefined=node;current;current=current.parent)points.push([...current.point]);
      points.reverse();if(distance(points[points.length-1],target.point)>1e-8)points.push([...target.point]);
      // Remove the grid's stair steps only when the full-width shortcut is
      // independently admitted. Never smooth through a corner or private yard.
      const smooth:Pt[]=[points[0]];let i=0;
      while(i<points.length-1){let next=i+1;
        for(let j=Math.min(points.length-1,i+64);j>i+1;j--)if(segmentClear(points[i],points[j])){next=j;break;}
        smooth.push(points[next]);i=next;
      }
      return {points:smooth,targetIndex:target.index,expanded};
    }
    for(const [dx,dy]of directions){
      const x=node.x+dx,y=node.y+dy,nextKey=x+':'+y,g=node.g+Math.hypot(dx,dy)*step;
      if(g>=(best.get(nextKey)??Infinity))continue;
      const point:Pt=[start[0]+x*step,start[1]+y*step];
      if(!finite(point))continue;
      let clear=pointCache.get(nextKey);if(clear===undefined){clear=pointClear(point);pointCache.set(nextKey,clear);}
      if(!clear||!segmentClear(node.point,point))continue;
      best.set(nextKey,g);push(heap,{x,y,point,g,h:heuristic(point),serial:serial++,parent:node});
    }
  }
  request.onRefusal?.(expanded>=limit?'search-limit':'disconnected');
}
