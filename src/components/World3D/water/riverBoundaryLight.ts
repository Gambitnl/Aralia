/**
 * Caches light arriving from represented opaque geometry around the fall.
 * Rays stop at actual triangles; blocked sky is replaced by one diffuse rock
 * bounce using the surface's sampled albedo. This is a one-bounce Lambert
 * approximation, not native PBR shading or transport through falling water.
 * Unsupported materials remain unrepresented and retain the environment.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 05/10/2026, 06:14:36
 * Dependents: components/World3D/water/riverBoundaryLight.worker.ts, components/World3D/water/riverBoundaryWorkerCache.ts, components/World3D/water/riverWaterfallCliff.ts, components/World3D/water/riverWaterfallView.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { Box3, Color, Matrix3, Mesh, Object3D, Ray, Triangle, Vector3, DataUtils } from 'three';
import { Octree } from 'three/examples/jsm/math/Octree.js';

export interface BoundarySurfaceHit {
  mesh: Mesh; point: Vector3; normal: Vector3; indices: readonly [number, number, number];
  barycentric: Vector3; faceIndex: number;
}
export interface BoundarySurface { albedo: Color; normal: Vector3 }
export type BoundarySurfaceData = { kind: 'plain'; color: readonly [number, number, number] } | { kind: 'cliff'; pixels: Pick<ImageData, 'width' | 'height' | 'data'>; diagnostic: number };
export interface BoundarySurfaceSampler {
  supports(mesh: Mesh): boolean;
  sample(hit: BoundarySurfaceHit): BoundarySurface | null;
  prepare?(): Promise<void>;
  /** Worker support is explicit: closures without serializable surface data
   * stay unrepresented instead of silently substituting a material color. */
  serialize?(mesh: Mesh): BoundarySurfaceData;
}
export const BOUNDARY_LIGHT = { x: 6, y: 24, z: 4, directions: 12, sliceMs: 2 } as const;
const GOLDEN = (1 + Math.sqrt(5)) / 2;
/** Antipodal directions integrate the FULL sphere. Positive cosine weights
 * are normalized over that full set, preserving uniform incident radiance;
 * upper-sky energy is never independently normalized to one. */
export const BOUNDARY_DIRECTIONS: readonly Vector3[] = [
  ...[-1, 1].flatMap(a => [-1, 1].flatMap(b => [new Vector3(0,a,b*GOLDEN),new Vector3(a,b*GOLDEN,0),new Vector3(b*GOLDEN,0,a)])),
].map(v => v.normalize());
export function boundaryIrradiance(radiances: readonly Color[], normal: Vector3): Color {
  const result = new Color(0,0,0); let total=0;
  BOUNDARY_DIRECTIONS.forEach((d,k)=>{const w=Math.max(0,normal.dot(d));total+=w;result.add(radiances[k].clone().multiplyScalar(w));});
  return result.multiplyScalar(1/Math.max(total,1e-12));
}
type Face = { mesh: Mesh; indices: readonly [number,number,number]; faceIndex: number; sampler: BoundarySurfaceSampler };
type SplitJob = { node: Octree; depth: number; children: Octree[]; cursor: number };
const plainSampler: BoundarySurfaceSampler = {
  supports(mesh) { const m=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;return !!('color' in m) && !('colorNode' in m && m.colorNode) && !('map' in m && m.map); },
  sample(hit) { const m=Array.isArray(hit.mesh.material)?hit.mesh.material[0]:hit.mesh.material;return {albedo:('color' in m?(m.color as Color):new Color(0,0,0)).clone(),normal:hit.normal.clone()}; },
};

/** Native Octree boxes/candidate traversal, with resumable construction.
 * Native rayIntersect is front-face-only; our candidate intersections are
 * explicitly double-sided, matching the cliff's actual rendered material. */
export class BoundaryOccluders {
  private readonly tree = new Octree();
  private readonly faces = new WeakMap<Triangle,Face>();
  private readonly candidates: Triangle[] = [];
  private readonly jobs: SplitJob[] = [];
  private readonly meshes: { mesh: Mesh; sampler: BoundarySurfaceSampler }[] = [];
  private meshCursor=0; private faceCursor=0; private splitting=false;
  ready=false; prepared=false; error: string|null=null; triangleCount=0; rayCount=0; unsupportedMeshes=0; candidateMaximum=0;
  constructor(roots: readonly Object3D[], sampler?: BoundarySurfaceSampler) {
    const seen=new Set<Mesh>(), preparation=new Set<BoundarySurfaceSampler>();
    for(const root of roots) root.traverse(object=>{
      if(!(object instanceof Mesh)||seen.has(object))return;seen.add(object);
      let ancestor:Object3D|null=object;while(ancestor){if(!ancestor.visible)return;ancestor=ancestor.parent;}
      // The default contract is one opaque material. Multi-material groups
      // need an explicit surface owner before they can represent occlusion.
      if(Array.isArray(object.material)){this.unsupportedMeshes++;return;}
      const material=object.material;
      if(material.transparent)return;
      const own=material.userData.boundarySurfaceSampler as BoundarySurfaceSampler|undefined;
      const selected=sampler?.supports(object)?sampler:own?.supports(object)?own:plainSampler.supports(object)?plainSampler:null;
      if(!selected){this.unsupportedMeshes++;return;}
      object.updateWorldMatrix(true,false);this.meshes.push({mesh:object,sampler:selected});preparation.add(selected);
    });
    Promise.all([...preparation].map(s=>s.prepare?.())).then(()=>{this.prepared=true;}).catch(e=>{this.error=String(e);});
  }
  private split(node: Octree, depth: number): void {
    const size=node.box!.getSize(new Vector3()).multiplyScalar(.5),children:Octree[]=[];
    for(let x=0;x<2;x++)for(let y=0;y<2;y++)for(let z=0;z<2;z++){
      const min=node.box!.min.clone().add(new Vector3(x,y,z).multiply(size));children.push(new Octree(new Box3(min,min.clone().add(size))));
    }
    this.jobs.push({node,depth,children,cursor:0});
  }
  /** One primitive per call lets the cache yield during extraction AND tree
   * subdivision. No opaque mesh index/positions are modified or cloned. */
  advance(): void {
    if(this.ready||this.error)return;
    if(!this.splitting){
      const entry=this.meshes[this.meshCursor];
      if(entry){
        const geometry=entry.mesh.geometry,position=geometry.getAttribute('position'),index=geometry.index;
        const start=geometry.drawRange.start,count=Math.min(index?.count??position.count,start+geometry.drawRange.count);
        if(this.faceCursor<start)this.faceCursor=start;
        if(this.faceCursor<count){
          const indices=[0,1,2].map(k=>index?index.getX(this.faceCursor+k):this.faceCursor+k) as [number,number,number];
          const points=indices.map(i=>new Vector3().fromBufferAttribute(position,i).applyMatrix4(entry.mesh.matrixWorld));
          const triangle=new Triangle(points[0],points[1],points[2]);this.tree.addTriangle(triangle);
          this.faces.set(triangle,{...entry,indices,faceIndex:this.faceCursor/3});this.faceCursor+=3;this.triangleCount++;return;
        }
        this.meshCursor++;this.faceCursor=0;return;
      }
      if(!this.triangleCount){this.ready=true;return;}
      this.tree.calcBox();this.split(this.tree,0);this.splitting=true;return;
    }
    const job=this.jobs[this.jobs.length-1];
    if(!job){this.ready=true;return;}
    if(job.cursor<job.node.triangles.length){
      const triangle=job.node.triangles[job.cursor++];for(const child of job.children)if(child.box!.intersectsTriangle(triangle))child.triangles.push(triangle);return;
    }
    job.node.triangles.length=0;this.jobs.pop();
    // Limiting subdivision changes candidate cost, never intersections or
    // geometry. Coarse leaves retain ALL triangles, including thin slabs.
    for(const child of job.children)if(child.triangles.length){job.node.subTrees.push(child);if(child.triangles.length>8&&job.depth<8)this.split(child,job.depth+1);}
  }
  hit(origin: Vector3,direction: Vector3): {hit:BoundarySurfaceHit;sampler:BoundarySurfaceSampler}|null {
    this.rayCount++;this.candidates.length=0;
    if(!this.triangleCount)return null;
    const ray=new Ray(origin,direction);this.tree.getRayTriangles(ray,this.candidates);this.candidateMaximum=Math.max(this.candidateMaximum,this.candidates.length);
    let closest:Triangle|null=null,distance=Infinity;const point=new Vector3(),best=new Vector3();
    for(const triangle of this.candidates){if(ray.intersectTriangle(triangle.a,triangle.b,triangle.c,false,point)){
      const length=point.distanceTo(origin);if(length>.001&&length<distance){distance=length;best.copy(point);closest=triangle;}
    }}
    if(!closest)return null;const face=this.faces.get(closest)!;const barycentric=closest.getBarycoord(best,new Vector3())!;
    const attribute=face.mesh.geometry.getAttribute('normal');let normal=closest.getNormal(new Vector3());
    if(attribute){normal.set(0,0,0);face.indices.forEach((i,k)=>normal.add(new Vector3().fromBufferAttribute(attribute,i).multiplyScalar(barycentric.getComponent(k))));normal.applyMatrix3(new Matrix3().getNormalMatrix(face.mesh.matrixWorld)).normalize();}
    if(normal.dot(direction)>0)normal.negate();
    return {hit:{...face,point:best,normal,barycentric},sampler:face.sampler};
  }
}

type PendingBounce = { surface: BoundarySurface; origin: Vector3; direction: number; transfer: number[]; cosineSum: number; primary: number };
const POINTS=BOUNDARY_LIGHT.x*BOUNDARY_LIGHT.y*BOUNDARY_LIGHT.z;
const LENGTH=POINTS*BOUNDARY_LIGHT.directions*4;
export class RiverBoundaryLightCache {
  readonly horizon=new Uint16Array(LENGTH);readonly zenith=new Uint16Array(LENGTH);readonly sun=new Uint16Array(LENGTH);
  readonly textureBytes=(this.horizon.byteLength+this.zenith.byteLength+this.sun.byteLength);
  private occluders:BoundaryOccluders|null=null;private cursor=0;private pending:PendingBounce|null=null;private revision:string|number='none';
  private bounds=new Box3(new Vector3(-1,-1,-1),new Vector3(1,1,1));private sunDirection=new Vector3(0,1,0);
  private started=0;private workMs=0;private maximumSliceMs=0;private completed=false;private setupMs=0;private treeMs=0;private bakeMs=0;version=0;
  configure(roots:readonly Object3D[],revision:string|number,bounds:Box3,sunDirection:Vector3,sampler?:BoundarySurfaceSampler):void{
    const setupStart=performance.now();this.occluders=new BoundaryOccluders(roots,sampler);this.setupMs=performance.now()-setupStart;this.treeMs=0;this.bakeMs=0;this.bounds.copy(bounds);this.sunDirection.copy(sunDirection).normalize();
    this.revision=revision;this.cursor=0;this.pending=null;this.completed=false;this.started=performance.now();this.workMs=0;this.maximumSliceMs=0;this.horizon.fill(0);this.zenith.fill(0);this.sun.fill(0);
  }
  private position(probe:number):Vector3{
    const x=probe%BOUNDARY_LIGHT.x,y=Math.floor(probe/BOUNDARY_LIGHT.x)%BOUNDARY_LIGHT.y,z=Math.floor(probe/(BOUNDARY_LIGHT.x*BOUNDARY_LIGHT.y));
    const f=new Vector3(x/(BOUNDARY_LIGHT.x-1),y/(BOUNDARY_LIGHT.y-1),z/(BOUNDARY_LIGHT.z-1));return f.multiply(this.bounds.getSize(new Vector3())).add(this.bounds.min);
  }
  private offset(probe:number,direction:number):number{
    // Directions occupy separate age/depth slabs. Each slab interpolates
    // spatially; filtering never blends unrelated ray directions.
    const x=probe%BOUNDARY_LIGHT.x,y=Math.floor(probe/BOUNDARY_LIGHT.x)%BOUNDARY_LIGHT.y,z=Math.floor(probe/(BOUNDARY_LIGHT.x*BOUNDARY_LIGHT.y));
    return (((direction*BOUNDARY_LIGHT.z+z)*BOUNDARY_LIGHT.y+y)*BOUNDARY_LIGHT.x+x)*4;
  }
  private store(probe:number,direction:number,values:readonly number[],clear:number):void{
    const offset=this.offset(probe,direction);for(let k=0;k<3;k++){this.horizon[offset+k]=DataUtils.toHalfFloat(values[k]);this.zenith[offset+k]=DataUtils.toHalfFloat(values[k+3]);this.sun[offset+k]=DataUtils.toHalfFloat(values[k+6]);}
    this.horizon[offset+3]=DataUtils.toHalfFloat(clear);
  }
  /** Every query is geometrical; no density attenuation is applied here.
   * Secondary rays stop after one bounce, so blocked secondary sky contributes
   * zero to that approximation, rather than an invented ambient floor. */
  step(budgetMs:number=BOUNDARY_LIGHT.sliceMs):void{
    if(!this.occluders||this.completed||this.occluders.error)return;
    const start=performance.now();let work=0;
    while(performance.now()-start<budgetMs||work===0){
      work++;
      if(!this.occluders.ready){const treeStart=performance.now();this.occluders.advance();this.treeMs+=performance.now()-treeStart;continue;}
      if(!this.occluders.prepared)break;
      if(this.pending){
        const p=this.pending,n=p.surface.normal,k=p.direction;
        if(k<BOUNDARY_LIGHT.directions){
          const d=BOUNDARY_DIRECTIONS[k],weight=Math.max(0,n.dot(d))/p.cosineSum;
          if(weight>0&&d.y>=0&&!this.occluders.hit(p.origin,d)){
            const zenith=Math.sqrt(d.y),skyShare=d.y===0?.5:1;for(let c=0;c<3;c++){const rho=p.surface.albedo.toArray()[c];p.transfer[c]+=rho*weight*skyShare*(1-zenith);p.transfer[c+3]+=rho*weight*skyShare*zenith;}
          }
          p.direction++;continue;
        }
        const weight=Math.max(0,n.dot(this.sunDirection))/Math.PI;
        if(weight>0&&!this.occluders.hit(p.origin,this.sunDirection))for(let c=0;c<3;c++)p.transfer[c+6]=p.surface.albedo.toArray()[c]*weight;
        this.store(Math.floor(p.primary/BOUNDARY_LIGHT.directions),p.primary%BOUNDARY_LIGHT.directions,p.transfer,0);this.pending=null;this.cursor++;continue;
      }
      if(this.cursor===POINTS*BOUNDARY_LIGHT.directions){
        // The direct sun is a delta light, separately stored as visibility;
        // it is never smeared into one of the coarse angular directions.
        this.completed=true;this.version++;break;
      }
      const probe=Math.floor(this.cursor/BOUNDARY_LIGHT.directions),direction=this.cursor%BOUNDARY_LIGHT.directions,origin=this.position(probe),d=BOUNDARY_DIRECTIONS[direction];
      if(direction===0){const visible=Number(!this.occluders.hit(origin,this.sunDirection));for(let k=0;k<BOUNDARY_LIGHT.directions;k++)this.sun[this.offset(probe,k)+3]=DataUtils.toHalfFloat(visible);}
      const result=this.occluders.hit(origin,d);
      if(!result){const z=Math.sqrt(Math.max(0,d.y)),h=d.y>0?1-z:d.y===0?.5:0;this.store(probe,direction,[h,h,h,z,z,z,0,0,0],1);this.cursor++;continue;}
      const surface=result.sampler.sample(result.hit);
      if(!surface){this.occluders.error='Represented surface sampler returned no albedo';break;}
      surface.albedo.setRGB(Math.max(0,Math.min(1,surface.albedo.r)),Math.max(0,Math.min(1,surface.albedo.g)),Math.max(0,Math.min(1,surface.albedo.b)));
      surface.normal.normalize();if(surface.normal.dot(d)>0)surface.normal.negate();
      this.pending={surface,origin:result.hit.point.clone().addScaledVector(surface.normal,.003),direction:0,transfer:Array(9).fill(0),cosineSum:BOUNDARY_DIRECTIONS.reduce((s,d)=>s+Math.max(0,surface.normal.dot(d)),0),primary:this.cursor};
    }
    const elapsed=performance.now()-start;this.workMs+=elapsed;this.bakeMs=this.workMs-this.treeMs;this.maximumSliceMs=Math.max(this.maximumSliceMs,elapsed);
  }
  receipt(){return{ready:this.completed,prepared:this.occluders?.prepared??false,treeReady:this.occluders?.ready??false,revision:this.revision,probes:POINTS,directions:BOUNDARY_LIGHT.directions,textureBytes:this.textureBytes,rays:this.occluders?.rayCount??0,triangles:this.occluders?.triangleCount??0,unsupportedMeshes:this.occluders?.unsupportedMeshes??0,candidateMaximum:this.occluders?.candidateMaximum??0,setupMs:this.setupMs,treeMs:this.treeMs,bakeMs:this.bakeMs,workMs:this.workMs,maximumSliceMs:this.maximumSliceMs,elapsedMs:this.started?performance.now()-this.started:0,error:this.occluders?.error??null,scope:'represented opaque geometry; cliff-only by default; terrain and native rocks unrepresented',approximation:'12-direction quadrature and one-bounce Lambert reflectance; no in-water attenuation'};}
}

export function sampleWaterfallRockAlbedo(pixels: Pick<ImageData, 'width' | 'height' | 'data'>, point: Vector3, normal: Vector3, tone = 1, diagnostic = 1): Color {
  const linear = (v: number) => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  const pixel = (u: number, v: number): Color => {
    const x = u * pixels.width - .5, y = (1 - v) * pixels.height - .5;
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const result = new Color(0, 0, 0);
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const wrap = (a: number, size: number) => ((a % size) + size) % size;
      const offset = (wrap(iy + dy, pixels.height) * pixels.width + wrap(ix + dx, pixels.width)) * 4;
      const weight = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy);
      result.r += linear(pixels.data[offset] / 255) * weight; result.g += linear(pixels.data[offset + 1] / 255) * weight; result.b += linear(pixels.data[offset + 2] / 255) * weight;
    }
    return result;
  };
  const phase = (x: number, y: number) => {
    const qx = x + Math.sin(x * .037 + y * .061) * .65, qy = y + Math.cos(-x * .047 + y * .029) * .65;
    return pixel(qx, qy).lerp(pixel((qx * .8 - qy * .6) * 1.017 + .37, (qx * .6 + qy * .8) * 1.017 + .63), Math.sin(x * .029 - y * .023) * .03 + .08);
  };
  const p = point.clone().multiplyScalar(1 / 1.5), n = normal.lengthSq() > 1e-8 ? normal : new Vector3(0, 1, 0);
  const weights = [Math.pow(n.x, 4), Math.pow(n.y, 4), Math.pow(n.z, 4)], sum = Math.max(.0001, weights.reduce((a, b) => a + b, 0));
  const projections = [phase(p.y, p.z), phase(p.z, p.x), phase(p.x, p.y)];
  const measured = new Color(0, 0, 0); projections.forEach((c, k) => measured.add(c.multiplyScalar(weights[k] / sum)));
  const result = new Color().setRGB(.42, .41, .39).lerp(measured, diagnostic);
  return result.setRGB(result.r * .85 * tone, result.g * .88 * tone, result.b * .90 * tone);
}
