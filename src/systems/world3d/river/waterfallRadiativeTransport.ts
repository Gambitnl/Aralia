/**
 * Computes light inside one frozen waterfall density field for optical proof.
 * Ballistic light and scattered light are separate, so first scattering is
 * never added twice. This prototype does not update fluid mass, trajectories,
 * the production fall, or downstream water. Its angular and spatial mixing
 * must pass refinement comparisons before it can support realism claims.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/10/2026, 08:07:47
 * Dependents: components/World3D/water/waterfallRadiativeTransport.worker.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export type RteVector = readonly [number, number, number];
/** Irradiance is measured on a plane perpendicular to propagationDirection.
 * Visibility is actual opaque transmission at each incoming face cell; the
 * adapter must include measured cliff solar bounce in boundary radiance.
 * This optional beam never replaces the existing diffuse boundary arrays. */
export interface RteSolarInput {
  propagationDirection: RteVector; irradiance: RteVector;
  visibility: readonly (Float32Array | Float64Array)[];
  signature: string; visibilitySignature: string; bounceSignature: string;
}
export interface RtePhase { directions: readonly RteVector[]; matrix: Float64Array; g: number; maximumMomentError: number; maximumVectorMomentError:number; maximumTensorMomentError:number; }
export interface RteGrid {
  size: readonly [number,number,number]; spacing: RteVector;
  scattering: Float32Array | Float64Array; absorption: Float32Array | Float64Array;
  /** Six actual incident-radiance faces: x−,x+,y−,y+,z−,z+.
   * Each face stores (face cell, angular bin, RGB), with its first remaining
   * coordinate changing fastest. Zero means a genuinely dark incident face. */
  boundary: readonly (Float32Array | Float64Array)[];
  solar?: RteSolarInput;
}
export function validateRteVector(v:RteVector,name='RTE vector'):void{if(v.length!==3||v.some(x=>!Number.isFinite(x)))throw new Error(name+' must contain three finite coordinates');}
export function validateRteRun(maximumSweeps:number,tolerance:number):void{if(!Number.isInteger(maximumSweeps)||maximumSweeps<=0||!Number.isFinite(tolerance)||tolerance<=0||tolerance>=1)throw new Error('RTE cap must be a positive finite integer and tolerance must lie in (0,1)');}
const normalize=(v:RteVector):RteVector=>{validateRteVector(v,'Angular direction');const n=Math.hypot(...v);if(n<1e-12)throw new Error('Angular direction has zero length');return[v[0]/n,v[1]/n,v[2]/n];};
const dot=(a:RteVector,b:RteVector)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const p2=(v:number)=>(3*v*v-1)/2;
export function rteDirections(count:12|24):readonly RteVector[]{
  if(count!==12&&count!==24)throw new Error('RTE angular count must be 12 or 24');
  if(count===12){const golden=(1+Math.sqrt(5))/2;return[-1,1].flatMap(a=>[-1,1].flatMap(b=>[[0,a,b*golden],[a,b*golden,0],[b*golden,0,a]] as RteVector[])).map(normalize);}
  const large=1+Math.sqrt(2), result:RteVector[]=[];
  for(let axis=0;axis<3;axis++)for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){const v:[number,number,number]=[x,y,z];v[axis]*=large;result.push(normalize(v));}
  return result;
}
/** Positive reciprocal angular bins. The first two HG moments are imposed
 * on the discrete bins, rather than evaluating an unresolved forward peak
 * and silently changing its anisotropy. Higher moments remain approximate.
 * Equal weights and rotational symmetry make both row and column sums one. */
export function createRtePhase(g:number,count:12|24=12):RtePhase {
  if(!(g>=0&&g<=1))throw new Error('RTE phase needs 0 <= g <= 1');
  const directions=rteDirections(count),matrix=new Float64Array(count*count);
  if(g===1){for(let d=0;d<count;d++)matrix[d*count+d]=1;return{directions,matrix,g,maximumMomentError:0,maximumVectorMomentError:0,maximumTensorMomentError:0};}
  if(count===12){
    const a=1/Math.sqrt(5),s=(g*g+.2)/1.2;
    // The equal-area spherical-cap back bin supplies the remaining degree
    // of freedom. It approximates the true pentagonal bin; its effect must
    // be compared to 24 bins, not called an exact HG angular distribution.
    const back=g<1e-7?1/12:(1-g*g)/(2*g)*(1/Math.sqrt(1+g*g+5*g/3)-1/(1+g));
    const difference=(g-s+2*back)/a,forward=(1-s+difference)/2,reverse=(1-s-difference)/2;
    if(Math.min(back,s-back,forward,reverse)<-1e-12)throw new Error('12-bin moment constraints are infeasible');
    for(let d=0;d<count;d++)for(let e=0;e<count;e++){const mu=dot(directions[d],directions[e]);matrix[d*count+e]=mu>.99?s-back:mu<-.99?back:mu>0?forward/5:reverse/5;}
  }else{
    // Fit a positive HG-based kernel to its two target moments. This is
    // angular quadrature calibration only; no solved light is rescaled.
    const mu=directions.map(v=>dot(directions[0],v)),base=mu.map(v=>Math.log((1-g*g)/Math.pow(1+g*g-2*g*v,1.5)));
    let l1=0,l2=0,weights:number[]=[];
    const evaluate=(a:number,b:number)=>{
      const logs=mu.map((v,k)=>base[k]+a*v+b*p2(v)),maximum=Math.max(...logs),values=logs.map(v=>Math.exp(v-maximum)),sum=values.reduce((x,y)=>x+y,0);
      const probabilities=values.map(v=>v/sum);let m1=0,m2=0,h11=0,h12=0,h22=0;
      probabilities.forEach((w,k)=>{const x=mu[k],y=p2(x);m1+=w*x;m2+=w*y;h11+=w*x*x;h12+=w*x*y;h22+=w*y*y;});
      return{probabilities,m1,m2,h11:h11-m1*m1,h12:h12-m1*m2,h22:h22-m2*m2};
    };
    let valid=false;
    for(let iteration=0;iteration<100;iteration++){
      const q=evaluate(l1,l2),r1=q.m1-g,r2=q.m2-g*g;weights=q.probabilities;
      if(Math.max(Math.abs(r1),Math.abs(r2))<1e-11){valid=true;break;}
      const determinant=q.h11*q.h22-q.h12*q.h12;if(determinant<1e-20)break;
      const dl1=(q.h22*r1-q.h12*r2)/determinant,dl2=(q.h11*r2-q.h12*r1)/determinant;
      let scale=1;for(;scale>1e-8;scale*=.5){const n=evaluate(l1-scale*dl1,l2-scale*dl2);if(Math.hypot(n.m1-g,n.m2-g*g)<Math.hypot(r1,r2))break;}
      l1-=scale*dl1;l2-=scale*dl2;
    }
    if(!valid)throw new Error('24-bin positive phase moment fit did not converge');
    for(let d=0;d<count;d++)for(let e=0;e<count;e++){
      const value=dot(directions[d],directions[e]),index=mu.findIndex(v=>Math.abs(v-value)<1e-9);if(index<0)throw new Error('Angular orbit does not share a reciprocal kernel');matrix[d*count+e]=weights[index];
    }
  }
  let error=0;
  for(let d=0;d<count;d++){let row=0,column=0,m1=0,m2=0;for(let e=0;e<count;e++){const v=matrix[d*count+e],mu=dot(directions[d],directions[e]);row+=v;column+=matrix[e*count+d];m1+=v*mu;m2+=v*p2(mu);if(v<0)throw new Error('Negative phase probability');}error=Math.max(error,Math.abs(row-1),Math.abs(column-1),Math.abs(m1-g),Math.abs(m2-g*g));}
  let vectorError=0,tensorError=0;
  for(let d=0;d<count;d++)for(let a=0;a<3;a++){
    let vector=0;for(let e=0;e<count;e++)vector+=matrix[d*count+e]*directions[e][a];vectorError=Math.max(vectorError,Math.abs(vector-g*directions[d][a]));
    for(let b=0;b<3;b++){let tensor=0;for(let e=0;e<count;e++)tensor+=matrix[d*count+e]*directions[e][a]*directions[e][b];tensorError=Math.max(tensorError,Math.abs(tensor-(g*g*directions[d][a]*directions[d][b]+(a===b?(1-g*g)/3:0))));}
  }
  if(error>1e-9)throw new Error('Discrete phase failed its scalar energy/moment gate');return{directions,matrix,g,maximumMomentError:error,maximumVectorMomentError:vectorError,maximumTensorMomentError:tensorError};
}

// Cell light accounting
// A cell mixes its incoming face fluxes, then solves that constant-source
// chord analytically. The collision average, not an opaque midpoint, seeds
// scattering. Incoming power minus outgoing power exactly equals extinction
// of that average. Mixing faces is spatial numerical diffusion; refinement
// tests must quantify it around ribbons, gaps and thick-cell boundaries.
export function rteCellKernel(tau:number){
  if(!(tau>=0))throw new Error('Optical depth must be nonnegative');
  if(tau<1e-5){const average=1-tau/2+tau*tau/6-tau*tau*tau/24;return{decay:Math.exp(-tau),average,redirected:tau/2-tau*tau/6+tau*tau*tau/24};}
  const average=-Math.expm1(-tau)/tau;return{decay:Math.exp(-tau),average,redirected:1-average};
}
export function rteUniformBoundary(size:RteGrid['size'],directions:number,radiance:RteVector){
  const [x,y,z]=size;return[y*z,y*z,x*z,x*z,x*y,x*y].map(cells=>{const face=new Float64Array(cells*directions*3);for(let i=0;i<face.length;i++)face[i]=radiance[i%3];return face;});
}
/** Native SUN.rgb is one-bounce radiance per unit solar irradiance, including
 * measured albedo, surface cosine/pi and opaque shadow visibility. Add it
 * once to the sky radiance; SUN.a belongs only in solar.visibility. Sampling
 * native cache directions and actual face positions is the adapter's job. */
export function rteBoundaryWithSolarBounce(sky:readonly (Float32Array|Float64Array)[],bounce:readonly (Float32Array|Float64Array)[],irradiance:RteVector):Float64Array[] {
  validateRteVector(irradiance,'Solar irradiance');if(irradiance.some(v=>v<0)||sky.length!==6||bounce.length!==6)throw new Error('Solar bounce requires six native radiance faces and nonnegative irradiance');
  return sky.map((face,k)=>{
    if(face.length%3!==0||bounce[k].length!==face.length)throw new Error('Solar bounce face storage mismatch');
    return Float64Array.from(face,(value,i)=>{const transfer=bounce[k][i];if(!Number.isFinite(value)||value<0||!Number.isFinite(transfer)||transfer<0)throw new Error('Invalid native sky/bounce radiance');const result=value+transfer*irradiance[i%3];if(!Number.isFinite(result))throw new Error('Solar bounce radiance overflow');return result;});
  });
}
export function rteHenyeyGreenstein(g:number,mu:number):number {
  if(!Number.isFinite(g)||g<0||g>=1||!Number.isFinite(mu)||Math.abs(mu)>1+1e-12)throw new Error('Continuous solar phase needs finite 0 <= g < 1 and a cosine');
  return (1-g*g)/(4*Math.PI*Math.pow(1+g*g-2*g*Math.max(-1,Math.min(1,mu)),1.5));
}
/** Integrate HG probability into nearest-direction Voronoi bins using a
 * bounded deterministic equal-probability quadrature. Normalization is exact;
 * angular integration and the bin-center moments are explicitly approximate.
 * The unscattered solar delta is never stored in these bins. */
export function createRteSolarProjection(phase:RtePhase,propagation:RteVector){
  if(phase.g>=1)throw new Error('Solar diagnostic cannot resolve a forward delta phase');
  const b=normalize(propagation),reference:RteVector=Math.abs(b[2])<.9?[0,0,1]:[0,1,0];
  const cross=(a:RteVector,c:RteVector):RteVector=>[a[1]*c[2]-a[2]*c[1],a[2]*c[0]-a[0]*c[2],a[0]*c[1]-a[1]*c[0]];
  const u=normalize(cross(reference,b)),v=cross(b,u),samples=8192,weights=new Float64Array(phase.directions.length),g=phase.g;
  for(let k=0;k<samples;k++){
    const t=(k+.5)/samples,mu=g<1e-8?2*t-1:(1+g*g-Math.pow((1-g*g)/(1-g+2*g*t),2))/(2*g),radius=Math.sqrt(Math.max(0,1-mu*mu)),phi=k*Math.PI*(3-Math.sqrt(5));
    const direction=b.map((component,a)=>component*mu+radius*(u[a]*Math.cos(phi)+v[a]*Math.sin(phi))) as unknown as RteVector;
    let best=0,maximum=-Infinity;phase.directions.forEach((d,index)=>{const value=dot(d,direction);if(value>maximum){maximum=value;best=index;}});weights[best]+=1/samples;
  }
  let vectorError=0,tensorError=0;
  for(let a=0;a<3;a++){
    const moment=phase.directions.reduce((sum,d,k)=>sum+weights[k]*d[a],0);vectorError=Math.max(vectorError,Math.abs(moment-g*b[a]));
    for(let c=0;c<3;c++){const second=phase.directions.reduce((sum,d,k)=>sum+weights[k]*d[a]*d[c],0);tensorError=Math.max(tensorError,Math.abs(second-(g*g*b[a]*b[c]+(a===c?(1-g*g)/3:0))));}
  }
  return{weights,samples,vectorError,tensorError};
}
export interface RteSolarReceipt {
  signature:string;visibilitySignature:string;bounceSignature:string;
  propagationDirection:RteVector;irradiance:RteVector;
  incoming:RteVector;outgoing:RteVector;absorbed:RteVector;scattered:RteVector;
  relativePowerError:number;diffuseRelativePowerError:number;
  projectionSamples:number;projectionVectorMomentError:number;projectionTensorMomentError:number;
}
/** One continuous-direction mixed-face sweep, not an angular-bin beam.
 * Irradiance has no solid-angle factor. The analytic cell average makes
 * outgoing + absorbed + scattered equal incoming for every cell. */
class SolarBeam {
  readonly mean:Float64Array;readonly out:Float64Array;
  readonly direction:RteVector;readonly rates:RteVector;readonly projection:ReturnType<typeof createRteSolarProjection>;
  readonly stream:number;
  constructor(readonly grid:RteGrid,readonly input:RteSolarInput,phase:RtePhase){
    this.direction=normalize(input.propagationDirection);validateRteVector(input.irradiance,'Solar irradiance');
    if(Math.abs(Math.hypot(...input.propagationDirection)-1)>1e-8||input.irradiance.some(x=>x<0)||!input.signature||!input.visibilitySignature||!input.bounceSignature)throw new Error('Solar beam needs a unit propagation direction, nonnegative irradiance and native visibility/bounce signatures');
    const [nx,ny,nz]=grid.size,faces=[ny*nz,ny*nz,nx*nz,nx*nz,nx*ny,nx*ny];
    if(input.visibility.length!==6)throw new Error('Solar visibility requires six actual faces');
    input.visibility.forEach((face,k)=>{if(face.length!==faces[k]||face.some(x=>!Number.isFinite(x)||x<0||x>1))throw new Error('Solar face visibility storage/range mismatch');});
    this.projection=createRteSolarProjection(phase,this.direction);this.rates=this.direction.map((v,a)=>Math.abs(v)/grid.spacing[a]) as unknown as RteVector;this.stream=this.rates.reduce((a,b)=>a+b,0);
    this.mean=new Float64Array(nx*ny*nz*3);this.out=new Float64Array(this.mean.length);
    for(let iz=0;iz<nz;iz++)for(let iy=0;iy<ny;iy++)for(let ix=0;ix<nx;ix++){
      const x=this.direction[0]>=0?ix:nx-1-ix,y=this.direction[1]>=0?iy:ny-1-iy,z=this.direction[2]>=0?iz:nz-1-iz,cell=x+nx*(y+ny*z);
      for(let c=0;c<3;c++){const entry=this.entry(x,y,z,c),kernel=rteCellKernel((grid.scattering[cell]+grid.absorption[cell*3+c])/this.stream);this.mean[cell*3+c]=kernel.average*entry;this.out[cell*3+c]=kernel.decay*entry;}
    }
  }
  faceCell(x:number,y:number,z:number,axis:number){const [nx,ny]=this.grid.size;return axis===0?y+ny*z:axis===1?x+nx*z:x+nx*y;}
  entry(x:number,y:number,z:number,c:number){
    const coordinates=[x,y,z],[nx,ny]=this.grid.size,strides=[1,nx,nx*ny],cell=x+nx*(y+ny*z);let sum=0;
    for(let a=0;a<3;a++){
      if(!this.rates[a])continue;const positive=this.direction[a]>0,edge=positive?coordinates[a]===0:coordinates[a]===this.grid.size[a]-1;
      const value=edge?this.input.irradiance[c]*this.input.visibility[a*2+Number(!positive)][this.faceCell(x,y,z,a)]:this.out[(cell+(positive?-1:1)*strides[a])*3+c];sum+=this.rates[a]*value;
    }return sum/this.stream;
  }
  source(cell:number,d:number,c:number){return this.mean[cell*3+c]*this.projection.weights[d]/(4*Math.PI/this.projection.weights.length);}
  diagnose():Omit<RteSolarReceipt,'diffuseRelativePowerError'>{
    const incoming=[0,0,0],outgoing=[0,0,0],absorbed=[0,0,0],scattered=[0,0,0],volume=this.grid.spacing.reduce((a,b)=>a*b,1),[nx,ny,nz]=this.grid.size;
    for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
      const cell=x+nx*(y+ny*z),coordinates=[x,y,z];for(let c=0;c<3;c++){
        absorbed[c]+=this.grid.absorption[cell*3+c]*this.mean[cell*3+c]*volume;scattered[c]+=this.grid.scattering[cell]*this.mean[cell*3+c]*volume;
        for(let a=0;a<3;a++){const positive=this.direction[a]>0;if(positive?coordinates[a]===0:coordinates[a]===this.grid.size[a]-1)incoming[c]+=this.rates[a]*volume*this.input.irradiance[c]*this.input.visibility[a*2+Number(!positive)][this.faceCell(x,y,z,a)];if(positive?coordinates[a]===this.grid.size[a]-1:coordinates[a]===0)outgoing[c]+=this.rates[a]*volume*this.out[cell*3+c];}
      }
    }
    return{signature:this.input.signature,visibilitySignature:this.input.visibilitySignature,bounceSignature:this.input.bounceSignature,propagationDirection:this.direction,irradiance:this.input.irradiance,incoming:incoming as unknown as RteVector,outgoing:outgoing as unknown as RteVector,absorbed:absorbed as unknown as RteVector,scattered:scattered as unknown as RteVector,relativePowerError:Math.max(...incoming.map((v,c)=>Math.abs(v-outgoing[c]-absorbed[c]-scattered[c])/Math.max(v,1e-30))),projectionSamples:this.projection.samples,projectionVectorMomentError:this.projection.vectorError,projectionTensorMomentError:this.projection.tensorError};
  }
}
export interface RteReceipt {
  ready:boolean;capped:boolean;sweeps:number;equationResidual:number;relativePowerError:number;
  incoming:RteVector;outgoing:RteVector;absorbed:RteVector;minimumRadiance:number;maximumRadiance:number;
  cpuMs:number;bytes:number;directions:number;cells:number;phaseMomentError:number;phaseVectorMomentError:number;phaseTensorMomentError:number;approximation:string;
  solar?:RteSolarReceipt;
}
export class FrozenWaterfallRte {
  readonly ballisticMean:Float64Array;readonly ballisticOut:Float64Array;readonly scatteredMean:Float64Array;readonly scatteredOut:Float64Array;
  private readonly average:Float64Array;private readonly decay:Float64Array;private readonly omega:Float64Array;
  private readonly streaming:Float64Array;private readonly strides:readonly number[];
  private sweeps=0;private cpuMs=0;private capped=false;private report:RteReceipt|null=null;
  readonly cells:number;readonly directions:number;
  private readonly solarBeam?:SolarBeam;
  /** Inspect beam irradiance separately; it is never duplicated in ballisticMean. */
  get solarMean():Float64Array|undefined{return this.solarBeam?.mean;}
  get solarOut():Float64Array|undefined{return this.solarBeam?.out;}
  constructor(readonly grid:RteGrid,readonly phase:RtePhase){
    if(grid.size.length!==3||grid.size.some(v=>!Number.isInteger(v)||v<=0))throw new Error('RTE cell counts must be three positive integers');
    const start=performance.now(),[nx,ny,nz]=grid.size;this.cells=nx*ny*nz;this.directions=phase.directions.length;this.strides=[1,nx,nx*ny];
    if(grid.scattering.length!==this.cells||grid.absorption.length!==this.cells*3||grid.boundary.length!==6||grid.spacing.length!==3||grid.spacing.some(v=>!Number.isFinite(v)||v<=0))throw new Error('RTE grid dimensions/coefficient storage mismatch');
    grid.scattering.forEach(v=>{if(!Number.isFinite(v)||v<0)throw new Error('Invalid scattering');});grid.absorption.forEach(v=>{if(!Number.isFinite(v)||v<0)throw new Error('Invalid absorption');});
    const faces=[ny*nz,ny*nz,nx*nz,nx*nz,nx*ny,nx*ny];grid.boundary.forEach((face,k)=>{if(face.length!==faces[k]*this.directions*3)throw new Error('Boundary face storage mismatch');face.forEach(v=>{if(!Number.isFinite(v)||v<0)throw new Error('Invalid incident radiance');});});
    const length=this.cells*this.directions*3;
    this.ballisticMean=new Float64Array(length);this.ballisticOut=new Float64Array(length);this.scatteredMean=new Float64Array(length);this.scatteredOut=new Float64Array(length);
    this.average=new Float64Array(length);this.decay=new Float64Array(length);this.omega=new Float64Array(length);this.streaming=new Float64Array(this.directions*3);
    phase.directions.forEach((direction,d)=>{for(let axis=0;axis<3;axis++)this.streaming[d*3+axis]=Math.abs(direction[axis])/grid.spacing[axis];});
    for(let cell=0;cell<this.cells;cell++)for(let d=0;d<this.directions;d++)for(let c=0;c<3;c++){
      const index=(cell*this.directions+d)*3+c,total=grid.scattering[cell]+grid.absorption[cell*3+c],stream=this.stream(d),kernel=rteCellKernel(total/stream);
      this.average[index]=kernel.average;this.decay[index]=kernel.decay;this.omega[index]=total>0?grid.scattering[cell]/total:0;
    }
    this.sweepBallistic();if(grid.solar)this.solarBeam=new SolarBeam(grid,grid.solar,phase);this.cpuMs+=performance.now()-start;
  }
  private stream(d:number){return this.streaming[d*3]+this.streaming[d*3+1]+this.streaming[d*3+2];}
  private boundaryIndex(x:number,y:number,z:number,axis:number,d:number,c:number){const [nx,ny]=this.grid.size,faceCell=axis===0?y+ny*z:axis===1?x+nx*z:x+nx*y;return(faceCell*this.directions+d)*3+c;}
  private incoming(array:Float64Array,x:number,y:number,z:number,d:number,c:number,ballistic:boolean){
    const coordinates=[x,y,z],cell=x+this.grid.size[0]*(y+this.grid.size[1]*z),direction=this.phase.directions[d];let value=0;
    for(let axis=0;axis<3;axis++){
      const rate=this.streaming[d*3+axis];if(!rate)continue;const positive=direction[axis]>0,inBoundary=positive?coordinates[axis]===0:coordinates[axis]===this.grid.size[axis]-1;
      const incident=inBoundary?(ballistic?this.grid.boundary[axis*2+Number(!positive)][this.boundaryIndex(x,y,z,axis,d,c)]:0):array[((cell+(positive?-1:1)*this.strides[axis])*this.directions+d)*3+c];value+=rate*incident;
    }
    return value/this.stream(d);
  }
  private visit(d:number,body:(cell:number,x:number,y:number,z:number)=>void){
    const [nx,ny,nz]=this.grid.size,dir=this.phase.directions[d];
    for(let iz=0;iz<nz;iz++){const z=dir[2]>=0?iz:nz-1-iz;for(let iy=0;iy<ny;iy++){const y=dir[1]>=0?iy:ny-1-iy;for(let ix=0;ix<nx;ix++){const x=dir[0]>=0?ix:nx-1-ix;body(x+nx*(y+ny*z),x,y,z);}}}
  }
  private sweepBallistic(){for(let d=0;d<this.directions;d++)this.visit(d,(cell,x,y,z)=>{for(let c=0;c<3;c++){const index=(cell*this.directions+d)*3+c,incoming=this.incoming(this.ballisticOut,x,y,z,d,c,true);this.ballisticMean[index]=this.average[index]*incoming;this.ballisticOut[index]=this.decay[index]*incoming;}});}
  /** Positive source iteration with its same-bin collision solved locally.
   * This removes forward-peak stiffness without reducing the ballistic beam
   * extinction. Caps never masquerade as convergence. */
  sweep(count=1):void{
    if(!Number.isInteger(count)||count<=0)throw new Error('RTE sweep count must be a positive finite integer');
    const start=performance.now();
    for(let iteration=0;iteration<count;iteration++){
      for(let d=0;d<this.directions;d++)this.visit(d,(cell,x,y,z)=>{
        const diagonal=this.phase.matrix[d*this.directions+d];
        for(let c=0;c<3;c++){
          const index=(cell*this.directions+d)*3+c,a=this.average[index],omega=this.omega[index],incoming=this.incoming(this.scatteredOut,x,y,z,d,c,false);let ballistic=0,off=0;
          for(let e=0;e<this.directions;e++){const weight=this.phase.matrix[d*this.directions+e],other=(cell*this.directions+e)*3+c;ballistic+=weight*this.ballisticMean[other];if(e!==d)off+=weight*this.scatteredMean[other];}
          if(this.solarBeam)ballistic+=this.solarBeam.source(cell,d,c);
          // Algebraically 1-omega*(1-a)*diagonal, written without subtracting
          // nearly equal values in the conservative forward/thick limit.
          const total=this.grid.scattering[cell]+this.grid.absorption[cell*3+c],absorptionFraction=total>0?this.grid.absorption[cell*3+c]/total:1;
          const tau=total/this.stream(d),redirected=tau<1e-5?rteCellKernel(tau).redirected:1-a;
          const removed=tau<1e-5?-Math.expm1(-tau):1-this.decay[index];
          const denominator=(1-diagonal)+diagonal*(absorptionFraction+omega*a);
          const mean=(a*incoming+omega*redirected*(ballistic+off))/denominator;
          this.scatteredMean[index]=mean;
          this.scatteredOut[index]=this.decay[index]*incoming+omega*removed*(ballistic+off+diagonal*mean);
        }
      });this.sweeps++;
    }
    this.cpuMs+=performance.now()-start;this.report=null;
  }
  /** Camera source is incident radiance AFTER angular redistribution, without
   * an extra sigma factor. Existing full-extinction camera segment weights
   * supply sigma_s/sigma_t. Nearest angular bin is an explicit coarse view
   * approximation; production needs angular/camera convergence evidence. */
  cameraSource(directionAt:(cell:number)=>RteVector):Float32Array{
    const output=new Float32Array(this.cells*3);
    for(let cell=0;cell<this.cells;cell++){
      const direction=normalize(directionAt(cell));let best=0,bestDot=-Infinity;
      this.phase.directions.forEach((d,k)=>{const value=dot(d,direction);if(value>bestDot){bestDot=value;best=k;}});
      for(let c=0;c<3;c++)for(let e=0;e<this.directions;e++){const index=(cell*this.directions+e)*3+c;output[cell*3+c]+=this.phase.matrix[best*this.directions+e]*(this.ballisticMean[index]+this.scatteredMean[index]);}
      // First solar scattering uses the continuous camera direction. Adding
      // the projected-bin source here as well would count it twice. Existing
      // camera segment weights supply sigma_s/sigma_t exactly once.
      if(this.solarBeam){const phase=rteHenyeyGreenstein(this.phase.g,dot(this.solarBeam.direction,direction));for(let c=0;c<3;c++)output[cell*3+c]+=this.solarBeam.mean[cell*3+c]*phase;}
    }
    return output;
  }
  diagnose(tolerance=1e-6):RteReceipt{
    const start=performance.now(),incoming=[0,0,0],outgoing=[0,0,0],absorbed=[0,0,0],weight=4*Math.PI/this.directions,volume=this.grid.spacing.reduce((a,b)=>a*b,1);
    let maximumError=0,maximumScale=0,minimum=Infinity,maximum=0;
    for(let z=0;z<this.grid.size[2];z++)for(let y=0;y<this.grid.size[1];y++)for(let x=0;x<this.grid.size[0];x++){
      const cell=x+this.grid.size[0]*(y+this.grid.size[1]*z),coordinates=[x,y,z];
      for(let d=0;d<this.directions;d++)for(let c=0;c<3;c++){
        const index=(cell*this.directions+d)*3+c,mean=this.ballisticMean[index]+this.scatteredMean[index],exit=this.ballisticOut[index]+this.scatteredOut[index],entry=this.incoming(this.ballisticOut,x,y,z,d,c,true)+this.incoming(this.scatteredOut,x,y,z,d,c,false);let redistributed=0;
        for(let e=0;e<this.directions;e++){const other=(cell*this.directions+e)*3+c;redistributed+=this.phase.matrix[d*this.directions+e]*(this.ballisticMean[other]+this.scatteredMean[other]);}
        if(this.solarBeam)redistributed+=this.solarBeam.source(cell,d,c);
        const total=this.grid.scattering[cell]+this.grid.absorption[cell*3+c],error=this.stream(d)*(exit-entry)+this.grid.absorption[cell*3+c]*mean+this.grid.scattering[cell]*(mean-redistributed);
        maximumError=Math.max(maximumError,Math.abs(error));maximumScale=Math.max(maximumScale,this.stream(d)*entry,total*mean,this.grid.scattering[cell]*redistributed);minimum=Math.min(minimum,mean,exit);maximum=Math.max(maximum,mean,exit);
        absorbed[c]+=this.grid.absorption[cell*3+c]*mean*volume*weight;
        for(let axis=0;axis<3;axis++){
          const component=this.phase.directions[d][axis];if(!component)continue;const rate=this.streaming[d*3+axis],positive=component>0;
          if(positive?coordinates[axis]===0:coordinates[axis]===this.grid.size[axis]-1)incoming[c]+=this.grid.boundary[axis*2+Number(!positive)][this.boundaryIndex(x,y,z,axis,d,c)]*rate*volume*weight;
          if(positive?coordinates[axis]===this.grid.size[axis]-1:coordinates[axis]===0)outgoing[c]+=exit*rate*volume*weight;
        }
      }
    }
    let solar:RteSolarReceipt|undefined;
    if(this.solarBeam){
      const beam=this.solarBeam.diagnose(),diffuseRelativePowerError=Math.max(...incoming.map((v,c)=>Math.abs(v+beam.scattered[c]-outgoing[c]-absorbed[c])/Math.max(v+beam.scattered[c],1e-30)));
      solar={...beam,diffuseRelativePowerError};for(let c=0;c<3;c++){incoming[c]+=beam.incoming[c];outgoing[c]+=beam.outgoing[c];absorbed[c]+=beam.absorbed[c];}
    }
    const equationResidual=maximumError/Math.max(maximumScale,1e-30),relativePowerError=Math.max(...incoming.map((v,c)=>Math.abs(v-outgoing[c]-absorbed[c])/Math.max(v,1e-30)));
    this.cpuMs+=performance.now()-start;
    const ready=equationResidual<=tolerance&&relativePowerError<=tolerance&&minimum>=0&&Number.isFinite(maximum)&&(!solar||(solar.relativePowerError<=tolerance&&solar.diffuseRelativePowerError<=tolerance));
    this.report={ready,capped:this.capped,sweeps:this.sweeps,equationResidual,relativePowerError,incoming:incoming as unknown as RteVector,outgoing:outgoing as unknown as RteVector,absorbed:absorbed as unknown as RteVector,minimumRadiance:minimum,maximumRadiance:maximum,cpuMs:this.cpuMs,bytes:[this.ballisticMean,this.ballisticOut,this.scatteredMean,this.scatteredOut,this.average,this.decay,this.omega,this.streaming,this.phase.matrix,this.grid.scattering,this.grid.absorption,...this.grid.boundary].reduce((s,a)=>s+a.byteLength,0),directions:this.directions,cells:this.cells,phaseMomentError:this.phase.maximumMomentError,phaseVectorMomentError:this.phase.maximumVectorMomentError,phaseTensorMomentError:this.phase.maximumTensorMomentError,approximation:'frozen Cartesian mixed-face step characteristics; scalar moment-fitted angular bins; vector/tensor errors and refinement reported'};
    if(solar&&this.solarBeam){this.report.solar=solar;this.report.bytes+=this.solarBeam.mean.byteLength+this.solarBeam.out.byteLength+this.solarBeam.projection.weights.byteLength+this.grid.solar!.visibility.reduce((sum,face)=>sum+face.byteLength,0);this.report.approximation+='; continuous full-extinction solar beam with mixed-face spatial diffusion; sampled positive HG bin projection; analytic camera first scatter and nearest-bin secondary scatter';}
    return this.report;
  }
  solve(maximumSweeps:number,tolerance=1e-6):RteReceipt{
    validateRteRun(maximumSweeps,tolerance);
    let receipt=this.diagnose(tolerance);
    while(!receipt.ready&&this.sweeps<maximumSweeps){this.sweep(Math.min(8,maximumSweeps-this.sweeps));receipt=this.diagnose(tolerance);}
    this.capped=!receipt.ready;return{...receipt,capped:this.capped};
  }
}
