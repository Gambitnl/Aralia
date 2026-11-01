/** Crossing-history diagnostics for the isolated cascade.
 * These labels describe the corrected face sweeps, never a second water state.
 * Positive receiver geometry still owns all mass. Constant-carrier controls can
 * qualify endpoint motion; the discarded full-affine empty extension cannot.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/10/2026, 11:56:10
 * Dependents: systems/world3d/river/cascadeRuntimeV1.ts, systems/world3d/river/cascadeRuntimeV1Reconstruction.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {cascadeMoments,cascadeBounds,cascadeBox,dot3,sub3,cross3,type CascadeVec3,type CascadePoly} from './cascadeRuntimeV1Geometry';
import {cascadeSharedTetra,cascadeSharedIntersection,type CascadeSharedAllocation} from './cascadeRuntimeV1SharedRemap';
import {type CascadePiece} from './cascadeRuntimeV1Projection';

export interface CascadeFluxVertex {oldPosition:CascadeVec3;crossingPosition:CascadeVec3;crossingTime:number}
export interface CascadeFluxPrimitive {face:number;vertices:[CascadeFluxVertex,CascadeFluxVertex,CascadeFluxVertex,CascadeFluxVertex];orientation:1|-1;poly:CascadePoly}
export interface CascadeRegionEndpoint {region:number;volume:number;residentVolume:number;sourceVolume:number;first:CascadeVec3|null;chainError:number}
export interface CascadeEndpointAudit {status:'constant-control-qualified'|'INCONCLUSIVE';reason:string;regions:CascadeRegionEndpoint[];primitives:CascadeFluxPrimitive[];maximumChainError:number;sourceVolume:number;milliseconds:number}
export interface CascadeCarrierAudit {maximumTraceError:number;maximumWetDivergence:number;subregions:{region:number;points:CascadeVec3[];intercept:CascadeVec3;gradient:CascadeVec3[];occupiedVolume:number}[];milliseconds:number}
const add=(a:CascadeVec3,b:CascadeVec3):CascadeVec3=>a.map((v,d)=>v+b[d]) as CascadeVec3;
const scale=(a:CascadeVec3,s:number):CascadeVec3=>a.map(v=>v*s) as CascadeVec3;
const determinant=(a:CascadeVec3,b:CascadeVec3,c:CascadeVec3)=>dot3(a,cross3(b,c));

/** Sorted global IDs choose the staircase prism split. Its outer edge diagonal
 * is the same one used in corrected-cap volume construction. Original vertices
 * cross at zero elapsed time; their back points and cap cross at stage end. */
export function cascadeLabeledFacePrimitives(a:CascadeSharedAllocation,dt:number):CascadeFluxPrimitive[] {
  const out:CascadeFluxPrimitive[]=[];
  for(const face of a.partition.faces){
    const points=face.vertices.map(id=>a.partition.vertices[id].point),center=scale(points.reduce(add,[0,0,0]),1/points.length);
    for(let i=0;i<face.vertices.length;i++){
      const x=face.vertices[i],y=face.vertices[(i+1)%face.vertices.length],ids=x<y?[x,y]:[y,x],outward=x<y?1:-1;
      const front=ids.map(id=>a.partition.vertices[id].point).concat([center]);
      const back=ids.map(id=>a.partition.vertices[id].back).concat([face.cap]);
      const labels: CascadeFluxVertex[]=[...front.map(p=>({oldPosition:p,crossingPosition:p,crossingTime:0})),...back.map((p,k)=>({oldPosition:p,crossingPosition:front[k],crossingTime:dt}))];
      for(const indices of [[0,1,2,5],[0,1,5,4],[0,3,4,5]]){
        let vertices=indices.map(k=>labels[k]) as CascadeFluxPrimitive['vertices'];
        const p=vertices.map(v=>v.oldPosition),det=determinant(sub3(p[1],p[0]),sub3(p[2],p[0]),sub3(p[3],p[0]));
        // A stationary/tangential face has exactly zero swept volume. Never
        // assign absolute signed volume to material or invert a singular label.
        if(det===0)continue;
        const orientation=(-outward*Math.sign(det)) as 1|-1;
        if(det<0)vertices=[vertices[0],vertices[2],vertices[1],vertices[3]];
        out.push({face:face.id,vertices,orientation,poly:cascadeSharedTetra(vertices.map(v=>v.oldPosition))});
      }
    }
  }
  return out;
}

function integratedLabel(primitive:CascadeFluxPrimitive,poly:CascadePoly,label:(v:CascadeFluxVertex)=>number):number {
  const v=primitive.vertices,o=v[0].oldPosition,rows=v.slice(1).map(p=>sub3(p.oldPosition,o)),values=v.slice(1).map(p=>label(p)-label(v[0]));
  const det=determinant(rows[0],rows[1],rows[2]);
  const gradient=[0,1,2].map(d=>{
    const c=rows.map((r,k)=>r.map((x,j)=>j===d?values[k]:x) as CascadeVec3);return determinant(c[0],c[1],c[2])/det;
  }) as CascadeVec3;
  const m=cascadeMoments(poly);return label(v[0])*m.volume+dot3(gradient,sub3(m.first,scale(o,m.volume)));
}

/** Check the oriented face chain against positive whole-receiver donations,
 * separating resident water from the one source birth transaction in each
 * region. Labels survive clipping through their original affine barycentrics.
 * A supplied constant carrier is a declared analytic control, not an inferred
 * replacement for the actual physical empty-region carrier. */
export function cascadeAuditEndpoint(a:CascadeSharedAllocation,input:CascadePiece[],dt:number,sourceSpeed:number|null,constantControl:CascadeVec3|null=null):CascadeEndpointAudit {
  if(constantControl&&(!a.partition.uniformControl||constantControl.some((v,d)=>v!==a.partition.uniformControl![d])||input.some(p=>p.velocity.some((v,k)=>Math.abs(v-constantControl[Math.floor(k/2)])>1e-12))))throw new Error('Constant endpoint qualification requires the actual declared uniform transport carrier');
  const began=performance.now(),primitives=cascadeLabeledFacePrimitives(a,dt),inputs=input.map(p=>({poly:p.poly,virtual:false}));
  if(sourceSpeed!==null&&sourceSpeed>0)inputs.push({poly:cascadeBox([1.125,2.5,2.75],[1.25,2.625,3.25]),virtual:true});
  const flux=a.partition.faces.map(()=>({resident:0,source:0,first:[0,0,0] as CascadeVec3,time:0})),cache=new Map<string,CascadeVec3>();
  for(const primitive of primitives){const bounds=cascadeBounds(primitive.poly);
    for(const donor of inputs){const b=cascadeBounds(donor.poly);if(bounds.lo.some((v,d)=>v>=b.hi[d]||bounds.hi[d]<=b.lo[d]))continue;
      const clipped=cascadeSharedIntersection(primitive.poly,donor.poly,cache);if(!clipped.faces.length)continue;
      const m=cascadeMoments(clipped),f=flux[primitive.face],s=primitive.orientation;
      f[donor.virtual?'source':'resident']+=s*m.volume;
      for(let d=0;d<3;d++)f.first[d]+=s*integratedLabel(primitive,clipped,v=>v.crossingPosition[d]);
      f.time+=s*integratedLabel(primitive,clipped,v=>v.crossingTime);
    }
  }
  let maximumChainError=0,sourceVolume=0;
  const regions=a.partition.regions.map(region=>{
    const old=region.wet===null?{volume:0,first:[0,0,0] as CascadeVec3}:cascadeMoments(region.poly);
    let residentVolume=old.volume,sourceVolume=0;
    let first=constantControl?add(old.first,scale(constantControl,dt*old.volume)):null;
    for(const face of a.partition.faces){if(face.owner!==region.id&&face.neighbor!==region.id)continue;const sign=face.owner===region.id?1:-1,f=flux[face.id];
      residentVolume-=sign*f.resident;sourceVolume-=sign*f.source;
      if(first&&constantControl)first=sub3(first,scale(add(f.first,scale(constantControl,dt*(f.resident+f.source)-f.time)),sign));
    }
    const donations=a.donors.filter(d=>d.region===region.id),resident=donations.filter(d=>!d.virtual).reduce((s,d)=>s+d.volume,0),source=donations.filter(d=>d.virtual).reduce((s,d)=>s+d.volume,0);
    const chainError=Math.max(Math.abs(residentVolume-resident),Math.abs(sourceVolume-source));maximumChainError=Math.max(maximumChainError,chainError);
    if(chainError>1e-11)throw Object.assign(new Error(`Signed face-chain/positive receiver volume mismatch in region ${region.id}: ${chainError}`),{endpoint:{region,old,residentVolume,sourceVolume,resident,source,flux,primitives}});
    return {region:region.id,volume:resident+source,residentVolume,sourceVolume,first,chainError};
  });
  sourceVolume=regions.reduce((s,r)=>s+r.sourceVolume,0);
  if(Math.abs(sourceVolume-a.incomingVolume)>1e-11)throw new Error('Endpoint source birth measure differs from the single positive source transaction');
  return {status:constantControl?'constant-control-qualified':'INCONCLUSIVE',reason:constantControl?'Declared uniform carrier startup; endpoint balance is analytic.':'Stage fields are retained, but the general full-affine crossing-history/reference kernel remains unqualified; no endpoint motion pass.',regions,primitives,maximumChainError,sourceVolume,milliseconds:performance.now()-began};
}

/** Retain the final vertex-averaged field as actual fixed tetrahedral carriers,
 * rather than pretending the earlier discarded extension is still used.
 * This checks its face integral and divergence wherever newly arriving liquid
 * would live. Failure is a production construction stop, not a motion warning.
 */
export function cascadeCheckActualCarrier(a:CascadeSharedAllocation,endpoint:CascadePiece[],h:number,dt:number):CascadeCarrierAudit {
  // Historical endpoint experiment audit only: its vertex/back-displacement
  // field differs from the finite-patch stage.fields carrier. Never use it to
  // qualify that carrier or impose an all-empty incompressibility requirement.
  if(a.partition.construction)throw new Error('INCONCLUSIVE: legacy displacement carrier audit differs from retained finite-patch stage fields');
  const began=performance.now(),subregions:CascadeCarrierAudit['subregions']=[],cache=new Map<string,CascadeVec3>();let maximumTraceError=0,maximumWetDivergence=0;
  const value=(id:number)=>scale(sub3(a.partition.vertices[id].point,a.partition.vertices[id].back),1/dt);
  for(const face of a.partition.faces){
    const points=face.vertices.map(id=>a.partition.vertices[id].point),velocities=face.vertices.map(value),center=scale(points.reduce(add,[0,0,0]),1/points.length),mean=scale(velocities.reduce(add,[0,0,0]),1/points.length),n=scale(face.plane.normal,1/Math.hypot(...face.plane.normal));let integral=0;
    for(let i=0;i<points.length;i++){const j=(i+1)%points.length,area=Math.hypot(...cross3(sub3(points[i],center),sub3(points[j],center)))/2;integral+=area*dot3(add(add(velocities[i],velocities[j]),mean),n)/3;}
    // A mismatch on an unoccupied outer halo is not a liquid failure. Check
    // traces incident to a region that actually receives positive material.
    const touched=a.donors.some(d=>d.region===face.owner||d.region===face.neighbor);
    if(touched)maximumTraceError=Math.max(maximumTraceError,Math.abs(integral-face.flux));
  }
  for(const region of a.partition.regions){if(region.wet!==null)continue;const arrivals=endpoint.filter(p=>p.cell.every((v,d)=>v===region.cell[d]));if(!arrivals.length)continue;
    const ids=[...new Set(a.partition.faces.filter(f=>f.owner===region.id||f.neighbor===region.id).flatMap(f=>f.vertices))],center=scale(ids.map(id=>a.partition.vertices[id].point).reduce(add,[0,0,0]),1/ids.length),centerValue=scale(ids.map(value).reduce(add,[0,0,0]),1/ids.length);
    for(const face of a.partition.faces){if(face.owner!==region.id&&face.neighbor!==region.id)continue;const oriented=face.owner===region.id?face.vertices:face.vertices.slice().reverse(),fc=scale(oriented.map(id=>a.partition.vertices[id].point).reduce(add,[0,0,0]),1/oriented.length),fv=scale(oriented.map(value).reduce(add,[0,0,0]),1/oriented.length);
      for(let i=0;i<oriented.length;i++){
        const p=oriented[i],q=oriented[(i+1)%oriented.length],points=[center,fc,a.partition.vertices[p].point,a.partition.vertices[q].point],values=[centerValue,fv,value(p),value(q)],rows=points.slice(1).map(p=>sub3(p,center)),det=determinant(rows[0],rows[1],rows[2]);if(det===0)throw new Error('Actual fixed carrier tetrahedron is degenerate');
        const gradient=[0,1,2].map(k=>[0,1,2].map(d=>{const replaced=rows.map((r,j)=>r.map((v,e)=>e===d?values[j+1][k]-centerValue[k]:v) as CascadeVec3);return determinant(replaced[0],replaced[1],replaced[2])/det;}) as CascadeVec3),intercept=centerValue.map((v,k)=>v-dot3(gradient[k],center)) as CascadeVec3;
        const tet=cascadeSharedTetra(points),bounds=cascadeBounds(tet);let occupiedVolume=0;
        for(const arrival of arrivals){const b=cascadeBounds(arrival.poly);if(bounds.lo.some((v,d)=>v>=b.hi[d]||bounds.hi[d]<=b.lo[d]))continue;const clipped=cascadeSharedIntersection(tet,arrival.poly,cache);if(clipped.faces.length)occupiedVolume+=cascadeMoments(clipped).volume;}
        if(occupiedVolume>0){maximumWetDivergence=Math.max(maximumWetDivergence,Math.abs(gradient.reduce((s,g,k)=>s+g[k],0)));subregions.push({region:region.id,points,intercept,gradient,occupiedVolume});}
      }
    }
  }
  const audit={maximumTraceError,maximumWetDivergence,subregions,milliseconds:performance.now()-began};
  if(maximumTraceError>1e-9||maximumWetDivergence>1e-7)throw Object.assign(new Error(`Actual newly wetted carrier is not coherent/incompressible: face integral error ${maximumTraceError}, divergence ${maximumWetDivergence}`),{carrier:audit});
  return audit;
}
