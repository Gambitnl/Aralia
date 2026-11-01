/**
 * Checks that a backtraced receiver really bounds one star-shaped water region.
 * SharedRemap calls this before constructing positive tetrahedral donors. A
 * closed connected embedded oriented surface, with its kernel strictly behind
 * every outward triangle, has a non-overlapping radial fan covering its inside.
 * This certifies the stored straight triangles only, not a curved trajectory or
 * the accuracy of a later clipping routine. No signed-volume cancellation is
 * used to establish ownership. Runtime is quadratic in boundary triangle count.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/10/2026, 09:53:39
 * Dependents: systems/world3d/river/cascadeRuntimeV1SharedRemap.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { CascadeVec3 } from './cascadeRuntimeV1Geometry';

export interface CascadeReceiverTriangle {
  ids: readonly [number, number, number];
  points: readonly [CascadeVec3, CascadeVec3, CascadeVec3];
}
export interface CascadeReceiverValidation {
  triangleCount: number; vertexCount: number; edgeCount: number;
  pairChecks: number; exactPredicateFallbacks: number;
}
type I3 = [bigint, bigint, bigint];
type HPoint = { n: I3; d: bigint };
const sub = (a: I3, b: I3): I3 => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const cross = (a: I3, b: I3): I3 => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot = (a: I3, b: I3) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const det = (a: I3,b: I3,c: I3,d: I3) => dot(cross(sub(b,a),sub(c,a)),sub(d,a));
const sign = (a: bigint) => a===0n ? 0 : a>0n ? 1 : -1;
const view = new DataView(new ArrayBuffer(8));
function dyadic(x: number): [bigint, number] {
  if (!Number.isFinite(x)) throw new Error('Receiver has a nonfinite coordinate');
  if (x===0) return [0n,0];
  view.setFloat64(0,x); const bits=view.getBigUint64(0), e=Number((bits>>52n)&2047n);
  return [(bits>>63n ? -1n : 1n)*((bits&((1n<<52n)-1n))+(e ? 1n<<52n : 0n)),e ? e-1075 : -1074];
}
const homogeneous = (p:I3):HPoint => ({n:p,d:1n});
function projectAxis(t: readonly I3[]):number {
  const n=cross(sub(t[1],t[0]),sub(t[2],t[0]));
  const axis=n.findIndex(v=>v!==0n);
  if(axis<0) throw new Error('Receiver contains a degenerate triangle');
  return axis;
}
function orient2(a:HPoint,b:HPoint,c:HPoint,drop:number):bigint {
  const u=(drop+1)%3,v=(drop+2)%3;
  const bu=b.n[u]*a.d-a.n[u]*b.d,bv=b.n[v]*a.d-a.n[v]*b.d;
  const cu=c.n[u]*a.d-a.n[u]*c.d,cv=c.n[v]*a.d-a.n[v]*c.d;
  return bu*cv-bv*cu;
}
function onSegment(p:HPoint,a:I3,b:I3):boolean {
  const ap=p.n.map((n,i)=>n-a[i]*p.d) as I3,ab=sub(b,a);
  if(cross(ap,ab).some(n=>n!==0n)) return false;
  return [0,1,2].every(i=>p.n[i]>= (a[i]<b[i]?a[i]:b[i])*p.d && p.n[i]<= (a[i]>b[i]?a[i]:b[i])*p.d);
}
function insideTriangle(p:HPoint,t:readonly I3[],axis:number):boolean {
  const s=t.map((a,i)=>sign(orient2(homogeneous(a),homogeneous(t[(i+1)%3]),p,axis)));
  return s.every(n=>n>=0)||s.every(n=>n<=0);
}
function mix(a:I3,b:I3,n:bigint,d:bigint):HPoint {
  if(d<0n){n=-n;d=-d;}
  return {n:a.map((v,i)=>v*d+(b[i]-v)*n) as I3,d};
}
/** Every edge/face contact must belong to the canonical common simplex. This
 * also rejects coincident nonincident geometry and contact across air, even
 * when its volume is zero. Coplanar checks retain positive overlaps of any size.
 */
function improperPair(a:readonly I3[],b:readonly I3[],shared:I3[]):boolean {
  const allowed=(p:HPoint)=>shared.length===1
    ? p.n.every((n,i)=>n===shared[0][i]*p.d)
    : shared.length===2 && onSegment(p,shared[0],shared[1]);
  const check=(u:readonly I3[],t:readonly I3[])=>{
    const axis=projectAxis(t);
    for(let e=0;e<3;e++) {
      const p=u[e],q=u[(e+1)%3],dp=det(t[0],t[1],t[2],p),dq=det(t[0],t[1],t[2],q);
      if(dp!==0n&&dq!==0n&&sign(dp)===sign(dq))continue;
      if(dp!==0n||dq!==0n) {
        const hit=mix(p,q,dp,dp-dq);
        if(insideTriangle(hit,t,axis)&&!allowed(hit))return true;
        continue;
      }
      // Coplanar segment clipping needs its endpoints and all boundary
      // intersections: these exhaust the extreme points of its overlap.
      for(const v of [p,q])if(insideTriangle(homogeneous(v),t,axis)&&!allowed(homogeneous(v)))return true;
      for(let f=0;f<3;f++) {
        const r=t[f],s=t[(f+1)%3],P=homogeneous(p),Q=homogeneous(q),R=homogeneous(r),S=homogeneous(s);
        const d1=orient2(R,S,P,axis),d2=orient2(R,S,Q,axis),d3=orient2(P,Q,R,axis),d4=orient2(P,Q,S,axis);
        if(sign(d1)*sign(d2)>0||sign(d3)*sign(d4)>0)continue;
        if(d1!==d2) {const hit=mix(p,q,d1,d1-d2);if(!allowed(hit))return true;}
        else if(d1===0n)for(const v of [r,s])if(onSegment(homogeneous(v),p,q)&&!allowed(homogeneous(v)))return true;
      }
    }
    return false;
  };
  return check(a,b)||check(b,a);
}

export function cascadeValidatePositiveReceiverBoundary(
  triangles: readonly CascadeReceiverTriangle[], kernel: CascadeVec3,
): CascadeReceiverValidation {
  if(triangles.length<4)throw new Error('Receiver boundary needs at least four triangles');
  const vertices=new Map<number,CascadeVec3>(),coordinateOwners=new Map<string,number>();
  const edges=new Map<string,{a:number;b:number;faces:number[]}>(),links=new Map<number,Map<number,number[]>>();
  triangles.forEach((t,f)=>{
    if(new Set(t.ids).size!==3)throw new Error(`Receiver triangle ${f} repeats a canonical vertex`);
    t.ids.forEach((id,i)=>{
      if(!Number.isSafeInteger(id)||id<0)throw new Error('Receiver canonical vertex ID is invalid');
      const p=t.points[i];if(p.length!==3||p.some(v=>!Number.isFinite(v)))throw new Error('Receiver has a nonfinite coordinate');
      const old=vertices.get(id);if(old&&old.some((v,d)=>v!==p[d]))throw new Error(`Receiver canonical vertex ${id} has inconsistent coordinates`);
      const key=p.join(',');const owner=coordinateOwners.get(key);
      if(owner!==undefined&&owner!==id)throw new Error('Receiver distinct canonical vertices coincide');
      vertices.set(id,p);coordinateOwners.set(key,id);
      const a=t.ids[(i+1)%3],b=t.ids[(i+2)%3];let link=links.get(id);if(!link){link=new Map();links.set(id,link);}
      link.set(a,[...(link.get(a)??[]),b]);link.set(b,[...(link.get(b)??[]),a]);
      const q=t.ids[(i+1)%3],ek=[id,q].sort((a,b)=>a-b).join(',');const edge=edges.get(ek);
      if(!edge)edges.set(ek,{a:id,b:q,faces:[f]});
      else {if(edge.a!==q||edge.b!==id||edge.faces.length!==1)throw new Error(`Receiver edge ${ek} is not consistently oriented manifold`);edge.faces.push(f);}
    });
  });
  for(const [key,e] of edges)if(e.faces.length!==2)throw new Error(`Receiver boundary is open at edge ${key}`);
  // Edge pairs alone permit pinched vertices. Require each vertex link to be
  // one cycle, and the face adjacency to form one connected closed surface.
  for(const [id,link] of links) {
    if([...link.values()].some(n=>n.length!==2))throw new Error(`Receiver vertex ${id} has nonmanifold link`);
    const seen=new Set<number>(),pending=[link.keys().next().value as number];
    while(pending.length){const v=pending.pop()!;if(seen.has(v))continue;seen.add(v);pending.push(...link.get(v)!);}
    if(seen.size!==link.size)throw new Error(`Receiver vertex ${id} has disconnected link`);
  }
  const adjacency=triangles.map(()=>[] as number[]);
  for(const e of edges.values()){adjacency[e.faces[0]].push(e.faces[1]);adjacency[e.faces[1]].push(e.faces[0]);}
  const seen=new Set<number>(),pending=[0];while(pending.length){const f=pending.pop()!;if(seen.has(f))continue;seen.add(f);pending.push(...adjacency[f]);}
  if(seen.size!==triangles.length)throw new Error('Receiver boundary has disconnected components');
  const all=[...vertices.values(),kernel],parts=all.map(p=>p.map(dyadic));
  const exponents=parts.flat().filter(([n])=>n!==0n).map(([,e])=>e),exponent=Math.min(...exponents);
  const integer=parts.map(p=>p.map(([n,e])=>n===0n?0n:n<<BigInt(e-exponent)) as I3);
  const ints=new Map([...vertices.keys()].map((id,i)=>[id,integer[i]])),k=integer[integer.length-1];
  const exactTriangles=triangles.map(t=>t.ids.map(id=>ints.get(id)!) as [I3,I3,I3]);
  let exactPredicateFallbacks=0;
  triangles.forEach((t,i)=>{
    const [a,b,c]=t.points,u=b.map((v,d)=>v-a[d]),v=c.map((v,d)=>v-a[d]),w=kernel.map((v,d)=>v-a[d]);
    const terms=[u[0]*v[1]*w[2],u[1]*v[2]*w[0],u[2]*v[0]*w[1],-u[2]*v[1]*w[0],-u[1]*v[0]*w[2],-u[0]*v[2]*w[1]];
    const value=terms.reduce((s,x)=>s+x,0),bound=terms.reduce((s,x)=>s+Math.abs(x),0)*Number.EPSILON*64;
    let orientation:number;
    // The filter never treats small positive overlap as zero. Underflow,
    // overflow and near-cancellation fall back to exact stored dyadics.
    if(Number.isFinite(value)&&bound>=Number.MIN_VALUE*64&&Math.abs(value)>bound)orientation=Math.sign(value);
    else {exactPredicateFallbacks++;orientation=sign(det(...exactTriangles[i],k));}
    if(orientation>=0)throw new Error(`Receiver triangle ${i} has absent strict star kernel or degenerate orientation`);
  });
  let pairChecks=0;
  for(let i=0;i<triangles.length;i++)for(let j=i+1;j<triangles.length;j++) {
    const a=triangles[i],b=triangles[j];
    if([0,1,2].some(d=>Math.max(...a.points.map(p=>p[d]))<Math.min(...b.points.map(p=>p[d]))||Math.max(...b.points.map(p=>p[d]))<Math.min(...a.points.map(p=>p[d]))))continue;
    pairChecks++;
    const shared=a.ids.filter(id=>b.ids.includes(id)).map(id=>ints.get(id)!);
    if(shared.length===3||improperPair(exactTriangles[i],exactTriangles[j],shared))throw new Error(`Receiver triangles ${i} and ${j} have improper crossing or overlap`);
  }
  return {triangleCount:triangles.length,vertexCount:vertices.size,edgeCount:edges.size,pairChecks,exactPredicateFallbacks};
}
