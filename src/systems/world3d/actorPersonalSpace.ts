/** Scene-local footprints of mounted visible bodies. They disappear on unmount;
 * identities, schedules and saves remain with their existing owners. Geometry
 * still decides where a foot can stand before actor separation is considered. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/11/2026, 18:03:43
 * Dependents: components/World3D/actorPersonalSpace.ts, systems/world3d/groundBuildingMotion.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

// Moved 2026-11-02 from src/components/World3D/actorPersonalSpace.ts (GG-587, rule C11): systems/ code
// (prepareHistoricalTownLoad) needs this pure module. The old path re-exports it.

export interface ActorPoint {xM:number; yM:number; zM:number}
export interface ActorBody extends ActorPoint {radiusM:number; heightM:number; footprint?:ActorFootprint; marginM?:number; yielding?:boolean}

/** Full measured standing bounds, in body axes around its feet. */
export interface ActorFootprint {minXM:number;maxXM:number;minZM:number;maxZM:number;yawRad:number}
type Box = {cx:number;cz:number;axes:Array<[number,number]>;half:[number,number];margin:number};
function actorBox(point:ActorPoint,body:ActorBody):Box|null {
  const f=body.footprint;if(!f||![f.minXM,f.maxXM,f.minZM,f.maxZM,f.yawRad].every(Number.isFinite)||f.maxXM<=f.minXM||f.maxZM<=f.minZM)return null;
  const c=Math.cos(f.yawRad),s=Math.sin(f.yawRad),x=(f.minXM+f.maxXM)/2,z=(f.minZM+f.maxZM)/2;
  return {cx:point.xM+x*c+z*s,cz:point.zM-x*s+z*c,axes:[[c,-s],[s,c]],half:[(f.maxXM-f.minXM)/2,(f.maxZM-f.minZM)/2],margin:Math.max(0,body.marginM??0)};
}
function boxExtent(box:Box,x:number,z:number):number {return box.half[0]*Math.abs(box.axes[0][0]*x+box.axes[0][1]*z)+box.half[1]*Math.abs(box.axes[1][0]*x+box.axes[1][1]*z)+box.margin;}
function actorContact(point:ActorPoint,body:ActorBody,other:ActorBody) {
  const a=actorBox(point,body),b=actorBox(other,other);
  if(a&&b){
    let depth=Infinity,nx=0,nz=0;
    for(const [x,z]of [...a.axes,...b.axes]){const d=(a.cx-b.cx)*x+(a.cz-b.cz)*z,r=boxExtent(a,x,z)+boxExtent(b,x,z),overlap=r-Math.abs(d);
      if(overlap<=0)return {depth:0,nx:0,nz:0};
      if(overlap<depth){depth=overlap;nx=x*(Math.sign(d)||1);nz=z*(Math.sign(d)||1);}
    }return {depth,nx,nz};
  }
  const dx=point.xM-other.xM,dz=point.zM-other.zM,d=Math.hypot(dx,dz);
  return {depth:Math.max(0,body.radiusM+other.radiusM-d),nx:d>1e-8?dx/d:1,nz:d>1e-8?dz/d:0};
}
/** Continuous separating-axis sweep. Circles remain the compatibility path
 * when a visible body has not supplied a valid measured box. */
export function sweepActorBoxes(from:ActorPoint,to:ActorPoint,body:ActorBody,other:ActorBody) {
  const a=actorBox(from,body),b=actorBox(other,other);if(!a||!b)return null;
  const dx=to.xM-from.xM,dz=to.zM-from.zM;let entry=-Infinity,leave=Infinity,inside=true,depth=Infinity,nx=0,nz=0,entryNX=0,entryNZ=0;
  for(const [x,z]of [...a.axes,...b.axes]){
    const d=(a.cx-b.cx)*x+(a.cz-b.cz)*z,v=dx*x+dz*z,r=boxExtent(a,x,z)+boxExtent(b,x,z),overlap=r-Math.abs(d);
    if(overlap < -1e-9)inside=false;
    if(overlap<depth){depth=overlap;const sign=Math.sign(d)||(v<0?-1:1);nx=x*sign;nz=z*sign;}
    if(Math.abs(v)<1e-12){if(Math.abs(d)>r+1e-9)return {hit:false,inside:false,entry:Infinity,nx:0,nz:0,entryNX:0,entryNZ:0,depth:0};continue;}
    const t1=(-r-d)/v,t2=(r-d)/v;
    // Ground sliding needs the first entering plane; the existing actor
    // clipper keeps its original fraction and nearest escape normal.
    if(Math.min(t1,t2)>entry){entryNX=-Math.sign(v)*x;entryNZ=-Math.sign(v)*z;}
    entry=Math.max(entry,Math.min(t1,t2));leave=Math.min(leave,Math.max(t1,t2));
  }return {hit:entry<=leave&&leave>=0&&entry<=1,inside,entry,nx,nz,entryNX,entryNZ,depth};
}

export type ActorSpace = Map<string, ActorBody>;

/** Swimming can pass above or below a solid, so its sweep needs height as well
 * as the existing measured horizontal box. Keep the planar walking/turning
 * query unchanged. Open intervals allow contact with a floor while departing;
 * a positive overlap or a thin obstacle crossed between endpoints still hits. */
export function sweepActorVolumes(from:ActorPoint,to:ActorPoint,body:ActorBody,other:ActorBody):{hit:boolean;inside:boolean;entry:number;leave:number}|null {
  if(![from.xM,from.yM,from.zM,to.xM,to.yM,to.zM,body.heightM,body.radiusM,body.marginM??0,other.xM,other.yM,other.zM,other.heightM,other.radiusM,other.marginM??0].every(Number.isFinite)
    ||body.heightM<=0||other.heightM<=0||body.radiusM<=0||other.radiusM<=0||(body.marginM??0)<0||(other.marginM??0)<0)return null;
  const a=actorBox(from,body),b=actorBox(other,other);if(!a||!b)return null;
  let entry=-Infinity,leave=Infinity,inside=true;
  const axes=[...a.axes,...b.axes].map(([x,z])=>({d:(a.cx-b.cx)*x+(a.cz-b.cz)*z,v:(to.xM-from.xM)*x+(to.zM-from.zM)*z,r:boxExtent(a,x,z)+boxExtent(b,x,z)}));
  axes.push({d:from.yM+body.heightM/2-other.yM-other.heightM/2,v:to.yM-from.yM,r:(body.heightM+other.heightM)/2});
  for(const {d,v,r}of axes){
    if(Math.abs(d)>=r-1e-9)inside=false;
    if(Math.abs(v)<1e-12){if(Math.abs(d)>=r-1e-9)return {hit:false,inside:false,entry:Infinity,leave:-Infinity};continue;}
    const t1=(-r-d)/v,t2=(r-d)/v;entry=Math.max(entry,Math.min(t1,t2));leave=Math.min(leave,Math.max(t1,t2));
  }
  return {hit:Math.max(0,entry)<Math.min(1,leave)-1e-9,inside,entry,leave};
}
export type ActorProbe = (point:ActorPoint,from?:ActorPoint,budgetM?:number)=>ActorPoint|null;
/** Small transient search owned by one mounted resident. It never enters saves.
 * A blocked person may need several sideways steps before comfort improves.
 * Work is spread across frames, and every followed step rechecks real geometry
 * and current bodies. The tactical tile pathfinder cannot represent these
 * measured body bounds or source-floor queries. */
interface YieldRouteNode {point:ActorPoint;path:ActorPoint[]}
export interface ActorYieldRouteState {
 signature?:string;expected?:ActorPoint;path?:ActorPoint[];following?:boolean;floorYM?:number;
 search?:{origin:ActorPoint;queue:YieldRouteNode[];head:number;expanded:number;seen:Set<string>};
 exhausted?:boolean;retryFrames?:number;
}
function prepareYieldRoute(state:ActorYieldRouteState,from:ActorPoint,goal:ActorPoint,key:string,body:ActorBody,space:ActorSpace) {
 const n=(v:number)=>Math.round(v*1000),f=body.footprint;
 const signature=JSON.stringify([key,n(goal.xM),n(goal.yM),n(goal.zM),n(body.radiusM),n(body.heightM),f&&[n(f.minXM),n(f.maxXM),n(f.minZM),n(f.maxZM),n(f.yawRad)],
  [...space].filter(([id])=>id==='player'||id.startsWith('companion:')).map(([id,b])=>[id,Math.round(b.xM*10),Math.round(b.yM*10),Math.round(b.zM*10)])]);
 state.following=false;
 if(state.signature!==signature||(state.expected&&Math.hypot(from.xM-state.expected.xM,from.zM-state.expected.zM,from.yM-state.expected.yM)>.005)){
  state.signature=signature;state.expected={...from};state.floorYM=from.yM;state.path=undefined;state.search=undefined;state.exhausted=false;state.retryFrames=0;
 }
}
function followYieldRoute(from:ActorPoint,key:string,body:ActorBody,hardSpace:ActorSpace,step:number,probe:ActorProbe,state:ActorYieldRouteState) {
 while(state.path?.length&&Math.hypot(state.path[0].xM-from.xM,state.path[0].zM-from.zM)<.004)state.path.shift();
 const target=state.path?.[0];if(!target)return null;
 const d=Math.hypot(target.xM-from.xM,target.zM-from.zM),share=Math.min(1,step/d);
 const candidate=probe({xM:from.xM+(target.xM-from.xM)*share,zM:from.zM+(target.zM-from.zM)*share,yM:from.yM},from,step);
 if(!candidate||Math.abs(candidate.yM-(state.floorYM??from.yM))>.08){state.path=undefined;state.search=undefined;return {...from,blocked:true};}
 let reached=clipActorStep(from,candidate,key,body,hardSpace);
 const supported=probe(reached,from,step);
 if(!supported||Math.abs(supported.yM-(state.floorYM??from.yM))>.08){state.path=undefined;state.search=undefined;return {...from,blocked:true};}
 reached=clipActorStep(from,supported,key,body,hardSpace);
 if(reached.blocked||Math.hypot(reached.xM-from.xM,reached.zM-from.zM)<1e-5){state.path=undefined;state.search=undefined;}
 state.expected={xM:reached.xM,yM:reached.yM,zM:reached.zM};state.following=Math.hypot(reached.xM-from.xM,reached.zM-from.zM)>1e-5;
 return reached;
}
function searchYieldRoute(from:ActorPoint,key:string,body:ActorBody,space:ActorSpace,hardSpace:ActorSpace,step:number,probe:ActorProbe,state:ActorYieldRouteState) {
 const protectedSpace=new Map([...space].filter(([id])=>id==='player'||id.startsWith('companion:')));
 if(!actorSpaceOverlaps(from,key,body,protectedSpace))return {...from,blocked:true};
 if(state.exhausted){if((state.retryFrames??0)>0){state.retryFrames=(state.retryFrames??0)-1;return {...from,blocked:true};}state.exhausted=false;state.search=undefined;}
 const search=state.search??={origin:{...from},queue:[{point:{...from},path:[]}],head:0,expanded:0,seen:new Set(['0:0'])};
 // Keep the original floor anchor: several tiny rises must not accumulate
 // into an unscheduled climb to another level.
 // Two nodes per call, eight directions per node, at most128 nodes and twelve
 // short steps overall. A failed local search waits; it does not hide a body,
 // cross a wall, lower the standing figure, or declare the whole room impossible.
 for(let work=0;work<2&&search.head<search.queue.length&&search.expanded<128;work++){
  const node=search.queue[search.head++];search.expanded++;
  if(node.path.length&&!actorSpaceOverlaps(node.point,key,body,protectedSpace)){
   state.path=node.path;state.search=undefined;return followYieldRoute(from,key,body,hardSpace,step,probe,state)??{...from,blocked:true};
  }
  if(node.path.length>=12)continue;
  for(let i=0;i<8;i++){
   const angle=i*Math.PI/4,q={xM:node.point.xM+.12*Math.cos(angle),zM:node.point.zM+.12*Math.sin(angle),yM:node.point.yM};
   const geometry=probe(q,node.point,.12);if(!geometry||Math.abs(geometry.yM-node.point.yM)>.08||Math.abs(geometry.yM-search.origin.yM)>.08)continue;
   const clipped=clipActorStep(node.point,geometry,key,body,hardSpace),supported=probe(clipped,node.point,.12);
   if(!supported||Math.abs(supported.yM-node.point.yM)>.08||Math.abs(supported.yM-search.origin.yM)>.08)continue;
   const reached=clipActorStep(node.point,supported,key,body,hardSpace);
   if(Math.hypot(reached.xM-node.point.xM,reached.zM-node.point.zM)<.004)continue;
   const id=Math.round((reached.xM-search.origin.xM)/.04)+':'+Math.round((reached.zM-search.origin.zM)/.04);
   if(search.seen.has(id))continue;search.seen.add(id);
   search.queue.push({point:{xM:reached.xM,yM:reached.yM,zM:reached.zM},path:[...node.path,{xM:reached.xM,yM:reached.yM,zM:reached.zM}]});
  }
 }
 if(search.head>=search.queue.length||search.expanded>=128){state.search=undefined;state.exhausted=true;state.retryFrames=60;}
 return {...from,blocked:true};
}


/** Give the player room and let a yielding neighbor ask for a small sidestep.
 * These comfort margins never replace the physical bodies used for collision.
 * A resident settled at their activity sends no pressure through the room. */
export function actorCourtesySpace(space:ActorSpace):ActorSpace {
  return new Map([...space].map(([key,body])=>{
    const margin=(key==='player'||key.startsWith('companion:')) ? .2 : body.yielding ? .1 : 0;
    return [key,margin?{...body,radiusM:body.radiusM+margin,marginM:(body.marginM??0)+margin}:body];
  }));
}

function sharesHeight(a:ActorPoint,height:number,b:ActorBody,toleranceM=.08):boolean {
  return Math.min(a.yM+height,b.yM+b.heightM)-Math.max(a.yM,b.yM)>toleranceM;
}
/** Sweep the whole segment, rather than checking only its destination. A body
 * already overlapping after load may walk out, but cannot cross through the
 * other person's center. Idle never relocates accepted player feet. */
export function clipActorStep(from:ActorPoint,to:ActorPoint,key:string,body:ActorBody,space:ActorSpace) {
  const dx=to.xM-from.xM,dz=to.zM-from.zM,a=dx*dx+dz*dz;
  if(a<1e-12)return {...to,blocked:false};
  let fraction=1;
  for(const [id,other] of space){
    if(id===key||!sharesHeight(from,body.heightM,other))continue;
    const boxSweep=sweepActorBoxes(from,to,body,other);
    if(boxSweep){
      if(boxSweep.inside){if(dx*boxSweep.nx+dz*boxSweep.nz < -1e-9)fraction=0;continue;}
      if(boxSweep.hit&&boxSweep.entry>=0)fraction=Math.min(fraction,Math.max(0,boxSweep.entry-.001/Math.sqrt(a)));
      continue;
    }
    const x=from.xM-other.xM,z=from.zM-other.zM,r=body.radiusM+other.radiusM;
    const c=x*x+z*z-r*r,dot=x*dx+z*dz;
    if(c<=1e-9){
      if(dot < -1e-9)fraction=0;
      continue;
    }
    const disc=dot*dot-a*c;
    if(disc<=0)continue;
    const entry=(-dot-Math.sqrt(disc))/a;
    if(entry>=0&&entry<=1)fraction=Math.min(fraction,Math.max(0,entry-.001/Math.sqrt(a)));
  }
  return {xM:from.xM+dx*fraction,zM:from.zM+dz*fraction,yM:from.yM+(to.yM-from.yM)*fraction,blocked:fraction<1};
}
function overlapScore(point:ActorPoint,key:string,body:ActorBody,space:ActorSpace):number {
  let score=0;
  for(const [id,other] of space)if(id!==key&&sharesHeight(point,body.heightM,other)){
    const {depth}=actorContact(point,body,other);
    score+=depth*depth;
  }
  return score;
}
/** Take one small, geometry-approved yield step. No valid escape means wait,
 * never push the player, hide a resident or jump a wall/storey. Once clear,
 * the same resolver walks the resident back toward the scheduled activity. */
export function yieldActorStep(from:ActorPoint,goal:ActorPoint,key:string,body:ActorBody,space:ActorSpace,budget:number,probe:ActorProbe,hardSpace:ActorSpace=space,routeState?:ActorYieldRouteState) {
  const step=Math.max(0,Math.min(.12,budget));
  if(!step)return {...from,blocked:false};
  if(routeState){prepareYieldRoute(routeState,from,goal,key,body,space);const routed=followYieldRoute(from,key,body,hardSpace,step,probe,routeState);if(routed)return routed;}
  const score=overlapScore(from,key,body,space);
  if(score<1e-8){
    const dx=goal.xM-from.xM,dz=goal.zM-from.zM,d=Math.hypot(dx,dz);
    if(d<1e-5)return {...from,blocked:false};
    const t=Math.min(1,step/d),candidate=probe({xM:from.xM+dx*t,zM:from.zM+dz*t,yM:from.yM});
    if(!candidate||Math.abs(candidate.yM-from.yM)>.08)return {...from,blocked:true};
    const clipped=clipActorStep(from,candidate,key,body,space);
    if(!clipped.blocked)return clipped;
    const supported=probe(clipped);
    return supported&&Math.abs(supported.yM-from.yM)<=.08?{...supported,blocked:true}:{...from,blocked:true};
  }
  const directions:Array<[number,number]>=[];
  for(const [id,other] of space)if(id!==key&&sharesHeight(from,body.heightM,other)){
    const contact=actorContact(from,body,other);
    if(contact.depth>1e-8)directions.push([contact.nx,contact.nz]);
  }
  for(let i=0;i<8;i++)directions.push([Math.cos(i*Math.PI/4),Math.sin(i*Math.PI/4)]);
  // Relax an already crowded resident cluster without creating a new contact.
  // Accepted player/companion footprints remain protected even during recovery.
  const barriers:ActorSpace=new Map();
  for(const [id,other]of space){
    if(id==='player'||id.startsWith('companion:'))barriers.set(id,other);
    else {
      const physical=hardSpace.get(id)??other;
      // A neighbor may share comfort space while their body is still clear.
      // Keep that real body protected; soft overlap is never permission to
      // walk through them while asking them to make room.
      if(actorContact(from,body,physical).depth<=1e-8)barriers.set(id,physical);
    }
  }
  // An immovable player's reserved space takes priority over an already
  // overlapping resident cluster. Equal total scoring can otherwise settle
  // between larger neighbors while still intersecting the player. Existing
  // clear neighbors stay in barriers; no new intersection is admitted.
  const protectedSpace=new Map([...space].filter(([id])=>id==='player'||id.startsWith('companion:')));
  let best:ActorPoint|null=null,bestScore=score,bestProtected=overlapScore(from,key,body,protectedSpace);
  for(const [x,z] of directions){
    let candidate=probe({xM:from.xM+x*step,zM:from.zM+z*step,yM:from.yM});
    if(!candidate||Math.abs(candidate.yM-from.yM)>.08)continue;
    const clipped=clipActorStep(from,candidate,key,body,barriers);
    if(clipped.blocked)candidate=probe(clipped);
    if(!candidate||Math.abs(candidate.yM-from.yM)>.08)continue;
    const nextScore=overlapScore(candidate,key,body,space);
    const nextProtected=overlapScore(candidate,key,body,protectedSpace);
    if(nextProtected<bestProtected-1e-8||(Math.abs(nextProtected-bestProtected)<=1e-8&&nextScore<bestScore-1e-8)){
      bestProtected=nextProtected;bestScore=nextScore;best=candidate;
    }
  }
  return best?{...best,blocked:false}:routeState?searchYieldRoute(from,key,body,space,hardSpace,step,probe,routeState):{...from,blocked:true};
}

/** A stationary source point may already be occupied when its body mounts. */
export function actorSpaceOverlaps(point:ActorPoint,key:string,body:ActorBody,space:ActorSpace):boolean {return overlapScore(point,key,body,space)>1e-8;}

/** Preserve the old facing when a turn would swing measured anatomy or gear
 * into somebody. Sampled poses receive a conservative arc allowance covering
 * the corners between samples; holding facing lets a close figure sidestep. */
export function canActorTurn(point:ActorPoint,key:string,body:ActorBody,yawRad:number,space:ActorSpace,heightToleranceM=.08):boolean {
  if(!Number.isFinite(yawRad)||!Number.isFinite(heightToleranceM)||heightToleranceM<0)return false;
  if(!body.footprint||!actorBox(point,body))return true;
  let turn=yawRad-body.footprint.yawRad;while(turn>Math.PI)turn-=Math.PI*2;while(turn < -Math.PI)turn+=Math.PI*2;
  if(Math.abs(turn)<1e-8)return true;
  const f=body.footprint,turnRadius=Math.max(body.radiusM,Math.hypot(Math.max(Math.abs(f.minXM),Math.abs(f.maxXM)),Math.max(Math.abs(f.minZM),Math.abs(f.maxZM))));
  const steps=Math.max(1,Math.ceil(Math.abs(turn)/(Math.PI/16))),arc=2*turnRadius*Math.sin(Math.abs(turn)/steps/4);
  for(const [id,other]of space){
    if(id===key||!sharesHeight(point,body.heightM,other,heightToleranceM))continue;
    const before=actorContact(point,body,other).depth;
    for(let i=0;i<=steps;i++){
      const posed={...body,marginM:(body.marginM??0)+arc,footprint:{...body.footprint,yawRad:body.footprint.yawRad+turn*i/steps}};
      if(actorContact(point,posed,other).depth>before+1e-8)return false;
    }
  }return true;
}
