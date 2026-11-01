/** Keeps the volume of a bounded convex water region separate from its drawing.
 * Exact retained intersections verify plane incidence, inward/outward sides,
 * face turns and closed edges before positive tetrahedra contribute storage.
 * This does not choose solid material, connected ownership or water forces.
 * The arithmetic cap rejects unresolved input rather than rounding its water.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 16/10/2026, 12:05:03
 * Dependents: None (Orphan)
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {cascadeSharedExactBoundary,type CascadeHomogeneousVertex} from './cascadeRuntimeV1SharedRemap';
import {type CascadePoly,type CascadePlane} from './cascadeRuntimeV1Geometry';

export interface CascadeRational {n:bigint;d:bigint}
const gcd=(a:bigint,b:bigint):bigint=>{a=a<0n?-a:a;b=b<0n?-b:b;while(b){const r=a%b;a=b;b=r;}return a;};
export class CascadeExactArithmetic {
  constructor(readonly maximumBits=4096){if(!Number.isInteger(maximumBits)||maximumBits<8||maximumBits>4096)throw Error('Bounded exact arithmetic requires8..4096 bits');}
  q(n:bigint,d=1n):CascadeRational {
    if(d===0n)throw Error('Zero exact denominator');if(d<0n){n=-n;d=-d;}
    const g=gcd(n,d);n/=g;d/=g;
    if((n<0n?-n:n).toString(2).length>this.maximumBits||d.toString(2).length>this.maximumBits)throw Error('Exact storage arithmetic bit cap exceeded');
    return {n,d};
  }
  add(a:CascadeRational,b:CascadeRational){return this.q(a.n*b.d+b.n*a.d,a.d*b.d);}
  sub(a:CascadeRational,b:CascadeRational){return this.q(a.n*b.d-b.n*a.d,a.d*b.d);}
  mul(a:CascadeRational,b:CascadeRational){return this.q(a.n*b.n,a.d*b.d);}
  div(a:CascadeRational,b:CascadeRational){return this.q(a.n*b.d,a.d*b.n);}
  equal(a:CascadeRational,b:CascadeRational){return a.n===b.n&&a.d===b.d;}
  text(a:CascadeRational){return `${a.n}/${a.d}`;}
  dyadic(x:number):CascadeRational {
    if(!Number.isFinite(x))throw Error('Finite exact input required');if(x===0)return this.q(0n);
    const view=new DataView(new ArrayBuffer(8));view.setFloat64(0,x);const b=view.getBigUint64(0),e=Number((b>>52n)&2047n),m=(b&((1n<<52n)-1n))+(e?1n<<52n:0n),k=e?e-1075:-1074,n=(b>>63n?-1n:1n)*m;
    return k>=0?this.q(n<<BigInt(k)):this.q(n,1n<<BigInt(-k));
  }
}
export type CascadeRationalPoint=[CascadeRational,CascadeRational,CascadeRational];
type Point=CascadeRationalPoint;

/** Oriented area is rational even when the face's Euclidean area involves a
 * square root. A shared flux can therefore use one exact area vector. */
export function cascadeExactFaceAreaVector(face:Point[],a=new CascadeExactArithmetic()):Point{
  if(face.length>64)throw Error('Exact face vertex cap exceeded');
  const out:Point=[a.q(0n),a.q(0n),a.q(0n)];
  for(let i=0;i<face.length;i++)for(let d=0;d<3;d++){
    const u=(d+1)%3,v=(d+2)%3,next=face[(i+1)%face.length];
    out[d]=a.add(out[d],a.div(a.sub(a.mul(face[i][u],next[v]),a.mul(face[i][v],next[u])),a.q(2n)));
  }return out;
}
/** Integrates outward hydrostatic head traction on a planar convex face.
 * Clip to the wet halfspace first: pressure vanishes at the free surface.
 * This geometric integral does not advance water or enforce wall velocity. */
export function cascadeExactHeadTraction(face:Point[],level:CascadeRational,a=new CascadeExactArithmetic()):Point{
  const zero=a.q(0n),out:Point=[zero,zero,zero];
  if(face.length>64)throw Error('Exact face vertex cap exceeded');
  if(face.some(p=>a.sub(level,p[1]).n<0n))throw Error('Head traction requires a wetted face');
  for(let i=1;i+1<face.length;i++){
    const triangle=[face[0],face[i],face[i+1]],area=cascadeExactFaceAreaVector(triangle,a);
    const meanHead=a.sub(level,a.div(triangle.reduce((sum,p)=>a.add(sum,p[1]),zero),a.q(3n)));
    for(let d=0;d<3;d++)out[d]=a.add(out[d],a.mul(meanHead,area[d]));
  }return out;
}
/** Clips a face using a physical halfspace, retaining exact constructed edge
 * intersections. Edge/point contact has zero area and never connects water. */
export function cascadeExactFaceCut(face:Point[],normal:Point,offset:CascadeRational,a=new CascadeExactArithmetic()):Point[]{
  if(face.length>64)throw Error('Exact face vertex cap exceeded');
  const out:Point[]=[],distance=(p:Point)=>p.reduce((q,n,d)=>a.sub(q,a.mul(n,normal[d])),offset);
  for(let i=0;i<face.length;i++){
    const u=face[i],v=face[(i+1)%face.length],du=distance(u),dv=distance(v);
    if(du.n>=0n)out.push(u);
    if(du.n*dv.n<0n){const t=a.div(du,a.sub(du,dv));out.push(u.map((n,d)=>a.add(n,a.mul(t,a.sub(v[d],n)))) as Point);}
  }
  if(out.length>64)throw Error('Exact face construction vertex cap exceeded');
  return out.filter((p,i)=>!i||p.some((n,d)=>!a.equal(n,out[i-1][d]))).filter((p,i,list)=>list.length===1||i!==list.length-1||p.some((n,d)=>!a.equal(n,list[0][d])));
}
/** Constructs one common face polygon for coplanar convex neighbors. Projection
 * chooses coordinates only; coplanarity and area retain the actual 3D face. */
export function cascadeExactFaceIntersection(face:Point[],clip:Point[],axis:number,a=new CascadeExactArithmetic()):Point[]{
  if(!Number.isInteger(axis)||axis<0||axis>2)throw Error('Exact face projection axis is invalid');
  const normal=cascadeExactFaceAreaVector(face,a),other=cascadeExactFaceAreaVector(clip,a);
  if(normal.every(n=>n.n===0n)||other.every(n=>n.n===0n))return[];
  if(normal[axis].n===0n||other[axis].n===0n)throw Error('Exact face projection is degenerate');
  for(const p of [...face,...clip])if(p.reduce((sum,n,d)=>a.add(sum,a.mul(normal[d],a.sub(n,face[0][d]))),a.q(0n)).n!==0n)throw Error('Exact face intersection requires coplanar input');
  const [u,v]=[0,1,2].filter(d=>d!==axis),sign=other[axis].n*(axis===1?-1n:1n)>0n?1n:-1n;
  for(const polygon of [face,clip]){
    const direction=cascadeExactFaceAreaVector(polygon,a)[axis].n*(axis===1?-1n:1n)>0n?1n:-1n;
    for(let i=0;i<polygon.length;i++){
      const p=polygon[i],q=polygon[(i+1)%polygon.length],r=polygon[(i+2)%polygon.length];
      if(a.sub(a.mul(a.sub(q[u],p[u]),a.sub(r[v],q[v])),a.mul(a.sub(q[v],p[v]),a.sub(r[u],q[u]))).n*direction<0n)throw Error('Exact face input is not convex');
    }
  }
  let out=face;
  for(let i=0;i<clip.length;i++){
    const p=clip[i],q=clip[(i+1)%clip.length],n:Point=[a.q(0n),a.q(0n),a.q(0n)];
    n[u]=a.mul(a.sub(q[v],p[v]),a.q(sign));n[v]=a.mul(a.sub(p[u],q[u]),a.q(sign));
    out=cascadeExactFaceCut(out,n,a.add(a.mul(n[u],p[u]),a.mul(n[v],p[v])),a);if(out.length<3)return out;
  }return out;
}
export interface CascadeExactStorage {
  volume:CascadeRational;
  first:Point;
  witness:Point;
  faces:CascadeHomogeneousVertex[][];
  positiveTetrahedra:number;
  zeroAreaSupportFaces:number;
}
export function cascadeExactStorage(poly:CascadePoly,a=new CascadeExactArithmetic()):CascadeExactStorage|null {
  if(poly.planes.length>30)throw Error('Exact storage support-plane cap exceeded');
  for(const plane of poly.planes){
    const row=plane.exact?plane.exact.map(n=>a.q(BigInt(n))):[...plane.normal,plane.offset].map(n=>a.dyadic(n));
    if(row.slice(0,3).every(n=>n.n===0n))throw Error('Exact storage requires a nonzero support plane');
  }
  const boundary=cascadeSharedExactBoundary(poly);if(!boundary.faces.length)return null;
  const zero=a.q(0n),four=a.q(4n),six=a.q(6n);
  const point=(h:CascadeHomogeneousVertex):Point=>h.slice(0,3).map(n=>a.q(BigInt(n),BigInt(h[3]))) as Point;
  const add=(u:Point,v:Point)=>u.map((x,d)=>a.add(x,v[d])) as Point,sub=(u:Point,v:Point)=>u.map((x,d)=>a.sub(x,v[d])) as Point;
  const dot=(u:Point,v:Point)=>u.reduce((sum,x,d)=>a.add(sum,a.mul(x,v[d])),zero);
  const cross=(u:Point,v:Point)=>[a.sub(a.mul(u[1],v[2]),a.mul(u[2],v[1])),a.sub(a.mul(u[2],v[0]),a.mul(u[0],v[2])),a.sub(a.mul(u[0],v[1]),a.mul(u[1],v[0]))] as Point;
  const planeRow=(p:CascadePlane)=>p.exact?p.exact.map(n=>a.q(BigInt(n))):[...p.normal,p.offset].map(n=>a.dyadic(n));
  const rows=boundary.poly.planes.map(planeRow),vertices=[...new Map(boundary.faces.flat().map(h=>[h.join('/'),h])).values()];
  const witness=vertices.map(point).reduce(add,[zero,zero,zero]).map(v=>a.div(v,a.q(BigInt(vertices.length)))) as Point;
  // A strict interior witness is required for the positive fan. No physical
  // tolerance excuses a vertex or witness outside the retained input planes.
  for(const row of rows)if(a.sub(row[3],dot(row.slice(0,3) as Point,witness)).n<=0n)throw Error('Exact storage witness is not strictly interior');
  const edges=new Map<string,{count:number,balance:number}>(),faces:CascadeHomogeneousVertex[][]=[];
  let volume=zero,first:Point=[zero,zero,zero],positiveTetrahedra=0,zeroAreaSupportFaces=0;
  for(let f=0;f<boundary.faces.length;f++){
    const face=boundary.faces[f],points=face.map(point),normal=rows[f].slice(0,3) as Point;
    for(const p of points){
      if(!a.equal(dot(normal,p),rows[f][3]))throw Error('Exact constructed face is not incident to its plane');
      for(const row of rows)if(a.sub(row[3],dot(row.slice(0,3) as Point,p)).n<0n)throw Error('Exact constructed vertex lies outside its region');
    }
    let hasTurn=false;
    for(let i=0;i<points.length;i++){
      const turn=dot(normal,cross(sub(points[(i+1)%points.length],points[i]),sub(points[(i+2)%points.length],points[(i+1)%points.length])));
      if(turn.n<0n)throw Error('Exact storage face has an inverted turn');if(turn.n>0n)hasTurn=true;
    }
    if(!hasTurn){zeroAreaSupportFaces++;continue;}
    faces.push(face);
    for(let i=0;i<face.length;i++){
      const u=face[i].join('/'),v=face[(i+1)%face.length].join('/');if(u===v)throw Error('Repeated exact storage edge vertex');
      const key=u<v?u+'|'+v:v+'|'+u,e=edges.get(key)??{count:0,balance:0};e.count++;e.balance+=u<v?1:-1;edges.set(key,e);
    }
    for(let i=1;i<points.length-1;i++){
      const p=[points[0],points[i],points[i+1]],v=a.div(dot(sub(p[0],witness),cross(sub(p[1],witness),sub(p[2],witness))),six);
      if(v.n<0n)throw Error('Exact storage fan has an inverted tetrahedron');if(v.n===0n)continue;
      positiveTetrahedra++;volume=a.add(volume,v);
      const center=p.reduce(add,witness).map(x=>a.div(x,four)) as Point;
      first=add(first,center.map(x=>a.mul(x,v)) as Point);
    }
  }
  if([...edges.values()].some(e=>e.count!==2||e.balance!==0))throw Error('Exact storage boundary is not closed and oriented');
  if(volume.n<=0n)throw Error('Exact storage has no positive volume');
  return {volume,first,witness,faces,positiveTetrahedra,zeroAreaSupportFaces};
}
