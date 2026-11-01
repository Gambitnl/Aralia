/** Exact occupied geometry for the isolated cascade experiment.
 * Water owns convex pieces inside fixed grid cells. Both sides of a thin sheet
 * remain real planes; no density contour thickens or discards its material.
 * Only moments through degree two are integrated, for the low-order carrier.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 08/10/2026, 09:53:39
 * Dependents: systems/world3d/river/cascadeRuntimeV1.ts, systems/world3d/river/cascadeRuntimeV1Projection.ts, systems/world3d/river/cascadeRuntimeV1ReceiverValidation.ts, systems/world3d/river/cascadeRuntimeV1Reconstruction.ts, systems/world3d/river/cascadeRuntimeV1SharedRemap.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export type CascadeVec3 = [number, number, number];
export interface CascadePlane { normal: CascadeVec3; offset: number;exact?:[string,string,string,string] }
export interface CascadePoly { faces: CascadeVec3[][]; planes: CascadePlane[] }
export interface CascadeMoments { volume: number; first: CascadeVec3; second: number[][] }
export const dot3 = (a: readonly number[], b: readonly number[]) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const sub3 = (a: readonly number[], b: readonly number[]): CascadeVec3 => [a[0]-b[0],a[1]-b[1],a[2]-b[2]];
export const cross3 = (a: readonly number[], b: readonly number[]): CascadeVec3 => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function unique(points: CascadeVec3[]): CascadeVec3[] {
  return points.filter((p,i)=>!points.slice(0,i).some(q=>p.every((v,d)=>v===q[d])));
}
export function cascadeBox(lo: CascadeVec3, hi: CascadeVec3): CascadePoly {
  if(lo.some((v,d)=>!(hi[d]>v))) throw new Error('Positive finite geometry required');
  const vertices=Array.from({length:8},(_,i)=>lo.map((v,d)=>(i&(1<<d))?hi[d]:v) as CascadeVec3);
  return {faces:[[0,4,6,2],[1,3,7,5],[0,1,5,4],[2,6,7,3],[0,2,3,1],[4,5,7,6]].map(f=>f.map(i=>vertices[i])),
    planes:Array.from({length:6},(_,f)=>{const d=Math.floor(f/2),n: CascadeVec3=[0,0,0];n[d]=f%2?1:-1;return {normal:n,offset:f%2?hi[d]:-lo[d]};})};
}
export function cascadeClip(poly: CascadePoly, plane: CascadePlane): CascadePoly {
  if(!poly.faces.length)return poly;
  const points=poly.faces.flat(),distance=(p: CascadeVec3)=>plane.offset-dot3(plane.normal,p),ds=points.map(distance);
  if(ds.every(d=>d>=0))return poly;
  if(ds.every(d=>d<=0))return {faces:[],planes:[]};
  const faces: CascadeVec3[][]=[],planes: CascadePlane[]=[],capPoints:CascadeVec3[]=[];
  for(let f=0;f<poly.faces.length;f++){
    const face=poly.faces[f],out: CascadeVec3[]=[];
    for(let i=0;i<face.length;i++){
      const a=face[i],b=face[(i+1)%face.length],da=distance(a),db=distance(b);
      if(da>=0)out.push(a);if(da===0)capPoints.push(a);
      if(da*db<0){const t=da/(da-db),p=a.map((v,d)=>v+t*(b[d]-v)) as CascadeVec3;
        // An axis plane owns its exact constrained coordinate. This constructs
        // incidence; it does not snap unrelated near-wall material.
        const axes=plane.normal.flatMap((v,d)=>v!==0?[d]:[]);if(axes.length===1)p[axes[0]]=plane.offset/plane.normal[axes[0]];
        out.push(p);capPoints.push(p);}
    }
    const u=unique(out);if(u.length>=3){faces.push(u);planes.push(poly.planes[f]);}
  }
  const cap=unique(capPoints);
  if(cap.length>=3){
    const center=cap[0].map((_,d)=>cap.reduce((s,p)=>s+p[d],0)/cap.length) as CascadeVec3;
    const length=Math.hypot(...plane.normal),n=plane.normal.map(v=>v/length) as CascadeVec3;
    const u=cross3(n,Math.abs(n[0])<.8?[1,0,0]:[0,1,0]),v=cross3(n,u);
    cap.sort((a,b)=>Math.atan2(dot3(sub3(a,center),v),dot3(sub3(a,center),u))-Math.atan2(dot3(sub3(b,center),v),dot3(sub3(b,center),u)));
    faces.push(cap);planes.push({normal:[...plane.normal],offset:plane.offset});
  }
  return {faces,planes};
}
export function cascadeIntersect(a: CascadePoly,b: CascadePoly): CascadePoly {
  let result=a;for(const p of b.planes){result=cascadeClip(result,p);if(!result.faces.length)break;}return result;
}
export function cascadeMoments(poly: CascadePoly): CascadeMoments {
  const out: CascadeMoments={volume:0,first:[0,0,0],second:Array.from({length:3},()=>[0,0,0])};
  const vertices=poly.faces.flat();if(!vertices.length)return out;
  // Local tetrahedra avoid subtracting nearly equal large global volumes.
  const c=vertices[0].map((_,d)=>vertices.reduce((s,p)=>s+p[d],0)/vertices.length) as CascadeVec3;
  for(const face of poly.faces)for(let i=1;i<face.length-1;i++){
    const p=[c,face[0],face[i],face[i+1]],V=dot3(sub3(p[1],c),cross3(sub3(p[2],c),sub3(p[3],c)))/6;
    if(V < -1e-16)throw new Error('Inverted convex donor face');if(V<=0)continue;
    out.volume+=V;
    const sum=[0,1,2].map(d=>p.reduce((s,q)=>s+q[d],0));
    for(let d=0;d<3;d++){
      out.first[d]+=V*sum[d]/4;
      for(let e=0;e<3;e++)out.second[d][e]+=V*(sum[d]*sum[e]+p.reduce((s,q)=>s+q[d]*q[e],0))/20;
    }
  }
  if(poly.faces.length&&!(out.volume>0))throw new Error('Positive geometry below representable moment capacity');
  return out;
}
export function cascadeBounds(poly: CascadePoly): {lo: CascadeVec3;hi: CascadeVec3} {
  const v=poly.faces.flat();return {lo:[0,1,2].map(d=>Math.min(...v.map(p=>p[d]))) as CascadeVec3,hi:[0,1,2].map(d=>Math.max(...v.map(p=>p[d]))) as CascadeVec3};
}
export function cascadeMap(poly: CascadePoly,scale: CascadeVec3,shift: CascadeVec3): CascadePoly {
  return {faces:poly.faces.map(f=>f.map(p=>p.map((v,d)=>scale[d]*v+shift[d]) as CascadeVec3)),
    planes:poly.planes.map(p=>{const n=p.normal.map((v,d)=>v/scale[d]) as CascadeVec3;return {normal:n,offset:p.offset+dot3(n,shift)};})};
}
export function cascadeCellSplit(poly: CascadePoly,h: number): {cell: CascadeVec3;poly: CascadePoly}[] {
  const {lo,hi}=cascadeBounds(poly),out: {cell: CascadeVec3;poly: CascadePoly}[]=[];
  for(let x=Math.floor(lo[0]/h);x<Math.ceil(hi[0]/h);x++)for(let y=Math.floor(lo[1]/h);y<Math.ceil(hi[1]/h);y++)for(let z=Math.floor(lo[2]/h);z<Math.ceil(hi[2]/h);z++){
    const cell: CascadeVec3=[x,y,z];let p=poly;
    for(let d=0;d<3;d++){const upper: CascadeVec3=[0,0,0],lower: CascadeVec3=[0,0,0];upper[d]=1;lower[d]=-1;p=cascadeClip(p,{normal:upper,offset:(cell[d]+1)*h});p=cascadeClip(p,{normal:lower,offset:-cell[d]*h});}
    if(p.faces.length)out.push({cell,poly:p});
  }
  return out;
}
export function cascadeFaceArea(face: CascadeVec3[]): number {
  let area=0;for(let i=1;i<face.length-1;i++)area+=Math.hypot(...cross3(sub3(face[i],face[0]),sub3(face[i+1],face[0])))/2;return area;
}
export function cascadeContactArea(a: CascadePoly,b: CascadePoly,axis: number,offset: number): number {
  const face=a.faces.find(f=>f.every(p=>Math.abs(p[axis]-offset)<2e-13));if(!face)return 0;
  let result=face;
  for(const plane of b.planes){
    const out: CascadeVec3[]=[];for(let i=0;i<result.length;i++){
      const p=result[i],q=result[(i+1)%result.length],dp=plane.offset-dot3(plane.normal,p),dq=plane.offset-dot3(plane.normal,q);
      if(dp>=-2e-14)out.push(p);if(dp*dq<0){const t=dp/(dp-dq);out.push(p.map((v,d)=>v+t*(q[d]-v)) as CascadeVec3);}
    }result=unique(out);if(result.length<3)return 0;
  }
  return cascadeFaceArea(result);
}
/** One identity for a plane and its reverse orientation. Axis coordinates stay exact. */
export function cascadePlaneKey(plane:CascadePlane):string {
  const axis=plane.normal.findIndex(v=>v!==0);if(axis<0)throw new Error('Plane normal must be nonzero');
  const scale=plane.normal[axis];return [...plane.normal.map(v=>v/scale),plane.offset/scale].join(',');
}
export function cascadeFacePatch(face:CascadeVec3[],planes:CascadePlane[]):CascadeVec3[] {
  let result=face;for(const p of planes){const out:CascadeVec3[]=[];
    for(let i=0;i<result.length;i++){const a=result[i],b=result[(i+1)%result.length],da=p.offset-dot3(p.normal,a),db=p.offset-dot3(p.normal,b);
      if(da>=0)out.push(a);if(da*db<0){const t=da/(da-db),q=a.map((v,d)=>v+t*(b[d]-v)) as CascadeVec3;
        const axes=p.normal.flatMap((v,d)=>v!==0?[d]:[]);if(axes.length===1)q[axes[0]]=p.offset/p.normal[axes[0]];out.push(q);}}
    result=unique(out);if(result.length<3)return [];
  }return result;
}
