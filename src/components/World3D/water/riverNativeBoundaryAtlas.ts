/** Retain the existing terrain builder's construction meaning for fluid cuts.
 * This does not alter positions, normals, materials or water. A local solid-side
 * convention is not a closed-solid certificate: joins and overlap trimming must
 * pass separately before a fluid epoch can consume this boundary.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/10/2026, 15:51:23
 * Dependents: components/World3D/water/riverReachScene.ts, components/World3D/water/riverWaterfallCliff.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { BufferGeometry } from 'three';

export type AtlasPoint=readonly [number,number,number];
export interface NativeCliffBuildIdentity {
  seed:number; widthScale:number; depthScale:number;
  crest:{x:number;z:number;tx:number;tz:number};
}
export interface NativeAttachedSlab {
  footprint:readonly {n:number;h:number}[];depth:number;
  frontTriangles:readonly number[];bridgeTriangles:readonly number[];
}
export interface NativeCliffBoundaryMetadata {
  schema:'native-cliff-boundary-v1';identity:NativeCliffBuildIdentity;
  /** All triangle IDs are element offsets (0,3,6...), not vertex IDs. */
  canonicalFaceMapping:'same-face-order-and-coordinates';
  triangles:number;attachedSlabs:readonly NativeAttachedSlab[];
  materialSide:{front:'decreasing-forward-at-fixed-lateral-height';
    bridge:'interior-of-native-attached-slab';qualification:'builder-intent-only'};
  closure:'ground-collar-and-domain-continuation-required';
}
const finite=(x:readonly number[])=>x.every(Number.isFinite);
function position(geometry:BufferGeometry,element:number):AtlasPoint {
  const p=geometry.getAttribute('position'),i=geometry.index?.getX(element)??element;
  return [p.getX(i),p.getY(i),p.getZ(i)];
}
function triangleElements(geometry:BufferGeometry){return geometry.index?.count??geometry.getAttribute('position').count;}

/** Verify the real shading conversion instead of assuming it preserves face
 * identity. Only references/metadata survive; no hidden core copy is retained.
 */
export function retainNativeCliffBoundary(core:BufferGeometry,rendered:BufferGeometry,
  identity:NativeCliffBuildIdentity):NativeCliffBoundaryMetadata {
  if(!finite([identity.seed,identity.widthScale,identity.depthScale,...Object.values(identity.crest)])
    ||Math.abs(Math.hypot(identity.crest.tx,identity.crest.tz)-1)>1e-12)throw Error('Invalid native cliff identity');
  const count=triangleElements(core);
  if(!Number.isInteger(count/3)||count!==triangleElements(rendered))throw Error('Native/render triangle count mismatch');
  for(let e=0;e<count;e++){
    const a=position(core,e),b=position(rendered,e);
    if(!finite(a)||a.some((x,i)=>x!==b[i]))throw Error(`Native/render face mapping mismatch at element ${e}`);
  }
  const slabs=core.userData.attachedSlabs as NativeAttachedSlab[]|undefined;
  if(!Array.isArray(slabs))throw Error('Native attached-slab construction missing');
  const claimed=new Set<number>();
  const copied=slabs.map(s=>{
    if(!finite([s.depth,...s.footprint.flatMap(p=>[p.n,p.h])])||s.depth<=0||s.footprint.length<3)throw Error('Invalid native slab');
    for(const id of [...s.frontTriangles,...s.bridgeTriangles]){
      if(!Number.isInteger(id)||id<0||id>=count||id%3||claimed.has(id))throw Error('Invalid or multiply-owned native slab face');
      claimed.add(id);
    }
    return {depth:s.depth,footprint:s.footprint.map(p=>({...p})),frontTriangles:[...s.frontTriangles],bridgeTriangles:[...s.bridgeTriangles]};
  });
  const metadata:NativeCliffBoundaryMetadata={schema:'native-cliff-boundary-v1',identity:{...identity,crest:{...identity.crest}},
    canonicalFaceMapping:'same-face-order-and-coordinates',triangles:count/3,attachedSlabs:copied,
    materialSide:{front:'decreasing-forward-at-fixed-lateral-height',bridge:'interior-of-native-attached-slab',qualification:'builder-intent-only'},
    closure:'ground-collar-and-domain-continuation-required'};
  rendered.userData.nativeBoundary=metadata;
  return metadata;
}

/** Bind construction metadata to this exact committed geometry instance. A
 * later position/index version invalidates the witness instead of silently
 * carrying old joins across a live edit.
 */
const epochBuffers=new WeakMap<BufferGeometry,{position:object;index:object|null}>();
function positionVersion(geometry:BufferGeometry){
  const p=geometry.getAttribute('position');
  return 'data' in p?p.data.version:p.version;
}
export function bindNativeBoundaryEpoch(geometry:BufferGeometry,metadata:object){
  const p=geometry.getAttribute('position');
  epochBuffers.set(geometry,{position:p,index:geometry.index});
  geometry.userData.nativeBoundary={...metadata,geometryEpoch:{geometryUuid:geometry.uuid,
    positionVersion:positionVersion(geometry),indexVersion:geometry.index?.version??null}};
}
export function nativeBoundaryEpochCurrent(geometry:BufferGeometry):boolean {
  const epoch=geometry.userData.nativeBoundary?.geometryEpoch;
  const bound=epochBuffers.get(geometry);
  return !!epoch&&!!bound&&bound.position===geometry.getAttribute('position')&&bound.index===geometry.index
    &&epoch.geometryUuid===geometry.uuid&&epoch.positionVersion===positionVersion(geometry)
    &&epoch.indexVersion===(geometry.index?.version??null);
}

export interface NativeCollarConstruction {
  sourceEdge:{grid:'fine'|'outer';vertices:readonly [number,number];a:AtlasPoint;b:AtlasPoint};
  /** Native trace and ruled interpolation BEFORE Float32 storage/normal repair. */
  knots:readonly {t:number;point:AtlasPoint}[];
  firstElement:number;elements:number;
}
export interface NativeCollarBoundaryMetadata {
  schema:'native-collar-boundary-v1';joins:readonly NativeCollarConstruction[];
  materialSide:'locally-below-exposed-collar';
  overlap:'unresolved-until-native-overlap-band-trim';
  qualification:'construction-witness-only';
}

/** Record the actual constructor inputs once, before shading loses their
 * correspondence. Storage is bounded; exhaustion rejects only atlas admission,
 * never changes the landscape or truncates its ordinary drawing.
 */
export class NativeCollarRecorder {
  private entries=0;
  private joins:NativeCollarConstruction[]=[];
  failure:string|null=null;
  constructor(readonly maximumEntries=131072){}
  append(record:NativeCollarConstruction):void {
    if(this.failure)return;
    if(record.knots.length<2||!finite([...record.sourceEdge.a,...record.sourceEdge.b,...record.knots.flatMap(k=>[k.t,...k.point])])
      ||record.firstElement<0||record.firstElement%3||record.elements!==6*(record.knots.length-1)
      ||record.knots.some((k,i)=>k.t<0||k.t>1||(i>0&&k.t<record.knots[i-1].t))){this.failure='Invalid native collar construction';return;}
    const needed=10+4*record.knots.length;
    if(this.entries+needed>this.maximumEntries){this.failure='Native collar metadata storage cap exceeded';this.joins=[];return;}
    this.entries+=needed;
    this.joins.push({sourceEdge:{...record.sourceEdge,vertices:[...record.sourceEdge.vertices],a:[...record.sourceEdge.a],b:[...record.sourceEdge.b]},
      firstElement:record.firstElement,elements:record.elements,knots:record.knots.map(k=>({t:k.t,point:[...k.point]}))});
  }
  snapshot():NativeCollarBoundaryMetadata {
    if(this.failure)throw Error(this.failure);
    return {schema:'native-collar-boundary-v1',joins:structuredClone(this.joins),materialSide:'locally-below-exposed-collar',
      overlap:'unresolved-until-native-overlap-band-trim',qualification:'construction-witness-only'};
  }
  get storedEntries(){return this.entries;}
}

/** A rendering conversion may round stored coordinates. Preserve the exact
 * construction and its measured Float32 storage envelope, rather than welding
 * nearby points or pretending the rounded mesh itself proves the common join.
 */
export function collarFloat32StorageWitness(record:NativeCollarConstruction){
  const positions:number[]=[];
  const at=(t:number):AtlasPoint=>record.sourceEdge.a.map((x,i)=>x+(record.sourceEdge.b[i]-x)*t) as unknown as AtlasPoint;
  for(let i=1;i<record.knots.length;i++){
    const a=record.knots[i-1],b=record.knots[i],ta=at(a.t),tb=at(b.t);
    positions.push(...ta,...tb,...a.point,...tb,...b.point,...a.point);
  }
  const rounded=Float32Array.from(positions);
  let maximumStorageDifference=0;
  for(let i=0;i<positions.length;i++)maximumStorageDifference=Math.max(maximumStorageDifference,Math.abs(positions[i]-rounded[i]));
  return {constructionPositions:positions,storedPositions:rounded,
    maximumStorageDifference,
    qualification:'Float32-rounding-only-not-trace-arithmetic-or-solid-closure' as const};
}

export interface NativeCollarEdgeRecipe {
  grid:'fine'|'outer';vertices:readonly [number,number];a:AtlasPoint;b:AtlasPoint;
  firstElement:number;elements:number;
}
/** Keep only the actual source edge and emitted range during ordinary drawing.
 * The native trace can be replayed on request and checked against its retained
 * Float32 output. No second cliff or full per-knot copy stays resident.
 */
export class NativeCollarEdgeRecorder {
  private edges:NativeCollarEdgeRecipe[]=[];
  private entries=0;
  failure:string|null=null;
  constructor(readonly maximumEntries=131072){}
  append(edge:NativeCollarEdgeRecipe):void {
    if(this.failure)return;
    if(!finite([...edge.a,...edge.b])||edge.vertices.some(v=>!Number.isInteger(v)||v<0)
      ||!Number.isInteger(edge.firstElement)||edge.firstElement<0||edge.firstElement%3
      ||!Number.isInteger(edge.elements)||edge.elements<0||edge.elements%6){this.failure='Invalid native source-edge recipe';return;}
    if(this.entries+10>this.maximumEntries){this.failure='Native edge-recipe cap exceeded';this.edges=[];return;}
    this.entries+=10;
    this.edges.push({...edge,vertices:[...edge.vertices],a:[...edge.a],b:[...edge.b]});
  }
  snapshot(){return {schema:'native-collar-edge-recipes-v1' as const,edges:this.failure?[]:structuredClone(this.edges),
    entries:this.entries,failure:this.failure,
    localMaterialSide:'locally-below-exposed-collar' as const,
    sameGridSameEdgeOverlap:'duplicate-construction-not-two-material-boundaries' as const,
    otherOverlap:'requires-explicit-finite-band-trim' as const,
    qualification:'builder-recipe-not-closed-solid' as const};}
}

export function nativeGroundBoundaryMetadata(grid:'fine'|'outer',source:{seed:number;nx:number;nz:number;dx:number;x0:number;z0:number},
  sourceFrame:{x:number;z:number;tx:number;tz:number}|null,fineBounds:{minX:number;maxX:number;minZ:number;maxZ:number},outerBandM:number){
  if(!finite([...Object.values(source),...Object.values(fineBounds),outerBandM])||source.dx<=0||outerBandM<0)throw Error('Invalid native ground construction');
  return {schema:'native-ground-boundary-v1' as const,grid,source:{...source},sourceFrame:sourceFrame?{...sourceFrame}:null,
    fineBounds:{...fineBounds},outerBandM,localMaterialSide:'locally-below-ground' as const,
    cliffNotch:'dedicated-cliff-and-recorded-collars-own-omitted-walls-no-vertical-extrusion' as const,
    overlap:grid==='outer'?'fine-ground-priority-in-declared-edge-band':'primary-fine-surface',
    qualification:'builder-intent-not-closed-solid' as const};
}

/** Compare a replay with the actual stored collar range after the existing
 * upward-winding repair. This has no nearest-point search or weld radius.
 */
export function verifyNativeCollarReplay(geometry:BufferGeometry,recipe:NativeCollarEdgeRecipe,
  knots:NativeCollarConstruction['knots']){
  const record:NativeCollarConstruction={sourceEdge:{grid:recipe.grid,vertices:recipe.vertices,a:recipe.a,b:recipe.b},
    knots,firstElement:recipe.firstElement,elements:recipe.elements};
  if(recipe.elements!==6*(knots.length-1))throw Error('Native collar replay range changed');
  const witness=collarFloat32StorageWitness(record),expected=witness.constructionPositions;
  const reversed:number[]=[];
  for(let i=0;i<expected.length;i+=9){
    const ax=expected[i+3]-expected[i],az=expected[i+5]-expected[i+2],bx=expected[i+6]-expected[i],bz=expected[i+8]-expected[i+2];
    if(az*bx-ax*bz<0){
      for(let d=0;d<3;d++){const v=expected[i+3+d];expected[i+3+d]=expected[i+6+d];expected[i+6+d]=v;}
      reversed.push(recipe.firstElement/3+i/9);
    }
  }
  const p=geometry.getAttribute('position');
  if(recipe.firstElement+recipe.elements>p.count)throw Error('Native collar replay outside geometry');
  for(let i=0;i<expected.length;i++){
    const v=recipe.firstElement+Math.floor(i/3),actual=i%3===0?p.getX(v):i%3===1?p.getY(v):p.getZ(v);
    if(actual!==Math.fround(expected[i]))throw Error(`Native collar replay changed element ${v}`);
  }
  return {matchedStoredElements:recipe.elements,reversedTriangles:reversed,maximumFloat32StorageDifference:witness.maximumStorageDifference,
    qualification:'native-construction-replay-not-solid-closure' as const};
}
