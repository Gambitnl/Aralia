/**
 * Keeps one bounded sheet's material and optical surface on the renderer's GPU.
 * Every step iterates a mass-relaxed implicit membrane residual in private trial
 * buffers. This is not the paper's Newton solve or a line-search minimizer. Only
 * a converged, physically guarded trial replaces accepted water; failure leaves
 * the original buffers intact. A compact receipt is the only CPU readback.
 *
 * This preparation has no film adapter or general collision/remeshing engine.
 * It cannot be installed as a live waterfall until those ownership and boundary
 * seams have been reviewed. The supplied device is reused; no renderer is made.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 11/10/2026, 05:43:40
 * Dependents: None (Orphan)
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { WATER_REACH_LAW, validateReachMesh, validateReachMaterialConnectivity, validateReachBoundaryInput, requireQualifiedReachInterface, type ReachLaw, type ReachMesh, type ReachAdmission, type ReachAtomicOwner, type ReachBoundaryInput } from './waterfallMaterialReach';

export interface ReachGpuOptions {
  initialTime?:number;
  nodeCapacity?:number;
  faceCapacity?:number;
  indexCapacity?:number;
  /** Bounded nonlinear iteration count, not a claim of convergence. */
  maximumIterations: number;
  relativeMomentumResidual: number;
  absoluteMomentumResidual: number;
  maximumThicknessEdgeRatio: number;
  minimumTriangleQuality: number;
  /** Stop BEFORE this unsupported downstream contact plane. No pool adoption. */
  stopBelowY: number;
  maximumIndependentVolumeError: number;
  maximumNumericalEnergyLossFraction: number;
}
export interface ReachGpuReceipt {
  accepted: boolean;
  failureBits: number;
  maximumMomentumResidual: number;
  ownedVolume: number;
  renderedVolume: number;
  independentVolumeError: number;
  initialEnergy: number;
  finalEnergy: number;
  physicalViscousLoss: number;
  numericalEnergyLossSigned: number;
  momentum: [number,number,number];
  gravityImpulse: [number,number,number];
  cutImpulse:[number,number,number];
  driveImpulse:[number,number,number];
  cutWork:number;
  driveWork:number;
  externalWork:number;
  /** Input only; this is NOT added again to a post-insertion evolution step. */
  declaredSurfaceEnergyAdvection:number;
  measuredSurfaceEnergyAdvection:number;
  momentumError:[number,number,number];
  iterations: number;
  /** Full workload timing belongs to the parent; CPU submission is insufficient. */
  runtimeQualified: false;
  integrationQualified:false;
  /** Signed closed-surface volume is measured, but overlapping solids have not
   * been qualified as a union. It cannot pass the independent occupied-volume
   * gate, including when the reported arithmetic error is below one percent. */
  independentVolumeQualified:false;
}
export interface ReachGpuDelta {
  /** Node IDs are explicit. Existing IDs receive mass/momentum; new IDs also
   * carry birth position. Entries are unique and new IDs are consecutive. */
  nodes:{id:number;position:[number,number,number];mass:number;momentum:[number,number,number]}[];
  faces:{nodes:[number,number,number];volume:number}[];
  /** Complete current closed topology, made from actual wet-edge incidence. */
  closedIndices:Uint32Array;
  surfaceInsertion?:{timeStart:number;timeEnd:number;surfaceEnergyAdvection:number};
}
export interface ReachSurfaceInsertionReceipt {createdSurfaceEnergy:number;declaredSurfaceEnergyAdvection:number|null;surfaceEnergyError:number|null;timeStart:number|null;timeEnd:number|null}

// Failure bits retain the actual cause. None authorize deleting water or
// thickening the optical surface until it can pass its volume measurement.
export const REACH_FAILURE = { invalidGeometry:1, thinLimit:2, unsupportedContact:4, convergence:8, independentVolume:16, numericalEnergy:32, selfIntersection:64, inletBoundary:128 } as const;

export const materialReachWGSL = /* wgsl */`
struct Node { x:vec4<f32>, v:vec4<f32> };
struct Face { ids:vec3<u32>, volume:f32 };
struct Params { count:u32, faces:u32, indices:u32, iterations:u32,
 dt:f32, rho:f32, sigma:f32, mu:f32, gravity:vec4<f32>,
 relativeResidual:f32, absoluteResidual:f32, maxThin:f32, minQuality:f32,
 stopY:f32, volumeTolerance:f32, energyTolerance:f32, pad:f32, boundary:vec4<u32>,cutMotion:vec4<f32> };
@group(0) @binding(0) var<uniform> p:Params;
@group(0) @binding(1) var<storage,read_write> base:array<Node>;
@group(0) @binding(2) var<storage,read> current:array<Node>;
@group(0) @binding(3) var<storage,read_write> next:array<Node>;
@group(0) @binding(4) var<storage,read> faces:array<Face>;
@group(0) @binding(5) var<storage,read_write> surface:array<vec4<f32>>;
@group(0) @binding(6) var<storage,read_write> report:array<f32>;
@group(0) @binding(7) var<storage,read> indices:array<u32>;
@group(0) @binding(8) var<storage,read> adjacency:array<u32>;
struct Geometry { area:f32, normal:vec3<f32>, g0:vec3<f32>,g1:vec3<f32>,g2:vec3<f32>, longest:f32, shortest:f32 };
fn geometry(a:vec3<f32>,b:vec3<f32>,c:vec3<f32>)->Geometry {
 let raw=cross(b-a,c-a);let twice=length(raw);let n=raw/twice;
 return Geometry(twice*.5,n,cross(n,c-b)/twice,cross(n,a-c)/twice,cross(n,b-a)/twice,
 max(length(b-a),max(length(c-b),length(a-c))),min(length(b-a),min(length(c-b),length(a-c))));
}
fn gradient(g:Geometry,k:u32)->vec3<f32>{if(k==0u){return g.g0;}if(k==1u){return g.g1;}return g.g2;}
fn finite(v:f32)->bool{return v==v&&abs(v)<3.402823e38;}
fn finite3(v:vec3<f32>)->bool{return finite(v.x)&&finite(v.y)&&finite(v.z);}
struct Force { f:vec3<f32>, bound:f32 };
fn cutForce(i:u32)->vec3<f32>{let offset=p.boundary.x+i*16u;return vec3<f32>(bitcast<f32>(adjacency[offset]),bitcast<f32>(adjacency[offset+1u]),bitcast<f32>(adjacency[offset+2u]));}
fn constrained(i:u32)->bool{return adjacency[p.boundary.x+i*16u+3u]!=0u;}
fn prescribed(i:u32)->vec3<f32>{let offset=p.boundary.x+i*16u+4u;return vec3<f32>(bitcast<f32>(adjacency[offset]),bitcast<f32>(adjacency[offset+1u]),bitcast<f32>(adjacency[offset+2u]));}
fn validBoundary(i:u32)->bool{
 let offset=p.boundary.x+i*16u;if(adjacency[offset+7u]==0u){return true;}
 let anchor=vec3<f32>(bitcast<f32>(adjacency[offset+8u]),bitcast<f32>(adjacency[offset+9u]),bitcast<f32>(adjacency[offset+10u]));
 // Eight float32 ulps bound only upload arithmetic, not inlet reconstruction.
 if(length(base[i].x.xyz-anchor)>8.*1.1920928955078125e-7*max(1.,length(anchor))){return false;}
 var expected=vec3<f32>(0.);
 for(var incident=0u;incident<adjacency[i*2u+1u];incident++){
  let f=faces[adjacency[adjacency[i*2u]+incident]];let a=base[f.ids.x].x.xyz;let b=base[f.ids.y].x.xyz;let c=base[f.ids.z].x.xyz;let g=geometry(a,b,c);
  for(var k=0u;k<3u;k++){let u=f.ids[k];let v=f.ids[(k+1u)%3u];if(u!=i&&v!=i){continue;}let other=select(u,v,u==i);
   if(other+1u!=adjacency[offset+14u]&&other+1u!=adjacency[offset+15u]){continue;}
   let edge=base[v].x.xyz-base[u].x.xyz;expected+=p.sigma*length(edge)*cross(normalize(edge),g.normal);
  }
 }
 return finite3(expected)&&length(expected-cutForce(i))<=8.*1.1920928955078125e-7*max(1.,length(expected));
}
fn force(i:u32)->Force {
 var f=base[i].x.w*p.gravity.xyz+cutForce(i);var bound=0.;
 for(var incident=0u;incident<adjacency[i*2u+1u];incident++){
  let j=adjacency[adjacency[i*2u]+incident];
  let face=faces[j];var local=3u;for(var k=0u;k<3u;k++){if(face.ids[k]==i){local=k;}}
  if(local==3u){continue;}
  let a=current[face.ids.x];let b=current[face.ids.y];let c=current[face.ids.z];
  let g=geometry(a.x.xyz,b.x.xyz,c.x.xyz);let gi=gradient(g,local);
  let t1=normalize(b.x.xyz-a.x.xyz);let t2=cross(g.normal,t1);
  let u0=vec2<f32>(dot(a.v.xyz,t1),dot(a.v.xyz,t2));
  let u1=vec2<f32>(dot(b.v.xyz,t1),dot(b.v.xyz,t2));
  let u2=vec2<f32>(dot(c.v.xyz,t1),dot(c.v.xyz,t2));
  let q0=vec2<f32>(dot(g.g0,t1),dot(g.g0,t2));let q1=vec2<f32>(dot(g.g1,t1),dot(g.g1,t2));let q2=vec2<f32>(dot(g.g2,t1),dot(g.g2,t2));
  let l0=u0*q0.x+u1*q1.x+u2*q2.x;let l1=u0*q0.y+u1*q1.y+u2*q2.y;
  let d01=.5*(l0.y+l1.x);let tr=l0.x+l1.y;let factor=2.*p.mu*face.volume/g.area;
  let n00=factor*(l0.x+tr);let n01=factor*d01;let n11=factor*(l1.y+tr);
  let qi=vec2<f32>(dot(gi,t1),dot(gi,t2));
  f+=-2.*p.sigma*g.area*gi-g.area*((n00*qi.x+n01*qi.y)*t1+(n01*qi.x+n11*qi.y)*t2);
  // A local mass-scaled relaxation bound controls the nonlinear solver, not
  // physical time. The final implicit momentum residual must still converge.
  let sumGrad=dot(g.g0,g.g0)+dot(g.g1,g.g1)+dot(g.g2,g.g2);
  bound+=p.dt*p.dt*8.*p.sigma*g.longest*g.longest/g.area + p.dt*8.*p.mu*face.volume*sumGrad;
 }
 return Force(f,bound);
}
@compute @workgroup_size(64) fn iterate(@builtin(global_invocation_id) id:vec3<u32>){
 let i=id.x;if(i>=p.count){return;}let initial=base[i];let f=force(i);
 let residual=initial.x.w*(current[i].v.xyz-initial.v.xyz)-p.dt*f.f;
 let relaxation=initial.x.w/(initial.x.w+f.bound);
 var velocity=current[i].v.xyz-relaxation*residual/initial.x.w;
 if(constrained(i)){velocity=prescribed(i);}
 next[i]=Node(vec4<f32>(initial.x.xyz+p.dt*velocity,initial.x.w),vec4<f32>(velocity,0.));
}
@compute @workgroup_size(64) fn reconstruct(@builtin(global_invocation_id) id:vec3<u32>){
 let i=id.x;if(i>=p.count){return;}var normal=vec3<f32>(0.);var area=0.;
 for(var incident=0u;incident<adjacency[i*2u+1u];incident++){let j=adjacency[adjacency[i*2u]+incident];let f=faces[j];let g=geometry(current[f.ids.x].x.xyz,current[f.ids.y].x.xyz,current[f.ids.z].x.xyz);normal+=g.area*g.normal;area+=g.area/3.;}
 let thickness=current[i].x.w/(p.rho*area);let offset=.5*thickness*normalize(normal);
 surface[i*2u]=vec4<f32>(current[i].x.xyz+offset,thickness);
 surface[i*2u+1u]=vec4<f32>(current[i].x.xyz-offset,thickness);
}
fn triangleHit(a:vec3<f32>,b:vec3<f32>,x:vec3<f32>,y:vec3<f32>,z:vec3<f32>)->bool {
 let direction=b-a;let e1=y-x;let e2=z-x;let h=cross(direction,e2);let determinant=dot(e1,h);
 if(abs(determinant)<1e-12){return false;}let inv=1./determinant;let s=a-x;let u=dot(s,h)*inv;if(u<0.||u>1.){return false;}
 let q=cross(s,e1);let v=dot(direction,q)*inv;if(v<0.||u+v>1.){return false;}let t=dot(e2,q)*inv;return t>0.&&t<1.;
}
@compute @workgroup_size(1) fn audit(){
 var bits=0u;var maximum=0.;var mass=0.;var oldEnergy=0.;var newEnergy=0.;var owned=0.;var viscous=0.;var momentum=vec3<f32>(0.);var oldMomentum=vec3<f32>(0.);var cutImpulse=vec3<f32>(0.);var driveImpulse=vec3<f32>(0.);var cutWork=0.;var driveWork=0.;
 for(var i=0u;i<p.count;i++){
  let a=base[i];let b=current[i];let f=force(i);let r=a.x.w*(b.v.xyz-a.v.xyz)-p.dt*f.f;
  let scale=p.absoluteResidual+p.relativeResidual*max(length(a.x.w*a.v.xyz),length(p.dt*f.f));
  if(constrained(i)){driveImpulse+=r;driveWork+=dot(r,b.v.xyz);}else{maximum=max(maximum,length(r)/scale);}
  let cut=cutForce(i);cutImpulse+=p.dt*cut;cutWork+=dot(cut,b.x.xyz-a.x.xyz);
  mass+=a.x.w;momentum+=b.x.w*b.v.xyz;oldMomentum+=a.x.w*a.v.xyz;
  oldEnergy+=.5*a.x.w*dot(a.v.xyz,a.v.xyz)-a.x.w*dot(p.gravity.xyz,a.x.xyz-vec3<f32>(0.,p.stopY,0.));
  newEnergy+=.5*b.x.w*dot(b.v.xyz,b.v.xyz)-b.x.w*dot(p.gravity.xyz,b.x.xyz-vec3<f32>(0.,p.stopY,0.));
  if(!finite3(b.x.xyz)||!finite3(b.v.xyz)||!finite3(surface[2u*i].xyz)||!finite3(surface[2u*i+1u].xyz)){bits|=1u;}
  if(!validBoundary(i)){bits|=128u;}
  if(min(surface[2u*i].y,surface[2u*i+1u].y)<=p.stopY){bits|=4u;}
 }
 for(var j=0u;j<p.faces;j++){
  let f=faces[j];let a=current[f.ids.x];let b=current[f.ids.y];let c=current[f.ids.z];let g=geometry(a.x.xyz,b.x.xyz,c.x.xyz);
  let old=geometry(base[f.ids.x].x.xyz,base[f.ids.y].x.xyz,base[f.ids.z].x.xyz);owned+=f.volume;
  oldEnergy+=2.*p.sigma*old.area;newEnergy+=2.*p.sigma*g.area;
  if(!finite(g.area)||g.area<=0.||g.area/(g.longest*g.longest)<p.minQuality){bits|=1u;}
  let thickness=f.volume/g.area;if(!finite(thickness)||thickness<=0.||thickness/g.shortest>p.maxThin){bits|=2u;}
  let t1=normalize(b.x.xyz-a.x.xyz);let t2=cross(g.normal,t1);
  let q0=vec2<f32>(dot(g.g0,t1),dot(g.g0,t2));let q1=vec2<f32>(dot(g.g1,t1),dot(g.g1,t2));let q2=vec2<f32>(dot(g.g2,t1),dot(g.g2,t2));
  let u0=vec2<f32>(dot(a.v.xyz,t1),dot(a.v.xyz,t2));let u1=vec2<f32>(dot(b.v.xyz,t1),dot(b.v.xyz,t2));let u2=vec2<f32>(dot(c.v.xyz,t1),dot(c.v.xyz,t2));
  let l0=u0*q0.x+u1*q1.x+u2*q2.x;let l1=u0*q0.y+u1*q1.y+u2*q2.y;let d01=.5*(l0.y+l1.x);let tr=l0.x+l1.y;
  viscous+=p.dt*2.*p.mu*f.volume*(l0.x*l0.x+l1.y*l1.y+2.*d01*d01+tr*tr);
  // DEBT: This detects nonparallel crossings of disjoint midsurface faces only.
  // Coplanar overlap, adjacent folding and offset-surface intersection remain
  // unqualified. The receipt therefore NEVER qualifies independent union volume
  // or native integration, even if this arithmetic guard returns no failure.
  for(var k=j+1u;k<p.faces;k++){let other=faces[k];if(any(other.ids==vec3<u32>(f.ids.x))||any(other.ids==vec3<u32>(f.ids.y))||any(other.ids==vec3<u32>(f.ids.z))){continue;}
   let x=current[other.ids.x].x.xyz;let y=current[other.ids.y].x.xyz;let z=current[other.ids.z].x.xyz;
   if(triangleHit(a.x.xyz,b.x.xyz,x,y,z)||triangleHit(b.x.xyz,c.x.xyz,x,y,z)||triangleHit(c.x.xyz,a.x.xyz,x,y,z)||triangleHit(x,y,a.x.xyz,b.x.xyz,c.x.xyz)||triangleHit(y,z,a.x.xyz,b.x.xyz,c.x.xyz)||triangleHit(z,x,a.x.xyz,b.x.xyz,c.x.xyz)){bits|=64u;}
  }
 }
 var volume=0.;let origin=surface[0].xyz;
 for(var k=0u;k<p.indices;k+=3u){let a=surface[indices[k]].xyz-origin;let b=surface[indices[k+1u]].xyz-origin;let c=surface[indices[k+2u]].xyz-origin;volume+=dot(a,cross(b,c))/6.;}
 volume=abs(volume);let error=abs(volume-owned)/owned;
 let externalWork=cutWork+driveWork;let numeric=oldEnergy+externalWork-newEnergy-viscous;
 let surfaceAdvection=-cutWork+dot(cutImpulse,p.cutMotion.xyz);
 if(!finite(surfaceAdvection)||abs(surfaceAdvection-p.cutMotion.w)>8.*1.1920928955078125e-7*max(1.,abs(surfaceAdvection))){bits|=128u;}
 if(!finite(maximum)||maximum>1.){bits|=8u;}if(!finite(error)||error>p.volumeTolerance){bits|=16u;}
 if(!finite(numeric)||!finite(externalWork)||abs(numeric)>p.energyTolerance*(oldEnergy+max(externalWork,0.))){bits|=32u;}
 report[0]=f32(bits);report[1]=maximum;report[2]=owned;report[3]=volume;report[4]=error;
 report[5]=oldEnergy;report[6]=newEnergy;report[7]=viscous;report[8]=numeric;
 report[9]=momentum.x;report[10]=momentum.y;report[11]=momentum.z;
 report[12]=p.dt*mass*p.gravity.x;report[13]=p.dt*mass*p.gravity.y;report[14]=p.dt*mass*p.gravity.z;
 report[16]=cutImpulse.x;report[17]=cutImpulse.y;report[18]=cutImpulse.z;
 report[19]=driveImpulse.x;report[20]=driveImpulse.y;report[21]=driveImpulse.z;
 report[22]=cutWork;report[23]=driveWork;report[24]=externalWork;
 let momentumError=momentum-oldMomentum-p.dt*mass*p.gravity.xyz-cutImpulse-driveImpulse;
 report[25]=momentumError.x;report[26]=momentumError.y;report[27]=momentumError.z;
 report[29]=surfaceAdvection;
}
@compute @workgroup_size(64) fn commit(@builtin(global_invocation_id) id:vec3<u32>){let i=id.x;if(i<p.count&&report[0]==0.){base[i]=current[i];}}
@compute @workgroup_size(64) fn append(@builtin(global_invocation_id) id:vec3<u32>){let k=id.x;if(k>=p.iterations){return;}let incoming=next[k];let i=u32(incoming.v.w);
 if(i>=u32(p.pad)){base[i]=Node(incoming.x,vec4<f32>(incoming.v.xyz/incoming.x.w,0.));next[k].x.x=0.;return;}
 let old=base[i];let mass=old.x.w+incoming.x.w;let velocity=(old.x.w*old.v.xyz+incoming.v.xyz)/mass;
 let loss=.5*old.x.w*dot(old.v.xyz,old.v.xyz)+.5*dot(incoming.v.xyz,incoming.v.xyz)/incoming.x.w-.5*mass*dot(velocity,velocity);
 base[i]=Node(vec4<f32>(old.x.xyz,mass),vec4<f32>(velocity,0.));next[k].x.x=loss;
}
@compute @workgroup_size(1) fn appendAudit(){var loss=0.;for(var k=0u;k<p.iterations;k++){loss+=next[k].x.x;}report[15]=loss;
 var created=0.;var invalid=0.;for(var j=p.boundary.z;j<p.faces;j++){let f=faces[j];let g=geometry(base[f.ids.x].x.xyz,base[f.ids.y].x.xyz,base[f.ids.z].x.xyz);if(!finite(g.area)||g.area<=0.){invalid=1.;}created+=2.*p.sigma*g.area;}report[28]=created;report[30]=invalid;
}
`;

/** Fixed connectivity is supplied once by the actual film adapter. Capacity is
 * exact and checked against the shared device's real limits before allocation.
 * Mesh/node data on CPU is discarded after upload; subsequent state is resident.
 */
export class WaterfallMaterialReachGpu {
  readonly nodes:GPUBuffer;
  readonly surface:GPUBuffer;
  readonly indices:GPUBuffer;
  indexCount:number;
  nodeCount:number;
  faceCount:number;
  readonly peakBytes:number;
  private readonly buffers:GPUBuffer[]=[];
  private readonly params:GPUBuffer;
  private readonly trialA:GPUBuffer;
  private readonly trialB:GPUBuffer;
  private readonly trialSurface:GPUBuffer;
  private readonly faces:GPUBuffer;
  private readonly adjacency:GPUBuffer;
  private readonly faceConnectivity:[number,number,number][];
  private readonly trialIndices:GPUBuffer;
  private solverIndexCount:number;
  private readonly report:GPUBuffer;
  private readonly readback:GPUBuffer;
  private readonly checkpoint:GPUBuffer;
  private readonly checkpointSurface:GPUBuffer;
  private readonly checkpointIndices:GPUBuffer;
  private readonly pipelines:Record<'iterate'|'reconstruct'|'audit'|'commit'|'append'|'appendAudit',GPUComputePipeline>;
  private readonly groups:[GPUBindGroup,GPUBindGroup];
  private pending=false;
  private failed=false;
  private readonly module:GPUShaderModule;
  private readonly nodeCapacity:number;
  private readonly faceCapacity:number;
  private readonly indexCapacity:number;
  private readonly boundaryOffset:number;
  private boundaryInput:ReachBoundaryInput|null=null;
  private boundaryConsumed=true;
  private physicalTime:number;
  private lastReceipt:ReachGpuReceipt|null=null;
  private lastInsertion:ReachSurfaceInsertionReceipt|null=null;
  private epoch:{id:string;nodes:number;faces:number;indices:number;solverIndices:number;failed:boolean;validated:boolean;boundary:ReachBoundaryInput|null;boundaryConsumed:boolean;time:number;receipt:ReachGpuReceipt|null;insertion:ReachSurfaceInsertionReceipt|null}|null=null;
  constructor(readonly device:GPUDevice, mesh:ReachMesh, readonly options:ReachGpuOptions, readonly law:ReachLaw=WATER_REACH_LAW) {
    const topology=validateReachMesh(mesh,law);
    // The growing inlet has changing mass and a nonuniform thickness field.
    // This fixed-mass kernel cannot interpret that state by silently discarding
    // its source weights. The inlet assembly must be coupled before upload.
    if(mesh.faces.some(face=>face.cornerMass))throw Error('Source-weighted inlet requires coupled open-system evolution and thickness reconstruction');
    if(!Number.isSafeInteger(options.maximumIterations)||options.maximumIterations<1||options.relativeMomentumResidual<=0||options.absoluteMomentumResidual<=0||options.maximumThicknessEdgeRatio<=0||options.minimumTriangleQuality<=0||options.maximumIndependentVolumeError<=0||options.maximumIndependentVolumeError>.01||options.maximumNumericalEnergyLossFraction<=0||options.maximumNumericalEnergyLossFraction>.05||!Object.values(options).every(Number.isFinite))throw Error('Undeclared reach integration guards');
    if(!(law.density>0)||law.surfaceTension<0||law.dynamicViscosity<0||![law.density,law.surfaceTension,law.dynamicViscosity,...law.gravity].every(Number.isFinite))throw Error('Invalid reach law');
    this.nodeCount=mesh.nodes.length;this.faceCount=mesh.faces.length;
    this.physicalTime=options.initialTime??0;
    const closed:number[]=[];
    for(const f of mesh.faces){const [a,b,c]=f.nodes;closed.push(a*2,b*2,c*2,c*2+1,b*2+1,a*2+1);}
    for(const [a,b]of topology.boundaryEdges)closed.push(a*2,a*2+1,b*2,b*2,a*2+1,b*2+1);
    this.indexCount=closed.length;
    this.solverIndexCount=this.indexCount;
    this.nodeCapacity=options.nodeCapacity??this.nodeCount;this.faceCapacity=options.faceCapacity??this.faceCount;this.indexCapacity=options.indexCapacity??this.indexCount;
    if(![this.nodeCapacity,this.faceCapacity,this.indexCapacity].every(Number.isSafeInteger)||this.nodeCapacity<this.nodeCount||this.faceCapacity<this.faceCount||this.indexCapacity<this.indexCount)throw Error('Insufficient declared reach capacity');
    // The diagnostic pair audit is intentionally small and quadratic. A larger
    // native reach needs a reviewed GPU spatial guard, not an unbounded kernel.
    if(this.faceCapacity>256)throw Error('Preparation pair audit supports at most 256 material faces');
    this.faceConnectivity=mesh.faces.map(f=>[...f.nodes] as [number,number,number]);
    const make=(name:string,size:number,usage:number)=>{if(size>device.limits.maxBufferSize||((usage&GPUBufferUsage.STORAGE)!==0&&size>device.limits.maxStorageBufferBindingSize))throw Error(`Reach ${name} exceeds shared GPU limits`);const b=device.createBuffer({label:`material-reach:${name}`,size,usage});this.buffers.push(b);return b;};
    const storage=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST;
    this.nodes=make('accepted material',this.nodeCapacity*32,storage);this.trialA=make('trial A',this.nodeCapacity*32,storage);this.trialB=make('trial B',this.nodeCapacity*32,storage);this.checkpoint=make('ownership checkpoint',this.nodeCapacity*32,storage);
    this.faces=make('owned faces',this.faceCapacity*16,storage);this.surface=make('closed optical surface',this.nodeCapacity*32,storage|GPUBufferUsage.VERTEX);this.trialSurface=make('private trial optical surface',this.nodeCapacity*32,storage);this.indices=make('closed optical indices',this.indexCapacity*4,storage|GPUBufferUsage.INDEX);this.trialIndices=make('private trial optical indices',this.indexCapacity*4,storage);this.checkpointSurface=make('optical epoch checkpoint',this.nodeCapacity*32,storage);this.checkpointIndices=make('index epoch checkpoint',this.indexCapacity*4,storage);
    this.report=make('compact audit',128,storage);this.readback=make('compact readback',128,GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST);this.params=make('physical parameters',112,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST);
    this.boundaryOffset=this.nodeCapacity*2+this.faceCapacity*3;
    this.adjacency=make('bounded node face adjacency',(this.boundaryOffset+this.nodeCapacity*16)*4,storage);
    this.peakBytes=this.nodeCapacity*32*7+this.faceCapacity*16+this.indexCapacity*12+368+(this.boundaryOffset+this.nodeCapacity*16)*4;
    const initial=new Float32Array(this.nodeCount*8);mesh.nodes.forEach((n,i)=>initial.set([...n.position,n.mass,...n.velocity,0],i*8));
    const faceData=new ArrayBuffer(this.faceCount*16),faceInts=new Uint32Array(faceData),faceFloats=new Float32Array(faceData);mesh.faces.forEach((f,i)=>{faceInts.set(f.nodes,i*4);faceFloats[i*4+3]=f.volume;});
    device.queue.writeBuffer(this.nodes,0,initial);device.queue.writeBuffer(this.faces,0,faceData);device.queue.writeBuffer(this.indices,0,new Uint32Array(closed));device.queue.writeBuffer(this.trialIndices,0,new Uint32Array(closed));
    this.writeAdjacency();
    this.module=device.createShaderModule({label:'material-reach:implicit membrane',code:materialReachWGSL});
    const layout=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:'uniform'}},...[1,2,3,4,5,6,7,8].map(binding=>({binding,visibility:GPUShaderStage.COMPUTE,buffer:{type:([2,4,7,8].includes(binding)?'read-only-storage':'storage') as GPUBufferBindingType}}))]});
    const pipelineLayout=device.createPipelineLayout({bindGroupLayouts:[layout]});
    this.pipelines=Object.fromEntries(['iterate','reconstruct','audit','commit','append','appendAudit'].map(entryPoint=>[entryPoint,device.createComputePipeline({label:`material-reach:${entryPoint}`,layout:pipelineLayout,compute:{module:this.module,entryPoint}})])) as typeof this.pipelines;
    const group=(current:GPUBuffer,next:GPUBuffer)=>device.createBindGroup({layout,entries:[this.params,this.nodes,current,next,this.faces,this.trialSurface,this.report,this.trialIndices,this.adjacency].map((buffer,binding)=>({binding,resource:{buffer}}))});
    this.groups=[group(this.trialA,this.trialB),group(this.trialB,this.trialA)];
    this.indexCount=0;
  }
  private writeAdjacency():void {
    const incident:number[][]=Array.from({length:this.nodeCapacity},()=>[]);this.faceConnectivity.forEach((ids,face)=>ids.forEach(i=>incident[i].push(face)));
    const data=new Uint32Array(this.boundaryOffset+this.nodeCapacity*16),floats=new Float32Array(data.buffer);let cursor=this.nodeCapacity*2;
    incident.forEach((faces,i)=>{data[i*2]=cursor;data[i*2+1]=faces.length;data.set(faces,cursor);cursor+=faces.length;});
    for(const node of this.boundaryInput?.nodes??[]){const offset=this.boundaryOffset+node.id*16;floats.set(node.cutForce,offset);data[offset+3]=node.prescribedVelocity?1:0;if(node.prescribedVelocity)floats.set(node.prescribedVelocity,offset+4);}
    const neighbors=new Map<number,number[]>();
    for(const segment of this.boundaryInput?.cutSegments??[])for(let k=0;k<2;k++){const id=segment.nodeIds[k],offset=this.boundaryOffset+id*16;data[offset+7]=1;floats.set(k===0?segment.start:segment.end,offset+8);const list=neighbors.get(id)??[];list.push(segment.nodeIds[1-k]);neighbors.set(id,list);}
    for(const [id,list]of neighbors){const offset=this.boundaryOffset+id*16;list.forEach((n,k)=>data[offset+14+k]=n+1);}
    this.device.queue.writeBuffer(this.adjacency,0,data);
  }
  async checkCompilation():Promise<void>{const info=await this.module.getCompilationInfo();const errors=info.messages.filter(m=>m.type==='error');if(errors.length)throw Error(errors.map(m=>`${m.lineNum}:${m.linePos} ${m.message}`).join('\n'));}

  /** Film ticks and later river health checks share this epoch. GPU checkpoints
   * include material and published geometry; restoring the film alone would
   * otherwise leave the same water owned twice. No state is copied to CPU.
   */
  beginEpoch(id:string):void {
    if(!id||this.epoch||this.pending||this.failed)throw Error('Cannot begin reach ownership epoch');
    this.epoch={id,nodes:this.nodeCount,faces:this.faceCount,indices:this.indexCount,solverIndices:this.solverIndexCount,failed:this.failed,validated:false,boundary:structuredClone(this.boundaryInput),boundaryConsumed:this.boundaryConsumed,time:this.physicalTime,receipt:structuredClone(this.lastReceipt),insertion:structuredClone(this.lastInsertion)};
    const e=this.device.createCommandEncoder();e.copyBufferToBuffer(this.nodes,0,this.checkpoint,0,this.nodeCount*32);e.copyBufferToBuffer(this.surface,0,this.checkpointSurface,0,this.nodeCount*32);e.copyBufferToBuffer(this.trialIndices,0,this.checkpointIndices,0,this.solverIndexCount*4);this.device.queue.submit([e.finish()]);
  }
  commitEpoch(id:string):void {if(this.pending||!this.epoch||this.epoch.id!==id||this.failed||!this.epoch.validated)throw Error('Cannot acknowledge unaccepted reach epoch');this.publishSurface();this.epoch=null;}
  private publishSurface():void {
    const publish=this.device.createCommandEncoder();publish.copyBufferToBuffer(this.trialSurface,0,this.surface,0,this.nodeCount*32);publish.copyBufferToBuffer(this.trialIndices,0,this.indices,0,this.solverIndexCount*4);this.device.queue.submit([publish.finish()]);this.indexCount=this.solverIndexCount;
  }
  rollbackEpoch(id:string):void {
    if(this.pending||!this.epoch||this.epoch.id!==id)throw Error('Cannot restore unknown or pending reach epoch');const old=this.epoch;
    const e=this.device.createCommandEncoder();e.copyBufferToBuffer(this.checkpoint,0,this.nodes,0,old.nodes*32);e.copyBufferToBuffer(this.checkpointSurface,0,this.surface,0,old.nodes*32);e.copyBufferToBuffer(this.checkpointIndices,0,this.indices,0,old.solverIndices*4);e.copyBufferToBuffer(this.checkpointIndices,0,this.trialIndices,0,old.solverIndices*4);this.device.queue.submit([e.finish()]);
    this.nodeCount=old.nodes;this.faceCount=old.faces;this.indexCount=old.indices;this.solverIndexCount=old.solverIndices;this.failed=old.failed;this.faceConnectivity.splice(old.faces);this.boundaryInput=old.boundary;this.boundaryConsumed=old.boundaryConsumed;this.physicalTime=old.time;this.lastReceipt=old.receipt;this.lastInsertion=old.insertion;this.writeAdjacency();this.epoch=null;
  }
  setBoundaryInput(id:string,input:ReachBoundaryInput):void {
    if(this.pending||this.failed||!this.epoch||this.epoch.id!==id)throw Error('Boundary forcing requires a private ownership epoch');
    if(Math.abs(input.timeStart-this.physicalTime)>1e-12*Math.max(1,Math.abs(this.physicalTime)))throw Error('Artificial inlet interval is stale or skips physical time');
    const edges=new Map<string,{ids:[number,number];count:number}>();for(const face of this.faceConnectivity)for(let k=0;k<3;k++){const a=face[k],b=face[(k+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(':');const edge=edges.get(key);if(edge)edge.count++;else edges.set(key,{ids:[a,b],count:1});}
    const boundaryNodes=new Set([...edges.values()].filter(e=>e.count===1).flatMap(e=>e.ids));
    const boundaryEdges=new Set([...edges.entries()].filter(([,e])=>e.count===1).map(([key])=>key));
    validateReachBoundaryInput(input,this.nodeCount,boundaryNodes,this.law.surfaceTension,boundaryEdges);
    if(this.lastInsertion?.timeStart===this.physicalTime&&this.lastInsertion.declaredSurfaceEnergyAdvection!==null){
      if(this.lastInsertion.timeEnd!==input.timeEnd)throw Error('Boundary interval differs from pending surface insertion');
      if(Math.abs(this.lastInsertion.declaredSurfaceEnergyAdvection-input.surfaceEnergyAdvection)>1e-10*Math.max(1,Math.abs(input.surfaceEnergyAdvection)))throw Error('Insertion advection differs from the evaluated cut flux');
    }
    this.boundaryInput=structuredClone(input);this.boundaryConsumed=false;this.epoch.validated=false;this.writeAdjacency();
  }
  boundaryState():{input:ReachBoundaryInput|null;consumed:boolean;time:number;receipt:ReachGpuReceipt|null;insertion:ReachSurfaceInsertionReceipt|null}{return structuredClone({input:this.boundaryInput,consumed:this.boundaryConsumed,time:this.physicalTime,receipt:this.lastReceipt,insertion:this.lastInsertion});}

  /** Append only the new material and connectivity. Existing moving vertices
   * are never replaced by a CPU reconstruction. A shared vertex receives the
   * exact summed momentum and its mixing loss is returned separately.
   * The adapter owns actual wet-edge subdivision; unsupported partial overlap
   * must be rejected there before film ownership is acknowledged.
   */
  async appendDelta(id:string,delta:ReachGpuDelta):Promise<{mixingEnergyLoss:number;createdSurfaceEnergy:number;surfaceEnergyError:number|null}> {
    if(this.pending||this.failed||!this.epoch||this.epoch.id!==id)throw Error('Append requires a live ownership epoch');
    if(!delta.nodes.length||!delta.faces.length)throw Error('Empty material delta');
    if(delta.faces.some(face=>'cornerMass' in face))throw Error('Source-weighted inlet requires coupled open-system evolution and thickness reconstruction');
    const oldCount=this.nodeCount,ids=delta.nodes.map(n=>n.id),nextCount=Math.max(oldCount,...ids.map(i=>i+1));
    if(new Set(ids).size!==ids.length||ids.some(i=>!Number.isSafeInteger(i)||i<0)||delta.nodes.length>this.nodeCapacity||nextCount>this.nodeCapacity||this.faceCount+delta.faces.length>this.faceCapacity||delta.closedIndices.length>this.indexCapacity)throw Error('Invalid or overflowing material delta');
    for(let i=oldCount;i<nextCount;i++)if(!ids.includes(i))throw Error('New material IDs must be consecutive');
    const shares=new Map<number,number>();for(const face of delta.faces){if(new Set(face.nodes).size!==3||face.nodes.some(i=>!Number.isSafeInteger(i)||i<0||i>=nextCount)||!(face.volume>0)||!Number.isFinite(face.volume))throw Error('Invalid appended face');for(const i of face.nodes)shares.set(i,(shares.get(i)??0)+this.law.density*face.volume/3);}
    // Optical closedness cannot authorize another owner of an existing material
    // face. Validate the combined mesh before the first upload or queue submit.
    validateReachMaterialConnectivity([...this.faceConnectivity,...delta.faces.map(f=>f.nodes)],nextCount);
    for(const node of delta.nodes)if(!(node.mass>0)||![...node.position,...node.momentum,node.mass].every(Number.isFinite)||Math.abs(node.mass-(shares.get(node.id)??0))>1e-10*Math.max(1,node.mass))throw Error('Delta node mass must equal new face shares');
    if([...shares.keys()].some(i=>!ids.includes(i)))throw Error('Missing shared-node material delta');
    const edges=new Map<string,{count:number;signed:number}>(),triangles=new Set<string>();if(delta.closedIndices.length%3)throw Error('Malformed appended closed topology');
    for(let k=0;k<delta.closedIndices.length;k+=3){const tri=Array.from(delta.closedIndices.slice(k,k+3)),key=[...tri].sort((a,b)=>a-b).join(':');if(new Set(tri).size!==3||tri.some(i=>i>=nextCount*2)||triangles.has(key))throw Error('Invalid or duplicated appended optical triangle');triangles.add(key);for(let j=0;j<3;j++){const a=tri[j],b=tri[(j+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(':');const edge=edges.get(key)??{count:0,signed:0};edge.count++;edge.signed+=a<b?1:-1;edges.set(key,edge);}}
    if([...edges.values()].some(e=>e.count!==2||e.signed!==0))throw Error('Appended optical topology must be closed and manifold');
    if(delta.surfaceInsertion&&(!(delta.surfaceInsertion.timeEnd>delta.surfaceInsertion.timeStart)||!Object.values(delta.surfaceInsertion).every(Number.isFinite)))throw Error('Invalid measured surface insertion transaction');
    if(delta.surfaceInsertion&&Math.abs(delta.surfaceInsertion.timeStart-this.physicalTime)>1e-12*Math.max(1,Math.abs(this.physicalTime)))throw Error('Surface insertion interval is stale or skips physical time');
    if(delta.surfaceInsertion&&this.lastInsertion?.timeStart===this.physicalTime)throw Error('Combine current release ports into one declared surface insertion transaction');
    this.pending=true;
    try{
      const packed=new Float32Array(delta.nodes.length*8);delta.nodes.forEach((n,i)=>packed.set([...n.position,n.mass,...n.momentum,n.id],i*8));this.device.queue.writeBuffer(this.trialB,0,packed);
      const data=new ArrayBuffer(delta.faces.length*16),ints=new Uint32Array(data),floats=new Float32Array(data);delta.faces.forEach((f,i)=>{ints.set(f.nodes,i*4);floats[i*4+3]=f.volume;});this.device.queue.writeBuffer(this.faces,this.faceCount*16,data);this.device.queue.writeBuffer(this.trialIndices,0,new Uint32Array(delta.closedIndices));
      const params=new ArrayBuffer(112),u=new Uint32Array(params),f=new Float32Array(params);u[0]=nextCount;u[1]=this.faceCount+delta.faces.length;u[3]=delta.nodes.length;f[6]=this.law.surfaceTension;f[19]=oldCount;u[20]=this.boundaryOffset;u[22]=this.faceCount;this.device.queue.writeBuffer(this.params,0,params);
      const e=this.device.createCommandEncoder();for(const name of ['append','appendAudit'] as const){const pass=e.beginComputePass();pass.setPipeline(this.pipelines[name]);pass.setBindGroup(0,this.groups[0]);pass.dispatchWorkgroups(name==='append'?Math.ceil(delta.nodes.length/64):1);pass.end();}e.copyBufferToBuffer(this.report,0,this.readback,0,128);this.device.queue.submit([e.finish()]);await this.readback.mapAsync(GPUMapMode.READ);const raw=new Float32Array(this.readback.getMappedRange()).slice(),loss=raw[15],created=raw[28];this.readback.unmap();
      if(!Number.isFinite(loss)||loss<-.000001){this.failed=true;throw Error('Invalid GPU admission mixing loss; restore epoch');}
      if(!Number.isFinite(created)||created<0)throw Error('Invalid created surface energy; restore epoch');
      if(raw[30]!==0)throw Error('Invalid newly introduced material geometry; restore epoch');
      const surfaceError=delta.surfaceInsertion?created-delta.surfaceInsertion.surfaceEnergyAdvection:null;
      if(surfaceError!==null&&Math.abs(surfaceError)>this.options.maximumNumericalEnergyLossFraction*Math.max(created,Math.abs(delta.surfaceInsertion!.surfaceEnergyAdvection)))throw Error('Created surface energy does not match measured insertion advection; restore epoch');
      // Normalize only the accepted clock arithmetic allowance. Pending guards
      // then compare one exact owner time, so a near-equal caller timestamp
      // cannot bypass the insertion/boundary link or duplicate interval check.
      this.lastInsertion={createdSurfaceEnergy:created,declaredSurfaceEnergyAdvection:delta.surfaceInsertion?.surfaceEnergyAdvection??null,surfaceEnergyError:surfaceError,timeStart:delta.surfaceInsertion?this.physicalTime:null,timeEnd:delta.surfaceInsertion?.timeEnd??null};
      this.nodeCount=nextCount;this.faceCount+=delta.faces.length;this.solverIndexCount=delta.closedIndices.length;this.faceConnectivity.push(...delta.faces.map(f=>[...f.nodes] as [number,number,number]));this.boundaryInput=null;this.boundaryConsumed=true;this.writeAdjacency();this.epoch.validated=false;return{mixingEnergyLoss:loss,createdSurfaceEnergy:created,surfaceEnergyError:surfaceError};
    }catch(error){this.failed=true;throw error;}finally{this.pending=false;}
  }

  /** Physical dt comes from the requested interval. It is not chosen by an
   * explicit stability guess: unsuccessful implicit solves freeze and report.
   * No trial is drawn or transferred downstream before the audit accepts it.
   */
  async advance(dt:number):Promise<ReachGpuReceipt> {
    if(this.pending||this.failed)throw Error('Reach is pending or frozen with owned water');if(!(dt>0)||!Number.isFinite(dt))throw Error('Invalid physical reach interval');
    if(this.boundaryInput){if(this.boundaryConsumed&&this.boundaryInput.nodes.length)throw Error('Artificial inlet interval was already consumed; replace or clear actual supply');if(!this.boundaryConsumed&&Math.abs(dt-(this.boundaryInput.timeEnd-this.boundaryInput.timeStart))>1e-12*Math.max(1,dt))throw Error('Physical step does not match inlet interval');}
    if(this.lastInsertion?.timeStart===this.physicalTime&&this.lastInsertion.declaredSurfaceEnergyAdvection!==null&&(!this.boundaryInput||this.boundaryInput.timeEnd!==this.lastInsertion.timeEnd))throw Error('Pending surface insertion needs its evaluated inlet boundary before evolution');
    this.pending=true;
    try{
      const bytes=new ArrayBuffer(112),u=new Uint32Array(bytes),f=new Float32Array(bytes);u.set([this.nodeCount,this.faceCount,this.solverIndexCount,this.options.maximumIterations]);f.set([dt,this.law.density,this.law.surfaceTension,this.law.dynamicViscosity],4);f.set([...this.law.gravity,0],8);f.set([this.options.relativeMomentumResidual,this.options.absoluteMomentumResidual,this.options.maximumThicknessEdgeRatio,this.options.minimumTriangleQuality,this.options.stopBelowY,this.options.maximumIndependentVolumeError,this.options.maximumNumericalEnergyLossFraction,0],12);u[20]=this.boundaryOffset;f.set([...(this.boundaryInput?.cut.velocity??[0,0,0]),this.boundaryInput?.surfaceEnergyAdvection??0],24);this.device.queue.writeBuffer(this.params,0,bytes);
      const e=this.device.createCommandEncoder({label:'material-reach:guarded physical interval'});e.copyBufferToBuffer(this.nodes,0,this.trialA,0,this.nodeCount*32);
      const run=(name:keyof typeof this.pipelines,group:GPUBindGroup,count:number)=>{const pass=e.beginComputePass();pass.setPipeline(this.pipelines[name]);pass.setBindGroup(0,group);pass.dispatchWorkgroups(count);pass.end();};
      for(let i=0;i<this.options.maximumIterations;i++)run('iterate',this.groups[i%2],Math.ceil(this.nodeCount/64));
      const final=this.groups[this.options.maximumIterations%2];run('reconstruct',final,Math.ceil(this.nodeCount/64));run('audit',final,1);run('commit',final,Math.ceil(this.nodeCount/64));e.copyBufferToBuffer(this.report,0,this.readback,0,128);this.device.queue.submit([e.finish()]);
      await this.readback.mapAsync(GPUMapMode.READ);const r=new Float32Array(this.readback.getMappedRange()).slice();this.readback.unmap();this.failed=r[0]!==0;
      if(!this.failed){this.boundaryConsumed=true;this.physicalTime+=dt;if(this.epoch)this.epoch.validated=true;else this.publishSurface();}
      const receipt:ReachGpuReceipt={accepted:!this.failed,failureBits:r[0],maximumMomentumResidual:r[1],ownedVolume:r[2],renderedVolume:r[3],independentVolumeError:r[4],initialEnergy:r[5],finalEnergy:r[6],physicalViscousLoss:r[7],numericalEnergyLossSigned:r[8],momentum:[r[9],r[10],r[11]],gravityImpulse:[r[12],r[13],r[14]],cutImpulse:[r[16],r[17],r[18]],driveImpulse:[r[19],r[20],r[21]],cutWork:r[22],driveWork:r[23],externalWork:r[24],declaredSurfaceEnergyAdvection:this.boundaryInput?.surfaceEnergyAdvection??0,measuredSurfaceEnergyAdvection:r[29],momentumError:[r[25],r[26],r[27]],iterations:this.options.maximumIterations,runtimeQualified:false,integrationQualified:false,independentVolumeQualified:false};this.lastReceipt=structuredClone(receipt);return receipt;
    }catch(error){this.failed=true;throw error;}finally{this.pending=false;}
  }

  /** Initial ownership can be moved atomically once. Caller has staged exact
   * controlled two-sided cut into this mesh. Actual Film detachment is rejected
   * until its missing wetting/surface-energy model has been evaluated.
   * This does not implement ongoing subdivision or append admission: that is an
   * explicit integration gap, not permission to reset resident water each tick.
   */
  transferInitialOwnership(admissions:readonly ReachAdmission[],owner:ReachAtomicOwner):{commit():void;rollback():void} {
    if(this.pending||this.failed)throw Error('Cannot stage frozen or pending reach');admissions.forEach(requireQualifiedReachInterface);
    if(new Set(admissions.map(a=>a.id)).size!==admissions.length)throw Error('Duplicate staged water ownership');
    const checkpoint=owner.checkpoint();let state:'staged'|'committed'|'rolled-back'='staged';
    return{commit:()=>{if(state!=='staged')throw Error('Ownership transaction already settled');try{owner.transfer(admissions);state='committed';}catch(error){owner.restore(checkpoint);state='rolled-back';throw error;}},rollback:()=>{if(state==='rolled-back')return;owner.restore(checkpoint);state='rolled-back';}};
  }
  destroy():void{if(this.pending)throw Error('Cannot destroy pending owned reach');for(const buffer of this.buffers)buffer.destroy();}
}
