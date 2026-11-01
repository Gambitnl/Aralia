/**
 * Keeps the waterfall inlet's real width and birth interval up to first contact.
 * Each strip goes to the first finite rock face it actually reaches. Gaps stay
 * airborne; a later shelf cannot steal water from an earlier surface. Contact
 * remains a line on the rock, never a guessed patch with a chosen water depth.
 *
 * This supplies the boundary solver's incoming material. It does not turn the
 * water, advance a Film, or debit a live source. The current source has collapsed
 * vertical thickness (a midsurface), so this is not finite-depth impact physics.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/10/2026, 19:07:20
 * Dependents: systems/world3d/river/waterfallTerrainComparisons.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {waterfallDownwardRoot,type ContactSurface,type ContactVec3,type SheetRelease} from './waterfallContactFlow';
import {WaterfallSourceSupport,addSourceSupportMoments,emptySourceSupportMoments,type SourceSupportMoments,type SourceSupportArrival} from './waterfallSourceSupport';

const g=9.81,rho=1000;
const terminalId='source-terminal-pool';
interface Plane {surface:ContactSurface;sx:number;sz:number;b:number}
export interface SourceContactPiece {
  z0:number;z1:number;volume:number;surfaceId:string|null;
  /** Actual first-impact curve endpoints. Null means no rock under this strip. */
  contactEnds:[ContactVec3,ContactVec3]|null;
  firstArrival:number|null;lastArrival:number|null;
  boundaryRoundoff:number;
  target:'rock'|'terminal-pool'|'unbounded-flight';
}
export interface SourceContactArrival extends SourceSupportArrival {
  surfaceId:string;z0:number;z1:number;cell:number|null;normal:ContactVec3;
  /** m2/s per original transverse width. Divide by each point's strikeJacobian
   * for volume flux per meter of the actual curved contact line. */
  volumeFluxPerSourceWidth:number;
  target:'rock'|'terminal-pool';
}
export interface SourceContactInterval {
  start:number;end:number;arrivals:SourceContactArrival[];moments:SourceSupportMoments;
  qualification:'MIDSURFACE_FIRST_CONTACT_ONLY';
}
interface Piece {z0:number;z1:number;volume:number;model:WaterfallSourceSupport|null}
function roots(a:number,b:number,c:number):number[] {
  if(![a,b,c].every(Number.isFinite))throw Error('source-contact-root-range');
  if(a===0)return b===0?[]:[-c/b];
  const d=b*b-4*a*c;if(!Number.isFinite(d))throw Error('source-contact-root-range');
  if(d<0)return[];
  const q=-.5*(b+(b<0?-1:1)*Math.sqrt(d));
  return q===0?[0]:[q/a,c/q];
}
function plane(surface:ContactSurface):Plane {
  if(surface.vertices.length!==4||surface.vertices.some(p=>p.length!==3||!p.every(Number.isFinite))
    ||surface.normal.length!==3||!surface.normal.every(Number.isFinite)||!(surface.normal[1]>0)
    ||Math.abs(Math.hypot(...surface.normal)-1)>1e-12)throw Error('source-contact-surface');
  const [a,b,c,d]=surface.vertices,n=surface.normal,sx=-n[0]/n[1],sz=-n[2]/n[1],intercept=a[1]-sx*a[0]-sz*a[2];
  if(!(b[0]>a[0]&&d[2]>a[2])||a[2]!==b[2]||b[0]!==c[0]||c[2]!==d[2]||d[0]!==a[0]
    ||surface.vertices.some(p=>Math.abs(p[1]-intercept-sx*p[0]-sz*p[2])>1e-10))throw Error('source-contact-rectangle');
  return {surface:structuredClone(surface),sx,sz,b:intercept};
}

export class WaterfallSourceContact {
  private readonly release:SheetRelease;
  private readonly pieces:Piece[]=[];
  private readonly planes:Plane[];
  readonly originalVolume:number;
  constructor(release:SheetRelease,volume:number,surfaces:readonly ContactSurface[],terminalHeight?:number) {
    this.release=structuredClone(release);this.originalVolume=volume;
    const r=this.release;
    if(![...r.start,...r.end,...r.velocity,r.intervalStart,r.intervalEnd,volume].every(Number.isFinite)
      ||!(volume>0&&r.end[2]>r.start[2]&&r.intervalEnd>r.intervalStart&&r.velocity[0]>0)
      ||r.start[0]!==0||r.end[0]!==0||r.start[1]!==r.end[1]||r.velocity[1]!==0||r.velocity[2]!==0)throw Error('source-contact-release');
    if(surfaces.length>128||new Set(surfaces.map(s=>s.id)).size!==surfaces.length||surfaces.some(s=>s.id===terminalId))throw Error('source-contact-surface-capacity');
    this.planes=surfaces.map(plane);
    if(terminalHeight!==undefined){
      if(!Number.isFinite(terminalHeight)||!(terminalHeight<r.start[1]))throw Error('source-contact-terminal-height');
      const age=waterfallDownwardRoot(r.start[1]-terminalHeight,0,-g)!,x=r.velocity[0]*age;
      // Match the comparison's existing collecting plane. Its only relevant
      // footprint here is this source strip's ballistic intersection; no basin
      // shape, storage or submerged pressure is inferred from this outlet.
      this.planes.push(plane({id:terminalId,vertices:[[0,terminalHeight,r.start[2]],[x,terminalHeight,r.start[2]],[x,terminalHeight,r.end[2]],[0,terminalHeight,r.end[2]]],normal:[0,1,0]}));
    }
    const [z0,z1]=[r.start[2],r.end[2]],y=r.start[1],v=r.velocity[0],cuts=[z0,z1];
    const cut=(z:number)=>{if(!Number.isFinite(z))throw Error('source-contact-cut-range');if(z>z0&&z<z1)cuts.push(z);};
    for(const p of this.planes){
      const [a,b,,d]=p.surface.vertices;cut(a[2]);cut(d[2]);
      // A candidate can enter/leave a finite rock rectangle only through its
      // span edge or where the ballistic strike crosses its upstream/downstream edge.
      if(p.sz!==0){for(const x of [a[0],b[0]])if(x>=0)cut((y-p.b-p.sx*x-.5*g*(x/v)**2)/p.sz);cut((y-p.b)/p.sz);}
    }
    // Overlapping tops can exchange which is first inside a span. Split at
    // actual trajectory/plane-intersection roots, not at sampled grid points.
    for(let i=0;i<this.planes.length;i++)for(let j=i+1;j<this.planes.length;j++){
      const a=this.planes[i],b=this.planes[j],dz=a.sz-b.sz,dx=a.sx-b.sx,db=a.b-b.b;
      if(dz===0)continue; // Parallel span slopes cannot swap except at a fixed age; handled below.
      const aa=-.5*g,bb=-a.sx*v+a.sz*dx*v/dz,cc=y-a.b+a.sz*db/dz;
      for(const age of roots(aa,bb,cc))if(age>=0)cut(-(dx*v*age+db)/dz);
    }
    // Equal cross slopes can still intersect along a constant-x line. At that
    // age the flight height selects one span coordinate on either plane.
    for(let i=0;i<this.planes.length;i++)for(let j=i+1;j<this.planes.length;j++){
      const a=this.planes[i],b=this.planes[j];if(a.sz!==b.sz||a.sx===b.sx||a.sz===0)continue;
      const x=-(a.b-b.b)/(a.sx-b.sx);if(x>=0)cut((y-a.b-a.sx*x-.5*g*(x/v)**2)/a.sz);
    }
    const sorted=[...new Set(cuts)].sort((a,b)=>a-b);
    if(sorted.length>4097)throw Error('source-contact-piece-capacity');
    for(let i=1;i<sorted.length;i++){
      const lo=sorted[i-1],hi=sorted[i],mid=lo+(hi-lo)*.5;
      if(mid===lo||mid===hi)throw Error('source-contact-unresolved-span');
      const hit=this.first(mid),partVolume=volume*((hi-lo)/(z1-z0));
      const part={...r,start:[0,y,lo] as ContactVec3,end:[0,y,hi] as ContactVec3};
      this.pieces.push({z0:lo,z1:hi,volume:partVolume,model:hit?new WaterfallSourceSupport(part,partVolume,hit.surface,true):null});
    }
    const total=this.pieces.reduce((s,p)=>s+p.volume,0);
    if(Math.abs(total-volume)>1e-12*volume)throw Error('source-contact-partition-volume');
  }
  private first(z:number):Plane|null {
    const r=this.release;let result:Plane|null=null,first=Infinity;
    for(const p of this.planes){
      const [a,b,,d]=p.surface.vertices;if(z<a[2]||z>d[2])continue;
      const distance=r.start[1]-p.b-p.sz*z;
      if(distance<0){
        const later=roots(-.5*g,-p.sx*r.velocity[0],distance).filter(t=>t>0&&-p.sx*r.velocity[0]-g*t<0&&r.velocity[0]*t>=a[0]&&r.velocity[0]*t<=b[0]);
        if(later.length)throw Error('source-contact-below-extended-plane');
      }
      const age=waterfallDownwardRoot(distance,-p.sx*r.velocity[0],-g);
      if(age===null)continue;const x=r.velocity[0]*age;
      if(x<a[0]||x>b[0]||age>=first)continue;
      if(!(age>0))throw Error('source-contact-born-in-rock');
      first=age;result=p;
    }
    return result;
  }
  snapshot():SourceContactPiece[]{return this.pieces.map(p=>({z0:p.z0,z1:p.z1,volume:p.volume,surfaceId:p.model?.surface.id??null,
    contactEnds:p.model?[p.model.positionAt(p.model.ageAt(p.z0),p.z0),p.model.positionAt(p.model.ageAt(p.z1),p.z1)]:null,
    firstArrival:p.model?.firstArrival??null,lastArrival:p.model?.lastArrival??null,boundaryRoundoff:p.model?.boundaryRoundoff??0,
    target:!p.model?'unbounded-flight':p.model.surface.id===terminalId?'terminal-pool':'rock'}));}
  /** Pure query: a receiver may reject it without losing any supplying water.
   * Optional cell cuts use the Film's regular X/Z partition. They subdivide a
   * curved line source; they do not spread it over any receiving cell's area. */
  arrivals(start:number,end:number,grid?:{nx:number;nz:number}):SourceContactInterval {
    if(![start,end].every(Number.isFinite)||end<start)throw Error('source-contact-time');
    if(grid&&(![grid.nx,grid.nz].every(n=>Number.isSafeInteger(n)&&n>0)||grid.nx*grid.nz>4096))throw Error('source-contact-grid');
    const arrivals:SourceContactArrival[]=[],moments=emptySourceSupportMoments();
    for(const p of this.pieces){
      const m=p.model;if(!m)continue;
      const [a,b,,d]=m.surface.vertices,cuts=[p.z0,p.z1];
      const receiverGrid=m.surface.id===terminalId?undefined:grid;
      if(receiverGrid){
        for(let j=1;j<receiverGrid.nz;j++){const z=a[2]+(d[2]-a[2])*j/receiverGrid.nz;if(z>p.z0&&z<p.z1)cuts.push(z);}
        if(m.crossSlope!==0)for(let i=1;i<receiverGrid.nx;i++){
          const x=a[0]+(b[0]-a[0])*i/receiverGrid.nx;if(x<0)continue;
          const z=(m.y0-m.intercept-m.forwardSlope*x-.5*g*(x/m.speed)**2)/m.crossSlope;
          if(z>p.z0&&z<p.z1)cuts.push(z);
        }
      }
      const sorted=[...new Set(cuts)].sort((x,y)=>x-y);
      for(let k=1;k<sorted.length;k++){
        const z0=sorted[k-1],z1=sorted[k],z=z0+(z1-z0)*.5;
        const hit=m.arrivals(start,end,z0,z1,5);if(hit.moments.volume===0)continue;
        const x=m.speed*m.ageAt(z);
        // A contact exactly on a shared mesh edge belongs to the positive-side
        // cell (outermost edges to the last cell); its measure is not duplicated.
        const cell=receiverGrid?Math.min(receiverGrid.nz-1,Math.floor((z-a[2])/(d[2]-a[2])*receiverGrid.nz))*receiverGrid.nx
          +Math.max(0,Math.min(receiverGrid.nx-1,Math.floor((x-a[0])/(b[0]-a[0])*receiverGrid.nx))):null;
        if(cell!==null&&cell<0)throw Error('source-contact-cell-outside');
        arrivals.push({...hit,surfaceId:m.surface.id,z0,z1,cell,normal:[...m.surface.normal],volumeFluxPerSourceWidth:m.beta,target:m.surface.id===terminalId?'terminal-pool':'rock'});addSourceSupportMoments(moments,hit.moments);
      }
    }
    return {start,end,arrivals,moments,qualification:'MIDSURFACE_FIRST_CONTACT_ONLY'};
  }
  /** Born material not yet touching rock. Uncaught spans remain ballistic;
   * they are never silently assigned to the first available shelf. */
  remaining(time:number):SourceSupportMoments {
    if(!Number.isFinite(time))throw Error('source-contact-time');
    const result=emptySourceSupportMoments(),r=this.release;
    for(const p of this.pieces){
      if(p.model){addSourceSupportMoments(result,p.model.remaining(time));continue;}
      const end=Math.min(time,r.intervalEnd);if(end<=r.intervalStart)continue;
      const dt=end-r.intervalStart,age=time-(r.intervalStart+dt*.5),age2=age*age+dt*dt/12;
      const volume=p.volume*dt/(r.intervalEnd-r.intervalStart),v=r.velocity[0];
      addSourceSupportMoments(result,{volume,momentum:[rho*volume*v,-rho*volume*g*age,0],positionMoment:[volume*v*age,volume*(r.start[1]-.5*g*age2),volume*(p.z0+p.z1)*.5],
        kinetic:.5*rho*volume*(v*v+g*g*age2),potential:rho*g*volume*(r.start[1]-.5*g*age2),arrivalTimeMoment:0});
    }
    return result;
  }
}
