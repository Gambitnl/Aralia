/**
 * This isolated experiment calculates water depth and motion as water leaves a cliff.
 * It is not yet connected to the native river renderer.
 * Bounded dense crest RESPONSE experiment, in meters, seconds and kilograms.
 * Material particles retain their volume/history; quadratic APIC transfers
 * carry inertia to a MAC grid. A liquid-only pressure projection replaces the
 * terrain scaffold's tuned compressible Tait stress. Air has atmospheric p=0.
 * The floor/side walls stop at the lip, rather than pulling water onto a path.
 * The optional parcel-volume surface is corrected for geometric solid support;
 * its .5 contour still yields a first-order voxel pressure boundary. RT0 flow
 * is first order in space and separates trajectories from APIC momentum.
 * There is no air, thin-sheet or
 * impact coupling. Neither residuals nor this state validate its appearance.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 06/10/2026, 07:40:00
 * Dependents: systems/world3d/river/waterfallCrestJetReceiver.ts, systems/world3d/river/waterfallLiveFlow.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export type CrestVec3=[number,number,number];
export interface CrestSource {q:number;width:number;depth:number;speed?:number;id?:string}
export interface CrestLiquidOptions {
  crest?:number;cellSize?:number;cells?:CrestVec3;origin?:CrestVec3;dt?:number;
  lipX?:number;inletX?:number;channelDepth?:number;channelWidth?:number;
  outletX?:number;outletY?:number;maximumParticles?:number;maxIterations?:number;tolerance?:number;
  /** Optional physical downstream wall for independent closed-tank controls. */
  solidEndX?:number;
  /** Sampling resolution, independent of the physical pressure grid. */
  particlesPerCellAxis?:number;
  /** Opt-in compatible transfer and numerical divergence-free support extension. */
  transport?:'quadratic'|'divergence-conforming'|'flux-cell';
  pressureSurface?:'markers'|'volume-kernel';
  /** Opt-in reduced freefall phase after downstream material loses pressure support. */
  releaseSupportDepleted?:boolean;
  /** Opt-in unresolved near-bed material retains a separate kinetic/contact phase. */
  bedResidue?:boolean;
  /** Physical quadratic surface support in meters; independent of PPC. */
  surfaceSupport?:number;
}
export interface CrestParticle {id:number;sourceId:string;birth:number;volume:number;position:CrestVec3;velocity:CrestVec3}
interface MaterialParticle extends CrestParticle {affine:Float64Array}
/** The crossing position precedes the end of its already-applied force kick.
 * A receiver finishes drift only until kickEndTime, then joins the next kick.
 * Momentum must not be rewound or receive the remaining kick a second time.
 */
export interface CrestExit extends CrestParticle {
  time:number;boundary:'downstream'|'bottom'|'side'|'upstream'|'support-depleted';
  releaseReason?:'domain-exit'|'support-depleted'|'bed-departure';
  phase:'post-kick-drift';kickStartTime:number;kickEndTime:number;remainingDriftTime:number;
  /** Frozen inward transport derivative, row-major 1/s; not APIC momentum affine. */
  transportGradient?:number[];gradientDefinition?:'frozen-exit-transport';
}
export interface CrestReceipt {
  bedResidueParticles:number;bedResidueVolume:number;bedResidueMomentum:CrestVec3;bedResidueAdmissions:number;bedResidueRejoins:number;
  time:number;initialVolume:number;emittedVolume:number;residentVolume:number;exitedVolume:number;budgetError:number;
  initialMomentum:CrestVec3;sourceMomentum:CrestVec3;residentMomentum:CrestVec3;exitedMomentum:CrestVec3;
  gravityImpulse:CrestVec3;gridBoundaryImpulse:CrestVec3;pressureImpulse:CrestVec3;collisionImpulse:CrestVec3;
  transferMomentumError:CrestVec3;momentumBudgetError:CrestVec3;
  pressureExtensionImpulse:CrestVec3;
  particles:number;exits:number;exitPacketsPending:number;fluidCells:number;maximumVolumeFraction:number;markedCellVolume:number;
  maximumDivergence:number;relativeResidual:number;iterations:number;maximumCourant:number;
  sourceEdits:number;lastStepMilliseconds:number;failure:string|null;
  occupancyTime:number;particlesPerCellAxis:number;
  transport:'quadratic'|'divergence-conforming'|'flux-cell';maximumInterpolatedDivergence:number;
  pressureSurface:'markers'|'volume-kernel';surfaceSupport:number;surfaceThreshold:number;
  depositedVolume:number;depositedNonSolidVolume:number;correctedDensityVolume:number;surfaceOccupiedVolume:number;
  inletPressureArea:number;inletPressureFlux:number;
  transportAngularDefect:CrestVec3;solenoidalExtensionImpulse:CrestVec3;extensionResidual:number;extensionIterations:number;extensionCells:number;
}
export interface CrestSnapshot {bedResidue:(CrestParticle&{phase:'bed-residue-kinetic'})[];particles:CrestParticle[];exits:CrestExit[];volumeFraction:Float64Array;surfaceDensity:Float64Array;depositedDensity:Float64Array;pressure:Float64Array;u:Float64Array;v:Float64Array;w:Float64Array;receipt:CrestReceipt;origin:CrestVec3;cells:CrestVec3;cellSize:number}
const rho=1000,g=9.81;
const vec=():CrestVec3=>[0,0,0];
const addInto=(a:CrestVec3,b:CrestVec3)=>{for(let c=0;c<3;c++)a[c]+=b[c];};
const dot=(a:Float64Array,b:Float64Array)=>{let s=0;for(let i=0;i<a.length;i++)s+=a[i]*b[i];return s;};
const basis=(r:number)=>{const x=Math.abs(r);return x<.5?.75-x*x:x<1.5?.5*(1.5-x)**2:0;};
const kernelCDF=(r:number)=>{const x=Math.abs(r),integral=x<.5?.75*x-x**3/3:x<1.5?.5-(1.5-x)**3/6:.5;return .5+Math.sign(r)*integral;};
const cubic=(r:number)=>{const a=Math.abs(r);return a<1?(4-6*a*a+3*a*a*a)/6:a<2?(2-a)**3/6:0;};
const derivative=(r:number)=>Math.abs(r)<.5?-2*r:Math.abs(r)<1.5?-Math.sign(r)*(1.5-Math.abs(r)):0;
const cubicDerivative=(r:number)=>{const a=Math.abs(r);return a<1?Math.sign(r)*(-12*a+9*a*a)/6:a<2?-Math.sign(r)*(2-a)**2/2:0;};
const radicalInverse=(index:number,base:number)=>{let value=0,fraction=1/base;while(index>0){value+=(index%base)*fraction;index=Math.floor(index/base);fraction/=base;}return value;};

export class WaterfallCrestLiquid {
  readonly origin:CrestVec3;readonly cells:CrestVec3;readonly cellSize:number;readonly dt:number;readonly crest:number;
  readonly lipX:number;readonly inletX:number;readonly channelDepth:number;readonly channelWidth:number;
  private readonly outletX:number;private readonly outletY:number;private readonly maximumParticles:number;
  private readonly bedResidueEnabled:boolean;private residue:MaterialParticle[]=[];private residueAdmissions=0;private residueRejoins=0;
  private readonly releaseSupportDepleted:boolean;private readonly maxIterations:number;private readonly tolerance:number;
  readonly pressureSurface:'markers'|'volume-kernel';readonly surfaceSupport:number;
  readonly transport:'quadratic'|'divergence-conforming'|'flux-cell';readonly particlesPerCellAxis:number;private readonly solidEndX:number|undefined;
  private readonly dims:CrestVec3[];private readonly offsets:number[];private readonly field:Float64Array;
  private readonly faceMass:Float64Array;private readonly faceMomentum:Float64Array;private readonly fixed:Uint8Array;
  private readonly projectionMass:Float64Array;
  private readonly surfaceDensity:Float64Array;private readonly depositedDensity:Float64Array;private readonly geometryFraction:Float64Array;
  private readonly fractions:Float64Array;private readonly pressure:Float64Array;private readonly fluid:Int32Array;
  private readonly solid:Uint8Array;private readonly faces:number[][];
  private particles:MaterialParticle[]=[];private exits:CrestExit[]=[];
  private exitCount=0;
  private events:{time:number;source:CrestSource;id:string}[]=[];private nextId=1;private sourceSerial=0;
  private tick=0;private sampleCursor=0;private initialVolume=0;private emittedVolume=0;private exitedVolume=0;
  private initialMomentum=vec();private sourceMomentum=vec();private exitedMomentum=vec();
  private gravityImpulse=vec();private boundaryImpulse=vec();private pressureImpulse=vec();private collisionImpulse=vec();private transferError=vec();
  private extensionImpulse=vec();private solenoidalImpulse=vec();private angularDefect=vec();
  private failure:string|null=null;private last={fluidCells:0,maxFraction:0,divergence:0,residual:0,iterations:0,courant:0,ms:0,interpolatedDivergence:0,extensionResidual:0,extensionIterations:0,extensionCells:0,inletArea:0,inletFlux:0};
  constructor(o:CrestLiquidOptions={}) {
    this.crest=o.crest??70;this.cellSize=o.cellSize??.1;this.dt=o.dt??.0025;
    this.origin=[...(o.origin??[-1.2,this.crest-3,-.8])];this.cells=[...(o.cells??[40,40,16])];
    this.lipX=o.lipX??0;this.inletX=o.inletX??-.8;this.channelDepth=o.channelDepth??.7;this.channelWidth=o.channelWidth??1;
    this.outletX=o.outletX??2.4;this.outletY=o.outletY??this.crest-2.5;this.maximumParticles=o.maximumParticles??20000;
    this.maxIterations=o.maxIterations??400;this.tolerance=o.tolerance??1e-8;
    this.releaseSupportDepleted=o.releaseSupportDepleted??false;this.bedResidueEnabled=o.bedResidue??false;
    this.pressureSurface=o.pressureSurface??'markers';this.surfaceSupport=o.surfaceSupport??this.cellSize;
    if((this.pressureSurface!=='markers'&&this.pressureSurface!=='volume-kernel')||!Number.isFinite(this.surfaceSupport)||this.surfaceSupport<this.cellSize-1e-12||this.surfaceSupport>4*this.cellSize+1e-12)throw Error('Unsupported crest pressure surface support');
    this.transport=o.transport??'quadratic';if(this.transport!=='quadratic'&&this.transport!=='divergence-conforming'&&this.transport!=='flux-cell')throw Error('Unsupported crest transport');
    this.particlesPerCellAxis=o.particlesPerCellAxis??2;this.solidEndX=o.solidEndX;
    if(!Number.isInteger(this.particlesPerCellAxis)||this.particlesPerCellAxis<1||this.particlesPerCellAxis>4)throw Error("Crest particlesPerCellAxis must be 1 through 4");
    if(![this.crest,this.cellSize,this.dt,...this.origin,this.lipX,this.inletX,this.channelDepth,this.channelWidth,this.outletX,this.outletY].every(Number.isFinite)||this.cellSize<=0||this.dt<=0||this.dt>.005||!this.cells.every(n=>Number.isInteger(n)&&n>2)||this.cells.reduce((a,b)=>a*b,1)>131072||this.channelDepth<=0||this.channelWidth<=0||this.inletX>=this.lipX||!Number.isInteger(this.maximumParticles)||this.maximumParticles<1||!Number.isInteger(this.maxIterations)||this.maxIterations<1||!Number.isFinite(this.tolerance)||this.tolerance<=0||this.tolerance>=1)throw Error('Invalid bounded crest options');
    // This first-order voxel control supports aligned physical planes only.
    // Reject other geometry instead of imposing a different Q on a rounded face.
    for(const [value,axis] of [[this.inletX,0],[this.lipX,0],[this.crest,1],[this.crest-this.channelDepth,1],[-this.channelWidth/2,2],[this.channelWidth/2,2],...(o.solidEndX===undefined?[]:[[o.solidEndX,0]])])if(!this.aligned(value,axis))throw Error('Crest solid and inlet planes must be grid-aligned');
    const [nx,ny,nz]=this.cells;this.dims=[[nx+1,ny,nz],[nx,ny+1,nz],[nx,ny,nz+1]];
    const sizes=this.dims.map(d=>d[0]*d[1]*d[2]);this.offsets=[0,sizes[0],sizes[0]+sizes[1]];
    this.field=new Float64Array(sizes.reduce((a,b)=>a+b,0));this.faceMass=new Float64Array(this.field.length);this.faceMomentum=new Float64Array(this.field.length);this.fixed=new Uint8Array(this.field.length);this.projectionMass=new Float64Array(this.field.length);
    const nc=nx*ny*nz;this.surfaceDensity=new Float64Array(nc);this.depositedDensity=new Float64Array(nc);this.geometryFraction=new Float64Array(nc);this.geometryFraction.fill(NaN);this.fractions=new Float64Array(nc);this.pressure=new Float64Array(nc);this.fluid=new Int32Array(nc);this.solid=new Uint8Array(nc);this.faces=[];
    for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++) {
      const cell=i+nx*(j+ny*k),p=[i,j,k].map((x,c)=>this.origin[c]+(x+.5)*this.cellSize);
      this.solid[cell]=Number(p[0]<this.inletX-1e-10||(o.solidEndX!==undefined&&p[0]>=o.solidEndX)||(p[0]<this.lipX&&(p[1]<this.crest-this.channelDepth-1e-10||Math.abs(p[2])>this.channelWidth/2+1e-10)));
      this.faces[cell]=[this.index(0,i,j,k),this.index(0,i+1,j,k),this.index(1,i,j,k),this.index(1,i,j+1,k),this.index(2,i,j,k),this.index(2,i,j,k+1)];
    }
  }
  private index(c:number,i:number,j:number,k:number){const d=this.dims[c];return this.offsets[c]+i+d[0]*(j+d[1]*k);}
  private sourceAt(time:number){for(let i=this.events.length-1;i>=0;i--)if(this.events[i].time<=time+1e-12)return this.events[i];return null;}
  private sourceVelocity(source:CrestSource):CrestVec3{return[source.speed??source.q/(source.width*source.depth),0,0];}
  private aligned(value:number,axis:number){const coordinate=(value-this.origin[axis])/this.cellSize;return Number.isFinite(coordinate)&&Math.abs(coordinate-Math.round(coordinate))<1e-7;}
  private validateSource(source:CrestSource) {
    const speed=this.sourceVelocity(source)[0];
    if(![source.q,source.width,source.depth,speed].every(Number.isFinite)||source.q<0||source.width<=0||source.depth<=0||source.width>this.channelWidth+1e-10||source.depth>this.channelDepth+1e-10||speed<0||Math.abs(speed*source.width*source.depth-source.q)>1e-9*Math.max(1,source.q))throw Error('Source must satisfy Q=width*depth*speed and channel bounds');
    if(!this.aligned(this.crest-source.depth,1)||!this.aligned(-source.width/2,2)||!this.aligned(source.width/2,2))throw Error('Crest source opening must be grid-aligned');
  }
  recordSource(time:number,source:CrestSource) {
    this.validateSource(source);if(!Number.isFinite(time)||time<this.tick*this.dt-1e-10)throw Error('Cannot rewrite released crest history');
    const existing=this.events.find(e=>e.time===time),id=existing?.id??source.id??`source-${++this.sourceSerial}`;
    if(existing)existing.source={...source};else this.events.push({time,source:{...source},id});this.events.sort((a,b)=>a.time-b.time);
  }
  /** Explicit initial inventory, separate from later emitted flux. The upstream
   * channel is genuinely filled in three dimensions, not a midsurface sheet. */
  fillApproach(source:CrestSource) {
    this.validateSource(source);this.seedBox([this.inletX,this.crest-source.depth,-source.width/2],[this.lipX,this.crest,source.width/2],this.sourceVelocity(source),source.id??'initial-approach');
  }
  seedBox(min:CrestVec3,max:CrestVec3,velocity:CrestVec3|((position:CrestVec3)=>CrestVec3),sourceId='initial',affine?:readonly number[]) {
    if(this.tick!==0||!min.every((v,c)=>Number.isFinite(v)&&Number.isFinite(max[c])&&max[c]>v)||(typeof velocity!=='function'&&!velocity.every(Number.isFinite))||(affine!==undefined&&(affine.length!==9||!affine.every(Number.isFinite))))throw Error('Invalid initial crest inventory');
    const dims=max.map((v,c)=>Math.ceil((v-min[c])/(this.cellSize/this.particlesPerCellAxis)-1e-9)),count=dims.reduce((a,b)=>a*b,1),volume=max.reduce((v,x,c)=>v*(x-min[c]),1)/count;
    if(this.particles.length+this.residue.length+count>this.maximumParticles)throw Error('Crest particle capacity exceeded');
    const previous={particles:this.particles,nextId:this.nextId,volume:this.initialVolume,momentum:[...this.initialMomentum] as CrestVec3,fractions:this.fractions.slice(),surface:this.surfaceDensity.slice(),deposited:this.depositedDensity.slice(),fluid:this.fluid.slice(),last:{...this.last}};
    const added:MaterialParticle[]=[];
    try{
    for(let k=0;k<dims[2];k++)for(let j=0;j<dims[1];j++)for(let i=0;i<dims[0];i++) {
      const position=[i,j,k].map((v,c)=>min[c]+(v+.5)*(max[c]-min[c])/dims[c]) as CrestVec3;
      this.stencil(position,0);this.stencil(position,1);this.stencil(position,2);
      const local=typeof velocity==='function'?velocity(position):velocity;if(!local.every(Number.isFinite))throw Error('Invalid initial crest velocity');
      added.push({id:this.nextId++,sourceId,birth:0,volume,position,velocity:[...local],affine:affine?Float64Array.from(affine):new Float64Array(9)});
    }
    this.particles=this.particles.concat(added);this.initialVolume+=volume*count;for(const p of added)addInto(this.initialMomentum,p.velocity.map(v=>v*p.volume*rho) as CrestVec3);
    this.last.fluidCells=this.markCells().length;this.last.maxFraction=this.fractions.reduce((a,b)=>Math.max(a,b),0);
    }catch(error){this.particles=previous.particles;this.nextId=previous.nextId;this.initialVolume=previous.volume;this.initialMomentum=previous.momentum;this.fractions.set(previous.fractions);this.surfaceDensity.set(previous.surface);this.depositedDensity.set(previous.deposited);this.fluid.set(previous.fluid);this.last=previous.last;throw error;}
  }
  // Scalar coordinates keep the same weights, bounds and tap order while
  // avoiding temporary per-tap arrays and callback allocations.
  private stencil(position:CrestVec3,c:number) {
    const h=this.cellSize,d=this.dims[c];
    const x=(position[0]-this.origin[0])/h-(c===0?0:.5),y=(position[1]-this.origin[1])/h-(c===1?0:.5),z=(position[2]-this.origin[2])/h-(c===2?0:.5);
    const mixed=this.transport==='divergence-conforming';
    const rx=mixed&&c===0?2:1.5,ry=mixed&&c===1?2:1.5,rz=mixed&&c===2?2:1.5;
    const ix=Math.ceil(x-rx+1e-12),iy=Math.ceil(y-ry+1e-12),iz=Math.ceil(z-rz+1e-12),jx=Math.floor(x+rx-1e-12),jy=Math.floor(y+ry-1e-12),jz=Math.floor(z+rz-1e-12);
    // APIC's first/second moment identities assume an intact stencil. Reject
    // unsupported geometry; never hide a singular boundary fit with PIC reset.
    if(ix<0||iy<0||iz<0||jx>=d[0]||jy>=d[1]||jz>=d[2])throw Error('Crest APIC stencil outside supported domain');
    const out:{index:number;weight:number;r:CrestVec3}[]=[];
    for(let k=iz;k<=jz;k++)for(let j=iy;j<=jy;j++)for(let i=ix;i<=jx;i++){
      const a=i-x,b=j-y,e=k-z;
      const weight=(mixed&&c===0?cubic(a):basis(a))*(mixed&&c===1?cubic(b):basis(b))*(mixed&&c===2?cubic(e):basis(e));
      if(weight>0)out.push({index:this.index(c,i,j,k),weight,r:[a*h,b*h,e*h]});
    }return out;
  }
  private eachFace(visit:(index:number,c:number,i:number,j:number,k:number)=>void) {
    for(let c=0;c<3;c++){const d=this.dims[c];for(let k=0;k<d[2];k++)for(let j=0;j<d[1];j++)for(let i=0;i<d[0];i++)visit(this.index(c,i,j,k),c,i,j,k);}
  }
  private markCells(releaseEpoch?:{start:number;end:number}):number[] {
    this.fractions.fill(0);this.fluid.fill(-1);const [nx,ny,nz]=this.cells;
    for(const p of this.particles) {const ijk=p.position.map((v,c)=>Math.floor((v-this.origin[c])/this.cellSize));if(ijk.some((v,c)=>v<0||v>=this.cells[c]))throw Error('Resident crest particle outside grid');const cell=ijk[0]+nx*(ijk[1]+ny*ijk[2]);if(this.solid[cell])throw Error('Resident crest marker inside solid');this.fractions[cell]+=p.volume/this.cellSize**3;}
    if(this.pressureSurface==='volume-kernel'){
      this.surfaceDensity.fill(0);this.depositedDensity.fill(0);
      // The same physical volume field defines the entire pressure surface.
      // Per-parcel normalization preserves integrated V across grid phase/PPC;
      // .5 is the symmetric planar-interface convention, not a density force.
      // p=0 remains at the resulting voxel interface, so curvature/volume error
      // still needs refinement proof. Solid cells never become fluid cells.
      for(const p of this.particles){const support=this.surfaceStencil(p.position),sum=support.reduce((v,e)=>v+e.weight,0);if(!(sum>0)||!Number.isFinite(sum))throw Error('Invalid crest volume kernel');for(const e of support)this.depositedDensity[e.index]+=p.volume*e.weight/(sum*this.cellSize**3);}
      // Correct scalar support loss using geometry alone, never the wet mask.
      // Air stays in this denominator, so real free surfaces remain attenuated.
      // Raw deposited V and this corrected integral are distinct diagnostics.
      for(let cell=0;cell<this.surfaceDensity.length;cell++)if(!this.solid[cell]&&this.depositedDensity[cell]>0)this.surfaceDensity[cell]=this.depositedDensity[cell]/this.nonSolidKernelFraction(cell);
    }
    const active:number[]=[],density=this.pressureSurface==='volume-kernel'?this.surfaceDensity:this.fractions;
    for(let cell=0;cell<nx*ny*nz;cell++)if(!this.solid[cell]&&(this.pressureSurface==='volume-kernel'?density[cell]>=.5-1e-12:density[cell]>0)){this.fluid[cell]=active.length;active.push(cell);}
    if(this.pressureSurface==='volume-kernel'){
      const depleted=this.particles.filter(p=>!this.surfaceStencil(p.position).some(e=>e.weight>0&&this.fluid[e.index]>=0));
      if(depleted.length){
        // A sparse downstream fringe no longer has a resolved liquid pressure
        // cell. Only material already beyond the physical lip may
        // enter the declared pressure-free phase. No floor exists beyond that lip; upward/outward arcs retain their
        // measured velocity. Attached channel water still
        // rejects; this never fills a hole or changes the density threshold.
        const free=depleted.filter(p=>this.releaseSupportDepleted&&releaseEpoch&&p.position[0]>this.lipX);
        const bed=this.crest-this.channelDepth,residue=depleted.filter(p=>this.bedResidueEnabled&&releaseEpoch&&p.position[0]>=this.inletX&&p.position[0]<this.lipX&&p.position[1]>=bed&&p.position[1]<=bed+this.cellSize&&Math.abs(p.position[2])<=this.channelWidth/2);
        const eligible=releaseEpoch&&free.length+residue.length===depleted.length;
        if(!eligible)throw Error('Unresolved thin/open crest material has no pressure surface support: '+JSON.stringify(depleted.map(p=>({id:p.id,volume:p.volume,position:p.position,sourceId:p.sourceId,birth:p.birth}))));
        if(this.exits.length+depleted.length>this.maximumParticles)throw Error('Crest exit queue capacity exceeded; collect exported packets');
        const ids=new Set(depleted.map(p=>p.id));
        this.residue=this.residue.concat(residue);this.residueAdmissions+=residue.length;
        for(const p of free){
          const packet:CrestExit={id:p.id,sourceId:p.sourceId,birth:p.birth,volume:p.volume,position:[...p.position],velocity:[...p.velocity],time:releaseEpoch.end,boundary:'support-depleted',releaseReason:'support-depleted',phase:'post-kick-drift',kickStartTime:releaseEpoch.start,kickEndTime:releaseEpoch.end,remainingDriftTime:0,transportGradient:this.sampleTransport(p.position).gradient,gradientDefinition:'frozen-exit-transport'};
          this.exits.push(packet);this.exitCount++;this.exitedVolume+=p.volume;addInto(this.exitedMomentum,p.velocity.map(v=>v*rho*p.volume) as CrestVec3);
        }
        this.particles=this.particles.filter(p=>!ids.has(p.id));
        // Rebuild the entire surface consistently after the phase transfer.
        // Any newly unsupported attached material still rejects atomically.
        return this.markCells(releaseEpoch);
      }
    }
    return active;
  }
  private nonSolidKernelFraction(cell:number) {
    if(Number.isFinite(this.geometryFraction[cell]))return this.geometryFraction[cell];
    const [nx,ny]=this.cells,h=this.cellSize,H=this.surfaceSupport,ijk=[cell%nx,Math.floor(cell/nx)%ny,Math.floor(cell/(nx*ny))],position=ijk.map((v,c)=>this.origin[c]+(v+.5)*h);
    const lo=position.map((v,c)=>Math.floor((v-1.5*H-this.origin[c])/h)),hi=position.map((v,c)=>Math.floor((v+1.5*H-this.origin[c])/h));let fraction=0;
    for(let k=lo[2];k<=hi[2];k++)for(let j=lo[1];j<=hi[1];j++)for(let i=lo[0];i<=hi[0];i++){
      const q=[i,j,k],world=q.map((v,c)=>this.origin[c]+(v+.5)*h);
      const solid=world[0]<this.inletX-1e-10||(this.solidEndX!==undefined&&world[0]>=this.solidEndX)||(world[0]<this.lipX&&(world[1]<this.crest-this.channelDepth-1e-10||Math.abs(world[2])>this.channelWidth/2+1e-10));
      if(solid)continue;let weight=1;for(let c=0;c<3;c++)weight*=kernelCDF((world[c]+h*.5-position[c])/H)-kernelCDF((world[c]-h*.5-position[c])/H);fraction+=weight;
    }
    if(!(fraction>0)||!Number.isFinite(fraction))throw Error('Invalid crest geometric kernel support');this.geometryFraction[cell]=fraction;return fraction;
  }
  private surfaceStencil(position:CrestVec3) {
    const h=this.cellSize,H=this.surfaceSupport,x=position.map((v,c)=>(v-this.origin[c])/h-.5),radius=1.5*H/h;
    const lo=x.map(v=>Math.ceil(v-radius+1e-12)),hi=x.map(v=>Math.floor(v+radius-1e-12));
    if(lo.some(v=>v<0)||hi.some((v,c)=>v>=this.cells[c]))throw Error('Crest volume surface kernel outside supported domain');
    const out:{index:number;weight:number}[]=[];
    for(let k=lo[2];k<=hi[2];k++)for(let j=lo[1];j<=hi[1];j++)for(let i=lo[0];i<=hi[0];i++){
      const weight=basis((i-x[0])*h/H)*basis((j-x[1])*h/H)*basis((k-x[2])*h/H);if(weight>0)out.push({index:this.cellAt(i,j,k),weight});
    }return out;
  }
  private cellAt(i:number,j:number,k:number){const [nx,ny,nz]=this.cells;return i<0||j<0||k<0||i>=nx||j>=ny||k>=nz?-1:i+nx*(j+ny*k);}
  private project(active:number[],dt:number) {
    const n=active.length,area=this.cellSize**2,rhs=new Float64Array(n),diag=new Float64Array(n),lambda=new Float64Array(n),scratch=new Float64Array(this.field.length);
    // Constant physical liquid density belongs in pressure, not the smoothed
    // APIC deposition density. A fluid/air face has a half-cell dual volume:
    // p=0 is at its voxel interface. This is not a subcell reconstructed surface.
    this.projectionMass.fill(0);const known=new Uint8Array(this.field.length);
    this.eachFace((f,c,i,j,k)=>{const left=[i,j,k];left[c]--;const a=this.cellAt(...left as CrestVec3),b=this.cellAt(i,j,k);const wetA=a>=0&&this.fluid[a]>=0,wetB=b>=0&&this.fluid[b]>=0;if(wetA||wetB){known[f]=1;if(!this.fixed[f])this.projectionMass[f]=rho*this.cellSize**3*(wetA&&wetB?1:.5);}});
    for(let row=0;row<n;row++)for(let side=0;side<6;side++) {const face=this.faces[active[row]][side],sign=side%2?1:-1;rhs[row]+=sign*area*this.field[face];if(this.projectionMass[face]>0)diag[row]+=area**2/this.projectionMass[face];}
    if(diag.some(x=>!(x>0)&&n>0))throw Error('Closed or unsupported fluid pressure component');
    const apply=(x:Float64Array,out:Float64Array)=>{
      scratch.fill(0);for(let row=0;row<n;row++)for(let side=0;side<6;side++){const face=this.faces[active[row]][side];if(this.projectionMass[face]>0)scratch[face]+=(side%2?1:-1)*area*x[row];}
      for(let f=0;f<scratch.length;f++)if(this.projectionMass[f]>0)scratch[f]/=this.projectionMass[f];
      for(let row=0;row<n;row++){let s=0;for(let side=0;side<6;side++)s+=(side%2?1:-1)*area*scratch[this.faces[active[row]][side]];out[row]=s;}
    };
    const residual=rhs.slice(),z=new Float64Array(n),direction=new Float64Array(n),product=new Float64Array(n);
    for(let i=0;i<n;i++)z[i]=residual[i]/diag[i];direction.set(z);let rz=dot(residual,z),initial=rz,iterations=0;
    if(!Number.isFinite(rz))throw Error('Nonfinite crest pressure residual');
    while(iterations<this.maxIterations&&rz>initial*this.tolerance**2){apply(direction,product);const denominator=dot(direction,product);if(!(denominator>0)||!Number.isFinite(denominator))throw Error('Crest pressure Gram lost definiteness');const alpha=rz/denominator;for(let i=0;i<n;i++){lambda[i]+=alpha*direction[i];residual[i]-=alpha*product[i];z[i]=residual[i]/diag[i];}const next=dot(residual,z);if(!Number.isFinite(next))throw Error('Nonfinite crest pressure iteration');for(let i=0;i<n;i++)direction[i]=z[i]+next/rz*direction[i];rz=next;iterations++;}
    apply(lambda,product);let error=0;for(let i=0;i<n;i++)error+=(rhs[i]-product[i])**2/diag[i];const relative=initial>0?Math.sqrt(error/initial):Math.sqrt(error);
    if(!Number.isFinite(relative)||relative>Math.max(4*this.tolerance,1e-12))throw Error('Crest pressure iteration capacity exceeded');
    this.pressure.fill(0);for(let row=0;row<n;row++)this.pressure[active[row]]=-lambda[row]/dt;
    // apply(lambda) left M^-1 D^T lambda in scratch. This pressure is a velocity
    // update, not a density/EOS spring. Fixed inlet/solid faces stay prescribed.
    this.eachFace((f,c)=>{const change=-scratch[f];this.field[f]+=change;this.pressureImpulse[c]+=this.faceMass[f]*change;});
    // Extend the pressure velocity CORRECTION to air-side APIC support, rather
    // than diffusing the predicted velocity. Zero correction preserves affine
    // freefall transport. Extension impulse is a separate numerical ledger.
    const correction=Float64Array.from(scratch,v=>-v);
    for(let layer=0;layer<2;layer++) {
      const old=correction.slice(),previous=known.slice();
      this.eachFace((f,c,i,j,k)=>{
        if(previous[f]||this.fixed[f])return;let sum=0,count=0;const d=this.dims[c];
        for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){const q=[i,j,k];q[axis]+=sign;if(q[axis]<0||q[axis]>=d[axis])continue;const neighbour=this.index(c,q[0],q[1],q[2]);if(previous[neighbour]){sum+=old[neighbour];count++;}}
        if(count){correction[f]=sum/count;known[f]=1;}
      });
    }
    this.eachFace((f,c)=>{if(this.projectionMass[f]===0&&!this.fixed[f]){this.field[f]+=correction[f];this.extensionImpulse[c]+=this.faceMass[f]*correction[f];}});
    let maximum=0;for(const cell of active){let flux=0;for(let side=0;side<6;side++)flux+=(side%2?1:-1)*area*this.field[this.faces[cell][side]];maximum=Math.max(maximum,Math.abs(flux)/this.cellSize**3);}
    this.last.divergence=maximum;this.last.residual=relative;this.last.iterations=iterations;
  }
  private emit(start:number,end:number,event:NonNullable<ReturnType<WaterfallCrestLiquid['sourceAt']>>) {
    const {source,id}=event,amount=source.q*(end-start);if(amount<=0)return;
    const count=Math.max(1,Math.ceil(amount/(this.cellSize/this.particlesPerCellAxis)**3-1e-9));if(this.particles.length+this.residue.length+count>this.maximumParticles)throw Error('Crest particle capacity exceeded; source volume not debited');
    const nz=Math.ceil(source.width/(this.cellSize/this.particlesPerCellAxis)-1e-9),ny=Math.ceil(source.depth/(this.cellSize/this.particlesPerCellAxis)-1e-9),velocity=this.sourceVelocity(source),volume=amount/count;
    for(let i=0;i<count;i++) {
      // Spatial quadrature covers the wetted opening with a balanced 2D prefix,
      // even when a low-Q step buys one marker. It is not a bottom-to-top sweep.
      // Marker centers stay half a sample from the wall; finite-prefix flux
      // moments remain a declared sampling error, measured by low-Q controls.
      const sample=++this.sampleCursor,z=Math.min(nz-1,Math.floor(radicalInverse(sample,2)*nz)),y=Math.min(ny-1,Math.floor(radicalInverse(sample,3)*ny));
      // Birth strata occupy the incoming material slab U*dt, not a fixed
      // grid-sized offset that overlaps previously released inventory.
      const birth=start+(i+.5)*(end-start)/count;
      const position:CrestVec3=[this.inletX+velocity[0]*(end-birth),this.crest-source.depth+(y+.5)*source.depth/ny,-source.width/2+(z+.5)*source.width/nz];
      this.particles.push({id:this.nextId++,sourceId:id,birth,volume,position,velocity:[...velocity],affine:new Float64Array(9)});
    }
    this.emittedVolume+=amount;addInto(this.sourceMomentum,velocity.map(v=>v*amount*rho) as CrestVec3);
  }
  private applyBoundarySupport(source:ReturnType<WaterfallCrestLiquid['sourceAt']>,setPlanes:boolean) {
    const dx=this.cellSize,floor=this.crest-this.channelDepth;
    // Set actual wall planes first so reflected normal samples read zero.
    if(setPlanes)this.eachFace((f,c,i,j,k)=>{
      const at:CrestVec3=[i,j,k],left:CrestVec3=[i,j,k];left[c]--;
      const a=this.cellAt(...left),b=this.cellAt(...at);
      if(a>=0&&b>=0&&!!this.solid[a]===!!this.solid[b])return;
      const p=at.map((v,d)=>this.origin[d]+(v+(d===c?0:.5))*dx);
      const inlet=c===0&&Math.abs(p[0]-this.inletX)<dx*1e-6&&source&&p[1]>=this.crest-source.source.depth&&p[1]<=this.crest&&Math.abs(p[2])<source.source.width/2;
      const value=inlet?this.sourceVelocity(source!.source)[0]:0;
      this.boundaryImpulse[c]+=this.faceMass[f]*(value-this.field[f]);this.field[f]=value;
    });
    const updates:{f:number;c:number;value:number}[]=[];
    this.eachFace((f,c,i,j,k)=>{
      const at:CrestVec3=[i,j,k],left:CrestVec3=[i,j,k];left[c]--;
      const a=this.cellAt(...left),b=this.cellAt(...at),solidA=a>=0&&!!this.solid[a],solidB=b>=0&&!!this.solid[b];
      if(a>=0&&b>=0&&!solidA&&!solidB)return;
      const p=at.map((v,d)=>this.origin[d]+(v+(d===c?0:.5))*dx) as CrestVec3;
      this.fixed[f]=1;
      const inlet=c===0&&Math.abs(p[0]-this.inletX)<dx*1e-6&&source&&p[1]>=this.crest-source.source.depth&&p[1]<=this.crest&&Math.abs(p[2])<source.source.width/2;
      // A true normal boundary face differs from a support sample inside solid.
      // Wall planes enforce zero normal flow; the inlet plane enforces Q/A.
      if(a<0||b<0||solidA!==solidB){
        // At the reservoir/free-surface rim, an air-only face is also APIC
        // support. Continue inlet velocity there after the solve, while keeping
        // the wetted pressure-boundary flux exactly Q. Never override a wet row.
        if(!setPlanes&&c===0&&source&&source.source.q>0&&Math.abs(p[0]-this.inletX)<dx*1e-6&&p[1]>=this.crest-source.source.depth-dx&&p[1]<=this.crest+dx&&Math.abs(p[2])<=source.source.width/2+dx&&(a<0||this.fluid[a]<0)&&(b<0||this.fluid[b]<0))updates.push({f,c,value:this.sourceVelocity(source.source)[0]});
        return;
      }
      // The closed-end normal plane stays zero even below the floor/behind a
      // side wall, where both neighboring cells are solid. Exact coordinates
      // must not depend on roundoff selecting a reflection across another wall.
      if(c===0&&this.solidEndX!==undefined&&Math.abs(p[0]-this.solidEndX)<dx*1e-6){updates.push({f,c,value:0});return;}
      if(this.faceMass[f]===0)return;
      // The prescribed reservoir continues through the quadratic inlet stencil.
      // Its impulse is included in the boundary ledger, not hidden as transfer.
      if(source&&source.source.q>0&&p[0]<this.inletX&&p[1]>=this.crest-source.source.depth-dx&&p[1]<=this.crest+dx&&Math.abs(p[2])<=source.source.width/2+dx){updates.push({f,c,value:c===0?this.sourceVelocity(source.source)[0]:0});return;}
      const q=[...p] as CrestVec3;let sign=1;
      const reflect=(axis:number,plane:number)=>{q[axis]=2*plane-q[axis];if(c===axis)sign=-sign;};
      if(q[0]<this.inletX)reflect(0,this.inletX);
      if(this.solidEndX!==undefined&&q[0]>this.solidEndX)reflect(0,this.solidEndX);
      if(q[0]<this.lipX){
        if(q[1]<floor){
          // Near the lip corner reflect across the nearest physical wall.
          if(this.solidEndX===undefined&&this.lipX-q[0]<floor-q[1])reflect(0,this.lipX);else reflect(1,floor);
        }
        if(q[0]<this.lipX&&Math.abs(q[2])>this.channelWidth/2)reflect(2,Math.sign(q[2])*this.channelWidth/2);
      }
      const ijk=q.map((v,d)=>Math.round((v-this.origin[d])/dx-(d===c?0:.5))) as CrestVec3;
      if(ijk.some((v,d)=>v<0||v>=this.dims[c][d]))throw Error('Crest reflected support outside domain');
      const aa=[...ijk] as CrestVec3;aa[c]--;const ca=this.cellAt(...aa),cb=this.cellAt(...ijk);
      if(ca<0||cb<0||(this.solid[ca]&&this.solid[cb]))throw Error('Crest reflected support remains in solid');
      const reservoirTarget=c===0&&source&&source.source.q>0&&Math.abs(q[0]-this.inletX)<dx*1e-6&&q[1]>=this.crest-source.source.depth-dx&&q[1]<=this.crest+dx&&Math.abs(q[2])<=source.source.width/2+dx;
      updates.push({f,c,value:sign*(reservoirTarget?this.sourceVelocity(source!.source)[0]:this.field[this.index(c,...ijk)])});
    });
    // Read reflection targets before writing ghosts; no traversal-order cascade.
    for(const {f,c,value} of updates){this.boundaryImpulse[c]+=this.faceMass[f]*(value-this.field[f]);this.field[f]=value;}
  }
  /** Inspect the actual transport field, rather than interpreting cell-flux
   * residuals as pointwise incompressibility. Gradient entries are row-major. */
  sampleTransport(position:CrestVec3):{velocity:CrestVec3;gradient:number[];divergence:number} {
    if(this.transport==='flux-cell')return this.sampleFluxCell(position);
    const velocity=vec(),gradient=Array<number>(9).fill(0),h=this.cellSize;
    for(let c=0;c<3;c++)for(const e of this.stencil(position,c)){
      const value=this.field[e.index];velocity[c]+=e.weight*value;
      const r=e.r.map(v=>-v/h);
      for(let a=0;a<3;a++){
        let weight=1;for(let d=0;d<3;d++){const normal=this.transport==='divergence-conforming'&&d===c;weight*=d===a?(normal?cubicDerivative(r[d]):derivative(r[d])):(normal?cubic(r[d]):basis(r[d]));}
        gradient[c*3+a]+=value*weight/h;
      }
    }return{velocity,gradient,divergence:gradient[0]+gradient[4]+gradient[8]};
  }
  private extendSolenoidally(active:number[],source:ReturnType<WaterfallCrestLiquid['sourceAt']>) {
    // This is a numerical velocity extension, with no air mass or pressure.
    // The common quadratic divergence kernel needs two complete cell layers.
    // Wet faces and actual normal boundary planes are never correction DOFs.
    const [nx,ny,nz]=this.cells,halo=new Set<number>(),area=this.cellSize**2,h=this.cellSize;
    for(const cell of active){const i=cell%nx,j=Math.floor(cell/nx)%ny,k=Math.floor(cell/(nx*ny));for(let z=k-2;z<=k+2;z++)for(let y=j-2;y<=j+2;y++)for(let x=i-2;x<=i+2;x++){const q=this.cellAt(x,y,z);if(q>=0&&this.fluid[q]<0&&(this.transport!=='flux-cell'||!this.solid[q]))halo.add(q);}}
    const allowed=new Uint8Array(this.field.length),owner=new Int32Array(this.field.length);owner.fill(-1);const signs=new Float64Array(this.field.length);signs.fill(1);
    this.eachFace((f,c,i,j,k)=>{const left:CrestVec3=[i,j,k];left[c]--;const a=this.cellAt(...left),b=this.cellAt(i,j,k);if(a<0||b<0||this.fluid[a]>=0||this.fluid[b]>=0||!!this.solid[a]!==!!this.solid[b])return;if(halo.has(a)||halo.has(b)){allowed[f]=1;owner[f]=f;}});
    // Extrapolate only zero-mass faces before projecting their divergence.
    // A nearest known value plus one-sided/central slopes preserves global
    // affine velocity exactly; zero-filled air would spuriously slow freefall.
    const predicted=this.field.slice();
    this.eachFace((f,c,i,j,k)=>{if(!allowed[f]||this.faceMass[f]>0)return;const dims=this.dims[c];let nearest:CrestVec3|null=null,distance=Infinity;
      for(let z=k-3;z<=k+3;z++)for(let y=j-3;y<=j+3;y++)for(let x=i-3;x<=i+3;x++){if(x<0||y<0||z<0||x>=dims[0]||y>=dims[1]||z>=dims[2])continue;const q=this.index(c,x,y,z),d=(x-i)**2+(y-j)**2+(z-k)**2;if(this.faceMass[q]>0&&d<distance){nearest=[x,y,z];distance=d;}}
      if(!nearest)return;let value=predicted[this.index(c,...nearest)];
      for(let axis=0;axis<3;axis++){const lo=[...nearest] as CrestVec3,hi=[...nearest] as CrestVec3;lo[axis]--;hi[axis]++;const low=lo[axis]>=0&&this.faceMass[this.index(c,...lo)]>0,high=hi[axis]<dims[axis]&&this.faceMass[this.index(c,...hi)]>0;let slope=0;if(low&&high)slope=(predicted[this.index(c,...hi)]-predicted[this.index(c,...lo)])/2;else if(low)slope=predicted[this.index(c,...nearest)]-predicted[this.index(c,...lo)];else if(high)slope=predicted[this.index(c,...hi)]-predicted[this.index(c,...nearest)];value+=slope*([i,j,k][axis]-nearest[axis]);}
      this.field[f]=value;
    });
    // E ties every occupied solid ghost correction to its reflected air-face
    // correction. Odd normal/even tangent parity therefore survives the solve.
    // A reflected wet/plane target is fixed. The cliff corner can make these
    // affine constraints incompatible; that geometry is rejected, not softened.
    this.eachFace((f,c,i,j,k)=>{if(!allowed[f]||this.faceMass[f]===0)return;const left:CrestVec3=[i,j,k];left[c]--;const a=this.cellAt(...left),b=this.cellAt(i,j,k);if(!this.solid[a]||!this.solid[b])return;
      const p=[i,j,k].map((v,d)=>this.origin[d]+(v+(d===c?0:.5))*h) as CrestVec3;
      if(c===0&&this.solidEndX!==undefined&&Math.abs(p[0]-this.solidEndX)<h*1e-6){owner[f]=-1;return;}
      if(source&&source.source.q>0&&p[0]<this.inletX&&p[1]>=this.crest-source.source.depth-h&&p[1]<=this.crest+h&&Math.abs(p[2])<=source.source.width/2+h){owner[f]=-1;return;}
      const q=[...p] as CrestVec3;let sign=1;const reflect=(axis:number,plane:number)=>{q[axis]=2*plane-q[axis];if(c===axis)sign=-sign;};
      if(q[0]<this.inletX)reflect(0,this.inletX);if(this.solidEndX!==undefined&&q[0]>this.solidEndX)reflect(0,this.solidEndX);
      const floor=this.crest-this.channelDepth;if(q[0]<this.lipX){if(q[1]<floor){if(this.solidEndX===undefined&&this.lipX-q[0]<floor-q[1])reflect(0,this.lipX);else reflect(1,floor);}if(q[0]<this.lipX&&Math.abs(q[2])>this.channelWidth/2)reflect(2,Math.sign(q[2])*this.channelWidth/2);}
      const ijk=q.map((v,d)=>Math.round((v-this.origin[d])/h-(d===c?0:.5))) as CrestVec3;
      if(ijk.some((v,d)=>v<0||v>=this.dims[c][d]))throw Error('Crest reflected extension outside domain');
      const target=this.index(c,...ijk);owner[f]=allowed[target]?target:-1;signs[f]=sign;
    });
    const metric=new Float64Array(this.field.length);for(let f=0;f<owner.length;f++)if(owner[f]>=0)metric[owner[f]]++;
    const rows:{cell:number;coefficients:[number,number][]}[]=[],rhsList:number[]=[],diagList:number[]=[];
    for(const cell of halo){let flux=0;const coefficients=new Map<number,number>();for(let side=0;side<6;side++){const f=this.faces[cell][side],sign=side%2?1:-1;flux+=sign*area*this.field[f];if(owner[f]>=0)coefficients.set(owner[f],(coefficients.get(owner[f])??0)+sign*area*signs[f]);}const entries=[...coefficients].filter(([,v])=>v!==0);let diagonal=0;for(const [f,v] of entries)diagonal+=v*v/metric[f];if(diagonal===0){if(Math.abs(flux)/h**3>1e-8)throw Error('Crest wall-compatible extension has incompatible fixed flux');continue;}rows.push({cell,coefficients:entries});rhsList.push(flux);diagList.push(diagonal);}
    const rhs=Float64Array.from(rhsList),diag=Float64Array.from(diagList),n=rows.length,lambda=new Float64Array(n),scratch=new Float64Array(this.field.length);
    const apply=(x:Float64Array,out:Float64Array)=>{scratch.fill(0);for(let row=0;row<n;row++)for(const [f,v] of rows[row].coefficients)scratch[f]+=v*x[row];for(let f=0;f<scratch.length;f++)if(metric[f]>0)scratch[f]/=metric[f];for(let row=0;row<n;row++){let flux=0;for(const [f,v] of rows[row].coefficients)flux+=v*scratch[f];out[row]=flux;}};
    const residual=rhs.slice(),z=new Float64Array(n),direction=new Float64Array(n),product=new Float64Array(n);for(let i=0;i<n;i++)z[i]=residual[i]/diag[i];direction.set(z);let rz=dot(residual,z),iterations=0;
    if(!Number.isFinite(rz))throw Error('Nonfinite crest extension residual');
    const absoluteFlux=h**3*1e-9;
    while(iterations<this.maxIterations&&residual.some(v=>Math.abs(v)>absoluteFlux)){
      apply(direction,product);const denominator=dot(direction,product);if(!(denominator>0)||!Number.isFinite(denominator))throw Error('Crest extension Gram lost compatible rank');const alpha=rz/denominator;
      for(let i=0;i<n;i++){lambda[i]+=alpha*direction[i];residual[i]-=alpha*product[i];z[i]=residual[i]/diag[i];}const next=dot(residual,z);if(!Number.isFinite(next))throw Error('Nonfinite crest extension iteration');for(let i=0;i<n;i++)direction[i]=z[i]+next/rz*direction[i];rz=next;iterations++;
    }
    apply(lambda,product);let maximum=0;for(let i=0;i<n;i++)maximum=Math.max(maximum,Math.abs(rhs[i]-product[i])/h**3);
    if(!Number.isFinite(maximum)||maximum>1e-7)throw Error('Crest wall-compatible extension iteration capacity exceeded: '+maximum);
    this.eachFace((f,c)=>{if(owner[f]>=0){const change=-signs[f]*scratch[owner[f]];this.field[f]+=change;this.solenoidalImpulse[c]+=this.faceMass[f]*change;}});
    this.last.extensionResidual=maximum;this.last.extensionIterations=iterations;this.last.extensionCells=n;
  }
  private sampleFluxCell(position:CrestVec3,coordinates?:CrestVec3):{velocity:CrestVec3;gradient:number[];divergence:number} {
    const cell=coordinates??position.map((v,c)=>Math.floor((v-this.origin[c])/this.cellSize+1e-10)) as CrestVec3;
    if(this.cellAt(...cell)<0)throw Error('Crest flux characteristic outside domain');
    const velocity=vec(),gradient=Array<number>(9).fill(0);
    for(let c=0;c<3;c++){const upper=[...cell] as CrestVec3;upper[c]++;const lo=this.field[this.index(c,...cell)],hi=this.field[this.index(c,...upper)],a=(hi-lo)/this.cellSize;velocity[c]=lo+a*(position[c]-this.origin[c]-cell[c]*this.cellSize);gradient[c*3+c]=a;}
    return{velocity,gradient,divergence:gradient[0]+gradient[4]+gradient[8]};
  }
  private traceFluxCells(initial:CrestVec3,dt:number):{position:CrestVec3;maximumSpeed:number;maximumDivergence:number;gradient?:number[];exit?:{elapsed:number;boundary:CrestExit['boundary']}} {
    // RT0 is first order in space: each component uses its two normal MAC
    // faces. Its divergence is exactly cell D, and normal wall traces are exact.
    // Integrate each frozen affine cell characteristic analytically. Shared
    // normal face velocity gives unit saltation determinant at cell crossings.
    // APIC still transports momentum; its mismatch with this trajectory has a
    // separate angular-defect receipt, not a claim of full angular conservation.
    let position=[...initial] as CrestVec3,cell=initial.map((v,c)=>Math.floor((v-this.origin[c])/this.cellSize+1e-10)) as CrestVec3,elapsed=0,maximumSpeed=0,maximumDivergence=0;
    const exits:{axis:number;plane:number;positive:boolean;boundary:CrestExit['boundary']}[]=[{axis:0,plane:this.outletX,positive:true,boundary:'downstream'},{axis:1,plane:this.outletY,positive:false,boundary:'bottom'},{axis:0,plane:this.inletX,positive:false,boundary:'upstream'},{axis:2,plane:this.origin[2]+1.6*this.cellSize,positive:false,boundary:'side'},{axis:2,plane:this.origin[2]+this.cells[2]*this.cellSize-1.6*this.cellSize,positive:true,boundary:'side'}];
    for(let event=0;event<32;event++){
      if(this.cellAt(...cell)<0||this.solid[this.cellAt(...cell)])throw Error('Crest flux characteristic entered unsupported cell');
      const sample=this.sampleFluxCell(position,cell),remaining=dt-elapsed;maximumSpeed=Math.max(maximumSpeed,Math.hypot(...sample.velocity));maximumDivergence=Math.max(maximumDivergence,Math.abs(sample.divergence));
      const root=(axis:number,plane:number)=>{const v=sample.velocity[axis],distance=plane-position[axis],a=sample.gradient[axis*3+axis];if(v===0||distance*v<0)return Infinity;if(Math.abs(a*remaining)<1e-12)return distance/v;const ratio=a*distance/v;if(ratio<=-1)return Infinity;const t=Math.log1p(ratio)/a;return t>=-1e-12?Math.max(0,t):Infinity;};
      const crossings=cell.map((v,c)=>({axis:c,direction:sample.velocity[c]>0?1:-1,time:sample.velocity[c]===0?Infinity:root(c,this.origin[c]+(v+(sample.velocity[c]>0?1:0))*this.cellSize)}));
      let interval=remaining,exit:typeof exits[number]|undefined;
      for(const crossing of crossings)if(crossing.time<interval)interval=crossing.time;
      for(const candidate of exits){if(candidate.positive?sample.velocity[candidate.axis]<=0:sample.velocity[candidate.axis]>=0)continue;const time=root(candidate.axis,candidate.plane);if(time<=interval+1e-12){interval=Math.max(0,Math.min(interval,time));exit=candidate;}}
      for(let c=0;c<3;c++){const a=sample.gradient[c*3+c],v=sample.velocity[c];position[c]+=Math.abs(a*interval)<1e-12?v*interval:v*Math.expm1(a*interval)/a;}
      elapsed+=interval;const endVelocity=this.sampleFluxCell(position,cell).velocity;maximumSpeed=Math.max(maximumSpeed,Math.hypot(...endVelocity));
      if(!position.every(Number.isFinite))throw Error('Nonfinite crest characteristic');
      if(exit){position[exit.axis]=exit.plane;return{position,maximumSpeed,maximumDivergence,gradient:[...sample.gradient],exit:{elapsed,boundary:exit.boundary}};}
      if(elapsed>=dt-1e-12)return{position,maximumSpeed,maximumDivergence};
      let changed=false;for(const crossing of crossings)if(Math.abs(crossing.time-interval)<1e-10){cell[crossing.axis]+=crossing.direction;changed=true;}
      if(!changed)throw Error('Crest characteristic made no event progress');
    }throw Error('Crest characteristic event capacity exceeded');
  }
  // This is a reduced wetting/contact phase, not a pressure film solver.
  // No drag is invented. Only independent dense liquid can restore support;
  // residue accumulation alone does not rebuild a pressure pool.
  private advanceResidue(start:number,end:number) {
    const dt=end-start,bed=this.crest-this.channelDepth,remaining:MaterialParticle[]=[];
    for(const p of this.residue){const velocity=[...p.velocity] as CrestVec3,position=[...p.position] as CrestVec3,m=rho*p.volume;
      velocity[1]-=g*dt;this.gravityImpulse[1]-=m*g*dt;
      for(let c=0;c<3;c++)position[c]+=velocity[c]*dt;
      if(this.solidEndX!==undefined&&position[0]>=this.solidEndX){position[0]=this.solidEndX-this.cellSize*1e-8;this.collisionImpulse[0]-=m*velocity[0];velocity[0]=0;}
      if(position[0]<this.lipX){
        if(position[1]<bed){position[1]=bed+this.cellSize*1e-8;this.collisionImpulse[1]-=m*velocity[1];velocity[1]=0;}
        if(position[0]<this.inletX){position[0]=this.inletX+this.cellSize*1e-8;this.collisionImpulse[0]-=m*velocity[0];velocity[0]=0;}
        if(Math.abs(position[2])>this.channelWidth/2){position[2]=Math.sign(position[2])*(this.channelWidth/2-this.cellSize*1e-8);this.collisionImpulse[2]-=m*velocity[2];velocity[2]=0;}
        remaining.push({...p,position,velocity});
      }else{
        // Departure is admitted at the common end epoch. The reduced bed step
        // has at most one dt of contact/departure timing error; no second kick.
        if(this.exits.length>=this.maximumParticles)throw Error('Crest exit queue capacity exceeded; collect exported packets');
        this.exits.push({id:p.id,sourceId:p.sourceId,birth:p.birth,volume:p.volume,position,velocity,time:end,boundary:'support-depleted',releaseReason:'bed-departure',phase:'post-kick-drift',kickStartTime:start,kickEndTime:end,remainingDriftTime:0});
        this.exitCount++;this.exitedVolume+=p.volume;addInto(this.exitedMomentum,velocity.map(v=>v*m) as CrestVec3);
      }
    }this.residue=remaining;
  }
  private step(start:number,end:number) {
    const began=performance.now(),dt=end-start,source=this.sourceAt(start),active=this.markCells();
    // Test support against dense material alone, before returning any residue.
    const rejoin=this.residue.filter(p=>this.surfaceStencil(p.position).some(e=>e.weight>0&&this.fluid[e.index]>=0));
    if(rejoin.length){const ids=new Set(rejoin.map(p=>p.id));this.residue=this.residue.filter(p=>!ids.has(p.id));this.particles=this.particles.concat(rejoin.map(p=>({...p,affine:new Float64Array(9)})));this.residueRejoins+=rejoin.length;active.splice(0,active.length,...this.markCells());}
    this.advanceResidue(start,end);this.last.fluidCells=active.length;this.last.maxFraction=this.fractions.reduce((a,b)=>Math.max(a,b),0);
    this.faceMass.fill(0);this.faceMomentum.fill(0);this.field.fill(0);this.fixed.fill(0);
    const beforeMomentum=vec();
    for(const p of this.particles)for(let c=0;c<3;c++){beforeMomentum[c]+=rho*p.volume*p.velocity[c];for(const e of this.stencil(p.position,c)){let velocity=p.velocity[c];for(let a=0;a<3;a++)velocity+=p.affine[c*3+a]*e.r[a];this.faceMass[e.index]+=rho*p.volume*e.weight;this.faceMomentum[e.index]+=rho*p.volume*e.weight*velocity;}}
    const transferMomentum=vec();this.eachFace((f,c)=>{transferMomentum[c]+=this.faceMomentum[f];this.field[f]=this.faceMass[f]>0?this.faceMomentum[f]/this.faceMass[f]:0;if(c===1&&this.faceMass[f]>0){this.field[f]-=g*dt;this.gravityImpulse[1]-=this.faceMass[f]*g*dt;}});
    for(let c=0;c<3;c++)this.transferError[c]+=transferMomentum[c]-beforeMomentum[c];
    this.applyBoundarySupport(source,true);
    this.last.inletArea=0;this.last.inletFlux=0;
    this.eachFace((f,c,i,j,k)=>{if(c===0&&Math.abs(this.origin[0]+i*this.cellSize-this.inletX)<1e-8&&this.cellAt(i,j,k)>=0&&this.fluid[this.cellAt(i,j,k)]>=0){this.last.inletArea+=this.cellSize**2;this.last.inletFlux+=this.cellSize**2*this.field[f];}});
    this.project(active,dt);
    this.applyBoundarySupport(source,false);
    if(this.transport!=='quadratic')this.extendSolenoidally(active,source);
    if(this.transport==='flux-cell')this.applyBoundarySupport(source,false);
    this.last.interpolatedDivergence=0;
    const afterMomentum=vec(),surviving:MaterialParticle[]=[];
    for(const p of this.particles) {
      const velocity=vec(),affine=new Float64Array(9);
      for(let c=0;c<3;c++)for(const e of this.stencil(p.position,c)){const value=this.field[e.index];velocity[c]+=e.weight*value;for(let a=0;a<3;a++)affine[c*3+a]+=(this.transport==='divergence-conforming'&&a===c?3:4)/this.cellSize**2*e.weight*value*e.r[a];}
      for(let c=0;c<3;c++)afterMomentum[c]+=rho*p.volume*velocity[c];
      const courant=Math.hypot(...velocity)*dt/this.cellSize;this.last.courant=Math.max(this.last.courant,courant);if(courant>.5)throw Error('Crest displacement CFL exceeds .5');
      let advected=velocity;
      if(this.transport==='divergence-conforming'){
        const sample=this.sampleTransport(p.position);this.last.interpolatedDivergence=Math.max(this.last.interpolatedDivergence,Math.abs(sample.divergence));
        // Midpoint characteristics reduce volume drift from Euler's trajectory
        // map. The projected velocity is frozen over this substep; gravity is
        // still the same SI grid impulse and the velocity momentum book is intact.
        const midpoint=p.position.map((v,c)=>v+.5*dt*velocity[c]) as CrestVec3;
        const middle=this.sampleTransport(midpoint);advected=middle.velocity;
        this.last.interpolatedDivergence=Math.max(this.last.interpolatedDivergence,Math.abs(middle.divergence));
        const actualCourant=Math.hypot(...advected)*dt/this.cellSize;this.last.courant=Math.max(this.last.courant,actualCourant);
        if(actualCourant>.5)throw Error('Crest midpoint displacement CFL exceeds .5');
      }
      const trace=this.transport==='flux-cell'?this.traceFluxCells(p.position,dt):null;
      if(trace){this.last.courant=Math.max(this.last.courant,trace.maximumSpeed*dt/this.cellSize);this.last.interpolatedDivergence=Math.max(this.last.interpolatedDivergence,trace.maximumDivergence);if(trace.maximumSpeed*dt/this.cellSize>.5)throw Error('Crest characteristic CFL exceeds .5');}
      const position=trace?trace.position:p.position.map((v,c)=>v+advected[c]*dt) as CrestVec3;
      const displacement=position.map((v,c)=>v-p.position[c]),momentum=velocity.map(v=>v*rho*p.volume);
      for(let c=0;c<3;c++)this.angularDefect[c]+=displacement[(c+1)%3]*momentum[(c+2)%3]-displacement[(c+2)%3]*momentum[(c+1)%3];
      // Swept exit packets retain position at the crossing and full material
      // volume/vector momentum. They do not silently become thin water.
      let crossing=trace?.exit?trace.exit.elapsed/dt:Infinity,boundary:CrestExit['boundary']=trace?.exit?.boundary??'downstream';
      const candidates:{axis:number;plane:number;positive:boolean;boundary:CrestExit['boundary']}[]=[{axis:0,plane:this.outletX,positive:true,boundary:'downstream'},{axis:1,plane:this.outletY,positive:false,boundary:'bottom'},{axis:0,plane:this.inletX,positive:false,boundary:'upstream'},{axis:2,plane:this.origin[2]+1.6*this.cellSize,positive:false,boundary:'side'},{axis:2,plane:this.origin[2]+this.cells[2]*this.cellSize-1.6*this.cellSize,positive:true,boundary:'side'}];
      if(!trace)for(const candidate of candidates)if(candidate.positive?position[candidate.axis]>=candidate.plane:position[candidate.axis]<=candidate.plane){const fraction=(candidate.plane-p.position[candidate.axis])/(position[candidate.axis]-p.position[candidate.axis]);if(fraction>=0&&fraction<=1&&fraction<crossing){crossing=fraction;boundary=candidate.boundary;}}
      if(Number.isFinite(crossing)) {if(this.exits.length>=this.maximumParticles)throw Error('Crest exit queue capacity exceeded; collect exported packets');const exit:CrestExit={id:p.id,sourceId:p.sourceId,birth:p.birth,volume:p.volume,position:trace?[...position]:p.position.map((v,c)=>v+crossing*(position[c]-v)) as CrestVec3,velocity:[...velocity],time:start+crossing*dt,boundary,releaseReason:'domain-exit',phase:'post-kick-drift',kickStartTime:start,kickEndTime:end,remainingDriftTime:Math.max(0,(1-crossing)*dt),transportGradient:trace?.gradient??this.sampleTransport(p.position.map((v,c)=>v+crossing*(position[c]-v)) as CrestVec3).gradient,gradientDefinition:'frozen-exit-transport'};this.exits.push(exit);this.exitCount++;this.exitedVolume+=p.volume;addInto(this.exitedMomentum,velocity.map(v=>v*rho*p.volume) as CrestVec3);continue;}
      if(position[0]<this.lipX) {
        // Collision is at the physical plane (1e-8 cell numerical clearance),
        // independent of particle quadrature. It is not a marker-radius wall.
        const minimum=this.crest-this.channelDepth+this.cellSize*1e-8;
        if(position[1]<minimum){position[1]=minimum;this.collisionImpulse[1]-=rho*p.volume*velocity[1];velocity[1]=0;}
        const zmax=this.channelWidth/2-this.cellSize*1e-8;if(Math.abs(position[2])>zmax){position[2]=Math.sign(position[2])*zmax;this.collisionImpulse[2]-=rho*p.volume*velocity[2];velocity[2]=0;}
      }
      if(![...position,...velocity,...affine].every(Number.isFinite))throw Error('Nonfinite crest particle state');
      surviving.push({...p,position,velocity,affine});
    }
    const gridMomentum=vec();this.eachFace((f,c)=>{gridMomentum[c]+=this.faceMass[f]*this.field[f];});for(let c=0;c<3;c++)this.transferError[c]+=afterMomentum[c]-gridMomentum[c];
    this.particles=surviving;if(source)this.emit(start,end,source);
    // Occupancy belongs to the returned material state. Pressure still belongs
    // to the preceding solve; do not rebuild its row map during projection.
    this.last.fluidCells=this.markCells({start,end}).length;this.last.maxFraction=this.fractions.reduce((a,b)=>Math.max(a,b),0);
    this.last.ms=performance.now()-began;
  }
  advanceTo(time:number) {
    if(!Number.isFinite(time)||time<this.tick*this.dt-1e-10)throw Error('Crest clock cannot seek backward');if(this.failure)throw Error(this.failure);
    const target=Math.floor((time+1e-10)/this.dt);
    try{while(this.tick<target){
      const old={residue:this.residue,residueAdmissions:this.residueAdmissions,residueRejoins:this.residueRejoins,particles:this.particles,exits:this.exits.length,exitCount:this.exitCount,nextId:this.nextId,cursor:this.sampleCursor,emitted:this.emittedVolume,exited:this.exitedVolume,field:this.field.slice(),pressure:this.pressure.slice(),fractions:this.fractions.slice(),surfaceDensity:this.surfaceDensity.slice(),depositedDensity:this.depositedDensity.slice(),last:{...this.last},vectors:[this.sourceMomentum,this.exitedMomentum,this.gravityImpulse,this.boundaryImpulse,this.pressureImpulse,this.collisionImpulse,this.transferError,this.extensionImpulse,this.solenoidalImpulse,this.angularDefect].map(v=>[...v] as CrestVec3)};
      try{let at=this.tick*this.dt,end=(this.tick+1)*this.dt;const cuts=this.events.filter(e=>e.time>at+1e-12&&e.time<end-1e-12).map(e=>e.time).concat(end);for(const cut of cuts){this.step(at,cut);at=cut;}this.tick++;}
      catch(error){this.residue=old.residue;this.residueAdmissions=old.residueAdmissions;this.residueRejoins=old.residueRejoins;this.particles=old.particles;this.exits.length=old.exits;this.exitCount=old.exitCount;this.nextId=old.nextId;this.sampleCursor=old.cursor;this.emittedVolume=old.emitted;this.exitedVolume=old.exited;this.field.set(old.field);this.pressure.set(old.pressure);this.fractions.set(old.fractions);this.surfaceDensity.set(old.surfaceDensity);this.depositedDensity.set(old.depositedDensity);this.last=old.last;[this.sourceMomentum,this.exitedMomentum,this.gravityImpulse,this.boundaryImpulse,this.pressureImpulse,this.collisionImpulse,this.transferError,this.extensionImpulse,this.solenoidalImpulse,this.angularDefect]=old.vectors;throw error;}
    }}
    catch(error){this.failure=String(error);throw error;}
  }
  receipt():CrestReceipt {
    const material=this.particles.concat(this.residue),residentVolume=material.reduce((s,p)=>s+p.volume,0),residentMomentum=vec();for(const p of material)addInto(residentMomentum,p.velocity.map(v=>v*rho*p.volume) as CrestVec3);
    const momentumBudgetError=residentMomentum.map((v,c)=>v+this.exitedMomentum[c]-this.initialMomentum[c]-this.sourceMomentum[c]-this.gravityImpulse[c]-this.boundaryImpulse[c]-this.pressureImpulse[c]-this.extensionImpulse[c]-this.solenoidalImpulse[c]-this.collisionImpulse[c]-this.transferError[c]) as CrestVec3;
    return{bedResidueParticles:this.residue.length,bedResidueVolume:this.residue.reduce((v,p)=>v+p.volume,0),bedResidueMomentum:[0,1,2].map(c=>this.residue.reduce((v,p)=>v+rho*p.volume*p.velocity[c],0)) as CrestVec3,bedResidueAdmissions:this.residueAdmissions,bedResidueRejoins:this.residueRejoins,time:this.tick*this.dt,initialVolume:this.initialVolume,emittedVolume:this.emittedVolume,residentVolume,exitedVolume:this.exitedVolume,budgetError:residentVolume+this.exitedVolume-this.initialVolume-this.emittedVolume,initialMomentum:[...this.initialMomentum],sourceMomentum:[...this.sourceMomentum],residentMomentum,exitedMomentum:[...this.exitedMomentum],gravityImpulse:[...this.gravityImpulse],gridBoundaryImpulse:[...this.boundaryImpulse],pressureImpulse:[...this.pressureImpulse],pressureExtensionImpulse:[...this.extensionImpulse],collisionImpulse:[...this.collisionImpulse],transferMomentumError:[...this.transferError],momentumBudgetError,particles:this.particles.length,exits:this.exitCount,exitPacketsPending:this.exits.length,fluidCells:this.last.fluidCells,maximumVolumeFraction:this.last.maxFraction,markedCellVolume:this.last.fluidCells*this.cellSize**3,maximumDivergence:this.last.divergence,relativeResidual:this.last.residual,iterations:this.last.iterations,maximumCourant:this.last.courant,sourceEdits:this.events.length,lastStepMilliseconds:this.last.ms,failure:this.failure,occupancyTime:this.tick*this.dt,particlesPerCellAxis:this.particlesPerCellAxis,transport:this.transport,pressureSurface:this.pressureSurface,surfaceSupport:this.surfaceSupport,surfaceThreshold:.5,depositedVolume:this.depositedDensity.reduce((v,d)=>v+d*this.cellSize**3,0),depositedNonSolidVolume:this.depositedDensity.reduce((v,d,i)=>v+(this.solid[i]?0:d*this.cellSize**3),0),correctedDensityVolume:this.surfaceDensity.reduce((v,d)=>v+d*this.cellSize**3,0),inletPressureArea:this.last.inletArea,inletPressureFlux:this.last.inletFlux,surfaceOccupiedVolume:this.last.fluidCells*this.cellSize**3,transportAngularDefect:[...this.angularDefect],maximumInterpolatedDivergence:this.last.interpolatedDivergence,solenoidalExtensionImpulse:[...this.solenoidalImpulse],extensionResidual:this.last.extensionResidual,extensionIterations:this.last.extensionIterations,extensionCells:this.last.extensionCells};
  }
  /** One-time export, not automatic thin-phase admission. Cumulative exit volume
   * and momentum stay in the ledger after the bounded pending queue is drained. */
  takeExitedPackets():CrestExit[] {const packets=this.exits.map(p=>({...p,transportGradient:p.transportGradient?.slice(),position:[...p.position] as CrestVec3,velocity:[...p.velocity] as CrestVec3}));this.exits=[];return packets;}
  snapshot():CrestSnapshot {
    const copy=(p:CrestParticle):CrestParticle=>({id:p.id,sourceId:p.sourceId,birth:p.birth,volume:p.volume,position:[...p.position],velocity:[...p.velocity]});
    return{bedResidue:this.residue.map(p=>({...copy(p),phase:'bed-residue-kinetic' as const})),particles:this.particles.map(copy),exits:this.exits.map(p=>({...p,...copy(p),transportGradient:p.transportGradient?.slice()})),volumeFraction:this.fractions.slice(),surfaceDensity:this.surfaceDensity.slice(),depositedDensity:this.depositedDensity.slice(),pressure:this.pressure.slice(),u:this.field.slice(0,this.offsets[1]),v:this.field.slice(this.offsets[1],this.offsets[2]),w:this.field.slice(this.offsets[2]),receipt:this.receipt(),origin:[...this.origin],cells:[...this.cells],cellSize:this.cellSize};
  }
}
