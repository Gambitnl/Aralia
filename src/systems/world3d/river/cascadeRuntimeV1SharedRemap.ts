/** Shared transport geometry for W06.
 * Empty regions own no water. A face, its edge predictions and corrected cap
 * have one identity. Positive receiver tetrahedra are admitted only after an
 * oriented closed-boundary and star-kernel check; signed cancellation is never
 * used as a donor allocation. This bounded experiment rejects unresolved cases.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 16/10/2026, 12:05:03
 * Dependents: systems/world3d/river/cascadeExactStorageGeometry.ts, systems/world3d/river/cascadeRuntimeV1.ts, systems/world3d/river/cascadeRuntimeV1Endpoint.ts, systems/world3d/river/cascadeRuntimeV1FinitePatch.ts, systems/world3d/river/cascadeRuntimeV1Reconstruction.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {cascadeBox,cascadeClip,cascadeMoments,cascadeBounds,cascadeFaceArea,cascadePlaneKey,dot3,sub3,cross3,type CascadePoly,type CascadePlane,type CascadeVec3} from './cascadeRuntimeV1Geometry';
import {type CascadePiece,type CascadeSolid} from './cascadeRuntimeV1Projection';
import {cascadeValidatePositiveReceiverBoundary} from './cascadeRuntimeV1ReceiverValidation';
type Region={id:number;cell:CascadeVec3;poly:CascadePoly;wet:number|null};
type Vertex={id:number;point:CascadeVec3;wet:Set<number>;regions:Set<number>;velocity:CascadeVec3;back:CascadeVec3};
export type CascadeSharedFace={id:number;owner:number;neighbor:number|null;vertices:number[];plane:CascadePlane;flux:number;cap:CascadeVec3;capShift:number;triangles:[number,number,number][]};
export interface CascadeStageField {id:number;region:number;wetSector:number|null;poly:CascadePoly;points:CascadeVec3[];values:CascadeVec3[];intercept:CascadeVec3;gradient:CascadeVec3[]}
export interface CascadeStageConstruction {generation:number;dt:number;sourceSpeed:number|null;fields:CascadeStageField[];sharedTraces:{face:number;owner:number;neighbor:number|null;normal:CascadeVec3;values:number[]}[];vertexPredictors:{vertex:number;wetSectors:number[];field:number|null}[];uniformControl:CascadeVec3|null}
export interface CascadeSharedPartition {regions:Region[];faces:CascadeSharedFace[];vertices:Vertex[];constructionMilliseconds:number;inputPlanes:number;maximumCellRegions:number;emptyExtensionTetrahedra:number;uniformControl?:CascadeVec3;construction?:CascadeStageConstruction}
export interface CascadePositiveReceiver {region:number;tets:CascadePoly[];volume:number;kernel:CascadeVec3;maximumCapShift:number}
const scale=(p:CascadeVec3,s:number)=>p.map(v=>v*s) as CascadeVec3;
const add=(a:CascadeVec3,b:CascadeVec3)=>a.map((v,d)=>v+b[d]) as CascadeVec3;
const velocity=(p:CascadePiece,x:CascadeVec3,h:number)=>[0,1,2].map(d=>p.velocity[2*d]+(p.velocity[2*d+1]-p.velocity[2*d])*(x[d]/h-p.cell[d])) as CascadeVec3;
const reversed=(p:CascadePlane):CascadePlane=>({normal:scale(p.normal,-1),offset:-p.offset,...(p.exact?{exact:p.exact.map(n=>String(-BigInt(n))) as [string,string,string,string]}:{})});
function determinant(a:number[][]):number {if(a.length===1)return a[0][0];return a[0].reduce((s,v,i)=>s+(i%2?-1:1)*v*determinant(a.slice(1).map(r=>r.filter((_,j)=>j!==i))),0);}
function integerDet(a:bigint[][]):bigint {if(a.length===1)return a[0][0];return a[0].reduce((s,v,i)=>s+(i%2?-1n:1n)*v*integerDet(a.slice(1).map(r=>r.filter((_,j)=>j!==i))),0n);}
const buffer=new ArrayBuffer(8),view=new DataView(buffer);
let stageGeneration=0;
function dyadic(x:number):[bigint,number]{if(!Number.isFinite(x))throw new Error('Finite canonical coordinate required');if(x===0)return [0n,0];view.setFloat64(0,x);const bits=view.getBigUint64(0),sign=bits>>63n?-1n:1n,e=Number((bits>>52n)&2047n),mantissa=bits&((1n<<52n)-1n);return [sign*(e?mantissa+(1n<<52n):mantissa),e?e-1023-52:-1074];}
function integerMatrix(rows:number[][]):bigint[][] {const parts=rows.map(r=>r.map(dyadic)),e=Math.min(...parts.flat().filter(([n])=>n!==0n).map(([,e])=>e));return parts.map(r=>r.map(([n,k])=>n===0n?0n:n<<BigInt(k-e)));}
const gcd=(a:bigint,b:bigint):bigint=>{a=a<0n?-a:a;b=b<0n?-b:b;while(b){const r=a%b;a=b;b=r;}return a;};
function ratio(n:bigint,d:bigint):number {const bits=Math.max((n<0n?-n:n).toString(2).length,d.toString(2).length),shift=Math.max(0,bits-900);return Number(n>>BigInt(shift))/Number(d>>BigInt(shift));}
/** Canonical intersections use exact dyadic input planes. Shared XYZ rounding
 * occurs once after the construction, rather than independently on every face. */
const exactRow=(p:CascadePlane)=>p.exact?p.exact.map(BigInt):integerMatrix([[...p.normal,p.offset]])[0];
export type CascadeHomogeneousVertex=[string,string,string,string];
function canonicalPoly(poly:CascadePoly,cache:Map<string,CascadeVec3>,allowEmpty=false,exactFaces?:CascadeHomogeneousVertex[][]):CascadePoly {
  // A donor and receiver can share the exact same floor. It is one boundary,
  // even when both inputs carry it; emitting it twice doubles its moment cone.
  // Preserve the sign so opposite halfspaces still describe plane contact.
  const seen=new Set<string>(),planes=poly.planes.filter(p=>{const row=exactRow(p),divisor=row.reduce((g,n)=>gcd(g,n),0n),key=row.map(n=>n/divisor).join('/');if(seen.has(key))return false;seen.add(key);return true;}),vertices:{point:CascadeVec3;incident:Set<number>;homogeneous:bigint[]}[]=[];
  for(let i=0;i<planes.length;i++)for(let j=i+1;j<planes.length;j++)for(let k=j+1;k<planes.length;k++){
    const chosen=[planes[i],planes[j],planes[k]],matrix=chosen.map(exactRow),A=matrix.map(r=>r.slice(0,3));let den=integerDet(A);if(den===0n)continue;
    let ns=[0,1,2].map(d=>integerDet(A.map((r,a)=>r.map((v,b)=>b===d?matrix[a][3]:v))));if(den<0n){den=-den;ns=ns.map(n=>-n);}
    const incident=new Set<number>();let inside=true;
    for(let f=0;f<planes.length;f++){
      if(f===i||f===j||f===k){incident.add(f);continue;}
      const coeff=exactRow(planes[f]),s=coeff[3]*den-coeff.slice(0,3).reduce((s,v,d)=>s+v*ns[d],0n);
      if(s<0n){inside=false;break;}if(s===0n)incident.add(f);
    }
    if(!inside)continue;
    const common=ns.reduce((g,n)=>gcd(g,n),den),key=[...ns.map(n=>n/common),den/common].join('/');let point=cache.get(key);
    if(!point){point=ns.map(n=>ratio(n,den)) as CascadeVec3;cache.set(key,point);}
    const old=vertices.find(v=>v.point===point);if(old)for(const f of incident)old.incident.add(f);else vertices.push({point,incident,homogeneous:[...ns,den]});
  }
  if(vertices.length<4){if(allowEmpty)return {faces:[],planes:[]};throw new Error('Canonical plane construction has no positive three-dimensional region');}
  if(allowEmpty){let positiveDimension=false;for(let i=1;i<vertices.length&&!positiveDimension;i++)for(let j=i+1;j<vertices.length&&!positiveDimension;j++)for(let k=j+1;k<vertices.length&&!positiveDimension;k++)positiveDimension=integerDet([vertices[0],vertices[i],vertices[j],vertices[k]].map(v=>v.homogeneous))!==0n;if(!positiveDimension)return {faces:[],planes:[]};}
  const faces:CascadeVec3[][]=[],outPlanes:CascadePlane[]=[];
  planes.forEach((p,f)=>{const points=vertices.filter(v=>v.incident.has(f)).map(v=>v.point);if(points.length<3)return;
    const c=scale(points.reduce((s,v)=>add(s,v),[0,0,0]),1/points.length),n=scale(p.normal,1/Math.hypot(...p.normal)),u=cross3(n,Math.abs(n[0])<.8?[1,0,0]:[0,1,0]),v=cross3(n,u);
    points.sort((a,b)=>Math.atan2(dot3(sub3(a,c),v),dot3(sub3(a,c),u))-Math.atan2(dot3(sub3(b,c),v),dot3(sub3(b,c),u)));faces.push(points);outPlanes.push(p);
    // Storage verification retains the actual rational intersections. Drawing
    // still uses the same once-rounded coordinates and the existing ordering.
    if(exactFaces)exactFaces.push(points.map(point=>{const h=vertices.find(vertex=>vertex.point===point)!.homogeneous,g=h.reduce((a,b)=>gcd(a,b),0n);return h.map(n=>String(n/g)) as CascadeHomogeneousVertex;}));
  });return {faces,planes:outPlanes};
}
function trianglePlane(f:CascadeVec3[]):CascadePlane {
  const coords=integerMatrix(f),a=coords[0],b=coords[1],c=coords[2],u=b.map((v,d)=>v-a[d]),v=c.map((v,d)=>v-a[d]);
  const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],e=Math.min(...f.flat().map(dyadic).filter(([n])=>n!==0n).map(([,e])=>e));
  let normals=n,offset=n.reduce((s,v,d)=>s+v*a[d],0n);if(e<0)normals=n.map(v=>v<<BigInt(-e));else offset<<=BigInt(e);
  const divisor=normals.reduce((g,n)=>gcd(g,n),offset),row=[...normals,offset].map(v=>v/divisor),max=row.slice(0,3).reduce((a,b)=>a>(b<0n?-b:b)?a:(b<0n?-b:b),0n);
  if(max===0n)throw new Error('Degenerate exact triangle plane');
  return {normal:row.slice(0,3).map(v=>ratio(v,max)) as CascadeVec3,offset:ratio(row[3],max),exact:row.map(String) as [string,string,string,string]};
}
const inside=(point:CascadeVec3,poly:CascadePoly)=>poly.planes.every(p=>dot3(p.normal,point)<=p.offset);
function centroid(poly:CascadePoly):CascadeVec3 {const m=cascadeMoments(poly);return scale(m.first,1/m.volume);}
export function cascadeBuildSharedPartition(pieces:CascadePiece[],solids:CascadeSolid[],h:number,source:boolean):CascadeSharedPartition {
  const began=performance.now(),cells=new Map<string,CascadeVec3>();
  const bounds=pieces.map(p=>cascadeBounds(p.poly));if(source)bounds.push({lo:[1.25,2.5,2.75],hi:[1.25+h,2.625,3.25]});
  for(const b of bounds)for(let x=Math.floor(b.lo[0]/h)-1;x<=Math.floor(b.hi[0]/h)+1;x++)for(let y=Math.floor(b.lo[1]/h)-1;y<=Math.floor(b.hi[1]/h)+1;y++)for(let z=Math.floor(b.lo[2]/h)-1;z<=Math.floor(b.hi[2]/h)+1;z++){
    if(source&&x*h<1.25)continue;cells.set([x,y,z].join(','),[x,y,z]);
  }
  if(cells.size>10000)throw new Error('Reachable transport-neighborhood capacity exceeded');
  const allPlanes=new Map<string,CascadePlane>();for(const p of pieces)for(const plane of p.poly.planes)allPlanes.set(cascadePlaneKey(plane),plane);
  for(const s of solids)for(const p of cascadeBox(s.lo,s.hi).planes)allPlanes.set(cascadePlaneKey(p),p);
  if(source)for(const p of cascadeBox([1.125,2.5,2.75],[1.25,2.625,3.25]).planes)allPlanes.set(cascadePlaneKey(p),p);
  const ordered=[...allPlanes].sort(([a],[b])=>a.localeCompare(b)).map(([,p])=>p),regions:Region[]=[],cache=new Map<string,CascadeVec3>();let maximumCellRegions=0;
  for(const cell of cells.values()){
    let parts=[cascadeBox(scale(cell,h),scale(add(cell,[1,1,1]),h))];
    // A common plane order makes every neighboring face receive the same
    // refinement. Only current interface planes are retained for this step.
    for(const plane of ordered){const next:CascadePoly[]=[];for(const p of parts){const ds=p.faces.flat().map(v=>plane.offset-dot3(plane.normal,v));if(ds.some(v=>v<0)&&ds.some(v=>v>0))next.push(cascadeClip(p,plane),cascadeClip(p,reversed(plane)));else next.push(p);}parts=next;
      if(parts.length>64)throw new Error('Transient partition exceeds 64 regions in one parent cell');}
    maximumCellRegions=Math.max(maximumCellRegions,parts.length);
    for(const p of parts){const poly=canonicalPoly(p,cache),c=centroid(poly);if(solids.some(s=>c.every((v,d)=>v>s.lo[d]&&v<s.hi[d])))continue;
      const owners=pieces.flatMap((wet,i)=>inside(c,wet.poly)?[i]:[]);if(owners.length>1)throw new Error('Transient partition has multiple positive wet owners');
      regions.push({id:regions.length,cell,poly,wet:owners[0]??null});}
  }
  const vertices:Vertex[]=[],vertexIds=new Map<CascadeVec3,number>(),faces:CascadeSharedFace[]=[],faceIds=new Map<string,number>();
  for(const region of regions)region.poly.faces.forEach((polygon,f)=>{
    const ids=polygon.map(point=>{let id=vertexIds.get(point);if(id===undefined){id=vertices.length;vertexIds.set(point,id);vertices.push({id,point,wet:new Set(),regions:new Set(),velocity:[0,0,0],back:point});}vertices[id].regions.add(region.id);if(region.wet!==null)vertices[id].wet.add(region.wet);return id;});
    const key=ids.slice().sort((a,b)=>a-b).join(','),old=faceIds.get(key);
    if(old!==undefined){if(faces[old].neighbor!==null)throw new Error('Non-manifold transient face ownership');faces[old].neighbor=region.id;}
    else{const id=faces.length;faceIds.set(key,id);faces.push({id,owner:region.id,neighbor:null,vertices:ids,plane:region.poly.planes[f],flux:0,cap:[0,0,0],capShift:0,triangles:[]});}
  });
  // Every inside grid interface must have a single face shared by both regions.
  // A missing neighbor at a non-boundary internal cut is a construction failure.
  for(const face of faces)if(face.neighbor===null){const owner=regions[face.owner],c=centroid(owner.poly),n=scale(face.plane.normal,1/Math.hypot(...face.plane.normal));const across=add(c,scale(n,h));
    const index=across.map(v=>Math.floor(v/h)) as CascadeVec3;
    const wall=solids.some(s=>inside(scale(face.vertices.map(id=>vertices[id].point).reduce((s,p)=>add(s,p),[0,0,0]),1/face.vertices.length),cascadeBox(s.lo,s.hi)));
    const sourceFace=source&&cascadePlaneKey(face.plane)==='1,0,0,1.25';
    if(cells.has(index.join(','))&&!wall&&!sourceFace)throw new Error('Common face refinement left an unmatched internal patch');}
  return {regions,vertices,faces,constructionMilliseconds:performance.now()-began,inputPlanes:ordered.length,maximumCellRegions,emptyExtensionTetrahedra:0};
}
function solve3(A:number[][],b:number[]):CascadeVec3 {const den=determinant(A);if(den===0)throw new Error('Empty tetrahedron normal data has no unique affine field');return [0,1,2].map(d=>determinant(A.map((r,i)=>r.map((v,j)=>j===d?b[i]:v)))/den) as CascadeVec3;}
type EmptyTet={ids:number[];points:CascadeVec3[];values:CascadeVec3[];region:number};
/** Empty tetrahedral fields are specified by one affine normal trace per
 * shared triangle. Three incident normals recover each vector vertex value;
 * that supplies all twelve affine coefficients without any air mass/pressure. */
function emptyExtension(partition:CascadeSharedPartition,pieces:CascadePiece[],h:number,sourceSpeed:number|null):EmptyTet[]{
  const {vertices,faces,regions}=partition,position=new Map<number,CascadeVec3>(vertices.map(v=>[v.id,v.point])),guide=new Map<number,CascadeVec3>(vertices.map(v=>[v.id,v.velocity]));
  const centers=new Map<number,number>();for(const face of faces){const id=vertices.length+face.id;centers.set(face.id,id);position.set(id,scale(face.vertices.map(i=>vertices[i].point).reduce((s,p)=>add(s,p),[0,0,0]),1/face.vertices.length));guide.set(id,scale(face.vertices.map(i=>vertices[i].velocity).reduce((s,p)=>add(s,p),[0,0,0]),1/face.vertices.length));}
  const triangles=new Map<string,{n:CascadeVec3;values:Map<number,number>}>(),raw:{region:number;ids:number[];points:CascadeVec3[];facetData:{n:CascadeVec3;values:Map<number,number>}[]}[]=[];
  for(const region of regions){if(region.wet!==null)continue;const centerId=vertices.length+faces.length+region.id,c=centroid(region.poly);position.set(centerId,c);
    const local=region.poly.faces.flat().map(p=>vertices.find(v=>v.point===p)!.velocity);guide.set(centerId,scale(local.reduce((s,v)=>add(s,v),[0,0,0]),1/local.length));
    for(const face of faces){if(face.owner!==region.id&&face.neighbor!==region.id)continue;const ids=face.owner===region.id?face.vertices:face.vertices.slice().reverse();
      for(let e=0;e<ids.length;e++){
        const tetIds=[centerId,centers.get(face.id)!,ids[e],ids[(e+1)%ids.length]],points=tetIds.map(i=>position.get(i)!),facetData:{n:CascadeVec3;values:Map<number,number>}[]=[];
        for(let opposite=0;opposite<4;opposite++){
          const facetIds=tetIds.filter((_,i)=>i!==opposite),key=facetIds.slice().sort((a,b)=>a-b).join(','),p=facetIds.map(i=>position.get(i)!);let data=triangles.get(key);
          if(!data){const n0=cross3(sub3(p[1],p[0]),sub3(p[2],p[0])),length=Math.hypot(...n0);if(length===0)throw Object.assign(new Error('Empty extension tetrahedral facet is degenerate'),{constructionFailure:{region:region.id,face:face.id,tetIds,facetIds,points:p,partition}});const n=scale(n0,1/length),values=new Map<number,number>();
            const neighbor=face.owner===region.id?face.neighbor:face.owner,wet=opposite===0&&neighbor!==null?regions[neighbor].wet:null;
            const isSource=opposite===0&&sourceSpeed!==null&&cascadePlaneKey(face.plane)==='1,0,0,1.25'&&p.every(q=>q[1]>=2.5&&q[1]<=2.625&&q[2]>=2.75&&q[2]<=3.25);
            // A boundary not belonging to the source has no through-flux. Halo
            // outer faces are extension boundaries; they contain no donor water.
            const wall=opposite===0&&face.neighbor===null&&!isSource;
            facetIds.forEach((id,i)=>values.set(id,wet!==null?dot3(velocity(pieces[wet],p[i],h),n):isSource?sourceSpeed!*n[0]:wall?0:dot3(guide.get(id)!,n)));
            data={n,values};triangles.set(key,data);
          }facetData.push(data);
        }raw.push({region:region.id,ids:tetIds,points,facetData});
      }
    }
  }
  const tets=raw.map(t=>({region:t.region,ids:t.ids,points:t.points,values:t.ids.map((id,vertex)=>{const incident=t.facetData.filter((_,opposite)=>opposite!==vertex);return solve3(incident.map(d=>d.n),incident.map(d=>d.values.get(id)!));})}));
  partition.emptyExtensionTetrahedra=tets.length;return tets;
}
function orientedVolume(triangles:CascadeVec3[][],origin:CascadeVec3):number {return triangles.reduce((s,t)=>s+dot3(sub3(t[0],origin),cross3(sub3(t[1],origin),sub3(t[2],origin)))/6,0);}
function orientation(a:CascadeVec3,b:CascadeVec3,c:CascadeVec3,d:CascadeVec3):number {
  const rows=[sub3(b,a),sub3(c,a),sub3(d,a)],value=determinant(rows),bound=rows.flat().reduce((s,v)=>s+Math.abs(v),0)**3*Number.EPSILON*32;
  if(Math.abs(value)>bound)return Math.sign(value);
  // Exact fallback over the stored coordinates; no overlap epsilon changes
  // the topology of an ambiguous tetrahedron.
  const exact=integerDet(integerMatrix([a,b,c,d].map(p=>[...p,1])));return exact===0n?0:exact>0n?-1:1;
}
export function cascadeCorrectSharedFaces(partition:CascadeSharedPartition,pieces:CascadePiece[],h:number,dt:number,sourceSpeed:number|null,uniformCarrier:CascadeVec3|null=null):void {
  const {vertices,regions,faces}=partition;
  if(uniformCarrier)partition.uniformControl=[...uniformCarrier];
  const wetAdjacency=new Map<number,Set<number>>();for(const p of pieces.keys())wetAdjacency.set(p,new Set());
  for(const face of faces){const a=regions[face.owner].wet,b=face.neighbor===null?null:regions[face.neighbor].wet;if(a!==null&&b!==null){wetAdjacency.get(a)!.add(b);wetAdjacency.get(b)!.add(a);}}
  for(const v of vertices){
    const wet=[...v.wet];if(wet.length>1){const reached=new Set([wet[0]]),queue=[wet[0]];for(const i of queue)for(const j of wetAdjacency.get(i)??[])if(v.wet.has(j)&&!reached.has(j)){reached.add(j);queue.push(j);}if(reached.size!==wet.length)throw new Error('Shared vertex has unresolved locally separated wet sectors');}
    if(wet.length){let mass=0;v.velocity=[0,0,0];for(const i of wet){const volume=cascadeMoments(pieces[i].poly).volume;v.velocity=add(v.velocity,scale(velocity(pieces[i],v.point,h),volume));mass+=volume;}v.velocity=scale(v.velocity,1/mass);}
    else if(sourceSpeed!==null&&v.point[0]===1.25&&v.point[1]>=2.5&&v.point[1]<=2.625&&v.point[2]>=2.75&&v.point[2]<=3.25)v.velocity=[sourceSpeed,0,0];
    else{
      const candidates=pieces.flatMap((p,i)=>{const b=cascadeBounds(p.poly),distance=Math.hypot(...v.point.map((x,d)=>Math.max(b.lo[d]-x,0,x-b.hi[d])));return distance<=2*h?[{i,distance}]:[];}).sort((a,b)=>a.distance-b.distance);
      // This seeds unconstrained empty-face moments. Hard liquid/wall normal
      // data replace this guide in the shared tetrahedral extension below.
      if(candidates.length>1&&candidates[0].distance===candidates[1].distance&&!wetAdjacency.get(candidates[0].i)!.has(candidates[1].i))throw new Error('Empty vertex extension has ambiguous separated wet provenance');
      if(candidates.length)v.velocity=velocity(pieces[candidates[0].i],v.point,h);
    }
  }
  const extension=emptyExtension(partition,pieces,h,sourceSpeed),fields:CascadeStageField[]=extension.map(t=>{
    const rows=t.points.slice(1).map(p=>sub3(p,t.points[0])),gradient=[0,1,2].map(d=>solve3(rows,t.values.slice(1).map(v=>v[d]-t.values[0][d]))),intercept=t.values[0].map((v,d)=>v-dot3(gradient[d],t.points[0])) as CascadeVec3;
    return {id:0,region:t.region,wetSector:null,poly:cascadeSharedTetra(t.points),points:t.points,values:t.values,intercept,gradient};
  });
  for(const r of regions)if(r.wet!==null){const p=pieces[r.wet],gradient=[0,1,2].map(d=>[0,1,2].map(k=>d===k?(p.velocity[2*d+1]-p.velocity[2*d])/h:0) as CascadeVec3),intercept=[0,1,2].map(d=>p.velocity[2*d]-gradient[d][d]*p.cell[d]*h) as CascadeVec3;fields.push({id:0,region:r.id,wetSector:r.wet,poly:r.poly,points:r.poly.faces.flat(),values:r.poly.faces.flat().map(x=>velocity(p,x,h)),gradient,intercept});}
  fields.forEach((f,i)=>{f.id=i;});
  // One record owns this generation's actual fixed-region affine predictors.
  // Cap vertices use a canonical predictor field solely for allocation shape;
  // physical facet trajectories below must choose their current wet sector.
  const construction:CascadeStageConstruction={generation:++stageGeneration,dt,sourceSpeed,fields,sharedTraces:[],vertexPredictors:[],uniformControl:uniformCarrier};partition.construction=construction;
  for(const v of vertices){let chosen:number|null=null;if(!v.wet.size){const candidates=extension.flatMap((t,index)=>{const i=t.ids.indexOf(v.id);return i<0?[]:[{index,value:t.values[i]}];});if(candidates.length){chosen=candidates[0].index;v.velocity=[...candidates[0].value];}}
    construction.vertexPredictors.push({vertex:v.id,wetSectors:[...v.wet],field:chosen});
    if(sourceSpeed!==null&&v.point[0]===1.25&&v.point[1]>=2.5&&v.point[1]<=2.625&&v.point[2]>=2.75&&v.point[2]<=3.25)v.velocity=[sourceSpeed,0,0];
    // A prescribed uniform carrier is only for analytic startup controls.
    // The physical runtime never replaces its pressure field with this control.
    if(uniformCarrier)v.velocity=[...uniformCarrier];
    v.back=sub3(v.point,scale(v.velocity,dt));
    // Only canonical incident stationary boundary faces constrain coordinates.
    // Source incidence is open; arbitrary near-wall points are never snapped.
    for(const face of faces)if(face.neighbor===null&&face.vertices.includes(v.id)){
      const p=face.plane,axes=p.normal.flatMap((x,d)=>x!==0?[d]:[]),c=scale(face.vertices.map(i=>vertices[i].point).reduce((s,q)=>add(s,q),[0,0,0]),1/face.vertices.length);
      // The opening owns its rim vertices too. An adjacent closed patch on
      // that same source plane must not pin a shared rim vertex and fold the
      // inlet prism. This is exact incidence, not a near-wall snap tolerance.
      const inlet=sourceSpeed!==null&&cascadePlaneKey(p)==='1,0,0,1.25'&&v.point[1]>=2.5&&v.point[1]<=2.625&&v.point[2]>=2.75&&v.point[2]<=3.25;
      if(!uniformCarrier&&!inlet&&axes.length===1)v.back[axes[0]]=p.offset/p.normal[axes[0]];
    }
  }
  for(const face of faces){
    const n=scale(face.plane.normal,1/Math.hypot(...face.plane.normal)),points=face.vertices.map(id=>vertices[id].point),back=face.vertices.map(id=>vertices[id].back);
    const wetOwner=regions[face.owner].wet,wetNeighbor=face.neighbor===null?null:regions[face.neighbor].wet;
    const values=points.map(p=>uniformCarrier?[...uniformCarrier] as CascadeVec3:wetOwner!==null?velocity(pieces[wetOwner],p,h):wetNeighbor!==null?velocity(pieces[wetNeighbor],p,h):vertices[face.vertices[points.indexOf(p)]].velocity);
    const faceCenter=scale(points.reduce((s,p)=>add(s,p),[0,0,0]),1/points.length);
    const sourceFace=sourceSpeed!==null&&cascadePlaneKey(face.plane)==='1,0,0,1.25'&&faceCenter[1]>=2.5&&faceCenter[1]<=2.625&&faceCenter[2]>=2.75&&faceCenter[2]<=3.25;if(sourceFace)values.forEach(v=>{v[0]=sourceSpeed;v[1]=0;v[2]=0;});
    if(!uniformCarrier&&face.neighbor===null&&!sourceFace)values.forEach(v=>{for(let d=0;d<3;d++)if(n[d]!==0)v[d]=0;});
    const normalValues=values.map(v=>dot3(v,n));if(Math.min(...normalValues)<0&&Math.max(...normalValues)>0)throw new Error('Sign-changing shared face needs an affine zero-contour partition');
    const center=scale(points.reduce((s,p)=>add(s,p),[0,0,0]),1/points.length),backCenter=scale(back.reduce((s,p)=>add(s,p),[0,0,0]),1/back.length);
    let flux=0;for(let i=0;i<points.length;i++){const j=(i+1)%points.length,A=Math.hypot(...cross3(sub3(points[i],center),sub3(points[j],center)))/2;const uc=uniformCarrier?[...uniformCarrier] as CascadeVec3:wetOwner!==null?velocity(pieces[wetOwner],center,h):wetNeighbor!==null?velocity(pieces[wetNeighbor],center,h):scale(values.reduce((s,v)=>add(s,v),[0,0,0]),1/values.length);if(sourceFace)uc[0]=sourceSpeed!;if(!uniformCarrier&&face.neighbor===null&&!sourceFace)for(let d=0;d<3;d++)if(n[d]!==0)uc[d]=0;flux+=A*(dot3(values[i],n)+dot3(values[j],n)+dot3(uc,n))/3;}
    face.flux=flux;
    construction.sharedTraces.push({face:face.id,owner:face.owner,neighbor:face.neighbor,normal:n,values:normalValues});
    const swept=(cap:CascadeVec3)=>{const tris:CascadeVec3[][]=[];for(let i=0;i<points.length;i++){const j=(i+1)%points.length;tris.push([center,points[i],points[j]],[cap,back[j],back[i]],...cascadeCanonicalSweptEdge(face.vertices[i],face.vertices[j],points[i],points[j],back[i],back[j]));}return orientedVolume(tris,backCenter);};
    const base=swept(backCenter),coefficient=swept(add(backCenter,n))-base;if(coefficient===0)throw new Error('Shared face correction has degenerate volume derivative');
    const displacement=(dt*flux-base)/coefficient;if(Math.abs(displacement)>.25*h)throw new Error('Shared backface cap displacement exceeds declared .25h bound');
    face.cap=add(backCenter,scale(n,displacement));face.capShift=displacement;
    if(!uniformCarrier&&face.neighbor===null&&!sourceFace&&face.flux===0){const axes=face.plane.normal.flatMap((v,d)=>v!==0?[d]:[]);if(axes.length===1){const d=axes[0],coordinate=face.plane.offset/face.plane.normal[d];if(back.every(p=>p[d]===coordinate))face.cap[d]=coordinate;}}
    const error=swept(face.cap)-dt*flux;if(Math.abs(error)>1e-11)throw new Error('Corrected face volume does not match actual carrier integral');
  }
}
export function cascadeCanonicalSweptEdge(a:number,b:number,p:CascadeVec3,q:CascadeVec3,backP:CascadeVec3,backQ:CascadeVec3):CascadeVec3[][] {
  // Both incident faces reuse the lower-ID original vertex to higher-ID back
  // vertex diagonal. Reversing an edge reverses orientation, never its surface.
  return a<b?[[p,backP,backQ],[p,backQ,q]]:[[p,backP,q],[q,backP,backQ]];
}
export function cascadeSharedTetra(points:CascadeVec3[]):CascadePoly {
  const faces=[[0,2,1],[0,1,3],[0,3,2],[1,2,3]].map(ids=>ids.map(i=>points[i]));return {faces,planes:faces.map(trianglePlane)};
}
export function cascadePositiveReceivers(partition:CascadeSharedPartition):CascadePositiveReceiver[] {
  const out:CascadePositiveReceiver[]=[];
  for(const region of partition.regions){
    const triangles:{points:CascadeVec3[];keys:string[]}[]=[],edgeCounts=new Map<string,{count:number;sign:number}>();let maximumCapShift=0;
    for(const face of partition.faces){if(face.owner!==region.id&&face.neighbor!==region.id)continue;const ids=face.owner===region.id?face.vertices:face.vertices.slice().reverse();maximumCapShift=Math.max(maximumCapShift,Math.abs(face.capShift));
      for(let i=0;i<ids.length;i++){const a=ids[i],b=ids[(i+1)%ids.length],keys=[`c${face.id}`,`v${a}`,`v${b}`],points=[face.cap,partition.vertices[a].back,partition.vertices[b].back];triangles.push({points,keys});
        for(let j=0;j<3;j++){const x=keys[j],y=keys[(j+1)%3],key=[x,y].sort().join('/'),entry=edgeCounts.get(key)??{count:0,sign:0};entry.count++;entry.sign+=x<y?1:-1;edgeCounts.set(key,entry);}}
    }
    for(const edge of edgeCounts.values())if(edge.count!==2||edge.sign!==0)throw new Error('Receiver boundary is not a closed oriented shared triangulation');
    const points=triangles.flatMap(t=>t.points),kernel=scale(points.reduce((s,p)=>add(s,p),[0,0,0]),1/points.length),tets:CascadePoly[]=[];
    for(const t of triangles){const sign=orientation(kernel,t.points[0],t.points[1],t.points[2]);if(sign<=0)throw new Error('Receiver has no verified positive star fan at chosen kernel');tets.push(cascadeSharedTetra([kernel,...t.points]));}
    if(tets.length>192)throw new Error('Receiver positive tetrahedral fan capacity exceeded');
    // Independent topology, crossing and coverage conditions qualify the fan.
    // The same cap/original IDs identify shared triangles throughout the mesh.
    cascadeValidatePositiveReceiverBoundary(triangles.map(t=>({ids:t.keys.map(k=>k[0]==='v'?Number(k.slice(1)):partition.vertices.length+Number(k.slice(1))) as [number,number,number],points:t.points as [CascadeVec3,CascadeVec3,CascadeVec3]})),kernel);
    out.push({region:region.id,tets,volume:tets.reduce((s,t)=>s+cascadeMoments(t).volume,0),kernel,maximumCapShift});
  }return out;
}
export interface CascadeDonorAllocation {
  region:number;source:number;poly:CascadePoly;volume:number;momentum:CascadeVec3;
  first:CascadeVec3;energy:number;gradient:CascadeVec3;virtual:boolean;
}
export interface CascadeSharedAllocation {
  partition:CascadeSharedPartition;receivers:CascadePositiveReceiver[];donors:CascadeDonorAllocation[];
  incomingVolume:number;incomingMomentum:CascadeVec3;residentVolume:number;residentMomentum:CascadeVec3;
  milliseconds:{partition:number;extensionFaces:number;receivers:number;donors:number};
}
export function cascadeAllocateSharedDonors(pieces:CascadePiece[],solids:CascadeSolid[],h:number,dt:number,sourceSpeed:number|null,uniformCarrier:CascadeVec3|null=null):CascadeSharedAllocation {
  const partition=cascadeBuildSharedPartition(pieces,solids,h,sourceSpeed!==null),a=performance.now();
  cascadeCorrectSharedFaces(partition,pieces,h,dt,sourceSpeed,uniformCarrier);const b=performance.now(),receivers=cascadePositiveReceivers(partition),c=performance.now(),donors:CascadeDonorAllocation[]=[];
  const inputs=pieces.map((p,i)=>({piece:p,source:i,virtual:false}));if(sourceSpeed!==null&&sourceSpeed>0)inputs.push({piece:{cell:[9,20,22],poly:cascadeBox([1.125,2.5,2.75],[1.25,2.625,3.25]),velocity:[sourceSpeed,sourceSpeed,0,0,0,0],sourceId:'virtual-reservoir'},source:-1,virtual:true});
  const cache=new Map<string,CascadeVec3>();let incomingVolume=0,residentVolume=0;const incomingMomentum:CascadeVec3=[0,0,0],residentMomentum:CascadeVec3=[0,0,0];
  for(const receiver of receivers)for(const tet of receiver.tets){const tb=cascadeBounds(tet);
    for(const input of inputs){const sb=cascadeBounds(input.piece.poly);if(tb.lo.some((v,d)=>v>=sb.hi[d]||tb.hi[d]<=sb.lo[d]))continue;
      const poly=cascadeSharedIntersection(tet,input.piece.poly,cache);if(!poly.faces.length)continue;
      const m=cascadeMoments(poly),gradient=[0,1,2].map(d=>(input.piece.velocity[2*d+1]-input.piece.velocity[2*d])/h) as CascadeVec3;
      const intercept=gradient.map((g,d)=>input.piece.velocity[2*d]-g*input.piece.cell[d]*h),momentum=intercept.map((v,d)=>1000*(v*m.volume+gradient[d]*m.first[d])) as CascadeVec3;
      const energy=intercept.reduce((s,v,d)=>s+500*(v*v*m.volume+2*v*gradient[d]*m.first[d]+gradient[d]**2*m.second[d][d]),0);
      donors.push({region:receiver.region,source:input.source,poly,volume:m.volume,momentum,first:m.first,energy,gradient,virtual:input.virtual});
      if(input.virtual){incomingVolume+=m.volume;for(let d=0;d<3;d++)incomingMomentum[d]+=momentum[d];}else{residentVolume+=m.volume;for(let d=0;d<3;d++)residentMomentum[d]+=momentum[d];}
    }
  }
  const actualResident=pieces.reduce((s,p)=>s+cascadeMoments(p.poly).volume,0),prescribed=(sourceSpeed??0)*.0625*dt;
  if(Math.abs(incomingVolume-prescribed)>1e-11)throw Object.assign(new Error('Source positive donor geometry does not equal prescribed single boundary transaction'),{allocation:{partition,receivers,donors,incomingVolume,prescribed,residentVolume,actualResident}});
  if(Math.abs(residentVolume-actualResident)>1e-11)throw Object.assign(new Error('Positive receiver partition does not allocate each resident donor exactly once'),{allocation:{partition,receivers,donors,incomingVolume,prescribed,residentVolume,actualResident}});
  return {partition,receivers,donors,incomingVolume,incomingMomentum,residentVolume,residentMomentum,milliseconds:{partition:partition.constructionMilliseconds,extensionFaces:b-a,receivers:c-b,donors:performance.now()-c}};
}

/** The endpoint audit uses the exact same canonical donor intersection. */
export function cascadeSharedIntersection(a:CascadePoly,b:CascadePoly,cache=new Map<string,CascadeVec3>()):CascadePoly {return canonicalPoly({faces:[],planes:[...a.planes,...b.planes]},cache,true);}

/** Retains exact plane intersections for bounded storage audits. Existing draw
 * geometry is unchanged; the caller must qualify face ordering and moments
 * rather than treating the rounded vertex coordinates as exact water. */
export function cascadeSharedExactBoundary(poly:CascadePoly):{poly:CascadePoly;faces:CascadeHomogeneousVertex[][]}{
  const faces:CascadeHomogeneousVertex[][]=[];
  return {poly:canonicalPoly(poly,new Map(),true,faces),faces};
}
