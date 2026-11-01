/** Gives the existing native-family bank HLL operator real terrain storage.
 * Water volume determines its wet footprint on the supplied drawn triangles;
 * a scalar center bed never extends water through a bank or dry ridge.
 * This bounded CPU adapter has closed outer walls. It is preparation for the
 * waterfall support repair, not a new source, airborne/contact solver or view.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 16/10/2026, 09:49:29
 * Dependents: None (Orphan)
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { bankPolygonArea as area, clipBankPolygon as clip,
  intersectBankPolygons as intersect, bankWetPolygonsJoined as joined,
  type BankTerrainPoint as P } from './riverBankCommonGeometry';
import { createBankState, prepareBankTransaction,
  type BankCellMeasure, type BankFaceNode, type BankGeometry,
  type BankState, type BankPreparation, type BankFaceLedger } from './riverSubcellBankExperiment';
import { G } from './riverSolver';

export interface TerrainBankCellInput {
  /** x0, x1, z0, z1. Different rectangles never own the same plan area. */
  readonly bounds: readonly [number, number, number, number];
  /** Actual one-sided support triangles, x/z/bed-y. No envelope is guessed. */
  readonly triangles: readonly (readonly [P, P, P])[];
}
/** A closed triangular water column, not a center-depth rectangle. Positions
 * are x/y/z relative to originM; the lower three vertices follow the actual
 * support plane and the upper three share the solved free-surface level.
 * Float64 packet construction does not qualify a later Float32/GPU upload.
 */
export interface TerrainBankWetWedge {
  readonly cellId:number;
  readonly originM:readonly [number,number,number];
  readonly localVertices:readonly number[];
  readonly volumeM3:number;
}
export interface TerrainBankWetPacket {
  readonly stateId:string;
  readonly geometryId:string;
  readonly timeS:number;
  readonly wedges:readonly TerrainBankWetWedge[];
  readonly rawVolumeM3:number;
  readonly representedVolumeM3:number;
  readonly storageMismatchM3:number;
  readonly coordinateStorage:'FLOAT64_CPU_ONLY';
}
// Each wedge uses lower vertices0/1/2, upper3/4/5. Rims close every column for
// independent volume/contact checks, even if a renderer later hides shared rims.
export const BANK_WET_WEDGE_TRIANGLES=Object.freeze([0,1,2,3,5,4,0,3,4,0,4,1,1,4,5,1,5,2,2,5,3,2,3,0]);
const MAX_WET_WEDGES=4096;
const LIMIT = { cells:256, pieces:64, faceNodes:32, inversions:64 };
const ROUND = 2e-11; // bounded local-coordinate topology arithmetic, in meters
type Piece = { polygon:P[]; bed:(x:number,z:number)=>number };
function need(ok:boolean,why:string):asserts ok { if(!ok)throw Error(why); }
function squareMean(v:number[]) { return (v.reduce((s,x)=>s+x*x,0)+v[0]*v[1]+v[0]*v[2]+v[1]*v[2])/6; }
function rectangle(p:readonly P[],b:TerrainBankCellInput['bounds']) {
  return clip(clip(clip(clip(p,q=>q[0]-b[0]),q=>b[1]-q[0]),q=>q[1]-b[2]),q=>b[3]-q[1]);
}
function plane(t:readonly [P,P,P]) {
  const [a,b,c]=t,dx=b[0]-a[0],dz=b[1]-a[1],ex=c[0]-a[0],ez=c[1]-a[1],D=dx*ez-dz*ex;
  need(t.flat().every(Number.isFinite)&&Math.abs(D)>1e-14,'Unresolved vertical/degenerate support triangle');
  const sx=((b[2]-a[2])*ez-(c[2]-a[2])*dz)/D,sz=(dx*(c[2]-a[2])-ex*(b[2]-a[2]))/D;
  return (x:number,z:number)=>a[2]+sx*(x-a[0])+sz*(z-a[1]);
}
function contains(poly:readonly P[],x:number,z:number) {
  let positive=false,negative=false;
  for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],s=(b[0]-a[0])*(z-a[1])-(b[1]-a[1])*(x-a[0]);positive ||= s>ROUND;negative ||= s< -ROUND;}
  return !(positive&&negative);
}
function atLevel(pieces:readonly Piece[],eta:number) {
  const polygons=pieces.map(p=>clip(p.polygon,q=>eta-q[2])).filter(p=>area(p)>0&&p.some(q=>eta>q[2]));
  let volume=0,wetArea=0,potential=0,squared=0;
  for(const p of polygons)for(let i=1;i+1<p.length;i++){
    const t=[p[0],p[i],p[i+1]],A=area(t),b=t.map(q=>q[2]),h=b.map(y=>Math.max(eta-y,0));
    volume+=A*(h[0]+h[1]+h[2])/3;wetArea+=A;squared+=A*squareMean(h);
    // b*h+h²/2 = eta*h-h²/2 avoids cancellation at large world heights.
    potential+=A*(eta*(h[0]+h[1]+h[2])/3-squareMean(h)/2);
  }
  const reached=new Set<number>();let components=0;
  for(let i=0;i<polygons.length;i++)if(!reached.has(i)){components++;reached.add(i);const todo=[i];while(todo.length){const k=todo.pop()!;for(let j=0;j<polygons.length;j++)if(!reached.has(j)&&joined(polygons[k],polygons[j],eta)){reached.add(j);todo.push(j);}}}
  return {eta,volume,wetArea,potential,squared,polygons,components};
}

/** The caller supplies a qualified nonoverlapping terrain patch. This builder
 * verifies complete coverage and refuses multiple wet basins in one owner.
 * It does not select the highest of overlapping rock/ground/underside meshes.
 */
export function buildTerrainBankGeometry(identity:string,sourceHash:string,input:readonly TerrainBankCellInput[]) {
  need(!!identity&&/^[a-f\d]{64}$/i.test(sourceHash)&&input.length>0&&input.length<=LIMIT.cells,'Invalid bounded terrain support identity/cell count');
  // Keep the support used by every later transaction identical to the support
  // checked at construction. A caller changing its input cannot alter a face
  // while leaving an earlier corner certificate in place.
  input=input.map(c=>({bounds:[...c.bounds] as TerrainBankCellInput['bounds'],
    triangles:c.triangles.map(t=>t.map(p=>[...p] as P) as unknown as readonly [P,P,P])}));
  const pieces=input.map((cell,i)=>{
    const b=cell.bounds,A=(b[1]-b[0])*(b[3]-b[2]);
    need(b.every(Number.isFinite)&&A>0&&b[1]>b[0]&&b[3]>b[2]&&cell.triangles.length<=LIMIT.pieces,'Invalid support rectangle/piece count');
    for(let j=0;j<i;j++){const a=input[j].bounds;need(Math.min(a[1],b[1])<=Math.max(a[0],b[0])||Math.min(a[3],b[3])<=Math.max(a[2],b[2]),'Overlapping water owners');}
    const ps=cell.triangles.map(t=>({polygon:rectangle(t,b),bed:plane(t)})).filter(p=>area(p.polygon)>0);
    need(ps.length>0&&Math.abs(ps.reduce((s,p)=>s+area(p.polygon),0)-A)<=ROUND*A,'Uncovered/overlapping support area');
    for(let j=0;j<ps.length;j++)for(let k=0;k<j;k++)need(area(intersect(ps[j].polygon,ps[k].polygon))<=ROUND*A,'Overlapping support triangles');
    return ps;
  });
  const measureLevel=(id:number,eta:number)=>{need(Number.isInteger(id)&&!!pieces[id]&&Number.isFinite(eta),'Invalid level query');return atLevel(pieces[id],eta);};
  const cells=input.map((c,id)=>({id,areaM2:(c.bounds[1]-c.bounds[0])*(c.bounds[3]-c.bounds[2]),measureVolume:(V:number):BankCellMeasure=>{
    need(Number.isFinite(V)&&V>=0,'Invalid support inventory');
    const beds=pieces[id].flatMap(p=>p.polygon.map(q=>q[2]));let lo=Math.min(...beds),hi=Math.max(...beds)+V/((c.bounds[1]-c.bounds[0])*(c.bounds[3]-c.bounds[2]));
    let m=atLevel(pieces[id],lo);
    if(V>0){for(let k=0;k<LIMIT.inversions;k++){const mid=(lo+hi)/2;if(mid===lo||mid===hi)break;const q=atLevel(pieces[id],mid);if(q.volume<V)lo=mid;else hi=mid;}
      // If the lower representable level is still completely dry, this world
      // elevation cannot resolve the requested positive storage. Do not invent
      // a larger wet face from the next float and call its mismatch an error bar.
      need(atLevel(pieces[id],lo).volume>0,'Unresolved positive storage at world-height precision');
      m=atLevel(pieces[id],(lo+hi)/2);}
    need(m.components<=1,'Disconnected wet basins require separate owners');
    need(V===0||m.wetArea>0,'Unresolved positive support inventory');
    return {etaM:m.eta,representedVolumeM3:m.volume,wetAreaM2:m.wetArea,potentialIntegralM4:m.potential,depthSquaredIntegralM4:m.squared,
      volumeErrorM3:Math.abs(m.volume-V),potentialErrorM4:64*Number.EPSILON*Math.max(1,Math.abs(m.potential)),basinResolved:true};
  }}));
  const faces:BankGeometry['faces'][number][]=[];
  for(let L=0;L<input.length;L++){
    const b=input[L].bounds;
    for(const [axis,side]of [[0,-1],[0,1],[1,-1],[1,1]] as const){
      const fixed=axis===0?b[side<0?0:1]:b[side<0?2:3],begin=axis===0?b[2]:b[0],end=axis===0?b[3]:b[1];
      const neighbors=input.map((c,id)=>({b:c.bounds,id})).filter(q=>q.id!==L&&(axis===0?q.b[side<0?1:0]:q.b[side<0?3:2])===fixed);
      const cuts=[begin,end,...neighbors.flatMap(q=>axis===0?[q.b[2],q.b[3]]:[q.b[0],q.b[1]])].filter(v=>v>=begin&&v<=end).sort((a,c)=>a-c);
      for(let k=1;k<cuts.length;k++){
        const a=cuts[k-1],c=cuts[k];if(a===c)continue;const mid=(a+c)/2,neighbor=neighbors.filter(q=>axis===0?mid>q.b[2]&&mid<q.b[3]:mid>q.b[0]&&mid<q.b[1]);need(neighbor.length<=1,'Ambiguous support face owner');
        const R=neighbor[0]?.id??null;if(R!==null&&R<L)continue;
        const point=(t:number):readonly [number,number]=>axis===0?[fixed,t]:[t,fixed];
        faces.push({id:faces.length,left:L,right:R,nx:axis===0?side:0,nz:axis===1?side:0,lengthM:c-a,normalSpacingM:axis===0?b[1]-b[0]:b[3]-b[2],measureFace:(etaL,etaR)=>{
          // Split at actual triangle/shoreline crossings before quadrature.
          // Pressure on each resulting linear-depth trace integrates exactly.
          // Nonlinear HLL quadrature remains a declared UNQUALIFIED approximation.
          const stops=[a,c];for(const id of [L,...(R===null?[]:[R])])for(const p of pieces[id])for(const q of p.polygon)if(Math.abs((axis===0?q[0]:q[1])-fixed)<=ROUND){const t=axis===0?q[1]:q[0];if(t>a&&t<c)stops.push(t);}
          stops.sort((x,y)=>x-y);const nodes:BankFaceNode[]=[];
          for(let s=1;s<stops.length;s++){const x=stops[s-1],y=stops[s];if(!(y>x))continue;const p=point((x+y)/2);
            const trace=(id:number)=>{const ps=pieces[id].filter(q=>contains(q.polygon,...p));need(ps.length>0,'Missing one-sided terrain face');const h=ps.map(q=>q.bed(...p));need(Math.max(...h)-Math.min(...h)<=ROUND*Math.max(1,...h.map(Math.abs)),'Ambiguous one-sided terrain jump');return ps[0].bed;};
            const left=trace(L),right=R===null?left:trace(R),wetCuts=[x,y];
            for(const [bed,eta]of [[left,etaL],[right,etaR]] as const){const d0=eta-bed(...point(x)),d1=eta-bed(...point(y));if((d0>0)!==(d1>0))wetCuts.push(x+(y-x)*d0/(d0-d1));}
            wetCuts.sort((u,v)=>u-v);
            for(let w=1;w<wetCuts.length;w++){const lo=wetCuts[w-1],hi=wetCuts[w];if(!(hi>lo))continue;for(const g of [-1/Math.sqrt(3),1/Math.sqrt(3)]){const q=point((lo+hi)/2+g*(hi-lo)/2),bl=left(...q),br=right(...q);nodes.push({weightM:(hi-lo)/2,bedLeftM:bl,bedRightM:br,depthLeftM:Math.max(etaL-bl,0),depthRightM:Math.max(etaR-br,0)});}}
          }
          need(nodes.length>0&&nodes.length<=LIMIT.faceNodes,'Terrain face integration capacity exceeded');
          return {nodes,lengthErrorM:Math.abs(nodes.reduce((s,p)=>s+p.weightM,0)-(c-a)),depthErrorM:0,fluxVolumeErrorM3S:0,fluxMomentumErrorN:0};
        }});
      }
    }
  }
  cells.forEach(Object.freeze);faces.forEach(Object.freeze);
  const geometry:BankGeometry=Object.freeze({geometryId:identity,method:'Actual disjoint rectangle/triangle storage; split two-point edge scheme; no certified nonlinear HLL quadrature bound',sourceHashes:Object.freeze({drawnTerrain:sourceHash}),singleValuedBed:true,faceQuadratureStatus:'UNQUALIFIED',cells:Object.freeze(cells),faces:Object.freeze(faces)});
  /** Advance the same support operator through its last certified corner wedge.
   * Two adjacent owners must use the exact same nominated drawn triangle. We
   * deliberately do not infer an affine surface from almost-coplanar samples.
   * Other terrain/flow regimes use the ordinary HLL transaction unchanged.
   * The receiving owner remains a first-order cell-average approximation.
   */
  const prepareCornerTransaction=(state:BankState,rho:number,capS:number):BankPreparation=>{
    const ordinary=prepareBankTransaction(geometry,state,rho,capS,c=>c.diagnosticBoundS);
    if(!ordinary.ok)return ordinary;
    try {
      if(input.length!==2)return ordinary;
      const [left,right]=input,b=left.bounds,r=right.bounds;
      if(left.triangles.length!==1||right.triangles.length!==1||b[1]!==r[0]||b[2]!==r[2]||b[3]!==r[3])return ordinary;
      const t=left.triangles[0];
      if(!t.every((p,i)=>p.every((v,j)=>v===right.triangles[0][i][j])))return ordinary;
      const [A,B,C]=t,dx=B[0]-A[0],dz=B[1]-A[1],ex=C[0]-A[0],ez=C[1]-A[1],D=dx*ez-dz*ex;
      const a=-((B[2]-A[2])*ez-(C[2]-A[2])*dz)/D;
      const c=(dx*(C[2]-A[2])-ex*(B[2]-A[2]))/D;
      const V=state.volumeM3[0],u=V>0?state.pxKgMS[0]/(rho*V):0;
      if(!(a>0&&c>0&&V>0&&u>0&&state.pzKgMS[0]===0))return ordinary;
      const delta=Math.cbrt(6*a*c*V);
      if(!(delta<a*(b[1]-b[0])&&delta<c*(b[3]-b[2])&&u>Math.sqrt(G*delta)))return ordinary;
      const shared=faces.find(f=>f.left===0&&f.right===1&&f.nx===1&&f.nz===0);
      if(!shared||faces.filter(f=>f.right!==null).length!==1)return ordinary;
      const minimum=plane(t)(b[1],b[2]);
      const bound=cells[1].measureVolume(state.volumeM3[0]+state.volumeM3[1]);
      // Inversion reports its represented-volume discrepancy. Extend its level
      // upward by that entire discrepancy divided by wet area: storage's
      // derivative (wet area) cannot shrink as a flat level rises.
      const receiverUpper=bound.etaM+bound.volumeErrorM3/bound.wetAreaM2;
      // Flat-level reconstruction plus this closed-patch inventory bound keeps
      // the recipient trace dry throughout, not merely at interval entry.
      if(!(Number.isFinite(receiverUpper)&&receiverUpper<minimum))return ordinary;
      const base=ordinary.transaction,rc=base.timestep.cells[1];
      const H=Math.min(capS,rc.wetAreaBoundS,rc.volumeResponseBoundS,rc.outflowBoundS);
      const dryTime=delta/(a*u),tau=Math.min(H,dryTime),terminal=dryTime<=H;
      need(tau>0&&Number.isFinite(tau)&&state.timeS+tau>state.timeS,'Unresolved corner event clock');
      const d1=terminal?0:delta-a*u*tau;
      const nextV=terminal?0:d1**3/(6*a*c),mass=terminal?V:V-nextV;
      need(mass>0&&mass<=V,'Unresolved corner transfer');
      const advective=terminal?state.pxKgMS[0]:rho*u*mass;
      const integratedV=tau*(delta**3+delta**2*d1+delta*d1**2+d1**3)/(24*a*c);
      const Ix=rho*G*a*integratedV,Iz=rho*G*c*integratedV,scale=tau/base.dtS;
      const pair=(v:readonly number[])=>[v[0]*scale,v[1]*scale] as const;
      const transfers:BankFaceLedger[]=base.transfers.map(f=>{
        if(f.faceId===shared.id)return {...f,signedVolumeM3:mass,hllPxKgMS:advective+Ix,hllPzKgMS:0,
          correctionLeft:[0,0],correctionRight:[0,0],bedReactionLeft:[Ix,0],bedReactionRight:[0,0]};
        if(f.left===0){
          const lower=faces.find(q=>q.id===f.faceId)!.nz===-1;
          return {...f,signedVolumeM3:0,hllPxKgMS:0,hllPzKgMS:lower?-Iz:0,
            correctionLeft:[0,0],correctionRight:[0,0],bedReactionLeft:[0,lower?-Iz:0],bedReactionRight:[0,0]};
        }
        need(f.right===null&&f.signedVolumeM3===0,'Corner recipient must have closed other faces');
        return {...f,signedVolumeM3:0,hllPxKgMS:f.hllPxKgMS*scale,hllPzKgMS:f.hllPzKgMS*scale,
          correctionLeft:pair(f.correctionLeft),correctionRight:pair(f.correctionRight),
          bedReactionLeft:pair(f.bedReactionLeft),bedReactionRight:pair(f.bedReactionRight)};
      });
      let rx=0,rz=0;
      for(const f of transfers)if(f.left===1){rx+=-f.hllPxKgMS+f.correctionLeft[0]+f.bedReactionLeft[0];rz+=-f.hllPzKgMS+f.correctionLeft[1]+f.bedReactionLeft[1];}
      // At the exact dry event, transfer the stored momentum, including every
      // last bit of mass. The pressure impulse also reaches the receiver; bed
      // and wall reactions cancel in the donor. No thin-water cutoff is used.
      const after=createBankState(state.runId,geometry.geometryId,[nextV,state.volumeM3[1]+mass],
        [terminal?0:state.pxKgMS[0]-advective,state.pxKgMS[1]+advective+Ix+rx],
        [0,state.pzKgMS[1]+rz],state.revision+1,state.timeS+tau);
      const beforeM=cells.map((q,i)=>q.measureVolume(state.volumeM3[i]));
      const afterM=cells.map((q,i)=>q.measureVolume(after.volumeM3[i]));
      const kinetic=(s:BankState)=>s.volumeM3.reduce((sum,v,i)=>sum+(v===0?0:(s.pxKgMS[i]**2+s.pzKgMS[i]**2)/(2*rho*v)),0);
      const potentialChangeJ=rho*G*afterM.reduce((s,m,i)=>s+m.potentialIntegralM4-beforeM[i].potentialIntegralM4,0);
      const kineticChangeJ=kinetic(after)-kinetic(state);
      need([potentialChangeJ,kineticChangeJ,Ix,Iz].every(Number.isFinite),'Nonfinite corner observation');
      const sealed=transfers.map(f=>Object.freeze({...f,
        correctionLeft:Object.freeze(f.correctionLeft),correctionRight:Object.freeze(f.correctionRight),
        bedReactionLeft:Object.freeze(f.bedReactionLeft),bedReactionRight:Object.freeze(f.bedReactionRight)}));
      return {ok:true,transaction:Object.freeze({...base,after,dtS:tau,transfers:Object.freeze(sealed),potentialChangeJ,kineticChangeJ,
        volumeIntegrationErrorM3:[...beforeM,...afterM].reduce((s,m)=>s+m.volumeErrorM3,0),
        potentialIntegrationErrorJ:rho*G*[...beforeM,...afterM].reduce((s,m)=>s+m.potentialErrorM4,0),
        faceVolumeTransferErrorM3:base.faceVolumeTransferErrorM3*scale,faceMomentumTransferErrorKgMS:base.faceMomentumTransferErrorKgMS*scale,
        cornerEvent:Object.freeze({donor:0,receiver:1,terminal,deltaBeforeM:delta,deltaAfterM:d1,sharedVolumeM3:mass,
          pressureImpulseKgMS:Object.freeze([Ix,Iz] as const),receiverMaximumLevelM:receiverUpper,edgeMinimumM:minimum,receiverIntegration:'EXPLICIT_FIRST_ORDER' as const})})};
    }catch(error){return {ok:false,state,reason:error instanceof Error?error.message:String(error)};}
  };
  /** Construct the entire supported liquid footprint of one committed state.
   * No rectangle extends a wet center over dry rock. Each clipped terrain
   * triangle supplies both the water's lower boundary and its shoreline.
   * Failure returns no partial packet and never changes the water inventory.
   */
  const wetVolume=(state:BankState):{ok:true;packet:TerrainBankWetPacket}|{ok:false;state:BankState;reason:string}=>{
    try {
      const checked=createBankState(state.runId,state.geometryId,state.volumeM3,state.pxKgMS,state.pzKgMS,state.revision,state.timeS);
      need(state.geometryId===geometry.geometryId&&state.stateId===checked.stateId&&state.volumeM3.length===cells.length,'Wet packet state/provenance mismatch');
      const wedges:TerrainBankWetWedge[]=[];let raw=0,represented=0,mismatch=0;
      for(let id=0;id<cells.length;id++){
        const V=state.volumeM3[id];raw+=V;
        if(V===0)continue; // An empty owner emits no placeholder geometry.
        const m=cells[id].measureVolume(V),wet=atLevel(pieces[id],m.etaM);
        need(wet.components===1,'Disconnected water cannot share a wet packet owner');
        represented+=wet.volume;mismatch+=Math.abs(wet.volume-V);
        for(const p of wet.polygons)for(let i=1;i+1<p.length;i++){
          let t=[p[0],p[i],p[i+1]];
          const twice=(t[1][0]-t[0][0])*(t[2][1]-t[0][1])-(t[1][1]-t[0][1])*(t[2][0]-t[0][0]);
          if(twice===0)continue;
          if(twice<0)t=[t[0],t[2],t[1]];
          const volume=Math.abs(twice)*((m.etaM-t[0][2])+(m.etaM-t[1][2])+(m.etaM-t[2][2]))/6;
          need(volume>0&&Number.isFinite(volume),'Unresolved wet wedge volume');
          need(wedges.length<MAX_WET_WEDGES,'Wet volume geometry capacity exceeded');
          const origin=Object.freeze([(t[0][0]+t[1][0]+t[2][0])/3,m.etaM,(t[0][1]+t[1][1]+t[2][1])/3] as const);
          const vertices=t.flatMap(q=>[q[0]-origin[0],q[2]-origin[1],q[1]-origin[2]]);
          vertices.push(...t.flatMap(q=>[q[0]-origin[0],0,q[1]-origin[2]]));
          need(vertices.every(Number.isFinite),'Nonfinite wet volume coordinates');
          wedges.push(Object.freeze({cellId:id,originM:origin,localVertices:Object.freeze(vertices),volumeM3:volume}));
        }
      }
      need([raw,represented,mismatch].every(Number.isFinite),'Nonfinite wet packet inventory');
      return {ok:true,packet:Object.freeze({stateId:state.stateId,geometryId:geometry.geometryId,timeS:state.timeS,
        wedges:Object.freeze(wedges),rawVolumeM3:raw,representedVolumeM3:represented,storageMismatchM3:mismatch,coordinateStorage:'FLOAT64_CPU_ONLY'})};
    }catch(error){return {ok:false,state,reason:error instanceof Error?error.message:String(error)};}
  };
  return {geometry,measureLevel,prepareCornerTransaction,wetVolume};
}
